import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Cuartel, Edificacion, SectorGeo, FiltrosCuartel, UnidadRiego, Equipo, Tuberia, Valvula, Antena, Sonda } from "../../lib/types";
import {
  COLOR_EDIFICACION, colorPorEspecie,
} from "../../lib/colors";
import BarraFiltros from "./BarraFiltros";
import FiltrosAvanzados, { FiltrosAvanzadosState } from "./FiltrosAvanzados";
import MapControls from "./MapControls";
import GpsButton from "./GpsButton";
import BuscadorCuartel from "./BuscadorCuartel";
import { exportarCuarteles, exportarCuartelesGeoJSON } from "../../lib/export";
import L from "leaflet";
import * as turf from "@turf/turf";
import { supabase } from "../../lib/supabase";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useExportMapImage } from "../../hooks/useExportMapImage";

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
}

const FILTROS_VACIOS: FiltrosCuartel = {
  especie: "", variedad: "", anioDesde: null, anioHasta: null,
  equipo: "", sector: "", jefeCampo: "",
};

type LayerEntry = { layer: L.Path; baseStyle: L.PathOptions; kind: 'cuartel' | 'sector' | 'unidad' };
type LayersMap = Map<string, LayerEntry>;

export default function MapaCuarteles({ cuarteles, edificaciones, sectores, unidades, equipos = [], tuberias = [], valvulas = [], antenas = [], sondas = [] }: Props) {
  // Filtrar equipos inactivos
  const equiposInactivos = useMemo(() => new Set(equipos.filter(e => e.activo === false).map(e => e.id)), [equipos]);

  const [filtros, setFiltros] = useState<FiltrosCuartel>(FILTROS_VACIOS);
  const [vista, setVista] = useState<Vista>("sectores");
  const [mostrarEdif, setMostrarEdif] = useState(true);
  const [mostrarUnidades, setMostrarUnidades] = useState(false);
  const [equiposActivo, setEquiposActivo] = useState(true);
  const [equiposExpandido, setEquiposExpandido] = useState(false);
  const [mostrarValvulas, setMostrarValvulas] = useState(true);
  const [mostrarSubmatrices, setMostrarSubmatrices] = useState(true);
  const [mostrarMatrices, setMostrarMatrices] = useState(true);
  const [mostrarImpulsiones, setMostrarImpulsiones] = useState(true);
  const [mostrarAntenas, setMostrarAntenas] = useState(true);
  const [mostrarSondas, setMostrarSondas] = useState(true);
  const [fitBounds, setFitBounds] = useState<L.LatLngBounds | null>(null);
  const [satelite, setSatelite] = useState(true);
  const [medir, setMedir] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showCuartelLabels, setShowCuartelLabels] = useState(false);
  const filtroPuntosEquipo = "todos"; // se muestran los puntos de todos los equipos (selector removido)
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Pre-load bombas and filtros for popups
  const [bombasMap, setBombasMap] = useState<Map<string, any[]>>(new Map());
  const [filtrosMap, setFiltrosMap] = useState<Map<string, any[]>>(new Map());

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load sector_bombas + bombas
        const sbRes = await supabase.from("sector_bombas").select("sector_id, bomba_id");
        const bRes = await supabase.from("bombas").select("id, marca, modelo, potencia_hp, funcion");
        if (sbRes.data && bRes.data) {
          const bLookup = new Map<string, any>();
          bRes.data.forEach((b: any) => bLookup.set(b.id, b));
          const newMap = new Map<string, any[]>();
          sbRes.data.forEach((sb: any) => {
            const bomba = bLookup.get(sb.bomba_id);
            if (bomba) {
              const arr = newMap.get(sb.sector_id) || [];
              arr.push(bomba);
              newMap.set(sb.sector_id, arr);
            }
          });
          setBombasMap(newMap);
        }

        // Load sector_filtros + filtros
        const sfRes = await supabase.from("sector_filtros").select("sector_id, filtro_id");
        const fRes = await supabase.from("filtros").select("id, tipo, marca, modelo");
        if (sfRes.data && fRes.data) {
          const fLookup = new Map<string, any>();
          fRes.data.forEach((f: any) => fLookup.set(f.id, f));
          const newFMap = new Map<string, any[]>();
          sfRes.data.forEach((sf: any) => {
            const filtro = fLookup.get(sf.filtro_id);
            if (filtro) {
              const arr = newFMap.get(sf.sector_id) || [];
              arr.push(filtro);
              newFMap.set(sf.sector_id, arr);
            }
          });
          setFiltrosMap(newFMap);
        }
      } catch (e) {
        console.error("Error loading bombas/filtros for popups:", e);
      }
    };
    loadData();
  }, []);
  const [advancedFilters, setAdvancedFilters] = useState<FiltrosAvanzadosState>({ modo: "sectores", sectoresSeleccionados: [], cuartelesSeleccionados: [] });

  // GPS
  const { position: gpsPosition, heading: gpsHeading, watching: gpsWatching, startWatching, stopWatching } = useGeolocation();
  const [headingOffset, setHeadingOffset] = useState(() => {
    const saved = localStorage.getItem("gps_heading_offset");
    return saved ? Number(saved) : 0;
  });
  const handleHeadingOffsetChange = (v: number) => {
    setHeadingOffset(v);
    localStorage.setItem("gps_heading_offset", String(v));
  };
  const handleGpsToggle = () => {
    if (gpsWatching) { stopWatching(); }
    else { startWatching(); }
  };

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
    const sectorColors = ["#c62828", "#1565c0", "#2e7d32", "#f9a825", "#6a1b9a", "#795548", "#757575", "#b71c1c"];

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
      } else if (showCuartelLabels && kind === 'sector') {
        // Apply sector border color when labels are active (keep fill color)
        const s = sectores.find(sec => sec.id === id);
        if (s) {
          const sectorColor = sectorColors[s.numero - 1] || "#333";
          layer.setStyle({ ...baseStyle, color: sectorColor });
        } else {
          layer.setStyle(baseStyle);
        }
      } else {
        layer.setStyle(baseStyle);
      }
    });
  }, [selectedId, highlightedId, sectores, cuarteles, showCuartelLabels]);

  useEffect(() => { pintarCapas(); }, [pintarCapas]);

  const cambiarVista = (v: Vista) => {
    setVista(v);
    setFiltros(FILTROS_VACIOS);
    setFitBounds(null);
    setSelectedId(null);
    setHighlightedId(null);
  };

  // ====== HELPERS ======
  const numSort = (a: string, b: string) => {
    const na = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(b.replace(/\D/g, ''), 10) || 0;
    return na - nb;
  };

  // ====== UNIQUE VALUES ======
  // Helper: map sector_id → team number
  const sectorIdToEquipo = useMemo(() => {
    const map = new Map<string, string>();
    sectores.forEach(s => {
      const num = s.equipo?.replace(/\D/g, "") || "";
      if (num) map.set(s.id, num);
    });
    return map;
  }, [sectores]);

  const uniqueCuarteles = useMemo(() => {
    const e = new Set<string>(); const v = new Set<string>();
    const eq = new Set<string>(); const s = new Set<string>();
    const j = new Set<string>();
    cuarteles.forEach(c => {
      if (c.especie) e.add(c.especie);
      if (c.variedad) v.add(c.variedad);
      // Extract team numbers from sector_ids
      c.sector_ids?.forEach(sid => {
        const num = sectorIdToEquipo.get(sid);
        if (num) eq.add(num);
      });
      // Extract sector numbers from sector_ids
      c.sector_ids?.forEach(sid => {
        const sector = sectores.find(s => s.id === sid);
        if (sector?.numero != null) s.add(String(sector.numero));
      });
      if (c.jefe_campo) j.add(c.jefe_campo);
    });
    return {
      especies: Array.from(e).sort(), variedades: Array.from(v).sort(),
      equipos: Array.from(eq).sort((a, b) => Number(a) - Number(b)),
      sectores: Array.from(s).sort((a, b) => Number(a) - Number(b)),
      jefes: Array.from(j).sort(),
    };
  }, [cuarteles, sectorIdToEquipo, sectores]);

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
      const tieneEquipo = c.sector_ids?.some(sid => sectorIdToEquipo.get(sid) === filtros.equipo);
      if (tieneEquipo) {
        c.sector_ids?.forEach(sid => {
          const sector = sectores.find(s => s.id === sid);
          if (sector?.numero != null) nums.add(sector.numero);
        });
      }
    });
    return Array.from(nums).sort((a, b) => a - b).map(String);
  }, [vista, filtros.equipo, sectores, cuarteles, uniqueSectores.sectores, uniqueCuarteles.sectores, sectorIdToEquipo]);

  // ====== FILTERING ======
  // Map sector equipo name to team active status
  const sectorActivo = useMemo(() => {
    const map = new Map<string, boolean>();
    sectores.forEach(s => {
      const eq = equipos.find(e => e.nombre === s.equipo);
      map.set(s.id, eq ? (eq.activo ?? true) : true);
    });
    return map;
  }, [sectores, equipos]);

  const filteredCuarteles = useMemo(() => {
    return cuarteles.filter(c => {
      if (filtros.especie && c.especie !== filtros.especie) return false;
      if (filtros.variedad && c.variedad !== filtros.variedad) return false;
      if (filtros.anioDesde && (!c.anio_plantacion || c.anio_plantacion < filtros.anioDesde)) return false;
      if (filtros.anioHasta && (!c.anio_plantacion || c.anio_plantacion > filtros.anioHasta)) return false;
      if (filtros.equipo) {
        const tieneEquipo = c.sector_ids?.some(sid => sectorIdToEquipo.get(sid) === filtros.equipo);
        if (!tieneEquipo) return false;
      }
      if (filtros.sector) {
        const sectorNums = c.sector_ids?.map(sid => {
          const sec = sectores.find(s => s.id === sid);
          return sec?.numero != null ? String(sec.numero) : null;
        }).filter(Boolean) || [];
        if (!sectorNums.includes(filtros.sector)) return false;
      }
      if (filtros.jefeCampo && c.jefe_campo !== filtros.jefeCampo) return false;
      // Excluir cuarteles cuyos sectores son todos de equipos inactivos
      if (c.sector_ids && c.sector_ids.length > 0) {
        const tieneSectorActivo = c.sector_ids.some(sid => sectorActivo.get(sid) !== false);
        if (!tieneSectorActivo) return false;
      }
      // Advanced filters
      if (advancedFilters.modo === "sectores" && advancedFilters.sectoresSeleccionados.length > 0) {
        if (!c.sector_ids?.some(sid => advancedFilters.sectoresSeleccionados.includes(sid))) return false;
      }
      if (advancedFilters.modo === "cuarteles" && advancedFilters.cuartelesSeleccionados.length > 0) {
        if (!advancedFilters.cuartelesSeleccionados.includes(c.id)) return false;
      }
      return true;
    });
  }, [cuarteles, filtros, advancedFilters, sectorActivo]);

  const filteredSectores = useMemo(() => {
    return sectores.filter(s => {
      if (filtros.especie && s.especie !== filtros.especie) return false;
      if (filtros.variedad && !cuarteles.some(c => c.sector_ids?.includes(s.id) && c.variedad === filtros.variedad)) return false;
      if (filtros.anioDesde && (!s.anio || s.anio < filtros.anioDesde)) return false;
      if (filtros.anioHasta && (!s.anio || s.anio > filtros.anioHasta)) return false;
      if (filtros.equipo && s.equipo !== filtros.equipo) return false;
      if (filtros.sector && s.codigo !== filtros.sector) return false;
      if (filtros.jefeCampo && (!s.jefe_campo || !s.jefe_campo.includes(filtros.jefeCampo))) return false;
      // Excluir sectores de equipos inactivos
      if (sectorActivo.get(s.id) === false) return false;
      // Advanced: filter by selected sectors or cuarteles
      if (advancedFilters.modo === "sectores" && advancedFilters.sectoresSeleccionados.length > 0) {
        if (!advancedFilters.sectoresSeleccionados.includes(s.id)) return false;
      }
      if (advancedFilters.modo === "cuarteles" && advancedFilters.cuartelesSeleccionados.length > 0) {
        // In cuartel mode, only show sectors that irrigate at least one selected cuartel
        const sectorHasSelectedCuartel = cuarteles.some(c => advancedFilters.cuartelesSeleccionados.includes(c.id) && c.sector_ids?.includes(s.id));
        if (!sectorHasSelectedCuartel) return false;
      }
      return true;
    });
  }, [sectores, cuarteles, filtros, advancedFilters]);

  const handleFiltroChange = (f: FiltrosCuartel) => {
    if (f.equipo !== filtros.equipo) { setFiltros({ ...f, sector: "" }); }
    else { setFiltros(f); }
  };

  const numFiltrados = vista === "cuarteles" ? filteredCuarteles.length : filteredSectores.length;
  const total = vista === "cuarteles" ? cuarteles.length : sectores.length;
  const superficieFiltrada = vista === "cuarteles"
    ? filteredCuarteles.reduce((s, c) => s + (c.superficie_ha || 0), 0)
    : filteredSectores.reduce((s, sec) => s + (sec.hectareas || 0), 0);

  // Export map image
  const { handleExport: handleExportImage } = useExportMapImage(filteredCuarteles, filteredSectores, vista);

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
            ? exportarCuarteles(filteredCuarteles, "siracusa_cuarteles", sectores)
            : exportarCuarteles(filteredSectores as any, "siracusa_sectores", sectores)
        }
        onExportGeoJSON={() =>
          vista === "cuarteles"
            ? exportarCuartelesGeoJSON(filteredCuarteles, "siracusa_cuarteles", sectores)
            : exportarCuartelesGeoJSON(filteredSectores as any, "siracusa_sectores", sectores)
        }
        {...(vista === "cuarteles"
          ? { ...uniqueCuarteles, sectores: sectoresFiltradosPorEquipo, equipos: uniqueCuarteles.equipos.filter(eq => !equiposInactivos.has(equipos.find(e => String(e.codigo) === eq)?.id || "")) }
          : { ...uniqueSectores, sectores: sectoresFiltradosPorEquipo, equipos: uniqueSectores.equipos.filter(eq => !equiposInactivos.has(equipos.find(e => String(e.codigo) === eq)?.id || "")) })}
        vista={vista}
        onOpenAdvanced={() => setShowAdvanced(true)}
        advancedActive={advancedFilters.modo === "sectores" ? advancedFilters.sectoresSeleccionados.length > 0 : advancedFilters.cuartelesSeleccionados.length > 0}
        onExportImage={handleExportImage}
      />
      <FiltrosAvanzados
        open={showAdvanced}
        onClose={() => setShowAdvanced(false)}
        onApply={(state) => { setAdvancedFilters(state); setShowAdvanced(false); }}
        initialState={advancedFilters}
        sectores={sectores}
        cuarteles={cuarteles}
        unidades={unidades}
        equipos={equipos}
      />
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer center={CENTRO_MAPA} zoom={ZOOM_INICIAL} zoomAnimation={false} style={{ height: "100%", width: "100%" }}>
          <ValvulasPane />
          <TileLayer
            key={satelite ? "sat" : "osm"}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url={satelite
              ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            }
          />
          <MapClickHandler onDeselect={() => setSelectedId(null)} />
          {gpsPosition && <GpsMarker position={gpsPosition} heading={gpsHeading} headingOffset={headingOffset} />}
          <GpsButton onWatchStart={startWatching} onWatchStop={stopWatching} watching={gpsWatching} />
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
                  layer.bindPopup(popupCuartelHtml(c, unidades), { maxWidth: 300 });
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
                    layer.bindPopup(popupCuartelHtml(c, unidades), { maxWidth: 300 });
                    layer.bindTooltip(c.nombre, { sticky: true, className: "cuartel-label", opacity: 0.7 });
                  } else {
                    registerLayer(fId, layer, { color: "#999", weight: 0.8, fillOpacity: 0.05, opacity: 0.5, fillColor: "#fff" }, 'cuartel');
                  }
                }}
              />
              <SectoresLayer
                key={filteredSectores.map(s => s.id).join('-') + '-' + bombasMap.size + '-' + filtrosMap.size + '-' + showCuartelLabels || 'empty'}
                data={geoJsonSectores}
                sectores={sectores}
                cuarteles={cuarteles}
                equipos={equipos}
                unidades={unidades}
                bombasMap={bombasMap}
                filtrosMap={filtrosMap}
                showLabels={showCuartelLabels}
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

          {mostrarEdif && edificaciones.length > 0 && (
            <GeoJSON key="edificaciones" data={geoJsonEdif} onEachFeature={(feature: any, layer: any) => {
              layer.setStyle({ fillColor: COLOR_EDIFICACION, color: "#e65100", weight: 2, fillOpacity: 0.6, opacity: 0.9 });
              layer.bindTooltip(feature.properties.nombre, { sticky: true });
            }} />
          )}

          {vista === "sectores" && fitBounds && <FlyToBounds bounds={fitBounds} />}

          {/* EQUIPOS DE RIEGO: controlado por master toggle */}
          {equiposActivo && mostrarValvulas && valvulas.filter(v => filtroPuntosEquipo === "todos" || v.equipo_id === filtroPuntosEquipo).length > 0 && valvulas.filter(v => filtroPuntosEquipo === "todos" || v.equipo_id === filtroPuntosEquipo).map(v => v.geojson && (
            <GeoJSON key={"val-" + v.id} data={v.geojson} pointToLayer={(_f, latlng) => {
              const fillCol = v.color || "#ef5350";
              const c = L.circleMarker(latlng, { radius: 5, color: fillCol, fillColor: fillCol, fillOpacity: 0.9, pane: "valvulas" });
              return c;
            }} />
          ))}
          {equiposActivo && mostrarSubmatrices && tuberias.filter(t => t.nivel === "submatriz").length > 0 && tuberias.filter(t => t.nivel === "submatriz").map(t => t.geojson && (
            <GeoJSON key={"tub-sub-" + t.id} data={t.geojson} style={{
              color: "#e65100", weight: 3, opacity: 0.85,
            }} />
          ))}
          {equiposActivo && mostrarMatrices && tuberias.filter(t => t.nivel === "matriz").length > 0 && tuberias.filter(t => t.nivel === "matriz").map(t => t.geojson && (
            <GeoJSON key={"tub-mat-" + t.id} data={t.geojson} style={{
              color: "#1565c0", weight: 3, opacity: 0.85,
            }} />
          ))}
          {equiposActivo && mostrarImpulsiones && tuberias.filter(t => t.nivel === "impulsion").length > 0 && tuberias.filter(t => t.nivel === "impulsion").map(t => t.geojson && (
            <GeoJSON key={"tub-imp-" + t.id} data={t.geojson} style={{
              color: "#2e7d32", weight: 3, opacity: 0.85,
            }} />
          ))}

          {/* ANTENAS Y SONDAS: independientes */}
          {mostrarAntenas && antenas.filter(a => filtroPuntosEquipo === "todos" || a.equipo_id === filtroPuntosEquipo).length > 0 && antenas.filter(a => filtroPuntosEquipo === "todos" || a.equipo_id === filtroPuntosEquipo).map(a => a.geojson && (
            <GeoJSON key={"ant-" + a.id} data={a.geojson} pointToLayer={(_f, latlng) =>
              L.circleMarker(latlng, { radius: 6, color: a.color || "#1565c0", fillColor: "#42a5f5", fillOpacity: 0.9 })
            } />
          ))}
          {mostrarSondas && sondas.filter(s => filtroPuntosEquipo === "todos" || s.equipo_id === filtroPuntosEquipo).length > 0 && sondas.filter(s => filtroPuntosEquipo === "todos" || s.equipo_id === filtroPuntosEquipo).map(s => s.geojson && (
            <GeoJSON key={"son-" + s.id} data={s.geojson} pointToLayer={(_f, latlng) =>
              L.circleMarker(latlng, { radius: 6, color: s.color || "#2e7d32", fillColor: "#66bb6a", fillOpacity: 0.9 })
            } />
          ))}
          {vista === "cuarteles" && <BuscadorCuartel cuarteles={cuarteles} />}
        </MapContainer>
        {/* Controls outside MapContainer to avoid re-render interference */}
        <MapControls
          vista={vista}
          onVistaChange={cambiarVista}
          mostrarEdif={mostrarEdif}
          onToggleEdif={() => setMostrarEdif(!mostrarEdif)}
          mostrarUnidades={mostrarUnidades}
          onToggleUnidades={() => setMostrarUnidades(!mostrarUnidades)}
          satelite={satelite}
          onToggleSatelite={() => setSatelite(!satelite)}
          medir={medir}
          onToggleMedir={() => setMedir(!medir)}
          showCuartelLabels={showCuartelLabels}
          onToggleLabels={() => setShowCuartelLabels(v => !v)}
          equiposActivo={equiposActivo}
          onToggleEquipos={() => setEquiposActivo(!equiposActivo)}
          equiposExpandido={equiposExpandido}
          onToggleExpandido={() => setEquiposExpandido(!equiposExpandido)}
          mostrarValvulas={mostrarValvulas}
          onToggleValvulas={() => setMostrarValvulas(!mostrarValvulas)}
          mostrarSubmatrices={mostrarSubmatrices}
          onToggleSubmatrices={() => setMostrarSubmatrices(!mostrarSubmatrices)}
          mostrarMatrices={mostrarMatrices}
          onToggleMatrices={() => setMostrarMatrices(!mostrarMatrices)}
          mostrarImpulsiones={mostrarImpulsiones}
          onToggleImpulsiones={() => setMostrarImpulsiones(!mostrarImpulsiones)}
          mostrarAntenas={mostrarAntenas}
          onToggleAntenas={() => setMostrarAntenas(!mostrarAntenas)}
          mostrarSondas={mostrarSondas}
          onToggleSondas={() => setMostrarSondas(!mostrarSondas)}
          gpsPosition={gpsPosition}
          onGpsToggle={handleGpsToggle}
          gpsWatching={gpsWatching}
          headingOffset={headingOffset}
          onHeadingOffsetChange={handleHeadingOffsetChange}
        />
      </div>
    </div>
  );
}

