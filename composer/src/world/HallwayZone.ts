import * as THREE from 'three';
import { COLORS, flatMetal, paintedWall, safetyFloor, emissiveNeon } from './materials';
import { Interactable } from '../entities/Interactable';
import { CABIN_H } from './ObservationRoom';
import { createCeilingAlarm } from './props/createCeilingAlarm';
import { createNeonTube, createSignPanel, createExtinguisher, createCableBundle } from './props/createDecor';
import {
  HALL_OX,
  HALL_LEN,
  HALL_HALF_Z,
  HALL_END_X,
  TOWER_ENTRY_CX,
  TOWER_ENTRY_HALF,
} from './levelLayout';

export interface HallwayBuildResult {
  floorZones: [];
  interactables: Interactable[];
  logPanelRead: { value: boolean };
  neonLights: THREE.PointLight[];
}

const H = CABIN_H;
const hallCx = HALL_OX + HALL_LEN / 2 + 0.4;

export function buildHallway(
  scene: THREE.Scene,
  doorUnlocked: () => boolean
): HallwayBuildResult {
  const interactables: Interactable[] = [];
  const logPanelRead = { value: false };
  const neonLights: THREE.PointLight[] = [];

  const totalLen = TOWER_ENTRY_CX + TOWER_ENTRY_HALF - HALL_OX + 0.5;
  const floorCx = (HALL_OX + TOWER_ENTRY_CX + TOWER_ENTRY_HALF) / 2;

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(totalLen, 0.16, HALL_HALF_Z * 2 + 0.6),
    safetyFloor()
  );
  floor.position.set(floorCx, -0.08, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.16, 1.5),
    safetyFloor()
  );
  bridge.position.set(HALL_OX + 0.65, -0.08, 0);
  scene.add(bridge);

  const ceil = new THREE.Mesh(
    new THREE.BoxGeometry(totalLen, 0.12, HALL_HALF_Z * 2 + 0.6),
    paintedWall(COLORS.metalDark)
  );
  ceil.position.set(floorCx, H, 0);
  scene.add(ceil);

  addVisualWall(scene, hallCx, H / 2, HALL_HALF_Z + 0.14, HALL_LEN + 1.5, H, 0.2);
  addVisualWall(scene, hallCx, H / 2, -HALL_HALF_Z - 0.14, HALL_LEN + 1.5, H, 0.2);

  for (let i = 0; i < 4; i++) {
    const x = HALL_OX + 2 + i * 3.5;
    const tube = createNeonTube(2.4, i % 2 === 0 ? COLORS.neonCyan : COLORS.neonAmber);
    tube.position.set(x, H - 0.12, 0);
    scene.add(tube);

    const light = new THREE.PointLight(
      i % 2 === 0 ? 0x88eeff : 0xffcc88,
      1.2,
      14
    );
    light.position.set(x, H - 0.25, 0);
    scene.add(light);
    neonLights.push(light);
  }

  scene.add(createCeilingAlarm(H, new THREE.Vector3(hallCx - 1.2, 0, 0)).group);

  const sign = createSignPanel('SECTEUR B — TOUR', '#c41e1e');
  sign.position.set(HALL_END_X - 0.5, 2.15, -HALL_HALF_Z + 0.12);
  scene.add(sign);

  const exitSign = createSignPanel('SORTIE ←', '#f0c040', 0.7, 0.22);
  exitSign.position.set(HALL_OX + 1.5, 2.2, HALL_HALF_Z - 0.1);
  scene.add(exitSign);

  const extinguisher = createExtinguisher();
  extinguisher.position.set(HALL_OX + 1.2, 0, HALL_HALF_Z - 0.15);
  scene.add(extinguisher);

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.95, 0.6),
    flatMetal(0x1e293b)
  );
  panel.position.set(hallCx + 0.8, 1.15, -HALL_HALF_Z + 0.12);
  scene.add(panel);

  const journalGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.7, 0.04),
    emissiveNeon(COLORS.neonCyan, 0.35)
  );
  journalGlow.position.set(panel.position.x - 0.05, 1.1, panel.position.z + 0.08);
  scene.add(journalGlow);

  for (let i = 0; i < 3; i++) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, totalLen * 0.8, 5),
      flatMetal(COLORS.concrete)
    );
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(floorCx, H - 0.35, -0.6 + i * 0.6);
    scene.add(pipe);
  }

  const cables = createCableBundle([COLORS.cableRed, COLORS.cableBlue, COLORS.cableYellow], 1.5);
  cables.position.set(hallCx - 2, 2.5, HALL_HALF_Z - 0.05);
  cables.rotation.x = Math.PI / 2;
  scene.add(cables);

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.45, 0.2),
    flatMetal(COLORS.metalDark)
  );
  box.position.set(hallCx - 1, 1.0, HALL_HALF_Z - 0.08);
  scene.add(box);

  interactables.push({
    id: 'logpanel',
    position: new THREE.Vector3(panel.position.x - 0.6, 1.05, panel.position.z),
    radius: 2.6,
    hint: '[E] Lire le journal de maintenance du relais',
    onInteract: () => { logPanelRead.value = true; },
    canInteract: () => doorUnlocked() && !logPanelRead.value,
  });

  return { floorZones: [], interactables, logPanelRead, neonLights };
}

function addVisualWall(
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
