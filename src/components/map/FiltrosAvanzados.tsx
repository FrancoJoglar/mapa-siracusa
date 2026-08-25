import { useState, useMemo } from "react";
import { Cuartel, SectorGeo, Equipo } from "../../lib/types";

export type ModoFiltro = "sectores" | "cuarteles";

export interface FiltrosAvanzadosState {
  modo: ModoFiltro;
  sectoresSeleccionados: string[];
  cuartelesSeleccionados: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (state: FiltrosAvanzadosState) => void;
  initialState: FiltrosAvanzadosState;
  sectores: SectorGeo[];
  cuarteles: Cuartel[];
  unidades: any[];
  equipos?: Equipo[];
}

export default function FiltrosAvanzados({ open, onClose, onApply, initialState, sectores, cuarteles, unidades, equipos: equiposData = [] }: Props) {
  const [local, setLocal] = useState<FiltrosAvanzadosState>(initialState);
  const [expandedEquipos, setExpandedEquipos] = useState<Set<string>>(new Set());

  // Filter sectors to only include those from active teams
  const sectoresActivos = useMemo(() => {
    const inactiveNames = new Set(equiposData.filter(e => e.activo === false).map(e => e.nombre));
    return sectores.filter(s => !inactiveNames.has(s.equipo || ""));
  }, [sectores, equiposData]);

  // Group sectors by equipo (only active)
  const sectoresPorEquipo = useMemo(() => {
    const map = new Map<string, SectorGeo[]>();
    sectoresActivos.forEach(s => {
      const eq = s.equipo || "Sin equipo";
      if (!map.has(eq)) map.set(eq, []);
      map.get(eq)!.push(s);
    });
    map.forEach(arr => arr.sort((a, b) => a.codigo.localeCompare(b.codigo)));
    return map;
  }, [sectoresActivos]);

  // Get cuarteles for each sector
  const cuartelesPorSector = useMemo(() => {
    const map = new Map<string, Cuartel[]>();
    cuarteles.forEach(c => {
      c.sector_ids?.forEach(sid => {
        if (!map.has(sid)) map.set(sid, []);
        map.get(sid)!.push(c);
      });
    });
    return map;
  }, [cuarteles]);

  // Compute which team "owns" each cuartel (highest irrigation %)
  const equipoPorCuartel = useMemo(() => {
    const map = new Map<string, string>();
    cuarteles.forEach(c => {
      const porEquipo = new Map<string, number>();
      unidades
        .filter((u: any) => u.cuartel_id === c.id && u.porcentaje_agua)
        .forEach((u: any) => {
          const sector = sectores.find(s => s.id === u.sector_id);
          if (sector) {
            const eq = sector.equipo || "Sin equipo";
            porEquipo.set(eq, (porEquipo.get(eq) || 0) + u.porcentaje_agua);
          }
        });
      let maxEq = "";
      let maxPct = 0;
      porEquipo.forEach((pct, eq) => { if (pct > maxPct) { maxPct = pct; maxEq = eq; } });
      map.set(c.id, maxEq);
    });
    return map;
  }, [cuarteles, unidades, sectores]);

  // Group cuarteles by their "owner" team (for cuartel mode)
  const cuartelesPorEquipo = useMemo(() => {
    const map = new Map<string, Cuartel[]>();
    cuarteles.forEach(c => {
      const eq = equipoPorCuartel.get(c.id) || "Sin equipo";
      if (!map.has(eq)) map.set(eq, []);
      map.get(eq)!.push(c);
    });
    map.forEach(arr => arr.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
    return map;
  }, [cuarteles, equipoPorCuartel]);

  const nombresEquipos = useMemo(() => {
    const source = local.modo === "sectores" ? sectoresPorEquipo : cuartelesPorEquipo;
    return Array.from(source.keys()).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
      return numA - numB;
    });
  }, [local.modo, sectoresPorEquipo, cuartelesPorEquipo]);

  // === Sector mode ===
  const toggleSector = (sectorId: string) => {
    setLocal(prev => {
      const next = prev.sectoresSeleccionados.includes(sectorId)
        ? prev.sectoresSeleccionados.filter(id => id !== sectorId)
        : [...prev.sectoresSeleccionados, sectorId];
      return { ...prev, sectoresSeleccionados: next };
    });
  };

  const toggleEquipoSector = (equipo: string) => {
    const sectors = sectoresPorEquipo.get(equipo) || [];
    const sectorIds = sectors.map(s => s.id);
    setLocal(prev => {
      const allSelected = sectorIds.every(id => prev.sectoresSeleccionados.includes(id));
      const next = allSelected
        ? prev.sectoresSeleccionados.filter(id => !sectorIds.includes(id))
        : [...new Set([...prev.sectoresSeleccionados, ...sectorIds])];
      return { ...prev, sectoresSeleccionados: next };
    });
  };

  // === Cuartel mode ===
  const toggleCuartel = (cuartelId: string) => {
    setLocal(prev => {
      const next = prev.cuartelesSeleccionados.includes(cuartelId)
        ? prev.cuartelesSeleccionados.filter(id => id !== cuartelId)
        : [...prev.cuartelesSeleccionados, cuartelId];
      return { ...prev, cuartelesSeleccionados: next };
    });
  };

  const toggleEquipoCuartel = (equipo: string) => {
    const cuarts = cuartelesPorEquipo.get(equipo) || [];
    const cuartelIds = cuarts.map(c => c.id);
    setLocal(prev => {
      const allSelected = cuartelIds.every(id => prev.cuartelesSeleccionados.includes(id));
      const next = allSelected
        ? prev.cuartelesSeleccionados.filter(id => !cuartelIds.includes(id))
        : [...new Set([...prev.cuartelesSeleccionados, ...cuartelIds])];
      return { ...prev, cuartelesSeleccionados: next };
    });
  };

  // === Common ===
  const selectAll = () => {
    if (local.modo === "sectores") {
      setLocal(prev => ({ ...prev, sectoresSeleccionados: sectoresActivos.map(s => s.id) }));
    } else {
      setLocal(prev => ({ ...prev, cuartelesSeleccionados: cuarteles.map(c => c.id) }));
    }
  };

  const clearAll = () => {
    if (local.modo === "sectores") {
      setLocal(prev => ({ ...prev, sectoresSeleccionados: [] }));
    } else {
      setLocal(prev => ({ ...prev, cuartelesSeleccionados: [] }));
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedEquipos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const switchMode = (modo: ModoFiltro) => {
    setLocal(prev => ({ ...prev, modo }));
    setExpandedEquipos(new Set());
  };

  if (!open) return null;

  const selectedCount = local.modo === "sectores" ? local.sectoresSeleccionados.length : local.cuartelesSeleccionados.length;
  const totalCount = local.modo === "sectores" ? sectoresActivos.length : cuarteles.length;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 4000 }} />

      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 380, maxWidth: "90vw",
        background: "#fff", zIndex: 4001, display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
      }}>
        {/* Header */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #ddd", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Filtros Avanzados</h3>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#666" }}>✕</button>
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #ddd" }}>
          <button onClick={() => switchMode("sectores")} style={{
            flex: 1, padding: "8px 0", border: "none", borderBottom: local.modo === "sectores" ? "2px solid #1565c0" : "2px solid transparent",
            background: "none", cursor: "pointer", fontWeight: local.modo === "sectores" ? 600 : 400,
            color: local.modo === "sectores" ? "#1565c0" : "#666", fontSize: 13,
          }}>Por Sector</button>
          <button onClick={() => switchMode("cuarteles")} style={{
            flex: 1, padding: "8px 0", border: "none", borderBottom: local.modo === "cuarteles" ? "2px solid #1565c0" : "2px solid transparent",
            background: "none", cursor: "pointer", fontWeight: local.modo === "cuarteles" ? 600 : 400,
            color: local.modo === "cuarteles" ? "#1565c0" : "#666", fontSize: 13,
          }}>Por Cuartel</button>
        </div>

        {/* Quick actions */}
        <div style={{ padding: "8px 16px", borderBottom: "1px solid #eee", display: "flex", gap: 8 }}>
          <button onClick={selectAll} style={btnSmall}>Seleccionar todos</button>
          <button onClick={clearAll} style={btnSmall}>Limpiar</button>
          <span style={{ fontSize: 12, color: "#666", alignSelf: "center", marginLeft: "auto" }}>
            {selectedCount} / {totalCount} {local.modo === "sectores" ? "sectores" : "cuarteles"}
          </span>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
          {local.modo === "sectores" ? (
            // === SECTOR MODE ===
            nombresEquipos.map(eq => {
              const sectors = sectoresPorEquipo.get(eq) || [];
              const selectedCount = sectors.filter(s => local.sectoresSeleccionados.includes(s.id)).length;
              const allSelected = selectedCount === sectors.length;
              const someSelected = selectedCount > 0 && !allSelected;
              const isExpanded = expandedEquipos.has(eq);

              return (
                <div key={eq} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
                    <input type="checkbox" checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected; }}
                      onChange={() => toggleEquipoSector(eq)}
                      style={{ width: 16, height: 16, cursor: "pointer" }} />
                    <span onClick={() => toggleExpand(eq)} style={{ flex: 1, fontWeight: 600, fontSize: 13, cursor: "pointer", userSelect: "none" }}>
                      {isExpanded ? "▾" : "▸"} {eq}
                    </span>
                    <span style={{ fontSize: 11, color: "#999" }}>{selectedCount}/{sectors.length}</span>
                  </div>
                  {isExpanded && (
                    <div style={{ paddingLeft: 24 }}>
                      {sectors.map(s => {
                        const isSelected = local.sectoresSeleccionados.includes(s.id);
                        const cuartelesDelSector = cuartelesPorSector.get(s.id) || [];
                        return (
                          <div key={s.id} style={{ marginBottom: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                              <input type="checkbox" checked={isSelected} onChange={() => toggleSector(s.id)}
                                style={{ width: 14, height: 14, cursor: "pointer" }} />
                              <span style={{ fontSize: 12, fontWeight: 500 }}>{s.codigo}</span>
                              {s.hectareas != null && <span style={{ fontSize: 11, color: "#999" }}>{s.hectareas.toFixed(1)} ha</span>}
                              {s.especie && <span style={{ fontSize: 11, color: "#999" }}>· {s.especie}</span>}
                            </div>
                            {isSelected && cuartelesDelSector.length > 0 && (
                              <div style={{ paddingLeft: 28, fontSize: 11, color: "#666" }}>
                                {cuartelesDelSector.map(c => (
                                  <div key={c.id} style={{ padding: "1px 0" }}>• {c.nombre}{c.variedad ? ` (${c.variedad})` : ""}{c.superficie_ha ? ` · ${c.superficie_ha} ha` : ""}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            // === CUARTEL MODE ===
            nombresEquipos.map(eq => {
              const cuarts = cuartelesPorEquipo.get(eq) || [];
              const selectedCount = cuarts.filter(c => local.cuartelesSeleccionados.includes(c.id)).length;
              const allSelected = selectedCount === cuarts.length;
              const someSelected = selectedCount > 0 && !allSelected;
              const isExpanded = expandedEquipos.has(eq);

              return (
                <div key={eq} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
                    <input type="checkbox" checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected; }}
                      onChange={() => toggleEquipoCuartel(eq)}
                      style={{ width: 16, height: 16, cursor: "pointer" }} />
                    <span onClick={() => toggleExpand(eq)} style={{ flex: 1, fontWeight: 600, fontSize: 13, cursor: "pointer", userSelect: "none" }}>
                      {isExpanded ? "▾" : "▸"} {eq}
                    </span>
                    <span style={{ fontSize: 11, color: "#999" }}>{selectedCount}/{cuarts.length}</span>
                  </div>
                  {isExpanded && (
                    <div style={{ paddingLeft: 24 }}>
                      {cuarts.map(c => {
                        const isSelected = local.cuartelesSeleccionados.includes(c.id);
                        return (
                          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleCuartel(c.id)}
                              style={{ width: 14, height: 14, cursor: "pointer" }} />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{c.nombre}</span>
                            {c.variedad && <span style={{ fontSize: 11, color: "#999" }}>{c.variedad}</span>}
                            {c.superficie_ha != null && <span style={{ fontSize: 11, color: "#999" }}>{c.superficie_ha.toFixed(1)} ha</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #ddd", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnCancel}>Cancelar</button>
          <button onClick={() => onApply(local)} style={btnApply}>Aplicar</button>
        </div>
      </div>
    </>
  );
}

const btnSmall: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 4, border: "1px solid #ccc", background: "#fff",
  cursor: "pointer", fontSize: 11,
};
const btnCancel: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 6, border: "1px solid #ccc", background: "#fff",
  cursor: "pointer", fontSize: 13,
};
const btnApply: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 6, border: "none", background: "#1565c0", color: "#fff",
  cursor: "pointer", fontSize: 13, fontWeight: 600,
};
