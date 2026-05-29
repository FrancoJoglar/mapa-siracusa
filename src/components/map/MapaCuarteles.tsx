import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Cuartel, Edificacion, SectorGeo, FiltrosCuartel } from "../../lib/types";
import {
  COLOR_EDIFICACION, colorPorEspecie, COLOR_POR_ESPECIE,
} from "../../lib/colors";
import BarraFiltros from "./BarraFiltros";
import BuscadorCuartel from "./BuscadorCuartel";
import { exportarCuarteles, exportarCuartelesGeoJSON } from "../../lib/export";
import L from "leaflet";
import * as turf from "@turf/turf";

const CENTRO_MAPA: [number, number] = [-35.14, -71.625];
const ZOOM_INICIAL = 14;

type Vista = "cuarteles" | "sectores";

interface Props {
  cuarteles: Cuartel[];
  edificaciones: Edificacion[];
  sectores: SectorGeo[];
}

const FILTROS_VACIOS: FiltrosCuartel = {
  especie: "", variedad: "", anioDesde: null, anioHasta: null,
  equipo: "", sector: "", jefeCampo: "",
};

type LayerEntry = { layer: L.Path; baseStyle: L.PathOptions };
type LayersMap = Map<string, LayerEntry>;

export default function MapaCuarteles({ cuarteles, edificaciones, sectores }: Props) {
  const [filtros, setFiltros] = useState<FiltrosCuartel>(FILTROS_VACIOS);
  const [vista, setVista] = useState<Vista>("sectores");
  const [mostrarEdif, setMostrarEdif] = useState(true);
  const [fitBounds, setFitBounds] = useState<L.LatLngBounds | null>(null);
  const [satelite, setSatelite] = useState(true);
  const [medir, setMedir] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const layersRef = useRef<LayersMap>(new Map());
  const selectedRef = useRef<string | null>(null);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);

  // Register a layer with its base style
  const registerLayer = useCallback((id: string, layer: L.Path, baseStyle: L.PathOptions) => {
    layersRef.current.set(id, { layer, baseStyle });
  }, []);

  // Unified painting: iterates all registered layers and applies correct style
  const pintarCapas = useCallback(() => {
    layersRef.current.forEach(({ layer, baseStyle }, id) => {
      if (id === selectedId) {
        layer.setStyle({ ...baseStyle, weight: 4, color: "#e65100", fillOpacity: 0.85, opacity: 0.9 });
        layer.bringToFront();
      } else if (id === highlightedId) {
        layer.setStyle({ ...baseStyle, weight: 3, color: "#ff9800", fillOpacity: 0.8, opacity: 0.9 });
      } else {
        layer.setStyle(baseStyle);
      }
    });
  }, [selectedId, highlightedId]);

  useEffect(() => { pintarCapas(); }, [pintarCapas]);

  const cambiarVista = (v: Vista) => {
    setVista(v);
    setFiltros(FILTROS_VACIOS);
    setFitBounds(null);
    setSelectedId(null);
    setHighlightedId(null);
  };

  // ====== HELPERS ======
  const parts = (raw: string) => raw.split('-').map(x => x.trim()).filter(Boolean);
  const numSort = (a: string, b: string) => {
    const na = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(b.replace(/\D/g, ''), 10) || 0;
    return na - nb;
  };

  // ====== UNIQUE VALUES ======
  const uniqueCuarteles = useMemo(() => {
    const e = new Set<string>(); const v = new Set<string>();
    const eq = new Set<number>(); const s = new Set<number>();
    const j = new Set<string>();
    cuarteles.forEach(c => {
      if (c.especie) e.add(c.especie);
      if (c.variedad) v.add(c.variedad);
      if (c.equipo_riego) parts(c.equipo_riego).forEach(n => eq.add(Number(n)));
      if (c.sector_raw) parts(c.sector_raw).forEach(n => s.add(Number(n)));
      if (c.jefe_campo) j.add(c.jefe_campo);
    });
    return {
      especies: Array.from(e).sort(), variedades: Array.from(v).sort(),
      equipos: Array.from(eq).sort((a, b) => a - b).map(String),
      sectores: Array.from(s).sort((a, b) => a - b).map(String),
      jefes: Array.from(j).sort(),
    };
  }, [cuarteles]);

  const uniqueSectores = useMemo(() => {
    const e = new Set<string>(); const v = new Set<string>();
    const eq = new Set<string>(); const j = new Set<string>();
    const allCodes: string[] = [];
    sectores.forEach(s => {
      if (s.especie) e.add(s.especie);
      if (s.variedad) v.add(s.variedad);
      if (s.equipo) eq.add(s.equipo);
      if (s.jefe_campo) s.jefe_campo.split("/").forEach((jc: string) => j.add(jc.trim()));
      allCodes.push(s.codigo);
    });
    return {
      especies: Array.from(e).sort(), variedades: Array.from(v).sort(),
      equipos: Array.from(eq).sort(numSort),
      sectores: allCodes.sort(numSort),
      jefes: Array.from(j).sort(),
    };
  }, [sectores]);

  // Sector codes filtered by selected equipo (cascading dropdown)
  const sectoresFiltradosPorEquipo = useMemo(() => {
    if (vista === "sectores") {
      if (!filtros.equipo) return uniqueSectores.sectores;
      return sectores.filter(s => s.equipo === filtros.equipo).map(s => s.codigo).sort(numSort);
    }
    if (!filtros.equipo) return uniqueCuarteles.sectores;
    const nums = new Set<number>();
    cuarteles.forEach(c => {
      if (c.equipo_riego && parts(c.equipo_riego).includes(filtros.equipo) && c.sector_raw) {
        parts(c.sector_raw).forEach(n => nums.add(Number(n)));
      }
    });
    return Array.from(nums).sort((a, b) => a - b).map(String);
  }, [vista, filtros.equipo, sectores, cuarteles, uniqueSectores.sectores, uniqueCuarteles.sectores]);

  // ====== FILTERING ======
  const filteredCuarteles = useMemo(() => {
    return cuarteles.filter(c => {
      if (filtros.especie && c.especie !== filtros.especie) return false;
      if (filtros.variedad && c.variedad !== filtros.variedad) return false;
      if (filtros.anioDesde && (!c.anio_plantacion || c.anio_plantacion < filtros.anioDesde)) return false;
      if (filtros.anioHasta && (!c.anio_plantacion || c.anio_plantacion > filtros.anioHasta)) return false;
      if (filtros.equipo && (!c.equipo_riego || !parts(c.equipo_riego).includes(filtros.equipo))) return false;
      if (filtros.sector && (!c.sector_raw || !parts(c.sector_raw).includes(filtros.sector))) return false;
      if (filtros.jefeCampo && c.jefe_campo !== filtros.jefeCampo) return false;
      return true;
    });
  }, [cuarteles, filtros]);

  const filteredSectores = useMemo(() => {
    return sectores.filter(s => {
      if (filtros.especie && s.especie !== filtros.especie) return false;
      if (filtros.variedad && s.variedad !== filtros.variedad) return false;
      if (filtros.anioDesde && (!s.anio || s.anio < filtros.anioDesde)) return false;
      if (filtros.anioHasta && (!s.anio || s.anio > filtros.anioHasta)) return false;
      if (filtros.equipo && s.equipo !== filtros.equipo) return false;
      if (filtros.sector && s.codigo !== filtros.sector) return false;
      if (filtros.jefeCampo && (!s.jefe_campo || !s.jefe_campo.includes(filtros.jefeCampo))) return false;
      return true;
    });
  }, [sectores, filtros]);

  const handleFiltroChange = (f: FiltrosCuartel) => {
    if (f.equipo !== filtros.equipo) { setFiltros({ ...f, sector: "" }); }
    else { setFiltros(f); }
  };

  const numFiltrados = vista === "cuarteles" ? filteredCuarteles.length : filteredSectores.length;
  const total = vista === "cuarteles" ? cuarteles.length : sectores.length;
  const superficieFiltrada = vista === "cuarteles"
    ? filteredCuarteles.reduce((s, c) => s + (c.superficie_ha || 0), 0)
    : filteredSectores.reduce((s, sec) => s + (sec.hectareas || 0), 0);

  // ====== GEOJSON ======
  const geoJsonCuarteles = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: filteredCuarteles.filter(c => !!c.geojson).map(c => ({
      ...c.geojson!, properties: { cuartel_id: c.id },
    })),
  }), [filteredCuarteles]);

  const geoJsonSectores = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: filteredSectores.filter(s => !!s.geojson).map(s => ({
      ...s.geojson!, properties: { sector_id: s.id },
    })),
  }), [filteredSectores]);

  const geoJsonEdif = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: edificaciones.filter(e => !!e.geojson).map(e => ({
      ...e.geojson!, properties: { nombre: e.nombre },
    })),
  }), [edificaciones]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <BarraFiltros
        filtros={filtros}
        onChange={handleFiltroChange}
        cuartelesFiltrados={numFiltrados}
        totalCuarteles={total}
        totalSuperficie={superficieFiltrada}
        onExportExcel={() =>
          vista === "cuarteles"
            ? exportarCuarteles(filteredCuarteles, "siracusa_cuarteles")
            : exportarCuarteles(filteredSectores as any, "siracusa_sectores")
        }
        onExportGeoJSON={() =>
          vista === "cuarteles"
            ? exportarCuartelesGeoJSON(filteredCuarteles, "siracusa_cuarteles")
            : exportarCuartelesGeoJSON(filteredSectores as any, "siracusa_sectores")
        }
        {...(vista === "cuarteles"
          ? { ...uniqueCuarteles, sectores: sectoresFiltradosPorEquipo }
          : { ...uniqueSectores, sectores: sectoresFiltradosPorEquipo })}
        vista={vista}
      />
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer center={CENTRO_MAPA} zoom={ZOOM_INICIAL} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            key={satelite ? "sat" : "osm"}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url={satelite
              ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            }
          />
          <ControlSatelite satelite={satelite} onToggle={() => setSatelite(!satelite)} />
          <MapClickHandler onDeselect={() => setSelectedId(null)} />
          <ToggleVista vista={vista} onChange={cambiarVista} />
          <ToggleEdificaciones visible={mostrarEdif} onToggle={() => setMostrarEdif(!mostrarEdif)} />
          <ToggleMedir visible={medir} onToggle={() => setMedir(!medir)} />
          {medir && <MedirControls />}

          {vista === "cuarteles" && (
            <GeoJSON
              key={`cuarteles-${filteredCuarteles.length}`}
              data={geoJsonCuarteles}
              onEachFeature={(feature: any, layer: any) => {
                // Clear layers on first feature of this mount
                if (feature === geoJsonCuarteles.features[0]) {
                  layersRef.current.clear();
                }
                const c = cuarteles.find(x => x.id === feature.properties.cuartel_id);
                const fId = feature.properties.cuartel_id;
                const baseStyle: L.PathOptions = {
                  fillColor: colorPorEspecie(c?.especie || ""),
                  color: "#333", weight: 1, fillOpacity: 0.7, opacity: 0.6,
                };
                layer.setStyle(baseStyle);
                registerLayer(fId, layer, baseStyle);
                if (c) {
                  layer.bindTooltip(c.nombre || "", { direction: "center", className: "cuartel-tooltip", opacity: 0.9 });
                  layer.bindPopup(popupCuartelHtml(c), { maxWidth: 300 });
                }
                layer.on("mouseover", () => setHighlightedId(fId));
                layer.on("mouseout", () => setHighlightedId(null));
                layer.on("click", (e: any) => {
                  L.DomEvent.stopPropagation(e);
                  setSelectedId(prev => prev === fId ? null : fId);
                });
              }}
            />
          )}

          {vista === "sectores" && (
            <SectoresLayer
              key={filteredSectores.map(s => s.id).join('-') || 'empty'}
              data={geoJsonSectores}
              sectores={sectores}
              onFitBounds={setFitBounds}
              registerLayer={registerLayer}
              selectedRef={selectedRef}
              setSelected={setSelectedId}
              setHighlighted={setHighlightedId}
              clearLayers={() => layersRef.current.clear()}
            />
          )}

          {mostrarEdif && edificaciones.length > 0 && (
            <GeoJSON key="edificaciones" data={geoJsonEdif} onEachFeature={(feature: any, layer: any) => {
              layer.setStyle({ fillColor: COLOR_EDIFICACION, color: "#e65100", weight: 2, fillOpacity: 0.6, opacity: 0.9 });
              layer.bindTooltip(feature.properties.nombre, { direction: "center" });
            }} />
          )}

          {fitBounds && <FlyToBounds bounds={fitBounds} />}
          <Leyenda />
          {vista === "cuarteles" && <BuscadorCuartel cuarteles={cuarteles} />}
        </MapContainer>
      </div>
    </div>
  );
}

