import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const start = useRef<number | null>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
      if (open) previous?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="ui-sheet"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header
        className="ui-sheet-header"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          start.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          start.current = null;
        }}
        onPointerUp={(e) => {
          if (start.current !== null && e.clientY - start.current > 72) onClose();
          start.current = null;
        }}
      >
        <div className="ui-grabber" />
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-title3">
            {title}
          </h2>
          <IconButton aria-label="Close" onClick={onClose}>
            <X size={20} strokeWidth={1.75} />
          </IconButton>
        </div>
      </header>
      <div className="ui-sheet-body">{children}</div>
      {footer && <footer className="ui-sheet-footer">{footer}</footer>}
    </dialog>
  );
}
