import * as THREE from 'three';
import { AABB, createAABB } from '../utils/collision';
import { CABIN_H } from './ObservationRoom';
import {
  SERVER_ENTRANCE_X,
  SERVER_ENTRANCE_Z,
  SERVER_ENTRANCE_HALF_Z,
} from './levelLayout';

const H = CABIN_H;
const T = 0.28;
export const SERVER_CX = 28;
export const SERVER_CZ = -8;
export const SERVER_W = 18;
export const SERVER_D = 14;

export function buildServerColliders(): AABB[] {
  const cx = SERVER_CX;
  const cz = SERVER_CZ;
  const hw = SERVER_W / 2;
  const hd = SERVER_D / 2;
  const wy = H / 2;
  const wh = H / 2;

  const walls: AABB[] = [];
  walls.push(box(cx, wy, cz - hd, hw, wh, T));
  walls.push(box(cx, wy, cz + hd, hw, wh, T));

  const doorGapHalf = 1.05;
  const doorZ = cz + 0.5;
  const eastX = cx + hw;
  const southLen = doorZ - doorGapHalf - (cz - hd);
  if (southLen > 0.15) {
    walls.push(
      box(
        eastX,
        wy,
        (cz - hd + doorZ - doorGapHalf) / 2,
        T,
        wh,
        southLen / 2
      )
    );
  }
  const northLen = cz + hd - (doorZ + doorGapHalf);
  if (northLen > 0.15) {
    walls.push(
      box(
        eastX,
        wy,
        (doorZ + doorGapHalf + cz + hd) / 2,
        T,
        wh,
        northLen / 2
      )
    );
  }

  const westX = cx - hw;
  const gapHalf = SERVER_ENTRANCE_HALF_Z;
  const gapMin = SERVER_ENTRANCE_Z - gapHalf;
  const gapMax = SERVER_ENTRANCE_Z + gapHalf;
  const northMin = cz - hd;
  const southMax = cz + hd;

  if (gapMin > northMin) {
    walls.push(
      box(westX, wy, (northMin + gapMin) / 2, T, wh, (gapMin - northMin) / 2)
    );
  }
  if (gapMax < southMax) {
    walls.push(
      box(westX, wy, (gapMax + southMax) / 2, T, wh, (southMax - gapMax) / 2)
    );
  }

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
