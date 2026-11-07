import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button, Card, PageHeader, TextField, useToast } from '../../components/ui';
import { LoadState } from '../../components/shell/LoadState';
import { useConfig, useExport } from '../../lib/queries';
import { exportError, exportRange } from './operations';

export default function Export() {
  const config = useConfig();
  const [dates, setDates] = useState<{ start: string; end: string }>();
  const start = dates?.start ?? config.data?.current_week_start ?? '';
  const end = dates?.end ?? config.data?.today ?? '';
  const query = useExport({ start, end });
  const { show } = useToast();
  const error = exportError(start, end);
  async function download() {
    const result = await query.refetch();
    if (result.isError || result.data === undefined) {
      show({ title: result.error?.message ?? 'Could not download the export', tone: 'error' });
      return;
    }
    const url = URL.createObjectURL(new Blob([result.data], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `oyo-entries-${start}-to-${end}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    show({ title: 'CSV download started' });
  }
  return (
    <>
      <PageHeader title="Export" back="/admin" />
      <div className="screen-stack">
        {config.data ? (
          <Card className="space-y-5 p-4">
            <div>
              <h2 className="text-headline">Training Entries</h2>
              <p className="mt-2 text-callout text-muted">Includes account emails.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['week', 'This Week'],
                  ['month', 'Last 30 Days'],
                  ['season', 'This Season'],
                ] as const
              ).map(([kind, label]) => (
                <Button
                  key={kind}
                  variant="secondary"
                  disabled={query.isFetching}
                  onClick={() =>
                    setDates(
                      exportRange(
                        kind,
                        config.data.today,
                        config.data.current_week_start,
                        config.data.season_start,
                      ),
                    )
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
            <TextField
              label="Start Date"
              type="date"
              disabled={query.isFetching}
              value={start}
              onChange={(e) => setDates({ start: e.target.value, end })}
            />
            <TextField
              label="End Date"
              type="date"
              disabled={query.isFetching}
              value={end}
              onChange={(e) => setDates({ start, end: e.target.value })}
              error={error}
            />
            <Button
              fullWidth
              leading={<Download size={20} />}
              disabled={!!error}
              loading={query.isFetching}
              onClick={() => void download()}
            >
              Download CSV
            </Button>
          </Card>
        ) : (
          <LoadState error={config.isError} retry={() => void config.refetch()} />
        )}
      </div>
    </>
  );
}
