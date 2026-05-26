import * as THREE from 'three';
import { COLORS, flatMetal, createCRTTexture } from '../materials';

export interface CRTMonitorResult {
  group: THREE.Group;
  screenMesh: THREE.Mesh;
}

/** Moniteur CRT avec bezel, menton et pied */
export function createCRTMonitor(
  crtTexture?: THREE.CanvasTexture,
  withStand = true
): CRTMonitorResult {
  const group = new THREE.Group();
  const tex = crtTexture ?? createCRTTexture();
  const bezelMat = flatMetal(0x2a323c);
  const screenMat = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: new THREE.Color(COLORS.crtGlow),
    emissiveIntensity: 0.35,
    flatShading: true,
  });

  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.68, 0.14),
    bezelMat
  );
  bezel.castShadow = true;
  group.add(bezel);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.48),
    screenMat
  );
  screen.position.set(0, 0.02, 0.075);
  screen.userData.isCRT = true;
  group.add(screen);

  const chin = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.06, 0.1),
    flatMetal(0x1e2530)
  );
  chin.position.set(0, -0.32, 0.04);
  group.add(chin);

  if (withStand) {
    const neck = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.2, 0.08),
      bezelMat
    );
    neck.position.set(0, -0.48, 0);
    group.add(neck);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.04, 0.28),
      bezelMat
    );
    base.position.set(0, -0.6, 0.04);
    base.castShadow = true;
    group.add(base);
  }

  return { group, screenMesh: screen };
}
