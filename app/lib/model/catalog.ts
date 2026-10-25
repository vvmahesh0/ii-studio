import { spawnCli, terminateCli } from "./process.ts";
import { tmpdir } from "node:os";
import { executableFor, type Provider } from "./cli.ts";

export type ModelOption = { id: string; label: string; isDefault?: boolean };
export type ModelCatalog = { models: ModelOption[]; note: string };
const validId = (id: unknown): id is string =>
  typeof id === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,99}$/.test(id);
export function parseAntigravityModels(output: string): ModelOption[] {
  const models = output.replace(/\x1b\[[0-9;]*m/g, "").split(/\r?\n/).flatMap(line => {
    const match = line.trim().match(/^(\S+)\t+(.+)$/);
    return match && validId(match[1]) ? [{ id: match[1], label: match[2].slice(0, 120) }] : [];
  });
  return [...new Map(models.map(model => [model.id, model])).values()].slice(0, 100);
}
export function parseCodexModels(result: unknown): ModelOption[] {
  if (!result || typeof result !== "object" || !("data" in result) || !Array.isArray(result.data)) return [];
  const models: ModelOption[] = [];
  for (const row of result.data) {
    if (!row || typeof row !== "object" || row.hidden || !validId(row.model)) continue;
    if (models.some(model => model.id === row.model)) continue;
    models.push({ id: row.model, label: typeof row.displayName === "string" ? row.displayName.slice(0, 120) : row.model, isDefault: row.isDefault === true });
  }
  return models.slice(0, 100);
}

/** Metadata only: never starts a thread, model turn, or local inference worker. */
async function discover(provider: Provider, executable: string): Promise<ModelOption[]> {
  if (provider !== "antigravity" && provider !== "codex") return [];
  return new Promise((resolve, reject) => {
    const child = spawnCli(executable, provider === "codex"
      ? ["app-server", "--listen", "stdio://", "-c", "analytics.enabled=false"]
      : ["models"], tmpdir());
    child.stderr.resume();
    let output = "", total = 0, settled = false;
    const finish = (models?: ModelOption[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdin.destroy();
      terminateCli(child, 1000);
      if (models?.length) resolve(models);
      else reject(new Error("Model list unavailable"));
    };
    const timer = setTimeout(() => finish(), 25000);
    const send = (value: object) => child.stdin.write(JSON.stringify(value) + "\n");
    child.stdin.on("error", () => finish());
    child.on("error", () => finish());
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      total += Buffer.byteLength(chunk);
      if (total > 2_000_000) return finish();
      output += chunk;
      if (provider !== "codex") return;
      let end;
      while ((end = output.indexOf("\n")) >= 0 && !settled) {
        const line = output.slice(0, end); output = output.slice(end + 1);
        let message;
        try { message = JSON.parse(line); } catch { continue; }
        if (message.id === 1) {
          if (message.error) return finish();
          send({ method: "initialized" });
          send({ id: 2, method: "model/list", params: { limit: 100, includeHidden: false } });
        }
        if (message.id === 2) finish(parseCodexModels(message.result));
      }
    });
    child.on("close", code => {
      if (provider === "antigravity" && code === 0) finish(parseAntigravityModels(output));
      else finish();
    });
    if (provider === "codex") send({ id: 1, method: "initialize", params: { clientInfo: { name: "ii_studio_models", version: "0.1.0" } } });
    else child.stdin.end();
  });
}
const cache = new Map<string, { expires: number; result: Promise<ModelCatalog> }>();
export async function modelCatalog(provider: Provider): Promise<ModelCatalog> {
  if (provider !== "antigravity" && provider !== "codex") return { models: [], note: "This CLI does not expose a model list here. Enter a model ID supported by your CLI." };
  try {
    const executable = await executableFor(provider);
    const key = `${provider}:${executable}`;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.result;
    const result = discover(provider, executable).then(models => ({ models, note: "Models reported by your CLI." })).catch(() => {
      const entry = cache.get(key);
      if (entry) entry.expires = Date.now() + 3000;
      return { models: [], note: "Could not fetch models from this CLI. Reopen this dialog to retry, or enter a model ID." };
    });
    cache.set(key, { expires: Date.now() + 60_000, result });
    return result;
  } catch {
    return { models: [], note: "Install and sign in to this CLI to fetch models." };
  }
}
