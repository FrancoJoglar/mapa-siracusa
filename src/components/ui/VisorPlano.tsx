import { useState } from "react";
import { Document, Page } from "react-pdf";
import { pdfjs } from "react-pdf";
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  url: string;
  nombre: string;
  onClose: () => void;
}

export default function VisorPlano({ url, nombre, onClose }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  const containerStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 5000,
    backgroundColor: fullscreen ? "#000" : "rgba(0,0,0,0.5)",
    display: "flex", justifyContent: "center", alignItems: "center",
  };
  const modalStyle: React.CSSProperties = {
    background: "#f5f5f5", borderRadius: 8, overflow: "hidden",
    display: "flex", flexDirection: "column",
    width: fullscreen ? "100vw" : "90vw",
    height: fullscreen ? "100vh" : "90vh",
    maxWidth: fullscreen ? "100vw" : 1000,
  };
  const headerStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "#fff", padding: "10px 16px", borderBottom: "1px solid #ddd",
    fontSize: 14, fontWeight: 600,
  };
  const btn: React.CSSProperties = {
    background: "none", border: "1px solid #ccc", borderRadius: 4,
    padding: "4px 10px", cursor: "pointer", fontSize: 12, marginLeft: 6,
  };

  return (
    <div style={containerStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span title={nombre}>{nombre}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {numPages > 0 && (
              <span style={{ fontSize: 12, color: "#666", marginRight: 8 }}>
                {page} / {numPages}
              </span>
            )}
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={btn}>◀</button>
            <button disabled={page >= numPages} onClick={() => setPage(p => Math.min(numPages, p + 1))} style={btn}>▶</button>
            <a href={url} download style={{ ...btn, textDecoration: "none", color: "#333" }}>Descargar</a>
            <button onClick={() => setFullscreen(v => !v)} style={btn}>
              {fullscreen ? "Ventana" : "Completo"}
            </button>
            <button onClick={onClose} style={{ ...btn, color: "#c62828" }}>Cerrar</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: 16 }}>
          <Document
            file={url}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={<p style={{ color: "#666" }}>Cargando plano...</p>}
            error={<p style={{ color: "#c62828" }}>Error al cargar el plano</p>}
          >
            <Page pageNumber={page} width={fullscreen ? window.innerWidth - 40 : Math.min(window.innerWidth * 0.85, 900)} />
          </Document>
        </div>
      </div>
    </div>
  );
}
