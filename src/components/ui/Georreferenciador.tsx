import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { supabase } from "../../lib/supabase";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

type DraftType = "matriz" | "impulsion" | "submatriz" | "valvula_electrica" | "valvula_aire" | "antena" | "sonda";

interface Props {
  planoUrl: string;
  equipoCodigo: string;
  equipoId: string;
  initialCenter: [number, number];
  onSave: (data: { center: [number, number]; sw?: [number, number]; ne?: [number, number]; zoom_level: number; mapZoom: number; rotation: number; opacity: number }) => void;
  onClose: () => void;
  saved?: { bounds: { center?: [number, number]; sw?: [number, number]; ne?: [number, number]; map_zoom?: number }; rotation: number; opacity: number; zoom_level?: number } | null;
}

export default function Georreferenciador({ planoUrl, equipoCodigo, equipoId, initialCenter, onSave, onClose, saved }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [opacity, setOpacity] = useState(0.6);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(saved?.zoom_level || 200);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  const [transparentBg, setTransparentBg] = useState(true);
  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const geoCenterRef = useRef<L.LatLng>(L.latLng(initialCenter[0], initialCenter[1]));
  const equipoNum = equipoCodigo.replace("Equipo ", "").trim();

  // --- Geoman drawing state ---
  const [draft, setDraft] = useState<{ geojson: any; layer: any; tipo: DraftType | null } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const layerRefs = useRef<Map<string, any>>(new Map());
  const capasRef = useRef<any[]>([]);

  const [tuberiasExistentes, setTuberiasExistentes] = useState<any[]>([]);
  const [valvulasExistentes, setValvulasExistentes] = useState<any[]>([]);
  const [antenasExistentes, setAntenasExistentes] = useState<any[]>([]);
  const [sondasExistentes, setSondasExistentes] = useState<any[]>([]);
  const [contador, setContador] = useState(0);

  // --- Init map ---
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const savedCenter = saved?.bounds?.center;
    const savedZoom = saved?.bounds?.map_zoom;
    const m = L.map(mapContainerRef.current, {
      center: savedCenter || initialCenter, zoom: savedZoom || 15, zoomControl: true,
      dragging: true, scrollWheelZoom: true, doubleClickZoom: true,
    });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "&copy; Esri",
    }).addTo(m);
    mapRef.current = m;
    if (savedCenter) geoCenterRef.current = L.latLng(savedCenter[0], savedCenter[1]);
    setTimeout(() => { m.invalidateSize(); setReady(true); }, 200);
    return () => { m.remove(); mapRef.current = null; };
  }, []);

  // --- Inicializar Geoman ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;

    m.pm.addControls({
      position: "topleft",
      drawMarker: true,
      drawPolyline: true,
      drawPolygon: false,
      drawRectangle: false,
      drawCircle: false,
      drawCircleMarker: false,
      drawText: false,
      cutPolygon: true,
      editMode: true,
      dragMode: true,
      removalMode: true,
      rotateMode: false,
      snapOption: true,
    });

    m.pm.setGlobalOptions({
      snappable: true,
      snapDistance: 20,
      snapMiddle: true,
      allowSelfIntersection: false,
    });

    return () => { m.pm.removeControls(); };
  }, [ready]);

  // --- L.imageOverlay: el plano es una capa de Leaflet (zoom/pan automatico) ---
  const imgOverlayRef = useRef<L.ImageOverlay | null>(null);

  function recalcBounds() {
    const m = mapRef.current;
    if (!m) return null;
    const ctr = geoCenterRef.current;
    const ctrPt = m.latLngToContainerPoint(ctr);
    const natW = rawCanvasRef.current?.width || 1000;
    const natH = rawCanvasRef.current?.height || 1000;
    const s = zoom / 100;
    const sw = m.containerPointToLatLng([ctrPt.x - natW * s / 2, ctrPt.y + natH * s / 2]);
    const ne = m.containerPointToLatLng([ctrPt.x + natW * s / 2, ctrPt.y - natH * s / 2]);
    return L.latLngBounds(sw, ne);
  }

  // Crear o actualizar overlay cuando cambian los parametros
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !imageUrl || !ready) return;
    const bounds = recalcBounds();
    if (!bounds) return;

    // Remover overlay anterior
    if (imgOverlayRef.current) m.removeLayer(imgOverlayRef.current);

    const ov = L.imageOverlay(imageUrl, bounds, { opacity }).addTo(m);
    console.log("Overlay creado, zoom:", zoom, "bounds:", bounds.toBBoxString());
    // Aplicar rotacion
    const el = ov.getElement();
    if (el && rotation) {
      el.style.transformOrigin = "center center";
      el.style.transform += ` rotate(${rotation}deg)`;
    }
    imgOverlayRef.current = ov;
    return () => { if (imgOverlayRef.current) m.removeLayer(imgOverlayRef.current); imgOverlayRef.current = null; };
  }, [imageUrl, zoom, rotation, opacity, ready]);

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

  // --- Restore saved georeference (rotation, opacity, zoom) ---
  useEffect(() => {
    if (!saved) return;
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
  const [, setForce] = useState(0);
  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const parent = containerRef.current.parentElement;
    if (!parent) return;
    setForce(n => n + 1);
  }, [ready]);

  const nudge = useCallback((dLat: number, dLng: number) => {
    geoCenterRef.current = L.latLng(geoCenterRef.current.lat + dLat, geoCenterRef.current.lng + dLng);
    const ov = imgOverlayRef.current;
    if (ov) { const b = recalcBounds(); if (b) ov.setBounds(b); }
    setForce(n => n + 1);
  }, [zoom]);
  const nudgeRef = useRef<(dLat: number, dLng: number) => void>(() => {});
  nudgeRef.current = nudge;

  // Cleanup
  useEffect(() => () => {
    const ov = imgOverlayRef.current as any;
    if (ov?._clean) ov._clean();
  }, []);

  // --- Middle-click drag: agarrar y mover el plano con la rueda del mouse ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let dragging = false;
    let startLatLng = L.latLng(0, 0);
    const onDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      const m = mapRef.current;
      if (!m) return;
      m.dragging.disable();
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      startLatLng = m.containerPointToLatLng([x, y]);
      dragging = true;
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const m = mapRef.current;
      if (!m) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const curLL = m.containerPointToLatLng([x, y]);
      const dLat = curLL.lat - startLatLng.lat;
      const dLng = curLL.lng - startLatLng.lng;
      geoCenterRef.current = L.latLng(geoCenterRef.current.lat + dLat, geoCenterRef.current.lng + dLng);
      startLatLng = curLL;
      const ov = imgOverlayRef.current;
      if (ov) { const b = recalcBounds(); if (b) ov.setBounds(b); }
      setForce(n => n + 1);
    };
    const onUp = () => {
      dragging = false;
      mapRef.current?.dragging.enable();
    };
    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // --- pm:create handler ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const handleCreate = (e: any) => {
      const layer = e.layer;
      const geojson = layer.toGeoJSON();
      // Remove from map until confirmed
      m.removeLayer(layer);
      setDraft({ geojson, layer, tipo: null });
      setShowForm(true);
    };
    m.on("pm:create", handleCreate);
    return () => { m.off("pm:create", handleCreate); };
  }, []);

  // --- pm:cut handler ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const handleCut = (e: any) => {
      // Build a list of resulting layers to insert
      // The original layer was already removed by Geoman
      const nuevas: any[] = [];
      e.layers.eachLayer((l: any) => {
        nuevas.push({ geojson: l.toGeoJSON(), layer: l });
      });
      // TODO: save both pieces
      console.log("Cut result:", nuevas.length, "pieces");
      setContador(c => c + 1);
    };
    m.on("pm:cut", handleCut);
    return () => { m.off("pm:cut", handleCut); };
  }, []);

  // --- Save draft ---
  const handleConfirmarDraft = async (tipo: DraftType, codigo: string, extra?: any) => {
    if (!draft) return;
    const { geojson } = draft;
    const m = mapRef.current;
    if (!m) return;

    const colores: Record<string, string> = {
      matriz: "#1565c0", impulsion: "#2e7d32", submatriz: "#c62828",
      valvula_electrica: "#e65100", valvula_aire: "#42a5f5",
      antena: "#6a1b9a", sonda: "#f9a825",
    };

    if (!equipoId) { alert("Equipo no encontrado"); return; }

    const isLine = tipo === "matriz" || tipo === "impulsion" || tipo === "submatriz";
    const table = isLine ? "tuberias" : (tipo === "valvula_electrica" || tipo === "valvula_aire" ? "valvulas" : (tipo === "antena" ? "antenas" : "sondas"));

    const insertData: any = {
      codigo,
      geometria: geojson.geometry,
    };

    if (isLine) {
      insertData.nivel = tipo;
      insertData.material = extra?.material || "PVC";
      insertData.diametro_mm = extra?.diametro_mm ? Number(extra.diametro_mm) : null;
      insertData.equipo_id = equipoId;
    } else if (tipo === "valvula_electrica" || tipo === "valvula_aire") {
      insertData.tipo = tipo === "valvula_aire" ? "aire" : "transicion";
      insertData.diametro_mm = extra?.diametro_mm ? Number(extra.diametro_mm) : null;
      insertData.equipo_id = equipoId;
    } else if (tipo === "antena" || tipo === "sonda") {
      insertData.equipo_id = equipoId;
    }

    // Insert via authenticated supabase client (bypasses RLS anon restrictions)
    const { data, error } = await supabase.from(table).insert(insertData).select();
    if (error) { alert("Error al guardar: " + error.message); return; }
    if (!data || data.length === 0) return;
    const nuevo = data[0];
    // Add layer to map with correct style
    const color = colores[tipo];
    let layer: any;
    if (geojson.geometry.type === "LineString") {
      layer = L.geoJSON(geojson, {
        style: { color, weight: 4, opacity: 0.85 },
      }).addTo(m);
    } else {
      layer = L.marker([geojson.geometry.coordinates[1], geojson.geometry.coordinates[0]], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:12px;height:12px;background:${color};border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
          iconSize: [12, 12], iconAnchor: [6, 6],
        }),
      }).addTo(m);
    }
    (layer.pm as any)?.setOptions?.({ layerId: nuevo.id, snappable: true });
    layerRefs.current.set(nuevo.id, layer);
    capasRef.current.push(layer);
    setDraft(null);
    setShowForm(false);
    setContador(c => c + 1);
  };

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
    onSave({ center: [ctr.lat, ctr.lng], rotation, opacity, zoom_level: zoom, mapZoom: m.getZoom() });
  };

  // --- Load existing elements for this equipo ---
  useEffect(() => {
    if (!ready || !equipoId) return;
    const h = { "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk" };
    const api = "https://nnelrvctqjbwfucccxfh.supabase.co/rest/v1/";
    fetch(api + `tuberias?equipo_id=eq.${equipoId}`, { headers: h })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setTuberiasExistentes(d); }).catch(e => console.warn("Error tuberias:", e));
    fetch(api + `tuberias?select=id&equipo_id=eq.${equipoId}`, { headers: h })
      .then(r => r.json())
      .then(ts => {
        const ids = (Array.isArray(ts) ? ts : []).map((t: any) => t.id).filter(Boolean);
        let url = api + `valvulas?or=(tuberia_id.is.null`;
        if (ids.length > 0) url += `,tuberia_id.in.(${ids.join(",")})`;
        url += `)`;
        fetch(url, { headers: h })
          .then(r => r.json()).then(d => { if (Array.isArray(d)) setValvulasExistentes(d); }).catch(e => console.warn("Error valvulas:", e));
      }).catch(e => console.warn("Error valvulas step1:", e));
    fetch(api + `antenas?limit=100`, { headers: h })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setAntenasExistentes(d); }).catch(e => console.warn("Error antenas:", e));
    fetch(api + `sondas?limit=100`, { headers: h })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setSondasExistentes(d); }).catch(e => console.warn("Error sondas:", e));
  }, [ready, equipoId, contador]);

  // --- Render ALL existing elements as Geoman-capable layers ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    // Clear previous
    capasRef.current.forEach(l => m.removeLayer(l));
    capasRef.current = [];
    layerRefs.current.clear();

    const colores: Record<string, string> = {
      matriz: "#1565c0", impulsion: "#2e7d32", submatriz: "#c62828",
      valvula_electrica: "#e65100", valvula_aire: "#42a5f5",
      antena: "#6a1b9a", sonda: "#f9a825",
    };

    [...tuberiasExistentes, ...antenasExistentes, ...sondasExistentes].forEach((item: any) => {
      if (!item.geometria?.coordinates) return;
      const isLine = item.geometria.type === "LineString" || item.geometria.type === "MultiLineString";
      const key = isLine ? (item.nivel || "otro") : item.tipo || "otro";
      const color = colores[key] || "#999";
      let layer: any;
      if (isLine) {
        layer = L.geoJSON(item.geometria, { style: { color, weight: 4, opacity: 0.85 } }).addTo(m);
      } else {
        layer = L.marker([item.geometria.coordinates[1], item.geometria.coordinates[0]], {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:12px;height:12px;background:${color};border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
            iconSize: [12, 12], iconAnchor: [6, 6],
          }),
        }).addTo(m);
      }
      (layer.pm as any)?.setOptions?.({ layerId: item.id, snappable: true, draggable: false });
      layerRefs.current.set(item.id, layer);
      capasRef.current.push(layer);
    });

    // Valvulas separately with specific colors
    valvulasExistentes.forEach((v: any) => {
      if (!v.geometria?.coordinates) return;
      const color = v.tipo === "aire" ? "#42a5f5" : "#e65100";
      const layer = L.marker([v.geometria.coordinates[1], v.geometria.coordinates[0]], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:12px;height:12px;background:${color};border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
          iconSize: [12, 12], iconAnchor: [6, 6],
        }),
      }).addTo(m);
      (layer.pm as any)?.setOptions?.({ layerId: v.id, snappable: true, draggable: false });
      layerRefs.current.set(v.id, layer);
      capasRef.current.push(layer);
    });

    return () => {
      capasRef.current.forEach(l => m.removeLayer(l));
      capasRef.current = [];
      layerRefs.current.clear();
    };
  }, [tuberiasExistentes, valvulasExistentes, antenasExistentes, sondasExistentes, ready]);

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

        {/* Geoman drawing info bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderBottom: "1px solid #eee", background: "#f5f5f5", flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>
            Dibujar: usar las herramientas del mapa (🟦 línea, 📍 punto) o ✂️ Cortar para dividir tuberías
          </span>
        </div>

        {showForm && draft && (
          <DraftForm
            tipo={draft.tipo}
            onChangeTipo={(t: DraftType) => setDraft({ ...draft, tipo: t })}
            onConfirm={(tipo, codigo, extra) => handleConfirmarDraft(tipo, codigo, extra)}
            onCancel={() => { setDraft(null); setShowForm(false); }}
          />
        )}

        <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, zIndex: 1 }} />
            {loading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, background: "rgba(255,255,255,0.7)" }}><p style={{ color: "#666", fontSize: 14 }}>Cargando plano...</p></div>}
            {!loading && (
              <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.75)", color: "#fff", padding: "6px 14px", borderRadius: 4, fontSize: 12, zIndex: 200, pointerEvents: "none", whiteSpace: "nowrap" }}>
                Rueda: agarrar plano | Click izq: navegar
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Draft Form Component ─────────────────────────────────────────────────────

function DraftForm({ tipo, onChangeTipo, onConfirm, onCancel }: {
  tipo: DraftType | null;
  onChangeTipo: (t: DraftType) => void;
  onConfirm: (tipo: DraftType, codigo: string, extra?: any) => void;
  onCancel: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [material, setMaterial] = useState("PVC");
  const [diametro, setDiametro] = useState("");
  const options: DraftType[] = ["matriz", "impulsion", "submatriz", "valvula_electrica", "valvula_aire", "antena", "sonda"];
  const isLine = tipo === "matriz" || tipo === "impulsion" || tipo === "submatriz";

  return (
    <div style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fff3e0", fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, color: "#e65100" }}>Confirmar nuevo elemento</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={tipo || ""} onChange={e => onChangeTipo(e.target.value as DraftType)} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 12 }}>
          <option value="" disabled>Seleccionar tipo</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <input placeholder="Código" value={codigo} onChange={e => setCodigo(e.target.value)} style={{ width: 80, padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 12 }} />
        {isLine && (
          <select value={material} onChange={e => setMaterial(e.target.value)} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 12 }}>
            <option value="PVC">PVC</option>
            <option value="HDPE">HDPE</option>
            <option value="Acero">Acero</option>
          </select>
        )}
        <input placeholder="Ø mm" value={diametro} onChange={e => setDiametro(e.target.value)} style={{ width: 60, padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 12 }} />
        <button onClick={() => { if (!tipo || !codigo) { alert("Seleccioná tipo y código"); return; } onConfirm(tipo, codigo, { material, diametro_mm: diametro }); }} style={{ padding: "6px 14px", background: "#2e7d32", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>✓ Guardar</button>
        <button onClick={onCancel} style={{ padding: "6px 14px", background: "#c62828", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>✕ Cancelar</button>
      </div>
    </div>
  );
}
