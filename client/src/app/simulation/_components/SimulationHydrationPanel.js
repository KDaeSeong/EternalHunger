export default function SimulationHydrationPanel() {
  return (
    <main className="simulation-page simulation-page-hydrating">
      <div className="simulation-hydration-panel" role="status" aria-live="polite">
        <div className="simulation-hydration-logo">ETERNAL HUNGER</div>
        <div className="simulation-hydration-text">Loading simulation...</div>
      </div>
    </main>
  );
}
