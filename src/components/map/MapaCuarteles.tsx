import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Cuartel, Edificacion, SectorGeo, FiltrosCuartel, UnidadRiego, Equipo, Tuberia, Valvula, Antena, Sonda } from "../../lib/types";
import {
  COLOR_EDIFICACION, colorPorEspecie, COLOR_POR_ESPECIE,
} from "../../lib/colors";
import BarraFiltros from "./BarraFiltros";
import BuscadorCuartel from "./BuscadorCuartel";
import { exportarCuarteles, exportarCuartelesGeoJSON } from "../../lib/export";
import L from "leaflet";
import * as turf from "@turf/turf";
import { supabase } from "../../lib/supabase";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const CENTRO_MAPA: [number, number] = [-35.14, -71.625];
const ZOOM_INICIAL = 14;

type Vista = "cuarteles" | "sectores";

interface Props {
  cuarteles: Cuartel[];
  edificaciones: Edificacion[];
  sectores: SectorGeo[];
  unidades: UnidadRiego[];
  equipos?: Equipo[];
  tuberias?: Tuberia[];
  valvulas?: Valvula[];
  antenas?: Antena[];
  sondas?: Sonda[];
  geos?: any[];
}

const FILTROS_VACIOS: FiltrosCuartel = {
  especie: "", variedad: "", anioDesde: null, anioHasta: null,
  equipo: "", sector: "", jefeCampo: "",
};

type LayerEntry = { layer: L.Path; baseStyle: L.PathOptions; kind: 'cuartel' | 'sector' | 'unidad' };
type LayersMap = Map<string, LayerEntry>;

