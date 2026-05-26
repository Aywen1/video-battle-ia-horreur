import * as THREE from 'three';
import { flatMetal } from '../materials';

export function createFigure(height = 1.85): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 1.1, 0.28),
    flatMetal(0x0a0c10)
  );
  body.position.y = 0.55;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.32, 0.32),
    flatMetal(0x151820)
  );
  head.position.y = 1.35;
  g.add(body, head);
  return g;
}
