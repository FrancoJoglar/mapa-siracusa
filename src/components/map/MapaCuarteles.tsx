import { useState, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Cuartel, Edificacion, FiltrosCuartel } from "../../lib/types";
import {
  COLOR_EDIFICACION,
  COLOR_FILTRADO_OUT,
  colorPorEspecie,
  COLOR_POR_ESPECIE,
} from "../../lib/colors";
import BarraFiltros from "./BarraFiltros";
import BuscadorCuartel from "./BuscadorCuartel";
import { exportarCuarteles, exportarCuartelesGeoJSON } from "../../lib/export";

const CENTRO_MAPA: [number, number] = [-35.14, -71.625];
const ZOOM_INICIAL = 14;

function popupHtml(c: Cuartel): string {
  const row = (label: string, value: string | number | null | undefined) =>
    value ? `<tr><td style="color:#666;padding:3px 6px 3px 0;white-space:nowrap;font-weight:500">${label}:</td><td style="padding:3px 0">${value}</td></tr>` : "";

  return `
    <div style="min-width:200px;font-size:13px">
      <h3 style="margin:0 0 8px;font-size:15px;font-weight:600">${c.nombre}</h3>
      <table style="width:100%;border-collapse:collapse">
        ${row("Especie", c.especie)}
        ${row("Variedad", c.variedad)}
        ${row("Año plantación", c.anio_plantacion)}
        ${row("Superficie", c.superficie_ha ? c.superficie_ha + " ha" : "")}
        ${row("Plantas", c.plantas)}
        ${row("Polinizante", c.polinizante)}
        ${row("Jefe de campo", c.jefe_campo)}
        ${row("Centro de costo", c.centro_costo)}
        ${row("Equipo riego", c.equipo_riego)}
        ${row("Sectores", c.sector_raw)}
      </table>
    </div>`;
}

function Leyenda() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 30,
        right: 10,
        zIndex: 1000,
        background: "white",
        padding: "8px 12px",
        borderRadius: 6,
        boxShadow: "0 1px 5px rgba(0,0,0,0.2)",
        fontSize: 12,
      }}
    >
      <strong style={{ display: "block", marginBottom: 4 }}>Especies</strong>
      {COLOR_POR_ESPECIE.map((c) => (
        <div
          key={c.especie}
          style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              backgroundColor: c.color,
              borderRadius: 2,
              flexShrink: 0,
            }}
          />
          {c.especie}
        </div>
      ))}
    </div>
  );
}

interface Props {
  cuarteles: Cuartel[];
  edificaciones: Edificacion[];
}

