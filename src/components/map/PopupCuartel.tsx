import { Cuartel } from "../../lib/types";

interface Props {
  cuartel: Cuartel;
}

export default function PopupCuartel({ cuartel }: Props) {
  return (
    <div style={{ minWidth: 220, fontSize: 13 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>
        {cuartel.nombre}
      </h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <Row label="Especie" value={cuartel.especie} />
          <Row label="Variedad" value={cuartel.variedad} />
          <Row
            label="Año plantación"
            value={cuartel.anio_plantacion ? String(cuartel.anio_plantacion) : ""}
          />
          <Row
            label="Superficie"
            value={cuartel.superficie_ha ? `${cuartel.superficie_ha} ha` : ""}
          />
          <Row
            label="Plantas"
            value={cuartel.plantas ? String(cuartel.plantas) : ""}
          />
          <Row label="Polinizante" value={cuartel.polinizante} />
          <Row label="Jefe de campo" value={cuartel.jefe_campo} />
          <Row label="Centro de costo" value={cuartel.centro_costo} />
          <Row label="Equipo riego" value={cuartel.equipo_riego} />
          <Row label="Sectores" value={cuartel.sector_raw} />
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <tr>
      <td
        style={{
          padding: "3px 6px 3px 0",
          color: "#666",
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        {label}:
      </td>
      <td style={{ padding: "3px 0" }}>{value}</td>
    </tr>
  );
}
