import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import type { ErgTest, ErgTestKind, PublicUser } from '../../../shared/types';
import { useErgTests, useCreateErgTest, useUpdateErgTest, useDeleteErgTest } from '../lib/queries';
import { testKinds, testTime, testValues } from '../lib/ergTests';
import { formatEntryDate, parseTimeInput } from '../lib/format';
import { authError } from '../lib/auth';
import {
  DialogPresence,
  Button,
  ConfirmSheet,
  EmptyState,
  SegmentedControl,
  Sheet,
  TextField,
  useToast,
} from './ui';
import { LoadState } from './shell/LoadState';

export function PrTimeline({ tests, kind }: { tests: ErgTest[]; kind: ErgTestKind }) {
  if (!tests.length) return null;
  const rows = [...tests].reverse();
  const values = rows.map((row) => row.split_s);
  const min = Math.min(...values) - 1,
    max = Math.max(...values) + 1;
  const start = Date.parse(rows[0].date),
    end = Date.parse(rows.at(-1)!.date);
  const points = rows.map((row) => ({
    row,
    x: end === start ? 170 : 54 + ((Date.parse(row.date) - start) / (end - start)) * 262,
    y: 24 + ((row.split_s - min) / (max - min)) * 88,
  }));
  return (
    <figure
      aria-label={`${kind} PR Timeline`}
      className="rounded-xl border border-divider bg-surface px-3 py-4"
    >
      <figcaption className="mb-2 flex justify-between text-caption text-muted">
        <span>Split /500m</span>
        <span>Faster At Top</span>
      </figcaption>
      <svg
        viewBox="0 0 332 144"
        role="img"
        aria-label={`${kind} split history, faster at top`}
        className="block w-full text-muted"
      >
        {[min, (min + max) / 2, max].map((value, i) => (
          <g key={i}>
            <line x1="50" x2="320" y1={24 + i * 44} y2={24 + i * 44} stroke="var(--divider)" />
            <text x="0" y={28 + i * 44} fill="currentColor" fontSize="12">
              {testTime(value)}
            </text>
          </g>
        ))}
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {points.map(({ row, x, y }) => (
          <g key={row.id}>
            <circle
              data-pr={row.is_pr}
              cx={x}
              cy={y}
              r={row.is_pr ? 5 : 3.5}
              fill={row.is_pr ? 'var(--highlight)' : 'var(--surface)'}
              stroke={row.is_pr ? 'var(--highlight)' : 'var(--accent)'}
              strokeWidth="2"
            >
              <title>{`${row.date}: ${testTime(row.split_s)} /500m${row.is_pr ? ' · PR' : ''}`}</title>
            </circle>
          </g>
        ))}
        <text x="54" y="140" fill="currentColor" fontSize="12">
          {rows[0].date.slice(5).replace('-', '/')}
        </text>
        {rows.length > 1 && (
          <text x="316" y="140" textAnchor="end" fill="currentColor" fontSize="12">
            {rows.at(-1)!.date.slice(5).replace('-', '/')}
          </text>
        )}
      </svg>
    </figure>
  );
}
export function ErgTests({
  user,
  today,
  own = false,
}: {
  user: PublicUser;
  today: string;
  own?: boolean;
}) {
  const history = useErgTests(user.id);
  const section = useRef<HTMLElement>(null);
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === '#erg-tests') section.current?.scrollIntoView({ block: 'start' });
  }, [hash]);
  const [kind, setKind] = useState<ErgTestKind>('2k');
  const [editing, setEditing] = useState<ErgTest | 'new'>();
  const rows = history.data?.filter((row) => row.kind === kind) ?? [];
  return (
    <section ref={section} id="erg-tests" aria-label="Erg Tests" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-title2">Erg Tests</h2>
        {own && (
          <Button variant="secondary" onClick={() => setEditing('new')}>
            Add Test
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-2 divide-x divide-divider rounded-xl border border-divider bg-surface py-4">
        {testKinds.map(({ value }) => {
          const split = user[value === '2k' ? 'best2k_split_s' : 'best6k_split_s'];
          const best = history.data
            ?.filter((row) => row.kind === value && row.split_s === split)
            .sort((a, b) => a.time_s - b.time_s)[0];
          return (
            <div key={value} className="px-4">
              <dt className="text-footnote text-muted">Best {value}</dt>
              <dd className="mt-1 text-title2 tabular-nums">
                {split === null ? '—' : testTime(split)}
                <span className="ml-1 text-caption font-normal text-muted">/500m</span>
                <span className="mt-1 block text-subhead font-normal text-muted">
                  {split === null
                    ? '—'
                    : testTime(best?.time_s ?? split * (value === '2k' ? 4 : 12))}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
      <h3 className="text-subhead font-semibold">Test History</h3>
      <SegmentedControl
        label="Test History Kind"
        value={kind}
        onChange={setKind}
        options={testKinds}
      />
      {!history.data ? (
        <LoadState error={history.isError} retry={() => void history.refetch()} />
      ) : rows.length ? (
        <>
          <PrTimeline tests={rows} kind={kind} />
          <ul className="overflow-hidden rounded-xl border border-divider bg-surface divide-y divide-divider">
            {rows.map((row) => {
              const content = (
                <>
                  <span className="text-footnote text-muted">
                    {formatEntryDate(row.date, today)}
                  </span>
                  <span className="flex items-center gap-2">
                    {row.is_pr && (
                      <span className="rounded bg-highlight/10 px-2 py-1 text-caption font-semibold text-highlight-ink">
                        PR
                      </span>
                    )}
                    <span className="text-right tabular-nums">
                      <span className="block font-medium">{testTime(row.time_s)}</span>
                      <span className="block text-caption text-muted">
                        {testTime(row.split_s)} /500m
                      </span>
                    </span>
                  </span>
                </>
              );
              return (
                <li key={row.id}>
                  {own ? (
                    <button
                      type="button"
                      onClick={() => setEditing(row)}
                      aria-label={`Edit ${row.kind} Test ${row.date}`}
                      className="flex min-h-20 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg focus-visible:outline-accent"
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="flex min-h-20 items-center justify-between gap-3 px-4 py-3">
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <EmptyState icon={null} title="No Tests Yet" />
      )}
      <DialogPresence>
        {editing && (
          <TestSheet
            key={editing === 'new' ? 'new' : editing.id}
            test={editing === 'new' ? undefined : editing}
            initialKind={kind}
            today={today}
            onClose={() => setEditing(undefined)}
          />
        )}
      </DialogPresence>
    </section>
  );
}
function TestSheet({
  test,
  initialKind,
  today,
  onClose,
}: {
  test?: ErgTest;
  initialKind: ErgTestKind;
  today: string;
  onClose: () => void;
}) {
  const [kind, setKind] = useState(test?.kind ?? initialKind);
  const [date, setDate] = useState(test?.date ?? today);
  const [mode, setMode] = useState<'time' | 'split'>('time');
  const [value, setValue] = useState(test ? testTime(test.time_s) : '');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();
  const create = useCreateErgTest(),
    update = useUpdateErgTest(),
    remove = useDeleteErgTest();
  const toast = useToast();
  const busy = create.isPending || update.isPending || remove.isPending;
  const derived = testValues(value, mode, kind);
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    date >= '2000-01-01' &&
    date <= today &&
    Number.isFinite(Date.parse(date + 'T12:00:00Z')) &&
    new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) === date;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!derived || !validDate || busy) return;
    setError(undefined);
    try {
      const body = {
        kind,
        date,
        ...(mode === 'time' ? { time_s: derived.time_s } : { split_s: derived.split_s }),
      };
      if (test) await update.mutateAsync({ params: { id: test.id }, body });
      else await create.mutateAsync({ body });
      toast.show({ title: test ? 'Test Updated' : 'Test Added' });
      onClose();
    } catch (error) {
      setError(authError(error));
      toast.show({ title: 'Could Not Save Test', tone: 'error' });
    }
  }
  async function destroy() {
    if (!test || busy) return;
    try {
      await remove.mutateAsync({ params: { id: test.id } });
      toast.show({ title: 'Test Deleted' });
      onClose();
    } catch (error) {
      setConfirm(false);
      setError(authError(error));
      toast.show({ title: 'Could Not Delete Test', tone: 'error' });
    }
  }
  return (
    <>
      <Sheet
        open={!confirm}
        title={test ? 'Edit Test' : 'Add Test'}
        onClose={() => {
          if (!busy) onClose();
        }}
        footer={
          <div className="flex gap-3">
            {test && (
              <Button variant="destructive" disabled={busy} onClick={() => setConfirm(true)}>
                Delete
              </Button>
            )}
            <Button
              fullWidth
              loading={busy}
              disabled={!derived || !validDate}
              type="submit"
              form="erg-test-form"
            >
              Save Test
            </Button>
          </div>
        }
      >
        <form
          id="erg-test-form"
          onSubmit={(event) => void save(event)}
          className="space-y-5"
          noValidate
        >
          <fieldset disabled={busy} className="space-y-5">
            <SegmentedControl
              label="Test Kind"
              value={kind}
              onChange={setKind}
              options={testKinds}
            />
            <TextField
              label="Date"
              type="date"
              value={date}
              min="2000-01-01"
              max={today}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <SegmentedControl
              label="Enter Result As"
              value={mode}
              onChange={(next) => {
                if (derived) setValue(testTime(next === 'time' ? derived.time_s : derived.split_s));
                setMode(next);
              }}
              options={[
                { value: 'time', label: 'Time' },
                { value: 'split', label: 'Split' },
              ]}
            />
            <TextField
              label={mode === 'time' ? 'Time' : 'Split'}
              value={value}
              placeholder="m:ss.t"
              inputMode="decimal"
              suffix={mode === 'split' ? '/500m' : undefined}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() =>
                setValue(
                  parseTimeInput(value, mode === 'time' ? 'elapsed' : 'split')?.text ?? value,
                )
              }
              hint={
                mode === 'time'
                  ? 'Seconds or dots: 6.42.3 = 6:42.3'
                  : '145 or 145.0 = 1:45 or 1:45.0'
              }
              error={value && !derived ? 'Use m:ss.t · Split 1:00–5:00' : undefined}
              required
            />
            <div
              aria-live="polite"
              className="flex items-center justify-between rounded-lg bg-bg px-4 py-4"
            >
              <span className="text-footnote text-muted">
                {mode === 'time' ? 'Split /500m' : 'Time'}
              </span>
              <output className="text-title2 tabular-nums">
                {derived ? testTime(mode === 'time' ? derived.split_s : derived.time_s) : '—'}
              </output>
            </div>
            {error && (
              <p role="alert" className="text-footnote text-accent-ink">
                {error}
              </p>
            )}
          </fieldset>
        </form>
      </Sheet>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => void destroy()}
        title="Delete Test?"
        body=""
        confirmLabel="Delete Test"
        cancelLabel="Cancel"
        loading={remove.isPending}
      />
    </>
  );
}
