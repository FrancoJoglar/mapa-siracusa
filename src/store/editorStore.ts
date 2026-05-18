import { create } from "zustand";

export interface GeometryState {
  geojson: GeoJSON.Feature | null;
  isValid: boolean;
  errors: string[];
  setGeojson: (geojson: GeoJSON.Feature) => void;
  setValid: (valid: boolean, errors: string[]) => void;
  reset: () => void;
}

export const useGeometryStore = create<GeometryState>((set) => ({
  geojson: null,
  isValid: false,
  errors: [],
  setGeojson: (geojson) => set({ geojson }),
  setValid: (isValid, errors) => set({ isValid, errors }),
  reset: () => set({ geojson: null, isValid: false, errors: [] }),
}));
