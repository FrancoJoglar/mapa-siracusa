# Siracusa 2025 - Sistema de Mapeo de Riego

**Fecha de documentación:** 16 agosto 2026  
**Proyecto:** mapa-siracusa  
**URL producción:** https://mapa-siracusa.vercel.app/

---

## Descripción General

Sistema GIS web para la gestión y visualización geoespacial del sistema de riego del fundo Siracusa. Permite visualizar, editar y administrar la sectorización completa del campo: cuarteles, sectores, unidades de riego, equipos, tuberías, válvulas, antenas y sondas.

---

## Tech Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 + TypeScript |
| Build | Vite 8 |
| Mapas | Leaflet + react-leaflet |
| Editor Geom. | leaflet-geoman (edición de polígonos/puntos) |
| Análisis Esp. | Turf.js |
| State | Zustand |
| Forms | react-hook-form + Zod |
| Backend | Supabase (PostgreSQL + PostGIS + Auth + RLS) |
| Deploy | Vercel |
| Tests | Vitest + testing-library |

---

## Estructura del Proyecto

```
mapa-siracusa/
├── src/
│   ├── App.tsx                    # Router principal + Auth
│   ├── main.tsx                   # Entry point
│   ├── index.css                  # Estilos globales
│   ├── context/
│   │   └── AuthContext.tsx        # Autenticación Supabase
│   ├── pages/
│   │   ├── MapaPage.tsx           # Página principal del mapa
│   │   ├── LoginPage.tsx          # Login
│   │   ├── AdminEquipos.tsx       # CRUD Equipos de riego
│   │   ├── AdminSectores.tsx      # CRUD Sectores
│   │   └── AdminCuarteles.tsx     # CRUD Cuarteles
│   ├── components/
│   │   ├── map/
│   │   │   ├── MapaCuarteles.tsx  # Componente principal del mapa
│   │   │   ├── GeomanEditor.tsx   # Editor de geometrías (polígonos)
│   │   │   ├── BarraFiltros.tsx   # Filtros del mapa
│   │   │   ├── BuscadorCuartel.tsx # Búsqueda de cuarteles
│   │   │   └── PopupCuartel.tsx   # Popup de cuarteles
│   │   ├── ui/
│   │   │   ├── Georreferenciador.tsx # Editor de puntos (válvulas, antenas, sondas)
│   │   │   └── VisorPDF.tsx       # Visor de planos PDF
│   │   ├── cuarteles/
│   │   │   └── FormularioCuartel.tsx
│   │   ├── equipos/
│   │   │   └── FormularioEquipo.tsx
│   │   └── sectores/
│   │       └── FormularioSector.tsx
│   ├── hooks/
│   │   ├── useEquipos.ts          # CRUD equipos
│   │   ├── useSectores.ts         # CRUD sectores
│   │   ├── useCuarteles.ts        # CRUD cuarteles
│   │   └── useUnidadesRiego.ts    # Unidades de riego
│   ├── store/
│   │   └── editorStore.ts         # Estado global del editor (Zustand)
│   └── lib/
│       ├── supabase.ts            # Cliente Supabase
│       ├── types.ts               # TypeScript interfaces
│       ├── colors.ts              # Utilidades de colores
│       └── export.ts              # Exportación de datos
├── sql/                           # Migraciones SQL
│   ├── migracion.sql              # Schema base
│   ├── migracion_v2.sql           # Updates
│   ├── migracion_v3_unidades_riego.sql
│   ├── migracion_v4_rpc_sync_sectores.sql
│   ├── migracion_v5_remove_variedad_sectores.sql
│   ├── migracion_v6_multipolygon.sql
│   ├── migracion_v7_rls.sql       # Row Level Security
│   ├── migracion_v8_georreferencias.sql
│   ├── migracion_v8_tuberias_valvulas.sql  # Tuberías y válvulas
│   ├── migracion_v9_variedad_sectores.sql
│   └── migracion_v10_puntos_equipo.sql     # Antenas/sondas con equipo_id
├── scripts/                       # Scripts de utilidad
├── supabase/                      # Configuración Supabase
└── vercel.json                    # Configuración deploy
```

---

## Modelo de Datos (Entidades Principales)

### Equipos de Riego
```typescript
interface Equipo {
  id: string;
  codigo: number;
  nombre: string;
  descripcion: string;
  plano_url?: string;
}
```
- Cada equipo representa un sistema de riego independiente
- Contiene múltiples sectores
- Puede tener tuberías, válvulas, antenas y sondas asociadas

