import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ToastTone = 'release' | 'rollback' | 'info';

interface Toast {
  id: number;
  title: string;
  body: string;
  tone: ToastTone;
}

interface ToastValue {
  showToast: (toast: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

let nextId = 1;
const TOAST_MS = 5200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { ...toast, id }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_MS);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <span className="toast__marker" aria-hidden="true" />
            <div>
              <p className="toast__title">{t.title}</p>
              <p className="toast__body">{t.body}</p>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// oxlint-disable-next-line react/only-export-components -- hook co-located with its provider
export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
