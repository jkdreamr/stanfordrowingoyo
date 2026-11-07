import { useEffect, useState, useSyncExternalStore } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const DISMISSED_KEY = 'oyo-install-dismissed';
let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Captures the install prompt as early as possible; call once at startup. */
export function listenForInstall(target: Window = window) {
  target.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  target.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export function isStandalone(win: Window = window) {
  return (
    installed ||
    win.matchMedia?.('(display-mode: standalone)').matches ||
    win.matchMedia?.('(display-mode: fullscreen)').matches ||
    (win.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(nav: Navigator = navigator) {
  return (
    /iPad|iPhone|iPod/.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  );
}

export type InstallMode = 'prompt' | 'ios' | null;
export function installMode(): InstallMode {
  if (isStandalone()) return null;
  if (deferred) return 'prompt';
  return isIos() ? 'ios' : null;
}

function readDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function useInstall() {
  const mode = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    installMode,
    () => null,
  );
  const [dismissed, setDismissed] = useState(readDismissed);
  const [steps, setSteps] = useState(false);
  useEffect(() => {
    if (!mode) setSteps(false);
  }, [mode]);
  return {
    mode,
    dismissed,
    steps,
    closeSteps: () => setSteps(false),
    dismiss() {
      setDismissed(true);
      try {
        localStorage.setItem(DISMISSED_KEY, '1');
      } catch {
        // Private mode: dismissal lasts for this page only.
      }
    },
    async install() {
      if (mode === 'ios') return setSteps(true);
      const event = deferred;
      if (!event) return;
      deferred = null;
      emit();
      await event.prompt().catch(() => {});
    },
  };
}

export function resetInstallForTests() {
  deferred = null;
  installed = false;
  emit();
}
