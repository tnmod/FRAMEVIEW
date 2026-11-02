import { create } from 'zustand';

export interface ToastItem {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
  showToast: (
    message: string,
    options?: {
      type?: 'info' | 'success' | 'warning' | 'error';
      actionLabel?: string;
      onAction?: () => void;
      duration?: number;
    }
  ) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (message, options) => {
    const id = Math.random().toString(36).substring(2, 9);
    const toast: ToastItem = {
      id,
      message,
      type: options?.type || 'info',
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
      duration: options?.duration ?? 3500,
    };

    set((state) => ({
      toasts: [...state.toasts.slice(-3), toast], // Keep max 4 visible
    }));

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, toast.duration);
    }
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
