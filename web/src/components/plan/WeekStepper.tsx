import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, weekStart } from '../../../../shared/dates';
import { Button } from '../ui';
import { weekLabel } from './schedule';

export function WeekStepper({
  week,
  today,
  onChange,
  disabled = false,
}: {
  week: string;
  today: string;
  onChange: (week: string) => void;
  disabled?: boolean;
}) {
  const current = weekStart(today);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="plain"
          aria-label="Previous Week"
          className="min-h-11 min-w-11"
          disabled={disabled || addDays(week, -7) < '2000-01-01'}
          onClick={() => onChange(addDays(week, -7))}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </Button>
        <h2 className="text-center text-title3">{weekLabel(week)}</h2>
        <Button
          variant="plain"
          aria-label="Next Week"
          className="min-h-11 min-w-11"
          disabled={disabled || addDays(week, 7) > addDays(today, 365)}
          onClick={() => onChange(addDays(week, 7))}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </Button>
      </div>
      {week !== current && (
        <div className="text-center">
          <Button variant="plain" disabled={disabled} onClick={() => onChange(current)}>
            This Week
          </Button>
        </div>
      )}
    </div>
  );
}
