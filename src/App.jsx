import { Layers, Sparkles } from "lucide-react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import LayerEditor from "./LayerEditor.jsx";
import Compressor from "./compressor/Compressor.jsx";

/*
 * App
 * ---
 * Cada herramienta es una pagina con su propia URL:
 *   /editor     -> Editor de capas (Fase 1)
 *   /optimizer  -> Compressor + Optimizer (Fase 2)
 *
 * Al usar rutas reales, recargar la pagina mantiene la herramienta activa.
 */

const TABS = [
  { to: "/editor", label: "Editor de capas", icon: Layers },
  { to: "/optimizer", label: "Compressor + Optimizer", icon: Sparkles },
];

function Nav() {
  return (
    <nav className="app-tabs">
      {TABS.map((t) => {
        const Icon = t.icon;
        return (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `app-tab ${isActive ? "app-tab-active" : ""}`
            }
          >
            <Icon size={16} />
            {t.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-root">
        <style>{appStyles}</style>
        <Nav />
        <div className="app-view">
          <Routes>
            {/* la raiz redirige al editor */}
            <Route path="/" element={<Navigate to="/editor" replace />} />
            <Route path="/editor" element={<LayerEditor />} />
            <Route path="/optimizer" element={<Compressor />} />
            {/* cualquier ruta desconocida vuelve al editor */}
            <Route path="*" element={<Navigate to="/editor" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

const appStyles = `
  .app-root { --bg:#15171c; --panel:#1d2027; --line:#2a2e38; --txt:#e6e8ec;
    --muted:#8b90a0; --accent:#4d9d84;
    font-family:'DM Sans',system-ui,sans-serif; }
  .app-tabs { display:flex; gap:4px; margin-bottom:16px; }
  .app-tab { display:inline-flex; align-items:center; gap:8px; padding:10px 16px;
    background:transparent; border:0; border-bottom:2px solid transparent;
    color:var(--muted); font-size:14px; font-weight:500; cursor:pointer;
    font-family:inherit; text-decoration:none; }
  .app-tab:hover { color:var(--txt); }
  .app-tab-active { color:var(--accent); border-bottom-color:var(--accent); }
  .app-view { }
`;