// ====== SECTORES LAYER ======
function SectoresLayer({ data, sectores, onFitBounds, registerLayer, selectedRef, setSelected, setHighlighted, clearLayers }: {
  data: GeoJSON.FeatureCollection;
  sectores: SectorGeo[];
  onFitBounds: (b: L.LatLngBounds | null) => void;
  registerLayer: (id: string, layer: L.Path, baseStyle: L.PathOptions) => void;
  selectedRef: React.MutableRefObject<string | null>;
  setSelected: (id: string | null) => void;
  setHighlighted: (id: string | null) => void;
  clearLayers: () => void;
}) {
  useEffect(() => {
    if (data.features.length === 1 && data.features[0].geometry) {
      try {
        const gj = L.geoJSON(data.features[0] as any);
        const bounds = gj.getBounds();
        if (bounds.isValid()) onFitBounds(bounds);
      } catch {}
    } else {
      onFitBounds(null);
    }
  }, [data, onFitBounds]);

  return (
    <GeoJSON
      data={data}
      onEachFeature={(feature: any, layer: any) => {
        // Clear layers on first feature of this mount
        if (feature === data.features[0]) {
          clearLayers();
        }
        const s = sectores.find(x => x.id === feature.properties.sector_id);
        const fId = feature.properties.sector_id;
        const baseStyle: L.PathOptions = {
          fillColor: colorPorEspecie(s?.especie || ""),
          color: "#1565c0", weight: 3, fillOpacity: 0.5, opacity: 0.8,
        };
        layer.setStyle(baseStyle);
        registerLayer(fId, layer, baseStyle);
        if (s) {
          layer.bindTooltip(s.codigo, { direction: "center", className: "cuartel-tooltip", opacity: 0.9 });
          layer.bindPopup(popupSectorHtml(s), { maxWidth: 300 });
        }
        layer.on("mouseover", () => setHighlighted(fId));
        layer.on("mouseout", () => setHighlighted(null));
        layer.on("click", (e: any) => {
          L.DomEvent.stopPropagation(e);
          setSelected(selectedRef.current === fId ? null : fId);
        });
      }}
    />
  );
}

