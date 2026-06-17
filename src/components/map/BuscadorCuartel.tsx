import { useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { Cuartel } from "../../lib/types";

interface Props {
  cuarteles: Cuartel[];
}

export default function BuscadorCuartel({ cuarteles }: Props) {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Cuartel[]>([]);
  const [show, setShow] = useState(false);

  const buscar = (val: string) => {
    setQuery(val);
    if (val.trim().length < 2) {
      setResults([]);
      setShow(false);
      return;
    }
    const q = val.toLowerCase();
    const matches = cuarteles
      .filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          c.especie?.toLowerCase().includes(q) ||
          c.jefe_campo?.toLowerCase().includes(q)
      )
      .slice(0, 8);
    setResults(matches);
    setShow(matches.length > 0);
  };

  const volarA = (cuartel: Cuartel) => {
    if (!cuartel.geojson) return;
    const geoJsonLayer = L.geoJSON(cuartel.geojson);
    const bounds = geoJsonLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
    }
    setQuery("");
    setShow(false);
  };

  return (
    <div className="leaflet-top leaflet-left" style={{ top: 10, marginLeft: 50 }}>
      <div className="leaflet-control" style={{ position: "relative" }}>
        <input
          type="text"
          placeholder="Buscar cuartel (ej: C 149)..."
          value={query}
          onChange={(e) => buscar(e.target.value)}
          onFocus={() => query.length >= 2 && setShow(true)}
          onBlur={() => setTimeout(() => setShow(false), 200)}
          style={{
            padding: "8px 12px",
            width: 220,
            border: "1px solid #ccc",
            borderRadius: 4,
            fontSize: 13,
            outline: "none",
          }}
        />
        {show && results.length > 0 && (
          <ul
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "white",
              border: "1px solid #ccc",
              borderTop: 0,
              borderRadius: "0 0 4px 4px",
              listStyle: "none",
              margin: 0,
              padding: 0,
              maxHeight: 200,
              overflowY: "auto",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              zIndex: 10000,
            }}
          >
            {results.map((c) => (
              <li
                key={c.id}
                onMouseDown={() => volarA(c)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid #eee",
                  fontSize: 13,
                }}
              >
                <strong>{c.nombre}</strong> — {c.especie}
                {c.superficie_ha ? ` (${c.superficie_ha} ha)` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
