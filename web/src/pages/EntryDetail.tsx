import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Activity, MoreHorizontal, Share2 } from 'lucide-react';
import {
  useComments,
  useConfig,
  useCreateComment,
  useDeleteComment,
  useDeleteEntry,
  useEntry,
  useMe,
} from '../lib/queries';
import { ApiClientError } from '../lib/api';
import { relativeTime } from '../lib/social';
import {
  Avatar,
  Button,
  ConfirmSheet,
  EmptyState,
  IconButton,
  ListGroup,
  ListRow,
  PageHeader,
  Sheet,
  TextArea,
  useToast,
} from '../components/ui';
import { LoadState } from '../components/shell/LoadState';
import { EntryCard } from '../components/social/EntryCard';

export default function EntryDetail() {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const query = useEntry(id);
  const comments = useComments(id);
  const { data: me } = useMe();
  const { data: config } = useConfig();
  const create = useCreateComment();
  const remove = useDeleteEntry();
  const removeComment = useDeleteComment();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const focusComment = () => {
    document.getElementById('comments')?.scrollIntoView();
    document.getElementById('comment-body')?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (query.data && location.hash === '#comments') {
      const timer = setTimeout(() => {
        focusComment();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [query.data?.id, location.hash]);
  const entry = query.data;
  const post = () => {
    if (!body.trim() || create.isPending) return;
    setError('');
    create.mutate(
      { params: { id }, body: { body: body.trim() } },
      {
        onSuccess: () => {
          setBody('');
          toast.show({ title: 'Comment posted' });
        },
        onError: () => setError('Comment not saved. Try again'),
      },
    );
  };
  const canEdit = me && entry && (me.id === entry.user_id || me.role !== 'rower');
  return (
    <>
      <PageHeader
        title="Workout"
        back
        trailing={
          entry && (
            <div className="flex items-center">
              <IconButton
                aria-label="Share"
                onClick={() => {
                  const url = `${window.location.origin}/entries/${id}`;
                  if (navigator.share)
                    void navigator.share({ title: entry.title, url }).catch(() => {});
                  else
                    void navigator.clipboard
                      .writeText(url)
                      .then(() => toast.show({ title: 'Link copied' }))
                      .catch(() => toast.show({ title: 'Could not copy link', tone: 'error' }));
                }}
              >
                <Share2 size={20} strokeWidth={1.75} aria-hidden="true" />
              </IconButton>
              {canEdit && (
                <IconButton aria-label="More" onClick={() => setMore(true)}>
                  <MoreHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />
                </IconButton>
              )}
            </div>
          )
        }
      />
      <div className="screen-stack">
        {!entry ? (
          query.error instanceof ApiClientError && query.error.status === 404 ? (
            <EmptyState
              icon={<Activity size={20} strokeWidth={1.75} />}
              title="Workout Not Found"
              body="This workout is unavailable"
              action={<Button to="/feed">Back To Feed</Button>}
            />
          ) : (
            <LoadState error={query.isError} retry={() => void query.refetch()} />
          )
        ) : (
          <>
            <EntryCard entry={entry} config={config} full onComment={focusComment} />
            {canEdit && more && (
              <Sheet open onClose={() => setMore(false)} title="Workout Actions">
                <ListGroup>
                  <ListRow title="Edit Workout" to={`/log?edit=${encodeURIComponent(id)}`} />
                  <ListRow
                    title="Delete Workout"
                    tone="destructive"
                    onClick={() => {
                      setMore(false);
                      setDeleting('entry');
                    }}
                  />
                </ListGroup>
              </Sheet>
            )}
            <section id="comments" className="scroll-mt-20">
              <h2 className="mb-4 text-title3">Comments</h2>
              {comments.isError ? (
                <LoadState error retry={() => void comments.refetch()} />
              ) : comments.isPending ? (
                <p role="status" className="text-muted">
                  Loading discussion
                </p>
              ) : comments.data.length === 0 ? (
                <p className="mb-6 text-subhead text-muted">No Comments Yet</p>
              ) : (
                <ul className="mb-6 divide-y divide-divider">
                  {comments.data.map((comment) => (
                    <li key={comment.id} className="flex gap-3 py-4">
                      <Avatar name={comment.author.name} imageId={comment.author.avatar_image_id} />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/users/${comment.user_id}`}
                          className="inline-flex min-h-11 items-center text-headline"
                        >
                          {comment.author.name}
                        </Link>
                        <p className="text-caption text-muted">
                          {relativeTime(comment.created_at)}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-callout">
                          {comment.body}
                        </p>
                        {me && (me.id === comment.user_id || me.role !== 'rower') && (
                          <Button variant="plain" onClick={() => setDeleting(comment.id)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  post();
                }}
              >
                <TextArea
                  id="comment-body"
                  label="Comment"
                  value={body}
                  maxLength={1000}
                  error={error}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      post();
                    }
                  }}
                />
                {body.length >= 900 && (
                  <p className="text-right text-caption text-muted">{body.length} / 1000</p>
                )}
                <Button
                  className="mt-3"
                  type="submit"
                  disabled={!body.trim()}
                  loading={create.isPending}
                >
                  Post Comment
                </Button>
              </form>
            </section>
            {deleting !== null && (
              <ConfirmSheet
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                title={deleting === 'entry' ? 'Delete Workout' : 'Delete Comment'}
                body="This cannot be undone"
                confirmLabel="Delete"
                cancelLabel="Cancel"
                loading={remove.isPending || removeComment.isPending}
                onConfirm={() => {
                  const onError = () =>
                    toast.show({ title: 'Could not delete. Try again', tone: 'error' });
                  if (deleting === 'entry')
                    remove.mutate(
                      { params: { id } },
                      {
                        onSuccess: () => {
                          toast.show({ title: 'Workout deleted' });
                          navigate('/feed', { replace: true });
                        },
                        onError,
                      },
                    );
                  else if (deleting)
                    removeComment.mutate(
                      { params: { id: deleting } },
                      {
                        onSuccess: () => {
                          setDeleting(null);
                          toast.show({ title: 'Comment deleted' });
                        },
                        onError,
                      },
                    );
                }}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
