import * as THREE from 'three';
import { flatMetal } from './materials';
import { ParticleManager } from '../rendering/ParticleManager';

export function buildTreelineSilhouette(): THREE.Group {
  const group = new THREE.Group();
  group.visible = false;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.8, 0.3),
    flatMetal(0x050608)
  );
  body.position.y = 0.9;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.35, 0.35),
    flatMetal(0x0a0c10)
  );
  head.position.y = 2;
  group.add(body, head);
  return group;
}

export function buildMirageRelay(): THREE.Group {
  const group = new THREE.Group();
  group.visible = false;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(10, 3.5, 7),
    flatMetal(0x4a5568)
  );
  body.position.y = 1.75;
  group.add(body);
  for (let i = 0; i < 4; i++) {
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 0.8),
      new THREE.MeshStandardMaterial({
        color: 0x8899aa,
        emissive: 0xffcc66,
        emissiveIntensity: 0.8,
      })
    );
    win.position.set(-2.5 + i * 1.6, 1.8, 3.51);
    group.add(win);
  }
  return group;
}

export function spawnFootprintBurst(
  particles: ParticleManager | null,
  pos: THREE.Vector3
): void {
  if (!particles) return;
  particles.spawnBurst(pos, 12, 0x3a3028);
}

export function updateMirageOpacity(
  mirage: THREE.Group,
  playerPos: THREE.Vector3,
  visible: boolean
): void {
  mirage.visible = visible;
  if (!visible) return;
  const dist = playerPos.distanceTo(mirage.position);
  const opacity = THREE.MathUtils.clamp(1 - (dist - 15) / 25, 0.15, 0.85);
  mirage.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
      child.material.transparent = true;
      child.material.opacity = opacity;
    }
  });
}
