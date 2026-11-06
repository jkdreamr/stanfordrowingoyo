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
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <Context.Provider
      value={{ show: (options) => setToast({ ...options, id: ++counter.current }) }}
    >
      {children}
      <div className="ui-toast-region" aria-live="polite" aria-atomic="true">
        {toast && (
          <div key={toast.id} className="ui-toast">
            {toast.tone === 'error' ? (
              <CircleAlert aria-hidden="true" size={20} strokeWidth={1.75} />
            ) : toast.tone === 'success' ? (
              <Check aria-hidden="true" size={20} strokeWidth={1.75} />
            ) : null}
            <span className="flex-1">{toast.title}</span>
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
              <X size={20} strokeWidth={1.75} />
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
