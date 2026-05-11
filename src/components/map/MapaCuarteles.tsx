import { useState, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Cuartel, Edificacion, SectorGeo, FiltrosCuartel } from "../../lib/types";
import {
  COLOR_EDIFICACION, COLOR_FILTRADO_OUT,
  colorPorEspecie, COLOR_POR_ESPECIE,
} from "../../lib/colors";
import BarraFiltros from "./BarraFiltros";
import BuscadorCuartel from "./BuscadorCuartel";
import { exportarCuarteles, exportarCuartelesGeoJSON } from "../../lib/export";

const CENTRO_MAPA: [number, number] = [-35.14, -71.625];
const ZOOM_INICIAL = 14;

type Vista = "cuarteles" | "sectores";

interface Props {
  cuarteles: Cuartel[];
  edificaciones: Edificacion[];
  sectores: SectorGeo[];
}

export default function MapaCuarteles({ cuarteles, edificaciones, sectores }: Props) {
  const [filtros, setFiltros] = useState<FiltrosCuartel>({
    especie: "", variedad: "", anioDesde: null, anioHasta: null,
    equipo: "", sector: "", jefeCampo: "",
  });
  const [vista, setVista] = useState<Vista>("cuarteles");
  const [mostrarEdif, setMostrarEdif] = useState(true);

  const cambiarVista = (v: Vista) => {
    setVista(v);
    setFiltros({
      especie: "", variedad: "", anioDesde: null, anioHasta: null,
      equipo: "", sector: "", jefeCampo: "",
    });
  };

  // ====== CUARTELES FILTERS ======
  const uniqueCuarteles = useMemo(() => {
    const esp = new Set<string>();
    const varSet = new Set<string>();
    const eq = new Set<string>();
    const sec = new Set<string>();
    const jc = new Set<string>();
    cuarteles.forEach(c => {
      if (c.especie) esp.add(c.especie);
      if (c.variedad) varSet.add(c.variedad);
      if (c.equipo_riego) eq.add(c.equipo_riego);
      if (c.sector_raw) sec.add(c.sector_raw);
      if (c.jefe_campo) jc.add(c.jefe_campo);
    });
    return {
      especies: Array.from(esp).sort(),
      variedades: Array.from(varSet).sort(),
      equipos: Array.from(eq).sort(),
      sectores: Array.from(sec).sort(),
      jefes: Array.from(jc).sort(),
    };
  }, [cuarteles]);

  const uniqueSectores = useMemo(() => {
    const esp = new Set<string>();
    const varSet = new Set<string>();
    const eq = new Set<string>();
    const jc = new Set<string>();
    sectores.forEach(s => {
      if (s.especie) esp.add(s.especie);
      if (s.variedad) varSet.add(s.variedad);
      if (s.equipo) eq.add(s.equipo);
      if (s.jefe_campo) jc.add(s.jefe_campo);
    });
    return {
      especies: Array.from(esp).sort(),
      variedades: Array.from(varSet).sort(),
      equipos: Array.from(eq).sort(),
      sectores: sectores.map(s => s.codigo).sort(),
      jefes: Array.from(jc).sort(),
    };
  }, [sectores]);

  const { uniqueValues, filteredCuarteles, superficieFiltrada } = useMemo(() => {
    if (vista === "cuarteles") {
      const filtered = cuarteles.filter(c => {
        if (filtros.especie && c.especie !== filtros.especie) return false;
        if (filtros.variedad && c.variedad !== filtros.variedad) return false;
        if (filtros.anioDesde && (!c.anio_plantacion || c.anio_plantacion < filtros.anioDesde)) return false;
        if (filtros.anioHasta && (!c.anio_plantacion || c.anio_plantacion > filtros.anioHasta)) return false;
        if (filtros.equipo && c.equipo_riego !== filtros.equipo) return false;
        if (filtros.sector && c.sector_raw !== filtros.sector) return false;
        if (filtros.jefeCampo && c.jefe_campo !== filtros.jefeCampo) return false;
        return true;
      });
      return {
        uniqueValues: uniqueCuarteles,
        filteredCuarteles: filtered,
        superficieFiltrada: filtered.reduce((s, c) => s + (c.superficie_ha || 0), 0),
      };
    } else {
      const filtered = sectores.filter(s => {
        if (filtros.especie && s.especie !== filtros.especie) return false;
        if (filtros.variedad && s.variedad !== filtros.variedad) return false;
        if (filtros.anioDesde && (!s.anio || s.anio < filtros.anioDesde)) return false;
        if (filtros.anioHasta && (!s.anio || s.anio > filtros.anioHasta)) return false;
        if (filtros.equipo && s.equipo !== filtros.equipo) return false;
        if (filtros.sector && s.codigo !== filtros.sector) return false;
        if (filtros.jefeCampo && s.jefe_campo !== filtros.jefeCampo) return false;
        return true;
      });
      return {
        uniqueValues: uniqueSectores,
        filteredCuarteles: filtered as any,
        superficieFiltrada: filtered.reduce((sum, s) => sum + (s.hectareas || 0), 0),
      };
    }
  }, [cuarteles, sectores, filtros, vista, uniqueCuarteles, uniqueSectores]);

  const filteredIds = useMemo(
    () => new Set(filteredCuarteles.map((c: any) => c.id)),
    [filteredCuarteles]
  );

  // ====== GEOJSON DATA ======
  const geoJsonCuarteles = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: cuarteles.filter(c => !!c.geojson).map(c => ({
      ...c.geojson!, properties: { cuartel_id: c.id },
    })),
  }), [cuarteles]);

  const geoJsonSectores = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: sectores.filter(s => !!s.geojson).map(s => ({
      ...s.geojson!, properties: { sector_id: s.id },
    })),
  }), [sectores]);

  const geoJsonEdif = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: edificaciones.filter(e => !!e.geojson).map(e => ({
      ...e.geojson!, properties: { nombre: e.nombre },
    })),
  }), [edificaciones]);

  // ====== CALLBACKS ======
  const onCuartelEachFeature = (feature: any, layer: any) => {
    const c = cuarteles.find(x => x.id === feature.properties.cuartel_id);
    const match = filteredIds.has(feature.properties.cuartel_id);
    layer.setStyle({
      fillColor: match ? colorPorEspecie(c?.especie || "") : COLOR_FILTRADO_OUT,
      color: "#333", weight: 1,
      fillOpacity: match ? 0.7 : 0.25, opacity: 0.6,
    });
    layer.bindTooltip(c?.nombre || "", { direction: "center", className: "cuartel-tooltip", opacity: 0.9 });
    if (c) layer.bindPopup(popupCuartelHtml(c), { maxWidth: 300 });
  };

  const onSectorEachFeature = (feature: any, layer: any) => {
    const s = sectores.find(x => x.id === feature.properties.sector_id);
    const match = vista === "sectores" ? filteredIds.has(feature.properties.sector_id) : true;
    layer.setStyle({
      fillColor: match ? colorPorEspecie(s?.especie || "") : COLOR_FILTRADO_OUT,
      color: "#333", weight: 2,
      fillOpacity: match ? 0.5 : 0.2, opacity: 0.7,
    });
    if (s) {
      layer.bindTooltip(s.codigo, { direction: "center", className: "cuartel-tooltip", opacity: 0.9 });
      layer.bindPopup(popupSectorHtml(s), { maxWidth: 300 });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <BarraFiltros
        filtros={filtros}
        onChange={setFiltros}
        cuartelesFiltrados={filteredCuarteles.length}
        totalCuarteles={vista === "cuarteles" ? cuarteles.length : sectores.length}
        totalSuperficie={superficieFiltrada}
        onExportExcel={() =>
          vista === "cuarteles"
            ? exportarCuarteles(filteredCuarteles, "siracusa_cuarteles")
            : exportarCuarteles(filteredCuarteles as any, "siracusa_sectores")
        }
        onExportGeoJSON={() =>
          vista === "cuarteles"
            ? exportarCuartelesGeoJSON(filteredCuarteles, "siracusa_cuarteles")
            : exportarCuartelesGeoJSON(filteredCuarteles as any, "siracusa_sectores")
        }
        {...uniqueValues}
      />
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer center={CENTRO_MAPA} zoom={ZOOM_INICIAL} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ControlSatelite />
          <ToggleVista vista={vista} onChange={cambiarVista} />
          <ToggleEdificaciones visible={mostrarEdif} onToggle={() => setMostrarEdif(!mostrarEdif)} />

          {vista === "cuarteles" && (
            <GeoJSON key={`cuarteles-${filteredIds.size}`} data={geoJsonCuarteles} onEachFeature={onCuartelEachFeature} />
          )}

          {vista === "sectores" && (
            <GeoJSON key={`sectores-${filteredIds.size}`} data={geoJsonSectores} onEachFeature={onSectorEachFeature} />
          )}

          {mostrarEdif && edificaciones.length > 0 && (
            <GeoJSON key="edificaciones" data={geoJsonEdif} onEachFeature={(feature: any, layer: any) => {
              layer.setStyle({ fillColor: COLOR_EDIFICACION, color: "#e65100", weight: 2, fillOpacity: 0.6, opacity: 0.9 });
              layer.bindTooltip(feature.properties.nombre, { direction: "center" });
            }} />
          )}

          <Leyenda vista={vista} />
          {vista === "cuarteles" && <BuscadorCuartel cuarteles={cuarteles} />}
        </MapContainer>
      </div>
    </div>
  );
}

