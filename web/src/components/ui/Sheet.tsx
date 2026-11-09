import { useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { useDialog } from './useDialog';
let pointerInput = false;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    () => {
      pointerInput = true;
    },
    true,
  );
  document.addEventListener(
    'keydown',
    () => {
      pointerInput = false;
    },
    true,
  );
}
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
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const { ref, visible, active, retaining, requestClose, blockClosing } = useDialog(
    open,
    onClose,
    'sheet',
    () => {
      if (pointerInput) heading.current?.focus({ preventScroll: true });
      else
        ref.current
          ?.querySelector<HTMLButtonElement>('[aria-label="Close"]')
          ?.focus({ preventScroll: true });
    },
  );
  const content = useRef({ title, children, footer });
  if (visible) content.current = { title, children, footer };
  return (
    <dialog
      ref={ref}
      className="ui-sheet"
      aria-labelledby={titleId}
      aria-modal="true"
      data-closing={!visible || undefined}
      onClickCapture={blockClosing}
      onKeyDownCapture={blockClosing}
      onClose={(event) => {
        if (!event.currentTarget.open) requestClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          requestClose();
      }}
    >
      <header className="ui-sheet-header">
        <div className="flex items-center justify-between gap-4">
          <h2 ref={heading} id={titleId} tabIndex={-1} className="text-title3 focus:outline-none">
            {content.current.title}
          </h2>
          <IconButton aria-label="Close" onClick={requestClose}>
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </IconButton>
        </div>
      </header>
      <div className="ui-sheet-body">
        {(visible || active || retaining) && content.current.children}
      </div>
      {(visible || active || retaining) && content.current.footer && (
        <footer className="ui-sheet-footer">{content.current.footer}</footer>
      )}
    </dialog>
  );
}
