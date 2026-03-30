import { useState, useCallback, useRef } from 'react';

export type ToastVariant = 'info' | 'success' | 'error' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  /** Optional undo / action button */
  action?: ToastAction;
}

const DISMISS_DELAY_MS = 5000;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'info', action?: ToastAction): string => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, variant, action }]);

      // Auto-dismiss after 5 seconds (Req 1.6)
      const timer = setTimeout(() => dismiss(id), DISMISS_DELAY_MS);
      timers.current.set(id, timer);

      return id;
    },
    [dismiss]
  );

  return { toasts, show, dismiss };
}
