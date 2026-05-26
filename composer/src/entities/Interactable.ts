import * as THREE from 'three';

export interface Interactable {
  id: string;
  position: THREE.Vector3;
  radius: number;
  hint: string;
  onInteract: () => void;
  canInteract?: () => boolean;
}

/**
 * Détection généreuse : distance horizontale + bonus si l'objet est devant le joueur.
 */
export function findNearestInteractable(
  playerPos: THREE.Vector3,
  lookYaw: number,
  items: Interactable[]
): Interactable | null {
  let best: Interactable | null = null;
  let bestScore = Infinity;

  const fx = -Math.sin(lookYaw);
  const fz = -Math.cos(lookYaw);

  for (const item of items) {
    if (item.canInteract && !item.canInteract()) continue;

    const dx = item.position.x - playerPos.x;
    const dz = item.position.z - playerPos.z;
    const distXZ = Math.hypot(dx, dz);

    const reach = item.radius * 1.45;
    if (distXZ > reach) continue;

    let lookFactor = 1;
    if (distXZ > 0.05) {
      const dot = (dx * fx + dz * fz) / distXZ;
      if (dot > 0.5) lookFactor = 0.65;
      else if (dot > -0.15) lookFactor = 0.85;
      else lookFactor = 1.15;
    }

    const dy = Math.abs(item.position.y - playerPos.y);
    const score = distXZ * lookFactor + dy * 0.08;

    if (score < bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return best;
}
