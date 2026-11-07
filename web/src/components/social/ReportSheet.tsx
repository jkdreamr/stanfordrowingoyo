import { useState } from 'react';
import type { ReportTarget } from '../../../../shared/types';
import { useCreateReport } from '../../lib/queries';
import { ApiClientError } from '../../lib/api';
import { Button, Sheet, TextArea, useToast } from '../ui';

export function ReportSheet({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const create = useCreateReport();
  const toast = useToast();
  function submit() {
    if (create.isPending) return;
    setError('');
    create.mutate(
      { body: { ...target, reason: reason.trim() } },
      {
        onSuccess: () => {
          onClose();
          toast.show({ title: 'Report sent' });
        },
        onError: (error) =>
          setError(
            error instanceof ApiClientError && error.status === 404
              ? 'Content no longer available'
              : 'Report not sent. Try again',
          ),
      },
    );
  }
  return (
    <Sheet
      open
      onClose={() => {
        if (!create.isPending) onClose();
      }}
      title={target.target_type === 'entry' ? 'Report Workout' : 'Report Comment'}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth disabled={create.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button fullWidth loading={create.isPending} onClick={submit}>
            Send Report
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextArea
          label="Reason (Optional)"
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
          error={error}
        />
      </form>
    </Sheet>
  );
}
