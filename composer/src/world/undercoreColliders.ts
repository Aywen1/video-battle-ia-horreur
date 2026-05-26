import * as THREE from 'three';
import { AABB, createAABB } from '../utils/collision';

/** Demi-largeur intérieure du couloir (entre les deux murs) */
export const UNDERCORE_CORRIDOR_HALF_W = 0.95;
const WALL_T = 0.12;

/** Couloir étroit sous la balise — ~1,9 m jouables au centre */
export function buildUndercoreColliders(): AABB[] {
  const walls: AABB[] = [];
  const inner = UNDERCORE_CORRIDOR_HALF_W;

  walls.push(
    createAABB(
      new THREE.Vector3(-inner - WALL_T / 2, 1.5, 22),
      WALL_T / 2,
      2.5,
      48
    )
  );
  walls.push(
    createAABB(
      new THREE.Vector3(inner + WALL_T / 2, 1.5, 22),
      WALL_T / 2,
      2.5,
      48
    )
  );
  walls.push(createAABB(new THREE.Vector3(0, 1.5, 0.5), inner + 0.3, 2.5, 0.12));
  walls.push(createAABB(new THREE.Vector3(0, 1.5, 47), inner + 0.3, 2.5, 0.12));

  // Props sur le côté — ne bloquent pas le centre du couloir
  walls.push(createAABB(new THREE.Vector3(-0.75, 0.9, 31), 0.55, 0.45, 0.55));
  walls.push(createAABB(new THREE.Vector3(0, 1.1, 38.2), 0.65, 1.2, 0.7));

  return walls;
}