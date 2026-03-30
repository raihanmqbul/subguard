import { useToastContext } from '../context/ToastContext';
import type { Toast } from '../hooks/useToast';

const VARIANT_STYLES: Record<Toast['variant'], string> = {
  info: 'bg-gray-800 text-white dark:bg-gray-700',
  success: 'bg-green-700 text-white',
  error: 'bg-red-600 text-white',
  warning: 'bg-yellow-500 text-gray-900',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg shadow-lg text-sm min-w-[220px] max-w-xs ${VARIANT_STYLES[toast.variant]}`}
    >
      <span className="flex-1">{toast.message}</span>

      <div className="flex items-center gap-2 shrink-0">
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onClick();
              onDismiss(toast.id);
            }}
            className="font-semibold underline underline-offset-2 hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-white rounded"
          >
            {toast.action.label}
          </button>
        )}
        <button
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="opacity-70 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-white rounded"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismiss } = useToastContext();

  if (toasts.length === 0) return null;

  return (
    // ARIA live region container — announced by screen readers (Req 22.7)
    <div
      aria-label="Notifications"
      aria-live="polite"
      aria-relevant="additions removals"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}
