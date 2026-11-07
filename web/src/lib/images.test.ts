import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeCrop, resizedDimensions, resizeImage } from './images';
afterEach(() => vi.unstubAllGlobals());
describe('image size math', () => {
  it('encodes a 512px crop as WebP and falls back to JPEG', async () => {
    const drawImage = vi.fn();
    let webp = true;
    let empty = false;
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ fillRect() {}, drawImage }),
      toBlob: (done: (blob: Blob | null) => void, type: string) =>
        done(empty ? null : new Blob(['photo'], { type: webp ? type : 'image/jpeg' })),
    };
    vi.stubGlobal('document', { createElement: () => canvas });
    const image = { source: {} as CanvasImageSource, width: 800, height: 400, close() {} };
    const rect = { x: 200, y: 0, width: 400, height: 400 };
    expect((await encodeCrop(image, rect)).type).toBe('image/webp');
    expect(canvas.width).toBe(512);
    expect(canvas.height).toBe(512);
    expect(drawImage).toHaveBeenCalledWith(image.source, 200, 0, 400, 400, 0, 0, 512, 512);
    webp = false;
    expect((await encodeCrop(image, rect)).type).toBe('image/jpeg');
    empty = true;
    await expect(encodeCrop(image, rect)).rejects.toThrow('Could not process');
  });
  it('caps portrait and landscape without changing aspect ratio', () => {
    expect(resizedDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(resizedDimensions(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(resizedDimensions(2048, 2048, 512)).toEqual({ width: 512, height: 512 });
  });
  it('does not upscale and never produces zero pixels', () => {
    expect(resizedDimensions(100, 50)).toEqual({ width: 100, height: 50 });
    expect(resizedDimensions(1, 100000)).toEqual({ width: 1, height: 1600 });
  });
  it('rejects empty, negative or non-finite dimensions', () => {
    for (const value of [0, -1, Infinity, NaN])
      expect(() => resizedDimensions(value, 200)).toThrow('Invalid image dimensions');
  });
  it('enforces the worker upload byte bounds on the processed JPEG', async () => {
    const close = vi.fn();
    let bytes = 1;
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 100, height: 100, close })),
    );
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({ fillRect() {}, drawImage() {} }),
        toBlob: (done: (blob: Blob) => void) =>
          done(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' })),
      }),
    });
    const file = new File(['source'], 'photo.jpg', { type: 'image/jpeg' });
    for (const size of [1, 1572864]) {
      bytes = size;
      expect((await resizeImage(file)).size).toBe(size);
    }
    bytes = 0;
    await expect(resizeImage(file)).rejects.toThrow('Photo cannot be empty');
    bytes = 1572865;
    await expect(resizeImage(file)).rejects.toThrow('Photo is too large after resizing');
    expect(close).toHaveBeenCalledTimes(4);
    await expect(
      resizeImage(new File(['source'], 'file.txt', { type: 'text/plain' })),
    ).rejects.toThrow('Choose a JPEG, PNG or WebP photo');
  });
});
