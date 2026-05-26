import * as THREE from 'three';
import { COLORS, flatMetal } from '../materials';

export interface ServerRackResult {
  group: THREE.Group;
  door: THREE.Mesh;
  ledMaterials: THREE.MeshStandardMaterial[];
}

export function createServerRack(): ServerRackResult {
  const group = new THREE.Group();
  const ledMaterials: THREE.MeshStandardMaterial[] = [];
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 2.0, 0.7),
    flatMetal(COLORS.metalDark)
  );
  frame.position.y = 1;
  group.add(frame);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 1.9, 0.06),
    flatMetal(COLORS.metal)
  );
  door.position.set(0, 1, 0.36);
  group.add(door);

  for (let i = 0; i < 4; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? COLORS.crtGlow : COLORS.beacon,
      emissive: i % 2 === 0 ? COLORS.crtGlow : COLORS.beacon,
      emissiveIntensity: 0.8,
      flatShading: true,
    });
    ledMaterials.push(mat);
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.02),
      mat
    );
    led.position.set(-0.3 + i * 0.2, 1.6 - i * 0.15, 0.38);
    group.add(led);
  }

  return { group, door, ledMaterials };
}