export default function MapaCuarteles({ cuarteles, edificaciones, sectores, unidades, equipos = [], tuberias = [], valvulas = [], antenas = [], sondas = [], geos = [] }: Props) {
  const [filtros, setFiltros] = useState<FiltrosCuartel>(FILTROS_VACIOS);
  const [vista, setVista] = useState<Vista>("sectores");
  const [mostrarEdif, setMostrarEdif] = useState(true);
  const [mostrarUnidades, setMostrarUnidades] = useState(false);
  const [mostrarTuberias, setMostrarTuberias] = useState(true);
  const [mostrarValvulas, setMostrarValvulas] = useState(true);
  const [mostrarAntenas, setMostrarAntenas] = useState(true);
  const [mostrarSondas, setMostrarSondas] = useState(true);
  const [showEquiposRiego, setShowEquiposRiego] = useState(false);
  const [dibujarValvula, setDibujarValvula] = useState(false);
  const [dibujarTuberia, setDibujarTuberia] = useState(false);
  const [mostrarPlanosGeo, setMostrarPlanosGeo] = useState(false);
  const [opacityGeo, setOpacityGeo] = useState(0.6);
  const [fitBounds, setFitBounds] = useState<L.LatLngBounds | null>(null);
  const [satelite, setSatelite] = useState(true);
  const [medir, setMedir] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showCuartelLabels, setShowCuartelLabels] = useState(false);

  const layersRef = useRef<LayersMap>(new Map());
  const selectedRef = useRef<string | null>(null);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);

  // Register a layer with its base style
  const registerLayer = useCallback((id: string, layer: L.Path, baseStyle: L.PathOptions, kind: 'cuartel' | 'sector' = 'cuartel') => {
    layersRef.current.set(id, { layer, baseStyle, kind });
  }, []);

  // Unified painting: iterates all registered layers and applies correct style
  const pintarCapas = useCallback(() => {
    const isSectorSelected = selectedId && sectores.some(s => s.id === selectedId);

    layersRef.current.forEach(({ layer, baseStyle, kind }, id) => {
      if (id === selectedId) {
        layer.setStyle({ ...baseStyle, weight: 4, color: "#e65100", fillOpacity: 0.85, opacity: 0.9 });
        layer.bringToFront();
      } else if (id === highlightedId) {
        layer.setStyle({ ...baseStyle, weight: 3, color: "#ff9800", fillOpacity: 0.8, opacity: 0.9 });
      } else if (isSectorSelected && kind === 'cuartel') {
        const cuartel = cuarteles.find(c => c.id === id);
        if (cuartel?.sector_ids?.includes(selectedId)) {
          layer.setStyle({ ...baseStyle, weight: 2, color: "#e65100", opacity: 1, fillOpacity: 0.75 });
        } else {
          layer.setStyle({ ...baseStyle, fillOpacity: 0.08, opacity: 0.2, weight: 0.5, color: "#ccc" });
        }
      } else {
        layer.setStyle(baseStyle);
      }
    });
  }, [selectedId, highlightedId, sectores, cuarteles]);

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
    const sectorIdSet = new Set(sectores.map(s => s.id));
    cuarteles.forEach(c => {
      if (c.variedad && c.sector_ids?.some(sid => sectorIdSet.has(sid))) {
        v.add(c.variedad);
      }
    });
    sectores.forEach(s => {
      if (s.especie) e.add(s.especie);
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
  }, [sectores, cuarteles]);

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
      if (filtros.variedad && !cuarteles.some(c => c.sector_ids?.includes(s.id) && c.variedad === filtros.variedad)) return false;
      if (filtros.anioDesde && (!s.anio || s.anio < filtros.anioDesde)) return false;
      if (filtros.anioHasta && (!s.anio || s.anio > filtros.anioHasta)) return false;
      if (filtros.equipo && s.equipo !== filtros.equipo) return false;
      if (filtros.sector && s.codigo !== filtros.sector) return false;
      if (filtros.jefeCampo && (!s.jefe_campo || !s.jefe_campo.includes(filtros.jefeCampo))) return false;
      return true;
    });
  }, [sectores, cuarteles, filtros]);

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
      <div style={{ flex: 1 }}>
        <MapContainer center={CENTRO_MAPA} zoom={ZOOM_INICIAL} zoomAnimation={false} style={{ height: "100%", width: "100%" }}>
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
          <DrawHandler mode={dibujarValvula ? "valvula" : dibujarTuberia ? "tuberia" : null} />
          <ToggleVista vista={vista} onChange={cambiarVista} />
          <ToggleEdificaciones visible={mostrarEdif} onToggle={() => setMostrarEdif(!mostrarEdif)} />
          <ToggleUnidades visible={mostrarUnidades} onToggle={() => setMostrarUnidades(!mostrarUnidades)} />
          <ToggleEquiposRiego expanded={showEquiposRiego} onToggle={() => setShowEquiposRiego(v => !v)} />
          {showEquiposRiego && <>
            <ToggleTuberias visible={mostrarTuberias} onToggle={() => setMostrarTuberias(!mostrarTuberias)} />
            <ToggleValvulas visible={mostrarValvulas} onToggle={() => setMostrarValvulas(!mostrarValvulas)} />
            <ToggleAntenas visible={mostrarAntenas} onToggle={() => setMostrarAntenas(!mostrarAntenas)} />
            <ToggleSondas visible={mostrarSondas} onToggle={() => setMostrarSondas(!mostrarSondas)} />
            <DibujarValvula visible={dibujarValvula} onToggle={() => setDibujarValvula(v => !v)} />
            <DibujarTuberia visible={dibujarTuberia} onToggle={() => setDibujarTuberia(v => !v)} />
            <TogglePlanosGeo visible={mostrarPlanosGeo} onToggle={() => setMostrarPlanosGeo(v => !v)} />
            {mostrarPlanosGeo && <OpacityGeo value={opacityGeo} onChange={setOpacityGeo} />}
          </>}
          <ToggleMedir visible={medir} onToggle={() => setMedir(!medir)} />
          <ToggleCuartelLabels visible={showCuartelLabels} onToggle={() => setShowCuartelLabels(v => !v)} />
          {medir && <MedirControls />}

          {vista === "cuarteles" && (
            <GeoJSON
              key={`cuarteles-${filteredCuarteles.length}-${showCuartelLabels}`}
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
                if (c) {
                  registerLayer(fId, layer, baseStyle, 'cuartel');
                  layer.bindPopup(popupCuartelHtml(c), { maxWidth: 300 });
                  layer.bindTooltip(c.nombre, showCuartelLabels
                    ? { direction: "center", permanent: true, className: "cuartel-label", opacity: 0.9 }
                    : { sticky: true, className: "cuartel-label" });
                } else {
                  registerLayer(fId, layer, baseStyle, 'cuartel');
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
            <>
              <GeoJSON
                key={`cuarteles-bg-${filteredCuarteles.length}-${showCuartelLabels}`}
                data={geoJsonCuarteles}
                onEachFeature={(feature: any, layer: any) => {
                  const c = cuarteles.find(x => x.id === feature.properties.cuartel_id);
                  const fId = feature.properties.cuartel_id;
                  layer.setStyle({
                    color: "#999", weight: 0.8, fillOpacity: 0.05, opacity: 0.5,
                    fillColor: "#fff", interactive: false,
                  });
                  if (c) {
                    registerLayer(fId, layer, { color: "#999", weight: 0.8, fillOpacity: 0.05, opacity: 0.5, fillColor: "#fff" }, 'cuartel');
                    layer.bindPopup(popupCuartelHtml(c), { maxWidth: 300 });
                    layer.bindTooltip(c.nombre, showCuartelLabels
                      ? { direction: "center", permanent: true, className: "cuartel-label", opacity: 0.7 }
                      : { sticky: true, className: "cuartel-label", opacity: 0.7 });
                  } else {
                    registerLayer(fId, layer, { color: "#999", weight: 0.8, fillOpacity: 0.05, opacity: 0.5, fillColor: "#fff" }, 'cuartel');
                  }
                }}
              />
              <SectoresLayer
                key={filteredSectores.map(s => s.id).join('-') || 'empty'}
                data={geoJsonSectores}
                sectores={sectores}
                cuarteles={cuarteles}
                equipos={equipos}
                onFitBounds={setFitBounds}
                registerLayer={registerLayer}
                selectedRef={selectedRef}
                setSelected={setSelectedId}
                setHighlighted={setHighlightedId}
                clearLayers={() => layersRef.current.clear()}
              />
            </>
          )}

          {mostrarUnidades && unidades.length > 0 && (
            <GeoJSON key="unidades-riego" data={{
              type: "FeatureCollection" as const,
              features: unidades.filter(u => !!u.geojson).map(u => ({
                ...u.geojson!, properties: { unidad_id: u.id, codigo: u.codigo, especie: u.especie, cuartel: u.cuartel_nombre, sector: u.sector_codigo },
              })),
            } as GeoJSON.FeatureCollection} onEachFeature={(feature: any, layer: any) => {
              layer.setStyle({
                fillColor: "#ffffff",
                color: "#d32f2f", weight: 3, fillOpacity: 0.05, opacity: 1, dashArray: "4,4",
              });
              layer.bringToFront();
              layer.bindTooltip(feature.properties.codigo, { sticky: true, className: "cuartel-tooltip", opacity: 0.9 });
              layer.bindPopup(`<div style="font-size:13px"><strong>${feature.properties.codigo}</strong><br/>Cuartel: ${feature.properties.cuartel}<br/>Sector: ${feature.properties.sector}</div>`, { maxWidth: 250 });
            }} />
          )}

          {mostrarTuberias && tuberias.length > 0 && tuberias.map(t => t.geojson && (
            <GeoJSON key={"tub-" + t.id} data={t.geojson} style={{
              color: t.nivel === "matriz" ? "#1565c0" : t.nivel === "impulsion" ? "#2e7d32" : "#c62828",
              weight: 3, opacity: 0.85,
            }} />
          ))}

          {mostrarValvulas && valvulas.length > 0 && valvulas.map(v => v.geojson && (
            <GeoJSON key={"val-" + v.id} data={v.geojson} pointToLayer={(_f, latlng) =>
              L.circleMarker(latlng, { radius: 5, color: "#e65100", fillColor: "#ff8a65", fillOpacity: 0.9 })
            } />
          ))}

          {mostrarAntenas && antenas.length > 0 && antenas.map(a => a.geojson && (
            <GeoJSON key={"ant-" + a.id} data={a.geojson} pointToLayer={(_f, latlng) =>
              L.circleMarker(latlng, { radius: 6, color: "#1565c0", fillColor: "#42a5f5", fillOpacity: 0.9 })
            } />
          ))}

          {mostrarSondas && sondas.length > 0 && sondas.map(s => s.geojson && (
            <GeoJSON key={"son-" + s.id} data={s.geojson} pointToLayer={(_f, latlng) =>
              L.circleMarker(latlng, { radius: 6, color: "#2e7d32", fillColor: "#66bb6a", fillOpacity: 0.9 })
            } />
          ))}

          {mostrarEdif && edificaciones.length > 0 && (
            <GeoJSON key="edificaciones" data={geoJsonEdif} onEachFeature={(feature: any, layer: any) => {
              layer.setStyle({ fillColor: COLOR_EDIFICACION, color: "#e65100", weight: 2, fillOpacity: 0.6, opacity: 0.9 });
              layer.bindTooltip(feature.properties.nombre, { sticky: true });
            }} />
          )}

          {fitBounds && <FlyToBounds bounds={fitBounds} />}
          <Leyenda />
          {mostrarPlanosGeo && <PlanosGeoLayer geos={geos} equipos={equipos} filtroEquipo={filtros.equipo} opacity={opacityGeo} />}
          {vista === "cuarteles" && <BuscadorCuartel cuarteles={cuarteles} />}
        </MapContainer>
      </div>
    </div>
  );
}

