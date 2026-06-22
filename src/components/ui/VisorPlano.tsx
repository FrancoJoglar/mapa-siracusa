import { useState, useEffect } from "react";

interface Props {
  url: string;
  nombre: string;
  onClose: () => void;
}

export default function VisorPlano({ url, nombre, onClose }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const [blobUrl, setBlobUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(url)
      .then(res => res.blob())
      .then(blob => {
        setBlobUrl(URL.createObjectURL(blob));
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [url]);

  const containerStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 5000,
    backgroundColor: fullscreen ? "#000" : "rgba(0,0,0,0.5)",
    display: "flex", justifyContent: "center", alignItems: "center",
  };
  const modalStyle: React.CSSProperties = {
    background: "#fff", borderRadius: 8, overflow: "hidden",
    display: "flex", flexDirection: "column",
    width: fullscreen ? "100vw" : "90vw",
    height: fullscreen ? "100vh" : "90vh",
    maxWidth: fullscreen ? "100vw" : 1000,
    maxHeight: fullscreen ? "100vh" : "90vh",
  };
  const headerStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 16px", borderBottom: "1px solid #ddd",
    fontSize: 14, fontWeight: 600,
  };
  const btnStyle: React.CSSProperties = {
    background: "none", border: "1px solid #ccc", borderRadius: 4,
    padding: "4px 10px", cursor: "pointer", fontSize: 12, marginLeft: 6,
  };

  return (
    <div style={containerStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span title={nombre}>{nombre}</span>
          <div>
            <a href={url} download style={{ ...btnStyle, textDecoration: "none", color: "#333" }}>Descargar</a>
            <button onClick={() => setFullscreen(v => !v)} style={btnStyle}>
              {fullscreen ? "Ventana" : "Pantalla completa"}
            </button>
            <button onClick={onClose} style={{ ...btnStyle, color: "#c62828" }}>Cerrar</button>
          </div>
        </div>
        <div style={{ flex: 1, position: "relative" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#666", fontSize: 14 }}>Cargando plano...</div>
          ) : blobUrl ? (
            <iframe src={blobUrl} style={{ width: "100%", height: "100%", border: "none" }} title={nombre} />
          ) : (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#c62828", fontSize: 14 }}>
              No se pudo cargar el plano. <a href={url} target="_blank" rel="noopener" style={{ marginLeft: 4 }}>Abrir en nueva pestaña</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
