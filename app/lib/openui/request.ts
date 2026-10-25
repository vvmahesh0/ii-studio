import { MAX_PROMPT_CHARACTERS } from "../prompt-limits.ts";
export function allowedOrigin(request: Request): boolean {
  try {
    const url = new URL(request.url);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    // Next constructs request.url using its internal server hostname. The Host
    // header retains the address used by the browser; validate it before use.
    const host = request.headers.get("host") ?? url.host;
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host))
      return false;
    const browserUrl = new URL(`${url.protocol}//${host}`);
    const origin = request.headers.get("origin");
    return origin === null || origin === browserUrl.origin;
  } catch {
    return false;
  }
}

export function generationInput(
  value: unknown,
): { prompt: string; previous: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (
    typeof body.prompt !== "string" ||
    (body.previous !== undefined && typeof body.previous !== "string")
  )
    return null;
  const prompt = body.prompt.trim();
  const previous = typeof body.previous === "string" ? body.previous : "";
  if (
    prompt.length < 4 ||
    prompt.length > MAX_PROMPT_CHARACTERS ||
    previous.length > 64_000
  )
    return null;
  return { prompt, previous };
}
