import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface Props {
  planoUrl: string;
  equipoCodigo: string;
  initialCenter: [number, number];
  onSave: (data: { bounds: any; rotation: number; opacity: number; zoom_level: number }) => void;
  onClose: () => void;
  saved?: { bounds: { sw: [number, number]; ne: [number, number] }; rotation: number; opacity: number; zoom_level?: number } | null;
}

const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk";

export default function Georreferenciador({ planoUrl, equipoCodigo, initialCenter, onSave, onClose, saved }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageUrlRaw, setImageUrlRaw] = useState("");
  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [opacity, setOpacity] = useState(0.6);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [mapZoom, setMapZoom] = useState(15);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [transparentBg, setTransparentBg] = useState(true);
  const geoCenterRef = useRef<L.LatLng>(L.latLng(initialCenter[0], initialCenter[1]));
  const [, forceRender] = useState(0);
  const equipoNum = equipoCodigo.replace("Equipo ", "").trim();
  const dragInfo = useRef({ dragging: false, startLatLng: L.latLng(0, 0) });
  const nudgeRef = useRef<(dLat: number, dLng: number) => void>(() => {});
  const nudge = useCallback<(dLat: number, dLng: number) => void>((dLat: number, dLng: number) => {
    geoCenterRef.current = L.latLng(geoCenterRef.current.lat + dLat, geoCenterRef.current.lng + dLng);
    forceRender(n => n + 1);
  }, []);
  nudgeRef.current = nudge;

  // --- Init map ---
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const m = L.map(mapContainerRef.current, {
      center: initialCenter, zoom: 15, zoomControl: true,
      dragging: true, scrollWheelZoom: true, doubleClickZoom: true,
    });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "&copy; Esri",
    }).addTo(m);
    mapRef.current = m;
    setTimeout(() => { m.invalidateSize(); setReady(true); }, 200);
    return () => { m.remove(); mapRef.current = null; };
  }, []);

  // Keep plane anchored to geographic position when map moves/zooms
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const handler = () => {
      forceRender(n => n + 1);
      setMapZoom(m.getZoom());
    };
    m.on("move zoom", handler);
    setMapZoom(m.getZoom()); // initial value
    return () => { m.off("move zoom", handler); };
  }, [ready]);

  // --- Middle-click drag on the plane image (without pointer-events) ---
  useEffect(() => {
    const onMiddleDown = (e: MouseEvent) => {
      if (e.button !== 1) return; // only middle click
      const imgEl = document.querySelector(".geo-plano-img") as HTMLImageElement;
      if (!imgEl) return;
      const rect = imgEl.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      e.preventDefault();
      const m = mapRef.current;
      if (!m) return;
      dragInfo.current = { dragging: true, startLatLng: m.containerPointToLatLng([e.clientX, e.clientY]) };
      m.dragging.disable();
    };
    window.addEventListener("mousedown", onMiddleDown);
    return () => window.removeEventListener("mousedown", onMiddleDown);
  }, [ready]);

  // --- Reference polygons ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const group = L.layerGroup().addTo(m);
    const h = { "apikey": ANON, "Authorization": "Bearer " + ANON };
    fetch(`https://nnelrvctqjbwfucccxfh.supabase.co/rest/v1/sectores?codigo=like.E${equipoNum}S*&select=codigo,geometria`, { headers: h })
      .then(r => r.json()).then((data: any[]) => { data?.forEach(s => { if (s.geometria) L.geoJSON(s.geometria, { style: { color: "#e65100", weight: 2.5, fill: false, opacity: 0.8 } }).addTo(group); }); }).catch(() => {});
    fetch(`https://nnelrvctqjbwfucccxfh.supabase.co/rest/v1/rpc/get_cuarteles_con_sectores`, { method: "POST", headers: { ...h, "Content-Type": "application/json" } })
      .then(r => r.json()).then((data: any[]) => { data?.forEach(c => { if (c.geojson && c.equipo_riego?.split(" - ")?.some((eq: string) => eq === equipoNum)) L.geoJSON(c.geojson, { style: { color: "#ff9800", weight: 1.5, fillOpacity: 0.1, fillColor: "#ff9800", opacity: 0.5 } }).addTo(group); }); }).catch(() => {});
    return () => { m.removeLayer(group); };
  }, [ready, equipoNum]);

  // Restore saved georeference on mount
  useEffect(() => {
    if (!saved) return;
    const { bounds, rotation: r, opacity: o, zoom_level } = saved;
    geoCenterRef.current = L.latLng((bounds.sw[0] + bounds.ne[0]) / 2, (bounds.sw[1] + bounds.ne[1]) / 2);
    setRotation(r);
    setOpacity(o);
    if (zoom_level) setZoom(zoom_level);
  }, [saved]);

  // --- Render PDF ---
  useEffect(() => {
    fetch(planoUrl, { headers: { "apikey": ANON, "Authorization": "Bearer " + ANON } })
      .then(r => { if (!r.ok) throw new Error(); return r.arrayBuffer(); })
      .then(buf => pdfjsLib.getDocument({ data: buf }).promise)
      .then(async pdfDoc => {
        const page = await pdfDoc.getPage(1);
        // Render at high quality but cap size to avoid OOM on large PDFs
        const vpBase = page.getViewport({ scale: 1 });
        const targetWidth = 4000;
        const renderScale = Math.min(3, targetWidth / vpBase.width);
        const vp = page.getViewport({ scale: renderScale });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width; canvas.height = vp.height;
        await page.render({ canvas, viewport: vp }).promise;
        // Keep raw (white background)
        rawCanvasRef.current = canvas;
        setImageUrlRaw(canvas.toDataURL("image/png"));
        // Create transparent version
        const transCanvas = document.createElement("canvas");
        transCanvas.width = canvas.width; transCanvas.height = canvas.height;
        const tCtx = transCanvas.getContext("2d")!;
        tCtx.drawImage(canvas, 0, 0);
        const imgData = tCtx.getImageData(0, 0, transCanvas.width, transCanvas.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) d[i + 3] = 0;
        }
        tCtx.putImageData(imgData, 0, 0);
        setImageUrl(transCanvas.toDataURL("image/png"));
        // Auto-fit initial zoom only if not restoring saved data
        if (!saved?.zoom_level) {
          const container = mapContainerRef.current?.parentElement;
          if (container) {
            const cw = container.clientWidth;
            const fitZoom = Math.round((cw * 0.7 / canvas.width) * 100);
            setZoom(Math.max(3, Math.min(2000, fitZoom)));
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [planoUrl]);

  // --- Drag overlay (moves geographic center) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const m = mapRef.current;
    if (!m) return;
    m.dragging.disable();
    dragInfo.current = { dragging: true, startLatLng: m.containerPointToLatLng([e.clientX, e.clientY]) };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragInfo.current.dragging) return;
      const m = mapRef.current;
      if (!m) return;
      const curLL = m.containerPointToLatLng([e.clientX, e.clientY]);
      const dLat = curLL.lat - dragInfo.current.startLatLng.lat;
      const dLng = curLL.lng - dragInfo.current.startLatLng.lng;
      geoCenterRef.current = L.latLng(geoCenterRef.current.lat + dLat, geoCenterRef.current.lng + dLng);
      dragInfo.current.startLatLng = curLL;
      forceRender(n => n + 1);
    };
    const onUp = () => { dragInfo.current.dragging = false; mapRef.current?.dragging.enable(); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // --- Convert geo center to pixel position ---
  const getPixelPos = () => {
    const m = mapRef.current;
    if (!m) return { x: 0, y: 0 };
    const pt = m.latLngToContainerPoint(geoCenterRef.current);
    return { x: pt.x, y: pt.y };
  };

  const { x: posX, y: posY } = getPixelPos();

  // --- Save ---
  const handleSave = () => {
    if (!imageUrl) return alert("Espera que cargue el plano...");
    const m = mapRef.current;
    const img = document.querySelector(".geo-plano-img") as HTMLImageElement;
    if (!m || !img) { alert("No se puede calcular la posición del plano"); return; }
    setSaving(true);
    const parent = mapContainerRef.current?.parentElement;
    if (!parent) return;
    const imgRect = img.getBoundingClientRect();
    const ctrRect = parent.getBoundingClientRect();
    const sw = m.containerPointToLatLng([imgRect.left - ctrRect.left, imgRect.bottom - ctrRect.top]);
    const ne = m.containerPointToLatLng([imgRect.right - ctrRect.left, imgRect.top - ctrRect.top]);
    onSave({
      bounds: { sw: [sw.lat, sw.lng], ne: [ne.lat, ne.lng] },
      rotation, opacity, zoom_level: zoom,
    });
  };

  const ctr: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 5000,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex", justifyContent: "center", alignItems: "center",
  };
  const modalStyle: React.CSSProperties = {
    background: "#fff", borderRadius: 0, overflow: "hidden",
    display: "flex", flexDirection: "column",
    width: "100vw", height: "100vh", maxWidth: "100vw", maxHeight: "100vh",
  };
  const btn: React.CSSProperties = {
    background: "#fff", border: "1px solid #ccc", borderRadius: 4,
    padding: "4px 10px", cursor: "pointer", fontSize: 12,
  };
  const redBtn: React.CSSProperties = { ...btn, background: "#1565c0", color: "#fff", border: "none" };

  return (
    <div style={ctr} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 16px", borderBottom: "1px solid #ddd",
          fontSize: 14, fontWeight: 600, flexShrink: 0, flexWrap: "wrap", gap: 4,
        }}>
          <span style={{ whiteSpace: "nowrap" }}>Georreferenciar: {equipoCodigo}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <button onClick={() => setZoom(z => Math.max(3, z - 0.1))} style={btn}>🔽</button>
            <input type="number" min={3} max={2000} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ width: 52, fontSize: 12, textAlign: "center", border: "1px solid #ccc", borderRadius: 4, padding: "4px 2px" }} />
            <button onClick={() => setZoom(z => Math.min(2000, z + 0.1))} style={btn}>🔼</button>
            <input type="range" min={3} max={2000} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ width: 50, accentColor: "#1565c0" }} />
            <span style={{ color: "#ddd" }}>|</span>
            <button onClick={() => setRotation(r => (r - 1 + 360) % 360)} style={btn}>⟲</button>
            <input type="number" min={0} max={359} step={1} value={rotation} onChange={e => setRotation(Number(e.target.value) % 360)} style={{ width: 48, fontSize: 12, textAlign: "center", border: "1px solid #ccc", borderRadius: 4, padding: "4px 2px" }} />
            <span hidden>{rotation}°</span>
            <button onClick={() => setRotation(r => (r + 1) % 360)} style={btn}>⟳</button>
            <span style={{ color: "#ddd" }}>|</span>
            <button onClick={() => nudge(-0.00005, 0)} style={btn}>⬆</button>
            <button onClick={() => nudge(0, -0.00005)} style={btn}>⬅</button>
            <button onClick={() => nudge(0, 0.00005)} style={btn}>➡</button>
            <button onClick={() => nudge(0.00005, 0)} style={btn}>⬇</button>
            <span style={{ color: "#ddd" }}>|</span>
            <label style={{ fontSize: 12 }}>Op {Math.round(opacity * 100)}%
              <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={e => setOpacity(Number(e.target.value))} style={{ width: 50, marginLeft: 4 }} /></label>
            <span style={{ color: "#ddd" }}>|</span>
            <button onClick={() => setTransparentBg(v => !v)} style={{ ...btn, fontWeight: transparentBg ? 700 : 400, color: transparentBg ? "#2e7d32" : "#333" }} title="Fondo transparente">{transparentBg ? "🎨 On" : "🎨 Off"}</button>
            <span style={{ color: "#ddd" }}>|</span>
            <button onClick={handleSave} disabled={saving || !imageUrl} style={redBtn}>{saving ? "Guardando..." : "Guardar"}</button>
            <button onClick={onClose} style={{ ...btn, color: "#c62828", fontWeight: 600 }}>✕ Cerrar</button>
          </div>
        </div>

        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, zIndex: 1 }} />
          {loading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, background: "rgba(255,255,255,0.7)" }}><p style={{ color: "#666", fontSize: 14 }}>Cargando plano...</p></div>}
          {imageUrl && !loading && (
            <div style={{
              position: "absolute", left: posX, top: posY,
              transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${(zoom / 100) * Math.pow(2, mapZoom - 15)})`,
              transformOrigin: "center center", zIndex: 10, pointerEvents: "none",
            }}>
              <img src={transparentBg ? imageUrl : (imageUrlRaw || imageUrl)} alt="Plano" className="geo-plano-img" style={{ display: "block", maxWidth: "none", border: "3px dashed #e65100", opacity }} />
              {/* Crosshair handle in center — only this is draggable */}
              <div onMouseDown={handleMouseDown} title="Arrastrar para mover el plano"
                style={{
                  position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
                  width: 64, height: 64, cursor: "grab", pointerEvents: "auto",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(21, 101, 192, 0.85)", borderRadius: "50%",
                }}>
                <svg width="28" height="28" viewBox="0 0 28 28"><path d="M14 0l4 8h-3v6h6v-3l8 4-8 4v-3h-6v6h3l-4 8-4-8h3v-6H6v3L0 14l8-4v3h6V8H8l4-8z" fill="#fff"/></svg>
              </div>
            </div>
          )}
          {!loading && imageUrl && (
            <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.75)", color: "#fff", padding: "6px 14px", borderRadius: 4, fontSize: 12, zIndex: 200, pointerEvents: "none", whiteSpace: "nowrap" }}>
              Arrastrá el plano para posicionarlo. Usá los controles de arriba para escalar, rotar y ajustar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
