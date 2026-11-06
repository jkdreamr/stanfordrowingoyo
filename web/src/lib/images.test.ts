import { describe, expect, it } from 'vitest';
import { resizedDimensions } from './images';
describe('image size math', () => {
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
});
