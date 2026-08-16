import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "../../lib/supabase";

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
  onCreateTuberia?: (data: { codigo: string; nivel: string; material?: string; diametro_mm?: number; tuberia_padre_id?: string; puntos: PuntoGeo[] }) => Promise<void>;
  onUpdateTuberia?: (id: string, puntos: PuntoGeo[]) => Promise<void>;
  onDeleteTuberia?: (id: string) => Promise<void>;
  onCreateValvula?: (data: { codigo: string; tipo?: string; diametro_mm?: number; tuberia_id?: string; sector_codigo?: string; punto: PuntoGeo }) => Promise<void>;
  onUpdateValvula?: (id: string, punto: PuntoGeo) => Promise<void>;
  onUpdateValvulaData?: (id: string, data: { bloque_riego?: string; diametro_mm?: number; activacion?: string; sector_codigo?: string; color?: string }) => Promise<void>;
  onDeleteValvula?: (id: string) => Promise<void>;
  onCreateAntena?: (data: { codigo: string; tipo?: string; punto: PuntoGeo }) => Promise<void>;
  onCreateSonda?: (data: { codigo: string; tipo?: string; profundidad_m?: number; punto: PuntoGeo }) => Promise<void>;
}

type ModoDibujo = null | "tuberia" | "valvula" | "antena" | "sonda";

