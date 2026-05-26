import * as THREE from 'three';
import { bloodDecalMaterial } from './exteriorBlood';
import { getUndercoreGroundY } from './undercoreFloor';

export function fleshMaterial(color = 0x6a2830): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0.05,
    emissive: 0x2a0808,
    emissiveIntensity: 0.15,
  });
}

export function buildCorridorBloodDecals(parent: THREE.Group, count = 18): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  const mat = bloodDecalMaterial();
  for (let i = 0; i < count; i++) {
    const z = 2 + i * 2.4 + Math.random() * 0.5;
    const x = (Math.random() - 0.5) * 1.4;
    const y = getUndercoreGroundY(x, z) + 0.03;
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9 + Math.random() * 0.6, 0.8 + Math.random() * 0.5),
      mat
    );
    decal.rotation.x = -Math.PI / 2;
    decal.rotation.z = Math.random() * Math.PI;
    decal.position.set(x, y, z);
    parent.add(decal);
    meshes.push(decal);
  }
  return meshes;
}

export function buildCorpseProp(): THREE.Group {
  const g = new THREE.Group();
  const table = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.15, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 0.9 })
  );
  table.position.y = 0.75;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.35, 1.6),
    fleshMaterial(0x5a2028)
  );
  body.position.set(0, 1.0, 0);
  body.rotation.z = 0.08;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    fleshMaterial(0x4a1818)
  );
  head.position.set(0.1, 1.15, 0.75);
  const stain = new THREE.Mesh(
    new THREE.CircleGeometry(0.8, 10),
    bloodDecalMaterial()
  );
  stain.rotation.x = -Math.PI / 2;
  stain.position.set(0, 0.76, 0);
  g.add(table, body, head, stain);
  return g;
}

export function buildOrganMass(): THREE.Group {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 10, 8),
    fleshMaterial(0x7a2830)
  );
  core.scale.set(1.2, 0.9, 1.1);
  core.position.y = 1.1;
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.06, 2.4, 5),
    new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.6, roughness: 0.4 })
  );
  antenna.position.y = 2.6;
  for (let i = 0; i < 6; i++) {
    const vein = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.05, 0.8 + Math.random() * 0.5, 4),
      fleshMaterial(0x5a1818)
    );
    const a = (i / 6) * Math.PI * 2;
    vein.position.set(Math.cos(a) * 0.9, 0.9, Math.sin(a) * 0.9);
    vein.rotation.set(Math.random(), Math.random(), Math.random());
    g.add(vein);
  }
  g.add(core, antenna);
  return g;
}

export function buildMirrorFigure(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.1, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 })
  );
  body.position.y = 0.9;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.38, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x2a2020, roughness: 0.9 })
  );
  head.position.y = 1.55;
  const eyeL = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.04, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xf0f0f0, emissive: 0xffffff, emissiveIntensity: 0.8 })
  );
  eyeL.position.set(-0.08, 1.58, 0.16);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.08;
  g.add(body, head, eyeL, eyeR);
  return g;
}
