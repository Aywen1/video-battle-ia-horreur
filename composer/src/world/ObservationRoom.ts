import * as THREE from 'three';
import {
  COLORS,
  flatMetal,
  paintedWall,
  wetGlass,
  createCRTTexture,
  createStormSkyTexture,
  createRainGlassTexture,
  updateRainGlass,
  emissiveNeon,
} from './materials';
import { Interactable } from '../entities/Interactable';
import { createChair } from './props/createChair';
import { createCRTMonitor } from './props/createCRTMonitor';
import { createCeilingAlarm, CeilingAlarmResult } from './props/createCeilingAlarm';
import { createHelmet } from './props/createHelmet';

export const CABIN_H = 3.2;
export const CABIN_W = 10;
export const CABIN_D = 8;

export interface RoomBuildResult {
  interactables: Interactable[];
  crtMeshes: THREE.Mesh[];
  chair: THREE.Object3D;
  outsideFigure: THREE.Mesh;
  beaconLight: THREE.PointLight;
  ceilingAlarm: CeilingAlarmResult;
  doorPivot: THREE.Group;
  consoleChecked: { value: boolean };
  badgeExamined: { value: boolean };
  stormSkyTex: THREE.CanvasTexture;
  seaMesh: THREE.Mesh;
  cabinNeon: THREE.PointLight;
}

export function buildObservationRoom(scene: THREE.Scene): RoomBuildResult {
  const interactables: Interactable[] = [];
  const crtMeshes: THREE.Mesh[] = [];
  const consoleChecked = { value: false };
  const badgeExamined = { value: false };

  const W = CABIN_W;
  const D = CABIN_D;
  const H = CABIN_H;

  scene.fog = new THREE.FogExp2(0x4a5a70, 0.007);

  const groundPad = new THREE.Mesh(
    new THREE.BoxGeometry(28, 0.4, 18),
    flatMetal(0x252d3a)
  );
  groundPad.position.set(4, -0.25, 0);
  groundPad.receiveShadow = true;
  scene.add(groundPad);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.15, D),
    flatMetal(COLORS.carpet)
  );
  floor.position.set(0, -0.075, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  const ceil = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.12, D),
    paintedWall(COLORS.metalDark)
  );
  ceil.position.set(0, H, 0);
  scene.add(ceil);

  const rainTex = createRainGlassTexture();
  const glassMat = wetGlass();
  glassMat.alphaMap = rainTex;
  glassMat.transparent = true;
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.4, H - 0.5),
    glassMat
  );
  glass.position.set(0, H / 2, -D / 2 + 0.05);
  scene.add(glass);

  const frameMat = flatMetal(COLORS.metalDark);
  for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, H, 0.15), frameMat);
    post.position.set(x, H / 2, -D / 2);
    scene.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(W, 0.15, 0.15), frameMat);
  lintel.position.set(0, H - 0.05, -D / 2);
  scene.add(lintel);

  const { stormSkyTex, seaMesh } = buildExterior(scene);

  const consoleGroup = new THREE.Group();
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.9, 0.9),
    flatMetal(COLORS.metal)
  );
  desk.position.set(0, 0.45, -1.5);
  desk.castShadow = true;
  consoleGroup.add(desk);

  const mug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.05, 0.12, 6),
    flatMetal(COLORS.safetyOrange)
  );
  mug.position.set(0.5, 0.96, -1.35);
  consoleGroup.add(mug);

  const crtTex = createCRTTexture();
  const crt1 = createCRTMonitor(crtTex, true);
  crt1.group.position.set(0, 1.55, -1.85);
  crtMeshes.push(crt1.screenMesh);
  consoleGroup.add(crt1.group);

  const crt2 = createCRTMonitor(crtTex, false);
  crt2.group.position.set(0.9, 1.5, -1.75);
  crt2.group.rotation.y = -0.25;
  crtMeshes.push(crt2.screenMesh);
  consoleGroup.add(crt2.group);

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.05, 0.4),
    flatMetal(0x1e293b)
  );
  panel.position.set(0, 0.92, -1.35);
  consoleGroup.add(panel);

  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 0.15, 6),
    emissiveNeon(COLORS.beacon, 1.4)
  );
  beacon.position.set(-0.9, 0.95, -1.2);
  consoleGroup.add(beacon);

  scene.add(consoleGroup);

  const calendar = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.45, 0.02),
    new THREE.MeshStandardMaterial({
      color: COLORS.safetyYellow,
      emissive: COLORS.safetyOrange,
      emissiveIntensity: 0.2,
      flatShading: true,
    })
  );
  calendar.position.set(-2.5, 2.0, 2.5);
  scene.add(calendar);

  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.5, 0.6),
    flatMetal(COLORS.wood)
  );
  crate.position.set(3.2, 0.25, 2.8);
  scene.add(crate);

  const chair = createChair();
  chair.position.set(0.8, 0, 0.2);
  scene.add(chair);

  const ceilingAlarm = createCeilingAlarm(
    H,
    new THREE.Vector3(-1.5, 0, -0.5)
  );
  scene.add(ceilingAlarm.group);

  const beaconLight = new THREE.PointLight(COLORS.beacon, 0.85, 12);
  beaconLight.position.set(0, 1.0, -1.5);
  scene.add(beaconLight);

  const windowGlow = new THREE.PointLight(0xffeed8, 4.0, 30);
  windowGlow.position.set(0, 4, -D / 2 - 2);
  scene.add(windowGlow);

  const windowFill = new THREE.SpotLight(0xfff4e8, 3.2, 32, Math.PI / 3, 0.4, 1);
  windowFill.position.set(0, 5, -D / 2 - 1);
  windowFill.target.position.set(0, 1, 2);
  scene.add(windowFill);
  scene.add(windowFill.target);

  const ceilingFill = new THREE.PointLight(0xfff8f0, 1.5, 18);
  ceilingFill.position.set(0, H - 0.2, 0);
  scene.add(ceilingFill);

  const cabinNeon = new THREE.PointLight(0xffcc88, 1.35, 14);
  cabinNeon.position.set(2, 2.8, 1);
  scene.add(cabinNeon);

  const neonMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.06, 0.1),
    emissiveNeon(COLORS.neonAmber, 1.3)
  );
  neonMesh.position.set(2, 2.95, 1);
  scene.add(neonMesh);

  const shelfGroup = new THREE.Group();
  const bracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.35, 0.35),
    flatMetal(COLORS.metalDark)
  );
  const shelf = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.06, 1.2),
    flatMetal(COLORS.metal)
  );
  shelf.position.set(0.04, 0.12, 0);
  const shelfTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.05, 1.25),
    flatMetal(COLORS.metalDark)
  );
  shelfTop.position.set(0.05, 0.28, 0);
  shelfGroup.add(bracket, shelf, shelfTop);
  shelfGroup.position.set(-W / 2 + 0.12, 1.35, 1.8);
  scene.add(shelfGroup);

  const helmet = createHelmet();
  helmet.position.set(-W / 2 + 0.28, 1.72, 1.8);
  helmet.rotation.y = 0.35;
  scene.add(helmet);

  const badgePos = new THREE.Vector3(-W / 2 + 0.35, 1.55, 1.8);

  const doorPivot = new THREE.Group();
  doorPivot.position.set(W / 2 - 0.06, 0, 0);
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 2.4, 1.2),
    flatMetal(COLORS.metalDark)
  );
  door.position.set(0.06, 1.2, 0);
  door.castShadow = true;
  const lockPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.25, 0.2),
    emissiveNeon(COLORS.beacon, 0.8)
  );
  lockPlate.position.set(0.1, 1.1, -0.35);
  doorPivot.add(door, lockPlate);
  scene.add(doorPivot);

  const outsideFigure = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.9, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, flatShading: true })
  );
  outsideFigure.position.set(-1.2, 1.0, -D / 2 - 0.3);
  scene.add(outsideFigure);

  const antenna = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.06, 6, 5),
    flatMetal(COLORS.metal)
  );
  pole.position.set(-4, 3, -6);
  const dish = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 0.3, 6),
    flatMetal(COLORS.metalDark)
  );
  dish.rotation.x = Math.PI;
  dish.position.set(-4, 6.2, -6);
  antenna.add(pole, dish);
  scene.add(antenna);

  interactables.push({
    id: 'console',
    position: new THREE.Vector3(0, 1.1, -1.35),
    radius: 2.8,
    hint: '[E] Vérifier la console de la balise 7',
    onInteract: () => { consoleChecked.value = true; },
    canInteract: () => !consoleChecked.value,
  });

  interactables.push({
    id: 'badge',
    position: badgePos,
    radius: 2.6,
    hint: '[E] Examiner le casque sur l\'étagère',
    onInteract: () => { badgeExamined.value = true; },
    canInteract: () => !badgeExamined.value,
  });

  return {
    interactables,
    crtMeshes,
    chair,
    outsideFigure,
    beaconLight,
    ceilingAlarm,
    doorPivot,
    consoleChecked,
    badgeExamined,
    stormSkyTex,
    seaMesh,
    cabinNeon,
  };
}

