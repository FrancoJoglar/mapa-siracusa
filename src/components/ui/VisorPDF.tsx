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
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [rendering, setRendering] = useState(false);
  const renderTaskRef = useRef<any>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);

  const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk";

  // Fetch PDF document
  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(url, { headers: { "apikey": ANON, "Authorization": "Bearer " + ANON } })
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); })
      .then(buf => pdfjsLib.getDocument({ data: buf }).promise)
      .then(pdfDoc => { setPdf(pdfDoc); setNumPages(pdfDoc.numPages); setLoading(false); })
      .catch(e => { console.error("PDF load error:", e); setError(true); setLoading(false); });
  }, [url]);

  // Render current page to canvas
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    setRendering(true);

    (async () => {
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch {}
      }
      try {
        const page = await pdf.getPage(pageNum);
        // Calculate viewport at current scale
        let viewport = page.getViewport({ scale: 1, rotation });
        // Fix: ensure we use the correct scale
        viewport = page.getViewport({ scale, rotation });

        const canvas = canvasRef.current!;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = viewport.width + "px";
        canvas.style.height = viewport.height + "px";

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.scale(dpr, dpr);

        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        if (!cancelled) setRendering(false);
      } catch (e: any) {
        if (e?.name !== "RenderingCancelledException") console.error("Render error:", e);
        if (!cancelled) setRendering(false);
      }
    })();

    return () => { cancelled = true; if (renderTaskRef.current) try { renderTaskRef.current.cancel(); } catch {} };
  }, [pdf, pageNum, scale, rotation]);

  // Auto-fit on first load
  useEffect(() => {
    if (!pdf || !containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 32;
    if (containerWidth > 0) {
      pdf.getPage(pageNum).then((page: any) => {
        const vp = page.getViewport({ scale: 1, rotation });
        const fitScale = Math.min(containerWidth / vp.width, 2);
        setScale(Math.max(0.5, Math.min(fitScale, 3)));
      });
    }
  }, [pdf, pageNum]);

  const zoomIn = () => setScale(s => Math.min(6, Math.round((s + 0.25) * 100) / 100));
  const zoomOut = () => setScale(s => Math.max(0.25, Math.round((s - 0.25) * 100) / 100));
  const zoomTo = (s: number) => setScale(s);

  // Drag to pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDragging.current = true;
    const el = scrollRef.current;
    dragStart.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    el.style.cursor = "grabbing";
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollLeft = dragStart.current.scrollLeft - (e.clientX - dragStart.current.x);
    el.scrollTop = dragStart.current.scrollTop - (e.clientY - dragStart.current.y);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (scrollRef.current) scrollRef.current.style.cursor = "grab";
  };

  // Mouse wheel zoom (Ctrl+scroll)
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    }
  };

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
    padding: "8px 16px", borderBottom: "1px solid #ddd", fontSize: 14, fontWeight: 600, flexShrink: 0,
  };
  const btn: React.CSSProperties = {
    background: "none", border: "1px solid #ccc", borderRadius: 4,
    padding: "4px 10px", cursor: "pointer", fontSize: 12, marginLeft: 4,
  };

  return (
    <div style={c} onClick={onClose}>
      <div style={m} onClick={e => e.stopPropagation()}>
        <div style={h}>
          <span>{nombre}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {numPages > 0 && <>
              <span style={{ fontSize: 12, color: "#666" }}>pág {pageNum}/{numPages}</span>
              <button disabled={pageNum <= 1} onClick={() => setPageNum(p => Math.max(1, p - 1))} style={btn}>◀</button>
              <button disabled={pageNum >= numPages} onClick={() => setPageNum(p => Math.min(numPages, p + 1))} style={btn}>▶</button>
              <span style={{ width: 1, height: 20, background: "#ddd", margin: "0 4px" }} />
              <button onClick={zoomIn} style={btn} title="Zoom in">🔍+</button>
              <button onClick={zoomOut} style={btn} title="Zoom out">🔍−</button>
              <span style={{ fontSize: 11, color: "#666", minWidth: 36, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
              <button onClick={() => zoomTo(0.5)} style={{ ...btn, fontWeight: scale === 0.5 ? 700 : 400 }}>50%</button>
              <button onClick={() => zoomTo(1)} style={{ ...btn, fontWeight: scale === 1 ? 700 : 400 }}>100%</button>
              <button onClick={() => zoomTo(2)} style={{ ...btn, fontWeight: scale === 2 ? 700 : 400 }}>200%</button>
              <button onClick={() => zoomTo(3)} style={{ ...btn, fontWeight: scale === 3 ? 700 : 400 }}>300%</button>
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
        <div ref={(el) => { containerRef.current = el; scrollRef.current = el; }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel} style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 16, background: "#f0f0f0", cursor: "grab" }}>
          {loading && <p style={{ padding: 40, color: "#666" }}>Cargando plano...</p>}
          {error && (
            <div style={{ textAlign: "center", padding: 40 }}>
              <p style={{ color: "#c62828", marginBottom: 12 }}>No se pudo cargar el plano.</p>
              <a href={url} target="_blank" rel="noopener" style={{ color: "#1565c0", fontWeight: 500 }}>Abrir en nueva pestaña</a>
            </div>
          )}
          {!loading && !error && (
            <div style={{ position: "relative", minHeight: 200 }}>
              {rendering && <p style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", background: "rgba(255,255,255,0.9)", padding: "4px 12px", borderRadius: 4, fontSize: 12, color: "#666", zIndex: 1 }}>Renderizando...</p>}
              <canvas ref={canvasRef} style={{ display: "block", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
