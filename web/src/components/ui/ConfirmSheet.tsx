import { Button } from './Button';
import { Sheet } from './Sheet';
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  loading = false,
  cancelLabel = 'Keep Editing',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  loading?: boolean;
  cancelLabel?: string;
}) {
  return (
    <Sheet
      open={open}
      onClose={() => {
        if (!loading) onClose();
      }}
      title={title}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth disabled={loading} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" fullWidth loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-callout text-muted">{body}</p>
    </Sheet>
  );
}
