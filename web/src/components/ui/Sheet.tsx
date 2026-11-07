import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
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
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const release = useRef<(() => void) | undefined>();
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const close = () => {
      dialog.close();
      release.current?.();
      release.current = undefined;
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    };
    if (open) {
      if (!dialog.open) {
        opener.current = document.activeElement as HTMLElement;
        const overflow = document.body.style.overflow;
        const padding = document.body.style.paddingRight;
        const scrollbar = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = 'hidden';
        if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
        release.current = () => {
          document.body.style.overflow = overflow;
          document.body.style.paddingRight = padding;
        };
        dialog.showModal();
        if (pointerInput) heading.current?.focus({ preventScroll: true });
        else
          dialog
            .querySelector<HTMLButtonElement>('[aria-label="Close"]')
            ?.focus({ preventScroll: true });
      }
      return;
    }
    if (!dialog.open) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reduced?.matches || typeof dialog.animate !== 'function') {
      close();
      return;
    }
    const desktop = window.matchMedia('(min-width: 1024px)').matches;
    const duration =
      parseFloat(getComputedStyle(dialog).getPropertyValue('--oyo-motion-exit')) || 200;
    const animation = dialog.animate(
      [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: desktop ? 'scale(0.99)' : 'translateY(32px)' },
      ],
      {
        duration,
        easing: getComputedStyle(dialog).getPropertyValue('--oyo-ease-in').trim(),
        fill: 'forwards',
      },
    );
    let cancelled = false;
    const finish = () => {
      if (reduced?.matches) animation.finish();
    };
    reduced?.addEventListener('change', finish);
    void animation.finished
      .then(() => {
        if (!cancelled) close();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      animation.cancel();
      reduced?.removeEventListener('change', finish);
    };
  }, [open]);
  useEffect(() => {
    const dialog = ref.current;
    return () => {
      if (dialog?.open) dialog.close();
      release.current?.();
      release.current = undefined;
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="ui-sheet"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
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
          onClose();
      }}
    >
      <header className="ui-sheet-header">
        <div className="flex items-center justify-between gap-4">
          <h2 ref={heading} id={titleId} tabIndex={-1} className="text-title3 focus:outline-none">
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
