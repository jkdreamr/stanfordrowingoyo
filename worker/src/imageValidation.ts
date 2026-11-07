import type { ImageMetadata } from '../../shared/types';
import { HttpError } from './http';
export const MAX_IMAGE_BYTES = 1572864;
export const unsupportedImage = () =>
  new HttpError(
    415,
    'UNSUPPORTED_MEDIA_TYPE',
    'Upload a JPEG, PNG, or WebP image with matching content type.',
  );
export function dimensions(bytes: Uint8Array, mime: string): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (mime === 'image/png') {
    if (bytes.length < 8 || ![137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b))
      throw unsupportedImage();
    if (bytes.length >= 24 && text(12, 16) === 'IHDR' && view.getUint32(8) === 13)
      return [view.getUint32(16), view.getUint32(20)];
  } else if (mime === 'image/jpeg') {
    if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw unsupportedImage();
    let offset = 2;
    while (offset + 3 < bytes.length) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (
        [192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) &&
        length >= 7
      )
        return [view.getUint16(offset + 5), view.getUint16(offset + 3)];
      offset += length;
    }
  } else if (mime === 'image/webp') {
    if (bytes.length < 12 || text(0, 4) !== 'RIFF' || text(8, 12) !== 'WEBP')
      throw unsupportedImage();
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const kind = text(offset, offset + 4);
      const length = view.getUint32(offset + 4, true);
      const start = offset + 8;
      if (start + length > bytes.length) break;
      if (kind === 'VP8X' && length >= 10)
        return [
          1 + bytes[start + 4] + (bytes[start + 5] << 8) + (bytes[start + 6] << 16),
          1 + bytes[start + 7] + (bytes[start + 8] << 8) + (bytes[start + 9] << 16),
        ];
      if (kind === 'VP8L' && length >= 5 && bytes[start] === 47) {
        const bits = view.getUint32(start + 1, true);
        return [(bits & 16383) + 1, ((bits >>> 14) & 16383) + 1];
      }
      if (
        kind === 'VP8 ' &&
        length >= 10 &&
        bytes[start + 3] === 157 &&
        bytes[start + 4] === 1 &&
        bytes[start + 5] === 42
      )
        return [view.getUint16(start + 6, true) & 16383, view.getUint16(start + 8, true) & 16383];
      offset = start + length + (length % 2);
    }
  }
  throw new HttpError(400, 'VALIDATION_ERROR', 'Image dimensions could not be read.');
}
export const imageTooLarge = () =>
  new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Image must not exceed 1.5 MB.');
export function imageMime(request: Request): ImageMetadata['mime'] {
  const mime = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (!mime || !['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw unsupportedImage();
  return mime as ImageMetadata['mime'];
}
export async function readImage(request: Request) {
  const mime = imageMime(request);
  const declared = Number(request.headers.get('Content-Length'));
  if (declared > MAX_IMAGE_BYTES) throw imageTooLarge();
  let allocated = Number.isInteger(declared) && declared > 0 ? new Uint8Array(declared) : undefined;
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (reader)
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const offset = length;
      length += value.length;
      if (length > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw imageTooLarge();
      }
      if (allocated && length <= allocated.length) allocated.set(value, offset);
      else {
        if (allocated) {
          chunks.push(allocated.subarray(0, offset));
          allocated = undefined;
        }
        chunks.push(value);
      }
    }
  if (!length) throw new HttpError(400, 'VALIDATION_ERROR', 'Image cannot be empty.');
  let bytes: Uint8Array<ArrayBuffer>;
  if (allocated) bytes = allocated.length === length ? allocated : allocated.slice(0, length);
  else if (
    chunks.length === 1 &&
    chunks[0].buffer instanceof ArrayBuffer &&
    chunks[0].byteOffset === 0 &&
    chunks[0].byteLength === chunks[0].buffer.byteLength
  )
    bytes = chunks[0] as Uint8Array<ArrayBuffer>;
  else {
    bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
  }
  const [width, height] = dimensions(bytes, mime);
  if (!width || !height)
    throw new HttpError(400, 'VALIDATION_ERROR', 'Image dimensions must be positive.');
  return { bytes: bytes.buffer, mime, width, height };
}
