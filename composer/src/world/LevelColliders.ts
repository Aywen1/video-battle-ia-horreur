import * as THREE from 'three';
import { AABB, createAABB } from '../utils/collision';
import { buildCabinDoorBlocker } from './doorBlockers';
import { CABIN_H } from './ObservationRoom';
import { HALL_OX, HALL_END_X, HALL_HALF_Z } from './levelLayout';

const H = CABIN_H;
const T = 0.3;

export function buildHallwayColliders(): AABB[] {
  const walls: AABB[] = [];
  const hallLen = HALL_END_X - HALL_OX;
  const hallCx = HALL_OX + hallLen / 2;

  walls.push(box(hallCx, H / 2, HALL_HALF_Z + T / 2, hallLen / 2 + 0.25, H, T));
  walls.push(box(hallCx, H / 2, -HALL_HALF_Z - T / 2, hallLen / 2 + 0.25, H, T));
  walls.push(box(HALL_OX + T / 2, H / 2, -0.92, T, H, 0.35));
  walls.push(box(HALL_OX + T / 2, H / 2, 0.92, T, H, 0.35));

  return walls;
}

export { buildTowerDoorBlocker } from './doorBlockers';

export function buildDoorBlocker(): AABB {
  return buildCabinDoorBlocker();
}

function box(
  x: number,
  y: number,
  z: number,
  halfW: number,
  halfH: number,
  halfD: number
): AABB {
  return createAABB(new THREE.Vector3(x, y, z), halfW, halfH, halfD);
}