export default function Georreferenciador({ planoUrl, equipoCodigo, equipoId, initialCenter, onSave, onClose, saved, onCreateTuberia, onUpdateTuberia, onDeleteTuberia, onCreateValvula, onUpdateValvula, onUpdateValvulaData, onDeleteValvula, onCreateAntena, onCreateSonda }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageUrlRaw, setImageUrlRaw] = useState("");
  const [loading, setLoading] = useState(true);
  const [opacity, setOpacity] = useState(0.6);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [mapZoom, setMapZoom] = useState(15);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [transparentBg, setTransparentBg] = useState(true);
  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const geoCenterRef = useRef<L.LatLng>(L.latLng(initialCenter[0], initialCenter[1]));
  const dragInfo = useRef({ dragging: false, startLatLng: L.latLng(0, 0) });
  const equipoNum = equipoCodigo.replace("Equipo ", "").trim();

  // --- Drawing state ---
  const [modoDibujo, setModoDibujo] = useState<ModoDibujo>(null);
  const [puntosTuberias, setPuntosTuberias] = useState<PuntoGeo[]>([]);
  const puntosTuberiasRef = useRef<PuntoGeo[]>([]);
  puntosTuberiasRef.current = puntosTuberias;
  const [nivelTuberia, setNivelTuberia] = useState<string>("matriz");
  const [contador, setContador] = useState(0);
  // --- Editing state ---
  const [editandoValvula, setEditandoValvula] = useState<any>(null);
  const [modoMover, setModoMover] = useState(false);
  const [showPanelValvulas, setShowPanelValvulas] = useState(false);
  const [editandoTuberia, setEditandoTuberia] = useState<any>(null);
  const [showPanelTuberias, setShowPanelTuberias] = useState(false);
  const [editandoVertices, setEditandoVertices] = useState(false);
  // --- Valve editor panel state ---
  const [editValvulaOpen, setEditValvulaOpen] = useState(false);
  const [editValvulaData, setEditValvulaData] = useState<any>(null);
  const [formBloque, setFormBloque] = useState("");
  const [formDiametro, setFormDiametro] = useState("");
  const [formActivacion, setFormActivacion] = useState("");
  const [formSector, setFormSector] = useState("");
  const [formColor, setFormColor] = useState("#ef5350");

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
    const pane = m.createPane("valvulas");
    pane.style.zIndex = "650";
    mapRef.current = m;
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
    supabase.from("sectores").select("codigo,geometria").like("codigo", `E${equipoNum}S%`).then(({ data }: any) => {
      data?.forEach((s: any) => { if (s.geometria) L.geoJSON(s.geometria, { style: { color: "#e65100", weight: 2.5, fill: false, opacity: 0.8 } }).addTo(group); });
    });
    supabase.rpc("get_cuarteles_con_sectores").then(({ data }: any) => {
      data?.forEach((c: any) => { if (c.geojson && c.equipo_riego?.split(" - ")?.some((eq: string) => eq === equipoNum)) L.geoJSON(c.geojson, { style: { color: "#ff9800", weight: 1.5, fillOpacity: 0.1, fillColor: "#ff9800", opacity: 0.5 } }).addTo(group); });
    });
    return () => { m.removeLayer(group); };
  }, [ready, equipoNum]);

  // --- Restore saved georeference ---
  useEffect(() => {
    if (!saved) return;
    const b = saved.bounds;
    if (b?.center) geoCenterRef.current = L.latLng(b.center[0], b.center[1]);
    setRotation(saved.rotation);
    setOpacity(saved.opacity);
    if (saved.zoom_level) setZoom(Math.max(3, Math.min(2000, saved.zoom_level)));
  }, [saved]);

  // --- Render PDF ---
  useEffect(() => {
    fetch(planoUrl)
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
        // Auto-fit initial zoom
        if (!saved?.zoom_level) {
          const container = mapContainerRef.current?.parentElement;
          if (container) {
            const cw = container.clientWidth;
            setZoom(Math.max(3, Math.min(2000, Math.round((cw * 0.7 / canvas.width) * 100))));
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [planoUrl]);

  // --- Middle-click drag on plane image (moves geographic center) ---
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 1 || modoDibujo) return;
      const imgEl = document.querySelector(".geo-plano-img") as HTMLImageElement;
      if (!imgEl) return;
      const rect = imgEl.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      e.preventDefault();
      const m = mapRef.current;
      if (!m) return;
      const ctrEl = mapContainerRef.current;
      if (!ctrEl) return;
      const ctrRect = ctrEl.getBoundingClientRect();
      dragInfo.current = { dragging: true, startLatLng: m.containerPointToLatLng([e.clientX - ctrRect.left, e.clientY - ctrRect.top]) };
      m.dragging.disable();
    };
    const onMove = (e: MouseEvent) => {
      if (!dragInfo.current.dragging) return;
      const m = mapRef.current;
      if (!m) return;
      const ctrEl = mapContainerRef.current;
      if (!ctrEl) return;
      const rect = ctrEl.getBoundingClientRect();
      const curLL = m.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top]);
      const dLat = curLL.lat - dragInfo.current.startLatLng.lat;
      const dLng = curLL.lng - dragInfo.current.startLatLng.lng;
      geoCenterRef.current = L.latLng(geoCenterRef.current.lat + dLat, geoCenterRef.current.lng + dLng);
      dragInfo.current.startLatLng = curLL;
      setForce(n => n + 1);
    };
    const onUp = () => { dragInfo.current.dragging = false; mapRef.current?.dragging.enable(); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [modoDibujo]);

  const [, setForce] = useState(0);
  const { x: posX, y: posY } = getPixelPos();

  // --- Convert geo center to pixel position ---
  function getPixelPos() {
    const m = mapRef.current;
    if (!m) return { x: 0, y: 0 };
    const pt = m.latLngToContainerPoint(geoCenterRef.current);
    return { x: pt.x, y: pt.y };
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
  const handleSave = async () => {
    if (!imageUrl) return alert("Espera que cargue el plano...");
    const m = mapRef.current;
    const img = document.querySelector(".geo-plano-img") as HTMLImageElement;
    if (!m || !img) { alert("Mapa o imagen no disponible"); return; }
    setSaving(true);
    try {
      const parent = mapContainerRef.current?.parentElement;
      if (!parent) return;
      const ctrRect = parent.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();
      const cxPx = (imgRect.left + imgRect.right) / 2;
      const cyPx = (imgRect.top + imgRect.bottom) / 2;
      const angleRad = (rotation * Math.PI) / 180;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      const rotW = imgRect.width / 2;
      const rotH = imgRect.height / 2;
      // Recover original unrotated half-dimensions from rotated bbox
      const origW = (rotW * Math.abs(cos) + rotH * Math.abs(sin)) / (cos * cos + sin * sin);
      const origH = (rotW * Math.abs(sin) + rotH * Math.abs(cos)) / (cos * cos + sin * sin);
      // Rotate the 4 corners of the unrotated rect
      const corners = [
        { x: -origW, y: -origH },
        { x: origW, y: -origH },
        { x: origW, y: origH },
        { x: -origW, y: origH },
      ].map(c => ({
        x: cxPx + c.x * cos - c.y * sin,
        y: cyPx + c.x * sin + c.y * cos,
      }));
      const lats = corners.map(c => m.containerPointToLatLng([c.x - ctrRect.left, c.y - ctrRect.top]).lat);
      const lngs = corners.map(c => m.containerPointToLatLng([c.x - ctrRect.left, c.y - ctrRect.top]).lng);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
      await onSave({
        center: [(minLat + maxLat) / 2, (minLng + maxLng) / 2],
        sw: [minLat, minLng],
        ne: [maxLat, maxLng],
        rotation, opacity, zoom_level: zoom, mapZoom,
      });
    } catch (e: any) {
      alert("Error al guardar: " + (e?.message || e));
      setSaving(false);
    }
  };

  // --- Click handler for drawing and valve move on map ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const onClick = (e: L.LeafletMouseEvent) => {
      const punto: PuntoGeo = { lat: e.latlng.lat, lng: e.latlng.lng };

      // Valve reposition mode
      if (modoMover && editandoValvula?.id) {
        if (onUpdateValvula) {
          onUpdateValvula(editandoValvula.id, punto).then(() => {
            setContador(c => c + 1);
          });
        }
        setEditandoValvula(null);
        setModoMover(false);
        return;
      }

      if (!modoDibujo) return;
      if (modoDibujo === "tuberia") {
        setPuntosTuberias(prev => {
          const snapThreshold = 15 / Math.pow(2, mapZoom) * 0.002;
          let puntoFinal = punto;
          let snapId: string | undefined;
          for (const t of tuberiasExistentes) {
            const coords = t.geometria?.type === "MultiLineString" ? t.geometria?.coordinates?.[0] : t.geometria?.coordinates;
            if (!coords?.length) continue;
            for (const end of [{ lat: coords[0][1], lng: coords[0][0] }, { lat: coords[coords.length - 1][1], lng: coords[coords.length - 1][0] }]) {
              const d = Math.sqrt((end.lat - punto.lat) ** 2 + (end.lng - punto.lng) ** 2);
              if (d < snapThreshold) { puntoFinal = end; snapId = t.id; break; }
            }
            if (snapId) break;
          }
          const nuevos = [...prev, puntoFinal];
          if (nuevos.length === 1 && snapId) (window as any).__snappedTuberiaPadre = snapId;
          else if (nuevos.length > 1) snapId = (window as any).__snappedTuberiaPadre;
          (window as any).__tuberiaSnapId = snapId;
          return nuevos;
        });
      } else if (modoDibujo === "valvula") {
        const codigo = `V${equipoNum}-${contador + 1}`;
        const sectorCodigo = prompt("Código del sector (ej: E3S1):") || "";
        const localId = Date.now();
        setValvulasLocales(v => [...v, { localId, codigo, geometria: { type: "Point", coordinates: [punto.lng, punto.lat] } }]);
        if (onCreateValvula) {
          onCreateValvula({ codigo, punto, sector_codigo: sectorCodigo || undefined }).then(() => {
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
  }, [modoDibujo, modoMover, editandoValvula, equipoNum, onCreateValvula, onCreateAntena, onCreateSonda, onUpdateValvula]);

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
      const codigo = prompt(`Código de la tubería ${nivelTuberia.toUpperCase()}:`, `T${equipoNum}-${contador + 1}`);
      if (!codigo) { setPuntosTuberias([]); setModoDibujo(null); (window as any).__snappedTuberiaPadre = null; return; }
      const material = prompt("Material (PVC/HDPE/acero):", "PVC") || "PVC";
      const diam = prompt("Diámetro mm (opcional):", "");
      const tuberiaPadreId = (window as any).__tuberiaSnapId || undefined;
      (window as any).__snappedTuberiaPadre = null;
      (window as any).__tuberiaSnapId = null;
      if (onCreateTuberia) {
        await onCreateTuberia({ codigo, nivel: nivelTuberia, material, diametro_mm: diam ? Number(diam) : undefined, tuberia_padre_id: tuberiaPadreId, puntos: puntosTuberias });
        setContador(c => c + 1);
      }
      setPuntosTuberias([]);
      setModoDibujo(null);
      setShowPanelTuberias(true);
    };
    m.on("dblclick", onDouble);
    return () => { m.off("dblclick", onDouble); };
  }, [modoDibujo, puntosTuberias, contador, onCreateTuberia, equipoNum]);

  // --- Render preview of current tuberia being drawn ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const color = nivelTuberia === "matriz" ? "#1565c0" : nivelTuberia === "impulsion" ? "#2e7d32" : "#c62828";
    const layer = L.polyline([], { color, weight: 4, dashArray: "8,8" }).addTo(m);
    (m as any).__tuberiaPreview = layer;
    return () => { m.removeLayer(layer); };
  }, [modoDibujo, nivelTuberia]);

  useEffect(() => {
    const m = mapRef.current as any;
    if (!m?.__tuberiaPreview) return;
    m.__tuberiaPreview.setLatLngs(puntosTuberias.map(p => L.latLng(p.lat, p.lng)));
  }, [puntosTuberias]);

  const overlayRef = useRef<any>(null);

  // --- Markers of confirmed tuberias/valvulas (to be loaded from DB) ---
  const [tuberiasExistentes, setTuberiasExistentes] = useState<any[]>([]);
  const [valvulasExistentes, setValvulasExistentes] = useState<any[]>([]);
  const [valvulasLocales, setValvulasLocales] = useState<any[]>([]); // placed this session, not saved yet

  // Load existing elements for this equipo when drawing mode opens
  useEffect(() => {
    if (!ready || !equipoId) return;
    supabase.from("tuberias").select("*").eq("equipo_id", equipoId).then(({ data }) => setTuberiasExistentes(data || []));
    supabase.from("valvulas").select("*").order("created_at", { ascending: false }).then(({ data }) => setValvulasExistentes(data || []));
  }, [ready, equipoId, contador]);

  // Render tuberias as polylines (clickeable)
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const layers: L.Polyline[] = [];
    tuberiasExistentes.forEach(t => {
      if (!t.geometria?.coordinates?.length) return;
      const color = t.nivel === "matriz" ? "#1565c0" : t.nivel === "impulsion" ? "#2e7d32" : "#c62828";
      const coords = t.geometria.type === "MultiLineString" ? t.geometria.coordinates[0] : t.geometria.coordinates;
      const latlngs = coords.map((c: number[]) => L.latLng(c[1], c[0]));
      const line = L.polyline(latlngs, { color, weight: 5 }).addTo(m);
      line.bindTooltip(t.codigo, { permanent: true, direction: "center", className: "cuartel-tooltip" });
      line.on("click", () => { if (!modoDibujo) setEditandoTuberia(t); });
      line.on("dblclick", () => {
        if (modoDibujo || editandoVertices) return;
        setEditandoTuberia(t);
        setEditandoVertices(true);
        showVertexMarkers(m, t.id, latlngs);
      });
      layers.push(line);
    });
    return () => { layers.forEach(l => m.removeLayer(l)); };
  }, [tuberiasExistentes, modoDibujo]);

  // Render valvulas as red circles (both from DB and local)
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const layers: L.CircleMarker[] = [];
    const render = (v: any) => {
      if (!v.geometria?.coordinates) return;
      const [lng, lat] = v.geometria.coordinates;
      const fillCol = v.color || "#ef5350";
      const c = L.circleMarker([lat, lng], { radius: 8, color: fillCol, fillColor: fillCol, fillOpacity: 0.9, pane: "valvulas" });
      c.bindTooltip(`${v.codigo}${v.sector_codigo ? " ("+v.sector_codigo+")" : ""}${v.id ? " [click]" : ""}`, { permanent: false, className: "cuartel-tooltip" });
      if (v.id) {
        c.on("click", () => { if (!modoDibujo) setEditandoValvula(v); });
        c.on("dblclick", () => {
          if (modoDibujo) return;
          setEditValvulaData(v);
          setFormBloque(v.bloque_riego || "");
          setFormDiametro(v.diametro_mm ? String(v.diametro_mm) : "");
          setFormActivacion(v.activacion || "");
          setFormSector(v.sector_codigo || "");
          setFormColor(v.color || "#ef5350");
          setEditValvulaOpen(true);
        });
      }
      c.addTo(m);
      layers.push(c);
    };
    valvulasExistentes.forEach(render);
    valvulasLocales.forEach(render);
    return () => { layers.forEach(l => m.removeLayer(l)); };
  }, [valvulasExistentes, valvulasLocales, modoDibujo]);

  // --- Vertex editing for tuberias ---
  const vertexRef = useRef<L.Marker[]>([]);
  const tuberiaEditLineRef = useRef<L.Polyline | null>(null);

  const showVertexMarkers = useCallback((m: L.Map, _tuberiaId: string, latlngs: L.LatLng[]) => {
    // Remove existing vertex markers
    vertexRef.current.forEach(v => m.removeLayer(v));
    vertexRef.current = [];
    tuberiaEditLineRef.current?.remove();
    // Create draggable markers at each vertex
    const markers = latlngs.map((ll, i) => {
      const divIcon = L.divIcon({ html: `<div style="width:14px;height:14px;border-radius:50%;background:#1565c0;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.5)"></div>`, iconSize: [14, 14], iconAnchor: [7, 7], className: "" });
      const mk = L.marker(ll, { icon: divIcon, draggable: true });
      mk.bindTooltip(`${i + 1}`, { permanent: true, direction: "top", className: "cuartel-tooltip", offset: L.point(0, -10) });
      mk.on("drag", () => {
        const pts = vertexRef.current.map(v => v.getLatLng());
        tuberiaEditLineRef.current?.setLatLngs(pts);
      });
      mk.addTo(m);
      return mk;
    });
    vertexRef.current = markers;
    // Preview line
    const editLine = L.polyline(latlngs, { color: "#1565c0", weight: 3, dashArray: "6,4" }).addTo(m);
    tuberiaEditLineRef.current = editLine;
  }, []);

  // Cleanup vertex editing when exiting edit mode
  useEffect(() => {
    if (editandoVertices) return;
    const m = mapRef.current;
    if (!m) return;
    vertexRef.current.forEach(v => m.removeLayer(v));
    vertexRef.current = [];
    tuberiaEditLineRef.current?.remove();
    tuberiaEditLineRef.current = null;
  }, [editandoVertices]);

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
          {modoDibujo === "tuberia" && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 16 }}>
              <span style={{ fontSize: 12, color: "#e65100", fontWeight: 600 }}>Nivel:</span>
              <button onClick={() => setNivelTuberia("matriz")} style={{ ...btn, padding: "2px 8px", fontSize: 11, fontWeight: 600, background: nivelTuberia === "matriz" ? "#1565c0" : "white", color: nivelTuberia === "matriz" ? "white" : "#1565c0", border: "1px solid #1565c0" }}>🔵 Matriz</button>
              <button onClick={() => setNivelTuberia("submatriz")} style={{ ...btn, padding: "2px 8px", fontSize: 11, fontWeight: 600, background: nivelTuberia === "submatriz" ? "#c62828" : "white", color: nivelTuberia === "submatriz" ? "white" : "#c62828", border: "1px solid #c62828" }}>🔴 Submatriz</button>
              <button onClick={() => setNivelTuberia("impulsion")} style={{ ...btn, padding: "2px 8px", fontSize: 11, fontWeight: 600, background: nivelTuberia === "impulsion" ? "#2e7d32" : "white", color: nivelTuberia === "impulsion" ? "white" : "#2e7d32", border: "1px solid #2e7d32" }}>🟢 Impulsión</button>
              <span style={{ fontSize: 12, color: "#666", marginLeft: 4 }}>{puntosTuberias.length} pts | doble click para cerrar</span>
              {puntosTuberias.length > 0 && <button onClick={() => setPuntosTuberias(prev => prev.slice(0, -1))} style={{ ...btn, padding: "2px 6px", fontSize: 10, color: "#c62828", marginLeft: 4 }}>↩ Deshacer</button>}
            </span>
          )}
          {modoDibujo && modoDibujo !== "tuberia" && (
            <span style={{ fontSize: 12, color: "#e65100", fontWeight: 600, marginLeft: 16 }}>
              Click en el mapa para colocar
            </span>
          )}
        </div>

        {/* Valve list & editor panel */}
        <div style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "4px 16px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap", fontSize: 12 }}>
          <button onClick={() => setShowPanelValvulas(v => !v)} style={{ ...btn, background: showPanelValvulas ? "#c62828" : "white", color: showPanelValvulas ? "white" : "#c62828", fontWeight: 600, fontSize: 11 }}>📋 Válvulas ({valvulasExistentes.length + valvulasLocales.length})</button>
          {editandoValvula && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontWeight: 600, color: "#c62828" }}>Editando: {editandoValvula.codigo}</span>
              {!modoMover
                ? <button onClick={() => setModoMover(true)} style={{ ...btn, background: "#2e7d32", color: "#fff", fontSize: 11 }}>📍 Mover</button>
                : <span style={{ color: "#e65100", fontWeight: 600 }}>Hacé click en la nueva posición...</span>}
              <button onClick={() => { if (confirm(`¿Eliminar ${editandoValvula.codigo}?`) && onDeleteValvula) { onDeleteValvula(editandoValvula.id).then(() => { setContador(c => c + 1); }); } setEditandoValvula(null); }} style={{ ...btn, color: "#c62828", fontSize: 11 }}>🗑 Eliminar</button>
              <button onClick={() => { setEditandoValvula(null); setModoMover(false); }} style={{ ...btn, fontSize: 11 }}>✕ Cancelar</button>
            </span>
          )}
        </div>

        {showPanelValvulas && (
          <div style={{ position: "absolute", right: 8, top: 8, zIndex: 300, background: "white", border: "1px solid #ccc", borderRadius: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", width: 260, maxHeight: 350, overflowY: "auto", fontSize: 12 }}>
            <div style={{ padding: "6px 8px", fontWeight: 600, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
              <span>Válvulas ({valvulasExistentes.length + valvulasLocales.length})</span>
              <button onClick={() => setShowPanelValvulas(false)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 14, color: "#999" }}>✕</button>
            </div>
            {valvulasExistentes.length === 0 && valvulasLocales.length === 0 && <div style={{ padding: 8, color: "#999" }}>Sin válvulas aún</div>}
            {valvulasExistentes.map(v => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", padding: "2px 8px", borderBottom: "1px solid #f5f5f5", background: editandoValvula?.id === v.id ? "#ffebee" : "white" }}>
                <div onClick={() => { setEditandoValvula(v); setShowPanelValvulas(false); }} style={{ flex: 1, cursor: "pointer", padding: "2px 0" }}>
                  <span style={{ fontWeight: 500 }}>{v.codigo}</span>
                  <span style={{ color: "#666", marginLeft: 6 }}>{v.sector_codigo || v.tipo}</span>
                </div>
                <button onClick={() => { if (confirm(`¿Eliminar ${v.codigo}?`) && onDeleteValvula) { onDeleteValvula(v.id).then(() => { setContador(c => c + 1); }); } }} style={{ border: "none", background: "none", cursor: "pointer", color: "#c62828", fontSize: 14, padding: "2px 4px" }} title="Eliminar">🗑</button>
              </div>
            ))}
            {valvulasLocales.map(v => (
              <div key={v.localId} style={{ display: "flex", alignItems: "center", padding: "2px 8px", borderBottom: "1px solid #f5f5f5", background: "#fff3e0" }}>
                <div style={{ flex: 1, padding: "2px 0" }}>
                  <span style={{ fontWeight: 500 }}>{v.codigo}</span>
                  <span style={{ color: "#999", marginLeft: 6, fontStyle: "italic" }}>guardando...</span>
                </div>
                <button onClick={() => { setValvulasLocales(prev => prev.filter(x => x.localId !== v.localId)); }} style={{ border: "none", background: "none", cursor: "pointer", color: "#c62828", fontSize: 14, padding: "2px 4px" }} title="Deshacer">↩</button>
              </div>
            ))}
          </div>
        )}

        {/* Tubería editing bar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "4px 16px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap", fontSize: 12 }}>
          <button onClick={() => setShowPanelTuberias(v => !v)} style={{ ...btn, background: showPanelTuberias ? "#1565c0" : "white", color: showPanelTuberias ? "white" : "#1565c0", fontWeight: 600, fontSize: 11 }}>📏 Tuberías ({tuberiasExistentes.length})</button>
          {editandoTuberia && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontWeight: 600, color: "#1565c0" }}>{editandoTuberia.codigo}</span>
              {editandoVertices ? (
                <>
                  <span style={{ fontSize: 11, color: "#666" }}>Arrastrá los puntos azules para editar</span>
                  <button onClick={() => {
                    const pts = vertexRef.current.map(v => ({ lat: v.getLatLng().lat, lng: v.getLatLng().lng }));
                    if (onUpdateTuberia) onUpdateTuberia(editandoTuberia.id, pts).then(() => setContador(c => c + 1));
                    setEditandoVertices(false);
                    setEditandoTuberia(null);
                  }} style={{ ...btn, background: "#2e7d32", color: "#fff", fontSize: 11, border: "none" }}>💾 Guardar</button>
                  <button onClick={() => { setEditandoVertices(false); setEditandoTuberia(null); }} style={{ ...btn, fontSize: 11 }}>✕ Cancelar</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditandoVertices(true); showVertexMarkers(mapRef.current!, editandoTuberia.id,
                    (editandoTuberia.geometria.type === "MultiLineString" ? editandoTuberia.geometria.coordinates[0] : editandoTuberia.geometria.coordinates).map((c: number[]) => L.latLng(c[1], c[0]))
                  ); }} style={{ ...btn, background: "#1565c0", color: "#fff", fontSize: 11, border: "none" }}>✏️ Editar vértices</button>
                  <button onClick={() => { if (confirm(`¿Eliminar ${editandoTuberia.codigo}?`) && onDeleteTuberia) { onDeleteTuberia(editandoTuberia.id).then(() => { setContador(c => c + 1); }); } setEditandoTuberia(null); }} style={{ ...btn, color: "#c62828", fontSize: 11 }}>🗑 Eliminar</button>
                  <button onClick={() => setEditandoTuberia(null)} style={{ ...btn, fontSize: 11 }}>✕ Cancelar</button>
                </>
              )}
            </span>
          )}
        </div>

        {showPanelTuberias && (
          <div style={{ position: "absolute", right: 8, top: 40, zIndex: 300, background: "white", border: "1px solid #ccc", borderRadius: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", width: 260, maxHeight: 350, overflowY: "auto", fontSize: 12 }}>
            <div style={{ padding: "6px 8px", fontWeight: 600, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
              <span>Tuberías ({tuberiasExistentes.length})</span>
              <button onClick={() => setShowPanelTuberias(false)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 14, color: "#999" }}>✕</button>
            </div>
            {tuberiasExistentes.length === 0 && <div style={{ padding: 8, color: "#999" }}>Sin tuberías aún</div>}
            {tuberiasExistentes.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "2px 8px", borderBottom: "1px solid #f5f5f5", background: editandoTuberia?.id === t.id ? "#e3f2fd" : "white" }}>
                <div onClick={() => { setEditandoTuberia(t); setShowPanelTuberias(false); }} style={{ flex: 1, cursor: "pointer", padding: "2px 0" }}>
                  <span style={{ fontWeight: 500 }}>{t.codigo}</span>
                  <span style={{ color: "#666", marginLeft: 6 }}>{t.nivel}</span>
                  <span style={{ color: "#999", marginLeft: 4, fontSize: 11 }}>{t.material}</span>
                </div>
                <button onClick={() => { if (confirm(`¿Eliminar ${t.codigo}?`) && onDeleteTuberia) { onDeleteTuberia(t.id).then(() => { setContador(c => c + 1); }); } }} style={{ border: "none", background: "none", cursor: "pointer", color: "#c62828", fontSize: 14, padding: "2px 4px" }} title="Eliminar">🗑</button>
              </div>
            ))}
          </div>
        )}

        {/* Valve edit panel */}
        {editValvulaOpen && editValvulaData && (
          <div style={{ position: "absolute", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setEditValvulaOpen(false)}>
            <div style={{ background: "#fff", borderRadius: 8, padding: 20, width: 360, maxWidth: "90vw", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", fontSize: 13 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                <span>Editar {editValvulaData.codigo}</span>
                <button onClick={() => setEditValvulaOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "#999" }}>✕</button>
              </div>

              <label style={{ display: "block", marginBottom: 10 }}>
                <span style={{ fontWeight: 500, display: "block", marginBottom: 2 }}>Bloque de riego</span>
                <input value={formBloque} onChange={e => setFormBloque(e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 13 }} placeholder="Ej: B3-1" />
              </label>

              <label style={{ display: "block", marginBottom: 10 }}>
                <span style={{ fontWeight: 500, display: "block", marginBottom: 2 }}>Diámetro (mm)</span>
                <input value={formDiametro} onChange={e => setFormDiametro(e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 13 }} placeholder="Ej: 50" />
              </label>

              <label style={{ display: "block", marginBottom: 10 }}>
                <span style={{ fontWeight: 500, display: "block", marginBottom: 2 }}>Activación</span>
                <select value={formActivacion} onChange={e => setFormActivacion(e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 13, background: "#fff" }}>
                  <option value="">Seleccionar...</option>
                  <option value="24vac">24VAC</option>
                  <option value="latch">Latch</option>
                </select>
              </label>

              <label style={{ display: "block", marginBottom: 10 }}>
                <span style={{ fontWeight: 500, display: "block", marginBottom: 2 }}>Sector</span>
                <input value={formSector} onChange={e => setFormSector(e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 13 }} placeholder="Ej: E3S1" />
              </label>

              <label style={{ display: "block", marginBottom: 10 }}>
                <span style={{ fontWeight: 500, display: "block", marginBottom: 2 }}>Color</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {["#ef5350", "#1565c0", "#2e7d32", "#f9a825", "#6a1b9a"].map(col => (
                    <div key={col} onClick={() => setFormColor(col)} style={{ width: 28, height: 28, borderRadius: "50%", background: col, cursor: "pointer", border: formColor === col ? "3px solid #333" : "2px solid transparent" }} />
                  ))}
                </div>
              </label>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button onClick={() => { setEditValvulaOpen(false); setEditandoValvula(editValvulaData); setModoMover(true); }} style={{ padding: "6px 12px", border: "1px solid #2e7d32", borderRadius: 4, background: "#e8f5e9", cursor: "pointer", fontSize: 12, color: "#2e7d32", fontWeight: 600 }}>📍 Mover</button>
                <div style={{ flex: 1 }} />
                <button onClick={() => setEditValvulaOpen(false)} style={{ padding: "6px 16px", border: "1px solid #ccc", borderRadius: 4, background: "#fff", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
                <button onClick={async () => {
                  if (!onUpdateValvulaData) return;
                  await onUpdateValvulaData(editValvulaData.id, {
                    bloque_riego: formBloque || undefined,
                    diametro_mm: formDiametro ? Number(formDiametro) : undefined,
                    activacion: formActivacion || undefined,
                    sector_codigo: formSector || undefined,
                    color: formColor || undefined,
                  });
                  setContador(c => c + 1);
                  setEditValvulaOpen(false);
                }} style={{ padding: "6px 16px", border: "none", borderRadius: 4, background: "#1565c0", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Guardar</button>
              </div>
            </div>
          </div>
        )}

        <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, zIndex: 1 }} />
          {loading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, background: "rgba(255,255,255,0.7)" }}><p style={{ color: "#666", fontSize: 14 }}>Cargando plano...</p></div>}
          {imageUrl && !loading && (
            <div style={{
              position: "absolute", left: posX, top: posY,
              transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${(zoom / 100) * Math.pow(2, mapZoom - 15)})`,
              transformOrigin: "center center", zIndex: 10, pointerEvents: "none",
            }}>
              <img src={transparentBg ? imageUrl : (imageUrlRaw || imageUrl)} alt="Plano" className="geo-plano-img" style={{ display: "block", maxWidth: "none", opacity }} />
              <div title="Click de rueda para mover el plano"
                style={{
                  position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
                  width: 64, height: 64, cursor: "move",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(21, 101, 192, 0.85)", borderRadius: "50%", pointerEvents: "none",
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
