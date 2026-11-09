import { useContext, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { DialogPresenceContext } from './DialogPresence';
import { parseCssTime } from '../../lib/cssTime';

const dialogs = new Set<HTMLDialogElement>();
const openers = new WeakMap<HTMLDialogElement, HTMLElement>();
let bodyStyle: { overflow: string; paddingRight: string } | undefined;
let pointerOpener: HTMLElement | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    (event) => {
      pointerOpener =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('button, a, input, select, textarea, [role="button"]')
          : null;
    },
    true,
  );
  document.addEventListener(
    'keydown',
    () => {
      pointerOpener = null;
    },
    true,
  );
}

export function useDialog(
  open: boolean,
  onClose: () => void,
  kind: 'sheet' | 'viewer',
  onOpen: () => void,
) {
  const presence = useContext(DialogPresenceContext);
  const visible = open && (presence?.present ?? true);
  const ref = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState(false);
  const latest = useRef({ visible, onClose, onOpen });
  latest.current = { visible, onClose, onOpen };
  const requested = useRef(false);
  const release = useRef<(() => void) | undefined>();
  const register = presence?.register;

  useEffect(() => {
    const dialog = ref.current!;
    const close = () => {
      if (!dialog.open && !dialogs.has(dialog)) return;
      const top = [...dialogs].at(-1) === dialog;
      if (dialog.open) dialog.close();
      setActive(false);
      dialogs.delete(dialog);
      if (!dialogs.size && bodyStyle) {
        Object.assign(document.body.style, bodyStyle);
        bodyStyle = undefined;
      }
      if (top) {
        let target = openers.get(dialog);
        const seen = new Set<HTMLElement>();
        while (target && !seen.has(target)) {
          seen.add(target);
          const hiddenDialog = target.closest<HTMLDialogElement>('dialog:not([open])');
          if (!hiddenDialog) break;
          target = openers.get(hiddenDialog);
        }
        const remaining = [...dialogs].at(-1);
        if (target?.isConnected && (!remaining || remaining.contains(target)))
          target.focus({ preventScroll: true });
        else if (!remaining && !target?.isConnected)
          document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true });
      }
      release.current?.();
      release.current = undefined;
    };
    if (visible) {
      requested.current = false;
      if (!dialog.open) {
        openers.set(
          dialog,
          pointerOpener?.isConnected ? pointerOpener : (document.activeElement as HTMLElement),
        );
        if (!dialogs.size) {
          bodyStyle = {
            overflow: document.body.style.overflow,
            paddingRight: document.body.style.paddingRight,
          };
          const scrollbar = window.innerWidth - document.documentElement.clientWidth;
          document.body.style.overflow = 'hidden';
          if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
        }
        dialogs.add(dialog);
        release.current = register?.();
        dialog.showModal();
        setActive(true);
        latest.current.onOpen();
      }
      return;
    }
    if (!dialog.open) {
      close();
      return;
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reduced?.matches || typeof dialog.animate !== 'function') {
      close();
      return;
    }
    const desktop = window.matchMedia('(min-width: 1024px)').matches;
    const style = getComputedStyle(dialog);
    const animation = dialog.animate(
      [
        { opacity: 1, transform: 'none' },
        kind === 'viewer'
          ? { opacity: 0, transform: 'none' }
          : desktop
            ? { opacity: 0, transform: 'scale(0.96)' }
            : { opacity: 1, transform: 'translateY(100%)' },
      ],
      {
        duration: parseCssTime(style.getPropertyValue('--oyo-motion-exit'), 200),
        easing: style.getPropertyValue('--oyo-ease-in').trim() || 'ease-in',
        fill: 'forwards',
      },
    );
    let cancelled = false;
    const complete = () => {
      if (!cancelled && !latest.current.visible) close();
    };
    const finish = () => {
      if (reduced?.matches) animation.finish();
    };
    reduced?.addEventListener('change', finish);
    void animation.finished.then(complete, complete);
    return () => {
      cancelled = true;
      animation.cancel();
      reduced?.removeEventListener('change', finish);
    };
  }, [visible, register, kind]);

  useEffect(() => {
    const dialog = ref.current!;
    return () => {
      const top = [...dialogs].at(-1) === dialog;
      if (dialog.open) dialog.close();
      dialogs.delete(dialog);
      if (!dialogs.size && bodyStyle) {
        Object.assign(document.body.style, bodyStyle);
        bodyStyle = undefined;
      }
      release.current?.();
      release.current = undefined;
      const opener = openers.get(dialog);
      if (top && opener?.isConnected && !opener.closest('dialog:not([open])'))
        opener.focus({ preventScroll: true });
    };
  }, []);
  const requestClose = () => {
    if (!latest.current.visible || requested.current) return;
    requested.current = true;
    latest.current.onClose();
    queueMicrotask(() => {
      requested.current = false;
    });
  };
  const blockClosing = (event: SyntheticEvent) => {
    if (!latest.current.visible) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  return {
    ref,
    visible,
    active,
    retaining: presence?.present === false,
    requestClose,
    blockClosing,
  };
}
