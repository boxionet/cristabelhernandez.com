import { NavLink, Outlet } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  FiBarChart2,
  FiCalendar,
  FiClipboard,
  FiClock,
  FiGrid,
  FiLogOut,
  FiTag,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "../auth";
import { clinicToday } from "../lib/panel";
import {
  usePanelAppointments,
  useStaffProfileName,
} from "../lib/queries/panelQueries";

const NAV: { to: string; label: string; icon: IconType; end: boolean }[] = [
  { to: "/panel/", label: "Panel", icon: FiGrid, end: true },
  { to: "/panel/agenda", label: "Agenda", icon: FiCalendar, end: false },
  { to: "/panel/citas", label: "Citas", icon: FiClipboard, end: false },
  { to: "/panel/pacientes", label: "Pacientes", icon: FiUsers, end: false },
  { to: "/panel/servicios", label: "Tratamientos", icon: FiTag, end: false },
  { to: "/panel/horario", label: "Horario", icon: FiClock, end: false },
  { to: "/panel/reportes", label: "Reportes", icon: FiBarChart2, end: false },
];

const LOGO_URL = "/assets/svgs/cristabel_logo_horizontal.svg";

export default function PanelLayout() {
  const { user, signOut } = useAuth();
  // Sidebar badges read the shared appointments query (React Query
  // cache + invalidations keep them fresh; no manual reloads).
  const { data: appointments } = usePanelAppointments();
  const profile = useStaffProfileName(user?.id);

  // The identity shown top-right is the person's first name: the auth
  // profile name when present, else their patient record's name, else
  // the email prefix as a last resort. While the profile query is in
  // flight, no chip renders (so the fallback never flashes).
  const meta = user?.user_metadata as
    | { full_name?: string; name?: string }
    | undefined;
  const metaName = meta?.full_name || meta?.name || "";
  const fullName =
    metaName ||
    (profile.isLoading
      ? ""
      : profile.data || (user?.email ? user.email.split("@")[0] : ""));
  const firstName = fullName.trim().split(/\s+/)[0] || "";
  const initial = (firstName.charAt(0) || "?").toUpperCase();

  const today = clinicToday();
  const todayCount = (appointments ?? []).filter(
    (a) =>
      a.date === today && a.status !== "cancelada" && a.status !== "no_show",
  ).length;
  const pendingHolds = (appointments ?? []).filter(
    (a) => a.status === "por_confirmar",
  ).length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src={LOGO_URL} alt="Centro Estético Dra. Cristabel Hernández" />
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-icon" aria-hidden>
                <item.icon />
              </span>
              {item.label}
              {item.label === "Citas" && todayCount > 0 && (
                <span className="nav-badge">{todayCount}</span>
              )}
              {item.label === "Citas" && pendingHolds > 0 && (
                <span className="nav-badge amber">{pendingHolds} por confirmar</span>
              )}
            </NavLink>
          ))}
        </nav>
        <button className="nav-signout" onClick={() => void signOut()}>
          <FiLogOut aria-hidden /> Cerrar sesión
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="topbar-spacer" />
          {firstName && (
            <span className="user-identity">
              <span className="avatar" aria-hidden>
                {initial}
              </span>
              <span className="user-meta">
                <span className="user-name">{firstName}</span>
                <small className="user-role-text">Admin</small>
              </span>
            </span>
          )}
          <button
            type="button"
            className="topbar-signout"
            onClick={() => void signOut()}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <FiLogOut aria-hidden />
          </button>
        </header>
        <nav className="mobile-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `mobile-nav-item${isActive ? " active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="content wide">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
