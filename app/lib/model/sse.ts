/** Incremental SSE framing; supports split UTF-8, CRLF, comments and multi-line data. */
export async function* sseData(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let line = "",
    fields: string[] = [],
    pendingCR = false;
  let eventLength = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      const text = decoder.decode(value, { stream: !done });
      for (const char of text) {
        if (pendingCR) {
          pendingCR = false;
          if (char === "\n") continue;
        }
        if (char === "\r" || char === "\n") {
          pendingCR = char === "\r";
          if (!line) {
            if (fields.length) {
              yield fields.join("\n");
              fields = [];
              eventLength = 0;
            }
          } else if (line.startsWith("data:")) {
            fields.push(line.slice(5).replace(/^ /, ""));
            eventLength += line.length;
          }
          line = "";
        } else line += char;
        if (line.length > 1_000_000 || eventLength > 1_000_000)
          throw new Error("Model stream exceeded its safe size.");
      }
      if (done) break;
    }
    if (line.startsWith("data:")) fields.push(line.slice(5).replace(/^ /, ""));
    if (fields.length) yield fields.join("\n");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
