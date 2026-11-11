import { useEffect, useState } from "react";
import { FiCalendar } from "react-icons/fi";
import MonthCalendar, { monthTitleOf } from "./MonthCalendar";
import { formatDateEs } from "../lib/format";

/**
 * A text-field-style button that opens the modern month calendar in a
 * popover. `displayFormat` customizes the button label (Reportes shows
 * only the month). Picking a day selects it and closes the popover.
 */
export default function DatePicker({
  value,
  onChange,
  placeholder = "Elige una fecha",
  displayFormat,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  displayFormat?: (iso: string) => string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  const label = value
    ? (displayFormat?.(value) ??
      formatDateEs(value).replace(/^./, (c) => c.toUpperCase()))
    : placeholder;

  return (
    <div className="datepicker">
      <button
        type="button"
        className={`datepicker-btn${value ? "" : " placeholder"}`}
        onClick={() => setOpen((o) => !o)}
      >
        <FiCalendar aria-hidden />
        <span>{label}</span>
      </button>
      {open && (
        <>
          <div className="datepicker-backdrop" onClick={() => setOpen(false)} />
          <div className="datepicker-pop">
            <MonthCalendar
              value={value}
              onPick={(iso) => {
                onChange(iso);
                setOpen(false);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function formatMonthDisplay(iso: string): string {
  const t = monthTitleOf(iso.slice(0, 7));
  return t.replace(/^./, (c) => c.toUpperCase());
}
