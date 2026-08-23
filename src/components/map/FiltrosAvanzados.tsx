import { useState, useMemo } from "react";
import { Cuartel, SectorGeo } from "../../lib/types";

export interface FiltrosAvanzadosState {
  sectoresSeleccionados: string[]; // IDs de sectores
}

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (state: FiltrosAvanzadosState) => void;
  initialState: FiltrosAvanzadosState;
  sectores: SectorGeo[];
  cuarteles: Cuartel[];
}

export default function FiltrosAvanzados({ open, onClose, onApply, initialState, sectores, cuarteles }: Props) {
  const [local, setLocal] = useState<FiltrosAvanzadosState>(initialState);
  const [expandedEquipos, setExpandedEquipos] = useState<Set<string>>(new Set());

  // Group sectors by equipo
  const sectoresPorEquipo = useMemo(() => {
    const map = new Map<string, SectorGeo[]>();
    sectores.forEach(s => {
      const eq = s.equipo || "Sin equipo";
      if (!map.has(eq)) map.set(eq, []);
      map.get(eq)!.push(s);
    });
    // Sort sectors within each equipo by codigo
    map.forEach(arr => arr.sort((a, b) => a.codigo.localeCompare(b.codigo)));
    return map;
  }, [sectores]);

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

  const equipos = useMemo(() => {
    return Array.from(sectoresPorEquipo.keys()).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
  }, [sectoresPorEquipo]);

  const toggleSector = (sectorId: string) => {
    setLocal(prev => {
      const next = prev.sectoresSeleccionados.includes(sectorId)
        ? prev.sectoresSeleccionados.filter(id => id !== sectorId)
        : [...prev.sectoresSeleccionados, sectorId];
      return { ...prev, sectoresSeleccionados: next };
    });
  };

  const toggleEquipo = (equipo: string) => {
    const sectors = sectoresPorEquipo.get(equipo) || [];
    const sectorIds = sectors.map(s => s.id);
    setLocal(prev => {
      const allSelected = sectorIds.every(id => prev.sectoresSeleccionados.includes(id));
      let next: string[];
      if (allSelected) {
        next = prev.sectoresSeleccionados.filter(id => !sectorIds.includes(id));
      } else {
        next = [...new Set([...prev.sectoresSeleccionados, ...sectorIds])];
      }
      return { ...prev, sectoresSeleccionados: next };
    });
  };

  const selectAll = () => {
    setLocal({ sectoresSeleccionados: sectores.map(s => s.id) });
  };

  const clearAll = () => {
    setLocal({ sectoresSeleccionados: [] });
  };

  const toggleExpand = (equipo: string) => {
    setExpandedEquipos(prev => {
      const next = new Set(prev);
      if (next.has(equipo)) next.delete(equipo);
      else next.add(equipo);
      return next;
    });
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 4000 }} />

      {/* Panel */}
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

        {/* Quick actions */}
        <div style={{ padding: "8px 16px", borderBottom: "1px solid #eee", display: "flex", gap: 8 }}>
          <button onClick={selectAll} style={btnSmall}>Seleccionar todos</button>
          <button onClick={clearAll} style={btnSmall}>Limpiar</button>
          <span style={{ fontSize: 12, color: "#666", alignSelf: "center", marginLeft: "auto" }}>
            {local.sectoresSeleccionados.length} / {sectores.length} sectores
          </span>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
          {equipos.map(eq => {
            const sectors = sectoresPorEquipo.get(eq) || [];
            const selectedCount = sectors.filter(s => local.sectoresSeleccionados.includes(s.id)).length;
            const allSelected = selectedCount === sectors.length;
            const someSelected = selectedCount > 0 && !allSelected;
            const isExpanded = expandedEquipos.has(eq);

            return (
              <div key={eq} style={{ marginBottom: 8 }}>
                {/* Equipo header */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={() => toggleEquipo(eq)}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span
                    onClick={() => toggleExpand(eq)}
                    style={{ flex: 1, fontWeight: 600, fontSize: 13, cursor: "pointer", userSelect: "none" }}
                  >
                    {isExpanded ? "▾" : "▸"} {eq}
                  </span>
                  <span style={{ fontSize: 11, color: "#999" }}>
                    {selectedCount}/{sectors.length}
                  </span>
                </div>

                {/* Sectors (collapsed by default) */}
                {isExpanded && (
                  <div style={{ paddingLeft: 24 }}>
                    {sectors.map(s => {
                      const isSelected = local.sectoresSeleccionados.includes(s.id);
                      const cuartelesDelSector = cuartelesPorSector.get(s.id) || [];

                      return (
                        <div key={s.id} style={{ marginBottom: 4 }}>
                          {/* Sector checkbox */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSector(s.id)}
                              style={{ width: 14, height: 14, cursor: "pointer" }}
                            />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>
                              {s.codigo}
                            </span>
                            {s.hectareas != null && (
                              <span style={{ fontSize: 11, color: "#999" }}>
                                {s.hectareas.toFixed(1)} ha
                              </span>
                            )}
                            {s.especie && (
                              <span style={{ fontSize: 11, color: "#999" }}>
                                · {s.especie}
                              </span>
                            )}
                          </div>

                          {/* Cuarteles info */}
                          {isSelected && cuartelesDelSector.length > 0 && (
                            <div style={{ paddingLeft: 28, fontSize: 11, color: "#666" }}>
                              {cuartelesDelSector.map(c => (
                                <div key={c.id} style={{ padding: "1px 0" }}>
                                  • {c.nombre}
                                  {c.variedad ? ` (${c.variedad})` : ""}
                                  {c.superficie_ha ? ` · ${c.superficie_ha} ha` : ""}
                                </div>
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
          })}
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
