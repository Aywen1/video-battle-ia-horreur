import * as THREE from 'three';
import { COLORS, flatMetal } from '../materials';

/** Chaise low poly avec 4 pieds — peut pivoter (horror) */
export function createChair(): THREE.Group {
  const chair = new THREE.Group();
  const mat = flatMetal(COLORS.rust);
  const legMat = flatMetal(COLORS.metalDark);

  const legH = 0.46;
  const legGeo = new THREE.BoxGeometry(0.05, legH, 0.05);
  const offsets = [
    [-0.22, legH / 2, -0.22],
    [0.22, legH / 2, -0.22],
    [-0.22, legH / 2, 0.22],
    [0.22, legH / 2, 0.22],
  ];
  for (const [x, y, z] of offsets) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, y, z);
    leg.castShadow = true;
    chair.add(leg);
  }

  const stretcher = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.04, 0.04),
    legMat
  );
  stretcher.position.set(0, 0.12, 0);
  chair.add(stretcher);
  const stretcher2 = stretcher.clone();
  stretcher2.rotation.y = Math.PI / 2;
  stretcher2.scale.set(1, 1, 0.88 / 0.5);
  chair.add(stretcher2);

  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.08, 0.55),
    mat
  );
  seat.position.y = legH + 0.04;
  seat.castShadow = true;
  chair.add(seat);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.5, 0.08),
    mat
  );
  back.position.set(0, legH + 0.32, -0.24);
  back.rotation.x = -0.08;
  back.castShadow = true;
  chair.add(back);

  return chair;
}
