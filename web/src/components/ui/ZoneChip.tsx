import type { Zone } from '../../../../shared/types';
const colors: Record<Zone, string> = {
  R: 'bg-zone-R',
  'R/E': 'bg-zone-R/E',
  E: 'bg-zone-E',
  'E/D': 'bg-zone-E/D',
  D: 'bg-zone-D',
  'D/C': 'bg-zone-D/C',
  C: 'bg-zone-C',
  'C/B': 'bg-zone-C/B',
  B: 'bg-zone-B',
  A: 'bg-zone-A',
};
export function ZoneChip({ zone, selected = false }: { zone: Zone; selected?: boolean }) {
  return (
    <span className={`ui-zone ${colors[zone]} ${selected ? 'ui-zone-selected' : ''}`}>{zone}</span>
  );
}
export function ZoneOption({
  zone,
  selected,
  onClick,
}: {
  zone: Zone;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <label className="ui-zone-option inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
      <input
        type="radio"
        name="zone"
        aria-label={`Zone ${zone}`}
        checked={selected}
        onChange={onClick}
        className="peer sr-only"
      />
      <span className="peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-focus">
        <ZoneChip zone={zone} selected={selected} />
      </span>
    </label>
  );
}
