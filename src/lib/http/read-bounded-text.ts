// Reads a request body as UTF-8 with a hard byte cap, streaming, so an
// unauthenticated sender cannot make the server buffer an unbounded body
// (chunked requests carry no Content-Length). Returns null when too large.

export async function readBoundedText(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(declared) && declared > maxBytes) {
    return null;
  }

  const reader = request.body?.getReader();

  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    total += value.byteLength;

    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}
