import * as THREE from 'three';
import { COLORS, flatMetal, paintedWall, safetyFloor, emissiveNeon } from './materials';
import { Interactable } from '../entities/Interactable';
import { CABIN_H } from './ObservationRoom';
import {
  TOWER_ENTRY_CX,
  TOWER_ENTRY_CZ,
  TOWER_ENTRY_HALF,
  TOWER_DOOR_X,
  TOWER_DOOR_Z,
  TOWER_CORRIDOR_HALF_X,
  TOWER_NORTH_WALL_Z,
  TOWER_ROOM_D,
} from './levelLayout';
import { SERVER_CX, SERVER_CZ } from './serverColliders';
import { createSignPanel, createCableBundle } from './props/createDecor';

export interface TowerBuildResult {
  floorZones: [];
  interactables: Interactable[];
  towerDoorPivot: THREE.Group;
  antennaPivot: THREE.Group;
  breakerSwitch: THREE.Mesh;
  towerLights: THREE.PointLight[];
  scareFigure: THREE.Group;
  breakerPos: THREE.Vector3;
  statusLeds: THREE.MeshStandardMaterial[];
  serverStairsZone: { minX: number; maxX: number; minZ: number; maxZ: number };
  emergencyExitDoor: THREE.Group;
  emergencyExitSign: THREE.MeshStandardMaterial;
}

const H = CABIN_H;
const cx = TOWER_ENTRY_CX;
const cz = TOWER_ENTRY_CZ;
const half = TOWER_ENTRY_HALF;
const roomW = half * 2;
const roomD = TOWER_ROOM_D;

