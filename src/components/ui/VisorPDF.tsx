import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface Props {
  url: string;
  nombre: string;
  onClose: () => void;
}

export default function VisorPDF({ url, nombre, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const renderTaskRef = useRef<any>(null);

  // Fetch PDF
  useEffect(() => {
    setLoading(true);
    setError(false);
    const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk";
    fetch(url, { headers: { "apikey": ANON, "Authorization": "Bearer " + ANON } })
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); })
      .then(buf => pdfjsLib.getDocument({ data: buf }).promise)
      .then(pdfDoc => { setPdf(pdfDoc); setNumPages(pdfDoc.numPages); setLoading(false); })
      .catch(e => { console.error("PDF load error:", e); setError(true); setLoading(false); });
  }, [url]);

  // Render current page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch {}
      }
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        if (cancelled) return;
      } catch (e: any) {
        if (e?.name !== "RenderingCancelledException") console.error("Render error:", e);
      }
    })();
    return () => { cancelled = true; if (renderTaskRef.current) try { renderTaskRef.current.cancel(); } catch {} };
  }, [pdf, pageNum, scale, rotation]);

  const containerStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 5000,
    backgroundColor: fullscreen ? "#000" : "rgba(0,0,0,0.5)",
    display: "flex", justifyContent: "center", alignItems: "center",
  };
  const modalStyle: React.CSSProperties = {
    background: "#fff", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column",
    width: fullscreen ? "100vw" : "90vw", height: fullscreen ? "100vh" : "90vh",
    maxWidth: fullscreen ? "100vw" : 1000,
  };
  const headerStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 16px", borderBottom: "1px solid #ddd", fontSize: 14, fontWeight: 600, flexShrink: 0,
  };
  const btn: React.CSSProperties = {
    background: "none", border: "1px solid #ccc", borderRadius: 4,
    padding: "4px 10px", cursor: "pointer", fontSize: 12, marginLeft: 4,
  };

  return (
    <div style={containerStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span>{nombre}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {!loading && numPages > 0 && <>
              <span style={{ fontSize: 12, color: "#666" }}>pág {pageNum}/{numPages}</span>
              <button disabled={pageNum <= 1} onClick={() => setPageNum(p => Math.max(1, p - 1))} style={btn}>◀</button>
              <button disabled={pageNum >= numPages} onClick={() => setPageNum(p => Math.min(numPages, p + 1))} style={btn}>▶</button>
              <span style={{ width: 1, height: 20, background: "#ddd", margin: "0 4px" }} />
              <button onClick={() => setScale(s => Math.min(3, s + 0.25))} style={btn} title="Zoom in">🔍+</button>
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} style={btn} title="Zoom out">🔍−</button>
              <span style={{ fontSize: 11, color: "#666", minWidth: 32, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(1)} style={{ ...btn, fontWeight: scale === 1 ? 700 : 400 }}>100%</button>
              <button onClick={() => setScale(1.5)} style={btn}>150%</button>
              <span style={{ width: 1, height: 20, background: "#ddd", margin: "0 4px" }} />
              <button onClick={() => setRotation(r => (r + 90) % 360)} style={btn} title="Rotar der">🔄 +90°</button>
              <button onClick={() => setRotation(r => (r - 90 + 360) % 360)} style={btn} title="Rotar izq">🔄 −90°</button>
            </>}
            <span style={{ width: 1, height: 20, background: "#ddd", margin: "0 4px" }} />
            <a href={url} download style={{ ...btn, textDecoration: "none", color: "#333" }}>Descargar</a>
            <button onClick={() => setFullscreen(v => !v)} style={btn}>{fullscreen ? "Ventana" : "Completo"}</button>
            <button onClick={onClose} style={{ ...btn, color: "#c62828", fontWeight: 600 }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, background: "#f0f0f0" }}>
          {loading && <p style={{ padding: 40, color: "#666" }}>Cargando plano...</p>}
          {error && (
            <div style={{ textAlign: "center", padding: 40 }}>
              <p style={{ color: "#c62828", marginBottom: 12 }}>No se pudo cargar el plano.</p>
              <a href={url} target="_blank" rel="noopener" style={{ color: "#1565c0", fontWeight: 500 }}>Abrir en nueva pestaña</a>
            </div>
          )}
          <canvas ref={canvasRef} style={{ maxWidth: "100%", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }} />
        </div>
      </div>
    </div>
  );
}
