import { useState, useCallback } from "react";
import { Cuartel, SectorGeo } from "../lib/types";
import { colorPorEspecie } from "../lib/colors";
import L from "leaflet";

export function useExportMapImage(
  filteredCuarteles: Cuartel[],
  filteredSectores: SectorGeo[],
  vista: "cuarteles" | "sectores"
) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const features = vista === "cuarteles"
        ? filteredCuarteles.filter(c => c.geojson).map(c => c.geojson!)
        : filteredSectores.filter(s => s.geojson).map(s => s.geojson!);

      if (features.length === 0) { alert("No hay datos para exportar"); setExporting(false); return; }

      // Calculate bounds
      let allCoords: [number, number][] = [];
      features.forEach(f => {
        const geom = f.geometry;
        if (geom.type === "Polygon") geom.coordinates[0].forEach(c => allCoords.push([c[1], c[0]]));
        else if (geom.type === "MultiPolygon") geom.coordinates.forEach(poly => poly[0].forEach(c => allCoords.push([c[1], c[0]])));
      });

      if (allCoords.length === 0) { alert("No se pudieron calcular los limites"); setExporting(false); return; }

      const lats = allCoords.map(c => c[0]);
      const lngs = allCoords.map(c => c[1]);
      const bounds = L.latLngBounds([Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]);

      // Image dimensions - smaller for speed
      const MAX = 4000, MIN = 2500;
      const spanLat = Math.max(bounds.getNorth() - bounds.getSouth(), 1e-4);
      const meanLat = (bounds.getNorth() + bounds.getSouth()) / 2;
      const spanLng = Math.max((bounds.getEast() - bounds.getWest()) * Math.cos(meanLat * Math.PI / 180), 1e-4);
      const ratio = spanLng / spanLat;
      let imgW: number, imgH: number;
      if (ratio >= 1) { imgW = MAX; imgH = Math.round(Math.max(MIN, MAX / ratio)); }
      else { imgH = MAX; imgW = Math.round(Math.max(MIN, MAX * ratio)); }

      // Create offscreen container (positioned off-screen to avoid affecting main map)
      const container = document.createElement("div");
      container.style.cssText = `position:fixed;left:-99999px;top:-99999px;width:${imgW}px;height:${imgH}px;z-index:99999;overflow:hidden;background:#000;`;
      document.body.appendChild(container);

      const mapDiv = document.createElement("div");
      mapDiv.style.cssText = `width:${imgW}px;height:${imgH}px;`;
      container.appendChild(mapDiv);

      const map = L.map(mapDiv, {
        zoomControl: false, attributionControl: false, preferCanvas: true,
        fadeAnimation: false, zoomAnimation: false, inertia: false,
      });

      const tile = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19, crossOrigin: "anonymous",
      }).addTo(map);

      map.fitBounds(bounds, { padding: [40, 40], animate: false });

      // Wait for tiles to load (max 8s)
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        tile.once("load", finish);
        setTimeout(finish, 8000);
      });
      // Extra settle time for rendering
      await new Promise(r => setTimeout(r, 300));

      // Add polygons
      const geoJsonData = vista === "cuarteles"
        ? { type: "FeatureCollection" as const, features: filteredCuarteles.filter(c => c.geojson).map(c => ({ ...c.geojson!, properties: { nombre: c.nombre, especie: c.especie } })) }
        : { type: "FeatureCollection" as const, features: filteredSectores.filter(s => s.geojson).map(s => ({ ...s.geojson!, properties: { codigo: s.codigo, especie: s.especie } })) };

      L.geoJSON(geoJsonData, {
        style: (feature) => {
          const color = colorPorEspecie(feature?.properties?.especie || "");
          return { color, weight: 2, fillColor: color, fillOpacity: 0.7, opacity: 0.6 };
        },
        onEachFeature: (feature, layer) => {
          const name = vista === "cuarteles" ? feature.properties?.nombre : feature.properties?.codigo;
          if (name) layer.bindTooltip(name, { permanent: true, direction: "center", className: "cuartel-label", opacity: 1 });
        },
      }).addTo(map);

      // Scale bar
      L.control.scale({ imperial: false, metric: true, maxWidth: 300, position: "bottomleft" }).addTo(map);

      // Overlays (title, legend, north arrow)
      const titulo = vista === "cuarteles" ? "Cuarteles" : "Sectores de riego";
      const fecha = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });

      const legendItems = vista === "cuarteles"
        ? [...new Set(filteredCuarteles.map(c => c.especie).filter(Boolean))].map(e => {
          const c = colorPorEspecie(e!);
          return `<div style="display:flex;align-items:center;gap:10px;margin:4px 0"><span style="width:24px;height:24px;border-radius:4px;background:${c};border:2px solid rgba(255,255,255,.7)"></span><span>${e}</span></div>`;
        }).join("")
        : "";

      const overlay = document.createElement("div");
      overlay.style.cssText = "position:absolute;inset:0;z-index:1000;pointer-events:none;font-family:'Segoe UI',system-ui,sans-serif";
      overlay.innerHTML = `
        <div style="position:absolute;top:24px;left:24px;background:rgba(15,23,42,.85);color:#fff;padding:16px 24px;border-radius:12px">
          <div style="font-size:32px;font-weight:700;line-height:1.1">Siracusa 2025 — ${titulo}</div>
          <div style="font-size:18px;opacity:.85;margin-top:4px">${fecha}</div>
        </div>
        ${legendItems ? `
        <div style="position:absolute;top:24px;right:24px;background:rgba(15,23,42,.85);color:#fff;padding:16px 20px;border-radius:12px;font-size:18px;min-width:160px">
          <div style="font-size:16px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.7;margin-bottom:6px">Especies</div>
          ${legendItems}
        </div>` : ''}
        <div style="position:absolute;bottom:28px;right:28px;color:#fff;text-align:center;text-shadow:0 1px 4px rgba(0,0,0,.8)">
          <div style="font-size:36px;line-height:1">↑</div><div style="font-size:20px;font-weight:700">N</div>
        </div>`;
      container.appendChild(overlay);

      // Wait for overlay + polygons to render
      await new Promise(r => setTimeout(r, 400));

      // Fix Leaflet's CSS transform before capture
      const mapPane = mapDiv.querySelector(".leaflet-map-pane") as HTMLElement | null;
      let savedTransform = "", savedLeft = "", savedTop = "";
      if (mapPane) {
        savedTransform = mapPane.style.transform;
        savedLeft = mapPane.style.left;
        savedTop = mapPane.style.top;
        const match = savedTransform.match(/translate3d\(([^,]+),\s*([^,]+)/);
        if (match) {
          mapPane.style.transform = "none";
          mapPane.style.left = match[1];
          mapPane.style.top = match[2];
        }
      }

      // Capture
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(container, {
        useCORS: true, width: imgW, height: imgH, scale: 1, backgroundColor: "#000",
        logging: false,
      });

      // Restore transform
      if (mapPane) {
        mapPane.style.transform = savedTransform;
        mapPane.style.left = savedLeft;
        mapPane.style.top = savedTop;
      }

      // Download
      const link = document.createElement("a");
      link.download = "mapa_siracusa_" + vista + "_" + new Date().toISOString().slice(0, 10) + ".png";
      link.href = canvas.toDataURL("image/png");
      link.click();

      // Cleanup
      map.remove();
      container.remove();
    } catch (e) {
      console.error("Error exporting:", e);
      alert("Error al exportar: " + (e as Error).message);
    } finally {
      setExporting(false);
    }
  }, [filteredCuarteles, filteredSectores, vista]);

  return { handleExport, exporting };
}
