import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

const NAV = [
  { to: "/mi-cuenta/", label: "Mis Citas", icon: "▦", end: true },
  { to: "/mi-cuenta/historial", label: "Historial", icon: "◷", end: false },
  { to: "/mi-cuenta/tratamientos", label: "Tratamientos", icon: "✦", end: false },
  { to: "/mi-cuenta/perfil", label: "Perfil", icon: "◯", end: false },
];

export default function Layout() {
  const { patient, signOut } = useAuth();
  const firstName = (patient?.fullName || "").split(" ")[0] || "";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">CH</span>
          <span className="brand-text">
            Centro Estético
            <small>Dra. Cristabel Hernández</small>
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
            </NavLink>
          ))}
        </nav>
        <a className="nav-book" href="/reservar/">
          + Reservar una cita
        </a>
        <button className="nav-signout" onClick={() => void signOut()}>
          Cerrar sesión
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
            <span aria-hidden>{item.icon}</span>
            <small>{item.label}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
