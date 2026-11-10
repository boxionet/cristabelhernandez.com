import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, isAdmin, useAuth } from "./auth";
import Layout from "./components/Layout";
import Historial from "./pages/Historial";
import Login from "./pages/Login";
import MisCitas from "./pages/MisCitas";
import Perfil from "./pages/Perfil";
import Tratamientos from "./pages/Tratamientos";

function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <main className="login-wrap">
      <section className="card login-card">{children}</section>
    </main>
  );
}

// Gate for the patient area: session required, and the patient record
// must be linked (portal-link) before any screen renders.
function RequirePatient({ children }: { children: ReactNode }) {
  const { loading, session, patient, linkError, retryLink } = useAuth();

  if (loading) {
    return (
      <CenteredCard>
        <p className="muted">Cargando…</p>
      </CenteredCard>
    );
  }
  if (!session) return <Navigate to="/mi-cuenta/login" replace />;
  if (linkError) {
    return (
      <CenteredCard>
        <h1>No pudimos abrir tu cuenta</h1>
        <p className="muted">
          Algo falló al vincular tu perfil. Inténtalo de nuevo; si sigue
          fallando, contáctanos.
        </p>
        <button type="button" className="btn primary" onClick={retryLink}>
          Reintentar
        </button>
      </CenteredCard>
    );
  }
  if (!patient) {
    return (
      <CenteredCard>
        <p className="muted">Preparando tu cuenta…</p>
      </CenteredCard>
    );
  }
  return <>{children}</>;
}

// Panel placeholder — the real dashboard is Phase 5. The admin role
// gate (app_metadata.role) is already enforced here.
function PanelGate() {
  const { loading, session, user } = useAuth();
  if (loading) {
    return (
      <CenteredCard>
        <p className="muted">Cargando…</p>
      </CenteredCard>
    );
  }
  if (!session) return <Navigate to="/mi-cuenta/login" replace />;
  if (!isAdmin(user)) {
    return (
      <CenteredCard>
        <h1>Acceso restringido</h1>
        <p className="muted">Esta área es solo para el equipo del centro.</p>
      </CenteredCard>
    );
  }
  return (
    <CenteredCard>
      <h1>Panel</h1>
      <p className="muted">El panel de administración llega en la siguiente fase.</p>
    </CenteredCard>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/mi-cuenta/login" element={<Login />} />
        <Route
          path="/mi-cuenta"
          element={
            <RequirePatient>
              <Layout />
            </RequirePatient>
          }
        >
          <Route index element={<MisCitas />} />
          <Route path="historial" element={<Historial />} />
          <Route path="tratamientos" element={<Tratamientos />} />
          <Route path="perfil" element={<Perfil />} />
        </Route>
        <Route path="/panel/*" element={<PanelGate />} />
        <Route path="*" element={<Navigate to="/mi-cuenta" replace />} />
      </Routes>
    </AuthProvider>
  );
}
