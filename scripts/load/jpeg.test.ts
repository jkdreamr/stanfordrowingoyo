import { expect, it } from 'vitest';
import { makeJpeg } from './jpeg.ts';

it('generates a padded baseline 16x16 JPEG with well-formed segment lengths', () => {
  const bytes = makeJpeg();
  expect(bytes.length).toBeGreaterThan(300 * 1024 * 0.9);
  expect(bytes.length).toBeLessThan(300 * 1024 * 1.1);
  expect([...bytes.slice(0, 2)]).toEqual([255, 216]);
  expect([...bytes.slice(-2)]).toEqual([255, 217]);
  let position = 2;
  let dimensions: number[] = [];
  while (position < bytes.length) {
    expect(bytes[position]).toBe(255);
    const marker = bytes[position + 1];
    if (marker === 0xda) break;
    const length = (bytes[position + 2] << 8) | bytes[position + 3];
    expect(length).toBeGreaterThanOrEqual(2);
    expect(length).toBeLessThanOrEqual(65535);
    if (marker === 0xc0)
      dimensions = [
        (bytes[position + 5] << 8) | bytes[position + 6],
        (bytes[position + 7] << 8) | bytes[position + 8],
      ];
    position += 2 + length;
  }
  expect(dimensions).toEqual([16, 16]);
});
