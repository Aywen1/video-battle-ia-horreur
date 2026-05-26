import * as THREE from 'three';

export interface AABB {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export function createAABB(
  center: THREE.Vector3,
  halfWidth: number,
  halfHeight: number,
  halfDepth: number
): AABB {
  return {
    min: new THREE.Vector3(
      center.x - halfWidth,
      center.y - halfHeight,
      center.z - halfDepth
    ),
    max: new THREE.Vector3(
      center.x + halfWidth,
      center.y + halfHeight,
      center.z + halfDepth
    ),
  };
}

export function aabbIntersects(a: AABB, b: AABB): boolean {
  return (
    a.min.x <= b.max.x &&
    a.max.x >= b.min.x &&
    a.min.y <= b.max.y &&
    a.max.y >= b.min.y &&
    a.min.z <= b.max.z &&
    a.max.z >= b.min.z
  );
}

const EPS = 0.02;
const PASSES = 8;
const BODY_HALF_H = 0.5;
/** Décalage approximatif position.y (yeux) → centre du corps */
const EYE_TO_BODY = 0.75;

function playerBodyY(pos: THREE.Vector3): number {
  return Math.max(0.4, pos.y - EYE_TO_BODY);
}

function playerBox(pos: THREE.Vector3, radius: number): AABB {
  return createAABB(
    new THREE.Vector3(pos.x, playerBodyY(pos), pos.z),
    radius,
    BODY_HALF_H,
    radius
  );
}

function wallAffectsPlayer(wall: AABB, bodyY: number): boolean {
  const feet = bodyY - BODY_HALF_H;
  const head = bodyY + BODY_HALF_H;
  return wall.max.y >= feet + 0.15 && wall.min.y <= head + 0.5;
}

function resolveAxis(
  pos: THREE.Vector3,
  radius: number,
  wall: AABB,
  axis: 'x' | 'z',
  moveX: number,
  moveZ: number
): void {
  const box = playerBox(pos, radius);
  if (!aabbIntersects(box, wall)) return;

  if (axis === 'x') {
    const pushLeft = box.max.x - wall.min.x;
    const pushRight = wall.max.x - box.min.x;
    if (Math.abs(pushLeft - pushRight) < 0.02) {
      pos.x += moveX >= 0 ? pushRight + EPS : -(pushLeft + EPS);
    } else if (pushLeft < pushRight) {
      pos.x -= pushLeft + EPS;
    } else {
      pos.x += pushRight + EPS;
    }
  } else {
    const pushBack = box.max.z - wall.min.z;
    const pushFront = wall.max.z - box.min.z;
    if (Math.abs(pushBack - pushFront) < 0.02) {
      pos.z += moveZ >= 0 ? pushFront + EPS : -(pushBack + EPS);
    } else if (pushBack < pushFront) {
      pos.z -= pushBack + EPS;
    } else {
      pos.z += pushFront + EPS;
    }
  }
}

function resolveStep(
  pos: THREE.Vector3,
  radius: number,
  walls: AABB[],
  moveX: number,
  moveZ: number
): void {
  const bodyY = playerBodyY(pos);
  for (let pass = 0; pass < PASSES; pass++) {
    for (const axis of ['x', 'z'] as const) {
      for (const wall of walls) {
        if (!wallAffectsPlayer(wall, bodyY)) continue;
        resolveAxis(pos, radius, wall, axis, moveX, moveZ);
      }
    }
  }
}

/**
 * Déplacement avec sous-pas + résolution directionnelle.
 */
export function moveAndCollide(
  pos: THREE.Vector3,
  deltaX: number,
  deltaZ: number,
  radius: number,
  walls: AABB[]
): void {
  const dist = Math.hypot(deltaX, deltaZ);
  if (dist < 1e-6) return;

  const maxStep = radius * 0.45;
  const steps = Math.max(1, Math.ceil(dist / maxStep));
  const sx = deltaX / steps;
  const sz = deltaZ / steps;

  for (let i = 0; i < steps; i++) {
    pos.x += sx;
    pos.z += sz;
    resolveStep(pos, radius, walls, sx, sz);
  }
}

/**
 * Sort le joueur d'un mur s'il chevauche après changement de colliders.
 */
export function depenetrate(
  pos: THREE.Vector3,
  radius: number,
  walls: AABB[]
): void {
  for (let attempt = 0; attempt < 12; attempt++) {
    let pushed = false;
    const bodyY = playerBodyY(pos);
    const box = playerBox(pos, radius);
    for (const wall of walls) {
      if (!wallAffectsPlayer(wall, bodyY)) continue;
      if (!aabbIntersects(box, wall)) continue;

      const pushLeft = box.max.x - wall.min.x;
      const pushRight = wall.max.x - box.min.x;
      const pushBack = box.max.z - wall.min.z;
      const pushFront = wall.max.z - box.min.z;
      const minPush = Math.min(pushLeft, pushRight, pushBack, pushFront);

      if (minPush === pushLeft) pos.x -= pushLeft + EPS;
      else if (minPush === pushRight) pos.x += pushRight + EPS;
      else if (minPush === pushBack) pos.z -= pushBack + EPS;
      else pos.z += pushFront + EPS;

      pushed = true;
      break;
    }
    if (!pushed) break;
  }
}
