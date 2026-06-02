import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useEquipos } from "../useEquipos";
import { useSectores } from "../useSectores";
import { useCuarteles } from "../useCuarteles";
import { supabase } from "../../lib/supabase";

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

function resolve(data: any = [], error: any = null) {
  return Promise.resolve({ data, error });
}

function mockChain() {
  const chain: Record<string, any> = {};
  const r = (data = [], error = null) => resolve(data, error);

  chain.eqAfterUpdate = vi.fn(() => r());
  chain.eqAfterDelete = vi.fn(() => r());
  chain.orderAfterSelect = vi.fn(() => r());
  chain.singleOnSelect = vi.fn(() => r());
  chain.inOnSelect = vi.fn(() => r());

  chain.eqOnSelect = vi.fn(() => ({ single: chain.singleOnSelect, in: chain.inOnSelect }));
  chain.insert = vi.fn(() => r());
  chain.update = vi.fn(() => ({ eq: chain.eqAfterUpdate }));
  chain.delete = vi.fn(() => ({ eq: chain.eqAfterDelete }));
  chain.select = vi.fn(() => ({
    order: chain.orderAfterSelect,
    eq: chain.eqOnSelect,
    in: chain.inOnSelect,
    single: chain.singleOnSelect,
  }));

  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────── useEquipos ───────────────

describe("useEquipos", () => {
  it("createEquipo inserta en equipos y refresca la lista", async () => {
    const chain = mockChain();
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { result } = renderHook(() => useEquipos());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const input = { codigo: 9999, nombre: "TEST Equipo", descripcion: "Creado por test" };
    await result.current.createEquipo(input);

    expect(chain.insert).toHaveBeenCalledWith(input);
    expect(chain.select).toHaveBeenCalledWith("*");
    expect(chain.orderAfterSelect).toHaveBeenCalledWith("codigo");
  });

  it("updateEquipo envia update con id y los campos modificados", async () => {
    const chain = mockChain();
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { result } = renderHook(() => useEquipos());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.updateEquipo("equipo-1", { nombre: "Editado", descripcion: "Nueva desc" });

    expect(chain.update).toHaveBeenCalledWith({ nombre: "Editado", descripcion: "Nueva desc" });
    expect(chain.eqAfterUpdate).toHaveBeenCalledWith("id", "equipo-1");
  });

  it("deleteEquipo envia delete con id", async () => {
    const chain = mockChain();
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { result } = renderHook(() => useEquipos());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.deleteEquipo("equipo-1");

    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eqAfterDelete).toHaveBeenCalledWith("id", "equipo-1");
  });

  it("crear equipo con codigo duplicado lanza error", async () => {
    const chain = mockChain();
    chain.insert = vi.fn(() =>
      resolve(null, new Error("duplicate key value violates unique constraint"))
    );
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { result } = renderHook(() => useEquipos());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      result.current.createEquipo({ codigo: 9999, nombre: "Otro", descripcion: "" })
    ).rejects.toThrow("duplicate key value violates unique constraint");
  });
});

// ─────────────── useSectores ───────────────

describe("useSectores", () => {
  it("createSector inserta con todos los campos agronomicos", async () => {
    const chain = mockChain();
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { result } = renderHook(() => useSectores());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const input = {
      codigo: "E9999S999",
      equipo_id: "equipo-1",
      numero: 999,
      descripcion: "Sector de test",
      caudal_nominal: 150.5,
      hectareas: 25.75,
      variedad: "Arbequina",
      caseta: "Caseta Norte",
      bomba: "Bomba 3",
      filtro: "Mallas 120",
      anio: 2020,
      jefe_campo: "Juan Perez",
      especie: "Olivo",
      precipitacion: 850.0,
      eficiencia: 0.85,
      dist_entre_hilera: 6.0,
      dist_entre_plantas: 4.0,
      dist_entre_goteros: 0.75,
      num_lineas: 2,
      caudal_emisor: 2.2,
      m3_ha: 4500.0,
    };
    await result.current.createSector(input as any);

    expect(chain.insert).toHaveBeenCalledWith(input);
    expect(chain.select).toHaveBeenCalledWith("*, equipo:equipos(*)");
    expect(chain.orderAfterSelect).toHaveBeenCalledWith("numero");
  });

  it("updateSector solo envia los campos modificados", async () => {
    const chain = mockChain();
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { result } = renderHook(() => useSectores());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.updateSector("sector-1", {
      hectareas: 30.0,
      jefe_campo: "Maria Lopez",
      especie: "Avellano",
    });

    expect(chain.update).toHaveBeenCalledWith({
      hectareas: 30.0,
      jefe_campo: "Maria Lopez",
      especie: "Avellano",
    });
    expect(chain.eqAfterUpdate).toHaveBeenCalledWith("id", "sector-1");
  });

  it("deleteSector envia delete con id", async () => {
    const chain = mockChain();
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { result } = renderHook(() => useSectores());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.deleteSector("sector-1");

    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eqAfterDelete).toHaveBeenCalledWith("id", "sector-1");
  });

  it("fetchGeometriaSector parsea GeoJSON object de PostgREST", async () => {
    const geometry = {
      type: "Polygon" as const,
      coordinates: [[
        [-71.62, -35.13], [-71.61, -35.13],
        [-71.61, -35.12], [-71.62, -35.12],
        [-71.62, -35.13],
      ]],
    };

    const chain = mockChain();
    chain.singleOnSelect = vi.fn(() =>
      resolve({ geometria: geometry })
    );
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { result } = renderHook(() => useSectores());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const feature = await result.current.fetchGeometriaSector("sector-1");

    expect(chain.select).toHaveBeenCalledWith("geometria");
    expect(feature).not.toBeNull();
    expect(feature!.type).toBe("Feature");
    expect(feature!.geometry.type).toBe("Polygon");
    expect((feature!.geometry as any).coordinates[0]).toHaveLength(5);
  });

  it("fetchGeometriaSector parsea EWKT legacy string", async () => {
    const ewkt = "SRID=4326;POLYGON((-71.62 -35.13, -71.61 -35.13, -71.61 -35.12, -71.62 -35.12, -71.62 -35.13))";

    const chain = mockChain();
    chain.singleOnSelect = vi.fn(() =>
      resolve({ geometria: ewkt })
    );
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { result } = renderHook(() => useSectores());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const feature = await result.current.fetchGeometriaSector("sector-1");

    expect(feature).not.toBeNull();
    expect(feature!.geometry.type).toBe("Polygon");
    expect((feature!.geometry as any).coordinates[0].length).toBeGreaterThanOrEqual(4);
  });
});