// ====== POPUP FUNCTIONS (outside component for SectoresLayer access) ======
function popupCuartelHtml(c: Cuartel, unidadesArr: any[]): string {
  const r = (l: string, v: any) => v ? `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500">${l}:</td><td style="padding:3px 0">${v}</td></tr>` : "";
  let supText = "";
  if (c.superficie_ha) supText = c.superficie_ha + " ha";
  if (c.geojson?.geometry) {
    try { const areaCalc = turf.area(c.geojson.geometry as any) / 10000; supText += (supText ? " (" : "") + areaCalc.toFixed(2) + " Ha Poligono" + (supText ? ")" : ""); } catch {}
  }
  const supRow = supText ? `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500">Superficie:</td><td style="padding:3px 0">${supText}</td></tr>` : "";
  const sectoresRiego = unidadesArr.filter((u: any) => u.cuartel_id === c.id && u.porcentaje_agua != null).sort((a: any, b: any) => b.porcentaje_agua - a.porcentaje_agua);
  let sectoresRow = "";
  if (sectoresRiego.length > 0) {
    const chips = sectoresRiego.map((u: any) => {
      const pct = u.porcentaje_agua;
      const bg = pct >= 80 ? "#e8f5e9" : pct >= 40 ? "#fff3e0" : "#fce4ec";
      const border = pct >= 80 ? "#a5d6a7" : pct >= 40 ? "#ffcc80" : "#f48fb1";
      return `<span style="background:${bg};border:1px solid ${border};border-radius:6px;padding:2px 6px;font-size:11px;white-space:nowrap">${u.sector_codigo} (${pct}%)</span>`;
    }).join(" ");
    sectoresRow = `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500;vertical-align:top">Riego:</td><td style="padding:3px 0"><div style="display:flex;flex-wrap:wrap;gap:4px">${chips}</div></td></tr>`;
  }
  return `<div style="min-width:220px;font-size:13px"><h3 style="margin:0 0 8px;font-size:15px;font-weight:600">${c.nombre}</h3><table style="width:100%">${r("Especie",c.especie)}${r("Variedad",c.variedad)}${r("Anio plantacion",c.anio_plantacion)}${supRow}${r("Jefe de campo",c.jefe_campo)}${r("Centro costo",c.centro_costo)}${sectoresRow}</table></div>`;
}

