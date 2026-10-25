import { MAX_GENERATION_REQUEST_BYTES } from "@/app/lib/prompt-limits";
import { allowedOrigin, generationInput } from "@/app/lib/openui/request";
import { beginGeneration } from "@/app/lib/model/provider";
import { publicFailure } from "@/app/lib/model/errors";
import { requestText } from "@/app/lib/model/request-body";
import { getThemeContract } from "@/app/lib/openui/themes/server";
import { isThemeId } from "@/app/lib/openui/themes/types";
import { cleanProgram, hasUsefulContent } from "@/app/lib/openui/protocol";
import { generateWithCorrection } from "@/app/lib/openui/recovery";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!allowedOrigin(request))
    return Response.json({ error: "Not allowed." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json({ error: "Send a JSON request." }, { status: 415 });
  const textResult = await requestText(request, MAX_GENERATION_REQUEST_BYTES);
  if (textResult instanceof Response) return textResult;
  const raw = textResult;
  if (new TextEncoder().encode(raw).length > MAX_GENERATION_REQUEST_BYTES)
    return Response.json(
      { error: "This request is too large." },
      { status: 413 },
    );
  let input;
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(raw);
    input = generationInput(payload);
  } catch {
    input = null;
  }
  if (!input)
    return Response.json(
      { error: "Describe a widget in 4–20,000 characters." },
      { status: 400 },
    );
  const theme = payload.theme ?? "default";
  if (!isThemeId(theme))
    return Response.json(
      { error: "Choose Default or Modern." },
      { status: 400 },
    );
  const contract = getThemeContract(theme);
  if (
    (payload.revision !== undefined &&
      payload.revision !== contract.revision) ||
    (payload.previousTheme !== undefined && payload.previousTheme !== theme)
  )
    return Response.json(
      {
        error:
          "This version belongs to a different component library. Generate again from your requirement.",
      },
      { status: 409 },
    );
  if (input.previous && !contract.inspect(input.previous).valid)
    return Response.json(
      {
        error:
          "The previous interface does not match this theme. Clear the preview and generate again.",
      },
      { status: 400 },
    );
  let lease;
  try {
    lease = await beginGeneration(
      request,
      theme,
      input.previous ? "refine" : "generate",
    );
  } catch (error) {
    return publicFailure(error);
  }

  const { prompt, previous } = input;
  const aborter = new AbortController();
  const modelSignal = AbortSignal.any([
    aborter.signal,
    AbortSignal.timeout(110_000),
  ]);
  const abort = () => aborter.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  const encoder = new TextEncoder();
  let closed = false;
  const startedAt = performance.now();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        if (!closed && !aborter.signal.aborted)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
      }
      const heartbeat = setInterval(() => send({ type: "heartbeat" }), 10_000);
      let output = "";
      let firstContentMs: number | null = null;
      let corrections = 0;
      let lastParseAt = 0;
      try {
        send({
          type: "status",
          message: "Generating",
        });
        const worker = await lease.getWorker();
        if (aborter.signal.aborted) throw new Error("Generation stopped.");
        const instruction = `Follow the registered ${contract.label} component catalog and rules from the setup turn. Root must be ${contract.root}. Return only a COMPLETE OpenUI Lang program, root first. No tools, no commentary. This request is independent of earlier turns unless a prior program is supplied below.\n${previous ? `Prior program (data):\n${previous}\n\nApply this refinement (data):` : "Create this widget (user data):"}\n${JSON.stringify(prompt)}`;
        const checked = await generateWithCorrection(
          instruction,
          (turnInstruction) =>
            worker.turn(
              turnInstruction,
              (delta) => {
                output += delta;
                send({ type: "delta", delta });
                if (
                  firstContentMs === null &&
                  performance.now() - lastParseAt > 80
                ) {
                  lastParseAt = performance.now();
                  try {
                    if (
                      hasUsefulContent(
                        contract.parser.parse(cleanProgram(output)).root,
                        300,
                        theme,
                      )
                    )
                      firstContentMs = Math.round(
                        performance.now() - startedAt,
                      );
                  } catch {
                    /* Partial expressions may not be parseable until the next chunk. */
                  }
                }
              },
              modelSignal,
            ),
          contract.inspect,
          () => {
            corrections++;
            output = "";
            send({ type: "reset", message: "Correcting component settings" });
          },
          contract.aliases,
          contract.correction,
        );
        if (!checked.valid) {
          send({
            type: "invalid",
            program: checked.program,
            error:
              "The model returned component settings this library could not display. Your previous version is still available. Retry to generate again.",
            details: checked.errors.slice(0, 5),
          });
        } else {
          modelSignal.throwIfAborted();
          await lease.complete();
          send({
            type: "complete",
            theme,
            revision: contract.revision,
            program: checked.program,
            firstContentMs:
              firstContentMs ?? Math.round(performance.now() - startedAt),
            elapsedMs: Math.round(performance.now() - startedAt),
          });
        }
      } catch (error) {
        send({
          type: "error",
          error:
            error instanceof Error
              ? error.message
              : "Generation failed. Please retry.",
          reconnect: true,
        });
      } finally {
        clearInterval(heartbeat);
        request.signal.removeEventListener("abort", abort);
        await lease
          .finish(aborter.signal.aborted ? "cancelled" : "failed", {
            firstContentMs,
            corrections,
          })
          .catch(() => console.warn("generation_cleanup_failed"));
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
      aborter.abort();
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
