import { describe, expect, it } from 'vitest';
import { clampCrop, coverScale, sourceRect, zoomAt } from './crop';
describe('profile crop math', () => {
  it('covers portrait, landscape and small images', () => {
    expect(coverScale(800, 400, 200)).toBe(0.5);
    expect(coverScale(400, 800, 200)).toBe(0.5);
    expect(coverScale(50, 50, 200)).toBe(4);
  });
  it('clamps pan and zoom so the viewport stays covered', () => {
    expect(clampCrop(800, 400, 200, { x: 500, y: -500, zoom: 0 })).toEqual({
      x: 100,
      y: -0,
      zoom: 1,
    });
    expect(clampCrop(400, 400, 200, { x: 500, y: 500, zoom: 9 })).toEqual({
      x: 300,
      y: 300,
      zoom: 4,
    });
  });
  it('zooms about a focal point and maps back to source pixels', () => {
    const crop = zoomAt(800, 400, 200, { x: 0, y: 0, zoom: 1 }, 2, { x: 50, y: 25 });
    expect(crop).toEqual({ x: -50, y: -25, zoom: 2 });
    expect(sourceRect(800, 400, 200, crop)).toEqual({ x: 350, y: 125, width: 200, height: 200 });
    expect(sourceRect(400, 800, 200, { x: 0, y: 0, zoom: 1 })).toEqual({
      x: 0,
      y: 200,
      width: 400,
      height: 400,
    });
  });
  it('rejects empty or invalid dimensions and offsets', () => {
    for (const n of [0, -1, NaN, Infinity]) expect(() => coverScale(n, 400, 200)).toThrow();
    expect(() => clampCrop(400, 400, 200, { x: NaN, y: 0, zoom: 1 })).toThrow();
  });
});
