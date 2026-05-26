/**
 * Helpers de matériaux "flat shading soigné" : on utilise MeshStandardMaterial
 * de Three.js pour bénéficier de tout le pipeline (lumières, fog, ombres) tout
 * en gardant un rendu low poly net via flatShading: true.
 *
 * Le shader vraiment custom est CRTScreenMaterial — réservé aux écrans.
 */
import { Color, MeshStandardMaterial, Side, Texture } from 'three';
import { PALETTE, PaletteKey } from '../../utils/palette';

export interface FlatLookOptions {
  color?: Color | string | number | PaletteKey;
  emissive?: Color | string | number | PaletteKey;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  map?: Texture | null;
  emissiveMap?: Texture | null;
  flatShading?: boolean;
  side?: Side;
  transparent?: boolean;
}

function resolveColor(input: FlatLookOptions['color']): Color {
  if (input instanceof Color) return input.clone();
  if (typeof input === 'string') {
    const fromPalette = (PALETTE as Record<string, string>)[input];
    return new Color(fromPalette ?? input);
  }
  if (typeof input === 'number') return new Color(input);
  return new Color(0xffffff);
}

export function flatToon(opts: FlatLookOptions = {}): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: resolveColor(opts.color),
    emissive: resolveColor(opts.emissive ?? 0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    roughness: opts.roughness ?? 0.9,
    metalness: opts.metalness ?? 0.0,
    map: opts.map ?? null,
    emissiveMap: opts.emissiveMap ?? null,
    flatShading: opts.flatShading ?? true,
    side: opts.side ?? undefined,
    transparent: opts.transparent ?? false,
  });
}
