import { useState, useEffect, useRef } from "react";
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

interface Props {
  equipoCodigo: string;
  equipoId: string;
  onClose: () => void;
}

interface PuntoItem {
  id: string;
  nombre: string;
  categoria: string; // "valvula" | "antena" | "antena_sonda"
  color: string;
}

const CATEGORIAS = {
  valvula: { label: "Válvula", color: "#e65100", tabla: "valvulas" },
  antena: { label: "Antena", color: "#6a1b9a", tabla: "antenas" },
  antena_sonda: { label: "Antena-Sonda", color: "#f9a825", tabla: "sondas" },
};

export default function Georreferenciador({ equipoCodigo, equipoId, onClose }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRefs = useRef<Map<string, any>>(new Map());
  const capasRef = useRef<any[]>([]);

  const [ready, setReady] = useState(false);
  const [colocandoPunto, setColocandoPunto] = useState(false);
  const [editPanel, setEditPanel] = useState<{ id: string; nombre: string; categoria: string; color: string } | null>(null);
  const [importPreview, setImportPreview] = useState<{ nombre: string; categoria: string; lat: number; lng: number; color: string }[] | null>(null);
  const [contador, setContador] = useState(0);
  const [puntosExistentes, setPuntosExistentes] = useState<any[]>([]);

  // --- Init map ---
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const m = L.map(mapContainerRef.current, {
      center: [-35.14, -71.62], zoom: 15, zoomControl: true,
      dragging: true, scrollWheelZoom: true,
    });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "&copy; Esri",
    }).addTo(m);
    mapRef.current = m;
    setTimeout(() => { m.invalidateSize(); setReady(true); }, 200);
    return () => { m.remove(); mapRef.current = null; };
  }, []);

  // --- Click para colocar punto ---
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
      layerRefs.current.set(id, marker);
      marker.on("click", () => {
        setEditPanel({ id, nombre: "", categoria: "", color: "#e65100" });
      });
      setColocandoPunto(false);
    };
    m.on("click", onClick);
    return () => { m.off("click", onClick); };
  }, [colocandoPunto]);

  // --- Cargar puntos existentes del equipo ---
  useEffect(() => {
    if (!ready || !equipoId) return;
    const h = { "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk" };
    const api = "https://nnelrvctqjbwfucccxfh.supabase.co/rest/v1/";
    const todos: any[] = [];
    fetch(api + `valvulas?equipo_id=eq.${equipoId}`, { headers: h })
      .then(r => r.json()).then((d: any[]) => { if (Array.isArray(d)) d.forEach(x => todos.push({ ...x, categoria: "valvula" })); })
      .catch(() => {});
    fetch(api + `antenas?equipo_id=eq.${equipoId}`, { headers: h })
      .then(r => r.json()).then((d: any[]) => { if (Array.isArray(d)) d.forEach(x => todos.push({ ...x, categoria: "antena" })); })
      .catch(() => {});
    fetch(api + `sondas?equipo_id=eq.${equipoId}`, { headers: h })
      .then(r => r.json()).then((d: any[]) => { if (Array.isArray(d)) d.forEach(x => todos.push({ ...x, categoria: "antena_sonda" })); })
      .catch(() => {});
    // Merge asincronamente: simple polling no es ideal, usar Promise.all
    setTimeout(() => setPuntosExistentes(todos), 800);
  }, [ready, equipoId, contador]);

  // --- Render puntos existentes ---
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    capasRef.current.forEach(l => m.removeLayer(l));
    capasRef.current = [];
    layerRefs.current.clear();

    puntosExistentes.forEach(p => {
      if (!p.geometria?.coordinates) return;
      const cat = CATEGORIAS[p.categoria as keyof typeof CATEGORIAS];
      const color = p.color || (cat?.color || "#999");
      const marker = L.marker([p.geometria.coordinates[1], p.geometria.coordinates[0]], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:12px;height:12px;background:${color};border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
          iconSize: [12, 12], iconAnchor: [6, 6],
        }),
      }).addTo(m);
      marker.bindPopup(`<b>${p.codigo || "Punto"}</b><br/>${cat?.label || p.categoria}`);
      layerRefs.current.set(p.id, marker);
      capasRef.current.push(marker);
    });
  }, [puntosExistentes]);

  const handleSaveItem = async (item: PuntoItem) => {
    if (!item.nombre || !item.categoria) { alert("Completá nombre y categoría"); return; }
    const cat = CATEGORIAS[item.categoria as keyof typeof CATEGORIAS];
    if (!cat) { alert("Categoría inválida"); return; }

    const layer = layerRefs.current.get(item.id);
    if (!layer) { alert("Punto no encontrado"); return; }
    const geojson = layer.toGeoJSON();

    const insertData: any = {
      codigo: item.nombre,
      tipo: item.categoria,
      color: item.color || cat.color,
      geometria: geojson.geometry,
    };
    if (equipoId) insertData.equipo_id = equipoId;

    const { data, error } = await supabase.from(cat.tabla).insert(insertData).select();
    if (error) { alert("Error: " + error.message); return; }
    if (!data || data.length === 0) return;

    // Remover el marker temporal
    const m = mapRef.current;
    if (m && layer) m.removeLayer(layer);
    layerRefs.current.delete(item.id);
    setEditPanel(null);
    setContador(c => c + 1);
    alert(`✅ ${cat.label} "${item.nombre}" guardado`);
  };

  const handleBulkImport = async () => {
    if (!importPreview || importPreview.length === 0) return;
    let ok = 0, err = 0;
    for (const item of importPreview) {
      try {
        const cat = CATEGORIAS[item.categoria as keyof typeof CATEGORIAS];
        if (!cat) { err++; continue; }
        const insertData: any = {
          codigo: item.nombre,
          tipo: item.categoria,
          color: item.color || cat.color,
          geometria: { type: "Point", coordinates: [item.lng, item.lat] },
        };
        if (equipoId) insertData.equipo_id = equipoId;
        const { error } = await supabase.from(cat.tabla).insert(insertData);
        if (error) err++; else ok++;
      } catch (e) { err++; }
    }
    alert(`Importados: ${ok} | Errores: ${err}`);
    setImportPreview(null);
    setContador(c => c + 1);
  };

  const handleFileImport = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'kmz' || ext === 'kml') {
      const JSZip = (await import('jszip')).default;
      const toGeoJSON = (await import('@tmcw/togeojson')).default;
      let kmlText = '';
      if (ext === 'kmz') {
        const zip = await JSZip.loadAsync(file);
        const kmlFile = Object.keys(zip.files).find(f => f.endsWith('.kml'));
        if (!kmlFile) { alert('No se encontró KML en el KMZ'); return; }
        kmlText = await zip.files[kmlFile].async('text');
      } else {
        kmlText = await file.text();
      }
      const parser = new DOMParser();
      const kml = parser.parseFromString(kmlText, 'text/xml');
      const geojson = toGeoJSON.kml(kml);
      const points: any[] = [];
      const extract = (features: any[]) => {
        features.forEach((f: any) => {
          if (f.type === 'FeatureCollection') extract(f.features);
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
      extract(Array.isArray(geojson) ? geojson : geojson.features || []);
      if (points.length === 0) { alert('No se encontraron puntos'); return; }
      setImportPreview(points);
    } else {
      const XLSX = (await import('xlsx')).default;
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      const header = rows[0]?.map((h: string) => (h || '').toLowerCase().trim());
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

  const ctr: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 5000,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex", justifyContent: "center", alignItems: "center",
  };
  const modalStyle: React.CSSProperties = {
    background: "#fff", borderRadius: 8, overflow: "hidden",
    display: "flex", flexDirection: "column",
    width: "95vw", height: "90vh", maxWidth: "95vw", maxHeight: "90vh",
  };

  return (
    <div style={ctr} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: "1px solid #ddd",
          fontSize: 14, fontWeight: 600, flexShrink: 0, flexWrap: "wrap", gap: 8,
        }}>
          <span>Puntos de riego: {equipoCodigo}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setColocandoPunto(!colocandoPunto)} style={{
              padding: "8px 18px", borderRadius: 4, border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 700,
              background: colocandoPunto ? "#e65100" : "#1565c0", color: "white",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}>
              {colocandoPunto ? "📍 Click en el mapa..." : "➕ AGREGAR PUNTO"}
            </button>
            <label style={{ fontSize: 14, fontWeight: 700, color: "#2e7d32", cursor: "pointer", padding: "8px 18px", border: "2px solid #2e7d32", borderRadius: 4, background: "white" }}>
              📁 IMPORTAR (KMZ/Excel)
              <input type="file" accept=".kmz,.kml,.xlsx,.xls,.csv" style={{ display: "none" }} onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await handleFileImport(file);
                e.target.value = '';
              }} />
            </label>
            <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 4, border: "1px solid #ccc", cursor: "pointer", color: "#c62828", fontWeight: 600 }}>✕ Cerrar</button>
          </div>
        </div>

        {/* Edit panel */}
        {editPanel && (
          <EditPanel
            data={editPanel}
            onSave={handleSaveItem}
            onCancel={() => setEditPanel(null)}
            onDelete={(id) => {
              const m = mapRef.current;
              const layer = layerRefs.current.get(id);
              if (m && layer) m.removeLayer(layer);
              layerRefs.current.delete(id);
              setEditPanel(null);
            }}
          />
        )}

        {/* Map */}
        <div style={{ flex: 1, position: "relative" }}>
          <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, zIndex: 1 }} />
          {!ready && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, background: "rgba(255,255,255,0.7)" }}>
              <p style={{ color: "#666", fontSize: 14 }}>Cargando mapa...</p>
            </div>
          )}
        </div>
      </div>

      {/* Import preview */}
      {importPreview && (
        <ImportPreview items={importPreview} onConfirm={handleBulkImport} onCancel={() => setImportPreview(null)} />
      )}
    </div>
  );
}

