import type { CSSProperties } from "react";

// Loading skeletons that mirror the real layouts, so pages keep their
// shape while data loads instead of showing a bare "Cargando…" line.

export function Skl({
  w = "100%",
  h = 14,
  r = 7,
  style,
}: {
  w?: string | number;
  h?: number;
  r?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className="skl"
      style={{ width: w, height: h, borderRadius: r, ...style }}
      aria-hidden
    />
  );
}

export function SkeletonShell() {
  return (
    <div className="shell" aria-busy="true" aria-label="Cargando">
      <aside className="sidebar">
        <Skl w="78%" h={34} r={8} />
        <div style={{ display: "grid", gap: 12, marginTop: 26 }}>
          <Skl h={18} />
          <Skl h={18} />
          <Skl h={18} />
          <Skl h={18} />
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <Skl w={150} h={22} />
        </header>
        <main className="content">
          <SkeletonCards count={2} />
        </main>
      </div>
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Cargando">
      {Array.from({ length: count }, (_, i) => (
        <section key={i} className="card skl-card">
          <div className="skl-row">
            <Skl w="46%" h={18} />
            <Skl w={86} h={22} r={11} />
          </div>
          <Skl w="68%" h={13} style={{ marginTop: 12 }} />
          <Skl w="52%" h={13} style={{ marginTop: 8 }} />
          <div className="skl-row" style={{ marginTop: 16 }}>
            <Skl w={110} h={34} r={10} />
            <Skl w={110} h={34} r={10} />
          </div>
        </section>
      ))}
    </div>
  );
}

export function SkeletonKpis({ count = 4 }: { count?: number }) {
  return (
    <div className="kpis" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: count }, (_, i) => (
        <section key={i} className="card kpi skl-card">
          <Skl w="55%" h={12} />
          <Skl w="70%" h={26} style={{ marginTop: 10 }} />
          <Skl w="40%" h={11} style={{ marginTop: 8 }} />
        </section>
      ))}
    </div>
  );
}

export function SkeletonForm({ rows = 4 }: { rows?: number }) {
  return (
    <section className="card form-card" aria-busy="true" aria-label="Cargando">
      <div style={{ display: "grid", gap: 16 }}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i}>
            <Skl w={110} h={12} />
            <Skl h={40} r={10} style={{ marginTop: 6 }} />
          </div>
        ))}
        <Skl w={150} h={38} r={10} />
      </div>
    </section>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <section className="card skl-card" aria-busy="true" aria-label="Cargando">
      <div style={{ display: "grid", gap: 14 }}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skl-row">
            <Skl w="34%" h={14} />
            <Skl w="18%" h={14} />
            <Skl w="14%" h={14} />
            <Skl w={64} h={26} r={8} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function SkeletonStrip() {
  return (
    <div className="week-strip" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="skl" style={{ height: 64, borderRadius: 12 }} />
      ))}
    </div>
  );
}
