import * as THREE from 'three';
import { getTerrainHeight, lerpPathX } from './exteriorTerrain';
import { ParticleManager } from '../rendering/ParticleManager';

export function bloodDecalMaterial(): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1a0808';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 35; i++) {
    ctx.fillStyle = `rgb(${80 + Math.random() * 80},${8 + Math.random() * 20},${8 + Math.random() * 15})`;
    const rx = 8 + Math.random() * 40;
    const ry = 6 + Math.random() * 30;
    ctx.beginPath();
    ctx.ellipse(Math.random() * 128, Math.random() * 128, rx, ry, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xaa2222,
    roughness: 0.95,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
}

export function buildTrailBloodDecals(parent: THREE.Group): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  const mat = bloodDecalMaterial();
  for (let z = 13; z <= 28; z += 3) {
    const x = lerpPathX(z) + (Math.random() - 0.5) * 0.8;
    const y = getTerrainHeight(x, z) + 0.04;
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.4 + Math.random(), 1.2 + Math.random()), mat);
    decal.rotation.x = -Math.PI / 2;
    decal.rotation.z = Math.random() * Math.PI;
    decal.position.set(x, y, z);
    parent.add(decal);
    meshes.push(decal);
  }
  return meshes;
}

export function buildBloodPoolMesh(): THREE.Mesh {
  const mat = bloodDecalMaterial();
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.1, 12), mat);
  pool.rotation.x = -Math.PI / 2;
  return pool;
}

export function spawnBloodBurst(particles: ParticleManager | null, pos: THREE.Vector3): void {
  if (!particles) return;
  particles.spawnBurst(pos, 20, 0x8a1010);
}

export function registerBloodDripEmitter(particles: ParticleManager, origin: THREE.Vector3): void {
  particles.addEmitter({
    id: 'bloodDrip',
    position: origin.clone(),
    count: 40,
    color: 0x8a1515,
    size: 0.06,
    speed: 0.8,
    gravity: -4,
    spread: new THREE.Vector3(8, 0.5, 14),
    additive: false,
    mode: 'rain',
    active: false,
  });
}

export function setBloodDripActive(particles: ParticleManager | null, active: boolean): void {
  particles?.setEmitterActive('bloodDrip', active);
}
