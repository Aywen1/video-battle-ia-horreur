/** Zones qui ajustent la hauteur du sol sous le joueur (escaliers, paliers) */
export interface FloorZone {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  getGroundY: (x: number, z: number) => number;
}

export function sampleGroundY(
  x: number,
  z: number,
  zones: FloorZone[],
  defaultY = 0
): number {
  let best = defaultY;
  for (const zone of zones) {
    if (x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) {
      const y = zone.getGroundY(x, z);
      if (y > best) best = y;
    }
  }
  return best;
}

/** Rampe d'escalier linéaire */
export function stairRampY(
  x: number,
  startX: number,
  endX: number,
  topY: number
): number {
  const t = Math.max(0, Math.min(1, (x - startX) / (endX - startX)));
  return topY * t;
}
