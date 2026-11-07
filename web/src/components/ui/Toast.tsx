import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, CircleAlert, X } from 'lucide-react';
import { IconButton } from './IconButton';
export type ToastOptions = {
  title: string;
  action?: { label: string; onClick: () => void };
  tone?: 'default' | 'error' | 'success';
};
const Context = createContext<{ show: (options: ToastOptions) => void } | null>(null);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const counter = useRef(0);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(4000);
  const currentId = useRef<number>();
  useEffect(() => {
    if (!toast) return;
    if (currentId.current !== toast.id) {
      remaining.current = toast.tone === 'error' ? 8000 : 4000;
      currentId.current = toast.id;
    }
    if (paused) return;
    const start = Date.now();
    const timer = setTimeout(() => setToast(null), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - start));
    };
  }, [toast, paused]);
  return (
    <Context.Provider
      value={{
        show: (options) => {
          setPaused(false);
          setToast({ ...options, id: ++counter.current });
        },
      }}
    >
      {children}
      <div className="ui-toast-region">
        {toast && (
          <div
            key={toast.id}
            className="ui-toast"
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={(event) => {
              if (!event.currentTarget.contains(document.activeElement)) setPaused(false);
            }}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
            }}
          >
            {toast.tone === 'error' ? (
              <CircleAlert aria-hidden="true" size={20} strokeWidth={1.75} />
            ) : (
              <Check aria-hidden="true" size={20} strokeWidth={1.75} />
            )}
            <span
              className="flex-1"
              role={toast.tone === 'error' ? 'alert' : 'status'}
              aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
              aria-atomic="true"
            >
              {toast.title}
            </span>
            {toast.action && (
              <button
                type="button"
                className="ui-toast-action"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <IconButton aria-label="Dismiss Notification" onClick={() => setToast(null)}>
              <X size={20} strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
          </div>
        )}
      </div>
    </Context.Provider>
  );
}
export function useToast() {
  const value = useContext(Context);
  if (!value) throw new Error('useToast requires ToastProvider');
  return value;
}
