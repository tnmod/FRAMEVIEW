import React from 'react';
import { useToastStore } from '../../store/toastStore';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center space-y-2 pointer-events-none select-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center space-x-2.5 px-4 py-2 rounded-xl bg-[#14171d]/90 backdrop-blur-xl border border-white/10 shadow-2xl text-xs text-zinc-200 animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {isWarning && <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
            {isError && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {!isSuccess && !isWarning && !isError && (
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
            )}

            <span className="font-medium text-zinc-100">{toast.message}</span>

            {toast.actionLabel && toast.onAction && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toast.onAction?.();
                  removeToast(toast.id);
                }}
                className="ml-2 px-2 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold text-[11px] transition-colors cursor-pointer"
              >
                {toast.actionLabel}
              </button>
            )}

            <button
              onClick={() => removeToast(toast.id)}
              className="p-0.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors ml-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