function buildExterior(scene: THREE.Scene): {
  stormSkyTex: THREE.CanvasTexture;
  seaMesh: THREE.Mesh;
} {
  const skyTex = createStormSkyTexture();
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 20),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.DoubleSide })
  );
  sky.position.set(0, 8, -12);
  scene.add(sky);

  const skyGlow = new THREE.PointLight(0xa8bcd4, 2.0, 40);
  skyGlow.position.set(0, 10, -10);
  scene.add(skyGlow);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 30, 12, 8),
    new THREE.MeshStandardMaterial({
      color: 0x2a5070,
      flatShading: true,
      roughness: 0.6,
      emissive: 0x1a4060,
      emissiveIntensity: 0.35,
      metalness: 0.15,
    })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -2, -14);
  scene.add(sea);

  const cliff = new THREE.Mesh(
    new THREE.ConeGeometry(8, 5, 5),
    flatMetal(0x4a5568)
  );
  cliff.position.set(6, -0.5, -10);
  cliff.rotation.z = 0.3;
  scene.add(cliff);

  const cliff2 = cliff.clone();
  cliff2.position.set(-7, -1, -11);
  cliff2.scale.set(1.2, 0.8, 1);
  scene.add(cliff2);

  return { stormSkyTex: skyTex, seaMesh: sea };
}

export function updateCRTTextures(
  meshes: THREE.Mesh[],
  t: number,
  coords?: string
): void {
  updateRainGlass(t);
  for (const m of meshes) {
    const mat = m.material as THREE.MeshStandardMaterial;
    const tex = mat.map;
    if (tex && 'updateCRT' in tex) {
      (tex as { updateCRT: (t: number, c?: string) => void }).updateCRT(t, coords);
    }
  }
}

export function pulseBeacon(light: THREE.PointLight, t: number): void {
  light.intensity = 0.65 + Math.sin(t * 2.5) * 0.25;
}
