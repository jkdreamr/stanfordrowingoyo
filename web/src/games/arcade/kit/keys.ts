import { useEffect, useRef, useState } from 'react';

/** Friendly names that match several physical keys. */
export const keyAliases: Record<string, string[]> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  action: ['Space', 'Enter'],
};

/** Keys that would scroll the page or click a focused button if we let them through. */
export const scrollKeys = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  'Enter',
]);

export type KeyListener = (code: string, e: KeyboardEvent | null) => void;

/** Held/pressed state for KeyboardEvent.code values (e.g. 'ArrowLeft', 'KeyW', 'Space') plus the aliases above. */
export class KeyState {
  private held = new Set<string>();
  private hits = new Set<string>();
  readonly listeners = new Set<KeyListener>();

  private expand(names: string[]) {
    return names.flatMap((n) => keyAliases[n] ?? [n]);
  }
  /** True while any of the keys is held. */
  down(...names: string[]) {
    return this.expand(names).some((c) => this.held.has(c));
  }
  /** True once per physical press of any of the keys (consumes the press). */
  pressed(...names: string[]) {
    let hit = false;
    for (const c of this.expand(names)) if (this.hits.delete(c)) hit = true;
    return hit;
  }
  /** -1, 0 or 1 from two opposing keys, e.g. axis('left', 'right'). */
  axis(neg: string, pos: string) {
    return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0);
  }
  press(code: string, e: KeyboardEvent | null = null) {
    if (!this.held.has(code)) this.hits.add(code);
    this.held.add(code);
    this.listeners.forEach((f) => f(code, e));
  }
  release(code: string) {
    this.held.delete(code);
  }
  clear() {
    this.held.clear();
    this.hits.clear();
  }
}

export function useKeys(onPress?: KeyListener, enabled = true): KeyState {
  const [keys] = useState(() => new KeyState());
  const cb = useRef(onPress);
  cb.current = onPress;
  useEffect(() => {
    keys.clear();
    if (!enabled) return;
    const down = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof Element &&
          event.target.closest(
            'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
          ))
      )
        return;
      if (
        (event.code === 'Space' || event.code === 'Enter') &&
        event.target instanceof Element &&
        event.target.closest('button,a[href]')
      )
        return;
      if (scrollKeys.has(event.code) || Object.values(keyAliases).flat().includes(event.code))
        event.preventDefault();
      keys.press(event.code, event);
      cb.current?.(event.code, event);
    };
    const up = (event: KeyboardEvent) => keys.release(event.code);
    const clear = () => keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
      keys.clear();
    };
  }, [keys, enabled]);
  return keys;
}
