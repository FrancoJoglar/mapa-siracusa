// Textos en espanol para los tooltips de dibujo de Geoman.
//
// Geoman monta el tooltip con bindTooltip(string), y Leaflet inyecta ese
// string como innerHTML, asi que admite markup. Aprovechamos eso para poner
// la accion en una linea y los atajos en otra mas chica.
//
// El estilo vive en index.css, en la regla .leaflet-tooltip:has(.pm-tip-main).

import type L from "leaflet";
import "@geoman-io/leaflet-geoman-free";

const ESC = '<kbd>Esc</kbd> cancela';

function tip(accion: string, atajos: string) {
  return `<span class="pm-tip-main">${accion}</span><span class="pm-tip-hint">${atajos}</span>`;
}

// Llamar despues de pm.addControls(): setLang reinicia la toolbar para
// retraducir los titulos de los botones.
export function setupGeomanEs(pm: L.PM.PMMap) {
  // Sin esto la tecla Escape no hace nada: el default de la libreria es false.
  pm.setGlobalOptions({ exitModeOnEscape: true });

  pm.setLang(
    "es",
    {
      tooltips: {
        firstVertex: tip("Clic para el primer vértice", ESC),
        continueLine: tip("Clic para el siguiente vértice", ESC),
        finishPoly: tip("Clic en el primer vértice para cerrar", ESC),
        finishLine: tip("Clic en el último vértice para terminar", ESC),
      },
    },
    "es",
  );
}
