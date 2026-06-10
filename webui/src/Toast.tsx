import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  XCircle,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number; // ms, default 5000
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MAX_VISIBLE = 5;
const DEFAULT_DURATION = 5000;

const TOAST_STYLES: Record<
  ToastMessage['type'],
  { container: string; icon: string; action: string }
> = {
  success: {
    container:
      'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    icon: 'text-emerald-400',
    action:
      'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30',
  },
  info: {
    container: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
    icon: 'text-cyan-400',
    action: 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30',
  },
  warning: {
    container: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    icon: 'text-amber-400',
    action: 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30',
  },
  error: {
    container: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
    icon: 'text-rose-400',
    action: 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30',
  },
};

const ICON_MAP: Record<ToastMessage['type'], React.ElementType> = {
  success: CheckCircle,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Single Toast                                                       */
/* ------------------------------------------------------------------ */

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [visible, setVisible] = useState(false);

  const style = TOAST_STYLES[toast.type];
  const Icon = ICON_MAP[toast.type];

  /* Slide-in on mount */
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  /* Auto-dismiss */
  useEffect(() => {
    const timeout = setTimeout(() => {
      setVisible(false);
      /* Wait for the exit animation before removing */
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.duration ?? DEFAULT_DURATION);

    return () => clearTimeout(timeout);
  }, [toast.id, toast.duration, onDismiss]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [onDismiss, toast.id]);

  return (
    <div
      className={[
        'pointer-events-auto relative flex w-full max-w-[380px] items-start gap-3',
        'rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm',
        'transition-all duration-300 ease-in-out',
        visible
          ? 'translate-x-0 opacity-100'
          : 'translate-x-8 opacity-0',
        style.container,
      ].join(' ')}
      role="alert"
    >
      {/* Icon */}
      <Icon className={`mt-0.5 size-4 shrink-0 ${style.icon}`} />

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[12px] font-bold leading-tight">
          {toast.title}
        </p>

        {toast.message && (
          <p className="text-[11px] leading-snug opacity-75">
            {toast.message}
          </p>
        )}

        {toast.action && (
          <button
            type="button"
            onClick={toast.action.onClick}
            className={[
              'mt-1 inline-flex w-fit items-center rounded-full px-2.5 py-0.5',
              'text-[11px] font-medium transition-colors',
              style.action,
            ].join(' ')}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-2 top-2 rounded p-0.5 opacity-50 transition-opacity hover:opacity-100"
        aria-label="Dismiss notification"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id =
        Date.now().toString(36) + Math.random().toString(36).slice(2);

      setToasts((prev) => {
        const next = [...prev, { ...toast, id }];
        /* Enforce max visible — drop oldest when exceeded */
        if (next.length > MAX_VISIBLE) {
          return next.slice(next.length - MAX_VISIBLE);
        }
        return next;
      });
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}

      {/* Toast container — bottom-right, stacked vertically */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-0 z-[9999] flex flex-col items-end justify-end gap-2 p-4"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
