import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Cuartel, Edificacion, SectorGeo, UnidadRiego, Equipo, Tuberia, Valvula, Antena, Sonda } from "../lib/types";
import MapaCuarteles from "../components/map/MapaCuarteles";
import VisorPDF from "../components/ui/VisorPDF";

export default function MapaPage() {
  const [cuarteles, setCuarteles] = useState<Cuartel[]>([]);
  const [sectores, setSectores] = useState<SectorGeo[]>([]);
  const [edificaciones, setEdificaciones] = useState<Edificacion[]>([]);
  const [unidades, setUnidades] = useState<UnidadRiego[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [tuberias, setTuberias] = useState<Tuberia[]>([]);
  const [valvulas, setValvulas] = useState<Valvula[]>([]);
  const [antenas, setAntenas] = useState<Antena[]>([]);
  const [sondas, setSondas] = useState<Sonda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visorPdf, setVisorPdf] = useState<{ url: string; nombre: string } | null>(null);

  // Global handler for plano links in popups
  useEffect(() => {
    (window as any).__openPlano = (url: string, nombre: string) => setVisorPdf({ url, nombre });
    return () => { delete (window as any).__openPlano; };
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [cuartelesRes, edificacionesRes, sectoresRes, unidadesRes, equiposRes, tuberiasRes, valvulasRes, antenasRes, sondasRes] = await Promise.all([
          supabase.rpc("get_cuarteles_con_sectores"),
          supabase.rpc("get_edificaciones_geojson"),
          supabase.rpc("get_sectores_geojson"),
          supabase.rpc("get_unidades_riego_geojson"),
          supabase.from("equipos").select("*").order("codigo"),
          supabase.from("tuberias").select("*"),
          supabase.from("valvulas").select("*"),
          supabase.from("antenas").select("*"),
          supabase.from("sondas").select("*"),
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
        setEquipos(equiposRes.data || []);
        setTuberias((tuberiasRes.data || []).map((r: any) => ({ ...r, geojson: r.geometria ? { type: "Feature", geometry: r.geometria, properties: {} } : undefined })));
        setValvulas((valvulasRes.data || []).map((r: any) => ({ ...r, geojson: r.geometria ? { type: "Feature", geometry: r.geometria, properties: {} } : undefined })));
        setAntenas((antenasRes.data || []).map((r: any) => ({ ...r, geojson: r.geometria ? { type: "Feature", geometry: r.geometria, properties: {} } : undefined })));
        setSondas((sondasRes.data || []).map((r: any) => ({ ...r, geojson: r.geometria ? { type: "Feature", geometry: r.geometria, properties: {} } : undefined })));
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

  return (
    <>
      <MapaCuarteles cuarteles={cuarteles} edificaciones={edificaciones} sectores={sectores} unidades={unidades} equipos={equipos} tuberias={tuberias} valvulas={valvulas} antenas={antenas} sondas={sondas} />
      {visorPdf && <VisorPDF url={visorPdf.url} nombre={visorPdf.nombre} onClose={() => setVisorPdf(null)} />}
    </>
  );
}

const centerStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", height: "100vh", fontFamily: "sans-serif",
};