function popupSectorHtml(s: SectorGeo, _cuarteles: Cuartel[], equiposArr?: Equipo[], unidadesArr?: any[], bombasSector?: any[], filtrosSector?: any[]): string {
  const sectorColors = ["#c62828", "#1565c0", "#2e7d32", "#f9a825", "#6a1b9a", "#795548", "#757575", "#b71c1c"];
  const sectorColor = sectorColors[s.numero - 1] || "#333";
  const r = (l: string, v: any) => v ? `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500">${l}:</td><td style="padding:3px 0">${v}</td></tr>` : "";
  let haText = "";
  if (s.hectareas) haText = s.hectareas + " ha";
  if ((s as any).geojson?.geometry) {
    try { const areaCalc = turf.area((s as any).geojson.geometry as any) / 10000; haText += (haText ? " (" : "") + areaCalc.toFixed(2) + " Ha Poligono" + (haText ? ")" : ""); } catch {}
  }
  const haRow = haText ? `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500">Hectareas:</td><td style="padding:3px 0">${haText}</td></tr>` : "";
  const eq = (equiposArr || []).find(e => e.nombre === s.equipo);
  const planoLink = eq?.plano_url ? `<tr><td colspan="2" style="padding:6px 0 0"><a href="#" onclick="window.__openPlano('${eq.plano_url}','${s.codigo}');return false" style="color:#1565c0;font-weight:600;text-decoration:none">📋 Ver Plano</a></td></tr>` : "";
  let cuartelesRow = "";
  if (unidadesArr && unidadesArr.length > 0) {
    const csDelSector = unidadesArr.filter((u: any) => u.sector_id === s.id && u.porcentaje_agua != null).sort((a: any, b: any) => b.porcentaje_agua - a.porcentaje_agua);
    if (csDelSector.length > 0) {
      const chips = csDelSector.map((u: any) => {
        const pct = u.porcentaje_agua;
        const bg = pct >= 80 ? "#e8f5e9" : pct >= 40 ? "#fff3e0" : "#fce4ec";
        const border = pct >= 80 ? "#a5d6a7" : pct >= 40 ? "#ffcc80" : "#f48fb1";
        return `<span style="background:${bg};border:1px solid ${border};border-radius:6px;padding:3px 8px;font-size:12px;white-space:nowrap">${u.cuartel_nombre} (${pct}%)</span>`;
      }).join(" ");
      cuartelesRow = `<tr><td colspan="2" style="padding:8px 0 0"><div style="font-size:12px;color:#666;font-weight:500;margin-bottom:4px">Cuarteles que riega:</div><div style="display:flex;flex-wrap:wrap;gap:5px">${chips}</div></td></tr>`;
    }
  }
  let bombasRow = "";
  if (bombasSector && bombasSector.length > 0) {
    const bombasList = bombasSector.map((b: any) => {
      const desc = [b.marca, b.modelo].filter(Boolean).join(" ");
      const hp = b.potencia_hp ? ` ${b.potencia_hp}HP` : "";
      const func = b.funcion === "helada" ? " ❄" : "";
      return `${desc}${hp}${func}`;
    }).join(", ");
    bombasRow = `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500">Bombas:</td><td style="padding:3px 0;font-size:12px">${bombasList}</td></tr>`;
  }
  let filtrosRow = "";
  if (filtrosSector && filtrosSector.length > 0) {
    const filtrosList = filtrosSector.map((f: any) => [f.marca, f.modelo].filter(Boolean).join(" ") + (f.tipo ? ` (${f.tipo})` : "")).join(", ");
    filtrosRow = `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500">Filtros:</td><td style="padding:3px 0;font-size:12px">${filtrosList}</td></tr>`;
  }
  return `<div style="min-width:220px;font-size:13px"><div style="background:${sectorColor};color:#fff;padding:6px 10px;border-radius:6px 6px 0 0;margin:-1px -1px 0 -1px"><h3 style="margin:0;font-size:15px;font-weight:600">${s.codigo}</h3></div><div style="padding:6px 0"><table style="width:100%">${r("Equipo",s.equipo)}${r("Especie",s.especie)}${haRow}${r("Año de Plantacion",s.anio)}${r("Jefe de campo",s.jefe_campo)}${r("Caudal",s.caudal_nominal?s.caudal_nominal+" m3/h":"")}${bombasRow}${filtrosRow}${cuartelesRow}${planoLink}</table></div></div>`;
}

