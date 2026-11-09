/** Returns the longest CSS duration in milliseconds, or the fallback for an invalid list. */
export function parseCssTime(value: string, fallback = 0): number {
  const times = value.split(',').map((part) => {
    const match = /^([+]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(ms|s)$/i.exec(part.trim());
    if (!match) return NaN;
    return Number(match[1]) * (match[2].toLowerCase() === 's' ? 1000 : 1);
  });
  return times.every(Number.isFinite) ? Math.max(...times) : fallback;
}
