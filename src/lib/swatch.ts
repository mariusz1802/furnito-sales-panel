/**
 * Paleta tapicerska — każdy klient dostaje swoją "próbkę tkaniny"
 * (deterministycznie ze slug/nazwy). To sygnatura wizualna panelu.
 */
export const FABRIC_SWATCHES = [
  { name: "Loden", hex: "#4b6a4e" },
  { name: "Cegła", hex: "#a6532e" },
  { name: "Denim", hex: "#40566e" },
  { name: "Musztarda", hex: "#c0892e" },
  { name: "Bakłażan", hex: "#6b4a5e" },
  { name: "Szałwia", hex: "#8aa07e" },
  { name: "Piasek", hex: "#c1a878" },
  { name: "Grafit", hex: "#4a4a46" },
  { name: "Terakota", hex: "#b56a4a" },
  { name: "Morska", hex: "#3f6f6a" },
] as const;

export function swatchFor(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return FABRIC_SWATCHES[hash % FABRIC_SWATCHES.length];
}