// ====== SECTORES LAYER ======
function SectoresLayer({ data, sectores, cuarteles, equipos, onFitBounds, registerLayer, selectedRef, setSelected, setHighlighted, clearLayers }: {
  data: GeoJSON.FeatureCollection;
  sectores: SectorGeo[];
  cuarteles?: Cuartel[];
  equipos?: Equipo[];
  onFitBounds: (b: L.LatLngBounds | null) => void;
  registerLayer: (id: string, layer: L.Path, baseStyle: L.PathOptions, kind?: 'cuartel' | 'sector') => void;
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
        registerLayer(fId, layer, baseStyle, 'sector');
        if (s) {
          layer.bindTooltip(s.codigo, { sticky: true, className: "cuartel-tooltip", opacity: 0.9 });
          layer.bindPopup(popupSectorHtml(s, cuarteles || [], equipos), { maxWidth: 300 });
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
      supText += (supText ? " (" : "") + areaCalc.toFixed(2) + " Ha Poligono" + (supText ? ")" : "");
    } catch {}
  }
  const supRow = supText ? `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500">Superficie:</td><td style="padding:3px 0">${supText}</td></tr>` : "";

  return `<div style="min-width:200px;font-size:13px"><h3 style="margin:0 0 8px;font-size:15px;font-weight:600">${c.nombre}</h3><table style="width:100%">${r("Especie",c.especie)}${r("Variedad",c.variedad)}${r("Anio plantacion",c.anio_plantacion)}${supRow}${r("Jefe de campo",c.jefe_campo)}${r("Centro costo",c.centro_costo)}${r("Equipo riego",c.equipo_riego)}${r("Sectores",c.sector_raw)}</table></div>`;
}

