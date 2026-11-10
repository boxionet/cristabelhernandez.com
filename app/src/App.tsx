import { Navigate, Route, Routes } from "react-router-dom";

// Phase 1 scaffold: routing skeleton for the two gated areas.
// Real screens arrive in Phase 4 (Mi Cuenta) and Phase 5 (Panel),
// following the approved prototype "Diseño Mi Cuenta y Panel".

function AreaPlaceholder({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#edf0f5",
        fontFamily: "system-ui, sans-serif",
        color: "#3e4c35",
        padding: "1.5rem",
      }}
    >
      <section
        style={{
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 10px 30px rgba(62,76,53,.10)",
          padding: "2rem 2.5rem",
          textAlign: "center",
          maxWidth: 420,
        }}
      >
        <h1 style={{ margin: "0 0 .5rem", fontSize: "1.5rem" }}>{title}</h1>
        <p style={{ margin: 0, color: "#6b7263", lineHeight: 1.5 }}>{subtitle}</p>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/mi-cuenta/*"
        element={
          <AreaPlaceholder
            title="Mi Cuenta"
            subtitle="El portal de pacientes está en construcción. Aquí podrás ver, cancelar y reprogramar tus citas."
          />
        }
      />
      <Route
        path="/panel/*"
        element={
          <AreaPlaceholder
            title="Panel"
            subtitle="El panel de administración está en construcción."
          />
        }
      />
      <Route path="*" element={<Navigate to="/mi-cuenta/" replace />} />
    </Routes>
  );
}
