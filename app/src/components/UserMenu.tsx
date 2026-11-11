import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiCheck,
  FiChevronDown,
  FiGrid,
  FiLogOut,
  FiUser,
} from "react-icons/fi";
import { isAdmin, useAuth } from "../auth";

// The identity chip at the top-right of both areas. For a normal
// patient it is plain text, exactly as before. For an admin it
// becomes a button that opens a small account menu: identity header,
// a "Ver como" section with Panel / Mi Cuenta and a check on the
// current view, and Cerrar sesión. The switch options exist only
// for admins — patients never see the button or the menu.
export default function UserMenu({
  mode,
  fullName,
  email,
}: {
  mode: "panel" | "patient";
  fullName: string;
  email: string;
}) {
  const { user, signOut } = useAuth();
  const admin = isAdmin(user);
  const [open, setOpen] = useState(false);

  const firstName = fullName.trim().split(/\s+/)[0] || "";
  const initial = (firstName.charAt(0) || "?").toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  if (!firstName) return null;

  const identity = (
    <>
      <span className="avatar" aria-hidden>
        {initial}
      </span>
      <span className="user-meta">
        <span className="user-name">{firstName}</span>
        <small className="user-role-text">{admin ? "Admin" : "Paciente"}</small>
      </span>
    </>
  );

  if (!admin) {
    return <span className="user-identity">{identity}</span>;
  }

  return (
    <div className="user-menu-wrap">
      <button
        type="button"
        className="user-identity user-chip-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {identity}
        <FiChevronDown className="user-chev" aria-hidden />
      </button>
      {open && (
        <>
          <span className="um-backdrop" onClick={() => setOpen(false)} />
          <div className="user-menu" role="menu">
            <div className="um-head">
              <span className="avatar" aria-hidden>
                {initial}
              </span>
              <span className="um-head-text">
                <span className="um-head-row">
                  <span className="um-head-name">{fullName}</span>
                  <span className="um-tag">Admin</span>
                </span>
                <span className="um-head-email">{email}</span>
              </span>
            </div>
            <span className="um-sep" />
            <span className="um-label">Ver como</span>
            <Link
              to="/panel"
              className={`um-item${mode === "panel" ? " current" : ""}`}
              onClick={() => setOpen(false)}
            >
              <FiGrid aria-hidden />
              Panel
              {mode === "panel" && (
                <FiCheck className="um-check" aria-hidden />
              )}
            </Link>
            <Link
              to="/mi-cuenta"
              className={`um-item${mode === "patient" ? " current" : ""}`}
              onClick={() => setOpen(false)}
            >
              <FiUser aria-hidden />
              Mi Cuenta
              {mode === "patient" && (
                <FiCheck className="um-check" aria-hidden />
              )}
            </Link>
            <span className="um-sep" />
            <button
              type="button"
              className="um-item danger"
              onClick={() => void signOut()}
            >
              <FiLogOut aria-hidden />
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}
