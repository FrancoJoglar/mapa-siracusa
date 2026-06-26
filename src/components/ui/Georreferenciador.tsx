import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
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

function OverlayManager({ imageUrl, opacity, rotation, scale }: { imageUrl: string; opacity: number; rotation: number; scale: number }) {
  const map = useMap();
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const boundsRef = useRef<L.LatLngBounds | null>(null);
  const dragging = useRef(false);
  const dragStart = useRef<L.LatLng | null>(null);
  const offsetRef = useRef(0.0008);

  // Create/update overlay
  useEffect(() => {
    if (!imageUrl) return;
    const m = map;

    // Use stored bounds or default centered
    let b: L.LatLngBounds;
    if (boundsRef.current) {
      b = boundsRef.current;
    } else {
      const c = m.getCenter();
      const o = offsetRef.current * scale;
      b = L.latLngBounds([c.lat - o, c.lng - o], [c.lat + o, c.lng + o]);
      boundsRef.current = b;
    }

    if (overlayRef.current) m.removeLayer(overlayRef.current);
    const ov = L.imageOverlay(imageUrl, b, { opacity, interactive: true });
    ov.addTo(m);
    overlayRef.current = ov;

    // Apply rotation
    setTimeout(() => {
      const img = ov.getElement();
      if (img) {
        img.style.transition = "transform 0.1s";
        img.style.transformOrigin = "center center";
        img.style.transform = `rotate(${rotation}deg)`;
      }
    }, 50);
  }, [imageUrl]);

  // Update opacity
  useEffect(() => {
    if (overlayRef.current) overlayRef.current.setOpacity(opacity);
  }, [opacity]);

  // Update rotation
  useEffect(() => {
    const ov = overlayRef.current;
    if (!ov) return;
    const img = ov.getElement();
    if (img) {
      img.style.transformOrigin = "center center";
      img.style.transform = `rotate(${rotation}deg)`;
    }
  }, [rotation]);

  // Scale update
  useEffect(() => {
    if (!boundsRef.current || !overlayRef.current) return;
    const b = boundsRef.current;
    const c = b.getCenter();
    const o = offsetRef.current * scale;
    const newBounds = L.latLngBounds([c.lat - o, c.lng - o], [c.lat + o, c.lng + o]);
    boundsRef.current = newBounds;
    overlayRef.current.setBounds(newBounds);
  }, [scale]);

  // Drag to move
  useEffect(() => {
    const onDown = (e: L.LeafletMouseEvent) => {
      dragging.current = true;
      dragStart.current = e.latlng;
      map.dragging.disable();
      map.getContainer().style.cursor = "grabbing";
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      dragStart.current = null;
      map.dragging.enable();
      map.getContainer().style.cursor = "";
    };
    const onMove = (e: L.LeafletMouseEvent) => {
      if (!dragging.current || !dragStart.current || !boundsRef.current || !overlayRef.current) return;
      const delta = L.latLng(
        e.latlng.lat - dragStart.current.lat,
        e.latlng.lng - dragStart.current.lng
      );
      dragStart.current = e.latlng;
      const b = boundsRef.current;
      const newBounds = L.latLngBounds(
        [b.getSouthWest().lat + delta.lat, b.getSouthWest().lng + delta.lng],
        [b.getNorthEast().lat + delta.lat, b.getNorthEast().lng + delta.lng]
      );
      boundsRef.current = newBounds;
      overlayRef.current.setBounds(newBounds);
    };

    const ov = overlayRef.current;
    if (!ov) return;
    const el = ov.getElement();
    if (!el) return;
    el.addEventListener("mousedown", (e: any) => { onDown(e as any); map.fireEvent("mousedown", e); });
    map.on("mousemove", onMove);
    map.on("mouseup", onUp);

    return () => {
      map.off("mousemove", onMove);
      map.off("mouseup", onUp);
    };
  }, [map, imageUrl]);

  // Expose bounds ref for parent
  useEffect(() => {
    (window as any).__geoBounds = () => boundsRef.current;
    (window as any).__geoOverlay = () => overlayRef.current;
  }, []);

  return null;
}

export default function Georreferenciador({ planoUrl, equipoCodigo, initialCenter, onSave, onClose }: Props) {
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [opacity, setOpacity] = useState(0.6);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Render PDF to image
  useEffect(() => {
    const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk";
    fetch(planoUrl, { headers: { "apikey": ANON, "Authorization": "Bearer " + ANON } })
      .then(r => r.arrayBuffer())
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
      .catch(() => setLoading(false));
  }, [planoUrl]);

  const handleSave = () => {
    const b = (window as any).__geoBounds?.();
    if (!b) return alert("Esperá que cargue el mapa...");
    setSaving(true);
    const data = {
      bounds: {
        sw: [b.getSouthWest().lat, b.getSouthWest().lng],
        ne: [b.getNorthEast().lat, b.getNorthEast().lng],
      },
      rotation,
      opacity,
    };
    onSave(data);
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
  const primaryBtn: React.CSSProperties = { ...btn, background: "#1565c0", color: "#fff", border: "none", marginLeft: 4 };

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
            <button onClick={handleSave} disabled={saving || !imageUrl} style={primaryBtn}>
              {saving ? "Guardando..." : "Guardar Georreferencia"}
            </button>
            <button onClick={onClose} style={{ ...btn, color: "#c62828", fontWeight: 600 }}>✕ Cerrar</button>
          </div>
        </div>
        <div style={{ flex: 1, position: "relative" }}>
          {loading && <p style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#666", zIndex: 10 }}>Cargando plano...</p>}
          <MapContainer
            center={initialCenter}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
            whenReady={() => setMapReady(true)}
          >
            <TileLayer
              attribution='&copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            {mapReady && imageUrl && <OverlayManager imageUrl={imageUrl} opacity={opacity} rotation={rotation} scale={scale} />}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
