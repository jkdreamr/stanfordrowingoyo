import { useState } from 'react';
import { Megaphone, Plus } from 'lucide-react';
import type { Announcement } from '../../../../shared/types';
import {
  Button,
  ConfirmSheet,
  EmptyState,
  IconButton,
  ListGroup,
  PageHeader,
  Sheet,
  TextArea,
  TextField,
  Toggle,
  useToast,
} from '../../components/ui';
import { LoadState } from '../../components/shell/LoadState';
import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
} from '../../lib/queries';
import { formatShortDate } from '../../lib/format';
import { announcementErrors, orderedAnnouncements } from './content';
export default function Announcements() {
  const query = useAnnouncements();
  const update = useUpdateAnnouncement();
  const remove = useDeleteAnnouncement();
  const [editing, setEditing] = useState<Announcement | 'new'>();
  const [deleting, setDeleting] = useState<Announcement>();
  const { show } = useToast();
  return (
    <>
      <PageHeader
        title="Announcements"
        back="/admin"
        trailing={
          <IconButton aria-label="New Announcement" onClick={() => setEditing('new')}>
            <Plus size={22} />
          </IconButton>
        }
      />
      <div className="screen-stack">
        {!query.data ? (
          <LoadState error={query.isError} retry={() => void query.refetch()} />
        ) : query.data.length ? (
          <ListGroup>
            {orderedAnnouncements(query.data).map((row) => (
              <article
                key={row.id}
                aria-label={row.title}
                className="space-y-3 border-b border-divider p-4 last:border-0"
              >
                <button
                  type="button"
                  onClick={() => setEditing(row)}
                  aria-label={`Edit ${row.title}`}
                  className="block min-h-11 w-full space-y-2 text-left"
                >
                  <span className="block text-headline">{row.title}</span>
                  <span className="block whitespace-pre-wrap text-callout text-muted">
                    {row.body}
                  </span>
                </button>
                <p className="text-footnote text-muted">
                  {row.author.name} · {formatShortDate(row.created_at.slice(0, 10))}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <Toggle
                    label="Pinned"
                    checked={row.pinned}
                    disabled={update.isPending || remove.isPending}
                    onChange={(pinned) =>
                      update.mutate(
                        { params: { id: row.id }, body: { pinned } },
                        {
                          onSuccess: () =>
                            show({
                              title: pinned ? 'Announcement pinned' : 'Announcement unpinned',
                            }),
                          onError: (error) => show({ title: error.message, tone: 'error' }),
                        },
                      )
                    }
                  />
                  <Button
                    variant="plain"
                    onClick={() => setDeleting(row)}
                    disabled={remove.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </article>
            ))}
          </ListGroup>
        ) : (
          <EmptyState
            icon={<Megaphone size={20} />}
            title="No Announcements Yet"
            action={<Button onClick={() => setEditing('new')}>New Announcement</Button>}
          />
        )}
      </div>
      {editing && (
        <AnnouncementEditor
          row={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
      <ConfirmSheet
        open={!!deleting}
        title="Delete Announcement?"
        body={`Delete “${deleting?.title ?? ''}”? This cannot be undone.`}
        confirmLabel="Delete Announcement"
        loading={remove.isPending}
        onClose={() => setDeleting(undefined)}
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { params: { id: deleting.id } },
            {
              onSuccess: () => {
                setDeleting(undefined);
                show({ title: 'Announcement deleted' });
              },
              onError: (error) => show({ title: error.message, tone: 'error' }),
            },
          )
        }
      />
    </>
  );
}
function AnnouncementEditor({ row, onClose }: { row?: Announcement; onClose: () => void }) {
  const [title, setTitle] = useState(row?.title ?? '');
  const [body, setBody] = useState(row?.body ?? '');
  const [pinned, setPinned] = useState(row?.pinned ?? false);
  const create = useCreateAnnouncement();
  const update = useUpdateAnnouncement();
  const { show } = useToast();
  const pending = create.isPending || update.isPending;
  const errors = announcementErrors(title, body);
  async function save() {
    try {
      const input = { title: title.trim(), body, pinned };
      if (row) await update.mutateAsync({ params: { id: row.id }, body: input });
      else await create.mutateAsync({ body: input });
      show({ title: row ? 'Announcement saved' : 'Announcement posted' });
      onClose();
    } catch (error) {
      show({
        title: error instanceof Error ? error.message : 'Could not save announcement',
        tone: 'error',
      });
    }
  }
  return (
    <Sheet
      open
      title={row ? 'Edit Announcement' : 'New Announcement'}
      onClose={pending ? () => {} : onClose}
      footer={
        <Button
          fullWidth
          loading={pending}
          disabled={pending || !!errors.title || !!errors.body}
          onClick={() => void save()}
        >
          Save Announcement
        </Button>
      }
    >
      <fieldset disabled={pending} className="space-y-5">
        <TextField
          label="Title"
          value={title}
          maxLength={120}
          error={errors.title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextArea
          label="Message"
          value={body}
          maxLength={5000}
          rows={7}
          error={errors.body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Toggle label="Pinned" checked={pinned} onChange={setPinned} />
      </fieldset>
    </Sheet>
  );
}
