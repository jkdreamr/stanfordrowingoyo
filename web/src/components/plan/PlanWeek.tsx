import { Fragment } from 'react';
import type { GroupKey, Plan, PlanSlot } from '../../../../shared/types';
import { ZoneChip } from '../ui';
import { planWeek, slotDisplayText, SLOTS } from './schedule';
function Session({ item }: { item: PlanSlot }) {
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
      <p className="break-words whitespace-pre-wrap text-footnote">{slotDisplayText(item)}</p>
    </div>
  );
}
export function PlanWeek({ plan, group, week }: { plan: Plan; group: GroupKey; week: 1 | 2 }) {
  const data = planWeek(plan, group, week);
  return (
    <section aria-label={`Week ${week} Preview`} className="[container-type:inline-size]">
      <h2 className="text-title3">Week {week}</h2>
      {data.total && (
        <p className="mt-1 break-words text-subhead tabular-nums text-muted">{data.total}</p>
      )}
      <div className="mt-4 grid gap-4 [@container(min-width:560px)]:grid-cols-2 [@container(min-width:900px)]:hidden">
        {data.days.map((day) => (
          <div key={day.name}>
            <h3 className="mb-2 text-headline">{day.name}</h3>
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
                    <Session item={item} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 hidden grid-cols-[48px_repeat(7,minmax(0,1fr))] gap-2 [@container(min-width:900px)]:grid">
        <div aria-hidden="true" />
        {data.days.map((day) => (
          <h3 key={day.name} className="text-footnote font-semibold">
            {day.name.slice(0, 3)}
          </h3>
        ))}
        {SLOTS.map((slot, index) => (
          <Fragment key={slot}>
            <p className="pt-3 text-caption tabular-nums text-muted">{slot}</p>
            {data.days.map((day) => {
              const item = day.slots.find((row) => row.slot === slot);
              return (
                <div key={day.name + slot} className="min-w-0">
                  {item ? (
                    <Session item={item} />
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
