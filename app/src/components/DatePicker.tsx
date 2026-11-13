import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { FiCalendar, FiChevronDown, FiX } from "react-icons/fi";
import MonthCalendar, { monthTitleOf } from "./MonthCalendar";
import MonthGrid from "./MonthGrid";
import { formatDateEs } from "../lib/format";

/**
 * A text-field-style button that opens the modern month calendar in a
 * popover. The popover is positioned fixed from the trigger's rect:
 * it flips ABOVE the field when there isn't room below (Horario's
 * form sits low on the page), right-aligns to the trigger when it
 * would overflow the right edge (Reportes' header), clamps to the
 * viewport, and re-places itself on resize/scroll instead of staying
 * stuck where it first opened.
 */
export default function DatePicker({
  value,
  onChange,
  placeholder = "Elige una fecha",
  displayFormat,
  mode = "day",
  anchorRef,
  min,
  clearable = false,
  ariaLabel,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  displayFormat?: (iso: string) => string;
  /** "day" shows the month calendar; "month" shows the year + month-tile grid. */
  mode?: "day" | "month";
  /** Optional wider element the popover anchors to (e.g. a segmented control). */
  anchorRef?: RefObject<HTMLElement | null>;
  /** Day-mode only: days before this ISO date cannot be picked. */
  min?: string;
  /** Show a × that clears the value (for optional date fields). */
  clearable?: boolean;
  /** Accessible label for the trigger button. */
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const btn = btnRef.current;
    const pop = popRef.current;
    if (!btn || !pop) return;
    const r = (anchorRef?.current ?? btn).getBoundingClientRect();
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = r.bottom + 6;
    if (top + ph > vh - 8) {
      // Not enough room below: open upward if it fits there.
      top = r.top - ph - 6 >= 8 ? r.top - ph - 6 : Math.max(8, vh - ph - 8);
    }
    let left = r.left;
    if (left + pw > vw - 8) left = r.right - pw; // keep inside the right edge
    left = Math.min(Math.max(8, left), Math.max(8, vw - pw - 8));
    setCoords({ top, left });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (open) {
      setCoords(null);
      place();
    }
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onMove = () => place();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  const label = value
    ? (displayFormat?.(value) ??
      formatDateEs(value).replace(/^./, (c) => c.toUpperCase()))
    : placeholder;

  return (
    <div className={`datepicker${clearable && value !== "" ? " has-clear" : ""}`}>
      <button
        ref={btnRef}
        type="button"
        className={`datepicker-btn${value ? "" : " placeholder"}`}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <FiCalendar aria-hidden />
        <span>{label}</span>
        {mode === "month" && (
          <FiChevronDown className="dp-chevron" aria-hidden />
        )}
      </button>
      {clearable && value !== "" && (
        <button
          type="button"
          className="datepicker-clear"
          aria-label="Quitar fecha"
          onClick={() => onChange("")}
        >
          <FiX aria-hidden />
        </button>
      )}
      {open && (
        <>
          <div className="datepicker-backdrop" onClick={() => setOpen(false)} />
          <div
            ref={popRef}
            className="datepicker-pop"
            style={
              coords
                ? { top: coords.top, left: coords.left }
                : { top: 0, left: 0, visibility: "hidden" }
            }
          >
            {mode === "month" ? (
              <MonthGrid
                value={value}
                onPick={(iso) => {
                  onChange(iso);
                  setOpen(false);
                }}
              />
            ) : (
              <MonthCalendar
                value={value}
                min={min}
                onPick={(iso) => {
                  onChange(iso);
                  setOpen(false);
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function formatMonthDisplay(iso: string): string {
  // "noviembre de 2026" → "Noviembre 2026" (compact label for the pill control)
  const t = monthTitleOf(iso.slice(0, 7)).replace(" de ", " ");
  return t.replace(/^./, (c) => c.toUpperCase());
}
