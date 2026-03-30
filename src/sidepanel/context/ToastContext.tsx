import { createContext, useContext, type ReactNode } from 'react';
import { useToast, type Toast, type ToastVariant, type ToastAction } from '../hooks/useToast';

interface ToastContextValue {
  toasts: Toast[];
  show: (message: string, variant?: ToastVariant, action?: ToastAction) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  return <ToastContext.Provider value={toast}>{children}</ToastContext.Provider>;
}

export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToastContext must be used within ToastProvider');
  return ctx;
}
