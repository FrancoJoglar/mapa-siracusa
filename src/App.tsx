import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import MapaPage from "./pages/MapaPage";
import AdminEquipos from "./pages/AdminEquipos";
import AdminSectores from "./pages/AdminSectores";
import AdminCuarteles from "./pages/AdminCuarteles";
import AdminTuberias from "./pages/AdminTuberias";
import AdminValvulas from "./pages/AdminValvulas";
import LoginPage from "./pages/LoginPage";

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function AppInner() {
  const { user, loading, signOut, isAdmin } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p style={{ fontSize: 16, color: "#666" }}>Cargando...</p>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <BrowserRouter>
      <div style={{ display: "flex", height: "100vh" }}>
        <nav style={navStyle}>
          <h2 style={{ color: "#fff", fontSize: 15, margin: "0 0 16px", padding: "0 8px" }}>
            Siracusa 2025
          </h2>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 12, padding: "0 8px" }}>
            {user.email}
          </div>
          <NavLink to="/" end style={linkStyle}>
            Mapa
          </NavLink>
          {isAdmin && <><NavLink to="/admin/equipos" style={linkStyle}>
            Equipos
          </NavLink>
          <NavLink to="/admin/sectores" style={linkStyle}>
            Sectores
          </NavLink>
          <NavLink to="/admin/cuarteles" style={linkStyle}>
            Cuarteles
          </NavLink>
          <NavLink to="/admin/tuberias" style={linkStyle}>
            Tuberías
          </NavLink>
          <NavLink to="/admin/valvulas" style={linkStyle}>
            Válvulas
          </NavLink></>}
          <div style={{ flex: 1 }} />
          <button onClick={signOut} style={{
            color: "rgba(255,255,255,0.7)", background: "transparent",
            border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6,
            padding: "6px 12px", fontSize: 12, cursor: "pointer",
          }}>
            Cerrar sesión
          </button>
        </nav>
        <main style={{ flex: 1, overflow: "auto" }}>
          <Routes>
            <Route path="/" element={<MapaPage />} />
            <Route path="/admin/equipos" element={<AdminEquipos />} />
            <Route path="/admin/sectores" element={<AdminSectores />} />
            <Route path="/admin/cuarteles" element={<AdminCuarteles />} />
            <Route path="/admin/tuberias" element={<AdminTuberias />} />
            <Route path="/admin/valvulas" element={<AdminValvulas />} />
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
