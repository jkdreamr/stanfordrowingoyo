import type { WeeklyRecap } from '../../../shared/types';
import { formatCompactMeters, formatNumber, formatPercent } from './format';
import { gameFacts, planPercent, raceOutcome, recapRange } from './recap';

export const RECAP_IMAGE_WIDTH = 1080;
export const RECAP_IMAGE_HEIGHT = 1920;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif';
const SOFT = 'rgba(255,255,255,0.74)';
const PAD = 96;

export interface RecapTile {
  label: string;
  value: string;
  detail?: string;
}
/** The figures on the share image, in reading order. */
export function recapTiles(recap: WeeklyRecap): RecapTile[] {
  const tiles: RecapTile[] = [];
  if (recap.rank !== null)
    tiles.push({
      label: 'Team Rank',
      value: `#${formatNumber(recap.rank)}`,
      detail: `of ${formatNumber(recap.team.rowers)}`,
    });
  if (recap.race) {
    const race = raceOutcome(recap.race);
    tiles.push({
      label: 'vs Berkeley',
      value: race.word,
      detail: race.margin > 0 ? `by ${formatCompactMeters(race.margin)}` : undefined,
    });
  }
  if (recap.plan)
    tiles.push({
      label: 'My Fortnight',
      value: recap.plan.complete ? 'Complete' : formatPercent(planPercent(recap.plan)),
      detail: `Week ${recap.plan.week}`,
    });
  if (recap.games.played > 0)
    tiles.push({
      label: 'Games',
      value: formatNumber(recap.games.played),
      detail: gameFacts(recap.games)[0] ?? 'Played',
    });
  tiles.push({
    label: 'Workouts',
    value: formatNumber(recap.entry_count),
    detail: recap.streak > 0 ? `${formatNumber(recap.streak)} Week Streak` : undefined,
  });
  return tiles.slice(0, 4);
}

function fit(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  size: number,
  max: number,
) {
  let current = size;
  ctx.font = `${weight} ${current}px ${FONT}`;
  while (current > 12 && ctx.measureText(text).width > max) {
    current -= 2;
    ctx.font = `${weight} ${current}px ${FONT}`;
  }
  return current;
}
function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Paints the 1080×1920 story card: cardinal ground, the week's E-meters, then up to four figures. */
export function drawRecap(ctx: CanvasRenderingContext2D, recap: WeeklyRecap, name: string) {
  const W = RECAP_IMAGE_WIDTH,
    H = RECAP_IMAGE_HEIGHT,
    inner = W - PAD * 2;
  const ground = ctx.createLinearGradient(0, 0, W * 0.36, H);
  ground.addColorStop(0, '#9c1c18');
  ground.addColorStop(0.48, '#8c1515');
  ground.addColorStop(1, '#5e0d0d');
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);
  // The puddle an oar leaves at the release: the app's signature, drawn as faint rings.
  ctx.save();
  ctx.translate(W * 0.86, H * 0.2);
  ctx.scale(1, 0.42);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, 120 + i * 92, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.1 - i * 0.016})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = SOFT;
  ctx.font = `600 40px ${FONT}`;
  ctx.fillText('Stanford Rowing', PAD, 180);
  ctx.fillStyle = '#fff';
  fit(ctx, recapRange(recap.week_start), 700, 64, inner);
  ctx.fillText(recapRange(recap.week_start), PAD, 260);
  ctx.fillStyle = SOFT;
  fit(ctx, name, 500, 40, inner);
  ctx.fillText(name, PAD, 320);

  ctx.fillStyle = '#fff';
  const total = formatNumber(recap.total_m);
  fit(ctx, total, 700, 232, inner);
  ctx.fillText(total, PAD - 6, 660);
  ctx.fillStyle = SOFT;
  ctx.font = `500 44px ${FONT}`;
  ctx.fillText(`of ${formatNumber(recap.target_m)} E-meters`, PAD, 740);

  const ratio = recap.target_m > 0 ? Math.min(1, recap.total_m / recap.target_m) : 0;
  rounded(ctx, PAD, 800, inner, 28, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
  if (ratio > 0) {
    rounded(ctx, PAD, 800, Math.max(28, inner * ratio), 28, 14);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.font = `700 48px ${FONT}`;
  ctx.fillText(formatPercent(recap.percent), PAD, 912);
  if (recap.hit_target) {
    ctx.textAlign = 'right';
    ctx.font = `600 40px ${FONT}`;
    ctx.fillText('Target Hit', W - PAD, 912);
    ctx.textAlign = 'left';
  }

  const tiles = recapTiles(recap);
  const gap = 32,
    tileW = (inner - gap) / 2,
    tileH = 300,
    top = 1000;
  tiles.forEach((tile, i) => {
    const x = PAD + (i % 2) * (tileW + gap),
      y = top + Math.floor(i / 2) * (tileH + gap);
    rounded(ctx, x, y, tileW, tileH, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = SOFT;
    fit(ctx, tile.label, 600, 36, tileW - 80);
    ctx.fillText(tile.label, x + 40, y + 76);
    ctx.fillStyle = '#fff';
    fit(ctx, tile.value, 700, 104, tileW - 80);
    ctx.fillText(tile.value, x + 40, y + 196);
    if (tile.detail) {
      ctx.fillStyle = SOFT;
      fit(ctx, tile.detail, 500, 34, tileW - 80);
      ctx.fillText(tile.detail, x + 40, y + 252);
    }
  });

  ctx.fillStyle = SOFT;
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText('OYO', PAD, H - 120);
  ctx.textAlign = 'right';
  ctx.font = `500 36px ${FONT}`;
  ctx.fillText(`${formatNumber(recap.team.total_m)} Team E-meters`, W - PAD, H - 120);
  ctx.textAlign = 'left';
}

export const recapFileName = (week: string) => `oyo-week-${week}.png`;

/** Renders the share card to a PNG file, or null where canvas is unavailable. */
export async function recapImage(recap: WeeklyRecap, name: string): Promise<File | null> {
  const canvas = document.createElement('canvas');
  canvas.width = RECAP_IMAGE_WIDTH;
  canvas.height = RECAP_IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  drawRecap(ctx, recap, name);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob ? new File([blob], recapFileName(recap.week_start), { type: 'image/png' }) : null;
}

/** Shares the image where the platform takes files, otherwise downloads it. */
export async function shareRecapFile(
  file: File,
  data: { title: string; text: string },
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ ...data, files: [file] });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
