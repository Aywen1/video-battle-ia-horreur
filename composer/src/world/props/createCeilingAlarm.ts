import * as THREE from 'three';
import { COLORS, flatMetal } from '../materials';

export interface CeilingAlarmResult {
  group: THREE.Group;
  light: THREE.PointLight;
  update: (t: number) => void;
}

/** Alarme industrielle fixée au plafond — gyrophare rotatif */
export function createCeilingAlarm(
  ceilingY: number,
  position: THREE.Vector3
): CeilingAlarmResult {
  const group = new THREE.Group();
  group.position.copy(position);
  group.position.y = ceilingY - 0.08;

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.04, 0.35),
    flatMetal(COLORS.metalDark)
  );
  plate.position.y = 0.02;
  group.add(plate);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.16, 0.22, 6),
    flatMetal(COLORS.metal)
  );
  body.position.y = -0.1;
  group.add(body);

  const grill = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.06, 0.2),
    flatMetal(0x1a202c)
  );
  grill.position.y = -0.22;
  group.add(grill);

  const beaconPivot = new THREE.Group();
  beaconPivot.position.y = -0.08;

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: COLORS.beacon,
      emissive: COLORS.beacon,
      emissiveIntensity: 1.4,
      flatShading: true,
    })
  );
  dome.rotation.x = Math.PI;
  beaconPivot.add(dome);

  const light = new THREE.PointLight(COLORS.beacon, 0.6, 6);
  light.position.set(0, -0.05, 0);
  beaconPivot.add(light);
  group.add(beaconPivot);

  const update = (t: number) => {
    beaconPivot.rotation.y = t * 1.8;
    light.intensity = 0.45 + Math.sin(t * 6) * 0.2;
  };

  return { group, light, update };
}
