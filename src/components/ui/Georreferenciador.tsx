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
  const boundsRef = useRef<L.LatLngBounds | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [opacity, setOpacity] = useState(0.6);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [showHint, setShowHint] = useState(true);

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

  // --- Render PDF to image ---
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

  // --- Create / update overlay ---
  const addOrUpdateOverlay = () => {
    const m = mapRef.current;
    if (!m || !imageUrl || !ready) return;

    if (overlayRef.current) { m.removeLayer(overlayRef.current); overlayRef.current = null; }

    if (!boundsRef.current) {
      const c = m.getCenter();
      const o = 0.0008 * scale;
      boundsRef.current = L.latLngBounds([c.lat - o, c.lng - o], [c.lat + o, c.lng + o]);
    }

    const ov = L.imageOverlay(imageUrl, boundsRef.current, { opacity });
    ov.addTo(m);
    overlayRef.current = ov;

    const img: HTMLElement | undefined = ov.getElement();
    if (img) {
      img.style.transformOrigin = "center center";
      img.style.transform = `rotate(${rotation}deg)`;
      img.style.border = "2px dashed #e65100";
      img.style.cursor = "grab";
    }

    // --- Drag to move (only when clicking inside the overlay) ---
    let dragging = false;
    let startLatLng: L.LatLng | null = null;

    const onImageDown = (e: MouseEvent) => {
      e.stopPropagation();
      dragging = true;
      startLatLng = m.mouseEventToLatLng(e);
      m.dragging.disable();
      if (img) img.style.cursor = "grabbing";
      setShowHint(false);
    };

    const onMapMove = (e: L.LeafletMouseEvent) => {
      if (!dragging || !startLatLng || !ov || !boundsRef.current) return;
      const dLat = e.latlng.lat - startLatLng.lat;
      const dLng = e.latlng.lng - startLatLng.lng;
      startLatLng = e.latlng;
      const b = boundsRef.current;
      const nb = L.latLngBounds(
        [b.getSouthWest().lat + dLat, b.getSouthWest().lng + dLng],
        [b.getNorthEast().lat + dLat, b.getNorthEast().lng + dLng]
      );
      boundsRef.current = nb;
      ov.setBounds(nb);
    };

    const onMapUp = () => {
      if (!dragging) return;
      dragging = false;
      startLatLng = null;
      m.dragging.enable();
      if (img) img.style.cursor = "grab";
    };

    if (img) img.addEventListener("mousedown", onImageDown);
    m.on("mousemove", onMapMove);
    m.on("mouseup", onMapUp);

    // Store cleanup
    (ov as any)._cleanup = () => {
      if (img) img.removeEventListener("mousedown", onImageDown);
      m.off("mousemove", onMapMove);
      m.off("mouseup", onMapUp);
    };
  };

  useEffect(() => { addOrUpdateOverlay(); }, [imageUrl, ready]);

  // Opacity
  useEffect(() => {
    if (overlayRef.current) overlayRef.current.setOpacity(opacity);
  }, [opacity]);

  // Rotation
  useEffect(() => {
    const ov = overlayRef.current;
    if (!ov) return;
    const img = ov.getElement();
    if (img) { img.style.transformOrigin = "center center"; img.style.transform = `rotate(${rotation}deg)`; }
  }, [rotation]);

  // Scale (keep center position from current bounds)
  useEffect(() => {
    if (!boundsRef.current || !overlayRef.current) return;
    const c = boundsRef.current.getCenter();
    const o = 0.0008 * scale;
    boundsRef.current = L.latLngBounds([c.lat - o, c.lng - o], [c.lat + o, c.lng + o]);
    overlayRef.current.setBounds(boundsRef.current);
  }, [scale]);

  // Cleanup overlay
  useEffect(() => () => {
    if (overlayRef.current) {
      const ov = overlayRef.current as any;
      if (ov._cleanup) ov._cleanup();
      overlayRef.current = null;
    }
  }, []);

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
          {showHint && !loading && imageUrl && (
            <p style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.7)", color: "#fff", padding: "4px 12px", borderRadius: 4, fontSize: 12, zIndex: 10, pointerEvents: "none" }}>
              Arrastrá el plano naranjo para posicionarlo sobre el mapa
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
