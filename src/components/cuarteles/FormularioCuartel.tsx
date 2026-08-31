import { useState, useMemo, useEffect } from "react";
import { Cuartel, Sector } from "../../lib/types";
import { supabase } from "../../lib/supabase";
import EditorGeometria from "../ui/EditorGeometria";

interface Props {
  cuartel: Cuartel;
  sectores: Sector[];
  onSave: (data: Partial<Cuartel>) => Promise<void>;
  onCancel: () => void;
  onPolygonSaved?: () => void;
}

export default function FormularioCuartel({
  cuartel,
  sectores,
  onSave,
  onCancel,
  onPolygonSaved,
}: Props) {
  const [nombre, setNombre] = useState(cuartel.nombre);
  const [especie, setEspecie] = useState(cuartel.especie || "");
  const [variedad, setVariedad] = useState(cuartel.variedad || "");
  const [anio, setAnio] = useState(cuartel["año_plantacion"] || 0);
  const [superficie, setSuperficie] = useState(cuartel.superficie_ha || 0);
  const [polinizante, setPolinizante] = useState(cuartel.polinizante || "");
  const [jefeCampo, setJefeCampo] = useState(cuartel.jefe_campo || "");
  const [centroCosto, setCentroCosto] = useState(cuartel.centro_costo || "");
  const [sectorIds, setSectorIds] = useState<string[]>(cuartel.sector_ids || []);
  const [sectorPcts, setSectorPcts] = useState<Record<string, number>>({});
  const [searchText, setSearchText] = useState("");
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  // Load existing percentages
  useEffect(() => {
    if (!cuartel.id) return;
    supabase
      .from("cuartel_sector")
      .select("sector_id, porcentaje_agua")
      .eq("cuartel_id", cuartel.id)
      .then(({ data }) => {
        if (!data) return;
        const pcts: Record<string, number> = {};
        data.forEach((r: any) => {
          if (r.porcentaje_agua != null) pcts[r.sector_id] = r.porcentaje_agua;
        });
        setSectorPcts(pcts);
      });
  }, [cuartel.id]);

  const sectoresDisponibles = useMemo(() => {
    return sectores.filter(s => !sectorIds.includes(s.id));
  }, [sectores, sectorIds]);

  const sectoresAsignados = useMemo(() => {
    return sectorIds.map(id => sectores.find(s => s.id === id)).filter(Boolean) as Sector[];
  }, [sectores, sectorIds]);

  const filteredDisponibles = useMemo(() => {
    if (!searchText) return sectoresDisponibles;
    const q = searchText.toLowerCase();
    return sectoresDisponibles.filter(s =>
      s.codigo.toLowerCase().includes(q) ||
      (s.descripcion && s.descripcion.toLowerCase().includes(q))
    );
  }, [sectoresDisponibles, searchText]);

  const agregarSector = (id: string) => {
    setSectorIds(prev => [...prev, id]);
    setSectorPcts(prev => ({ ...prev, [id]: prev[id] ?? 100 }));
    setSearchText("");
  };

  const removerSector = (id: string) => {
    setSectorIds(prev => prev.filter(x => x !== id));
    setSectorPcts(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saveData = {
        nombre,
        especie,
        variedad,
        "año_plantacion": anio || null,
        superficie_ha: superficie || null,
        polinizante,
        jefe_campo: jefeCampo,
        centro_costo: centroCosto,
        sector_ids: sectorIds,
        sector_pcts: sectorPcts,
      };
      console.log("FormularioCuartel saveData:", saveData);
      await onSave(saveData);
    } finally {
      setSaving(false);
    }
  };

  const totalPct = sectorIds.reduce((sum, id) => sum + (sectorPcts[id] ?? 0), 0);

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3 style={{ marginTop: 0 }}>Editar {cuartel.nombre}</h3>
        <form onSubmit={handleSubmit}>
          <Row>
            <Campo label="Nombre">
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                style={inputStyle}
              />
            </Campo>
            <Campo label="Especie">
              <select
                value={especie}
                onChange={(e) => setEspecie(e.target.value)}
                style={inputStyle}
              >
                <option value="">Seleccionar...</option>
                <option value="Olivo">Olivo</option>
                <option value="Cerezo">Cerezo</option>
                <option value="Avellano">Avellano</option>
                <option value="Kiwi">Kiwi</option>
                <option value="Palto">Palto</option>
              </select>
            </Campo>
          </Row>
          <Row>
            <Campo label="Variedad">
              <input
                type="text"
                value={variedad}
                onChange={(e) => setVariedad(e.target.value)}
                style={inputStyle}
              />
            </Campo>
            <Campo label="Año Plantación">
              <input
                type="number"
                value={anio || ""}
                onChange={(e) => setAnio(Number(e.target.value))}
                style={inputStyle}
              />
            </Campo>
          </Row>
          <Row>
            <Campo label="Superficie (ha)">
              <input
                type="number"
                step="0.01"
                value={superficie || ""}
                onChange={(e) => setSuperficie(Number(e.target.value))}
                style={inputStyle}
              />
            </Campo>
          </Row>
          <Row>
            <Campo label="Polinizante">
              <input
                type="text"
                value={polinizante}
                onChange={(e) => setPolinizante(e.target.value)}
                style={inputStyle}
              />
            </Campo>
            <Campo label="Jefe de Campo">
              <input
                type="text"
                value={jefeCampo}
                onChange={(e) => setJefeCampo(e.target.value)}
                style={inputStyle}
              />
            </Campo>
          </Row>
          <Campo label="Centro de Costo">
            <input
              type="text"
              value={centroCosto}
              onChange={(e) => setCentroCosto(e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
          </Campo>

          <Campo label="Sectores de Riego y Porcentaje de Agua">
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Buscar sector por código o descripción..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ flex: 1, ...inputStyle }}
              />
            </div>
            {searchText && filteredDisponibles.length > 0 && (
              <div style={{
                maxHeight: 150, overflowY: "auto",
                border: "1px solid #90caf9", borderRadius: 4,
                marginBottom: 8, background: "#f5f9ff",
              }}>
                {filteredDisponibles.map(s => (
                  <div key={s.id} onClick={() => agregarSector(s.id)}
                    style={{
                      padding: "5px 10px", fontSize: 13, cursor: "pointer",
                      borderBottom: "1px solid #e3f2fd",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#e3f2fd")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <strong>{s.codigo}</strong>
                    {s.descripcion ? ` — ${s.descripcion}` : ""}
                  </div>
                ))}
              </div>
            )}
            {searchText && filteredDisponibles.length === 0 && sectoresDisponibles.length > 0 && (
              <p style={{ color: "#999", fontSize: 12, margin: "0 0 8px" }}>
                Sin resultados.
              </p>
            )}
            {sectores.length === 0 && (
              <p style={{ color: "#999", fontSize: 13 }}>
                No hay sectores creados. Andá a la sección Sectores primero.
              </p>
            )}
            {sectoresAsignados.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {sectoresAsignados.map(s => (
                  <div key={s.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 10px", background: "#e8f5e9", borderRadius: 4, fontSize: 13,
                  }}>
                    <strong style={{ minWidth: 60 }}>{s.codigo}</strong>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      <span style={{ color: "#666" }}>% Riego:</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={sectorPcts[s.id] ?? ""}
                        onChange={(e) => setSectorPcts(prev => ({
                          ...prev,
                          [s.id]: e.target.value === "" ? 0 : Number(e.target.value),
                        }))}
                        style={{
                          width: 60, padding: "3px 6px", border: "1px solid #ccc",
                          borderRadius: 4, fontSize: 12, textAlign: "center",
                        }}
                      />
                      <span style={{ color: "#999" }}>%</span>
                    </label>
                    <div style={{ flex: 1 }} />
                    <button type="button" onClick={() => removerSector(s.id)}
                      style={{
                        background: "none", border: "none", color: "#c62828",
                        cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px",
                      }}
                      title="Quitar sector"
                    >×</button>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: totalPct === 100 ? "#2e7d32" : totalPct > 100 ? "#c62828" : "#e65100", fontWeight: 500, marginTop: 4 }}>
                  Total: {totalPct}%
                </div>
              </div>
            )}
            {sectorIds.length === 0 && (
              <p style={{ color: "#999", fontSize: 12, margin: 0 }}>
                Ningún sector asignado. Buscá arriba y agregalos.
              </p>
            )}
          </Campo>

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "space-between",
              marginTop: 16,
            }}
          >
            <button type="button" onClick={() => setShowEditor(true)} style={btnEditorStyle}>
              Editar Poligono
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onCancel} style={btnCancelStyle}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} style={btnSaveStyle}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {showEditor && (
        <EditorGeometria
          geojson={cuartel.geojson || null}
          table="cuarteles"
          entityId={cuartel.id}
          onCancel={() => { setShowEditor(false); onPolygonSaved?.(); }}
        />
      )}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 12 }}>{children}</div>;
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ flex: 1, marginBottom: 12 }}>
      <label
        style={{
          display: "block",
          marginBottom: 4,
          fontSize: 12,
          fontWeight: 600,
          color: "#555",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 2000,
};
const modalStyle: React.CSSProperties = {
  background: "#fff",
  padding: 24,
  borderRadius: 8,
  width: 600,
  maxWidth: "95vw",
  maxHeight: "90vh",
  overflowY: "auto",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  border: "1px solid #ccc",
  borderRadius: 4,
  fontSize: 13,
  boxSizing: "border-box",
};
const btnCancelStyle: React.CSSProperties = {
  padding: "6px 14px",
  border: "1px solid #ccc",
  borderRadius: 4,
  background: "#f5f5f5",
  cursor: "pointer",
};
const btnSaveStyle: React.CSSProperties = {
  padding: "6px 14px",
  background: "#1565c0",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontWeight: 500,
};
const btnEditorStyle: React.CSSProperties = {
  padding: "6px 14px",
  background: "#fff3e0",
  color: "#e65100",
  border: "1px solid #ffcc80",
  borderRadius: 4,
  cursor: "pointer",
  fontWeight: 500,
  fontSize: 13,
};
