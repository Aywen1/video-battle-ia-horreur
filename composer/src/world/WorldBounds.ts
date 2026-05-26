import * as THREE from 'three';
import {
  TOWER_ENTRY_CX,
  TOWER_ENTRY_HALF,
  HALL_END_X,
  HALL_OX,
} from './levelLayout';
import { SERVER_CX } from './serverColliders';
import { getUndercorePlayBounds } from './undercoreFloor';

export interface PlayBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const PAD = 0.32;

export function clampToPlayBounds(
  pos: THREE.Vector3,
  bounds: PlayBounds
): void {
  pos.x = THREE.MathUtils.clamp(
    pos.x,
    bounds.minX + PAD,
    bounds.maxX - PAD
  );
  pos.z = THREE.MathUtils.clamp(
    pos.z,
    bounds.minZ + PAD,
    bounds.maxZ - PAD
  );
}

export function getCabinBounds(): PlayBounds {
  return { minX: -4.85, maxX: 4.85, minZ: -3.85, maxZ: 3.85 };
}

/** Couloir + tour — une seule zone large (évite les blocages au changement de phase) */
export function getHallAndTowerBounds(): PlayBounds {
  return {
    minX: HALL_OX - 0.5,
    maxX: TOWER_ENTRY_CX + TOWER_ENTRY_HALF - 0.15,
    minZ: -2.6,
    maxZ: 1.35,
  };
}

export function getHallwayBounds(): PlayBounds {
  return getHallAndTowerBounds();
}

export function getTowerBounds(): PlayBounds {
  return getHallAndTowerBounds();
}

export function getServerBounds(): PlayBounds {
  return {
    minX: HALL_END_X,
    maxX: SERVER_CX + 9.5,
    minZ: -14.5,
    maxZ: 2,
  };
}

export function getExteriorBounds(): PlayBounds {
  return { minX: -35, maxX: 35, minZ: -42, maxZ: 55 };
}

export function getUndercoreBounds(): PlayBounds {
  return getUndercorePlayBounds();
}

export function getBoundsForPhase(phase: string): PlayBounds {
  switch (phase) {
    case 'cabin':
      return getCabinBounds();
    case 'hallway':
    case 'tower':
      return getHallAndTowerBounds();
    case 'server':
    case 'finale':
      return getServerBounds();
    case 'exterior':
    case 'exterior_night':
    case 'exterior_finale':
      return getExteriorBounds();
    case 'undercore':
    case 'undercore_finale':
      return getUndercoreBounds();
    default:
      return getHallAndTowerBounds();
  }
}
