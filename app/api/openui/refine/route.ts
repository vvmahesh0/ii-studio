import { MAX_GENERATION_REQUEST_BYTES } from "@/app/lib/prompt-limits";
import { allowedOrigin, generationInput } from "@/app/lib/openui/request";
import { beginGeneration } from "@/app/lib/model/provider";
import { publicFailure } from "@/app/lib/model/errors";
import { requestText } from "@/app/lib/model/request-body";
import { getThemeContract } from "@/app/lib/openui/themes/server";
import { isThemeId } from "@/app/lib/openui/themes/types";
import { cleanProgram, hasUsefulContent } from "@/app/lib/openui/protocol";
import { correctSelection } from "@/app/lib/openui/refinement/recovery";

import { autoClose } from "@openuidev/lang-core";
import {
  extractScope,
  mergeReplacement,
  refinementInstruction,
  selectionIndex,
  interfaceFingerprint,
  selectedElement,
} from "@/app/lib/openui/refinement/scope";

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
  const target = payload.target;
  try {
    if (typeof target !== "string" || target.length > 2000 || !input.previous)
      throw new Error("Select a component first.");
    extractScope(input.previous, target);
    const index = selectionIndex(
      input.previous,
      Object.keys(contract.spec.schema?.properties ?? {}),
    );
    if (!index[target]?.safe)
      throw new Error(
        "Select the containing section; this component is reused.",
      );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid selection." },
      { status: 400 },
    );
  }
  let lease;
  try {
    lease = await beginGeneration(request, theme, "targeted");
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
      let lastParseAt = 0;
      let corrections = 0;
      try {
        send({
          type: "status",
          message: "Generating",
        });
        const worker = await lease.getWorker();
        if (aborter.signal.aborted) throw new Error("Generation stopped.");
        const instruction = refinementInstruction(
          previous,
          target as string,
          prompt,
        );
        const inspectReplacement = (text: string) => {
          try {
            return contract.inspect(
              mergeReplacement(
                previous,
                target as string,
                contract.aliases(cleanProgram(text)),
              ).program,
            );
          } catch (error) {
            return {
              program: cleanProgram(text),
              errors: [
                error instanceof Error ? error.message : "Invalid replacement.",
              ],
              valid: false,
            };
          }
        };
        const checked = await correctSelection(
          instruction,
          (turnInstruction) =>
            worker.turn(
              turnInstruction,
              (delta) => {
                output += delta;
                send({ type: "delta", delta });
                if (performance.now() - lastParseAt > 80) {
                  lastParseAt = performance.now();
                  try {
                    const provisional = autoClose(cleanProgram(output));
                    const merged = mergeReplacement(
                      previous,
                      target as string,
                      contract.aliases(provisional.text),
                    ).program;
                    const inspected = contract.inspect(merged);
                    if (
                      inspected.valid &&
                      merged !== previous &&
                      (!provisional.wasIncomplete ||
                        hasUsefulContent(
                          selectedElement(
                            inspected.result.root,
                            target as string,
                          ),
                          300,
                          theme,
                        ))
                    ) {
                      firstContentMs ??= Math.round(
                        performance.now() - startedAt,
                      );
                      send({ type: "preview", program: merged });
                    }
                  } catch {
                    /* Keep the previous complete UI until a safe replacement is ready. */
                  }
                }
              },
              modelSignal,
            ),
          inspectReplacement,
          () => {
            corrections++;
            output = "";
            send({ type: "reset", message: "Correcting component settings" });
          },
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
          if (
            interfaceFingerprint(contract.parser.parse(previous).root) ===
            interfaceFingerprint(contract.parser.parse(checked.program).root)
          )
            throw new Error(
              "The selection did not change. Try a more specific instruction, or select its parent section.",
            );
          modelSignal.throwIfAborted();
          await lease.complete();
          send({
            type: "complete",
            theme,
            revision: contract.revision,
            program: checked.program,
            target,
            corrections,
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
