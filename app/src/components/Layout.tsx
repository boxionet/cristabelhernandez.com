import { NavLink, Outlet } from "react-router-dom";
import type { IconType } from "react-icons";
import { FiCalendar, FiClock, FiLogOut, FiPlus, FiTag, FiUser } from "react-icons/fi";
import { useAuth } from "../auth";

const NAV: { to: string; label: string; icon: IconType; end: boolean }[] = [
  { to: "/mi-cuenta/", label: "Mis Citas", icon: FiCalendar, end: true },
  { to: "/mi-cuenta/historial", label: "Historial", icon: FiClock, end: false },
  { to: "/mi-cuenta/tratamientos", label: "Tratamientos", icon: FiTag, end: false },
  { to: "/mi-cuenta/perfil", label: "Perfil", icon: FiUser, end: false },
];

const LOGO_URL = "/assets/svgs/cristabel_logo_horizontal.svg";

export default function Layout() {
  const { patient, signOut } = useAuth();
  const firstName = (patient?.fullName || "").split(" ")[0] || "";

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
            </NavLink>
          ))}
        </nav>
        <a className="nav-book" href="/reservar/">
          <FiPlus aria-hidden /> Reservar una cita
        </a>
        <button className="nav-signout" onClick={() => void signOut()}>
          <FiLogOut aria-hidden /> Cerrar sesión
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="topbar-title">Mi Cuenta</span>
          {firstName && <span className="topbar-user">Hola, {firstName}</span>}
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>

      <nav className="tabbar">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `tab-item${isActive ? " active" : ""}`}
          >
            <span aria-hidden>
              <item.icon />
            </span>
            <small>{item.label}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
