import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
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
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [opacity, setOpacity] = useState(0.6);
  const [rotation, setRotation] = useState(0);
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<any>(null);

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

  // When map is ready, add the image overlay
  const handleMapReady = () => {
    const map = mapRef.current;
    if (!map || !imageUrl) return;
    if (overlayRef.current) map.removeLayer(overlayRef.current);

    const center = map.getCenter();
    const offset = 0.001;
    const bounds: L.LatLngBoundsExpression = [
      [center.lat - offset, center.lng - offset],
      [center.lat + offset, center.lng + offset],
    ];
    const overlay = L.imageOverlay(imageUrl, bounds, { opacity });
    overlay.addTo(map);
    overlayRef.current = overlay;
  };

  useEffect(() => {
    handleMapReady();
  }, [imageUrl, opacity]);

  // Update rotation via CSS
  useEffect(() => {
    if (!overlayRef.current) return;
    const img = overlayRef.current._image;
    if (!img) return;
    img.style.transformOrigin = "center center";
    img.style.transform = `rotate(${rotation}deg)`;
  }, [rotation]);

  const handleSave = () => {
    if (!overlayRef.current) return;
    setSaving(true);
    const bounds = overlayRef.current.getBounds();
    const data = {
      bounds: {
        sw: [bounds.getSouthWest().lat, bounds.getSouthWest().lng],
        ne: [bounds.getNorthEast().lat, bounds.getNorthEast().lng],
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
    width: "90vw", height: "90vh", maxWidth: 1100,
  };
  const btn: React.CSSProperties = {
    background: "none", border: "1px solid #ccc", borderRadius: 4,
    padding: "4px 10px", cursor: "pointer", fontSize: 12, marginLeft: 4,
  };

  return (
    <div style={ctr} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #ddd", fontSize: 14, fontWeight: 600 }}>
          <span>Georreferenciar: {equipoCodigo}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12 }}>Op {Math.round(opacity * 100)}%
              <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={e => setOpacity(Number(e.target.value))} style={{ width: 60, marginLeft: 4 }} />
            </label>
            <button onClick={() => setRotation(r => (r + 90) % 360)} style={btn}>🔄 +90°</button>
            <button onClick={() => setRotation(r => (r - 90 + 360) % 360)} style={btn}>🔄 −90°</button>
            <button onClick={handleSave} disabled={saving || !imageUrl} style={{ ...btn, background: "#1565c0", color: "#fff", border: "none" }}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button onClick={onClose} style={{ ...btn, color: "#c62828" }}>✕ Cerrar</button>
          </div>
        </div>
        <div style={{ flex: 1, position: "relative" }}>
          {loading && <p style={{ padding: 40, textAlign: "center", color: "#666" }}>Cargando plano...</p>}
          <MapContainer
            center={initialCenter}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
            ref={mapRef as any}
            whenReady={() => handleMapReady()}
          >
            <TileLayer
              attribution='&copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
