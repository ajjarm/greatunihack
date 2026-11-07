const scenarios = [
  ["scn_1_impulse", "Late-night trainers under a scarcity banner"],
  ["scn_2_essential", "Paracetamol and a prescription top-up"],
  ["scn_3_duplicate", "Headphones plus a third phone case"],
  ["scn_4_fine", "A £6 course reader"],
  ["scn_5_steam", "A Steam sale on a Friday night"],
];

const dashboard = ["/home", "/purchases", "/waiting", "/insights", "/profile"];

const section: React.CSSProperties = { marginTop: "var(--space-6)" };
const muted: React.CSSProperties = { color: "var(--color-text-muted)" };
const link: React.CSSProperties = { color: "var(--color-accent)" };
const list: React.CSSProperties = { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--space-2)" };

export default function Index() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-8) var(--space-4)", fontFamily: "var(--font-sans)" }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>Regret Engine — dev index</h1>
      <p style={muted}>Fixture mode. All routes read the in-memory store seeded from data/.</p>

      <section style={section}>
        <h2 style={{ fontSize: 18 }}>Nudge scenarios</h2>
        <ul style={list}>
          {scenarios.map(([id, title]) => (
            <li key={id}>
              <a style={link} href={`/nudge?scenario=${id}`}>
                /nudge?scenario={id}
              </a>{" "}
              <span style={muted}>{title}</span>
            </li>
          ))}
        </ul>
      </section>

      <section style={section}>
        <h2 style={{ fontSize: 18 }}>API</h2>
        <ul style={list}>
          <li>
            <a style={link} href="/api/health">/api/health</a>
          </li>
          <li>
            <a style={link} href="/api/scenarios">/api/scenarios</a>
          </li>
          <li>
            <a style={link} href="/api/home">/api/home</a>
          </li>
          <li>
            <a style={link} href="/api/insights">/api/insights</a>
          </li>
        </ul>
      </section>

      <section style={section}>
        <h2 style={{ fontSize: 18 }}>Dashboard</h2>
        <p style={muted}>Built by the dashboard lane; these links 404 until that lands.</p>
        <ul style={list}>
          {dashboard.map((path) => (
            <li key={path}>
              <a style={link} href={path}>{path}</a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
