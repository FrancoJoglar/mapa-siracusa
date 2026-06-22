import { useState } from "react";

interface Props {
  url: string;
  nombre: string;
  onClose: () => void;
}

export default function VisorPlano({ url, nombre, onClose }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState(false);

  const c: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 5000,
    backgroundColor: fullscreen ? "#000" : "rgba(0,0,0,0.5)",
    display: "flex", justifyContent: "center", alignItems: "center",
  };
  const m: React.CSSProperties = {
    background: "#fff", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column",
    width: fullscreen ? "100vw" : "90vw", height: fullscreen ? "100vh" : "90vh",
    maxWidth: fullscreen ? "100vw" : 1000,
  };
  const h: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 16px", borderBottom: "1px solid #ddd", fontSize: 14, fontWeight: 600,
  };
  const b: React.CSSProperties = {
    background: "none", border: "1px solid #ccc", borderRadius: 4,
    padding: "4px 10px", cursor: "pointer", fontSize: 12, marginLeft: 6,
  };

  const embedUrl = url + "#view=FitH&toolbar=1&navpanes=1";

  return (
    <div style={c} onClick={onClose}>
      <div style={m} onClick={e => e.stopPropagation()}>
        <div style={h}>
          <span title={nombre}>{nombre}</span>
          <div>
            <a href={url} download style={{ ...b, textDecoration: "none", color: "#333" }}>Descargar</a>
            <button onClick={() => setFullscreen(v => !v)} style={b}>
              {fullscreen ? "Ventana" : "Completo"}
            </button>
            <button onClick={onClose} style={{ ...b, color: "#c62828" }}>Cerrar</button>
          </div>
        </div>
        <div style={{ flex: 1, position: "relative", background: "#f0f0f0" }}>
          {error ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <p style={{ color: "#c62828" }}>No se pudo cargar el plano.</p>
              <a href={url} target="_blank" rel="noopener" style={{ color: "#1565c0" }}>Abrir en nueva pestaña</a>
            </div>
          ) : (
            <embed src={embedUrl} type="application/pdf" style={{ width: "100%", height: "100%" }} onError={() => setError(true)} />
          )}
        </div>
      </div>
    </div>
  );
}
