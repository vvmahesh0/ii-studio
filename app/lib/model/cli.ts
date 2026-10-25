import { findExecutable, spawnCli, terminateCli } from "./process.ts";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
export const providers = ["antigravity", "codex", "claude", "gemini"] as const;
export type Provider = (typeof providers)[number];
const state = globalThis as typeof globalThis & {
  iiCliSelection?: { provider: Provider; model: string };
};
export function selection() {
  return (
    state.iiCliSelection ?? {
      provider: (process.env.II_CLI_PROVIDER || "antigravity") as Provider,
      model: process.env.II_MODEL || "",
    }
  );
}
export function selectProvider(provider: Provider, model: string) {
  state.iiCliSelection = { provider, model };
}
const names = {
  antigravity: "agy",
  codex: "codex",
  claude: "claude",
  gemini: "gemini",
};
export function localProvider(): Provider {
  const value = selection().provider;
  if (!providers.includes(value as Provider))
    throw new Error(
      "Choose antigravity, codex, claude or gemini in II_CLI_PROVIDER.",
    );
  return value as Provider;
}
export async function executableFor(provider: Provider): Promise<string> {
  const explicit =
    process.env[`II_${provider.toUpperCase()}_PATH`] ||
    (provider === "antigravity" ? process.env.AGY_CLI_PATH : undefined);
  return findExecutable(names[provider], explicit);
}
export async function cliReady() {
  await executableFor(localProvider());
}
type RecordValue = { [key: string]: unknown };
const object = (x: unknown): RecordValue =>
  x && typeof x === "object" ? (x as RecordValue) : {};
