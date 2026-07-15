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
  onCreateTuberia?: (data: { codigo: string; nivel: string; material?: string; diametro_mm?: number; nombre?: string; puntos: PuntoGeo[] }) => Promise<void>;
  onCreateValvula?: (data: { codigo: string; tipo: string; diametro_mm?: number; tuberia_id?: string; punto: PuntoGeo }) => Promise<void>;
  onCreateAntena?: (data: { codigo: string; tipo?: string; punto: PuntoGeo }) => Promise<void>;
  onCreateSonda?: (data: { codigo: string; tipo?: string; profundidad_m?: number; punto: PuntoGeo }) => Promise<void>;
  onUpdateTuberia?: (id: string, data: any) => Promise<void>;
  onUpdateValvula?: (id: string, data: any) => Promise<void>;
  onUpdateAntena?: (id: string, data: any) => Promise<void>;
  onUpdateSonda?: (id: string, data: any) => Promise<void>;
  onDeleteTuberia?: (id: string) => Promise<void>;
  onDeleteValvula?: (id: string) => Promise<void>;
  onDeleteAntena?: (id: string) => Promise<void>;
  onDeleteSonda?: (id: string) => Promise<void>;
}

type ModoDibujo = null | "matriz" | "impulsion" | "submatriz" | "valvula_electrica" | "valvula_aire" | "antena" | "sonda";

