/**
 * Palette imposée par .cursorrules — toutes les couleurs du jeu passent par ici.
 * Les valeurs hex sont aussi exposées en composantes 0..1 pour les shaders.
 */
import { Color } from 'three';

export const PALETTE = {
  yellow: '#FFD23F',
  red: '#C8102E',
  blue: '#5BC0EB',
  green: '#9BC53D',
  magenta: '#E63DA2',
  cream: '#F4E9D8',
  charcoal: '#1C1B1A',
  // Demi-teintes utiles (dérivées par assombrissement, restent dans la famille palette)
  yellowDim: '#A4831F',
  redDim: '#6B0B19',
  magentaDim: '#7A1F58',
  blueDim: '#2C6585',
} as const;

export type PaletteKey = keyof typeof PALETTE;

const _cache = new Map<string, Color>();
export function color(key: PaletteKey | string): Color {
  const hex = (PALETTE as Record<string, string>)[key] ?? key;
  let c = _cache.get(hex);
  if (!c) {
    c = new Color(hex);
    _cache.set(hex, c);
  }
  return c.clone();
}