export default function MapaCuarteles({ cuarteles, edificaciones }: Props) {
  const [filtros, setFiltros] = useState<FiltrosCuartel>({
    especie: "",
    variedad: "",
    anioDesde: null,
    anioHasta: null,
    equipo: "",
    sector: "",
    jefeCampo: "",
  });

  const [mostrarEdificaciones, setMostrarEdificaciones] = useState(true);

  const uniqueValues = useMemo(() => {
    const especiesSet = new Set<string>();
    const variedadesSet = new Set<string>();
    const equiposSet = new Set<string>();
    const sectoresSet = new Set<string>();
    const jefesSet = new Set<string>();

    cuarteles.forEach((c) => {
      if (c.especie) especiesSet.add(c.especie);
      if (c.variedad) variedadesSet.add(c.variedad);
      if (c.equipo_riego) equiposSet.add(c.equipo_riego);
      if (c.sector_raw) sectoresSet.add(c.sector_raw);
      if (c.jefe_campo) jefesSet.add(c.jefe_campo);
    });

    return {
      especies: Array.from(especiesSet).sort(),
      variedades: Array.from(variedadesSet).sort(),
      equipos: Array.from(equiposSet).sort(),
      sectores: Array.from(sectoresSet).sort(),
      jefes: Array.from(jefesSet).sort(),
    };
  }, [cuarteles]);

  const filteredCuarteles = useMemo(() => {
    return cuarteles.filter((c) => {
      if (filtros.especie && c.especie !== filtros.especie) return false;
      if (filtros.variedad && c.variedad !== filtros.variedad) return false;
      if (filtros.anioDesde && (!c.anio_plantacion || c.anio_plantacion < filtros.anioDesde)) return false;
      if (filtros.anioHasta && (!c.anio_plantacion || c.anio_plantacion > filtros.anioHasta)) return false;
      if (filtros.equipo && c.equipo_riego !== filtros.equipo) return false;
      if (filtros.sector && c.sector_raw !== filtros.sector) return false;
      if (filtros.jefeCampo && c.jefe_campo !== filtros.jefeCampo) return false;
      return true;
    });
  }, [cuarteles, filtros]);

  const filteredIds = useMemo(
    () => new Set(filteredCuarteles.map((c) => c.id)),
    [filteredCuarteles]
  );

  const superficieFiltrada = useMemo(
    () =>
      filteredCuarteles.reduce((sum, c) => sum + (c.superficie_ha || 0), 0),
    [filteredCuarteles]
  );

  const onFeatureEach = (feature: any, layer: any) => {
    const cuartel = cuarteles.find((c) => c.id === feature.properties.cuartel_id);
    const match = filteredIds.has(feature.properties.cuartel_id);
    const color = match
      ? colorPorEspecie(cuartel?.especie || "")
      : COLOR_FILTRADO_OUT;
    const opacity = match ? 0.7 : 0.25;

    layer.setStyle({
      fillColor: color,
      color: "#333",
      weight: 1,
      fillOpacity: opacity,
      opacity: 0.6,
    });

    layer.bindTooltip(cuartel?.nombre || "", {
      direction: "center",
      className: "cuartel-tooltip",
      opacity: 0.9,
    });

    if (cuartel) {
      const html = popupHtml(cuartel);
      layer.bindPopup(html, { maxWidth: 300 });
    }
  };

  const geoJsonCuarteles = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: cuarteles
        .filter((c) => !!c.geojson)
        .map((c) => ({
          ...c.geojson!,
          properties: { cuartel_id: c.id },
        })),
    };
  }, [cuarteles]);

  const geoJsonEdificaciones = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: edificaciones
        .filter((e) => !!e.geojson)
        .map((e) => ({
          ...e.geojson!,
          properties: { nombre: e.nombre },
        })),
    };
  }, [edificaciones]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <BarraFiltros
        filtros={filtros}
        onChange={setFiltros}
        cuartelesFiltrados={filteredCuarteles.length}
        totalCuarteles={cuarteles.length}
        totalSuperficie={superficieFiltrada}
        onExportExcel={() => exportarCuarteles(filteredCuarteles, "siracusa_cuarteles")}
        onExportGeoJSON={() => exportarCuartelesGeoJSON(filteredCuarteles, "siracusa_cuarteles")}
        {...uniqueValues}
      />
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer
          center={CENTRO_MAPA}
          zoom={ZOOM_INICIAL}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <ControlSatelite />

          <GeoJSON
            key={`cuarteles-${filteredIds.size}`}
            data={geoJsonCuarteles}
            onEachFeature={onFeatureEach}
          />

          {mostrarEdificaciones && edificaciones.length > 0 && (
            <GeoJSON
              key="edificaciones"
              data={geoJsonEdificaciones}
              onEachFeature={(feature: any, layer: any) => {
                layer.setStyle({
                  fillColor: COLOR_EDIFICACION,
                  color: "#e65100",
                  weight: 2,
                  fillOpacity: 0.6,
                  opacity: 0.9,
                });
                layer.bindTooltip(feature.properties.nombre, {
                  direction: "center",
                });
              }}
            />
          )}

          <Leyenda />
          <BuscadorCuartel cuarteles={cuarteles} />
          <ToggleEdificaciones
            visible={mostrarEdificaciones}
            onToggle={() => setMostrarEdificaciones(!mostrarEdificaciones)}
          />
        </MapContainer>
      </div>
    </div>
  );
}

function ControlSatelite() {
  const map = useMap();
  const [satelite, setSatelite] = useState(false);

  const toggle = () => {
    if (satelite) {
      map.eachLayer((layer: any) => {
        if (layer._url && layer._url.includes("tile.openstreetmap.org")) {
          layer.setUrl("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
          if (layer.setOpacity) layer.setOpacity(1);
        }
      });
    } else {
      map.eachLayer((layer: any) => {
        if (layer._url && layer._url.includes("tile.openstreetmap.org")) {
          layer.setUrl(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          );
          if (layer.setOpacity) layer.setOpacity(1);
        }
      });
    }
    setSatelite(!satelite);
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ top: 80 }}>
      <div className="leaflet-control">
        <button
          onClick={toggle}
          style={{
            padding: "6px 12px",
            background: satelite ? "#1565c0" : "white",
            color: satelite ? "white" : "#333",
            border: "1px solid #ccc",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {satelite ? "Satélite ✓" : "Satélite"}
        </button>
      </div>
    </div>
  );
}

function ToggleEdificaciones({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="leaflet-top leaflet-right" style={{ top: 120 }}>
      <div className="leaflet-control">
        <button
          onClick={onToggle}
          style={{
            padding: "6px 12px",
            background: visible ? "#ef6c00" : "white",
            color: visible ? "white" : "#333",
            border: "1px solid #ccc",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Edificaciones
        </button>
      </div>
    </div>
  );
}
