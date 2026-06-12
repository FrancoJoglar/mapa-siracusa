import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Completá email y contraseña"); return; }
    setBusy(true);
    const { error: err } = await signIn(email, password);
    setBusy(false);
    if (err) setError(err.message === "Invalid login credentials"
      ? "Email o contraseña incorrectos"
      : err.message);
  };

  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center",
      height: "100vh", backgroundColor: "#f5f5f5",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#fff", padding: 40, borderRadius: 12,
        boxShadow: "0 2px 12px rgba(0,0,0,0.1)", width: 360,
      }}>
        <h1 style={{ margin: "0 0 24px", fontSize: 22, color: "#1a237e" }}>
          Siracusa 2025
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#666" }}>
          Iniciá sesión para acceder al mapa
        </p>

        <input
          type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle} autoFocus
        />
        <input
          type="password" placeholder="Contraseña" value={password}
          onChange={e => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && <p style={{ color: "#c62828", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}

        <button type="submit" disabled={busy} style={{
          ...inputStyle, background: "#1a237e", color: "#fff",
          fontWeight: 600, cursor: busy ? "wait" : "pointer", border: "none",
        }}>
          {busy ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", padding: "10px 14px",
  fontSize: 14, borderRadius: 6, border: "1px solid #ddd",
  marginBottom: 12, boxSizing: "border-box",
};
