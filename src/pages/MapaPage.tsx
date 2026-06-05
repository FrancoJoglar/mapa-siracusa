import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Cuartel, Edificacion, SectorGeo, UnidadRiego } from "../lib/types";
import MapaCuarteles from "../components/map/MapaCuarteles";

export default function MapaPage() {
  const [cuarteles, setCuarteles] = useState<Cuartel[]>([]);
  const [sectores, setSectores] = useState<SectorGeo[]>([]);
  const [edificaciones, setEdificaciones] = useState<Edificacion[]>([]);
  const [unidades, setUnidades] = useState<UnidadRiego[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [cuartelesRes, edificacionesRes, sectoresRes, unidadesRes] = await Promise.all([
          supabase.rpc("get_cuarteles_con_sectores"),
          supabase.rpc("get_edificaciones_geojson"),
          supabase.rpc("get_sectores_geojson"),
          supabase.rpc("get_unidades_riego_geojson"),
        ]);

        if (cuartelesRes.error) throw cuartelesRes.error;
        if (edificacionesRes.error) throw edificacionesRes.error;
        if (sectoresRes.error) throw sectoresRes.error;
        if (unidadesRes.error) throw unidadesRes.error;

        const parsedCuarteles: Cuartel[] = (cuartelesRes.data || []).map(
          (r: any) => ({
            ...r,
            sector_ids: Array.isArray(r.sector_ids)
              ? r.sector_ids
              : r.sector_ids ? [r.sector_ids] : [],
            geojson: r.geojson
              ? { type: "Feature", geometry: r.geojson, properties: {} }
              : undefined,
          })
        );

        const parsedEdificaciones: Edificacion[] = (edificacionesRes.data || []).map(
          (r: any) => ({
            ...r,
            geojson: r.geojson
              ? { type: "Feature", geometry: r.geojson, properties: {} }
              : undefined,
          })
        );

        const parsedSectores: SectorGeo[] = (sectoresRes.data || []).map(
          (r: any) => ({
            ...r,
            geojson: r.geojson
              ? { type: "Feature", geometry: r.geojson, properties: {} }
              : undefined,
          })
        );

        const parsedUnidades: UnidadRiego[] = (unidadesRes.data || []).map(
          (r: any) => ({
            ...r,
            geojson: r.geojson
              ? { type: "Feature", geometry: r.geojson, properties: {} }
              : undefined,
          })
        );

        setCuarteles(parsedCuarteles);
        setEdificaciones(parsedEdificaciones);
        setSectores(parsedSectores);
        setUnidades(parsedUnidades);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  if (loading) {
    return <div style={centerStyle}><p>Cargando mapa...</p></div>;
  }

  if (error) {
    return (
      <div style={centerStyle}>
        <h2>Error al cargar los datos</h2>
        <p>{error}</p>
        <p style={{ marginTop: 10, color: "#666" }}>
          Verifica que las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
          esten configuradas en el archivo .env
        </p>
      </div>
    );
  }

  return <MapaCuarteles cuarteles={cuarteles} edificaciones={edificaciones} sectores={sectores} unidades={unidades} />;
}

const centerStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", height: "100vh", fontFamily: "sans-serif",
};
