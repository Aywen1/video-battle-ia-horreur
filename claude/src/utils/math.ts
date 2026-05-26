/**
 * Petites maths d'usage courant. Three.MathUtils en a déjà beaucoup ;
 * on ajoute ici ce qui manque et ce qui est utile à la lisibilité du gameplay.
 */

export const TAU = Math.PI * 2;

export function clamp(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Lerp framerate-independent. `rate` = "moitié du chemin en X secondes". */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Bruit pseudo-aléatoire déterministe à partir d'un entier (Mulberry32). */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Renvoie une valeur d'instabilité (-1..1) à partir d'un sourire normalisé 0..1. */
export function instabilityFromSmile(smile01: number): number {
  return 1 - clamp(smile01, 0, 1);
}
