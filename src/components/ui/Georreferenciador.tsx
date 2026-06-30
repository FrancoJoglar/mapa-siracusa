import { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface Props {
  planoUrl: string;
  equipoCodigo: string;
  initialCenter: [number, number];
  onSave: (data: { bounds: any; rotation: number; opacity: number }) => void;
  onClose: () => void;
}

const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk";

export default function Georreferenciador({ planoUrl, equipoCodigo, initialCenter, onSave, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [opacity, setOpacity] = useState(0.6);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragInfo = useRef({ dragging: false, startX: 0, startY: 0, posX: 0, posY: 0 });
  const equipoNum = equipoCodigo.replace("Equipo ", "").trim();

  // --- Init map ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const m = L.map(containerRef.current, {
      center: initialCenter, zoom: 15, zoomControl: true,
      dragging: true, scrollWheelZoom: true, doubleClickZoom: true,
    });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { 
      attribution: "&copy; Esri" 
    }).addTo(m);
    mapRef.current = m;
    setTimeout(() => { m.invalidateSize(); setReady(true); }, 200);
    return () => { m.remove(); mapRef.current = null; };
  }, []);

  // --- Reference polygons ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const group = L.layerGroup().addTo(m);
    const supabaseUrl = "https://nnelrvctqjbwfucccxfh.supabase.co";
    const fetchHeaders = { "apikey": ANON, "Authorization": "Bearer " + ANON };
    
    fetch(`${supabaseUrl}/rest/v1/sectores?codigo=like.E${equipoNum}S*&select=codigo,geometria`, { headers: fetchHeaders })
      .then(r => r.json()).then((data: any[]) => {
        data?.forEach(s => { if (s.geometria) L.geoJSON(s.geometria, { style: { color: "#e65100", weight: 2.5, fill: false, opacity: 0.8 } }).addTo(group); });
      }).catch(() => {});
    
    fetch(`${supabaseUrl}/rest/v1/rpc/get_cuarteles_con_sectores`, { method: "POST", headers: { ...fetchHeaders, "Content-Type": "application/json" } })
      .then(r => r.json()).then((data: any[]) => {
        data?.forEach(c => { if (c.geojson && c.equipo_riego?.split(" - ")?.some((eq: string) => eq === equipoNum)) L.geoJSON(c.geojson, { style: { color: "#ff9800", weight: 1.5, fillOpacity: 0.1, fillColor: "#ff9800", opacity: 0.5 } }).addTo(group); });
      }).catch(() => {});
    
    return () => { m.removeLayer(group); };
  }, [ready, equipoNum]);

  // --- Render PDF ---
  useEffect(() => {
    fetch(planoUrl, { headers: { "apikey": ANON, "Authorization": "Bearer " + ANON } })
      .then(r => { if (!r.ok) throw new Error(); return r.arrayBuffer(); })
      .then(buf => pdfjsLib.getDocument({ data: buf }).promise)
      .then(async pdfDoc => {
        const page = await pdfDoc.getPage(1);
        const vp = page.getViewport({ scale: 3 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width; canvas.height = vp.height;
        await page.render({ canvas, viewport: vp }).promise;
        setImageUrl(canvas.toDataURL("image/png"));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [planoUrl]);

  // --- Center overlay initially ---
  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const parent = containerRef.current.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    setPosition({ x: rect.width / 2, y: rect.height / 2 });
  }, [ready]);

  // --- Drag to move ---
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragInfo.current = { dragging: true, startX: e.clientX, startY: e.clientY, posX: position.x, posY: position.y };
  };
  
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragInfo.current.dragging) return;
      const dx = e.clientX - dragInfo.current.startX;
      const dy = e.clientY - dragInfo.current.startY;
      setPosition({ x: dragInfo.current.posX + dx, y: dragInfo.current.posY + dy });
    };
    const onUp = () => { dragInfo.current.dragging = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // --- Convert pixel position back to lat/lng bounds for saving ---
  const getGeoBounds = () => {
    const m = mapRef.current;
    const img = imgRef.current?.querySelector("img");
    if (!m || !img || !containerRef.current) return null;
    const parent = containerRef.current.parentElement;
    if (!parent) return null;

    const imgRect = img.getBoundingClientRect();
    const ctrRect = parent.getBoundingClientRect();
    
    const imgLeft = imgRect.left - ctrRect.left;
    const imgTop = imgRect.top - ctrRect.top;
    const imgRight = imgLeft + imgRect.width;
    const imgBottom = imgTop + imgRect.height;

    const sw = m.containerPointToLatLng([imgLeft, imgBottom]);
    const ne = m.containerPointToLatLng([imgRight, imgTop]);
    return { sw: [sw.lat, sw.lng], ne: [ne.lat, ne.lng] };
  };

  const handleSave = () => {
    const b = getGeoBounds();
    if (!b) return alert("Espera que cargue el mapa...");
    setSaving(true);
    onSave({ bounds: b, rotation, opacity });
  };

  const ctr: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 5000,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex", justifyContent: "center", alignItems: "center",
  };
  const modalStyle: React.CSSProperties = {
    background: "#fff", borderRadius: 8, overflow: "hidden",
    display: "flex", flexDirection: "column",
    width: "95vw", height: "95vh", maxWidth: 1200,
  };
  const btn: React.CSSProperties = {
    background: "#fff", border: "1px solid #ccc", borderRadius: 4,
    padding: "4px 10px", cursor: "pointer", fontSize: 12,
  };
  const redBtn: React.CSSProperties = { ...btn, background: "#1565c0", color: "#fff", border: "none" };

  return (
    <div style={ctr} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 16px", borderBottom: "1px solid #ddd",
          fontSize: 14, fontWeight: 600, flexShrink: 0, flexWrap: "wrap", gap: 4,
        }}>
          <span style={{ whiteSpace: "nowrap" }}>Georreferenciar: {equipoCodigo}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {/* Scale */}
            <button onClick={() => setZoom(z => Math.max(10, z - 10))} style={btn}>🔽</button>
            <span style={{ fontSize: 11, minWidth: 42, textAlign: "center" }}>{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(2000, z + 10))} style={btn}>🔼</button>
            <input type="range" min={10} max={2000} step={10} value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              style={{ width: 50, accentColor: "#1565c0" }} />
            <span style={{ color: "#ddd" }}>|</span>
            {/* Rotation */}
            <button onClick={() => setRotation(r => (r - 5 + 360) % 360)} style={btn}>⟲</button>
            <input type="range" min={0} max={359} value={rotation}
              onChange={e => setRotation(Number(e.target.value))}
              title={`Rotación: ${rotation}°`} style={{ width: 50, accentColor: "#1565c0" }} />
            <span style={{ fontSize: 11, minWidth: 28, textAlign: "center" }}>{rotation}°</span>
            <button onClick={() => setRotation(r => (r + 5) % 360)} style={btn}>⟳</button>
            <span style={{ color: "#ddd" }}>|</span>
            {/* Nudge */}
            <button onClick={() => setPosition(p => ({ x: p.x, y: p.y - 3 }))} style={btn}>⬆</button>
            <button onClick={() => setPosition(p => ({ x: p.x - 3, y: p.y }))} style={btn}>⬅</button>
            <button onClick={() => setPosition(p => ({ x: p.x + 3, y: p.y }))} style={btn}>➡</button>
            <button onClick={() => setPosition(p => ({ x: p.x, y: p.y + 3 }))} style={btn}>⬇</button>
            <span style={{ color: "#ddd" }}>|</span>
            {/* Opacity */}
            <label style={{ fontSize: 12 }}>Op {Math.round(opacity * 100)}%
              <input type="range" min={0.1} max={1} step={0.05} value={opacity}
                onChange={e => setOpacity(Number(e.target.value))}
                style={{ width: 50, marginLeft: 4 }} />
            </label>
            <span style={{ color: "#ddd" }}>|</span>
            <button onClick={handleSave} disabled={saving || !imageUrl} style={redBtn}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button onClick={onClose} style={{ ...btn, color: "#c62828", fontWeight: 600 }}>✕ Cerrar</button>
          </div>
        </div>

        {/* Map + Overlay */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* Map container */}
          <div ref={containerRef} style={{ position: "absolute", inset: 0, zIndex: 1 }} />
          {/* Loading */}
          {loading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, background: "rgba(255,255,255,0.7)" }}><p style={{ color: "#666", fontSize: 14 }}>Cargando plano...</p></div>}
          {/* Overlay image on top of map */}
          {imageUrl && !loading && (
            <div ref={imgRef} onMouseDown={handleMouseDown}
              style={{
                position: "absolute", left: position.x, top: position.y,
                transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${zoom / 100})`,
                transformOrigin: "center center", zIndex: 10, cursor: "grab", pointerEvents: "auto",
              }}>
              <img src={imageUrl} alt="Plano" style={{ display: "block", maxWidth: "none", border: "3px dashed #e65100", opacity }} />
            </div>
          )}
          {/* Instructions */}
          {!loading && imageUrl && (
            <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.75)", color: "#fff", padding: "6px 14px", borderRadius: 4, fontSize: 12, zIndex: 200, pointerEvents: "none", whiteSpace: "nowrap" }}>
              Arrastrá el plano para posicionarlo. Usá los controles de arriba para escalar, rotar y ajustar.
            </div>
          )}

          {/* Draggable image overlay */}
          {imageUrl && !loading && (
            <div
              ref={imgRef}
              onMouseDown={handleMouseDown}
              style={{
                position: "absolute",
                left: position.x,
                top: position.y,
                transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${zoom / 100})`,
                transformOrigin: "center center",
                zIndex: 100,
                cursor: "grab",
                pointerEvents: "auto",
              }}
            >
              <img src={imageUrl} alt="Plano" style={{
                display: "block", maxWidth: "none",
                border: "3px dashed #e65100",
                opacity,
              }} />
            </div>
          )}

          {/* Instructions */}
          {!loading && imageUrl && (
            <div style={{
              position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.75)", color: "#fff",
              padding: "6px 14px", borderRadius: 4, fontSize: 12, zIndex: 10,
              pointerEvents: "none", whiteSpace: "nowrap",
            }}>
              Arrastrá el plano para posicionarlo. Usá los controles de arriba para escalar, rotar y ajustar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
