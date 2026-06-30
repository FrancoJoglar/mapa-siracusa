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
  const [scale, setScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const equipoNum = equipoCodigo.replace("Equipo ", "").trim();

  // --- Init map ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const m = L.map(containerRef.current, { center: initialCenter, zoom: 15, zoomControl: true });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "&copy; Esri",
    }).addTo(m);
    mapRef.current = m;
    setTimeout(() => { m.invalidateSize(); setReady(true); }, 200);
    return () => { m.remove(); mapRef.current = null; };
  }, []);

  // --- Load reference polygons (sectores + cuarteles of this equipo) ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const group = L.layerGroup().addTo(m);

    // Fetch sectores
    const supabaseUrl = "https://nnelrvctqjbwfucccxfh.supabase.co";
    const codePrefix = `E${equipoNum}S`;
    fetch(`${supabaseUrl}/rest/v1/sectores?codigo=like.${codePrefix}*&select=codigo,geometria`, {
      headers: { "apikey": ANON, "Authorization": "Bearer " + ANON },
    })
    .then(r => r.json())
    .then((data: any[]) => {
      if (!Array.isArray(data)) return;
      data.forEach(s => {
        if (!s.geometria) return;
        L.geoJSON(s.geometria, {
          style: { color: "#e65100", weight: 2, fill: false, opacity: 0.7 },
          pmIgnore: true,
        }).addTo(group);
        // Label
        if (s.geometria?.coordinates) {
          try {
            const layer = L.geoJSON(s.geometria as any);
            layer.eachLayer((l: any) => {
              const center = l.getBounds()?.getCenter();
              if (center) L.circleMarker(center, { radius: 0, opacity: 0 }).bindTooltip(s.codigo, { permanent: true, direction: "center", className: "cuartel-tooltip" }).addTo(group);
            });
          } catch {}
        }
      });
    })
    .catch(() => {});

    // Fetch cuarteles via RPC
    fetch(`${supabaseUrl}/rest/v1/rpc/get_cuarteles_con_sectores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": ANON, "Authorization": "Bearer " + ANON },
    })
    .then(r => r.json())
    .then((data: any[]) => {
      if (!Array.isArray(data)) return;
      data.forEach(c => {
        if (!c.geojson) return;
        const isInEquipo = c.equipo_riego?.split(" - ")?.some((eq: string) => eq === equipoNum);
        if (!isInEquipo) return;
        L.geoJSON(c.geojson, {
          style: { color: "#ff9800", weight: 1.5, fillOpacity: 0.1, fillColor: "#ff9800", opacity: 0.5 },
          pmIgnore: true,
        }).addTo(group);
      });
    })
    .catch(() => {});

    return () => { m.removeLayer(group); };
  }, [ready, equipoNum]);

  // --- Render PDF to image ---
  useEffect(() => {
    fetch(planoUrl, { headers: { "apikey": ANON, "Authorization": "Bearer " + ANON } })
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); })
      .then(buf => pdfjsLib.getDocument({ data: buf }).promise)
      .then(async pdfDoc => {
        const page = await pdfDoc.getPage(1);
        const vp = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvas, viewport: vp }).promise;
        setImageUrl(canvas.toDataURL("image/png"));
        setLoading(false);
      })
      .catch(e => { console.error("PDF error:", e); setLoading(false); });
  }, [planoUrl]);

  // --- Create overlay ---
  const addOverlay = () => {
    const m = mapRef.current;
    if (!m || !imageUrl || !ready) return;

    if (overlayRef.current) { m.removeLayer(overlayRef.current); overlayRef.current = null; }

    if (!boundsRef.current) {
      const c = m.getCenter();
      const o = 0.0008 * scale;
      boundsRef.current = L.latLngBounds([c.lat - o, c.lng - o], [c.lat + o, c.lng + o]);
    }

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

    // Drag
    let dragging = false;
    let startLL: L.LatLng | null = null;
    const onDn = (e: MouseEvent) => {
      e.stopPropagation();
      dragging = true;
      startLL = m.mouseEventToLatLng(e);
      m.dragging.disable();
      if (img) img.style.cursor = "grabbing";
      setShowHint(false);
    };
    const onMv = (e: L.LeafletMouseEvent) => {
      if (!dragging || !startLL || !ov || !boundsRef.current) return;
      boundsRef.current = L.latLngBounds(
        [boundsRef.current.getSouthWest().lat + e.latlng.lat - startLL.lat, boundsRef.current.getSouthWest().lng + e.latlng.lng - startLL.lng],
        [boundsRef.current.getNorthEast().lat + e.latlng.lat - startLL.lat, boundsRef.current.getNorthEast().lng + e.latlng.lng - startLL.lng]
      );
      startLL = e.latlng;
      ov.setBounds(boundsRef.current);
    };
    const onUp = () => { dragging = false; startLL = null; m.dragging.enable(); if (img) img.style.cursor = "grab"; };

    if (img) img.addEventListener("mousedown", onDn);
    m.on("mousemove", onMv);
    m.on("mouseup", onUp);
    (ov as any)._clean = () => { if (img) img.removeEventListener("mousedown", onDn); m.off("mousemove", onMv); m.off("mouseup", onUp); };
  };

  useEffect(() => { addOverlay(); }, [imageUrl, ready]);

  // Opacity
  useEffect(() => { if (overlayRef.current) overlayRef.current.setOpacity(opacity); }, [opacity]);

  // Rotation
  useEffect(() => {
    const img = overlayRef.current?.getElement();
    if (img) { img.style.transformOrigin = "center center"; img.style.transform = `rotate(${rotation}deg)`; }
  }, [rotation]);

  // Scale
  useEffect(() => {
    if (!boundsRef.current || !overlayRef.current) return;
    const c = boundsRef.current.getCenter();
    boundsRef.current = L.latLngBounds(
      [c.lat - 0.0008 * scale, c.lng - 0.0008 * scale],
      [c.lat + 0.0008 * scale, c.lng + 0.0008 * scale]
    );
    overlayRef.current.setBounds(boundsRef.current);
  }, [scale]);

  // Nudge tool
  const nudge = (dLat: number, dLng: number) => {
    if (!boundsRef.current || !overlayRef.current) return;
    setShowHint(false);
    boundsRef.current = L.latLngBounds(
      [boundsRef.current.getSouthWest().lat + dLat, boundsRef.current.getSouthWest().lng + dLng],
      [boundsRef.current.getNorthEast().lat + dLat, boundsRef.current.getNorthEast().lng + dLng]
    );
    overlayRef.current.setBounds(boundsRef.current);
  };

  // Cleanup
  useEffect(() => () => {
    const ov = overlayRef.current as any;
    if (ov?._clean) ov._clean();
  }, []);

  const handleSave = () => {
    const b = boundsRef.current;
    if (!b) return alert("Espera que cargue el mapa...");
    setSaving(true);
    onSave({ bounds: { sw: [b.getSouthWest().lat, b.getSouthWest().lng], ne: [b.getNorthEast().lat, b.getNorthEast().lng] }, rotation, opacity });
  };

  const ctr: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 5000, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" };
  const modalStyle: React.CSSProperties = { background: "#fff", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column", width: "95vw", height: "95vh", maxWidth: 1200 };
  const btn: React.CSSProperties = { background: "#fff", border: "1px solid #ccc", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 12 };
  const redBtn: React.CSSProperties = { ...btn, background: "#1565c0", color: "#fff", border: "none" };

  return (
    <div style={ctr} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #ddd", fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
          <span>Georreferenciar: {equipoCodigo} — Ref: naranjo=sectores, naranjo claro=cuarteles</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} style={btn} title="Reducir">🔽</button>
            <span style={{ fontSize: 11, color: "#666", minWidth: 36, textAlign: "center" }}>{(scale*100).toFixed(0)}%</span>
            <button onClick={() => setScale(s => Math.min(5, s + 0.1))} style={btn} title="Agrandar">🔼</button>
            <span style={{ color: "#ddd" }}>|</span>
            <button onClick={() => nudge(0.0001, 0)} style={btn} title="Mover arriba">⬆</button>
            <button onClick={() => nudge(0, -0.0001)} style={btn} title="Mover izquierda">⬅</button>
            <button onClick={() => nudge(0, 0.0001)} style={btn} title="Mover derecha">➡</button>
            <button onClick={() => nudge(-0.0001, 0)} style={btn} title="Mover abajo">⬇</button>
            <span style={{ color: "#ddd" }}>|</span>
            <button onClick={() => setRotation(r => (r + 90) % 360)} style={btn} title="Rotar der">🔄 +90°</button>
            <button onClick={() => setRotation(r => (r - 90 + 360) % 360)} style={btn} title="Rotar izq">🔄 −90°</button>
            <span style={{ color: "#ddd" }}>|</span>
            <label style={{ fontSize: 12 }}>Op {Math.round(opacity * 100)}%
              <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={e => setOpacity(Number(e.target.value))} style={{ width: 60, marginLeft: 4 }} />
            </label>
            <span style={{ color: "#ddd" }}>|</span>
            <button onClick={handleSave} disabled={saving || !imageUrl} style={redBtn}>{saving ? "Guardando..." : "Guardar Georreferencia"}</button>
            <button onClick={onClose} style={{ ...btn, color: "#c62828", fontWeight: 600 }}>✕ Cerrar</button>
          </div>
        </div>
        {/* MAP */}
        <div ref={containerRef} style={{ flex: 1, position: "relative" }}>
          {loading && <p style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#666", zIndex: 10 }}>Cargando plano...</p>}
          {showHint && !loading && imageUrl && (
            <p style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.7)", color: "#fff", padding: "4px 12px", borderRadius: 4, fontSize: 12, zIndex: 10, pointerEvents: "none" }}>
              Arrastrá el plano naranjo para calzarlo con los polígonos de referencia
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
