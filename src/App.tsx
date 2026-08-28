import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import MapaPage from "./pages/MapaPage";
import AdminEquipos from "./pages/AdminEquipos";
import AdminSectores from "./pages/AdminSectores";
import AdminCuarteles from "./pages/AdminCuarteles";
import RiegoPage from "./pages/RiegoPage";
import LoginPage from "./pages/LoginPage";
import { useState, useEffect } from "react";

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function AppInner() {
  const { user, loading, signOut, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close sidebar on route change in mobile
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

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
      <div style={{ display: "flex", height: "100vh", position: "relative" }}>
        {/* Mobile hamburger */}
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              position: "fixed", top: 10, left: 10, zIndex: 1100,
              background: "#1a237e", color: "#fff", border: "none",
              borderRadius: 8, padding: "8px 12px", fontSize: 18, cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            {sidebarOpen ? "✕" : "☰"}
          </button>
        )}

        {/* Sidebar */}
        <nav style={{
          ...navStyle,
          ...(isMobile ? {
            position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 1050,
            transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.3s ease",
            width: 240,
          } : {}),
        }}>
          <h2 style={{ color: "#fff", fontSize: 15, margin: "0 0 16px", padding: "0 8px" }}>
            Siracusa 2025
          </h2>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 12, padding: "0 8px" }}>
            {user.email}
          </div>
          <NavLink to="/" end style={linkStyle} onClick={() => isMobile && setSidebarOpen(false)}>
            Mapa
          </NavLink>
          <NavLink to="/riego" style={linkStyle} onClick={() => isMobile && setSidebarOpen(false)}>
            Riego
          </NavLink>
          {isAdmin && <><NavLink to="/admin/equipos" style={linkStyle} onClick={() => isMobile && setSidebarOpen(false)}>
            Equipos
          </NavLink>
          <NavLink to="/admin/sectores" style={linkStyle} onClick={() => isMobile && setSidebarOpen(false)}>
            Sectores
          </NavLink>
          <NavLink to="/admin/cuarteles" style={linkStyle} onClick={() => isMobile && setSidebarOpen(false)}>
            Cuarteles
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

        {/* Backdrop for mobile sidebar */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
              zIndex: 1040,
            }}
          />
        )}

        <main style={{ flex: 1, overflow: "auto" }}>
          <Routes>
            <Route path="/" element={<MapaPage />} />
            <Route path="/riego" element={<RiegoPage />} />
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
