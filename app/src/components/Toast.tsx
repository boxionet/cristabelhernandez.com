import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FiAlertCircle, FiCheckCircle, FiX } from "react-icons/fi";

/**
 * Reusable toast notifications (owner request, 2026-11-11).
 *
 * Usage:
 *   1. <ToastProvider> wraps the app (main.tsx).
 *   2. const toast = useToast();
 *      toast.success("Día especial agregado");
 *      toast.error("No se pudo guardar. Inténtalo de nuevo.");
 *
 * Best practices baked in: success auto-dismisses in 4s, errors stay
 * 6s and use role="alert"; every toast can be dismissed manually;
 * toasts stack bottom-right and never block the UI (pointer-events
 * only on the toast itself). Pair with <AsyncButton> so the button
 * that triggered the call shows its pending state.
 */

type ToastKind = "success" | "error";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi>({
  success: () => undefined,
  error: () => undefined,
});

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const DURATIONS: Record<ToastKind, number> = {
  success: 4000,
  error: 6000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), DURATIONS[kind]);
    },
    [dismiss],
  );

  const api: ToastApi = {
    success: (message) => push("success", message),
    error: (message) => push("error", message),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.kind}`}
            role={t.kind === "error" ? "alert" : "status"}
          >
            {t.kind === "success" ? (
              <FiCheckCircle aria-hidden />
            ) : (
              <FiAlertCircle aria-hidden />
            )}
            <span className="toast-msg">{t.message}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="Cerrar notificación"
              onClick={() => dismiss(t.id)}
            >
              <FiX aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
