import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface PuntoGeo { lat: number; lng: number; }

interface Props {
  planoUrl: string;
  equipoCodigo: string;
  equipoId: string;
  initialCenter: [number, number];
  onSave: (data: { center: [number, number]; sw?: [number, number]; ne?: [number, number]; zoom_level: number; mapZoom: number; rotation: number; opacity: number }) => void;
  onClose: () => void;
  saved?: { bounds: { center?: [number, number]; sw?: [number, number]; ne?: [number, number]; map_zoom?: number }; rotation: number; opacity: number; zoom_level?: number } | null;
  onCreateTuberia?: (data: { codigo: string; nivel: string; material?: string; diametro_mm?: number; puntos: PuntoGeo[] }) => Promise<void>;
  onCreateValvula?: (data: { codigo: string; tipo: string; diametro_mm?: number; tuberia_id?: string; punto: PuntoGeo }) => Promise<void>;
  onCreateAntena?: (data: { codigo: string; tipo?: string; punto: PuntoGeo }) => Promise<void>;
  onCreateSonda?: (data: { codigo: string; tipo?: string; profundidad_m?: number; punto: PuntoGeo }) => Promise<void>;
}

type ModoDibujo = null | "tuberia" | "valvula" | "antena" | "sonda";

export default function Georreferenciador({ planoUrl, equipoCodigo, equipoId, initialCenter, onSave, onClose, saved, onCreateTuberia, onCreateValvula, onCreateAntena, onCreateSonda }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageUrlRaw, setImageUrlRaw] = useState("");
  const [loading, setLoading] = useState(true);
  const [opacity, setOpacity] = useState(0.6);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(70);
  const [mapZoom, setMapZoom] = useState(15);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [, setPosition] = useState(0);
  void setPosition;
  const [transparentBg, setTransparentBg] = useState(true);
  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const geoCenterRef = useRef<L.LatLng>(L.latLng(initialCenter[0], initialCenter[1]));
  const dragInfo = useRef({ dragging: false, startLatLng: L.latLng(0, 0) });
  const baseZoomRef = useRef(15);
  const equipoNum = equipoCodigo.replace("Equipo ", "").trim();

  // --- Drawing state ---
  const [modoDibujo, setModoDibujo] = useState<ModoDibujo>(null);
  const [puntosTuberias, setPuntosTuberias] = useState<PuntoGeo[]>([]);
  const [contador, setContador] = useState(0);

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
    baseZoomRef.current = m.getZoom();
    setTimeout(() => { m.invalidateSize(); setReady(true); }, 200);
    return () => { m.remove(); mapRef.current = null; };
  }, []);

  // --- Keep plane anchored to geographic position when map moves/zooms ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const handler = () => {
      setForce(n => n + 1);
      setMapZoom(m.getZoom());
    };
    m.on("move zoom", handler);
    return () => { m.off("move zoom", handler); };
  }, [ready]);

  // --- Reference polygons ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const group = L.layerGroup().addTo(m);
    const h = { "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk" };
    fetch(`https://nnelrvctqjbwfucccxfh.supabase.co/rest/v1/sectores?codigo=like.E${equipoNum}S*&select=codigo,geometria`, { headers: h })
      .then(r => r.json()).then((data: any[]) => { data?.forEach(s => { if (s.geometria) L.geoJSON(s.geometria, { style: { color: "#e65100", weight: 2.5, fill: false, opacity: 0.8 } }).addTo(group); }); }).catch(() => {});
    fetch(`https://nnelrvctqjbwfucccxfh.supabase.co/rest/v1/rpc/get_cuarteles_con_sectores`, { method: "POST", headers: { ...h, "Content-Type": "application/json" } })
      .then(r => r.json()).then((data: any[]) => { data?.forEach(c => { if (c.geojson && c.equipo_riego?.split(" - ")?.some((eq: string) => eq === equipoNum)) L.geoJSON(c.geojson, { style: { color: "#ff9800", weight: 1.5, fillOpacity: 0.1, fillColor: "#ff9800", opacity: 0.5 } }).addTo(group); }); }).catch(() => {});
    return () => { m.removeLayer(group); };
  }, [ready, equipoNum]);

  // --- Restore saved georeference ---
  useEffect(() => {
    if (!saved) return;
    const b = saved.bounds;
    if (b?.center) geoCenterRef.current = L.latLng(b.center[0], b.center[1]);
    if (b?.map_zoom) baseZoomRef.current = b.map_zoom;
    setRotation(saved.rotation);
    setOpacity(saved.opacity);
    if (saved.zoom_level) setZoom(saved.zoom_level);
  }, [saved]);

  // --- Render PDF ---
  useEffect(() => {
    fetch(planoUrl, { headers: { "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk" } })
      .then(r => { if (!r.ok) throw new Error(); return r.arrayBuffer(); })
      .then(buf => pdfjsLib.getDocument({ data: buf }).promise)
      .then(async pdfDoc => {
        const page = await pdfDoc.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width; canvas.height = vp.height;
        rawCanvasRef.current = canvas;
        await page.render({ canvas, viewport: vp }).promise;
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
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [planoUrl]);

  // --- Center overlay initially ---
  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const parent = containerRef.current.parentElement;
    if (!parent) return;
    setPosition(0);
  }, [ready]);

  // --- Drag overlay (moves geographic center) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (modoDibujo) return; // no arrastrar plano mientras dibujamos
    e.preventDefault(); e.stopPropagation();
    const m = mapRef.current;
    if (!m) return;
    m.dragging.disable();
    // Convert clientX/Y to container-relative coords
    const ctrEl = mapContainerRef.current;
    if (ctrEl) {
      const rect = ctrEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      dragInfo.current = { dragging: true, startLatLng: m.containerPointToLatLng([x, y]) };
    }
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragInfo.current.dragging) return;
      const m = mapRef.current;
      if (!m) return;
      // Convert clientX/Y to container-relative coords
      const ctrEl = mapContainerRef.current;
      if (!ctrEl) return;
      const rect = ctrEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const curLL = m.containerPointToLatLng([x, y]);
      const dLat = curLL.lat - dragInfo.current.startLatLng.lat;
      const dLng = curLL.lng - dragInfo.current.startLatLng.lng;
      geoCenterRef.current = L.latLng(geoCenterRef.current.lat - dLat, geoCenterRef.current.lng - dLng);
      dragInfo.current.startLatLng = curLL;
      setForce(n => n + 1);
    };
    const onUp = () => { dragInfo.current.dragging = false; mapRef.current?.dragging.enable(); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const [, setForce] = useState(0);
  const { x: posX, y: posY } = getPixelPos();
  const scaleFactor = getScale();

  // --- Convert geo center to pixel position ---
  function getPixelPos() {
    const m = mapRef.current;
    if (!m) return { x: 0, y: 0 };
    const pt = m.latLngToContainerPoint(geoCenterRef.current);
    return { x: pt.x, y: pt.y };
  }

  function getScale() {
    const m = mapRef.current;
    if (!m) return zoom / 100;
    return (zoom / 100) * Math.pow(2, m.getZoom() - baseZoomRef.current);
  }

  const nudge = useCallback((dLat: number, dLng: number) => {
    geoCenterRef.current = L.latLng(geoCenterRef.current.lat + dLat, geoCenterRef.current.lng + dLng);
    setForce(n => n + 1);
  }, []);
  const nudgeRef = useRef<(dLat: number, dLng: number) => void>(() => {});
  nudgeRef.current = nudge;

  // Cleanup
  useEffect(() => () => {
    const ov = overlayRef.current as any;
    if (ov?._clean) ov._clean();
  }, []);

  // --- Save ---
  const handleSave = () => {
    if (!imageUrl) return alert("Espera que cargue el plano...");
    const m = mapRef.current;
    const img = document.querySelector(".geo-plano-img") as HTMLImageElement;
    if (!m || !img) { alert("Mapa o imagen no disponible"); return; }
    setSaving(true);
    const parent = mapContainerRef.current?.parentElement;
    if (!parent) return;
    const imgRect = img.getBoundingClientRect();
    const ctrRect = parent.getBoundingClientRect();
    const cxPx = (imgRect.left + imgRect.right) / 2 - ctrRect.left;
    const cyPx = (imgRect.top + imgRect.bottom) / 2 - ctrRect.top;
    const ctr = m.containerPointToLatLng([cxPx, cyPx]);
    onSave({ center: [ctr.lat, ctr.lng], rotation, opacity, zoom_level: zoom, mapZoom });
  };

  // --- Click handler for drawing on map ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const onClick = (e: L.LeafletMouseEvent) => {
      if (!modoDibujo) return;
      const punto: PuntoGeo = { lat: e.latlng.lat, lng: e.latlng.lng };

      if (modoDibujo === "tuberia") {
        const nuevos = [...puntosTuberias, punto];
        setPuntosTuberias(nuevos);
      } else if (modoDibujo === "valvula") {
        const codigo = prompt(`Código de la válvula (M${equipoNum}-1, M${equipoNum}-2, etc):`, `M${equipoNum}-${contador + 1}`);
        if (!codigo) { setModoDibujo(null); return; }
        const tipo = prompt("Tipo (transicion/purga/aire/compuerta/otro):", "transicion") || "transicion";
        const diam = prompt("Diámetro mm (opcional):", "");
        if (onCreateValvula) {
          onCreateValvula({ codigo, tipo, diametro_mm: diam ? Number(diam) : undefined, punto }).then(() => {
            setContador(c => c + 1);
          });
        }
        setModoDibujo(null);
      } else if (modoDibujo === "antena") {
        const codigo = prompt("Código de la antena:", `A${equipoNum}-${contador + 1}`);
        if (!codigo) { setModoDibujo(null); return; }
        const tipo = prompt("Tipo (opcional):", "");
        if (onCreateAntena) {
          onCreateAntena({ codigo, tipo: tipo || undefined, punto }).then(() => {
            setContador(c => c + 1);
          });
        }
        setModoDibujo(null);
      } else if (modoDibujo === "sonda") {
        const codigo = prompt("Código de la sonda:", `S${equipoNum}-${contador + 1}`);
        if (!codigo) { setModoDibujo(null); return; }
        const tipo = prompt("Tipo (opcional):", "");
        const prof = prompt("Profundidad m (opcional):", "");
        if (onCreateSonda) {
          onCreateSonda({ codigo, tipo: tipo || undefined, profundidad_m: prof ? Number(prof) : undefined, punto }).then(() => {
            setContador(c => c + 1);
          });
        }
        setModoDibujo(null);
      }
    };
    m.on("click", onClick);
    return () => { m.off("click", onClick); };
  }, [modoDibujo, equipoNum, onCreateValvula, onCreateAntena, onCreateSonda]);

  // --- Double click finishes tuberia drawing ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m || modoDibujo !== "tuberia") return;
    const onDouble = async () => {
      if (puntosTuberias.length < 2) {
        setPuntosTuberias([]);
        setModoDibujo(null);
        return;
      }
      const codigo = prompt(`Código de la tubería:`, `T${equipoNum}-${contador + 1}`);
      if (!codigo) { setPuntosTuberias([]); setModoDibujo(null); return; }
      const nivel = prompt("Nivel (matriz/submatriz/impulsion):", "matriz") || "matriz";
      const material = prompt("Material (PVC/HDPE/acero):", "PVC") || "PVC";
      const diam = prompt("Diámetro mm (opcional):", "");
      if (onCreateTuberia) {
        await onCreateTuberia({ codigo, nivel, material, diametro_mm: diam ? Number(diam) : undefined, puntos: puntosTuberias });
        setContador(c => c + 1);
      }
      setPuntosTuberias([]);
      setModoDibujo(null);
    };
    m.on("dblclick", onDouble);
    return () => { m.off("dblclick", onDouble); };
  }, [modoDibujo, puntosTuberias, contador, onCreateTuberia, equipoNum]);

  // --- Render preview of current tuberia being drawn ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const layer = L.polyline([], { color: "#1565c0", weight: 4, dashArray: "8,8" }).addTo(m);
    (m as any).__tuberiaPreview = layer;
    return () => { m.removeLayer(layer); };
  }, [modoDibujo]);

  useEffect(() => {
    const m = mapRef.current as any;
    if (!m?.__tuberiaPreview) return;
    m.__tuberiaPreview.setLatLngs(puntosTuberias.map(p => L.latLng(p.lat, p.lng)));
  }, [puntosTuberias]);

  const overlayRef = useRef<any>(null);

  // --- Markers of confirmed tuberias/valvulas (to be loaded from DB) ---
  const [tuberiasExistentes, setTuberiasExistentes] = useState<any[]>([]);
  const [valvulasExistentes, setValvulasExistentes] = useState<any[]>([]);

  // Load existing elements for this equipo when drawing mode opens
  useEffect(() => {
    if (!ready || !equipoId) return;
    const h = { "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk" };
    fetch(`https://nnelrvctqjbwfucccxfh.supabase.co/rest/v1/tuberias?equipo_id=eq.${equipoId}`, { headers: h })
      .then(r => r.json()).then(d => setTuberiasExistentes(d || []));
    fetch(`https://nnelrvctqjbwfucccxfh.supabase.co/rest/v1/valvulas?select=*,tuberias!inner(equipo_id)&tuberias.equipo_id=eq.${equipoId}`, { headers: h })
      .then(r => r.json()).then(d => setValvulasExistentes(d || []));
  }, [ready, equipoId, contador]);

  // Render tuberias as polylines
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const layers: L.Polyline[] = [];
    tuberiasExistentes.forEach(t => {
      if (!t.geometria?.coordinates?.[0]) return;
      const color = t.nivel === "matriz" ? "#1565c0" : t.nivel === "impulsion" ? "#2e7d32" : "#c62828";
      const line = L.polyline(t.geometria.coordinates[0].map((c: number[]) => L.latLng(c[1], c[0])), { color, weight: 3 }).addTo(m);
      line.bindTooltip(t.codigo, { permanent: true, direction: "center", className: "cuartel-tooltip" });
      layers.push(line);
    });
    return () => { layers.forEach(l => m.removeLayer(l)); };
  }, [tuberiasExistentes]);

  // Render valvulas as circles
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const layers: L.CircleMarker[] = [];
    valvulasExistentes.forEach(v => {
      if (!v.geometria?.coordinates) return;
      const [lng, lat] = v.geometria.coordinates;
      const c = L.circleMarker([lat, lng], { radius: 6, color: "#e65100", fillColor: "#ff8a65", fillOpacity: 0.9 });
      c.bindTooltip(v.codigo, { permanent: false, className: "cuartel-tooltip" });
      c.addTo(m);
      layers.push(c);
    });
    return () => { layers.forEach(l => m.removeLayer(l)); };
  }, [valvulasExistentes]);

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

        {/* Drawing toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderBottom: "1px solid #eee", background: "#f5f5f5", flexShrink: 0 }}>
          <button onClick={() => setModoDibujo(modoDibujo === "tuberia" ? null : "tuberia")}
            style={{ ...btn, background: modoDibujo === "tuberia" ? "#1565c0" : "white", color: modoDibujo === "tuberia" ? "white" : "#1565c0", fontWeight: 600 }}>📏 Tubería</button>
          <button onClick={() => setModoDibujo(modoDibujo === "valvula" ? null : "valvula")}
            style={{ ...btn, background: modoDibujo === "valvula" ? "#e65100" : "white", color: modoDibujo === "valvula" ? "white" : "#e65100", fontWeight: 600 }}>📍 Válvula</button>
          <button onClick={() => setModoDibujo(modoDibujo === "antena" ? null : "antena")}
            style={{ ...btn, background: modoDibujo === "antena" ? "#1565c0" : "white", color: modoDibujo === "antena" ? "white" : "#1565c0", fontWeight: 600 }}>📡 Antena</button>
          <button onClick={() => setModoDibujo(modoDibujo === "sonda" ? null : "sonda")}
            style={{ ...btn, background: modoDibujo === "sonda" ? "#2e7d32" : "white", color: modoDibujo === "sonda" ? "white" : "#2e7d32", fontWeight: 600 }}>💧 Sonda</button>
          {modoDibujo && (
            <span style={{ fontSize: 12, color: "#e65100", fontWeight: 600, marginLeft: 16 }}>
              {modoDibujo === "tuberia" ? `Click en cada vértice, doble click para cerrar (${puntosTuberias.length} puntos)` : "Click en el mapa para colocar"}
            </span>
          )}
        </div>

        <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, zIndex: 1 }} />
          {loading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, background: "rgba(255,255,255,0.7)" }}><p style={{ color: "#666", fontSize: 14 }}>Cargando plano...</p></div>}
          {imageUrl && !loading && (
            <div style={{
              position: "absolute", left: posX, top: posY,
              transform: `translate(-50%, -50%) scale(${scaleFactor}) rotate(${rotation}deg)`,
              transformOrigin: "center center", zIndex: 10, pointerEvents: "none",
            }}>
              <img src={transparentBg ? imageUrl : (imageUrlRaw || imageUrl)} alt="Plano" className="geo-plano-img" style={{ display: "block", maxWidth: "none", opacity }} />
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
          {!loading && (
            <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.75)", color: "#fff", padding: "6px 14px", borderRadius: 4, fontSize: 12, zIndex: 200, pointerEvents: "none", whiteSpace: "nowrap" }}>
              {modoDibujo ? `Modo dibujo: ${modoDibujo}. Click en el mapa.` : "Arrastrá el plano o usá los botones para dibujar."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
