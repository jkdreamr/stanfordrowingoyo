import { useState } from 'react';
import type { CommentWithAuthor } from '../../../../shared/types';
import { useUpdateComment } from '../../lib/queries';
import { mentionIds } from '../../lib/social';
import { Button, useToast } from '../ui';
import { MentionComposer } from './MentionComposer';

export function CommentEditor({
  comment,
  onClose,
}: {
  comment: CommentWithAuthor;
  onClose: () => void;
}) {
  const [body, setBody] = useState(comment.body);
  const [selected, setSelected] = useState(comment.mentions ?? []);
  const [error, setError] = useState('');
  const update = useUpdateComment();
  const toast = useToast();
  function save() {
    if (!body.trim() || update.isPending) return;
    setError('');
    update.mutate(
      {
        params: { id: comment.id },
        body: { body: body.trim(), mention_ids: mentionIds(body, selected) },
      },
      {
        onSuccess: () => {
          onClose();
          toast.show({ title: 'Comment saved' });
        },
        onError: () => setError('Comment not saved. Try again'),
      },
    );
  }
  return (
    <form
      className="mt-3 space-y-3"
      aria-label="Edit Comment"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <MentionComposer
        id={`edit-${comment.id}`}
        autoFocus
        body={body}
        onChange={setBody}
        selected={selected}
        onSelect={setSelected}
        self={comment.user_id}
        error={error}
        onPost={save}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!body.trim()} loading={update.isPending}>
          Save
        </Button>
        <Button variant="secondary" disabled={update.isPending} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