function popupSectorHtml(s: SectorGeo, _cuarteles: Cuartel[], equipos?: Equipo[]): string {
  const r = (l: string, v: any) => v ? `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500">${l}:</td><td style="padding:3px 0">${v}</td></tr>` : "";

  let haText = "";
  if (s.hectareas) haText = s.hectareas + " ha";
  if ((s as any).geojson?.geometry) {
    try {
      const areaCalc = turf.area((s as any).geojson.geometry as any) / 10000;
      haText += (haText ? " (" : "") + areaCalc.toFixed(2) + " Ha Poligono" + (haText ? ")" : "");
    } catch {}
  }
  const haRow = haText ? `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500">Hectareas:</td><td style="padding:3px 0">${haText}</td></tr>` : "";

  const eq = (equipos || []).find(e => e.nombre === s.equipo);
  const planoLink = eq?.plano_url ? `<tr><td colspan="2" style="padding:6px 0 0"><a href="#" onclick="window.__openPlano('${eq.plano_url}','${s.codigo}');return false" style="color:#1565c0;font-weight:600;text-decoration:none">📋 Ver Plano</a></td></tr>` : "";

  return `<div style="min-width:200px;font-size:13px"><h3 style="margin:0 0 8px;font-size:15px;font-weight:600">${s.codigo}</h3><table style="width:100%">${r("Equipo",s.equipo)}${r("Especie",s.especie)}${haRow}${r("Año de Plantacion",s.anio)}${r("Jefe de campo",s.jefe_campo)}${r("Caudal",s.caudal_nominal?s.caudal_nominal+" m3/h":"")}${r("Bomba",s.bomba)}${r("Filtro",s.filtro)}${planoLink}</table></div>`;
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

function ToggleUnidades({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 120 }}>
      <div className="leaflet-control">
        <button onClick={onToggle} style={{
          padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 500,
          background: visible ? "#2e7d32" : "white", color: visible ? "white" : "#333", border: "1px solid #ccc",
        }}>Unidades</button>
      </div>
    </div>
  );
}

