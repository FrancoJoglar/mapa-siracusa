import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { supabase } from "../../lib/supabase";

// Fix Leaflet default marker icon (broken in bundlers)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export interface PuntoGeo { lat: number; lng: number; }

// RotatedOverlay - solo para crear la capa, la rotacion se maneja aparte con CSS
const RotatedOverlay = (L.ImageOverlay as any).extend({});

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

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
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  const [transparentBg, setTransparentBg] = useState(true);
  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const geoCenterRef = useRef<L.LatLng>(L.latLng(initialCenter[0], initialCenter[1]));
  const equipoNum = equipoCodigo.replace("Equipo ", "").trim();

  // --- Geoman drawing state ---
  const [pendingItems, setPendingItems] = useState<{ id: string; layer: any; geojson: any; nombre: string; categoria: string; color: string }[]>([]);
  const [editPanel, setEditPanel] = useState<{ id: string; nombre: string; categoria: string; color: string; isExisting: boolean } | null>(null);
  const [importPreview, setImportPreview] = useState<{ nombre: string; categoria: string; lat: number; lng: number; color: string }[] | null>(null);
  const [colocandoPunto, setColocandoPunto] = useState(false);
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
    // Fijar zoom de referencia al zoom INICIAL del mapa
    refZoomRef.current = savedZoom || m.getZoom();
    setTimeout(() => { m.invalidateSize(); setReady(true); }, 200);
    return () => { m.remove(); mapRef.current = null; };
  }, []);

  // --- Inicializar Geoman ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;

    m.pm.addControls({
      position: "topright",
      drawMarker: true,
      drawPolyline: false,
      drawPolygon: false,
      drawRectangle: false,
      drawCircle: false,
      drawCircleMarker: false,
      drawText: false,
      cutPolygon: false,
      editMode: false,
      dragMode: false,
      removalMode: true,
      rotateMode: false,
      snapOption: false,
      oneBlock: false,
    });

    m.pm.setGlobalOptions({
      snappable: true,
      snapDistance: 20,
      snapMiddle: true,
    });

    return () => { m.pm.removeControls(); };
  }, [ready]);

  // --- Click para colocar punto manual ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const onClick = (e: L.LeafletMouseEvent) => {
      if (!colocandoPunto) return;
      const id = "pending_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      const marker = L.marker(e.latlng, {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:12px;height:12px;background:#999;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
          iconSize: [12, 12], iconAnchor: [6, 6],
        }),
      }).addTo(m);
      const geojson = marker.toGeoJSON();
      (marker.pm as any)?.setOptions?.({ layerId: id, snappable: true });
      layerRefs.current.set(id, marker);
      marker.on("click", () => {
        setEditPanel({ id, nombre: "", categoria: "", color: "#e65100", isExisting: false });
      });
      setPendingItems(prev => [...prev, { id, layer: marker, geojson, nombre: "", categoria: "", color: "#e65100" }]);
      setColocandoPunto(false);
    };
    m.on("click", onClick);
    return () => { m.off("click", onClick); };
  }, [colocandoPunto]);

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

  // --- L.imageOverlay: plano georreferenciado que escala con el mapa ---
  const imgOverlayRef = useRef<any>(null);
  const refZoomRef = useRef<number>(0);
  const prevZoomRef = useRef<number>(0);
  const [, setForce] = useState(0);

  function recalcBounds() {
    const m = mapRef.current;
    if (!m) return null;
    const refCtr = [geoCenterRef.current.lat, geoCenterRef.current.lng];
    const refZoom = refZoomRef.current;
    const refLevel = zoomRef.current;
    console.log("RECALC: ctr=", refCtr[0].toFixed(6), refCtr[1].toFixed(6), "refZoom=", refZoom, "refLevel=", refLevel, "canvas=", rawCanvasRef.current?.width, "x", rawCanvasRef.current?.height);
    const ctr = L.latLng(refCtr[0], refCtr[1]);
    const ctrPt = m.project(ctr, refZoom);
    const natW = rawCanvasRef.current?.width || 1000;
    const natH = rawCanvasRef.current?.height || 1000;
    const s = refLevel / 100;
    const sw = m.unproject([ctrPt.x - natW * s / 2, ctrPt.y + natH * s / 2], refZoom);
    const ne = m.unproject([ctrPt.x + natW * s / 2, ctrPt.y - natH * s / 2], refZoom);
    return L.latLngBounds(sw, ne);
  }

  // Crear overlay (primera vez usa saved bounds si existen, despues recalcBounds)
  const isFirstCreate = useRef(true);
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !imageUrl || !ready) return;
    if (imgOverlayRef.current) m.removeLayer(imgOverlayRef.current);

    let useBounds: L.LatLngBounds | null = null;
    const sw = saved?.bounds?.sw;
    const ne = saved?.bounds?.ne;
    if (isFirstCreate.current && sw && ne) {
      console.log("OVERLAY: usando saved bounds");
      useBounds = L.latLngBounds(
        L.latLng(sw[0], sw[1]),
        L.latLng(ne[0], ne[1])
      );
      isFirstCreate.current = false;
    } else {
      console.log("OVERLAY: recalcBounds (isFirst=" + isFirstCreate.current + " hasSaved=" + !!(sw&&ne) + ")");
      const b = recalcBounds();
      if (b) useBounds = b;
      isFirstCreate.current = false;
    }
    if (!useBounds) return;
    const ov = new (RotatedOverlay as any)(imageUrl, useBounds, { opacity }).addTo(m);
    imgOverlayRef.current = ov;
    prevZoomRef.current = zoom;
    return () => { if (imgOverlayRef.current) m.removeLayer(imgOverlayRef.current); imgOverlayRef.current = null; };
  }, [imageUrl, zoom, opacity, ready]);

  // Rotacion via CSS style.rotate (independiente de transform de Leaflet)
  useEffect(() => {
    const ov = imgOverlayRef.current;
    if (!ov) return;
    const el = ov.getElement();
    if (el) {
      el.style.transformOrigin = "center center";
      el.style.rotate = rotation ? `${rotation}deg` : "";
    }
  }, [rotation]);

  // Actualizar bounds del overlay al arrastrar el plano (nudge)
  const nudge = useCallback((dLat: number, dLng: number) => {
    geoCenterRef.current = L.latLng(geoCenterRef.current.lat + dLat, geoCenterRef.current.lng + dLng);
    const ov = imgOverlayRef.current;
    if (ov) {
      const ob = ov.getBounds();
      ov.setBounds(L.latLngBounds(
        L.latLng(ob.getSouthWest().lat + dLat, ob.getSouthWest().lng + dLng),
        L.latLng(ob.getNorthEast().lat + dLat, ob.getNorthEast().lng + dLng)
      ));
    }
  }, []);
  const nudgeRef = useRef<(dLat: number, dLng: number) => void>(() => {});
  nudgeRef.current = nudge;

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
      // Trasladar bounds (como nudge), no recalcular
      const ov = imgOverlayRef.current;
      if (ov) {
        const ob = ov.getBounds();
        ov.setBounds(L.latLngBounds(
          L.latLng(ob.getSouthWest().lat + dLat, ob.getSouthWest().lng + dLng),
          L.latLng(ob.getNorthEast().lat + dLat, ob.getNorthEast().lng + dLng)
        ));
      }
    };
    const onUp = () => {
      dragging = false;
      if (mapRef.current) mapRef.current.dragging.enable();
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

  // --- pm:create handler (solo puntos) ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const handleCreate = (e: any) => {
      const layer = e.layer;
      const geojson = layer.toGeoJSON();
      const id = "pending_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      
      // Apply draft style (gray circle)
      layer.setIcon(L.divIcon({
        className: "",
        html: `<div style="width:12px;height:12px;background:#999;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12], iconAnchor: [6, 6],
      }));
      (layer.pm as any)?.setOptions?.({ layerId: id, snappable: true });
      layerRefs.current.set(id, layer);

      const layerId = id;
      layer.on("click", () => {
        setEditPanel({ id: layerId, nombre: "", categoria: "", color: "#e65100", isExisting: false });
      });

      setPendingItems(prev => [...prev, { id, layer, geojson, nombre: "", categoria: "", color: "#e65100" }]);
    };
    m.on("pm:create", handleCreate);
    return () => { m.off("pm:create", handleCreate); };
  }, []);

  // --- Click on existing elements opens edit panel ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const onClick = (e: L.LeafletMouseEvent) => {
      const target = e.propagatedFrom || e.target;
      if (!target) return;
      for (const [id, layer] of layerRefs.current.entries()) {
        const l = layer as any;
        if (l._leaflet_id === (target as any)._leaflet_id ||
            (l._layers && Object.values(l._layers).some((sl: any) => sl._leaflet_id === (target as any)._leaflet_id))) {
          const pending = pendingItems.find(p => p.id === id);
          if (pending) {
            setEditPanel({
              id: pending.id, nombre: pending.nombre, categoria: pending.categoria,
              color: pending.color,
              isExisting: false,
            });
          }
          return;
        }
      }
    };
    m.on("click", onClick);
    return () => { m.off("click", onClick); };
  }, [pendingItems]);

  const handleSaveItem = async (item: { id: string; nombre: string; categoria: string; color: string; isExisting: boolean }) => {
    if (!item.nombre || !item.categoria) { alert("Completá nombre y categoría"); return; }
    
    const colores: Record<string, string> = {
      valvula: "#e65100", antena: "#6a1b9a", antena_sonda: "#f9a825",
    };
    const tableMap: Record<string, string> = {
      valvula: "valvulas", antena: "antenas", antena_sonda: "sondas",
    };
    const table = tableMap[item.categoria];
    if (!table) { alert("Categoría inválida"); return; }

    if (item.isExisting) {
      const { error } = await supabase.from(table).update({ codigo: item.nombre, tipo: item.categoria }).eq("id", item.id);
      if (error) { alert("Error: " + error.message); return; }
      setContador(c => c + 1);
    } else {
      const layer = layerRefs.current.get(item.id);
      if (!layer) return;
      const geojson = layer.toGeoJSON();
      const insertData: any = { 
        codigo: item.nombre, 
        geometria: geojson.geometry,
        tipo: item.categoria,
      };
      if (item.categoria === "valvula") {
        insertData.tipo = item.categoria;
      }
      if (item.categoria === "antena" || item.categoria === "antena_sonda") {
        if (equipoId) insertData.equipo_id = equipoId;
      }
      
      const { data, error } = await supabase.from(table).insert(insertData).select();
      if (error) { alert("Error: " + error.message); return; }
      if (!data || data.length === 0) return;
      const nuevo = data[0];
      const color = item.color || colores[item.categoria] || "#999";

      layer.setIcon(L.divIcon({
        className: "",
        html: `<div style="width:12px;height:12px;background:${color};border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12], iconAnchor: [6, 6],
      }));
      
      layerRefs.current.delete(item.id);
      layerRefs.current.set(nuevo.id, layer);
      (layer.pm as any)?.setOptions?.({ layerId: nuevo.id, snappable: true, draggable: false });
      setPendingItems(prev => prev.filter(p => p.id !== item.id));
      setContador(c => c + 1);
    }
    setEditPanel(null);
  };

  const bulkTableMap: Record<string, string> = {
    valvula: "valvulas", antena: "antenas", antena_sonda: "sondas",
  };

  const handleBulkImport = async () => {
    if (!importPreview || importPreview.length === 0) return;
    
    let ok = 0, err = 0;
    for (const item of importPreview) {
      try {
        const table = bulkTableMap[item.categoria];
        if (!table) { err++; continue; }
        const insertData: any = {
          codigo: item.nombre,
          geometria: { type: "Point", coordinates: [item.lng, item.lat] },
          tipo: item.categoria,
        };
        if (item.categoria === "antena" || item.categoria === "antena_sonda") {
          if (equipoId) insertData.equipo_id = equipoId;
        }
        const { error } = await supabase.from(table).insert(insertData);
        if (error) err++; else ok++;
      } catch(e) { err++; }
    }
    alert(`Importados: ${ok} | Errores: ${err}`);
    setImportPreview(null);
    setContador(c => c + 1);
  };

  const handleFileImport = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    if (ext === 'kmz' || ext === 'kml') {
      // KMZ/KML parser
      const JSZip = (await import('jszip')).default;
      const toGeoJSON = (await import('@tmcw/togeojson')).default;
      
      let kmlText = '';
      if (ext === 'kmz') {
        const zip = await JSZip.loadAsync(file);
        const kmlFile = Object.keys(zip.files).find(f => f.endsWith('.kml'));
        if (!kmlFile) { alert('No se encontró archivo KML en el KMZ'); return; }
        kmlText = await zip.files[kmlFile].async('text');
      } else {
        kmlText = await file.text();
      }
      
      const parser = new DOMParser();
      const kml = parser.parseFromString(kmlText, 'text/xml');
      const geojson = toGeoJSON.kml(kml);
      
      const points: any[] = [];
      const extractPoints = (features: any[]) => {
        features.forEach((f: any) => {
          if (f.type === 'FeatureCollection') extractPoints(f.features);
          else if (f.geometry?.type === 'Point') {
            points.push({
              nombre: f.properties?.name || f.properties?.Name || 'Punto',
              categoria: '',
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0],
              color: '#e65100',
            });
          }
        });
      };
      extractPoints(Array.isArray(geojson) ? geojson : geojson.features || []);
      if (points.length === 0) { alert('No se encontraron puntos en el archivo'); return; }
      setImportPreview(points);
    } else {
      // Excel/CSV parser
      const XLSX = (await import('xlsx')).default;
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      const header = rows[0]?.map((h: string) => (h||'').toLowerCase().trim());
      if (!header) { alert('Archivo vacío'); return; }
      
      const colNombre = header.findIndex((h: string) => h.includes('nombre') || h.includes('name') || h.includes('codigo'));
      const colCat = header.findIndex((h: string) => h.includes('categoria') || h.includes('cat') || h.includes('tipo'));
      const colLat = header.findIndex((h: string) => h.includes('lat') || h.includes('y'));
      const colLng = header.findIndex((h: string) => h.includes('lng') || h.includes('lon') || h.includes('x'));
      
      if (colLat === -1 || colLng === -1) { alert('Columnas Lat/Lng no encontradas'); return; }
      
      const points = rows.slice(1).map(row => ({
        nombre: (colNombre >= 0 ? row[colNombre] : 'Punto') || 'Punto',
        categoria: colCat >= 0 ? (row[colCat] || '').toString().toLowerCase().replace(/\s/g, '_') : '',
        lat: parseFloat(row[colLat]),
        lng: parseFloat(row[colLng]),
        color: '#e65100',
      })).filter(p => !isNaN(p.lat) && !isNaN(p.lng));
      
      if (points.length === 0) { alert('No se encontraron puntos válidos'); return; }
      setImportPreview(points);
    }
  };

  // --- Save ---
  const handleSave = () => {
    if (!imageUrl) return alert("Espera que cargue el plano...");
    const m = mapRef.current;
    if (!m) { alert("Mapa no disponible"); return; }
    setSaving(true);
    // Calculate center from overlay bounds
    const ov = imgOverlayRef.current;
    if (!ov) { setSaving(false); alert("Plano no disponible"); return; }
    const bounds = ov.getBounds();
    const ctr = bounds.getCenter();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    onSave({
      center: [ctr.lat, ctr.lng],
      sw: [sw.lat, sw.lng],
      ne: [ne.lat, ne.lng],
      rotation, opacity, zoom_level: zoom, mapZoom: m.getZoom(),
    });
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
    // Remove only previously rendered existing-element layers (not pending)
    const toRemove: any[] = [];
    capasRef.current.forEach(l => {
      const id = (l as any).pm?.getOptions()?.layerId || "";
      if (!id.startsWith("pending_")) {
        toRemove.push(l);
        m.removeLayer(l);
      }
    });
    capasRef.current = capasRef.current.filter(l => (l as any).pm?.getOptions()?.layerId?.startsWith("pending_"));
    // Also clean layerRefs of non-pending entries (they'll be re-added)
    for (const [key] of layerRefs.current.entries()) {
      if (!key.startsWith("pending_")) layerRefs.current.delete(key);
    }

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
      // Don't remove pending layers in cleanup
      capasRef.current.forEach(l => {
        const id = (l as any).pm?.getOptions()?.layerId || "";
        if (!id.startsWith("pending_")) m.removeLayer(l);
      });
      capasRef.current = capasRef.current.filter(l => (l as any).pm?.getOptions()?.layerId?.startsWith("pending_"));
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
            <input type="number" min={3} max={2000} step={0.1} value={zoom} onChange={e => setZoom(Math.max(3, Number(e.target.value) || 3))} style={{ width: 52, fontSize: 12, textAlign: "center", border: "1px solid #ccc", borderRadius: 4, padding: "4px 2px" }} />
            <button onClick={() => setZoom(z => Math.min(2000, z + 0.1))} style={btn}>🔼</button>
            <input type="range" min={3} max={2000} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ width: 50, accentColor: "#1565c0" }} />
            <span style={{ color: "#ddd" }}>|</span>
            <button onClick={() => setRotation(r => (r - 1 + 360) % 360)} style={btn}>⟲</button>
            <input type="number" min={0} max={359} step={1} value={Math.round(rotation)} onChange={e => setRotation((Number(e.target.value) % 360 + 360) % 360)} style={{ width: 48, fontSize: 12, textAlign: "center", border: "1px solid #ccc", borderRadius: 4, padding: "4px 2px" }} />
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "2px solid #e65100", background: "#fff3e0", flexShrink: 0, flexWrap: "wrap" }}>
          <button onClick={() => setColocandoPunto(!colocandoPunto)} style={{
            padding: "8px 18px", borderRadius: 4, border: "none", cursor: "pointer",
            fontSize: 14, fontWeight: 700,
            background: colocandoPunto ? "#e65100" : "#1565c0",
            color: "white",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}>{colocandoPunto ? "📍 Click en el mapa para colocar..." : "➕ AGREGAR PUNTO"}</button>
          <label style={{ fontSize: 14, fontWeight: 700, color: "#2e7d32", cursor: "pointer", padding: "8px 18px", border: "2px solid #2e7d32", borderRadius: 4, background: "white" }}>
            📁 IMPORTAR (KMZ/Excel)
            <input type="file" accept=".kmz,.kml,.xlsx,.xls,.csv" style={{ display: "none" }} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await handleFileImport(file);
              e.target.value = '';
            }} />
          </label>
          {pendingItems.length > 0 && (
            <span style={{ fontSize: 13, color: "#e65100", fontWeight: 700 }}>
              {pendingItems.length} punto{pendingItems.length !== 1 ? "s" : ""} pendiente{pendingItems.length !== 1 ? "s" : ""} — click en el punto gris para editar
            </span>
          )}
        </div>

        {editPanel && (
          <EditPanel
            data={editPanel}
            onSave={handleSaveItem}
            onCancel={() => setEditPanel(null)}
            onDelete={async (id) => {
              if (!confirm("¿Eliminar este elemento?")) return;
              const layer = layerRefs.current.get(id);
              if (layer) mapRef.current?.removeLayer(layer);
              layerRefs.current.delete(id);
              setPendingItems(prev => prev.filter(p => p.id !== id));
              setEditPanel(null);
              setContador(c => c + 1);
            }}
          />
        )}

        {importPreview && (
          <ImportPreview items={importPreview} onConfirm={handleBulkImport} onCancel={() => setImportPreview(null)} />
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

// ─── Edit Panel Component ────────────────────────────────────────────────────

function EditPanel({ data, onSave, onCancel, onDelete }: {
  data: { id: string; nombre: string; categoria: string; color: string; isExisting: boolean };
  onSave: (item: any) => Promise<void>;
  onCancel: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [nombre, setNombre] = useState(data.nombre);
  const [categoria, setCategoria] = useState(data.categoria);
  const [color, setColor] = useState(data.color || "#e65100");
  const colores: Record<string, string> = { valvula: "#e65100", antena: "#6a1b9a", antena_sonda: "#f9a825" };

  return (
    <div style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fff3e0", fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, color: "#e65100" }}>
        {data.isExisting ? "✎ Editar punto" : "✚ Nuevo punto"}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} style={{ width: 100, padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 12 }} />
        <select value={categoria} onChange={e => { setCategoria(e.target.value); if (colores[e.target.value]) setColor(colores[e.target.value]); }} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 12 }}>
          <option value="">Categoría...</option>
          <option value="valvula">🟠 Válvula</option>
          <option value="antena">🟣 Antena</option>
          <option value="antena_sonda">🟡 Antena-Sonda</option>
        </select>
        <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 32, height: 28, padding: 0, border: "1px solid #ccc", borderRadius: 4, cursor: "pointer" }} />
        <button onClick={() => onSave({ ...data, nombre, categoria, color })} style={{ padding: "6px 14px", background: "#2e7d32", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>✓ Guardar</button>
        <button onClick={onCancel} style={{ padding: "6px 14px", background: "#666", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>✕</button>
        {!data.isExisting && (
          <button onClick={() => onDelete(data.id)} style={{ padding: "6px 14px", background: "#c62828", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>🗑</button>
        )}
      </div>
    </div>
  );
}

function ImportPreview({ items, onConfirm, onCancel }: {
  items: { nombre: string; categoria: string; lat: number; lng: number; color: string }[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const colores: Record<string, string> = { valvula: "#e65100", antena: "#6a1b9a", antena_sonda: "#f9a825" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 6000 }}>
      <div style={{ background: "#fff", borderRadius: 8, padding: 20, maxWidth: 700, maxHeight: "80vh", overflow: "auto" }}>
        <h3 style={{ margin: "0 0 12px" }}>Previsualizar importación ({items.length} puntos)</h3>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#f5f5f5" }}>
            <th style={{ padding: 4, border: "1px solid #ddd" }}>#</th>
            <th style={{ padding: 4, border: "1px solid #ddd" }}>Nombre</th>
            <th style={{ padding: 4, border: "1px solid #ddd" }}>Categoría</th>
            <th style={{ padding: 4, border: "1px solid #ddd" }}>Lat</th>
            <th style={{ padding: 4, border: "1px solid #ddd" }}>Lng</th>
          </tr></thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td style={{ padding: 4, border: "1px solid #ddd", textAlign: "center" }}>{i + 1}</td>
                <td style={{ padding: 4, border: "1px solid #ddd" }}>{item.nombre}</td>
                <td style={{ padding: 4, border: "1px solid #ddd" }}>
                  <select value={item.categoria} onChange={e => { item.categoria = e.target.value; item.color = colores[e.target.value] || "#e65100"; }} style={{ fontSize: 11, padding: "2px 4px" }}>
                    <option value="">--</option>
                    <option value="valvula">Válvula</option>
                    <option value="antena">Antena</option>
                    <option value="antena_sonda">Antena-Sonda</option>
                  </select>
                </td>
                <td style={{ padding: 4, border: "1px solid #ddd" }}>{item.lat.toFixed(6)}</td>
                <td style={{ padding: 4, border: "1px solid #ddd" }}>{item.lng.toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "6px 14px", border: "1px solid #ccc", borderRadius: 4, background: "#f5f5f5", cursor: "pointer" }}>Cancelar</button>
          <button onClick={onConfirm} style={{ padding: "6px 14px", background: "#2e7d32", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}>✓ Importar {items.length} puntos</button>
        </div>
      </div>
    </div>
  );
}
