import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import { clinicToday, usePanelData } from "../lib/panel";

const NAV = [
  { to: "/panel/", label: "Panel", icon: "▦", end: true },
  { to: "/panel/agenda", label: "Agenda", icon: "▤", end: false },
  { to: "/panel/citas", label: "Citas", icon: "◷", end: false },
  { to: "/panel/clientes", label: "Clientes", icon: "◯", end: false },
  { to: "/panel/servicios", label: "Tratamientos", icon: "✦", end: false },
  { to: "/panel/horario", label: "Horario", icon: "◔", end: false },
  { to: "/panel/reportes", label: "Reportes", icon: "▥", end: false },
];

export default function PanelLayout() {
  const { user, signOut } = useAuth();
  const { appointments } = usePanelData();
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
          <span className="brand-mark">CH</span>
          <span className="brand-text">
            Centro Estético
            <small>Panel de administración</small>
          </span>
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
                {item.icon}
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
          Cerrar sesión
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="topbar-title">Panel</span>
          <NavLink className="btn primary small" to="/panel/nueva-cita">
            + Nueva cita
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