function FlyToBounds({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds?.isValid()) map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
  }, [bounds, map]);
  return null;
}

// ====== POPUP HTML ======
function popupCuartelHtml(c: Cuartel): string {
  const r = (l: string, v: any) => v ? `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500">${l}:</td><td style="padding:3px 0">${v}</td></tr>` : "";

  // Calculate area from polygon geometry
  let supText = "";
  if (c.superficie_ha) supText = c.superficie_ha + " ha";
  if (c.geojson?.geometry) {
    try {
      const areaCalc = turf.area(c.geojson.geometry as any) / 10000;
      supText += (supText ? " (" : "") + areaCalc.toFixed(2) + " ha calc" + (supText ? ")" : "");
    } catch {}
  }
  const supRow = supText ? `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500">Superficie:</td><td style="padding:3px 0">${supText}</td></tr>` : "";

  return `<div style="min-width:200px;font-size:13px"><h3 style="margin:0 0 8px;font-size:15px;font-weight:600">${c.nombre}</h3><table style="width:100%">${r("Especie",c.especie)}${r("Variedad",c.variedad)}${r("Anio plantacion",c.anio_plantacion)}${supRow}${r("Plantas",c.plantas)}${r("Jefe de campo",c.jefe_campo)}${r("Centro costo",c.centro_costo)}${r("Equipo riego",c.equipo_riego)}${r("Sectores",c.sector_raw)}</table></div>`;
}