function SectoresLayer({ data, sectores, cuarteles, equipos, unidades, bombasMap, filtrosMap, showLabels, onFitBounds, registerLayer, selectedRef, setSelected, setHighlighted, clearLayers }: {
  data: GeoJSON.FeatureCollection;
  sectores: SectorGeo[];
  cuarteles?: Cuartel[];
  equipos?: Equipo[];
  unidades?: any[];
  bombasMap: Map<string, any[]>;
  filtrosMap: Map<string, any[]>;
  showLabels: boolean;
  onFitBounds: (b: L.LatLngBounds | null) => void;
  registerLayer: (id: string, layer: L.Path, baseStyle: L.PathOptions, kind?: 'cuartel' | 'sector') => void;
  selectedRef: React.MutableRefObject<string | null>;
  setSelected: (id: string | null) => void;
  setHighlighted: (id: string | null) => void;
  clearLayers: () => void;
}) {
  const map = useMap();
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
          color: "#333", weight: 3, fillOpacity: 0.5, opacity: 0.8,
        };
        layer.setStyle(baseStyle);
        registerLayer(fId, layer, baseStyle, 'sector');
        if (s) {
          const sectorColor = ["#c62828", "#1565c0", "#2e7d32", "#f9a825", "#6a1b9a", "#795548", "#757575", "#b71c1c"][s.numero - 1] || "#333";
          const zoom = map?.getZoom() || 15;
          const codeSize = zoom >= 16 ? 16 : zoom >= 14 ? 14 : 12;
          const tooltipHtml = `<div style="background:rgba(15,23,42,0.88);color:#fff;padding:5px 10px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.35);white-space:nowrap;backdrop-filter:blur(4px)"><div style="font-size:${codeSize}px;font-weight:700;color:${sectorColor}">${s.codigo}</div></div>`;

          layer.bindTooltip(tooltipHtml, {
            permanent: showLabels,
            direction: "center",
            className: "",
            opacity: showLabels ? 1 : 0.92,
          });
          if (showLabels) {
            layer.setStyle({ ...layer.options, color: sectorColor });
          }
          layer.bindPopup(popupSectorHtml(s, cuarteles || [], equipos, unidades, bombasMap.has(s.id) ? bombasMap.get(s.id) : undefined, filtrosMap.has(s.id) ? filtrosMap.get(s.id) : undefined), { maxWidth: 300 });
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

// ====== CONTROLS (now in MapControls.tsx) ======

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
  const map = useMap();
  useEffect(() => { map.on("click", onDeselect); return () => { map.off("click", onDeselect); }; }, [map, onDeselect]);
  return null;
}


