export function resizedDimensions(width: number, height: number, maxSide = 1600) {
  if (![width, height, maxSide].every((n) => Number.isFinite(n) && n > 0))
    throw new Error('Invalid image dimensions');
  const ratio = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}
async function decode(
  file: File,
): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      /* Fall back to the browser image decoder */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not read this photo'));
      img.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
export async function resizeImage(file: File, maxSide = 1600, square = false): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPEG, PNG or WebP photo');
  const decoded = await decode(file);
  try {
    const crop = Math.min(decoded.width, decoded.height);
    const size = resizedDimensions(
      square ? crop : decoded.width,
      square ? crop : decoded.height,
      maxSide,
    );
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo processing is unavailable');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
    if (square)
      context.drawImage(
        decoded.source,
        (decoded.width - crop) / 2,
        (decoded.height - crop) / 2,
        crop,
        crop,
        0,
        0,
        size.width,
        size.height,
      );
    else context.drawImage(decoded.source, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not process this photo'))),
        'image/jpeg',
        0.82,
      ),
    );
    if (blob.size > 1.5 * 1024 * 1024)
      throw new Error('Photo is too large after resizing. Choose a smaller photo');
    return blob;
  } finally {
    decoded.close();
  }
}