export default function Georreferenciador({ planoUrl, equipoCodigo, equipoId, initialCenter, onSave, onClose, saved, onCreateTuberia, onCreateValvula, onCreateAntena, onCreateSonda, onUpdateTuberia, onUpdateValvula, onUpdateAntena, onUpdateSonda, onDeleteTuberia, onDeleteValvula, onDeleteAntena, onDeleteSonda }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageUrlRaw, setImageUrlRaw] = useState("");
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

  // --- Drawing state ---
  const [modoDibujo, setModoDibujo] = useState<ModoDibujo>(null);
  const modoRef = useRef<ModoDibujo>(null);  // sync for event handlers
  modoRef.current = modoDibujo;
  const [puntosTemp, setPuntosTemp] = useState<PuntoGeo[]>([]);
  const puntosRef = useRef<PuntoGeo[]>([]);
  puntosRef.current = puntosTemp;
  const [formCrear, setFormCrear] = useState<{ tipo: string; codigo: string; material?: string; diametro_mm?: number; tuberia_id?: string; tipo_valvula?: string; profundidad_m?: number; nombre?: string } | null>(null);
  const formCrearRef = useRef<any>(null);
  formCrearRef.current = formCrear;
  const [contador, setContador] = useState(0);
  const [antenasExistentes, setAntenasExistentes] = useState<any[]>([]);
  const [sondasExistentes, setSondasExistentes] = useState<any[]>([]);
  const [editandoElemento, setEditandoElemento] = useState<{ tipo: string; id: string } | null>(null);

  // Refs to callbacks so event handlers always call the latest version
  const onCreateTuberiaRef = useRef(onCreateTuberia);
  onCreateTuberiaRef.current = onCreateTuberia;
  const onCreateValvulaRef = useRef(onCreateValvula);
  onCreateValvulaRef.current = onCreateValvula;
  const onCreateAntenaRef = useRef(onCreateAntena);
  onCreateAntenaRef.current = onCreateAntena;
  const onCreateSondaRef = useRef(onCreateSonda);
  onCreateSondaRef.current = onCreateSonda;

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

  // --- Posicion sigue al mapa en pan y zoom (anclaje geografico) ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const handler = () => setForce(n => n + 1);
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
    setForce(n => n + 1);
  }, [ready]);



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
    return zoom / 100;
  }

  const nudge = useCallback((dLat: number, dLng: number) => {
    geoCenterRef.current = L.latLng(geoCenterRef.current.lat + dLat, geoCenterRef.current.lng + dLng);
    setForce(n => n + 1);
  }, []);
  const nudgeRef = useRef<(dLat: number, dLng: number) => void>(() => {});
  nudgeRef.current = nudge;

  const handleConfirmCrear = useCallback((data: any) => {
    const fc = formCrearRef.current;
    const pts = puntosRef.current;
    if (!fc || pts.length === 0) return;
    const tipo = fc.tipo;
    const isLine = tipo === "matriz" || tipo === "impulsion" || tipo === "submatriz";
    const nivelMap: Record<string, string> = { matriz: "matriz", impulsion: "impulsion", submatriz: "submatriz" };
    const createTub = onCreateTuberiaRef.current;
    const createVal = onCreateValvulaRef.current;
    const createAnt = onCreateAntenaRef.current;
    const createSnd = onCreateSondaRef.current;

    if (isLine) {
      createTub?.({ codigo: data.codigo, nivel: nivelMap[tipo] || "matriz", material: data.material || "PVC", diametro_mm: data.diametro_mm ? Number(data.diametro_mm) : undefined, nombre: data.nombre, puntos: pts })
        ?.catch((e: any) => console.error("Error tubería:", e));
    } else if (tipo === "valvula_electrica" || tipo === "valvula_aire") {
      createVal?.({ codigo: data.codigo, tipo: data.tipo_valvula || "transicion", diametro_mm: data.diametro_mm ? Number(data.diametro_mm) : undefined, tuberia_id: data.tuberia_id || undefined, punto: pts[0] })
        ?.catch((e: any) => console.error("Error válvula:", e));
    } else if (tipo === "antena") {
      createAnt?.({ codigo: data.codigo, tipo: "", punto: pts[0] })?.catch((e: any) => console.error("Error antena:", e));
    } else if (tipo === "sonda") {
      createSnd?.({ codigo: data.codigo, tipo: "", profundidad_m: data.profundidad_m ? Number(data.profundidad_m) : undefined, punto: pts[0] })?.catch((e: any) => console.error("Error sonda:", e));
    }
    setFormCrear(null);
    setPuntosTemp([]);
    setContador(c => c + 1);
  }, []);

  const handleUpdate = useCallback(async (tipo: string, id: string, d: any) => {
    const updateData: any = {};
    if (d.codigo) updateData.codigo = d.codigo;
    if (d.material) updateData.material = d.material;
    if (d.diametro_mm) updateData.diametro_mm = Number(d.diametro_mm);
    if (d.tipo_valvula) updateData.tipo = d.tipo_valvula;
    if (tipo === "tuberia" && d.nombre !== undefined) updateData.nombre = d.nombre;

    if (tipo === "tuberia") await onUpdateTuberia?.(id, updateData);
    else if (tipo === "valvula" || tipo === "valvula_electrica" || tipo === "valvula_aire") await onUpdateValvula?.(id, updateData);
    else if (tipo === "antena") await onUpdateAntena?.(id, updateData);
    else if (tipo === "sonda") await onUpdateSonda?.(id, updateData);
    setEditandoElemento(null);
    setContador(c => c + 1);
  }, [onUpdateTuberia, onUpdateValvula, onUpdateAntena, onUpdateSonda]);

  const handleDelete = useCallback(async (tipo: string, id: string) => {
    if (!confirm("Estas seguro de eliminar este elemento?")) return;
    if (tipo === "tuberia") await onDeleteTuberia?.(id);
    else if (tipo === "valvula" || tipo === "valvula_electrica" || tipo === "valvula_aire") await onDeleteValvula?.(id);
    else if (tipo === "antena") await onDeleteAntena?.(id);
    else if (tipo === "sonda") await onDeleteSonda?.(id);
    setContador(c => c + 1);
  }, [onDeleteTuberia, onDeleteValvula, onDeleteAntena, onDeleteSonda]);

  // Cleanup
  useEffect(() => () => {
    const ov = overlayRef.current as any;
    if (ov?._clean) ov._clean();
  }, []);

  // --- Middle-click drag: agarrar y mover el plano con la rueda del mouse ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let dragging = false;
    let startLatLng = L.latLng(0, 0);
    const onDown = (e: MouseEvent) => {
      if (modoDibujo || e.button !== 1) return;
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
  }, [modoDibujo]);

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

  // --- Drawing system: all event handlers read from refs, no stale closures ---

  // Disable double-click zoom while in drawing mode
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (modoDibujo) {
      m.doubleClickZoom.disable();
      return () => { m.doubleClickZoom.enable(); };
    }
  }, [modoDibujo]);

  // Single click: add point (line modes) or place element (point modes)
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const onClick = (e: L.LeafletMouseEvent) => {
      const md = modoRef.current;
      if (!md) return;
      const punto: PuntoGeo = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (md === "matriz" || md === "impulsion" || md === "submatriz") {
        setPuntosTemp(prev => [...prev, punto]);
      } else {
        setPuntosTemp([punto]);
        setFormCrear({ tipo: md, codigo: "Nuevo" });
        setModoDibujo(null);
      }
    };
    m.on("click", onClick);
    return () => { m.off("click", onClick); };
  }, []);

  // Double click: finish line (remove extra click point, add dblclick position)
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const onDouble = (e: L.LeafletMouseEvent) => {
      const md = modoRef.current;
      if (!(md === "matriz" || md === "impulsion" || md === "submatriz")) return;
      L.DomEvent.stopPropagation(e.originalEvent);
      const pts = puntosRef.current;
      if (pts.length < 2) {
        setPuntosTemp([]);
        setModoDibujo(null);
        modoRef.current = null;
        return;
      }
      // dblclick fires after a click event that added an extra point.
      // The functional update removes that last point and adds the dblclick position instead.
      const ultimo: PuntoGeo = { lat: e.latlng.lat, lng: e.latlng.lng };
      setPuntosTemp(prev => [...prev.slice(0, -1), ultimo]);
      setFormCrear({ tipo: md, codigo: "Nuevo" });
      setModoDibujo(null);
      modoRef.current = null;
    };
    m.on("dblclick", onDouble);
    return () => { m.off("dblclick", onDouble); };
  }, []); // refs are stable, no deps needed

  // --- Render preview of the line being drawn & draggable vertex markers ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const md = modoRef.current;
    const isLine = md === "matriz" || md === "impulsion" || md === "submatriz";
    if (!isLine) return;
    const colorMap: Record<string, string> = { matriz: "#1565c0", impulsion: "#2e7d32", submatriz: "#c62828" };
    const layer = L.polyline([], { color: colorMap[md] || "#1565c0", weight: 4, dashArray: "8,8" }).addTo(m);
    const verts: L.Marker[] = [];
    const updateLine = () => {
      const pts = puntosRef.current;
      layer.setLatLngs(pts.map(p => L.latLng(p.lat, p.lng)));
      while (verts.length < pts.length) {
        const i = verts.length;
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;background:#fff;border:3px solid ${colorMap[md] || "#e65100"};border-radius:50%;cursor:grab;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
          iconSize: [14, 14], iconAnchor: [7, 7],
        });
        const mk = L.marker(pts[i], { icon, draggable: true, zIndexOffset: 1000 }).addTo(m);
        mk.on("drag", () => {
          const pos = mk.getLatLng();
          setPuntosTemp(prev => {
            const next = [...prev];
            if (next[i]) next[i] = { lat: pos.lat, lng: pos.lng };
            return next;
          });
        });
        verts.push(mk);
      }
      while (verts.length > pts.length) m.removeLayer(verts.pop()!);
      pts.forEach((p, i) => { if (verts[i]) verts[i].setLatLng([p.lat, p.lng]); });
    };
    updateLine();
    const interval = setInterval(updateLine, 100);
    return () => { clearInterval(interval); m.removeLayer(layer); verts.forEach(v => m.removeLayer(v)); };
  }, [modoDibujo]);

  const overlayRef = useRef<any>(null);

  // --- Markers of confirmed tuberias/valvulas (to be loaded from DB) ---
  const [tuberiasExistentes, setTuberiasExistentes] = useState<any[]>([]);
  const [valvulasExistentes, setValvulasExistentes] = useState<any[]>([]);

  // Load existing elements for this equipo when drawing mode opens
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
    fetch(api + `antenas?equipo_id=eq.${equipoId}`, { headers: h })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setAntenasExistentes(d); }).catch(e => console.warn("Error antenas:", e));
    fetch(api + `sondas?equipo_id=eq.${equipoId}`, { headers: h })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setSondasExistentes(d); }).catch(e => console.warn("Error sondas:", e));
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
      const color = v.tipo === "aire" ? "#42a5f5" : "#e65100";
      const c = L.circleMarker([lat, lng], { radius: 6, color, fillColor: color, fillOpacity: 0.9 });
      c.bindTooltip(v.codigo, { permanent: false, className: "cuartel-tooltip" });
      c.addTo(m);
      layers.push(c);
    });
    return () => { layers.forEach(l => m.removeLayer(l)); };
  }, [valvulasExistentes]);

  // Render antenas as purple circles
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const layers: L.CircleMarker[] = [];
    antenasExistentes.forEach(a => {
      if (!a.geometria?.coordinates) return;
      const [lng, lat] = a.geometria.coordinates;
      const c = L.circleMarker([lat, lng], { radius: 6, color: "#6a1b9a", fillColor: "#6a1b9a", fillOpacity: 0.9 });
      c.bindTooltip(a.codigo, { permanent: false, className: "cuartel-tooltip" });
      c.addTo(m);
      layers.push(c);
    });
    return () => { layers.forEach(l => m.removeLayer(l)); };
  }, [antenasExistentes]);

  // Render sondas as yellow circles
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const layers: L.CircleMarker[] = [];
    sondasExistentes.forEach(s => {
      if (!s.geometria?.coordinates) return;
      const [lng, lat] = s.geometria.coordinates;
      const c = L.circleMarker([lat, lng], { radius: 6, color: "#f9a825", fillColor: "#f9a825", fillOpacity: 0.9 });
      c.bindTooltip(s.codigo, { permanent: false, className: "cuartel-tooltip" });
      c.addTo(m);
      layers.push(c);
    });
    return () => { layers.forEach(l => m.removeLayer(l)); };
  }, [sondasExistentes]);

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
          <span style={{ fontSize: 12, fontWeight: 600, color: "#555", marginRight: 4 }}>Dibujar:</span>
          <button onClick={() => setModoDibujo(modoDibujo === "matriz" ? null : "matriz")}
            style={{ ...btn, background: modoDibujo === "matriz" ? "#1565c0" : "white", color: modoDibujo === "matriz" ? "white" : "#1565c0", fontWeight: 600, borderLeft: "3px solid #1565c0" }}>🔵 Matriz</button>
          <button onClick={() => setModoDibujo(modoDibujo === "impulsion" ? null : "impulsion")}
            style={{ ...btn, background: modoDibujo === "impulsion" ? "#2e7d32" : "white", color: modoDibujo === "impulsion" ? "white" : "#2e7d32", fontWeight: 600, borderLeft: "3px solid #2e7d32" }}>🟢 Impulsión</button>
          <button onClick={() => setModoDibujo(modoDibujo === "submatriz" ? null : "submatriz")}
            style={{ ...btn, background: modoDibujo === "submatriz" ? "#c62828" : "white", color: modoDibujo === "submatriz" ? "white" : "#c62828", fontWeight: 600, borderLeft: "3px solid #c62828" }}>🔴 Submatriz</button>
          <span style={{ color: "#ddd" }}>|</span>
          <button onClick={() => setModoDibujo(modoDibujo === "valvula_electrica" ? null : "valvula_electrica")}
            style={{ ...btn, background: modoDibujo === "valvula_electrica" ? "#e65100" : "white", color: modoDibujo === "valvula_electrica" ? "white" : "#e65100", fontWeight: 600, borderLeft: "3px solid #e65100" }}>🟠 V. Eléctrica</button>
          <button onClick={() => setModoDibujo(modoDibujo === "valvula_aire" ? null : "valvula_aire")}
            style={{ ...btn, background: modoDibujo === "valvula_aire" ? "#42a5f5" : "white", color: modoDibujo === "valvula_aire" ? "white" : "#42a5f5", fontWeight: 600, borderLeft: "3px solid #42a5f5" }}>🔵 V. Aire</button>
          <span style={{ color: "#ddd" }}>|</span>
          <button onClick={() => setModoDibujo(modoDibujo === "antena" ? null : "antena")}
            style={{ ...btn, background: modoDibujo === "antena" ? "#6a1b9a" : "white", color: modoDibujo === "antena" ? "white" : "#6a1b9a", fontWeight: 600, borderLeft: "3px solid #6a1b9a" }}>🟣 Antena</button>
          <button onClick={() => setModoDibujo(modoDibujo === "sonda" ? null : "sonda")}
            style={{ ...btn, background: modoDibujo === "sonda" ? "#f9a825" : "white", color: modoDibujo === "sonda" ? "white" : "#f9a825", fontWeight: 600, borderLeft: "3px solid #f9a825" }}>🟡 Sonda</button>
          {(modoDibujo === "matriz" || modoDibujo === "impulsion" || modoDibujo === "submatriz") && (
            <span style={{ fontSize: 12, color: "#e65100", fontWeight: 600, marginLeft: 16 }}>
              Click para puntos, doble click para cerrar ({puntosTemp.length} pts)
              {puntosTemp.length > 0 && (
                <button onClick={() => setPuntosTemp(prev => prev.slice(0, -1))} style={{ marginLeft: 8, background: "#c62828", color: "white", border: "none", borderRadius: 3, padding: "2px 8px", fontSize: 11, cursor: "pointer", verticalAlign: "middle" }}>✕ último</button>
              )}
            </span>
          )}
          {modoDibujo && !(modoDibujo === "matriz" || modoDibujo === "impulsion" || modoDibujo === "submatriz") && (
            <span style={{ fontSize: 12, color: "#e65100", fontWeight: 600, marginLeft: 16 }}>
              Click en el mapa para colocar
            </span>
          )}
        </div>

        <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, zIndex: 1 }} />
            {loading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, background: "rgba(255,255,255,0.7)" }}><p style={{ color: "#666", fontSize: 14 }}>Cargando plano...</p></div>}
            {imageUrl && !loading && (
              <div style={{
                position: "absolute", left: posX, top: posY,
                transform: `translate(-50%, -50%) scale(${scaleFactor}) rotate(${rotation}deg)`,
                transformOrigin: "center center", zIndex: 10, pointerEvents: "none",
              }}>
                <img src={transparentBg ? imageUrl : (imageUrlRaw || imageUrl)} alt="Plano" className="geo-plano-img" style={{ display: "block", maxWidth: "none", opacity }} />
              </div>
            )}
            {!loading && (
              <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.75)", color: "#fff", padding: "6px 14px", borderRadius: 4, fontSize: 12, zIndex: 200, pointerEvents: "none", whiteSpace: "nowrap" }}>
                {modoDibujo ? `Modo: ${modoDibujo}` : "Rueda: agarrar plano | Click izq: navegar"}
              </div>
            )}
          </div>

          {/* LAYER PANEL */}
          <LayerPanelSide
            tuberias={tuberiasExistentes}
            valvulas={valvulasExistentes}
            antenas={antenasExistentes}
            sondas={sondasExistentes}
            setModoDibujo={setModoDibujo}
            editandoElemento={editandoElemento}
            setEditandoElemento={setEditandoElemento}
            formCrear={formCrear}
            onConfirmCrear={handleConfirmCrear}
            onCancelCrear={() => { setFormCrear(null); setPuntosTemp([]); }}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            setFormCrear={setFormCrear}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Layer Panel Components ──────────────────────────────────────────────────