// ====== POPUP HTML ======
function popupCuartelHtml(c: Cuartel): string {
  const r = (l: string, v: any) => v ? `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500">${l}:</td><td style="padding:3px 0">${v}</td></tr>` : "";
  return `<div style="min-width:200px;font-size:13px"><h3 style="margin:0 0 8px;font-size:15px;font-weight:600">${c.nombre}</h3><table style="width:100%">${r("Especie",c.especie)}${r("Variedad",c.variedad)}${r("Anio plantacion",c.anio_plantacion)}${r("Superficie",c.superficie_ha?c.superficie_ha+" ha":"")}${r("Plantas",c.plantas)}${r("Jefe de campo",c.jefe_campo)}${r("Centro costo",c.centro_costo)}${r("Equipo riego",c.equipo_riego)}${r("Sectores",c.sector_raw)}</table></div>`;
}

function popupSectorHtml(s: SectorGeo): string {
  const r = (l: string, v: any) => v ? `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500">${l}:</td><td style="padding:3px 0">${v}</td></tr>` : "";
  return `<div style="min-width:200px;font-size:13px"><h3 style="margin:0 0 8px;font-size:15px;font-weight:600">${s.codigo}</h3><table style="width:100%">${r("Equipo",s.equipo)}${r("Especie",s.especie)}${r("Variedad",s.variedad)}${r("Hectareas",s.hectareas?s.hectareas+" ha":"")}${r("Anio",s.anio)}${r("Jefe de campo",s.jefe_campo)}${r("Caudal nominal",s.caudal_nominal?s.caudal_nominal+" m3/h":"")}${r("Bomba",s.bomba)}${r("Filtro",s.filtro)}</table></div>`;
}

