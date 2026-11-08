import { useSyncExternalStore } from 'react';

export interface SavedSession {
  id: number;
  equiv_m: number;
  title: string;
  before?: number;
  after?: number;
}
let current: SavedSession | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function announceSave(session: Omit<SavedSession, 'id'>) {
  current = { ...session, id: Date.now() };
  emit();
}
export function clearSave() {
  current = null;
  emit();
}
export function useSavedSession() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null,
  );
}