### Sectores
```typescript
interface Sector {
  id: string;
  codigo: string;           // Ej: "E6-S1"
  equipo_id: string;        // FK → Equipos
  numero: number;
  caudal_nominal: number | null;
  hectareas: number | null;
  caseta: string;
  bomba: string;
  filtro: string;
  anio: number | null;
  jefe_campo: string;
  especie: string;
  precipitacion: number | null;
  eficiencia: number | null;
  dist_entre_hilera: number | null;
  dist_entre_plantas: number | null;
  dist_entre_goteros: number | null;
  num_lineas: number | null;
  caudal_emisor: number | null;
  m3_ha: number | null;
}
```

### Cuarteles
```typescript
interface Cuartel {
  id: string;
  nombre: string;
  especie: string;
  variedad: string;
  anio_plantacion: number | null;
  superficie_ha: number | null;
  plantas: number | null;
  polinizante: string;
  jefe_campo: string;
  centro_costo: string;
  equipo_riego: string;
  sector_raw: string;
  sector_ids: string[];     // Relación con sectores
  geojson?: Feature;        // Geometría PostGIS
}
```

### Unidades de Riego
```typescript
interface UnidadRiego {
  id: string;
  codigo: string;
  cuartel_id: string;
  sector_id: string;
  porcentaje_agua: number | null;
  geojson?: Feature;
}
```

### Infraestructura (Puntos)
```typescript
interface Tuberia {
  id: string;
  codigo: string;
  equipo_id: string;
  nivel: string;            // "matriz" | "submatriz"
  nombre: string;
  material: string;
  diametro_mm: number | null;
  geojson?: Feature;        // LineString
}

interface Valvula {
  id: string;
  codigo: string;
  tuberia_id: string;
  equipo_id?: string;
  tipo: string;
  diametro_mm: number | null;
  color?: string;
  geojson?: Feature;        // Point
}

interface Antena {
  id: string;
  codigo: string;
  equipo_id?: string;
  tipo: string;
  color?: string;
  geojson?: Feature;        // Point
}

interface Sonda {
  id: string;
  codigo: string;
  equipo_id?: string;
  tipo: string;
  color?: string;
  profundidad_m: number | null;
  geojson?: Feature;        // Point
}
```

---

## Funcionalidades Implementadas

### 1. Mapa Principal (`MapaPage.tsx`)
- Visualización de todas las capas geoespaciales
- Cuarteles con polígonos coloreados por especie
- Sectores con geometría
- Unidades de riego
- Equipos (sin geometría, solo datos)
- Tuberías (líneas matriz/submatriz)
- **Válvulas** (puntos naranjas)
- **Antenas** (puntos morados)
- **Sondas** (puntos amarillos)
- Edificaciones
- Filtro por equipo
- Búsqueda de cuartel
- Popups interactivos con información completa

### 2. Editor de Geometrías (`GeomanEditor.tsx`)
- Edición de polígonos (cuarteles, sectores)
- Herramientas Geoman: dibujar, editar vértices, arrastrar
- Guardado en Supabase (PostGIS)
- Modo lectura/escritura
- Capa de satélite (Esri World Imagery)
- Validación de geometrías