function FormCrearElemento({ formCrear, onConfirm, onCancel, tuberias }: {
  formCrear: any;
  onConfirm: (data: any) => void;
  onCancel: () => void;
  tuberias: any[];
}) {
  const [data, setData] = useState<{ codigo: string; material?: string; diametro_mm?: number; nombre?: string; tipo_valvula?: string; tuberia_id?: string; profundidad_m?: number }>({ ...formCrear });
  const isLine = formCrear.tipo === "matriz" || formCrear.tipo === "impulsion" || formCrear.tipo === "submatriz";
  const isValve = formCrear.tipo === "valvula_electrica" || formCrear.tipo === "valvula_aire";

  useEffect(() => {
    setData({ ...formCrear });
  }, [formCrear]);

  return (
    <div style={{ padding: 8, borderTop: "1px solid #ddd", background: "#fafafa" }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Nuevo: {formCrear.tipo}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 11 }}>Código:
          <input value={data.codigo} onChange={e => setData(d => ({ ...d, codigo: e.target.value }))} style={{ width: "100%", fontSize: 11, padding: "2px 4px", boxSizing: "border-box" }} />
        </label>
        {isLine && <>
          <label style={{ fontSize: 11 }}>Nombre:
            <input value={data.nombre || ""} onChange={e => setData(d => ({ ...d, nombre: e.target.value }))} style={{ width: "100%", fontSize: 11, padding: "2px 4px", boxSizing: "border-box" }} />
          </label>
          <label style={{ fontSize: 11 }}>Material:
            <select value={data.material || "PVC"} onChange={e => setData(d => ({ ...d, material: e.target.value }))} style={{ width: "100%", fontSize: 11 }}>
              <option>PVC</option>
              <option>HDPE</option>
              <option>acero</option>
            </select>
          </label>
          <label style={{ fontSize: 11 }}>Diámetro mm:
            <input type="number" value={data.diametro_mm || ""} onChange={e => setData(d => ({ ...d, diametro_mm: e.target.value ? Number(e.target.value) : undefined }))} style={{ width: "100%", fontSize: 11, padding: "2px 4px", boxSizing: "border-box" }} />
          </label>
        </>}
        {isValve && <>
          <label style={{ fontSize: 11 }}>Tipo:
            <select value={data.tipo_valvula || "transicion"} onChange={e => setData(d => ({ ...d, tipo_valvula: e.target.value }))} style={{ width: "100%", fontSize: 11 }}>
              <option>transicion</option>
              <option>purga</option>
              <option>aire</option>
              <option>compuerta</option>
              <option>otro</option>
            </select>
          </label>
          <label style={{ fontSize: 11 }}>Diámetro mm:
            <input type="number" value={data.diametro_mm || ""} onChange={e => setData(d => ({ ...d, diametro_mm: e.target.value ? Number(e.target.value) : undefined }))} style={{ width: "100%", fontSize: 11, padding: "2px 4px", boxSizing: "border-box" }} />
          </label>
          <label style={{ fontSize: 11 }}>Tubería asociada:
            <select value={data.tuberia_id || ""} onChange={e => setData(d => ({ ...d, tuberia_id: e.target.value || undefined }))} style={{ width: "100%", fontSize: 11 }}>
              <option value="">— Ninguna —</option>
              {tuberias.map((t: any) => <option key={t.id} value={t.id}>{t.codigo}</option>)}
            </select>
          </label>
        </>}
        {formCrear.tipo === "sonda" && <>
          <label style={{ fontSize: 11 }}>Profundidad m:
            <input type="number" value={data.profundidad_m || ""} onChange={e => setData(d => ({ ...d, profundidad_m: e.target.value ? Number(e.target.value) : undefined }))} style={{ width: "100%", fontSize: 11, padding: "2px 4px", boxSizing: "border-box" }} />
          </label>
        </>}
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <button onClick={() => onConfirm(data)} style={{ background: "#1565c0", color: "white", border: "none", borderRadius: 3, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>✓ Crear</button>
          <button onClick={onCancel} style={{ background: "#ccc", border: "none", borderRadius: 3, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>✕ Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function LayerItem({ item, tipo, editando, onEdit, onDelete, onStartEdit }: {
  item: any;
  tipo: string;
  editando: boolean;
  onEdit: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  onStartEdit: (tipo: string, id: string) => void;
}) {
  const [editData, setEditData] = useState<any>({ codigo: item.codigo, material: item.material, diametro_mm: item.diametro_mm });

  if (editando) {
    return (
      <div style={{ fontSize: 11, padding: "4px 8px", borderBottom: "1px solid #f0f0f0" }}>
        <input value={editData.codigo || ""} onChange={e => setEditData((d: any) => ({ ...d, codigo: e.target.value }))} style={{ width: "60%", fontSize: 10, padding: "1px 3px", marginRight: 4 }} />
        <button onClick={() => onEdit(item.id, editData)} style={{ background: "#2e7d32", color: "white", border: "none", borderRadius: 2, padding: "2px 6px", fontSize: 10, cursor: "pointer", marginRight: 2 }}>✓</button>
        <button onClick={() => onStartEdit(tipo, "")} style={{ background: "#ccc", border: "none", borderRadius: 2, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>✕</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, padding: "3px 8px", borderBottom: "1px solid #f0f0f0" }}>
      <span>{item.codigo || "—"}</span>
      <div>
        <button onClick={() => onStartEdit(tipo, item.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#1565c0", padding: "0 2px" }} title="Editar">✎</button>
        <button onClick={() => onDelete(item.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#c62828", padding: "0 2px" }} title="Eliminar">🗑</button>
      </div>
    </div>
  );
}

function LayerPanelSide({ tuberias, valvulas, antenas, sondas, setModoDibujo, editandoElemento, setEditandoElemento, formCrear, onConfirmCrear, onCancelCrear, onUpdate, onDelete, setFormCrear }: {
  tuberias: any[];
  valvulas: any[];
  antenas: any[];
  sondas: any[];
  setModoDibujo: (m: ModoDibujo) => void;
  editandoElemento: { tipo: string; id: string } | null;
  setEditandoElemento: (e: { tipo: string; id: string } | null) => void;
  formCrear: any;
  onConfirmCrear: (data: any) => void;
  onCancelCrear: () => void;
  onUpdate: (tipo: string, id: string, data: any) => void;
  onDelete: (tipo: string, id: string) => void;
  setFormCrear: (f: any) => void;
}) {
  const groups = [
    { key: "matriz", label: "Matrices", icon: "🔵", color: "#1565c0", data: tuberias.filter(t => t.nivel === "matriz") },
    { key: "impulsion", label: "Impulsiones", icon: "🟢", color: "#2e7d32", data: tuberias.filter(t => t.nivel === "impulsion") },
    { key: "submatriz", label: "Submatrices", icon: "🔴", color: "#c62828", data: tuberias.filter(t => t.nivel === "submatriz") },
    { key: "valvula_electrica", label: "V. Eléctricas", icon: "🟠", color: "#e65100", data: valvulas.filter((v: any) => v.tipo !== "aire") },
    { key: "valvula_aire", label: "V. Aire", icon: "🔵", color: "#42a5f5", data: valvulas.filter((v: any) => v.tipo === "aire") },
    { key: "antena", label: "Antenas", icon: "🟣", color: "#6a1b9a", data: antenas },
    { key: "sonda", label: "Sondas", icon: "🟡", color: "#f9a825", data: sondas },
  ];

  return (
    <div style={{ width: 260, borderLeft: "1px solid #ddd", display: "flex", flexDirection: "column", background: "#fafafa", flexShrink: 0 }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #ddd", fontWeight: 700, fontSize: 13, background: "#f0f0f0" }}>📋 CAPAS</div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {groups.map(g => (
          <div key={g.key}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", background: "#f5f5f5", borderBottom: "1px solid #e0e0e0", fontSize: 11, fontWeight: 600 }}>
              <span>{g.icon} {g.label} ({g.data.length})</span>
              <button onClick={() => { setModoDibujo(g.key as ModoDibujo); setFormCrear(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: g.color, fontWeight: 700, padding: "0 4px" }} title={`Agregar ${g.label}`}>＋</button>
            </div>
            {g.data.map((item: any) => (
              <LayerItem key={item.id} item={item} tipo={g.key}
                editando={editandoElemento?.tipo === g.key && editandoElemento?.id === item.id}
                onEdit={(id, d) => onUpdate(g.key === "matriz" || g.key === "impulsion" || g.key === "submatriz" ? "tuberia" : g.key, id, d)}
                onDelete={(id) => onDelete(g.key === "matriz" || g.key === "impulsion" || g.key === "submatriz" ? "tuberia" : g.key, id)}
                onStartEdit={(t, id) => setEditandoElemento(id ? { tipo: t, id } : null)} />
            ))}
          </div>
        ))}
      </div>
      {formCrear && (
        <FormCrearElemento formCrear={formCrear} onConfirm={(data) => onConfirmCrear(data)} onCancel={onCancelCrear}
          tuberias={tuberias.filter(t => t.nivel === "matriz" || t.nivel === "impulsion" || t.nivel === "submatriz")} />
      )}
    </div>
  );
}