// ====== CONTROLS ======
function ToggleVista({ vista, onChange }: { vista: Vista; onChange: (v: Vista) => void }) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 10 }}>
      <div className="leaflet-control" style={{ display: "flex", gap: 0 }}>
        <button onClick={() => onChange("cuarteles")} style={{
          ...toggleBtnBase, borderRadius: "4px 0 0 4px",
          background: vista === "cuarteles" ? "#1565c0" : "white",
          color: vista === "cuarteles" ? "white" : "#333",
        }}>Cuarteles</button>
        <button onClick={() => onChange("sectores")} style={{
          ...toggleBtnBase, borderRadius: "0 4px 4px 0",
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
          background: visible ? "#ef6c00" : "white",
          color: visible ? "white" : "#333", border: "1px solid #ccc",
        }}>Edificaciones</button>
      </div>
    </div>
  );
}

function ControlSatelite() {
  const map = useMap();
  const [sat, setSat] = useState(false);
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 120 }}>
      <div className="leaflet-control">
        <button onClick={() => {
          map.eachLayer((layer: any) => {
            if (layer._url?.includes("tile.openstreetmap.org")) {
              layer.setUrl(sat
                ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}");
            }
          });
          setSat(!sat);
        }} style={{
          padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 500,
          background: sat ? "#1565c0" : "white", color: sat ? "white" : "#333", border: "1px solid #ccc",
        }}>{sat ? "Satelite" : "Satelite"}</button>
      </div>
    </div>
  );
}

function Leyenda({ vista }: { vista: Vista }) {
  return (
    <div style={{
      position: "absolute", bottom: 30, right: 10, zIndex: 1000,
      background: "white", padding: "8px 12px", borderRadius: 6,
      boxShadow: "0 1px 5px rgba(0,0,0,0.2)", fontSize: 12,
    }}>
      <strong style={{ display: "block", marginBottom: 4 }}>
        {vista === "cuarteles" ? "Especies" : "Especies"}
      </strong>
      {COLOR_POR_ESPECIE.map(c => (
        <div key={c.especie} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ width: 14, height: 14, backgroundColor: c.color, borderRadius: 2, flexShrink: 0 }} />
          {c.especie}
        </div>
      ))}
    </div>
  );
}

const toggleBtnBase: React.CSSProperties = {
  padding: "6px 14px", border: "1px solid #ccc", cursor: "pointer", fontSize: 12, fontWeight: 500,
};
