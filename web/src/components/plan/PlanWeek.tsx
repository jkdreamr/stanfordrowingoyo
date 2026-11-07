import { Fragment } from 'react';
import type { PlanSlot } from '../../../../shared/types';
import { ZoneChip } from '../ui';
import { slotDisplayText, SLOTS, type ScheduleWeek } from './schedule';
function SlotItem({ item }: { item: PlanSlot }) {
  return (
    <div
      className={
        'min-w-0 rounded-control p-3 ' +
        (item.kind === 'team' ? 'border border-divider bg-surface' : 'bg-surface-2')
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-caption font-semibold">
        <span>{item.kind === 'oyo' ? 'OYO' : 'Team'}</span>
        {item.kind === 'oyo' && item.zone && <ZoneChip zone={item.zone} />}
      </div>
      <p className="break-words text-footnote">{slotDisplayText(item)}</p>
    </div>
  );
}
export function PlanWeek({ week, preview = false }: { week: ScheduleWeek; preview?: boolean }) {
  const WeekHeading = preview ? 'h2' : 'h3';
  const DayHeading = preview ? 'h3' : 'h4';
  return (
    <section
      aria-label={preview ? `Week ${week.week} Preview` : undefined}
      className={preview ? '[container-type:inline-size]' : undefined}
    >
      <WeekHeading className="text-title3">Week {week.week}</WeekHeading>
      {week.total && (
        <p
          className={'mt-1 text-subhead tabular-nums text-muted' + (preview ? ' break-words' : '')}
        >
          {week.total}
        </p>
      )}
      <div
        className={
          preview
            ? 'mt-4 grid gap-4 [@container(min-width:560px)]:grid-cols-2 [@container(min-width:900px)]:hidden'
            : 'mt-4 space-y-4 lg:hidden'
        }
      >
        {week.days.map((day) => (
          <div key={day.name}>
            <DayHeading className="mb-2 text-headline">{day.name}</DayHeading>
            {day.off ? (
              <p className="text-subhead text-muted">Off</p>
            ) : (
              <div className="space-y-2">
                {day.slots.map((item) => (
                  <div
                    key={item.slot}
                    className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-2"
                  >
                    <span className="pt-3 text-caption tabular-nums text-muted">{item.slot}</span>
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
          (preview ? '[@container(min-width:900px)]:grid' : 'lg:grid')
        }
      >
        <div aria-hidden="true" />
        {week.days.map((day) => (
          <DayHeading key={day.name} className="text-footnote font-semibold">
            {day.name.slice(0, 3)}
          </DayHeading>
        ))}
        {SLOTS.map((slot, index) => (
          <Fragment key={slot}>
            <p className="pt-3 text-caption tabular-nums text-muted">{slot}</p>
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
