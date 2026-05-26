import * as THREE from 'three';
import { AABB, createAABB } from '../utils/collision';
import { CABIN_H } from './ObservationRoom';
import {
  TOWER_ENTRY_CX,
  TOWER_ENTRY_CZ,
  TOWER_ENTRY_HALF,
  TOWER_ROOM_D,
  TOWER_CORRIDOR_HALF_X,
  TOWER_NORTH_WALL_Z,
} from './levelLayout';

const H = CABIN_H;
const T = 0.22;

export const TOWER_CENTER_X = TOWER_ENTRY_CX;
export const TOWER_CENTER_Z = TOWER_ENTRY_CZ;
export const TOWER_SIZE = TOWER_ENTRY_HALF * 2;

export function buildTowerColliders(): AABB[] {
  const cx = TOWER_ENTRY_CX;
  const cz = TOWER_ENTRY_CZ;
  const half = TOWER_ENTRY_HALF;
  const hd = TOWER_ROOM_D / 2;
  const wy = H / 2;
  const wh = H / 2;

  const walls: AABB[] = [];

  const northSeg = half - TOWER_CORRIDOR_HALF_X;
  walls.push(
    box(cx - half + northSeg / 2, wy, TOWER_NORTH_WALL_Z, northSeg / 2, wh, T)
  );
  walls.push(
    box(cx + half - northSeg / 2, wy, TOWER_NORTH_WALL_Z, northSeg / 2, wh, T)
  );

  const southGap = 1.2;
  walls.push(box(cx - southGap, wy, cz + hd, half - southGap - 0.1, wh, T));
  walls.push(box(cx + southGap, wy, cz + hd, half - southGap - 0.1, wh, T));
  walls.push(box(cx + half, wy, cz, T, wh, hd - 0.1));

  return walls;
}

function box(
  x: number,
  y: number,
  z: number,
  hw: number,
  hh: number,
  hd: number
): AABB {
  return createAABB(new THREE.Vector3(x, y, z), hw, hh, hd);
}
