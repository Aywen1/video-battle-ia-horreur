import * as THREE from 'three';
import { FloorZone } from './FloorZones';
import { grassMaterial } from './materialsRealistic';

export const TERRAIN_SIZE = 90;
export const TERRAIN_CENTER_Z = 6;

function hash(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(a, b, ux),
    THREE.MathUtils.lerp(c, d, ux),
    uz
  );
}

/** Hauteur du sol en y=0 référence */
export function getTerrainHeight(x: number, z: number): number {
  const n =
    smoothNoise(x * 0.08, z * 0.08) * 0.35 +
    smoothNoise(x * 0.2, z * 0.2) * 0.12;

  let mountain = 0;
  if (x < -6 && z > -2) {
    const tX = THREE.MathUtils.clamp((-6 - x) / 22, 0, 1);
    const tZ = THREE.MathUtils.clamp((z - 5) / 38, 0, 1);
    mountain = tX * tX * tZ * 4.2;
  }

  let path = 0;
  const pathDist = Math.hypot(x - lerpPathX(z), z - z);
  if (z > 10 && z < 32 && x < -5) {
    const onPath = Math.exp(-pathDist * pathDist * 0.08);
    path = onPath * 0.6;
  }

  return n + mountain + path;
}

function lerpPathX(z: number): number {
  if (z <= 12) return -10 + (z - 12) * 0.05;
  if (z <= 28) return -10 + ((z - 12) / 16) * (-22 + 10);
  return -22;
}

export { lerpPathX };

export function isOnMountainPath(x: number, z: number): boolean {
  return z > 10 && z < 32 && x < -5 && Math.abs(x - lerpPathX(z)) < 2.5;
}

export const exteriorFloorZone: FloorZone = {
  minX: -35,
  maxX: 35,
  minZ: -42,
  maxZ: 55,
  getGroundY: (x, z) => getTerrainHeight(x, z),
};

export function buildTerrainMesh(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 48, 48);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const wx = lx;
    const wz = lz + TERRAIN_CENTER_Z;
    pos.setY(i, getTerrainHeight(wx, wz));
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, grassMaterial());
  mesh.position.set(0, 0, TERRAIN_CENTER_Z);
  mesh.receiveShadow = true;
  return mesh;
}

/** Positions clés mission extérieur */
export const EXTERIOR_LOCATIONS = {
  marker: new THREE.Vector3(0, 0, 12),
  wreck: new THREE.Vector3(6, 0, 18),
  trailSign: new THREE.Vector3(-8, 0, 12),
  trailEntry: new THREE.Vector3(-10, 0, 12),
  bloodPool: new THREE.Vector3(-12, 0, 16),
  hangingBody: new THREE.Vector3(-16, 0, 22),
  cross: new THREE.Vector3(-22, 0, 28),
  shack: new THREE.Vector3(-18, 0, 14),
  relayBox: new THREE.Vector3(-4, 0, 5),
  buildingDoor: new THREE.Vector3(0, 0, -4),
  roadNorth: new THREE.Vector3(0, 0, 42),
  barrier: new THREE.Vector3(0, 0, 50),
} as const;

export function getNextWaypoint(step: number): THREE.Vector3 | null {
  switch (step) {
    case 2:
      return EXTERIOR_LOCATIONS.trailSign;
    case 3:
      return EXTERIOR_LOCATIONS.bloodPool;
    case 4:
      return EXTERIOR_LOCATIONS.hangingBody;
    case 5:
      return EXTERIOR_LOCATIONS.cross;
    case 6:
    case 7:
      return EXTERIOR_LOCATIONS.shack;
    case 8:
    case 9:
      return EXTERIOR_LOCATIONS.relayBox;
    case 10:
      return EXTERIOR_LOCATIONS.buildingDoor;
    case 11:
    case 12:
      return EXTERIOR_LOCATIONS.barrier;
    default:
      return null;
  }
}
