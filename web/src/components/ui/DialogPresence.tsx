import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export const DialogPresenceContext = createContext<{
  present: boolean;
  register: () => () => void;
} | null>(null);

export function DialogPresence({ children }: { children: ReactNode }) {
  const parent = useContext(DialogPresenceContext);
  const present = !!children && (parent?.present ?? true);
  const current = useRef(present);
  current.current = present;
  const [retained, setRetained] = useState(children);
  const dialogs = useRef(new Set<symbol>());
  const finish = useCallback(() => {
    if (!current.current && dialogs.current.size === 0) setRetained(null);
  }, []);
  const parentRegister = parent?.register;
  const register = useCallback(() => {
    const token = Symbol();
    dialogs.current.add(token);
    const releaseParent = parentRegister?.();
    return () => {
      dialogs.current.delete(token);
      releaseParent?.();
      finish();
    };
  }, [finish, parentRegister]);
  useLayoutEffect(() => {
    if (present) setRetained(children);
    else finish();
  }, [children, present, finish]);
  const value = useMemo(() => ({ present, register }), [present, register]);
  return (
    <DialogPresenceContext.Provider value={value}>
      {present ? children : retained}
    </DialogPresenceContext.Provider>
  );
}
