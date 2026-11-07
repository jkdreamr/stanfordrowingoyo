export type Point = { x: number; y: number };
export type Crop = Point & { zoom: number };
function positive(...values: number[]) {
  if (!values.every((value) => Number.isFinite(value) && value > 0))
    throw new Error('Invalid crop dimensions');
}
export function coverScale(width: number, height: number, viewport: number) {
  positive(width, height, viewport);
  return viewport / Math.min(width, height);
}
export function clampCrop(width: number, height: number, viewport: number, crop: Crop): Crop {
  const zoom = Math.min(4, Math.max(1, crop.zoom));
  if (![crop.x, crop.y, crop.zoom].every(Number.isFinite)) throw new Error('Invalid crop');
  const scale = coverScale(width, height, viewport) * zoom;
  const limitX = (width * scale - viewport) / 2;
  const limitY = (height * scale - viewport) / 2;
  return {
    zoom,
    x: Math.max(-limitX, Math.min(limitX, crop.x)),
    y: Math.max(-limitY, Math.min(limitY, crop.y)),
  };
}
export function zoomAt(
  width: number,
  height: number,
  viewport: number,
  crop: Crop,
  zoom: number,
  focal: Point,
): Crop {
  const next = Math.min(4, Math.max(1, zoom));
  const ratio = next / crop.zoom;
  return clampCrop(width, height, viewport, {
    zoom: next,
    x: focal.x - (focal.x - crop.x) * ratio,
    y: focal.y - (focal.y - crop.y) * ratio,
  });
}
export function sourceRect(width: number, height: number, viewport: number, crop: Crop) {
  const clamped = clampCrop(width, height, viewport, crop);
  const scale = coverScale(width, height, viewport) * clamped.zoom;
  const size = viewport / scale;
  return {
    x: (width - size) / 2 - clamped.x / scale,
    y: (height - size) / 2 - clamped.y / scale,
    width: size,
    height: size,
  };
}
