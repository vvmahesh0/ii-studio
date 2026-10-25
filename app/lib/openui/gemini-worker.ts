import { spawnCli, terminateCli } from "../model/process.ts";
import { executableFor, selection } from "../model/cli";
import { type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateSystemPrompt } from "@openuidev/lang-core";
import { decodeModelEvent } from "./protocol";
import { getThemeContract } from "./themes/server";
import { flowInstructions } from "../flowchart/prompt";
import { FLOW_REVISION } from "../flowchart/contract";
import { type ThemeId, themeInfo } from "./themes/types";

export class ModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelError";
  }
}

function modelMessage(message: string) {
  if (/quota|limit|exhausted|rate.?limit|capacity/i.test(message))
    return "Gemini has reached a usage limit. Wait a moment or check your subscription quota.";
  if (/auth|sign.?in|log.?in|credential|unauthorized/i.test(message))
    return "Antigravity needs you to sign in again. Open Antigravity, sign in, then reconnect here.";
  return "Gemini could not finish this request. Try again, or reconnect the model.";
}

type Turn = {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  onDelta: (text: string) => void;
  accumulated: string;
  cleanup: () => void;
};

export class GeminiWorker {
  private child: ChildProcessWithoutNullStreams;
  private current: Turn | null = null;
  private buffer = "";
  private startupResolve!: () => void;
  private startupReject!: (error: Error) => void;
  private ready: Promise<void>;
  private parentExit: () => void;
  private directory: string;
  dead = false;
  primed = false;

