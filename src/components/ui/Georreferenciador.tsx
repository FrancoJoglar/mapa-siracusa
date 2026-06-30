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
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const boundsRef = useRef<L.LatLngBounds | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [opacity, setOpacity] = useState(0.6);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(10);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const cornerRef = useRef<{ [key: string]: HTMLDivElement }>({});

  const equipoNum = equipoCodigo.replace("Equipo ", "").trim();

  // --- Init map ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const m = L.map(containerRef.current, { center: initialCenter, zoom: 15, zoomControl: true });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "&copy; Esri" }).addTo(m);
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
    fetch(`${supabaseUrl}/rest/v1/sectores?codigo=like.E${equipoNum}S*&select=codigo,geometria`, { headers: { "apikey": ANON, "Authorization": "Bearer " + ANON } })
      .then(r => r.json()).then((data: any[]) => { if (!Array.isArray(data)) return; data.forEach(s => { if (!s.geometria) return; L.geoJSON(s.geometria, { style: { color: "#e65100", weight: 2, fill: false, opacity: 0.7 } }).addTo(group); }); }).catch(() => {});
    fetch(`${supabaseUrl}/rest/v1/rpc/get_cuarteles_con_sectores`, { method: "POST", headers: { "Content-Type": "application/json", "apikey": ANON, "Authorization": "Bearer " + ANON } })
      .then(r => r.json()).then((data: any[]) => { if (!Array.isArray(data)) return; data.forEach(c => { if (!c.geojson) return; if (c.equipo_riego?.split(" - ")?.some((eq: string) => eq === equipoNum)) L.geoJSON(c.geojson, { style: { color: "#ff9800", weight: 1.5, fillOpacity: 0.1, fillColor: "#ff9800", opacity: 0.5 } }).addTo(group); }); }).catch(() => {});
    return () => { m.removeLayer(group); };
  }, [ready, equipoNum]);

  // --- Render PDF ---
  useEffect(() => {
    fetch(planoUrl, { headers: { "apikey": ANON, "Authorization": "Bearer " + ANON } })
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); })
      .then(buf => pdfjsLib.getDocument({ data: buf }).promise)
      .then(async pdfDoc => { const page = await pdfDoc.getPage(1); const vp = page.getViewport({ scale: 2 }); const canvas = document.createElement("canvas"); canvas.width = vp.width; canvas.height = vp.height; await page.render({ canvas, viewport: vp }).promise; setImageUrl(canvas.toDataURL("image/png")); setLoading(false); })
      .catch(() => setLoading(false));
  }, [planoUrl]);

  // --- Corner handlers ---
  useEffect(() => {
    // Create 4 corner resize handles
    const corners: string[] = [];
    ["sw", "se", "nw", "ne"].forEach(pos => {
      const d = document.createElement("div");
      d.className = "geo-corner geo-" + pos;
      d.innerHTML = '<svg width="12" height="12"><rect width="12" height="12" rx="2" fill="#1565c0" stroke="#fff" stroke-width="2"/></svg>';
      d.style.position = "absolute";
      d.style.zIndex = "10000";
      d.style.cursor = pos === "sw" || pos === "ne" ? "nwse-resize" : "nesw-resize";
      d.style.pointerEvents = "auto";
      d.style.display = "none";
      containerRef.current?.appendChild(d);
      cornerRef.current[pos] = d;
      corners.push(pos);
    });
    return () => { Object.values(cornerRef.current).forEach(d => d.remove()); cornerRef.current = {}; };
  }, []);

  // --- Update corner positions ---
  const updateCorners = () => {
    const m = mapRef.current;
    if (!m || !boundsRef.current) { Object.values(cornerRef.current).forEach(d => d.style.display = "none"); return; }
    const b = boundsRef.current;
    const corners: [string, L.LatLng][] = [
      ["sw", b.getSouthWest()], ["se", b.getSouthEast()], ["nw", b.getNorthWest()], ["ne", b.getNorthEast()]
    ];
    corners.forEach(([pos, ll]) => {
      const pt = m.latLngToContainerPoint(ll);
      const d = cornerRef.current[pos];
      if (!d) return;
      d.style.display = "block";
      d.style.left = (pt.x - 6) + "px";
      d.style.top = (pt.y - 6) + "px";
    });

    // Corner resize drag
    corners.forEach(([pos]) => {
      const d = cornerRef.current[pos];
      if (!d) return;
      (d as any)._pos = pos;
    });
  };

  // Resize from corner
  const setupCornerDrag = () => {
    const m = mapRef.current;
    if (!m || !overlayRef.current) return;
    
    let dragging = false, pivot: L.LatLng | null = null, corner = "";
    
    const getPivot = (c: string): L.LatLng | null => {
      const b = boundsRef.current; if (!b) return null;
      if (c === "sw") return b.getNorthEast();
      if (c === "se") return b.getNorthWest();
      if (c === "nw") return b.getSouthEast();
      if (c === "ne") return b.getSouthWest();
      return null;
    };

    Object.entries(cornerRef.current).forEach(([pos, d]) => {
      d.onmousedown = (e: MouseEvent) => {
        e.stopPropagation(); e.preventDefault();
        dragging = true; corner = pos;
        pivot = getPivot(pos);
        setShowHint(false);
        m.dragging.disable();
      };
    });

    const onMove = (e: L.LeafletMouseEvent) => {
      if (!dragging || !pivot || !overlayRef.current) return;
      const opp = getPivot(corner);
      if (!opp) return;
      const nll = e.latlng;
      // Resize keeping same proportions
      const dLat = Math.abs(nll.lat - opp.lat) * 2;
      const dLng = Math.abs(nll.lng - opp.lng) * 2;
      const ctr = L.latLng((nll.lat + opp.lat) / 2, (nll.lng + opp.lng) / 2);
      boundsRef.current = L.latLngBounds(
        [ctr.lat - dLat / 2, ctr.lng - dLng / 2],
        [ctr.lat + dLat / 2, ctr.lng + dLng / 2]
      );
      overlayRef.current.setBounds(boundsRef.current);
      updateCorners();
    };

    const onUp = () => { dragging = false; m.dragging.enable(); };

    m.on("mousemove", onMove);
    m.on("mouseup", onUp);
    return () => { m.off("mousemove", onMove); m.off("mouseup", onUp); };
  };

  // --- Create overlay ---
  const addOverlay = () => {
    const m = mapRef.current;
    if (!m || !imageUrl || !ready) return;
    if (overlayRef.current) { m.removeLayer(overlayRef.current); overlayRef.current = null; }
    if (!boundsRef.current) { const c = m.getCenter(); const o = 0.0008; boundsRef.current = L.latLngBounds([c.lat - o, c.lng - o], [c.lat + o, c.lng + o]); }

    const ov = L.imageOverlay(imageUrl, boundsRef.current, { opacity, interactive: true });
    ov.addTo(m);
    overlayRef.current = ov;

    const img = ov.getElement();
    if (img) {
      img.style.transformOrigin = "center center";
      img.style.transform = `rotate(${rotation}deg)`;
      img.style.border = "2px dashed #e65100";
      img.style.cursor = "grab";
    }

    // Scroll to scale on image
    if (img) img.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation();
      setScale(s => Math.max(0.2, Math.min(20, s + (e.deltaY < 0 ? 0.1 : -0.1))));
      setShowHint(false);
    }, { passive: false });

    // Drag overlay
    let dragging = false, startLL: L.LatLng | null = null;
    if (img) img.addEventListener("mousedown", (e: MouseEvent) => {
      e.stopPropagation(); dragging = true; startLL = m.mouseEventToLatLng(e); m.dragging.disable();
      if (img) img.style.cursor = "grabbing"; setShowHint(false);
    });
    const onMv = (e: L.LeafletMouseEvent) => {
      if (!dragging || !startLL || !ov || !boundsRef.current) return;
      boundsRef.current = L.latLngBounds(
        [boundsRef.current.getSouthWest().lat + e.latlng.lat - startLL.lat, boundsRef.current.getSouthWest().lng + e.latlng.lng - startLL.lng],
        [boundsRef.current.getNorthEast().lat + e.latlng.lat - startLL.lat, boundsRef.current.getNorthEast().lng + e.latlng.lng - startLL.lng]
      );
      startLL = e.latlng; ov.setBounds(boundsRef.current); updateCorners();
    };
    const onUp = () => { dragging = false; m.dragging.enable(); if (img) img.style.cursor = "grab"; };
    m.on("mousemove", onMv); m.on("mouseup", onUp);
    (ov as any)._clean = () => { m.off("mousemove", onMv); m.off("mouseup", onUp); };

    updateCorners();
  };

  useEffect(() => { addOverlay(); }, [imageUrl, ready]);
  useEffect(() => { const clean = setupCornerDrag(); return clean; }, [imageUrl, ready]);

  // Opacity / Rotation / Scale updates
  useEffect(() => { if (overlayRef.current) overlayRef.current.setOpacity(opacity); }, [opacity]);
  useEffect(() => { const img = overlayRef.current?.getElement(); if (img) { img.style.transformOrigin = "center center"; img.style.transform = `rotate(${rotation}deg)`; } updateCorners(); }, [rotation]);
  useEffect(() => {
    if (!boundsRef.current || !overlayRef.current) return;
    const c = boundsRef.current.getCenter();
    const o = 0.0008 * scale;
    boundsRef.current = L.latLngBounds([c.lat - o, c.lng - o], [c.lat + o, c.lng + o]);
    overlayRef.current.setBounds(boundsRef.current);
    updateCorners();
  }, [scale]);

  const nudge = (dLat: number, dLng: number) => {
    if (!boundsRef.current || !overlayRef.current) return;
    setShowHint(false);
    boundsRef.current = L.latLngBounds(
      [boundsRef.current.getSouthWest().lat + dLat, boundsRef.current.getSouthWest().lng + dLng],
      [boundsRef.current.getNorthEast().lat + dLat, boundsRef.current.getNorthEast().lng + dLng]
    );
    overlayRef.current.setBounds(boundsRef.current);
    updateCorners();
  };

  useEffect(() => () => { const ov = overlayRef.current as any; if (ov?._clean) ov._clean(); }, []);

  const handleSave = () => { const b = boundsRef.current; if (!b) return alert("Espera..."); setSaving(true); onSave({ bounds: { sw: [b.getSouthWest().lat, b.getSouthWest().lng], ne: [b.getNorthEast().lat, b.getNorthEast().lng] }, rotation, opacity }); };

  const ctr: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 5000, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" };
  const modalStyle: React.CSSProperties = { background: "#fff", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column", width: "95vw", height: "95vh", maxWidth: 1200 };
  const btn: React.CSSProperties = { background: "#fff", border: "1px solid #ccc", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 12 };
  const redBtn: React.CSSProperties = { ...btn, background: "#1565c0", color: "#fff", border: "none" };

  return (
    <div style={ctr} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #ddd", fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
          <span>Georreferenciar: {equipoCodigo}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} style={btn}>🔽</button>
            <span style={{ fontSize: 11, minWidth: 40, textAlign: "center" }}>{(scale*100).toFixed(0)}%</span>
            <button onClick={() => setScale(s => Math.min(20, s + 0.1))} style={btn}>🔼</button>
            <span style={{ color: "#ddd" }}>|</span>
            <button onClick={() => nudge(0.0001, 0)} style={btn} title="Arriba">⬆</button>
            <button onClick={() => nudge(0, -0.0001)} style={btn} title="Izq">⬅</button>
            <button onClick={() => nudge(0, 0.0001)} style={btn} title="Der">➡</button>
            <button onClick={() => nudge(-0.0001, 0)} style={btn} title="Abajo">⬇</button>
            <span style={{ color: "#ddd" }}>|</span>
            <button onClick={() => setRotation(r => (r - 5 + 360) % 360)} style={btn}>⟲</button>
            <input type="range" min={0} max={359} value={rotation} onChange={e => setRotation(Number(e.target.value))} title={`Rotación: ${rotation}°`} style={{ width: 60, accentColor: "#1565c0" }} />
            <span style={{ fontSize: 11, color: "#666", minWidth: 28, textAlign: "center" }}>{rotation}°</span>
            <button onClick={() => setRotation(r => (r + 5) % 360)} style={btn}>⟳</button>
            <span style={{ color: "#ddd" }}>|</span>
            <label style={{ fontSize: 12 }}>Op {Math.round(opacity * 100)}%
              <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={e => setOpacity(Number(e.target.value))} style={{ width: 60, marginLeft: 4 }} /></label>
            <span style={{ color: "#ddd" }}>|</span>
            <button onClick={handleSave} disabled={saving || !imageUrl} style={redBtn}>{saving ? "Guardando..." : "Guardar"}</button>
            <button onClick={onClose} style={{ ...btn, color: "#c62828", fontWeight: 600 }}>✕ Cerrar</button>
          </div>
        </div>
        <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {loading && <p style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#666", zIndex: 10 }}>Cargando plano...</p>}
          {showHint && !loading && imageUrl && (
            <p style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.7)", color: "#fff", padding: "4px 12px", borderRadius: 4, fontSize: 12, zIndex: 10, pointerEvents: "none" }}>
              Arrastrá el plano, usá scroll sobre él para zoom, o mové las esquinas 🔲
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