function ToggleEquiposRiego({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 280 }}>
      <div className="leaflet-control">
        <button onClick={onToggle} style={{
          padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600,
          background: "#37474f", color: "white", border: "1px solid #546e7a",
        }}>Equipos de Riego {expanded ? "▲" : "▼"}</button>
      </div>
    </div>
  );
}

function ToggleTuberias({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 318 }}>
      <div className="leaflet-control">
        <button onClick={onToggle} style={{
          padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 500,
          background: visible ? "#1565c0" : "white", color: visible ? "white" : "#333", border: "1px solid #ccc",
        }}>Matrices</button>
      </div>
    </div>
  );
}

function ToggleValvulas({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 318 }}>
      <div className="leaflet-control">
        <button onClick={onToggle} style={{
          padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 500,
          background: visible ? "#e65100" : "white", color: visible ? "white" : "#333", border: "1px solid #ccc",
        }}>Válvulas</button>
      </div>
    </div>
  );
}

function ToggleAntenas({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 352 }}>
      <div className="leaflet-control">
        <button onClick={onToggle} style={{
          padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 500,
          background: visible ? "#1565c0" : "white", color: visible ? "white" : "#333", border: "1px solid #ccc",
        }}>Antenas</button>
      </div>
    </div>
  );
}

function ToggleSondas({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 386 }}>
      <div className="leaflet-control">
        <button onClick={onToggle} style={{
          padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 500,
          background: visible ? "#2e7d32" : "white", color: visible ? "white" : "#333", border: "1px solid #ccc",
        }}>Sondas</button>
      </div>
    </div>
  );
}

function ToggleMedir({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 200 }}>
      <div className="leaflet-control">
        <button onClick={onToggle} style={{
          padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 500,
          background: visible ? "#2e7d32" : "white", color: visible ? "white" : "#333", border: "1px solid #ccc",
        }}>Medir</button>
      </div>
    </div>
  );
}

function ToggleCuartelLabels({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 240 }}>
      <div className="leaflet-control">
        <button onClick={onToggle} style={{
          padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 500,
          background: visible ? "#1565c0" : "white", color: visible ? "white" : "#333", border: "1px solid #ccc",
        }}>Nombres</button>
      </div>
    </div>
  );
}

