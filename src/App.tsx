import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import MapaPage from "./pages/MapaPage";
import AdminEquipos from "./pages/AdminEquipos";
import AdminSectores from "./pages/AdminSectores";
import AdminCuarteles from "./pages/AdminCuarteles";

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: "flex", height: "100vh" }}>
        <nav style={navStyle}>
          <h2 style={{ color: "#fff", fontSize: 15, margin: "0 0 16px", padding: "0 8px" }}>
            Siracusa 2025
          </h2>
          <NavLink to="/" end style={linkStyle}>
            Mapa
          </NavLink>
          <NavLink to="/admin/equipos" style={linkStyle}>
            Equipos
          </NavLink>
          <NavLink to="/admin/sectores" style={linkStyle}>
            Sectores
          </NavLink>
          <NavLink to="/admin/cuarteles" style={linkStyle}>
            Cuarteles
          </NavLink>
        </nav>
        <main style={{ flex: 1, overflow: "auto" }}>
          <Routes>
            <Route path="/" element={<MapaPage />} />
            <Route path="/admin/equipos" element={<AdminEquipos />} />
            <Route path="/admin/sectores" element={<AdminSectores />} />
            <Route path="/admin/cuarteles" element={<AdminCuarteles />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

const navStyle: React.CSSProperties = {
  width: 180,
  backgroundColor: "#1a237e",
  padding: "16px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  flexShrink: 0,
};

function linkStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    color: "#fff",
    textDecoration: "none",
    padding: "8px 12px",
    borderRadius: 6,
    fontSize: 14,
    display: "block",
    backgroundColor: isActive ? "rgba(255,255,255,0.15)" : "transparent",
  };
}
