import type { Context } from '../context';
import type { ImageMetadata } from '../../../shared/types';
import { authenticate, refreshUser, requireUser } from '../auth/guards';
import { findImage, visibleImage, insertImage } from '../db/images';
import { MAX_IMAGE_BYTES, imageMime, imageTooLarge } from '../imageValidation';
import { HttpError, json } from '../http';
export async function create(ctx: Context) {
  if (Number(ctx.request.headers.get('Content-Length')) > MAX_IMAGE_BYTES) throw imageTooLarge();
  const bytes = await ctx.request.arrayBuffer();
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw imageTooLarge();
  if (!bytes.byteLength) throw new HttpError(400, 'VALIDATION_ERROR', 'Image cannot be empty.');
  await authenticate(ctx);
  const user = refreshUser(ctx);
  const mime = imageMime(ctx.request);
  const width = Number(ctx.request.headers.get('X-OYO-Image-Width'));
  const height = Number(ctx.request.headers.get('X-OYO-Image-Height'));
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
    throw new HttpError(400, 'VALIDATION_ERROR', 'Image dimensions must be positive.');
  const image: ImageMetadata = {
    id: crypto.randomUUID(),
    owner_id: user.id,
    mime,
    width,
    height,
    created_at: ctx.now.toISOString(),
  };
  insertImage(ctx.storage, image, bytes);
  return json({ id: image.id }, 201);
}
export function get(ctx: Context) {
  const user = requireUser(ctx);
  const image = findImage(ctx.storage, ctx.params.id);
  if (!image || !visibleImage(ctx.storage, image.id, user.id))
    throw new HttpError(404, 'NOT_FOUND', 'Image not found.');
  const headers = {
    'Content-Type': image.mime,
    'Cache-Control': 'private, max-age=31536000, immutable',
    ETag: `"${image.id}"`,
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'inline',
  };
  const tags = ctx.request.headers
    .get('If-None-Match')
    ?.split(',')
    .map((tag) => tag.trim().replace(/^W\//, ''));
  if (tags?.includes(headers.ETag) || tags?.includes('*'))
    return new Response(null, { status: 304, headers });
  return new Response(image.bytes, { headers });
}
