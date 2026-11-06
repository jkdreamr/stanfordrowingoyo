import { seededRandom } from './fixtures';
const cache = new Map<string, Promise<Blob>>();
export function generatedImage(id: string): Promise<Blob> {
  const existing = cache.get(id);
  if (existing) return existing;
  const result = new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas unavailable'));
      return;
    }
    const random = seededRandom([...id].reduce((n, c) => n + c.charCodeAt(0), 0));
    ctx.fillStyle = '#bdc6c8';
    ctx.fillRect(0, 0, 960, 640);
    ctx.fillStyle = '#8c9990';
    ctx.beginPath();
    ctx.moveTo(0, 320);
    for (let x = 0; x <= 960; x += 80) ctx.lineTo(x, 240 + random() * 70);
    ctx.lineTo(960, 420);
    ctx.lineTo(0, 420);
    ctx.fill();
    ctx.fillStyle = '#7d9299';
    ctx.fillRect(0, 340, 960, 300);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = i % 2 ? '#a0b0b3' : '#6d848b';
      ctx.fillRect(random() * 960, 350 + random() * 280, 16 + random() * 80, 2);
    }
    ctx.fillStyle = '#545c5b';
    ctx.beginPath();
    ctx.moveTo(0, 550);
    ctx.lineTo(400, 450);
    ctx.lineTo(435, 470);
    ctx.lineTo(80, 640);
    ctx.lineTo(0, 640);
    ctx.fill();
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed'))),
      'image/jpeg',
      0.82,
    );
  });
  cache.set(id, result);
  return result;
}
