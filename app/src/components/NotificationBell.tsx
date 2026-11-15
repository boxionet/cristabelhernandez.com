import { Link } from "react-router-dom";
import { FiBell } from "react-icons/fi";

/**
 * Notification bell for the Panel topbar: links to the action queue
 * (e.g. citas awaiting confirmation) with a count badge. The badge
 * shows only when there is something to act on; the count is derived
 * live from the shared appointments query by the caller, so it can
 * never go stale.
 */
export default function NotificationBell({
  count,
  to,
  label,
}: {
  count: number;
  to: string;
  label: string;
}) {
  const display = count > 99 ? "99+" : String(count);
  return (
    <Link
      to={to}
      className="notification-bell"
      aria-label={
        count > 0 ? `${count} ${label}` : `No hay ${label.toLowerCase()}`
      }
      title={label}
    >
      <FiBell aria-hidden />
      {count > 0 && (
        <span className="notification-badge" aria-hidden>
          {display}
        </span>
      )}
    </Link>
  );
}
