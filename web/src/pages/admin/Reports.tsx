import { useState } from 'react';
import { Flag } from 'lucide-react';
import type { ContentReport } from '../../../../shared/types';
import { useReports, useReviewReport } from '../../lib/queries';
import { relativeTime } from '../../lib/social';
import {
  Avatar,
  Button,
  ConfirmSheet,
  EmptyState,
  ListGroup,
  PageHeader,
  SegmentedControl,
  useToast,
} from '../../components/ui';
import { LoadState } from '../../components/shell/LoadState';

export default function Reports() {
  const [status, setStatus] = useState<'open' | 'dismissed' | 'deleted'>('open');
  const [deleting, setDeleting] = useState<ContentReport | null>(null);
  const [error, setError] = useState('');
  const query = useReports(status);
  const review = useReviewReport();
  const toast = useToast();
  const rows = query.data?.pages.flatMap((page) => page.items);
  function resolve(report: ContentReport, action: 'dismiss' | 'delete') {
    if (review.isPending) return;
    setError('');
    review.mutate(
      { params: { id: report.id }, body: { action } },
      {
        onSuccess: () => {
          setDeleting(null);
          toast.show({ title: action === 'dismiss' ? 'Report dismissed' : 'Content deleted' });
        },
        onError: () => setError('Report not updated. Try again'),
      },
    );
  }
  return (
    <>
      <PageHeader title="Reports" back="/admin" />
      <div className="screen-stack">
        <SegmentedControl
          label="Report Status"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setError('');
          }}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'dismissed', label: 'Dismissed' },
            { value: 'deleted', label: 'Deleted' },
          ]}
        />
        {error && !deleting && (
          <p role="alert" className="text-callout text-danger">
            {error}
          </p>
        )}
        {!rows ? (
          <LoadState error={query.isError} retry={() => void query.refetch()} />
        ) : !rows.length ? (
          <EmptyState
            icon={<Flag size={20} strokeWidth={1.75} />}
            title={status === 'open' ? 'No Open Reports' : 'No Reports'}
          />
        ) : (
          <>
            <ListGroup>
              {rows.map((report) => (
                <article
                  key={report.id}
                  aria-label={`Report by ${report.reporter.name}`}
                  className="space-y-4 border-b border-divider p-4 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={report.reporter.name} imageId={report.reporter.avatar_image_id} />
                    <div className="min-w-0">
                      <p className="break-words text-headline">{report.reporter.name}</p>
                      <p className="text-caption text-muted">
                        Reported {report.target_type === 'entry' ? 'a workout' : 'a comment'} ·{' '}
                        {relativeTime(report.created_at)}
                      </p>
                    </div>
                  </div>
                  {report.reason && (
                    <p className="whitespace-pre-wrap break-words text-callout">{report.reason}</p>
                  )}
                  {report.content ? (
                    <div className="space-y-1 rounded-lg bg-surface-2 p-3">
                      <p className="break-words text-subhead font-semibold">
                        {report.content.author.name}
                      </p>
                      {report.content.title && (
                        <p className="break-words text-headline">{report.content.title}</p>
                      )}
                      <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-callout">
                        {report.content.body}
                      </p>
                    </div>
                  ) : (
                    <p className="text-subhead text-muted">Content Deleted</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {report.content && (
                      <Button
                        variant="secondary"
                        to={`/entries/${report.entry_id}${report.target_type === 'comment' ? '#comments' : ''}`}
                      >
                        View {report.target_type === 'entry' ? 'Workout' : 'Comment'}
                      </Button>
                    )}
                    {report.status === 'open' && (
                      <>
                        <Button
                          variant="secondary"
                          disabled={review.isPending}
                          onClick={() => resolve(report, 'dismiss')}
                        >
                          Dismiss
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={review.isPending}
                          onClick={() => {
                            setError('');
                            setDeleting(report);
                          }}
                        >
                          Delete Content
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </ListGroup>
            {query.isFetchNextPageError && (
              <p role="alert" className="text-callout text-danger">
                Could not load reports. Try again
              </p>
            )}
            {query.hasNextPage && (
              <Button
                variant="secondary"
                fullWidth
                loading={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                Load More
              </Button>
            )}
          </>
        )}
      </div>
      <ConfirmSheet
        open={!!deleting}
        onClose={() => {
          setDeleting(null);
          setError('');
        }}
        onConfirm={() => {
          if (deleting) resolve(deleting, 'delete');
        }}
        title="Delete Reported Content"
        body={error || 'Delete this content for everyone?'}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={review.isPending}
      />
    </>
  );
}
