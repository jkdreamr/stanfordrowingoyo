import type { CSSProperties } from 'react';
import type { DiveTier } from '../../../../shared/games/dive';
import './dive.css';

export function WaterColumn({
  score,
  compact = false,
  tier,
}: {
  score: number;
  compact?: boolean;
  tier?: DiveTier;
}) {
  const maximum = tier ? 100 : 700;
  const depth = Math.max(0, Math.min(maximum, score));
  const height = compact ? 200 : 320;
  const range = height - 92;
  const position = 64 + (depth / maximum) * range;
  return (
    <div
      className="dive-water"
      role="img"
      aria-label={`Depth: ${score} meters out of ${maximum}`}
      data-tier={tier}
    >
      <svg viewBox={`0 0 560 ${height}`} aria-hidden="true">
        <rect width="560" height={height} className="dive-sky" />
        {[0, 1, 2, 3, 4].map((band) => (
          <rect
            key={band}
            x="0"
            y={48 + band * ((height - 48) / 5)}
            width="560"
            height={(height - 48) / 5 + 1}
            className={`dive-band dive-band-${band}`}
          />
        ))}
        <path
          d="M0 48 Q35 42 70 48 T140 48 T210 48 T280 48 T350 48 T420 48 T490 48 T560 48"
          className="dive-surface"
        />
        <g transform="translate(318 35)" className="dive-boat">
          <path d="M-72 0 Q0 17 72 0 Q48 23 -48 13 Z" fill="currentColor" />
          <path
            d="M-30 -5 L-63 22 M30 -5 L63 22"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle cx="-22" cy="-6" r="4" fill="currentColor" />
          <circle cx="0" cy="-6" r="4" fill="currentColor" />
          <circle cx="22" cy="-6" r="4" fill="currentColor" />
        </g>
        <g className="dive-ruler">
          {[0, maximum / 4, maximum / 2, maximum * 0.75, maximum].map((tick) => (
            <g key={tick} transform={`translate(484 ${64 + (tick / maximum) * range})`}>
              <path d="M0 0 H12" />
              <text x="20" y="4">
                {tick}
              </text>
            </g>
          ))}
        </g>
        <path d={`M428 64 V${64 + range}`} className="dive-line" />
        <g
          className={`dive-marker ${tier && depth > 0 ? 'dive-marker-sinking' : ''}`}
          style={
            {
              transform: `translate(428px, ${position}px)`,
              '--dive-marker-y': `${position}px`,
            } as CSSProperties
          }
        >
          <circle r="14" className="dive-marker-halo" />
          <circle r="6" />
          <path d="M-23 0 H-17 M17 0 H23" />
        </g>
        <text x="32" y="124" className="dive-depth">
          {score}
          <tspan dx="8" className="dive-unit">
            m
          </tspan>
        </text>
        <text x="34" y="152" className="dive-depth-label">
          {tier ? 'Answer Depth' : 'Total Depth'}
        </text>
        <path
          d="M24 264 Q52 258 80 264 M250 218 Q272 214 294 218 M126 296 Q155 290 184 296"
          className="dive-ripple"
        />
      </svg>
    </div>
  );
}