function popupSectorHtml(s: SectorGeo): string {
  const r = (l: string, v: any) => v ? `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500">${l}:</td><td style="padding:3px 0">${v}</td></tr>` : "";

  let haText = "";
  if (s.hectareas) haText = s.hectareas + " ha";
  if ((s as any).geojson?.geometry) {
    try {
      const areaCalc = turf.area((s as any).geojson.geometry as any) / 10000;
      haText += (haText ? " (" : "") + areaCalc.toFixed(2) + " ha calc" + (haText ? ")" : "");
    } catch {}
  }
  const haRow = haText ? `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500">Hectareas:</td><td style="padding:3px 0">${haText}</td></tr>` : "";

  return `<div style="min-width:200px;font-size:13px"><h3 style="margin:0 0 8px;font-size:15px;font-weight:600">${s.codigo}</h3><table style="width:100%">${r("Equipo",s.equipo)}${r("Especie",s.especie)}${r("Variedad",s.variedad)}${haRow}${r("Anio",s.anio)}${r("Jefe de campo",s.jefe_campo)}${r("Caudal",s.caudal_nominal?s.caudal_nominal+" m3/h":"")}${r("Bomba",s.bomba)}${r("Filtro",s.filtro)}</table></div>`;
}

// ====== CONTROLS ======
function ToggleVista({ vista, onChange }: { vista: Vista; onChange: (v: Vista) => void }) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 10 }}>
      <div className="leaflet-control" style={{ display: "flex", gap: 0 }}>
        <button onClick={() => onChange("cuarteles")} style={{
          ...toggleBtn, borderRadius: "4px 0 0 4px",
          background: vista === "cuarteles" ? "#1565c0" : "white",
          color: vista === "cuarteles" ? "white" : "#333",
        }}>Cuarteles</button>
        <button onClick={() => onChange("sectores")} style={{
          ...toggleBtn, borderRadius: "0 4px 4px 0",
          background: vista === "sectores" ? "#1565c0" : "white",
          color: vista === "sectores" ? "white" : "#333",
        }}>Sectores</button>
      </div>
    </div>
  );
}

