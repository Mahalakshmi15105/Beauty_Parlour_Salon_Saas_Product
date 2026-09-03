import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, X, Info } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "success", duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showSuccess = useCallback((message) => addToast(message, "success"), [addToast]);
  const showError = useCallback((message) => addToast(message, "error", 5000), [addToast]);
  const showInfo = useCallback((message) => addToast(message, "info"), [addToast]);

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showInfo, addToast }}>
      {children}
      {/* Toast Render Container */}
      <div className="fixed top-5 right-5 z-[99999] flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start space-x-3 p-3.5 rounded-2xl shadow-xl border text-xs font-bold transition-all duration-300 transform translate-y-0 animate-slide-in ${
              toast.type === "success"
                ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20"
                : toast.type === "error"
                ? "bg-rose-600 text-white border-rose-500 shadow-rose-600/20"
                : "bg-slate-800 text-white border-slate-700 shadow-slate-900/20"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-100" />
              ) : toast.type === "error" ? (
                <AlertTriangle className="w-4 h-4 text-rose-100" />
              ) : (
                <Info className="w-4 h-4 text-slate-100" />
              )}
            </div>
            <div className="flex-1 leading-snug break-words">
              {toast.message}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-white/80 hover:text-white transition p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if component is outside ToastProvider
    return {
      showSuccess: (msg) => console.log("[Toast Success]", msg),
      showError: (msg) => console.error("[Toast Error]", msg),
      showInfo: (msg) => console.log("[Toast Info]", msg)
    };
  }
  return context;
}
