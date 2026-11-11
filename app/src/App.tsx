import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider, isAdmin, useAuth } from "./auth";
import Layout from "./components/Layout";
import CompletarPerfil from "./pages/CompletarPerfil";
import Historial from "./pages/Historial";
import Login from "./pages/Login";
import MisCitas from "./pages/MisCitas";
import Perfil from "./pages/Perfil";
import Tratamientos from "./pages/Tratamientos";
import Agenda from "./panel/Agenda";
import Citas from "./panel/Citas";
import ClienteDetalle from "./panel/ClienteDetalle";
import Clientes from "./panel/Clientes";
import Dashboard from "./panel/Dashboard";
import Horario from "./panel/Horario";
import NuevaCita from "./panel/NuevaCita";
import PanelLayout from "./panel/PanelLayout";
import Reportes from "./panel/Reportes";
import ServiciosPanel from "./panel/Servicios";
import { SkeletonShell } from "./components/Skeleton";
import { profileComplete } from "./lib/profile";

function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <main className="login-wrap">
      <section className="card login-card">{children}</section>
    </main>
  );
}

// Gate for the patient area: session required, and the patient record
// must be linked (portal-link) before any screen renders. Linking is
// triggered here (not on any session) so Panel-only admin sessions
// never create a patient row for the staff account.
function RequirePatient({ children }: { children: ReactNode }) {
  const { loading, session, patient, linkError, retryLink, ensureLinked } =
    useAuth();

  useEffect(() => {
    if (session && !patient) ensureLinked();
  }, [session, patient, ensureLinked]);

  if (loading) {
    return <SkeletonShell />;
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
    return <SkeletonShell />;
  }
  return <>{children}</>;
}

// Completeness gate: a linked patient whose record still has the
// email-prefix placeholder name or no phone (a portal-first signup)
// is sent to the one-time CompletarPerfil step before using the
// portal. Booking-created patients are already complete.
function RequireCompleteProfile({ children }: { children: ReactNode }) {
  const { patient } = useAuth();
  if (patient && !profileComplete(patient)) {
    return <Navigate to="/mi-cuenta/completar-perfil" replace />;
  }
  return <>{children}</>;
}

// Panel gate (Phase 5): session + admin role in app_metadata. Data
// access behind it is RLS (admin policies), so the gate is UX, not the
// security boundary.
function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, session, user } = useAuth();
  if (loading) {
    return <SkeletonShell />;
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
  return <>{children}</>;
}

function ClienteRedirect() {
  const { id } = useParams();
  return <Navigate to={`/panel/pacientes/${id ?? ""}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/mi-cuenta/login" element={<Login />} />
        <Route
          path="/mi-cuenta/completar-perfil"
          element={
            <RequirePatient>
              <CompletarPerfil />
            </RequirePatient>
          }
        />
        <Route
          path="/mi-cuenta"
          element={
            <RequirePatient>
              <RequireCompleteProfile>
                <Layout />
              </RequireCompleteProfile>
            </RequirePatient>
          }
        >
          <Route index element={<MisCitas />} />
          <Route path="historial" element={<Historial />} />
          <Route path="tratamientos" element={<Tratamientos />} />
          <Route path="perfil" element={<Perfil />} />
        </Route>
        <Route
          path="/panel"
          element={
            <RequireAdmin>
              <PanelLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="citas" element={<Citas />} />
          <Route path="pacientes" element={<Clientes />} />
          <Route path="pacientes/:id" element={<ClienteDetalle />} />
          <Route
            path="clientes"
            element={<Navigate to="/panel/pacientes" replace />}
          />
          <Route path="clientes/:id" element={<ClienteRedirect />} />
          <Route path="nueva-cita" element={<NuevaCita />} />
          <Route path="servicios" element={<ServiciosPanel />} />
          <Route path="horario" element={<Horario />} />
          <Route path="reportes" element={<Reportes />} />
        </Route>
        <Route path="*" element={<Navigate to="/mi-cuenta" replace />} />
      </Routes>
    </AuthProvider>
  );
}
