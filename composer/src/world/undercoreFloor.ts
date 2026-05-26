import { FloorZone } from './FloorZones';
import { UNDERCORE_CORRIDOR_HALF_W } from './undercoreColliders';

export function getUndercoreGroundY(x: number, z: number): number {
  const ramp = Math.max(0, z) * 0.012;
  const wobble = Math.sin(x * 0.4) * 0.02 + Math.sin(z * 0.15) * 0.03;
  return -0.05 + ramp + wobble;
}

/** Bounds = intérieur du couloir (clampToPlayBounds applique le rayon joueur) */
export function getUndercorePlayBounds() {
  const hw = UNDERCORE_CORRIDOR_HALF_W - 0.05;
  return {
    minX: -hw,
    maxX: hw,
    minZ: 1,
    maxZ: 46.5,
  };
}

export const undercoreFloorZone: FloorZone = {
  minX: -1.2,
  maxX: 1.2,
  minZ: 0,
  maxZ: 48,
  getGroundY: (x, z) => getUndercoreGroundY(x, z),
};
export const UNDERCORE_LOCATIONS = {
  badgeWall: { x: 0, z: 14 },
  crtRoom: { x: 0, z: 23 },
  corpseTable: { x: -0.8, z: 31 },
  organMass: { x: 0, z: 38 },
  mirror: { x: 0, z: 44 },
  terminal: { x: 0, z: 47 },
} as const;
