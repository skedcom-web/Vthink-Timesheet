import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

/** Same message + type while still on screen → do not stack another toast. */
function toastDedupeKey(message: string, type: ToastType): string {
  return `${type}:${message.trim()}`;
}

let addToastFn: ((msg: string, type: ToastType) => void) | null = null;

const SUCCESS_AUTO_DISMISS_MS = 5000;

export const toast = {
  success: (msg: string) => addToastFn?.(msg, 'success'),
  error: (msg: string) => addToastFn?.(msg, 'error'),
  warning: (msg: string) => addToastFn?.(msg, 'warning'),
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    addToastFn = (message, type) => {
      setToasts(p => {
        const key = toastDedupeKey(message, type);
        if (p.some(t => toastDedupeKey(t.message, t.type) === key)) return p;

        const id = Math.random().toString(36).slice(2);

        if (type === 'success') {
          window.setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
          }, SUCCESS_AUTO_DISMISS_MS);
        }

        return [...p, { id, message, type }];
      });
    };
    return () => {
      addToastFn = null;
    };
  }, []);

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden />,
    error: <XCircle className="w-4 h-4 text-red-500 shrink-0" aria-hidden />,
    warning: <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" aria-hidden />,
  };

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-[min(420px,calc(100vw-2rem))]"
      aria-live={toasts.some(t => t.type === 'error') ? 'assertive' : 'polite'}
      aria-relevant="additions"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          role={t.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-3 rounded-xl border shadow-lg px-4 py-3 min-w-[280px] animate-in slide-in-from-right ${
            t.type === 'error'
              ? 'bg-red-50/95 dark:bg-red-950/40 border-red-200 dark:border-red-800'
              : t.type === 'warning'
                ? 'bg-amber-50/95 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                : 'bg-[var(--card-bg)] border-[var(--border)]'
          }`}
        >
          {icons[t.type]}
          <span className="text-sm text-slate-800 dark:text-slate-100 flex-1 leading-snug pt-0.5">{t.message}</span>
          <button
            type="button"
            onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}
            className="shrink-0 rounded-md p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
