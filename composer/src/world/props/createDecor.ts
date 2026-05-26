import * as THREE from 'three';
import { emissiveNeon, COLORS } from '../materials';

export function createNeonTube(
  length: number,
  color = COLORS.neonCyan
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.07, 0.1),
    emissiveNeon(color, 1.4)
  );
  return mesh;
}

export function createSignPanel(
  text: string,
  bg = '#c41e1e',
  w = 0.9,
  h = 0.28
): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 40);
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.05),
    new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0xffffff,
      emissiveIntensity: 0.15,
      flatShading: true,
    })
  );
}

export function createExtinguisher(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 0.55, 6),
    new THREE.MeshStandardMaterial({ color: COLORS.warningRed, flatShading: true })
  );
  body.position.y = 0.55;
  const label = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.2, 0.02),
    new THREE.MeshStandardMaterial({ color: COLORS.safetyYellow, flatShading: true })
  );
  label.position.set(0, 0.5, 0.1);
  g.add(body, label);
  return g;
}

export function createCableBundle(colors: number[], length = 1.2): THREE.Group {
  const g = new THREE.Group();
  colors.forEach((c, i) => {
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, length, 4),
      new THREE.MeshStandardMaterial({ color: c, flatShading: true })
    );
    cable.rotation.z = (i - 1) * 0.15;
    cable.position.x = (i - 1) * 0.06;
    cable.position.y = length / 2;
    g.add(cable);
  });
  return g;
}
