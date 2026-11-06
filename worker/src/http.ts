export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public headers?: HeadersInit,
  ) {
    super(message);
  }
}
export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const noContent = () => new Response(null, { status: 204 });
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError)
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers: error.headers },
    );
  console.error(error);
  return json({ error: { code: 'INTERNAL', message: 'An internal error occurred.' } }, 500);
}
export async function readJson(
  request: Request,
  maxBytes = 65536,
): Promise<Record<string, unknown>> {
  if (
    request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
  if (Number(request.headers.get('Content-Length')) > maxBytes)
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (reader)
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
      }
      chunks.push(value);
    }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const result: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
    return result as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Body must be a JSON object.');
  }
}
