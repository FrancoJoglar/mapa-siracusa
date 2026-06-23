import { useState, useEffect } from "react";
import { Document, Page } from "react-pdf";

interface Props {
  url: string;
  nombre: string;
  onClose: () => void;
}

export default function VisorPlano({ url, nombre, onClose }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(); return r.arrayBuffer(); })
      .then(buf => { setPdfData(new Uint8Array(buf)); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [url]);

  const c: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 5000,
    backgroundColor: fullscreen ? "#000" : "rgba(0,0,0,0.5)",
    display: "flex", justifyContent: "center", alignItems: "center",
  };
  const m: React.CSSProperties = {
    background: "#fff", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column",
    width: fullscreen ? "100vw" : "90vw", height: fullscreen ? "100vh" : "90vh",
    maxWidth: fullscreen ? "100vw" : 1000, maxHeight: fullscreen ? "100vh" : "90vh",
  };
  const h: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 16px", borderBottom: "1px solid #ddd", fontSize: 14, fontWeight: 600, flexShrink: 0,
  };
  const b: React.CSSProperties = {
    background: "none", border: "1px solid #ccc", borderRadius: 4,
    padding: "4px 10px", cursor: "pointer", fontSize: 12, marginLeft: 4,
  };
  const btnActive: React.CSSProperties = { ...b, background: "#e3f2fd", border: "1px solid #1565c0" };

  return (
    <div style={c} onClick={onClose}>
      <div style={m} onClick={e => e.stopPropagation()}>
        <div style={h}>
          <span>{nombre}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {!!pdfData && <>
              <span style={{ fontSize: 12, color: "#666" }}>pág {page}/{numPages}</span>
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={b}>◀</button>
              <button disabled={page >= numPages} onClick={() => setPage(p => Math.min(numPages, p + 1))} style={b}>▶</button>
              <span style={{ width: 1, height: 20, background: "#ddd", margin: "0 4px" }} />
              <button onClick={() => setScale(s => Math.min(3, s + 0.25))} style={scale >= 3 ? btnActive : b} title="Zoom in">🔍+</button>
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} style={scale <= 0.5 ? btnActive : b} title="Zoom out">🔍−</button>
              <span style={{ fontSize: 11, color: "#666", minWidth: 32, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(1)} style={{ ...b, fontWeight: scale === 1 ? 700 : 400 }}>100%</button>
              <button onClick={() => setScale(1.5)} style={b}>150%</button>
              <span style={{ width: 1, height: 20, background: "#ddd", margin: "0 4px" }} />
              <button onClick={() => setRotation(r => (r + 90) % 360)} style={b} title="Rotar derecha">🔄 +90°</button>
              <button onClick={() => setRotation(r => (r - 90 + 360) % 360)} style={b} title="Rotar izquierda">🔄 −90°</button>
            </>}
            <span style={{ width: 1, height: 20, background: "#ddd", margin: "0 4px" }} />
            <a href={url} download style={{ ...b, textDecoration: "none", color: "#333" }}>Descargar</a>
            <button onClick={() => setFullscreen(v => !v)} style={b}>{fullscreen ? "Ventana" : "Completo"}</button>
            <button onClick={onClose} style={{ ...b, color: "#c62828", fontWeight: 600 }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: 16, background: "#f0f0f0" }}>
          {loading && <p style={{ padding: 40, color: "#666" }}>Cargando plano...</p>}
          {error && (
            <div style={{ textAlign: "center", padding: 40 }}>
              <p style={{ color: "#c62828" }}>No se pudo cargar el plano.</p>
              <a href={url} target="_blank" rel="noopener" style={{ color: "#1565c0" }}>Abrir en nueva pestaña</a>
            </div>
          )}
          {pdfData && (
            <Document
              file={{ data: pdfData }}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              loading={<p style={{ color: "#666" }}>Renderizando...</p>}
              error={<p style={{ color: "#c62828" }}>Error al renderizar el PDF</p>}
            >
              <Page
                pageNumber={page}
                scale={scale}
                rotate={rotation}
                width={fullscreen ? window.innerWidth - 40 : Math.min(window.innerWidth * 0.85, 900)}
              />
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