// ─────────────── useCuarteles ───────────────

describe("useCuarteles", () => {
  beforeEach(() => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any);
  });

  it("createCuartel llama RPC create_cuartel con parametros mapeados", async () => {
    const chain = mockChain();
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { result } = renderHook(() => useCuarteles());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.createCuartel({
      nombre: "TEST Cuartel",
      especie: "Olivo",
      variedad: "Arbequina",
      anio_plantacion: 2018,
      superficie_ha: 12.5,
      plantas: 1200,
      polinizante: "Frantoio",
      jefe_campo: "Pedro Gomez",
      centro_costo: "CC-123",
      sector_ids: ["sector-1"],
    } as any);

    expect(supabase.rpc).toHaveBeenCalledWith("create_cuartel", {
      c_nombre: "TEST Cuartel",
      c_especie: "Olivo",
      c_variedad: "Arbequina",
      c_anio: 2018,
      c_superficie: 12.5,
      c_plantas: 1200,
      c_polinizante: "Frantoio",
      c_jefe: "Pedro Gomez",
      c_centro: "CC-123",
      c_equipo: null,
      c_sector_raw: null,
      c_geometria: null,
      c_sector_ids: ["sector-1"],
    });
  });

  it("createCuartel stringifica el GeoJSON en c_geometria", async () => {
    const chain = mockChain();
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { result } = renderHook(() => useCuarteles());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const geometry = {
      type: "Polygon" as const,
      coordinates: [[
        [-71.62, -35.13], [-71.61, -35.13],
        [-71.61, -35.12], [-71.62, -35.12],
        [-71.62, -35.13],
      ]],
    };
    const geojson: GeoJSON.Feature = {
      type: "Feature", geometry, properties: {},
    };

    await result.current.createCuartel({
      nombre: "Cuartel Geo",
      especie: "",
      variedad: "",
      polinizante: "",
      jefe_campo: "",
      centro_costo: "",
      sector_ids: [],
      geojson,
    } as any);

    const call = vi.mocked(supabase.rpc).mock.calls.find(([name]) => name === "create_cuartel");
    expect(call).toBeDefined();
    const params = call![1] as any;
    expect(params.c_geometria).toBe(JSON.stringify(geometry));
  });

  it("updateCuartel envia campos de texto + updated_at", async () => {
    const chain = mockChain();
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { result } = renderHook(() => useCuarteles());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.updateCuartel("cuartel-1", {
      nombre: "Editado",
      especie: "Avellano",
      variedad: "Tonda di Giffoni",
    });

    expect(chain.update).toHaveBeenCalled();
    const updateCall = vi.mocked(chain.update).mock.calls[0][0];
    expect(updateCall.nombre).toBe("Editado");
    expect(updateCall.especie).toBe("Avellano");
    expect(updateCall.variedad).toBe("Tonda di Giffoni");
    expect(updateCall.updated_at).toBeDefined();
    expect(typeof updateCall.updated_at).toBe("string");
    expect(chain.eqAfterUpdate).toHaveBeenCalledWith("id", "cuartel-1");
  });

  it("updateCuartel con sector_ids vacio limpia cuartel_sector", async () => {
    const chain = mockChain();
    chain.delete = vi.fn(() => ({ eq: vi.fn(() => resolve()) }));
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { result } = renderHook(() => useCuarteles());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.updateCuartel("cuartel-1", { sector_ids: [] });

    expect(chain.delete).toHaveBeenCalled();
  });

  it("updateCuartel con sector_ids poblado borra, reinserta y consulta sectores", async () => {
    const chain = mockChain();
    const deleteEq = vi.fn(() => resolve());
    chain.delete = vi.fn(() => ({ eq: deleteEq }));

    const selectInResolve = vi.fn(() =>
      resolve([
        { codigo: "E1S5", equipo: { codigo: 1 } },
      ])
    );
    chain.inOnSelect = selectInResolve;

    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { result } = renderHook(() => useCuarteles());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.updateCuartel("cuartel-1", { sector_ids: ["sector-1"] });

    expect(chain.update).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith("cuartel_id", "cuartel-1");
    expect(chain.select).toHaveBeenCalledWith("codigo, equipo:equipos(codigo)");
    expect(chain.inOnSelect).toHaveBeenCalledWith("id", ["sector-1"]);
  });

  it("deleteCuartel envia delete con id", async () => {
    const chain = mockChain();
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { result } = renderHook(() => useCuarteles());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.deleteCuartel("cuartel-1");

    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eqAfterDelete).toHaveBeenCalledWith("id", "cuartel-1");
  });
});
