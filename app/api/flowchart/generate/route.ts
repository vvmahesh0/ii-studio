import { MAX_GENERATION_REQUEST_BYTES } from "@/app/lib/prompt-limits";
import { MAX_PROMPT_CHARACTERS } from "@/app/lib/prompt-limits";
import { allowedOrigin } from "@/app/lib/openui/request";
import { beginGeneration } from "@/app/lib/model/provider";
import { publicFailure } from "@/app/lib/model/errors";
import { requestText } from "@/app/lib/model/request-body";
import { diagramSchema, FLOW_REVISION } from "@/app/lib/flowchart/contract";
import { generateFlowWithCorrection } from "@/app/lib/flowchart/generation";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 120;
const inputSchema = z
  .object({
    prompt: z.string().trim().min(4).max(MAX_PROMPT_CHARACTERS),
    previous: diagramSchema.optional(),
    question: z.string().max(500).optional(),
    answer: z.string().trim().max(1000).optional(),
    revision: z.literal(FLOW_REVISION),
  })
  .strict();
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
  let payload;
  try {
    payload = inputSchema.parse(JSON.parse(raw));
  } catch {
    return Response.json(
      {
        error:
          "Enter a requirement of 4–20,000 characters with a supported diagram.",
      },
      { status: 400 },
    );
  }
  let lease;
  try {
    lease = await beginGeneration(
      request,
      "flowchart",
      payload.previous ? "refine" : "generate",
    );
  } catch (error) {
    return publicFailure(error);
  }

  const aborter = new AbortController();
  const modelSignal = AbortSignal.any([
    aborter.signal,
    AbortSignal.timeout(110_000),
  ]);
  const abort = () => aborter.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  let closed = false;
  const encoder = new TextEncoder();
  const started = performance.now();
  const body = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        if (!closed && !aborter.signal.aborted)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
      };
      const heartbeat = setInterval(() => send({ type: "heartbeat" }), 10000);
      let firstTextMs: number | null = null;
      let firstGraphMs: number | null = null;
      let corrections = 0;
      let clarified = false;
      try {
        const worker = await lease.getWorker();
        if (aborter.signal.aborted) throw new Error("Generation stopped.");
        const instruction = `Follow the flowchart contract from setup. Return only NDJSON records or one clarification record. This is independent of prior turns unless current diagram is supplied. Preserve explicit policies and branch outcomes.\nRequest data: ${JSON.stringify(payload)}`;
        const result = await generateFlowWithCorrection(
          instruction,
          (prompt, onDelta) =>
            worker.turn(
              prompt,
              (delta) => {
                firstTextMs ??= performance.now() - started;
                onDelta(delta);
              },
              modelSignal,
            ),
          (diagram) => {
            firstGraphMs ??= performance.now() - started;
            send({ type: "preview", diagram });
          },
          () => {
            corrections++;
            send({
              type: "status",
              message: "Checking the diagram connections…",
            });
          },
        );
        if (result.clarification) {
          clarified = true;
          send({
            ...result.clarification,
            elapsedMs: performance.now() - started,
          });
        } else {
          modelSignal.throwIfAborted();
          await lease.complete();
          send({
            type: "complete",
            diagram: result.document,
            elapsedMs: performance.now() - started,
            firstTextMs,
            firstGraphMs,
            corrections,
          });
        }
      } catch (e) {
        send({
          type: "error",
          error:
            e instanceof Error ? e.message : "Could not finish this diagram.",
        });
      } finally {
        clearInterval(heartbeat);
        request.signal.removeEventListener("abort", abort);
        await lease
          .finish(
            aborter.signal.aborted
              ? "cancelled"
              : clarified
                ? "clarification"
                : "failed",
            { firstContentMs: firstGraphMs, firstTextMs, corrections },
          )
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
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
