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
    <button
      type="button"
      aria-label={`Zone ${zone}`}
      aria-pressed={selected}
      onClick={onClick}
      className="ui-zone-option"
    >
      <ZoneChip zone={zone} selected={selected} />
    </button>
  );
}