function ToggleEdificaciones({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 80 }}>
      <div className="leaflet-control">
        <button onClick={onToggle} style={{
          padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 500,
          background: visible ? "#ef6c00" : "white", color: visible ? "white" : "#333", border: "1px solid #ccc",
        }}>Edificaciones</button>
      </div>
    </div>
  );
}

function ToggleMedir({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 160 }}>
      <div className="leaflet-control">
        <button onClick={onToggle} style={{
          padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 500,
          background: visible ? "#2e7d32" : "white", color: visible ? "white" : "#333", border: "1px solid #ccc",
        }}>Medir</button>
      </div>
    </div>
  );
}

function MedirControls() {
  const map = useMap();

  useEffect(() => {
    // Set measurement styles
    const pm = (map as any).pm;
    pm.setGlobalOptions({
      snappable: false,
      allowSelfIntersection: true,
      templineStyle: { color: "#2e7d32", weight: 2, dashArray: "5,5" },
      hintlineStyle: { color: "#2e7d32", dashArray: "5,5" },
      pathOptions: { color: "#2e7d32", weight: 3, fillColor: "#4caf50", fillOpacity: 0.2 },
    });

    pm.addControls({
      position: "topleft",
      drawPolygon: true,
      drawPolyline: true,
      drawCircle: false, drawCircleMarker: false, drawRectangle: false,
      drawMarker: false, drawText: false,
      cutPolygon: false, rotateMode: false,
      dragMode: false, editMode: false, removalMode: false,
    });

    return () => {
      try {
        pm.removeControls();
        // Remove all drawn layers
        map.eachLayer((l: any) => {
          if (l._measurementLayer || l._pmTempLayer) map.removeLayer(l);
        });
      } catch {}
    };
  }, [map]);

  return null;
}

function MapClickHandler({ onDeselect }: { onDeselect: () => void }) {
  useMap().on("click", onDeselect);
  return null;
}

function ControlSatelite({ satelite, onToggle }: { satelite: boolean; onToggle: () => void }) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 120 }}>
      <div className="leaflet-control">
        <button onClick={onToggle} style={{
          padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 500,
          background: satelite ? "#1565c0" : "white", color: satelite ? "white" : "#333", border: "1px solid #ccc",
        }}>Satelite</button>
      </div>
    </div>
  );
}

function Leyenda() {
  return (
    <div style={{
      position: "absolute", bottom: 30, right: 10, zIndex: 1000,
      background: "white", padding: "8px 12px", borderRadius: 6,
      boxShadow: "0 1px 5px rgba(0,0,0,0.2)", fontSize: 12,
    }}>
      <strong style={{ display: "block", marginBottom: 4 }}>Especies</strong>
      {COLOR_POR_ESPECIE.map(c => (
        <div key={c.especie} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ width: 14, height: 14, backgroundColor: c.color, borderRadius: 2, flexShrink: 0 }} />
          {c.especie}
        </div>
      ))}
    </div>
  );
}

const toggleBtn: React.CSSProperties = {
  padding: "6px 14px", border: "1px solid #ccc", cursor: "pointer", fontSize: 12, fontWeight: 500,
};