  private constructor(directory: string, executable: string) {
    this.directory = directory;
    this.ready = new Promise<void>((resolve, reject) => {
      this.startupResolve = resolve;
      this.startupReject = reject;
    });
    this.child = spawnCli(
      /* turbopackIgnore: true */ executable,
      [
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--model",
        selection().model || process.env.MOSAIC_GEMINI_MODEL || "gemini-3.8-flash-low",
        "--effort",
        "low",
        "--disable-slash-commands",
        "--sandbox",
      ],
      directory,
    );
    const timer = setTimeout(
      () =>
        this.stop(
          new ModelError(
            "Antigravity took too long to connect. Reconnect and try again.",
          ),
        ),
      30_000,
    );
    this.ready.then(
      () => clearTimeout(timer),
      () => clearTimeout(timer),
    );
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (data: string) => this.consume(data));
    this.child.stdin.on("error", () =>
      this.stop(
        new ModelError(
          "The Gemini input connection closed. Reconnect to continue.",
        ),
      ),
    );
    // Drain diagnostics, but do not forward CLI internals or credentials to the browser.
    this.child.stderr.resume();
    this.child.on("error", () =>
      this.stop(
        new ModelError(
          "Antigravity CLI could not start. Check its installation and sign-in.",
        ),
      ),
    );
    this.child.on("close", () =>
      this.stop(
        new ModelError("The Gemini connection closed. Reconnect to continue."),
      ),
    );
    this.parentExit = () => {
      terminateCli(this.child);
    };
    process.once("exit", this.parentExit);
  }

  static async create(profile: ThemeId | "flowchart") {
    const executable = await executableFor("antigravity");
    const directory = await mkdtemp(join(tmpdir(), "mosaic-openui-"));
    const worker = new GeminiWorker(directory, executable);
    await worker.ready;
    const instructions =
      profile === "flowchart"
        ? flowInstructions
        : generateSystemPrompt({
            library: getThemeContract(profile).spec,
            promptOptions: getThemeContract(profile).promptOptions,
          });
    await worker.turn(
      `${instructions}\n\nSETUP TURN: Learn this library and these rules for the upcoming widget requests. Do not call any tools. For this setup turn only, reply with READY.`,
      () => {},
      new AbortController().signal,
    );
    worker.primed = true;
    return worker;
  }

  private consume(chunk: string) {
    this.buffer += chunk;
    if (this.buffer.length > 300_000)
      return this.stop(
        new ModelError(
          "Gemini returned too much output. Try a smaller widget.",
        ),
      );
    let boundary: number;
    while ((boundary = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 1);
      if (!line.trim()) continue;
      let raw: unknown;
      try {
        raw = JSON.parse(line);
      } catch {
        continue;
      }
      const event = decodeModelEvent(raw);
      if (!event) continue;
      if (event.kind === "ready") {
        this.startupResolve();
        continue;
      }
      if (event.kind === "tool")
        return this.stop(
          new ModelError(
            "Gemini attempted a tool action instead of producing a widget. No tool output was used. Please retry.",
          ),
        );
      const current = this.current;
      if (!current) continue;
      if (event.kind === "delta") {
        current.accumulated += event.text;
        if (current.accumulated.length > 64_000)
          return this.stop(
            new ModelError(
              "This widget exceeded the output limit. Ask for a smaller section.",
            ),
          );
        current.onDelta(event.text);
      }
      if (event.kind === "error")
        return this.stop(new ModelError(modelMessage(event.message)));
      if (event.kind === "complete") {
        this.current = null;
        current.cleanup();
        current.resolve(event.text || current.accumulated);
      }
    }
  }

  turn(
    prompt: string,
    onDelta: (text: string) => void,
    signal: AbortSignal,
  ): Promise<string> {
    if (this.dead)
      return Promise.reject(
        new ModelError("The model connection needs to be restarted."),
      );
    if (this.current)
      return Promise.reject(
        new ModelError(
          "Gemini is already generating. Wait for that request or stop it first.",
        ),
      );
    if (signal.aborted)
      return Promise.reject(new ModelError("Generation stopped."));
    return new Promise((resolve, reject) => {
      const abort = () => this.stop(new ModelError("Generation stopped."));
      const timer = setTimeout(
        () =>
          this.stop(
            new ModelError(
              "Gemini took longer than 90 seconds. Try a smaller widget.",
            ),
          ),
        90_000,
      );
      this.current = {
        resolve,
        reject,
        onDelta,
        accumulated: "",
        cleanup: () => {
          clearTimeout(timer);
          signal.removeEventListener("abort", abort);
        },
      };
      signal.addEventListener("abort", abort, { once: true });
      this.child.stdin.write(
        JSON.stringify({
          event: "user",
          message: { role: "user", content: prompt },
        }) + "\n",
        (error) => {
          if (error)
            this.stop(
              new ModelError(
                "Could not send the request to Gemini. Reconnect and try again.",
              ),
            );
        },
      );
    });
  }

  stop(error: Error) {
    if (this.dead) return;
    this.dead = true;
    this.primed = false;
    this.startupReject(error);
    const current = this.current;
    this.current = null;
    current?.cleanup();
    current?.reject(error);
    terminateCli(this.child);
    process.removeListener("exit", this.parentExit);
    void rm(this.directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

const shared = globalThis as typeof globalThis & {
  iiGeminiWorkers?: Map<string, Promise<GeminiWorker>>;
  mosaicGenerating?: boolean;
};

export async function getWarmWorker(
  theme: ThemeId | "flowchart" = "default",
): Promise<GeminiWorker> {
  const workers = (shared.iiGeminiWorkers ??= new Map());
  const key = `${selection().model}:${theme}:${theme === "flowchart" ? FLOW_REVISION : themeInfo[theme].revision}`;
  const existing = workers.get(key);
  if (existing) {
    const worker = await existing;
    if (!worker.dead) return worker;
    if (workers.get(key) === existing) workers.delete(key);
    return getWarmWorker(theme);
  }
  const pending = GeminiWorker.create(theme);
  workers.set(key, pending);
  try {
    return await pending;
  } catch (error) {
    if (workers.get(key) === pending) workers.delete(key);
    throw error;
  }
}

export function reserveGeneration(): boolean {
  if (shared.mosaicGenerating) return false;
  shared.mosaicGenerating = true;
  return true;
}
export function releaseGeneration() {
  shared.mosaicGenerating = false;
}
