export function App() {
  return (
    <div className="app">
      <header className="top-nav">
        <button className="nav-menu-btn" aria-label="Menu">☰</button>
        <span className="app-title">Recipe Book</span>
        <button className="undo-btn" aria-label="Undo">↩ Undo</button>
      </header>
      <main className="page-content">
        <p className="placeholder">Loading your recipes…</p>
      </main>
    </div>
  );
}
