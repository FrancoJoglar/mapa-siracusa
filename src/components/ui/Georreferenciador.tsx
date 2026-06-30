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

export default function Georreferenciador({ planoUrl, equipoCodigo, initialCenter, onSave, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [opacity, setOpacity] = useState(0.6);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const boundsRef = useRef<L.LatLngBounds | null>(null);
  const dragging = useRef(false);
  const dragStart = useRef<L.LatLng | null>(null);

  // Create Leaflet map manually (avoid react-leaflet)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const m = L.map(containerRef.current, { center: initialCenter, zoom: 15 });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "&copy; Esri",
    }).addTo(m);
    mapRef.current = m;
    setTimeout(() => { m.invalidateSize(); setReady(true); }, 200);
    return () => { m.remove(); mapRef.current = null; };
  }, []);

  // Render PDF to image
  useEffect(() => {
    const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk";
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

  // Create overlay when image is ready
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !imageUrl || !ready) return;
    if (overlayRef.current) m.removeLayer(overlayRef.current);

    if (!boundsRef.current) {
      const c = m.getCenter();
      const o = 0.0008 * scale;
      boundsRef.current = L.latLngBounds([c.lat - o, c.lng - o], [c.lat + o, c.lng + o]);
    }

    const ov = L.imageOverlay(imageUrl, boundsRef.current, { opacity, interactive: true });
    ov.addTo(m);
    overlayRef.current = ov;

    setTimeout(() => {
      const img = ov.getElement();
      if (img) {
        img.style.transformOrigin = "center center";
        img.style.transform = `rotate(${rotation}deg)`;
        img.style.border = "2px dashed #e65100";
      }
    }, 100);
  }, [imageUrl, ready]);

  // Update opacity
  useEffect(() => { if (overlayRef.current) overlayRef.current.setOpacity(opacity); }, [opacity]);

  // Update rotation
  useEffect(() => {
    const ov = overlayRef.current;
    if (!ov) return;
    const img = ov.getElement();
    if (img) { img.style.transformOrigin = "center center"; img.style.transform = `rotate(${rotation}deg)`; }
  }, [rotation]);

  // Scale
  useEffect(() => {
    if (!boundsRef.current || !overlayRef.current) return;
    const b = boundsRef.current;
    const c = b.getCenter();
    const o = 0.0008 * scale;
    boundsRef.current = L.latLngBounds([c.lat - o, c.lng - o], [c.lat + o, c.lng + o]);
    overlayRef.current.setBounds(boundsRef.current);
  }, [scale]);

  // Drag handling
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;

    const onDown = () => { dragging.current = true; m.dragging.disable(); };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      m.dragging.enable();
    };
    const onMove = (e: L.LeafletMouseEvent) => {
      if (!dragging.current || !overlayRef.current) return;
      const b = boundsRef.current;
      if (!b) return;
      const ov = overlayRef.current;
      if (!dragStart.current) { dragStart.current = e.latlng; return; }
      const dLat = e.latlng.lat - dragStart.current.lat;
      const dLng = e.latlng.lng - dragStart.current.lng;
      dragStart.current = e.latlng;
      const nb = L.latLngBounds(
        [b.getSouthWest().lat + dLat, b.getSouthWest().lng + dLng],
        [b.getNorthEast().lat + dLat, b.getNorthEast().lng + dLng]
      );
      boundsRef.current = nb;
      ov.setBounds(nb);
    };

    m.on("mousedown", onDown);
    m.on("mouseup", onUp);
    m.on("mousemove", onMove);

    return () => { m.off("mousedown", onDown); m.off("mouseup", onUp); m.off("mousemove", onMove); };
  }, [ready]);

  const handleSave = () => {
    const b = boundsRef.current;
    if (!b) return alert("Espera que cargue el mapa...");
    setSaving(true);
    onSave({
      bounds: { sw: [b.getSouthWest().lat, b.getSouthWest().lng], ne: [b.getNorthEast().lat, b.getNorthEast().lng] },
      rotation, opacity,
    });
  };

  const ctr: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 5000,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex", justifyContent: "center", alignItems: "center",
  };
  const modalStyle: React.CSSProperties = {
    background: "#fff", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column",
    width: "95vw", height: "95vh", maxWidth: 1200,
  };
  const btn: React.CSSProperties = {
    background: "#fff", border: "1px solid #ccc", borderRadius: 4,
    padding: "4px 10px", cursor: "pointer", fontSize: 12,
  };

  return (
    <div style={ctr} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #ddd", fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
          <span>Georreferenciar: {equipoCodigo}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} style={btn} title="Reducir">🔽</button>
            <span style={{ fontSize: 11, color: "#666", minWidth: 36, textAlign: "center" }}>{(scale*100).toFixed(0)}%</span>
            <button onClick={() => setScale(s => Math.min(5, s + 0.1))} style={btn} title="Agrandar">🔼</button>
            <span style={{ color: "#ddd" }}>|</span>
            <button onClick={() => setRotation(r => (r + 90) % 360)} style={btn} title="Rotar der">🔄 +90°</button>
            <button onClick={() => setRotation(r => (r - 90 + 360) % 360)} style={btn} title="Rotar izq">🔄 −90°</button>
            <span style={{ color: "#ddd" }}>|</span>
            <label style={{ fontSize: 12 }}>Op {Math.round(opacity * 100)}%
              <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={e => setOpacity(Number(e.target.value))} style={{ width: 60, marginLeft: 4 }} />
            </label>
            <span style={{ color: "#ddd" }}>|</span>
            <button onClick={handleSave} disabled={saving || !imageUrl} style={{ ...btn, background: "#1565c0", color: "#fff", border: "none" }}>
              {saving ? "Guardando..." : "Guardar Georreferencia"}
            </button>
            <button onClick={onClose} style={{ ...btn, color: "#c62828", fontWeight: 600 }}>✕ Cerrar</button>
          </div>
        </div>
        <div ref={containerRef} style={{ flex: 1, position: "relative" }}>
          {loading && <p style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#666", zIndex: 10 }}>Cargando plano...</p>}
        </div>
      </div>
    </div>
  );
}