export type CliEvent = {
  text?: string;
  final?: string;
  failed?: boolean;
  tool?: boolean;
};
export function decodeCli(provider: Provider, raw: unknown): CliEvent {
  const x = object(raw),
    item = object(x.item),
    event = object(x.event),
    delta = object(event.delta);
  if (provider === "codex") {
    if (x.type === "error" || x.type === "turn.failed") return { failed: true };
    if (
      (x.type === "item.started" || x.type === "item.completed") &&
      item.type !== "agent_message" &&
      item.type !== "reasoning" &&
      item.type !== "error"
    )
      return { tool: true };
    if (
      x.type === "item.completed" &&
      item.type === "agent_message" &&
      typeof item.text === "string"
    )
      return { text: item.text };
  }
  if (provider === "claude") {
    if (
      event.type === "content_block_start" &&
      object(event.content_block).type === "tool_use"
    )
      return { tool: true };
    if (
      x.type === "stream_event" &&
      delta.type === "text_delta" &&
      typeof delta.text === "string"
    )
      return { text: delta.text };
    if (x.type === "result")
      return x.is_error
        ? { failed: true }
        : { final: typeof x.result === "string" ? x.result : undefined };
  }
  if (provider === "gemini") {
    if (x.type === "tool_use" || x.type === "tool_result")
      return { tool: true };
    if (x.type === "error" || (x.type === "result" && x.status !== "success"))
      return { failed: true };
    if (
      x.type === "message" &&
      x.role === "assistant" &&
      typeof x.content === "string"
    )
      return { text: x.content };
  }
  return {};
}
export function cliArguments(provider: Provider, model?: string): string[] {
  const select = model ? ["--model", model] : [];
  if (provider === "codex")
    return [
      "exec",
      "--ignore-user-config",
      "--ignore-rules",
      "--ephemeral",
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "--disable",
      "shell_tool",
      "-c",
      'web_search="disabled"',
      "--json",
      ...select,
      "-",
    ];
  if (provider === "claude")
    return [
      "--print",
      "--verbose",
      "--output-format",
      "stream-json",
      "--include-partial-messages",
      "--tools",
      "",
      "--disable-slash-commands",
      "--strict-mcp-config",
      "--mcp-config",
      '{"mcpServers":{}}',
      "--setting-sources",
      "",
      "--settings",
      '{"disableAllHooks":true}',
      "--permission-mode",
      "dontAsk",
      "--no-session-persistence",
      ...select,
    ];
  if (provider === "gemini")
    return ["--output-format", "stream-json", "--sandbox", ...select];
  throw new Error("Antigravity uses the existing warm worker.");
}
function providerFailure(value: unknown) {
  const detail = JSON.stringify(value);
  if (
    /not logged in|unauth|sign.in|log.in|authenticat|credential|oauth/i.test(
      detail,
    )
  )
    return "The CLI needs authentication. Sign in using its official CLI, then reconnect.";
  if (/quota|rate.?limit|exhausted|capacity|credit|usage.?limit/i.test(detail))
    return "The selected provider reached a usage limit. Check its allowance or select another authorized connection.";
  return "The CLI could not finish. Check its model access and installed version.";
}
export class CliWorker {
  private provider: Provider;
  private instructions: string;
  private timeoutMs: number;
  constructor(provider: Provider, instructions: string, timeoutMs = 110000) {
    this.provider = provider;
    this.instructions = instructions;
    this.timeoutMs = Math.min(110000, Math.max(50, timeoutMs));
  }
  async turn(
    prompt: string,
    onDelta: (text: string) => void,
    signal: AbortSignal,
  ): Promise<string> {
    signal.throwIfAborted();
    const executable = await executableFor(this.provider);
    const dir = await mkdtemp(join(tmpdir(), "ii-studio-"));
    try {
      // Gemini's policy denies tools before execution, rather than relying on output rejection.
      if (this.provider === "gemini") {
        await mkdir(join(dir, ".gemini/policies"), { recursive: true });
        await writeFile(
          join(dir, ".gemini/policies/deny.toml"),
          '[[rule]]\ntoolName = "*"\ndecision = "deny"\npriority = 999\n',
        );
      }
      return await new Promise<string>((resolve, reject) => {
        const child = spawnCli(
          executable,
          cliArguments(this.provider, selection().model),
          dir,
        );
        let buffer = "",
          output = "",
          final = "",
          total = 0,
          settled = false;
        const kill = () => terminateCli(child);
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener("abort", abort);
          process.removeListener("exit", kill);
          if (error) {
            kill();
            reject(error);
          } else resolve(output || final);
        };
        process.once("exit", kill);
        const abort = () => finish(new Error("Generation stopped."));
        const timer = setTimeout(
          () =>
            finish(
              new Error(
                "The CLI took too long. Try a smaller request or another compatible model.",
              ),
            ),
          this.timeoutMs,
        );
        signal.addEventListener("abort", abort, { once: true });
        child.stderr.resume();
        child.stdin.on("error", () =>
          finish(
            new Error(
              "The CLI input connection closed. Check its sign-in and version.",
            ),
          ),
        );
        const consume = (line: string) => {
          if (!line.trim()) return;
          let value;
          try {
            value = JSON.parse(line);
          } catch {
            return finish(
              new Error(
                "The CLI returned an unsupported response. Check its version.",
              ),
            );
          }
          const ev = decodeCli(this.provider, value);
          if (ev.failed || ev.tool)
            return finish(
              new Error(
                ev.tool
                  ? "The CLI attempted an unsupported tool action. No result was accepted."
                  : providerFailure(value),
              ),
            );
          if (ev.final) {
            if (ev.final.length > 64000)
              return finish(
                new Error("Output is too large. Ask for a smaller design."),
              );
            final = ev.final;
          }
          if (ev.text) {
            output += ev.text;
            if (output.length > 64000)
              return finish(
                new Error("Output is too large. Ask for a smaller design."),
              );
            onDelta(ev.text);
          }
        };
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          total += Buffer.byteLength(chunk);
          if (total > 1000000)
            return finish(
              new Error("CLI response exceeded the transport limit."),
            );
          buffer += chunk;
          let pos;
          while (!settled && (pos = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, pos);
            buffer = buffer.slice(pos + 1);
            consume(line);
          }
        });
        child.on("error", () =>
          finish(
            new Error(
              "Could not start the selected CLI. Check installation and executable permissions.",
            ),
          ),
        );
        child.on("close", (code) => {
          if (settled) return;
          if (buffer.trim()) consume(buffer);
          if (settled) return;
          if (code !== 0 || !(output || final).trim())
            return finish(
              new Error(
                "The CLI returned no usable result. Check sign-in, model access and its installed version.",
              ),
            );
          if (!output && final) onDelta(final);
          finish();
        });
        child.stdin.end(
          `${this.instructions}\n\nReturn only the requested structured output. Do not use tools, read files or execute commands.\n\n${prompt}`,
        );
        if (signal.aborted) abort();
      });
    } finally {
      await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  }
}
