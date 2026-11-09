import { useState } from 'react';
import { ArrowUp, Check } from 'lucide-react';
import type { WorldleGuess } from '../../../../shared/types';
import { TRIES } from '../../../../shared/games/worldle';

const DIRECTIONS = {
  N: 'North',
  NE: 'Northeast',
  E: 'East',
  SE: 'Southeast',
  S: 'South',
  SW: 'Southwest',
  W: 'West',
  NW: 'Northwest',
};
const UNIT_KEY = 'oyo:worldle:unit';

export function WorldleBoard({ guesses }: { guesses: WorldleGuess[] }) {
  const [unit, setUnit] = useState<'km' | 'mi'>(() => {
    try {
      return localStorage.getItem(UNIT_KEY) === 'mi' ? 'mi' : 'km';
    } catch {
      return 'km';
    }
  });
  function changeUnit(next: 'km' | 'mi') {
    setUnit(next);
    try {
      localStorage.setItem(UNIT_KEY, next);
    } catch {
      /* Keep the preference in memory. */
    }
  }
  return (
    <section aria-label="Your guesses">
      <div className="worldle-board-heading">
        <span>
          {guesses.length} of {TRIES} guesses
        </span>
        <div className="worldle-units" role="group" aria-label="Distance unit">
          {(['km', 'mi'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={unit === value}
              onClick={() => changeUnit(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <ol className="worldle-board">
        {Array.from({ length: TRIES }, (_, i) => {
          const row = guesses[i];
          return (
            <li
              key={i}
              className={`worldle-row${row?.correct ? ' worldle-correct' : ''}`}
              aria-label={`Guess ${i + 1}${row ? '' : ', empty'}`}
            >
              {row ? (
                <>
                  <span
                    className="worldle-proximity-bar"
                    aria-hidden="true"
                    style={{ width: `${row.proximity}%` }}
                  />
                  <span className="worldle-country">{row.name}</span>
                  <span className="worldle-distance">
                    {Math.round(row.km * (unit === 'mi' ? 0.621371 : 1)).toLocaleString('en-US')}{' '}
                    {unit}
                  </span>
                  <span
                    role="img"
                    aria-label={row.correct ? 'Correct' : DIRECTIONS[row.direction]}
                    className="worldle-direction"
                  >
                    {row.correct ? (
                      <Check size={20} aria-hidden="true" />
                    ) : (
                      <ArrowUp
                        size={20}
                        aria-hidden="true"
                        style={{ transform: `rotate(${row.bearing}deg)` }}
                      />
                    )}
                  </span>
                  <span className="worldle-percent">{row.proximity}%</span>
                </>
              ) : (
                <>
                  <span className="worldle-empty-number">{i + 1}</span>
                  <span className="worldle-empty-line" aria-hidden="true" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
