import { useRef, useState, type ReactNode } from "react";

/**
 * A button that runs an async action with the pending-state best
 * practices (owner request, 2026-11-11):
 *  - while the call is in flight the button is DISABLED (no double
 *    submits) and shows a spinner;
 *  - an optional `pendingText` swaps the label ("Guardando…");
 *  - aria-busy is set so assistive tech announces the pending state;
 *  - if the action throws, the button recovers — error surfacing is
 *    the caller's job (pair with useToast()).
 *
 * Usage:
 *   <AsyncButton className="btn primary" pendingText="Guardando…"
 *     onClick={async () => { … }}>
 *     Guardar
 *   </AsyncButton>
 */
export default function AsyncButton({
  onClick,
  className,
  pendingText,
  disabled = false,
  children,
}: {
  onClick: () => Promise<void>;
  className?: string;
  pendingText?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const running = useRef(false);

  async function handle() {
    if (running.current) return;
    running.current = true;
    setPending(true);
    try {
      await onClick();
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={() => void handle()}
    >
      {pending ? (
        <>
          <span className="spinner" aria-hidden /> {pendingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
