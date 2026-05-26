import * as THREE from 'three';
import { flatMetal } from '../materials';

/** Casque de sécurité low poly */
export function createHelmet(): THREE.Group {
  const group = new THREE.Group();
  const shell = flatMetal(0xffcc44);
  const dark = flatMetal(0x3d4a5c);
  const visor = new THREE.MeshStandardMaterial({
    color: 0x2a3848,
    transparent: true,
    opacity: 0.75,
    flatShading: true,
    metalness: 0.4,
    roughness: 0.3,
  });

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
    shell
  );
  dome.position.y = 0.12;
  group.add(dome);

  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.24, 0.05, 8),
    shell
  );
  brim.position.y = 0.02;
  group.add(brim);

  const visorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.1, 0.14),
    visor
  );
  visorMesh.position.set(0, 0.08, 0.1);
  group.add(visorMesh);

  const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), dark);
  strapL.position.set(-0.14, -0.02, 0);
  const strapR = strapL.clone();
  strapR.position.x = 0.14;
  group.add(strapL, strapR);

  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.2), dark);
  crest.position.set(0, 0.2, -0.02);
  group.add(crest);

  return group;
}
