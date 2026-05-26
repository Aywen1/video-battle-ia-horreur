import * as THREE from 'three';
import { COLORS, flatMetal } from './materials';
import { AABB, createAABB } from '../utils/collision';
import { CABIN_D, CABIN_H, CABIN_W } from './ObservationRoom';

const H = CABIN_H;
const W = CABIN_W;
const D = CABIN_D;

const WALL_THICK_VIS = 0.22;

export interface CabinWallsResult {
  colliders: AABB[];
}

/**
 * Périmètre fermé de la cabine :
 * - Nord (-Z) : vitre (mur plein côté collision)
 * - Sud (+Z) : mur derrière le spawn
 * - Ouest (-X) : mur gauche
 * - Est (+X) : 2 segments + linteau (ouverture porte z ∈ [-0.7, 0.7])
 */
export function buildCabinWalls(scene: THREE.Scene): CabinWallsResult {
  const colliders: AABB[] = [];
  const mat = flatMetal(COLORS.wall);

  const addWall = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push(
      createAABB(
        new THREE.Vector3(x, y, z),
        sx / 2 + 0.04,
        sy / 2,
        sz / 2 + 0.04
      )
    );
  };

  // Nord — façade vitrée (mur plein)
  addWall(0, H / 2, -D / 2, W, H, WALL_THICK_VIS);

  // Sud — derrière le point de spawn (z positif)
  addWall(0, H / 2, D / 2, W, H, WALL_THICK_VIS);

  // Ouest — mur gauche
  addWall(-W / 2, H / 2, 0, WALL_THICK_VIS, H, D);

  // Est — porte au centre (ouverture ~1.4 m)
  const doorHalfGap = 0.7;
  const segDepth = (D - doorHalfGap * 2) / 2;
  const segZNorth = -(doorHalfGap + segDepth / 2);
  const segZSouth = doorHalfGap + segDepth / 2;

  addWall(W / 2, H / 2, segZNorth, WALL_THICK_VIS, H, segDepth);
  addWall(W / 2, H / 2, segZSouth, WALL_THICK_VIS, H, segDepth);
  addWall(W / 2, H * 0.88, 0, WALL_THICK_VIS, H * 0.4, doorHalfGap * 2 + 0.2);

  // Coins ouest (jonction murs nord/sud/ouest)
  const cornerS = WALL_THICK_VIS;
  addWall(-W / 2, H / 2, -D / 2, cornerS, H, cornerS);
  addWall(-W / 2, H / 2, D / 2, cornerS, H, cornerS);

  // Console — face avant uniquement
  colliders.push(
    createAABB(new THREE.Vector3(0, 0.55, -1.72), 1.0, 0.5, 0.2)
  );

  return { colliders };
}
