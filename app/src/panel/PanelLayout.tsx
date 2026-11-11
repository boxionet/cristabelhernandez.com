import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  FiBarChart2,
  FiCalendar,
  FiClipboard,
  FiClock,
  FiGrid,
  FiLogOut,
  FiPlus,
  FiTag,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "../auth";
import { clinicToday, usePanelData } from "../lib/panel";

const NAV: { to: string; label: string; icon: IconType; end: boolean }[] = [
  { to: "/panel/", label: "Dashboard", icon: FiGrid, end: true },
  { to: "/panel/agenda", label: "Agenda", icon: FiCalendar, end: false },
  { to: "/panel/citas", label: "Citas", icon: FiClipboard, end: false },
  { to: "/panel/clientes", label: "Clientes", icon: FiUsers, end: false },
  { to: "/panel/servicios", label: "Tratamientos", icon: FiTag, end: false },
  { to: "/panel/horario", label: "Horario", icon: FiClock, end: false },
  { to: "/panel/reportes", label: "Reportes", icon: FiBarChart2, end: false },
];

const LOGO_URL = "/assets/svgs/cristabel_logo_horizontal.svg";

export default function PanelLayout() {
  const { user, signOut } = useAuth();
  const { appointments, reload } = usePanelData();
  const location = useLocation();

  // The layout keeps its own data copy for the sidebar badges; refresh
  // it on navigation so actions taken on a page don't leave stale counts.
  useEffect(() => {
    void reload();
  }, [location.pathname, reload]);
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
        <NavLink className="nav-book deep" to="/panel/nueva-cita">
          Citas por teléfono o WhatsApp
          <small>Registrar una cita manual</small>
        </NavLink>
        <div className="user-chip">
          <span className="user-email">{user?.email}</span>
          <span className="user-role">Admin</span>
        </div>
        <button className="nav-signout" onClick={() => void signOut()}>
          <FiLogOut aria-hidden /> Cerrar sesión
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="topbar-spacer" />
          <NavLink className="btn primary small" to="/panel/nueva-cita">
            <FiPlus aria-hidden /> Nueva cita
          </NavLink>
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