### 3. Georreferenciador de Puntos (`Georreferenciador.tsx`)
- **Editor de puntos simple** para válvulas, antenas y sondas
- Colocación de puntos con click en el mapa
- Categorías con colores:
  - Válvula: naranja (#e65100)
  - Antena: morado (#6a1b9a)
  - Antena-Sonda: amarillo (#f9a825)
- Importación de puntos desde KMZ y Excel
- Edición de atributos de puntos
- Guardado en tablas: `valvulas`, `antenas`, `sondas`
- Filtro por equipo

### 4. Administración
- **Equipos**: CRUD completo con formulario
- **Sectores**: CRUD con relación a equipos
- **Cuarteles**: CRUD con relación a sectores

### 5. Autenticación
- Login con Supabase Auth
- Control de acceso por roles (admin)
- RLS (Row Level Security) configurado

---

## Capas del Mapa

| Capa | Tipo Geom. | Color | Tabla |
|------|------------|-------|-------|
| Cuarteles | Polygon/MultiPolygon | Por especie | `cuarteles` |
| Sectores | Polygon | Verde | `sectores` (RPC) |
| Unidades Riego | Polygon | Variable | `unidades_riego` (RPC) |
| Tubería Matriz | LineString | Azul | `tuberias` |
| Tubería Submatriz | LineString | Rojo | `tuberias` |
| **Válvulas** | Point | Naranja | `valvulas` |
| **Antenas** | Point | Morado | `antenas` |
| **Sondas** | Point | Amarillo | `sondas` |
| Edificaciones | Polygon | Gris | `edificaciones` (RPC) |

---

## Estado de Git

### Rama actual: `dev`
### Ramas disponibles:
- `dev` (activa)
- `master`

### Últimos commits (commits relevantes):
```
50d468d 2026-08-13 feat: filtro por equipo en mapa principal + tipos equipo_id/color
3f1984e 2026-08-13 feat: reescribir Georreferenciador como editor de puntos simple
31b21f3 2026-08-13 fix: boton AGREGAR PUNTO mas prominente con fondo naranja
6da7201 2026-08-07 fix: boton manual Colocar punto en barra de herramientas
ff8df25 2026-08-07 fix: posicionar controles Geoman en topright
a9c0c2e 2026-08-07 feat: simplificar dibujo a puntos + importacion KMZ/Excel
bdb4e68 2026-07-23 docs: migracion v9 script
```

### Stash pendiente:
```bash
stash@{0}: On dev: cambios no relacionados
```
**Archivos en stash:**
- `src/components/ui/Georreferenciador.tsx` (492 inserciones, 135 eliminaciones)
- `src/lib/types.ts` (3 inserciones)
- `src/pages/AdminEquipos.tsx` (129 inserciones)

**Para recuperar:**
```bash
git stash pop
```

### Archivos sin trackear:
- `equipos_data.json`
- `sectores_data.json`

---

## Trabajo Pendiente / Próximos Pasos

1. **Aplicar stash** - Recuperar cambios del viernes 15 agosto
2. **Completar editor de puntos** - El Georreferenciador fue reescrito como editor simple
3. **Filtros avanzados** - Filtrar por especie, variedad, año
4. **Exportación** - Exportar datos del mapa a diferentes formatos
5. **Rendimiento** - Optimizar consultas RPC para grandes volúmenes de datos
6. **Mobile** - Adaptar interfaz para dispositivos móviles

---

## Endpoints Supabase (RPCs)

- `get_cuarteles_con_sectores` - Cuarteles con sus sectores
- `get_edificaciones_geojson` - Edificaciones georreferenciadas
- `get_sectores_geojson` - Sectores con geometría
- `get_unidades_riego_geojson` - Unidades de riego

---

## Configuración Importante

### Variables de Entorno (`.env`)
```
VITE_SUPABASE_URL=https://nnelrvctqjbwfucccxfh.supabase.co
VITE_SUPABASE_ANON_KEY=[configurar]
```

### Supabase
- **Proyecto:** `nnelrvctqjbwfucccxfh`
- **Tablas principales:** equipos, sectores, cuarteles, unidades_riego, tuberias, valvulas, antenas, sondas, edificaciones, georreferencias
- **RLS:** Habilitado (migracion_v7_rls.sql)

---

## Notas Técnicas

1. **Geoman Editor** - Se usó leaflet-geoman-free para edición de polígonos. Se deshabilitaron herramientas no necesarias (círculos, rectángulos, etc.)

2. **Georreferenciador** - Fue reescrito para ser un editor de puntos simple (no polígonos). Usa click para colocar puntos con categorías.

3. **Coordenadas** - El sistema usa coordenadas WGS84 (lat/lng). PostGIS almacena en GEOMETRY pero se convierte a GeoJSON para el frontend.

4. **Tile Layer** - Se usa Esri World Imagery para vista satelital:
   ```
   https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
   ```

5. **Filtro por equipo** - Implementado en el mapa principal para filtrar puntos (válvulas, antenas, sondas) por equipo de riego.

---

## Sesión de OpenCode (13-15 agosto 2026)

**Sesión anterior conocida:** `ses_02c897dc5ffeKjP5dUOcwU1Vlk` ("Revisión de aplicación solicitudes-riego") - Proyecto relacionado `usersusuarioprojectssiracusa-app`

**Trabajo realizado en mapa-siracusa (según commits):**
- 13 agosto: Filtro por equipo, reescritura del Georreferenciador como editor de puntos, botón AGREGAR PUNTO prominente
- 7 agosto: Simplificación a puntos, importación KMZ/Excel, controles Geoman

**Sesión del viernes 15 agosto:** No registrada en engram. Los cambios están en el stash de git.

---

*Documento generado automáticamente el 16/08/2026*
