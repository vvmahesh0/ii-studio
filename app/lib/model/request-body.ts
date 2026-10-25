/** Bound bytes while reading, before allocating or parsing the complete request. */
export async function requestText(
  request: Request,
  limit: number,
): Promise<string | Response> {
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    return Response.json(
      { error: "This request is too large." },
      { status: 413 },
    );
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let bytes = 0,
    text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        return Response.json(
          { error: "This request is too large." },
          { status: 413 },
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch {
    return Response.json(
      { error: "The request was interrupted. Please retry." },
      { status: 400 },
    );
  } finally {
    reader.releaseLock();
  }
}
