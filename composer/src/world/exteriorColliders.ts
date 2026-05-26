import * as THREE from 'three';
import { AABB, createAABB } from '../utils/collision';

const CLIFF_Z = -32;
const ROAD_HALF = 3;

/** Colliders extérieur — bords carte, falaise, bâtiment, fin de route. Pas de murs sur le sentier / la pente. */
export function buildExteriorColliders(): AABB[] {
  const walls: AABB[] = [];

  walls.push(createAABB(new THREE.Vector3(0, 1, CLIFF_Z), 35, 2, 1.5));
  walls.push(createAABB(new THREE.Vector3(-35, 1, 6), 1, 2, 50));
  walls.push(createAABB(new THREE.Vector3(35, 1, 6), 1, 2, 50));
  walls.push(createAABB(new THREE.Vector3(0, 1, 55), 35, 2, 1));

  walls.push(createAABB(new THREE.Vector3(0, 2, -8), 5.5, 2.5, 3.5));

  // Bord est de la route seulement — le côté ouest reste ouvert vers le sentier (x ≈ -10…-22)
  walls.push(createAABB(new THREE.Vector3(ROAD_HALF + 2, 1, 24), 1, 2, 48));

  walls.push(createAABB(new THREE.Vector3(0, 1.2, 50.5), 4, 1.5, 0.5));

  // Cabane : collider serré sur les murs, pas sur le sentier
  walls.push(createAABB(new THREE.Vector3(-18, 1.5, 14), 2.2, 2.5, 2.2));

  return walls;
}

export { CLIFF_Z, ROAD_HALF };
