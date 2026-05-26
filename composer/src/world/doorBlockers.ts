import * as THREE from 'three';
import { AABB, createAABB } from '../utils/collision';
import {
  CABIN_DOOR_X,
  CABIN_DOOR_HALF_Z,
  TOWER_DOOR_X,
  TOWER_DOOR_Z,
  TOWER_DOOR_HALF_Z,
} from './levelLayout';

export function buildCabinDoorBlocker(): AABB {
  return createAABB(
    new THREE.Vector3(CABIN_DOOR_X, 1.05, 0),
    0.12,
    1.05,
    CABIN_DOOR_HALF_Z
  );
}

export function buildTowerDoorBlocker(): AABB {
  return createAABB(
    new THREE.Vector3(TOWER_DOOR_X, 1.05, TOWER_DOOR_Z),
    0.1,
    1.05,
    TOWER_DOOR_HALF_Z
  );
}