export function buildTowerZone(scene: THREE.Scene): TowerBuildResult {
  const interactables: Interactable[] = [];
  const towerLights: THREE.PointLight[] = [];
  const statusLeds: THREE.MeshStandardMaterial[] = [];

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(roomW + 0.2, 0.16, roomD + 0.2),
    safetyFloor()
  );
  floor.position.set(cx, -0.08, cz);
  floor.receiveShadow = true;
  scene.add(floor);

  const ceil = new THREE.Mesh(
    new THREE.BoxGeometry(roomW + 0.2, 0.12, roomD + 0.2),
    paintedWall(COLORS.metalDark)
  );
  ceil.position.set(cx, H, cz);
  scene.add(ceil);

  addWall(scene, cx + half + 0.09, H / 2, cz, 0.18, H, roomD / 2);

  const northSeg = half - TOWER_CORRIDOR_HALF_X;
  addWall(scene, cx - half + northSeg / 2, H / 2, TOWER_NORTH_WALL_Z, northSeg, H, 0.18);
  addWall(scene, cx + half - northSeg / 2, H / 2, TOWER_NORTH_WALL_Z, northSeg, H, 0.18);
  addWall(scene, cx, H / 2, cz + roomD / 2, roomW, H, 0.18);

  const towerDoorPivot = new THREE.Group();
  towerDoorPivot.position.set(TOWER_DOOR_X, 0, TOWER_DOOR_Z);
  const doorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 2.1, 1.15),
    flatMetal(COLORS.metalDark)
  );
  doorMesh.position.set(0.05, 1.05, 0);
  towerDoorPivot.add(doorMesh);
  scene.add(towerDoorPivot);

  const antennaPivot = new THREE.Group();
  antennaPivot.position.set(cx + 1.2, 0, cz + 1.2);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 2.4, 6),
    flatMetal(COLORS.metal)
  );
  mast.position.y = 1.2;
  const dish = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.1, 0.75),
    flatMetal(0x8899aa)
  );
  dish.position.set(0, 2.45, 0.2);
  antennaPivot.add(mast, dish);
  scene.add(antennaPivot);

  const cables = createCableBundle([COLORS.cableYellow, COLORS.cableRed, COLORS.cableBlue], 2);
  cables.position.set(cx + 1.2, 0, cz + 0.5);
  scene.add(cables);

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.3, 0.14),
    flatMetal(0x1e293b)
  );
  panel.position.set(cx + 1.5, 0.65, cz - 1.2);
  scene.add(panel);

  const label = createSignPanel('TRANSFERT SERVEUR', '#ff3344', 1.4, 0.22);
  label.position.set(cx + 1.5, 1.35, cz - 1.12);
  scene.add(label);

  for (let i = 0; i < 3; i++) {
    const ledMat = emissiveNeon(i === 0 ? COLORS.serverGreen : COLORS.neonAmber, 0.9);
    statusLeds.push(ledMat);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.04), ledMat);
    led.position.set(cx + 1.1 + i * 0.2, 0.85, cz - 1.05);
    scene.add(led);
  }

  const breakerSwitch = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.38, 0.14),
    emissiveNeon(COLORS.beacon, 0.9)
  );
  breakerSwitch.position.set(cx + 1.5, 0.5, cz - 1.05);
  scene.add(breakerSwitch);

  const breakerRed = new THREE.PointLight(COLORS.warningRed, 0.6, 6);
  breakerRed.position.set(cx + 1.5, 1.2, cz - 1.0);
  scene.add(breakerRed);

  const okGreen = new THREE.PointLight(COLORS.serverGreen, 0.4, 5);
  okGreen.position.set(cx + 0.5, 1.5, cz);
  scene.add(okGreen);

  for (let i = 0; i < 3; i++) {
    const light = new THREE.PointLight(0xc8ddff, 0.95, 14);
    light.position.set(cx - 1 + i, H - 0.4, cz);
    scene.add(light);
    towerLights.push(light);
  }

  const scareFigure = new THREE.Group();
  scareFigure.visible = false;
  scareFigure.position.set(cx - 1, 0, cz + 0.5);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 1.1, 0.28),
    flatMetal(0x050608)
  );
  body.position.y = 0.55;
  scareFigure.add(body);
  scene.add(scareFigure);

  buildServerCorridor(scene);

  const emergencyExitDoor = new THREE.Group();
  emergencyExitDoor.visible = false;
  emergencyExitDoor.position.set(cx, 0, TOWER_NORTH_WALL_Z - 0.05);
  const hatchSignMat = emissiveNeon(COLORS.serverGreen, 0.15);
  const hatchFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 2.2, 0.12),
    flatMetal(0x334455)
  );
  hatchFrame.position.y = 1.1;
  const hatchPanel = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 1.9, 0.08),
    hatchSignMat
  );
  hatchPanel.position.set(0, 1.05, -0.04);
  const hatchLabel = createSignPanel('ÉVACUATION', '#44ff88', 1.4, 0.24);
  hatchLabel.position.set(0, 2.0, -0.08);
  emergencyExitDoor.add(hatchFrame, hatchPanel, hatchLabel);
  scene.add(emergencyExitDoor);

  const breakerPos = new THREE.Vector3(cx + 1.5, 0.8, cz - 1.0);

  interactables.push({
    id: 'breaker',
    position: breakerPos,
    radius: 2.2,
    hint: '[E] Activer le disjoncteur TRANSFERT SERVEUR',
    onInteract: () => {},
    canInteract: () => true,
  });

  interactables.push({
    id: 'serverdescent',
    position: new THREE.Vector3(cx, 0.5, cz - roomD / 2 + 0.4),
    radius: 2.5,
    hint: '[E] Ouvrir l\'accès à la salle serveurs',
    onInteract: () => {},
    canInteract: () => true,
  });

  interactables.push({
    id: 'emergencyexit',
    position: new THREE.Vector3(cx, 0.5, TOWER_NORTH_WALL_Z - 1.8),
    radius: 3.5,
    hint: '[E] Sortir — air libre',
    onInteract: () => {},
    canInteract: () => true,
  });

  return {
    floorZones: [],
    interactables,
    towerDoorPivot,
    antennaPivot,
    breakerSwitch,
    towerLights,
    scareFigure,
    breakerPos,
    statusLeds,
    serverStairsZone: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
    emergencyExitDoor,
    emergencyExitSign: hatchSignMat,
  };
}

function buildServerCorridor(scene: THREE.Scene): void {
  const startZ = cz - roomD / 2;
  const endZ = SERVER_CZ + 5;
  const midX = (cx + SERVER_CX - 6) / 2;
  const len = Math.abs(endZ - startZ);

  const corridor = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.16, len + 1),
    safetyFloor()
  );
  corridor.position.set(midX, -0.08, (startZ + endZ) / 2);
  corridor.receiveShadow = true;
  scene.add(corridor);

  const conn = new THREE.Mesh(
    new THREE.BoxGeometry(SERVER_CX - cx - 4, 0.16, 2.4),
    safetyFloor()
  );
  conn.position.set((cx + SERVER_CX - 5) / 2, -0.08, SERVER_CZ + 4);
  scene.add(conn);
}

function addWall(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number
): void {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    paintedWall(COLORS.wall)
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  scene.add(mesh);
}