function GpsMarker({ position, heading, headingOffset }: { position: { lat: number; lng: number }; heading: number | null; headingOffset: number }) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyRef = useRef<L.Circle | null>(null);
  const firstFix = useRef(true);

  useEffect(() => {
    if (!markerRef.current) {
      // Create marker with a custom arrow icon
      const icon = L.divIcon({
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        html: `<div style="
          width:32px;height:32px;display:flex;align-items:center;justify-content:center;
          filter:drop-shadow(0 1px 3px rgba(0,0,0,0.5));
        ">
          <svg viewBox="0 0 24 24" width="32" height="32" id="gps-arrow">
            <path d="M12 2 L4 20 L12 16 L20 20 Z" fill="#1565c0" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </div>`,
      });
      markerRef.current = L.marker([position.lat, position.lng], { icon, zIndexOffset: 1000 }).addTo(map);
      accuracyRef.current = L.circle([position.lat, position.lng], {
        radius: 50, color: "#1565c0", fillColor: "#42a5f5", fillOpacity: 0.1, weight: 1,
      }).addTo(map);
    }

    markerRef.current.setLatLng([position.lat, position.lng]);
    if (accuracyRef.current) accuracyRef.current.setLatLng([position.lat, position.lng]);

    // Rotate arrow based on heading + offset
    if (heading != null) {
      const el = markerRef.current.getElement();
      if (el) {
        const svg = el.querySelector("#gps-arrow") as HTMLElement | null;
        if (svg) svg.style.transform = `rotate(${heading + headingOffset}deg)`;
      }
    }

    if (firstFix.current) {
      map.flyTo([position.lat, position.lng], 16);
      firstFix.current = false;
    }
  }, [position.lat, position.lng, heading, headingOffset, map]);

  useEffect(() => {
    return () => {
      if (markerRef.current) { map.removeLayer(markerRef.current); markerRef.current = null; }
      if (accuracyRef.current) { map.removeLayer(accuracyRef.current); accuracyRef.current = null; }
    };
  }, [map]);

  return null;
}

function ValvulasPane() {
  const map = useMap();
  useEffect(() => {
    const pane = map.createPane("valvulas");
    pane.style.zIndex = "650";
    return () => { map.getPane("valvulas")?.remove(); };
  }, [map]);
  return null;
}