// ─── Edit Panel ────────────────────────────────────────────────────────────────

function EditPanel({ data, onSave, onCancel, onDelete }: {
  data: { id: string; nombre: string; categoria: string; color: string };
  onSave: (item: PuntoItem) => Promise<void>;
  onCancel: () => void;
  onDelete: (id: string) => void;
}) {
  const [nombre, setNombre] = useState(data.nombre);
  const [categoria, setCategoria] = useState(data.categoria);
  const [color, setColor] = useState(data.color || "#e65100");

  return (
    <div style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fff3e0", fontSize: 13, flexShrink: 0 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, color: "#e65100" }}>✚ Nuevo punto</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} style={{ width: 120, padding: "5px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 13 }} />
        <select value={categoria} onChange={e => { setCategoria(e.target.value); const c = CATEGORIAS[e.target.value as keyof typeof CATEGORIAS]; if (c) setColor(c.color); }} style={{ padding: "5px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 13 }}>
          <option value="">Categoría...</option>
          <option value="valvula">🟠 Válvula</option>
          <option value="antena">🟣 Antena</option>
          <option value="antena_sonda">🟡 Antena-Sonda</option>
        </select>
        <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 36, height: 30, padding: 0, border: "1px solid #ccc", borderRadius: 4, cursor: "pointer" }} />
        <button onClick={() => onSave({ ...data, nombre, categoria, color })} style={{ padding: "6px 16px", background: "#2e7d32", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>✓ Guardar</button>
        <button onClick={onCancel} style={{ padding: "6px 14px", background: "#666", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>✕</button>
        <button onClick={() => onDelete(data.id)} style={{ padding: "6px 14px", background: "#c62828", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>🗑</button>
      </div>
    </div>
  );
}

// ─── Import Preview ────────────────────────────────────────────────────────────

function ImportPreview({ items, onConfirm, onCancel }: {
  items: { nombre: string; categoria: string; lat: number; lng: number; color: string }[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
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
                  <select value={item.categoria} onChange={e => { item.categoria = e.target.value; const c = CATEGORIAS[e.target.value as keyof typeof CATEGORIAS]; if (c) item.color = c.color; }} style={{ fontSize: 11, padding: "2px 4px" }}>
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
