import { useEffect, useRef, type CSSProperties } from 'react';
import { crosswordSlots, type CrosswordDirection } from '../../../../shared/games/crossword';

export function CrosswordGrid({
  cells,
  blocks,
  active = -1,
  dir = 'across',
  wrong = [],
  revealed = [],
  solved = false,
  onSelect,
}: {
  cells: string[];
  blocks: number[];
  active?: number;
  dir?: CrosswordDirection;
  wrong?: number[];
  revealed?: number[];
  solved?: boolean;
  onSelect?: (cell: number) => void;
}) {
  const slots = crosswordSlots(blocks);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current?.contains(document.activeElement))
      ref.current
        .querySelector<HTMLButtonElement>('[tabindex="0"]')
        ?.focus({ preventScroll: true });
  }, [active]);
  const word = slots.find((s) => s.dir === dir && s.cells.includes(active));
  return (
    <div
      className={`xw-grid${solved ? ' xw-solved' : ''}`}
      role="grid"
      ref={ref}
      aria-label={solved ? 'Solved Crossword' : 'Mini Crossword'}
    >
      {Array.from({ length: 5 }, (_, row) => (
        <div role="row" className="xw-row" key={row}>
          {Array.from({ length: 5 }, (_, col) => {
            const i = row * 5 + col,
              black = blocks.includes(i);
            const across = slots.find((s) => s.dir === 'across' && s.cells.includes(i));
            const down = slots.find((s) => s.dir === 'down' && s.cells.includes(i));
            const number = slots.find((s) => s.cells[0] === i)?.number;
            const label = black
              ? 'Black Cell'
              : `${across?.number} Across, ${down?.number} Down, ${cells[i] ? `letter ${cells[i]}` : 'blank'}${revealed.includes(i) ? ', Revealed' : ''}${wrong.includes(i) ? ', Incorrect' : ''}`;
            return (
              <div
                role="gridcell"
                aria-selected={i === active}
                aria-label={label}
                key={i}
                className={`xw-cell${black ? ' xw-black' : ''}${word?.cells.includes(i) ? ' xw-word' : ''}${i === active ? ' xw-active' : ''}${wrong.includes(i) ? ' xw-wrong' : ''}${revealed.includes(i) ? ' xw-revealed' : ''}`}
                style={{ '--xw-order': row + col } as CSSProperties}
              >
                {!black &&
                  (onSelect ? (
                    <button
                      type="button"
                      tabIndex={i === active ? 0 : -1}
                      aria-label={label}
                      onClick={() => onSelect(i)}
                    >
                      {number && <span className="xw-number">{number}</span>}
                      <span>{cells[i]}</span>
                    </button>
                  ) : (
                    <>
                      <span className="xw-number">{number}</span>
                      <span>{cells[i]}</span>
                    </>
                  ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
