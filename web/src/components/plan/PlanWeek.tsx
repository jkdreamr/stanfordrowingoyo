import { Fragment } from 'react';
import type { PlanSlot } from '../../../../shared/types';
import { ZoneChip } from '../ui';
import { slotDisplayText, slotLabel, weekLabel, SLOTS, type ScheduleWeek } from './schedule';
export function SlotItem({
  item,
  label,
  secondary = false,
}: {
  item: PlanSlot;
  label?: string;
  secondary?: boolean;
}) {
  return (
    <div
      className={
        'min-w-0 rounded-control p-3 ' +
        (secondary ? 'text-muted ' : '') +
        (item.kind === 'team' ? 'border border-divider bg-surface' : 'bg-surface-2')
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-caption font-semibold">
        <span>{item.kind === 'oyo' ? 'OYO' : item.kind === 'off' ? 'Off' : 'Team'}</span>
        {label && <span>{label}</span>}
        {item.kind === 'oyo' && item.zone && <ZoneChip zone={item.zone} />}
      </div>
      <p className="whitespace-pre-line break-words text-footnote">{slotDisplayText(item)}</p>
    </div>
  );
}
export function PlanWeek({
  week,
  preview = false,
  today,
  showHeading = true,
}: {
  week: ScheduleWeek;
  preview?: boolean;
  today?: string;
  showHeading?: boolean;
}) {
  const label = week.week_start ? weekLabel(week.week_start) : `Week ${week.week}`;
  const responsive = preview || !!week.week_start;
  const hasPM2 =
    !week.week_start || week.days.some((day) => day.slots.some((row) => row.slot === 'PM2'));
  const slots = hasPM2 ? SLOTS : SLOTS.filter((slot) => slot !== 'PM2');
  const WeekHeading = preview ? 'h2' : 'h3';
  const DayHeading = preview ? 'h3' : 'h4';
  return (
    <section
      aria-label={preview ? `${label} Preview` : undefined}
      className={responsive ? '[container-type:inline-size]' : undefined}
    >
      {showHeading && <WeekHeading className="text-title3">{label}</WeekHeading>}
      {week.total && (
        <p
          className={
            'mt-1 text-subhead tabular-nums text-muted' + (responsive ? ' break-words' : '')
          }
        >
          {week.total}
        </p>
      )}
      <div
        className={
          responsive
            ? 'mt-4 grid gap-4 [@container(min-width:560px)]:grid-cols-2 [@container(min-width:900px)]:hidden'
            : 'mt-4 space-y-4 lg:hidden'
        }
      >
        {week.days.map((day) => (
          <div key={day.name}>
            <DayHeading
              aria-current={today && day.date === today ? 'date' : undefined}
              className={
                'mb-2 text-headline' + (today && day.date === today ? ' text-accent-ink' : '')
              }
            >
              {day.name}
            </DayHeading>
            {!day.slots.length ? (
              <p className="text-subhead text-muted">Off</p>
            ) : (
              <div className="space-y-2">
                {day.slots.map((item) => (
                  <div
                    key={item.slot}
                    className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-2"
                  >
                    <span className="pt-3 text-caption tabular-nums text-muted">
                      {slotLabel(item.slot, hasPM2)}
                    </span>
                    <SlotItem item={item} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div
        className={
          'mt-4 hidden grid-cols-[48px_repeat(7,minmax(0,1fr))] gap-2 ' +
          (responsive ? '[@container(min-width:900px)]:grid' : 'lg:grid')
        }
      >
        <div aria-hidden="true" />
        {week.days.map((day) => (
          <DayHeading
            key={day.name}
            aria-current={today && day.date === today ? 'date' : undefined}
            className={
              'text-footnote font-semibold' +
              (today && day.date === today ? ' text-accent-ink' : '')
            }
          >
            {day.name.slice(0, 3)}
          </DayHeading>
        ))}
        {slots.map((slot, index) => (
          <Fragment key={slot}>
            <p className="pt-3 text-caption tabular-nums text-muted">{slotLabel(slot, hasPM2)}</p>
            {week.days.map((day) => {
              const item = day.slots.find((row) => row.slot === slot);
              return (
                <div key={day.name + slot} className="min-w-0">
                  {item ? (
                    <SlotItem item={item} />
                  ) : day.off && index === 0 ? (
                    <p className="p-3 text-footnote text-muted">Off</p>
                  ) : null}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