function MedirControls() {
  const map = useMap();

  useEffect(() => {
    const pm = (map as any).pm;

    // Use CSS to bypass existing feature layers so clicks reach the measure tool
    const container = map.getContainer();
    container.classList.add("medir-active");

    pm.setGlobalOptions({
      snappable: true,
      allowSelfIntersection: false,
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

    // Show area/distance label on created measurement shapes
    map.on("pm:create", (e: any) => {
      const layer = e.layer;
      const geo = layer.toGeoJSON?.() || layer;
      try {
        if (e.shape === "Polygon" || geo?.geometry?.type === "Polygon") {
          const area = turf.area(geo) / 10000;
          layer.bindTooltip(area.toFixed(2) + " ha", { permanent: true, direction: "center", className: "medir-tooltip" });
        } else if (e.shape === "Line" || geo?.geometry?.type === "LineString") {
          let dist = 0;
          const coords = geo?.geometry?.coordinates || layer.getLatLngs?.()?.[0] || [];
          for (let i = 1; i < coords.length; i++) {
            const a = coords[i-1], b = coords[i];
            dist += L.latLng(a[1] || a.lat, a[0] || a.lng).distanceTo(L.latLng(b[1] || b.lat, b[0] || b.lng));
          }
          const label = dist > 1000 ? (dist / 1000).toFixed(2) + " km" : dist.toFixed(1) + " m";
          layer.bindTooltip(label, { permanent: true, direction: "center", className: "medir-tooltip" });
        }
      } catch {}
    });

    return () => {
      container.classList.remove("medir-active");
      try {
        pm.removeControls();
        map.eachLayer((l: any) => {
          if (l._measurementLayer || l._pmTempLayer || l._drawnByGeoman) map.removeLayer(l);
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
    <div className="leaflet-top leaflet-right" style={{ top: 160 }}>
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

function DrawHandler({ mode }: { mode: "valvula" | "tuberia" | null }) {
  const map = useMap();
  useEffect(() => {
    if (!mode) return;
    const handler = async (e: L.LeafletMouseEvent) => {
      if (mode === "valvula") {
        const codigo = prompt("Código de la válvula (ej: V-E3-1):");
        if (!codigo) return;
        const tipo = prompt("Tipo (transicion/purga/aire/compuerta/otro):", "transicion") || "transicion";
        const diam = prompt("Diámetro mm (opcional):", "") || null;
        const { error } = await supabase.from("valvulas").insert({
          codigo, tipo, diametro_mm: diam ? Number(diam) : null,
          geometria: { type: "Point", coordinates: [e.latlng.lng, e.latlng.lat] },
        });
        if (error) alert("Error: " + error.message);
        else window.location.reload();
      }
    };
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [mode, map]);
  return null;
}

function DibujarValvula({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 454 }}>
      <div className="leaflet-control">
        <button onClick={onToggle} style={{
          padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600,
          background: visible ? "#bf360c" : "white", color: visible ? "white" : "#bf360c",
          border: "1px solid #bf360c",
        }}>{visible ? "Click para poner válvula" : "+ Válvula"}</button>
      </div>
    </div>
  );
}

function DibujarTuberia({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 488 }}>
      <div className="leaflet-control">
        <button onClick={onToggle} style={{
          padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600,
          background: visible ? "#1565c0" : "white", color: visible ? "white" : "#1565c0",
          border: "1px solid #1565c0",
        }}>{visible ? "Dibujando tubería..." : "+ Tubería"}</button>
      </div>
    </div>
  );
}

function OpacityGeo({ value, onChange }: { value: number; onChange: (v: number) => void }) { return (<div className="leaflet-top leaflet-right" style={{ top: 556 }}><div className="leaflet-control" style={{ background: "white", padding: "4px 8px", borderRadius: 4, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}><span style={{ fontSize: 11, color: "#666" }}>Op Geo</span><input type="range" min={0.1} max={1} step={0.05} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: 70, accentColor: "#6a1b9a" }} /><span style={{ fontSize: 11, color: "#666", minWidth: 28, textAlign: "center" }}>{Math.round(value * 100)}%</span></div></div>); }

function TogglePlanosGeo({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 522 }}>
      <div className="leaflet-control">
        <button onClick={onToggle} style={{
          padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600,
          background: visible ? "#6a1b9a" : "white", color: visible ? "white" : "#6a1b9a",
          border: "1px solid #6a1b9a",
        }}>{visible ? "Planos ON" : "Planos Geo"}</button>
      </div>
    </div>
  );
}

function PlanosGeoLayer({ geos, equipos, filtroEquipo, opacity: opacityProp }: { geos: any[]; equipos: any[]; filtroEquipo: string; opacity: number }) {
  const map = useMap();
  const containerRef = useRef<any>(null);
  void opacityProp;
  useEffect(() => {
    let container = document.getElementById("planos-geo-container");
    if (!container) { container = document.createElement("div"); container.id = "planos-geo-container"; container.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:600"; map.getContainer().appendChild(container); }
    containerRef.current = container; container.innerHTML = "";
    if (!geos.length) return;
    const eqMap = new Map(equipos.map((e:any) => [e.id, { codigo: e.codigo, plano_url: e.plano_url, nombre: e.nombre }]));
    const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk";
    const upd = () => { container?.querySelectorAll("img[data-ctr]").forEach((img:any) => { const c=JSON.parse(img.getAttribute("data-ctr")); const pt=map.latLngToContainerPoint(L.latLng(c[0],c[1])); img.parentElement.style.left=pt.x+"px"; img.parentElement.style.top=pt.y+"px"; }); };
    map.on("move zoom", upd);
    geos.forEach(async (geo:any) => {
      const eq = eqMap.get(geo.equipo_id); if (!eq?.plano_url) return;
      if (filtroEquipo && eq.nombre !== filtroEquipo) return;
      const b = geo.bounds; if (!b?.center) return;
      try {
        const r = await fetch(eq.plano_url, { headers: { apikey: ANON, Authorization: "Bearer " + ANON } });
        const pdfDoc = await pdfjsLib.getDocument({ data: await r.arrayBuffer() }).promise;
        const page = await pdfDoc.getPage(1); const vp = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas"); canvas.width = vp.width; canvas.height = vp.height;
        await page.render({ canvas, viewport: vp }).promise;
        const ctx = canvas.getContext("2d");
        if (ctx) { const d = ctx.getImageData(0,0,canvas.width,canvas.height).data; for(let i=0;i<d.length;i+=4){if(d[i]>240&&d[i+1]>240&&d[i+2]>240)d[i+3]=0;} ctx.putImageData(new ImageData(d,canvas.width,canvas.height),0,0); }
        const imgUrl = canvas.toDataURL("image/png");
        const w = document.createElement("div");
        const zl = geo.zoom_level||100; const smz = b.map_zoom||15;
        const sf = (zl/100) * Math.pow(2, map.getZoom() - smz);
        w.style.cssText = "position:absolute;transform:translate(-50%,-50%) rotate("+ (geo.rotation||0) +"deg) scale("+ sf +");transform-origin:center center";
        const img = document.createElement("img"); img.src = imgUrl; img.style.cssText = "display:block;max-width:none;opacity:"+(geo.opacity||0.6);
        img.setAttribute("data-ctr", JSON.stringify(b.center)); w.appendChild(img); container?.appendChild(w);
        const pt = map.latLngToContainerPoint(L.latLng(b.center[0], b.center[1]));
        w.style.left = pt.x + "px"; w.style.top = pt.y + "px";
      } catch {}
    });
    return () => { map.off("move zoom", upd); if(container)container.innerHTML=""; };
  }, [geos, equipos, filtroEquipo, map]);
  return null;
}

const toggleBtn: React.CSSProperties = {
  padding: "6px 14px", border: "1px solid #ccc", cursor: "pointer", fontSize: 12, fontWeight: 500,
};
