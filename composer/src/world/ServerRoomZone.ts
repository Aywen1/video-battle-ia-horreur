import * as THREE from 'three';
import { COLORS, flatMetal, gridFloor, emissiveNeon, createVUMeterTexture } from './materials';
import { Interactable } from '../entities/Interactable';
import { createSignPanel } from './props/createDecor';
import { createServerRack } from './props/createServerRack';
import { createCRTMonitor } from './props/createCRTMonitor';
import { SERVER_CX, SERVER_CZ, SERVER_W, SERVER_D } from './serverColliders';

export interface ServerBuildResult {
  interactables: Interactable[];
  crtMeshes: THREE.Mesh[];
  beaconCore: THREE.Group;
  radioDesk: THREE.Vector3;
  serverDoorPivot: THREE.Group;
  rackDoors: THREE.Mesh[];
  scareFigure: THREE.Group;
  serverLights: THREE.PointLight[];
  rackLeds: THREE.MeshStandardMaterial[][];
  steamPositions: THREE.Vector3[];
  vuTexture: THREE.CanvasTexture;
  emergencyExitDoor: THREE.Group;
  emergencyExitSign: THREE.MeshStandardMaterial;
}

export function buildServerRoomZone(scene: THREE.Scene): ServerBuildResult {
  const interactables: Interactable[] = [];
  const crtMeshes: THREE.Mesh[] = [];
  const rackDoors: THREE.Mesh[] = [];
  const serverLights: THREE.PointLight[] = [];
  const rackLeds: THREE.MeshStandardMaterial[][] = [];
  const steamPositions: THREE.Vector3[] = [];
  const cx = SERVER_CX;
  const cz = SERVER_CZ;
  const hw = SERVER_W / 2;
  const hd = SERVER_D / 2;

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(SERVER_W + 1, 0.18, SERVER_D + 1),
    gridFloor()
  );
  floor.position.set(cx, -0.08, cz);
  floor.receiveShadow = true;
  scene.add(floor);

  const ceil = new THREE.Mesh(
    new THREE.BoxGeometry(SERVER_W + 1, 0.14, SERVER_D + 1),
    flatMetal(COLORS.metalDark)
  );
  ceil.position.set(cx, 3.2, cz);
  scene.add(ceil);

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const rack = createServerRack();
      rack.group.position.set(
        cx - hw + 2.5 + col * 2.2,
        0,
        cz - hd + 2.5 + row * 3.5
      );
      scene.add(rack.group);
      rackDoors.push(rack.door);
      rackLeds.push(rack.ledMaterials);
      steamPositions.push(
        new THREE.Vector3(
          cx - hw + 2.5 + col * 2.2,
          2.1,
          cz - hd + 2.5 + row * 3.5
        )
      );
    }
  }

  const beaconCore = new THREE.Group();
  beaconCore.position.set(cx, 0, cz);
  const console = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.9, 1.2),
    flatMetal(0x1e293b)
  );
  console.position.y = 0.45;
  const emitter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.45, 1.4, 8),
    emissiveNeon(COLORS.beacon, 1.1)
  );
  emitter.position.y = 1.5;
  beaconCore.add(console, emitter);

  const cableColors = [COLORS.cableRed, COLORS.cableBlue, COLORS.cableYellow];
  for (let i = 0; i < 3; i++) {
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 2.5, 4),
      new THREE.MeshStandardMaterial({ color: cableColors[i], flatShading: true })
    );
    cable.position.set(-0.6 + i * 0.6, 0.3, 0.8);
    cable.rotation.x = Math.PI / 2;
    beaconCore.add(cable);
  }
  scene.add(beaconCore);

  const vent = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.8, 0.08),
    flatMetal(COLORS.concrete)
  );
  vent.position.set(cx - hw + 1, 2.5, cz);
  scene.add(vent);

  const ups = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.7, 0.4),
    flatMetal(COLORS.metalDark)
  );
  ups.position.set(cx + hw - 1, 0.35, cz - hd + 1);
  scene.add(ups);
  const upsLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 0.02),
    emissiveNeon(COLORS.serverGreen, 1.2)
  );
  upsLed.position.set(cx + hw - 1, 0.75, cz - hd + 0.8);
  scene.add(upsLed);

  const radioDeskPos = new THREE.Vector3(cx + hw - 2.5, 0, cz + hd - 2.2);
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.75, 0.8),
    flatMetal(COLORS.wood)
  );
  desk.position.copy(radioDeskPos);
  desk.position.y = 0.375;
  scene.add(desk);

  const vuTex = createVUMeterTexture();
  const vuMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.18),
    new THREE.MeshStandardMaterial({
      map: vuTex,
      emissive: 0x3dd68c,
      emissiveIntensity: 0.3,
      flatShading: true,
    })
  );
  vuMesh.position.set(radioDeskPos.x - 0.3, 0.92, radioDeskPos.z + 0.2);
  vuMesh.rotation.y = -0.3;
  scene.add(vuMesh);

  const radio = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.25, 0.45),
    flatMetal(0x2a3544)
  );
  radio.position.set(radioDeskPos.x, 0.9, radioDeskPos.z);
  scene.add(radio);

  const radioLight = new THREE.PointLight(COLORS.neonAmber, 0.7, 8);
  radioLight.position.set(radioDeskPos.x, 1.2, radioDeskPos.z);
  scene.add(radioLight);

  const crt = createCRTMonitor();
  crt.group.position.set(radioDeskPos.x + 0.35, 0.85, radioDeskPos.z);
  scene.add(crt.group);
  crtMeshes.push(crt.screenMesh);

  const underGlow = new THREE.PointLight(COLORS.neonCyan, 0.5, 10);
  underGlow.position.set(cx, 0.3, cz - hd + 4);
  scene.add(underGlow);

  const serverDoorPivot = new THREE.Group();
  serverDoorPivot.position.set(cx - hw + 0.15, 0, cz + hd - 0.5);
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 2.4, 2.2),
    flatMetal(COLORS.metalDark)
  );
  door.position.set(0.07, 1.2, 0);
  serverDoorPivot.add(door);
  scene.add(serverDoorPivot);

  const scareFigure = new THREE.Group();
  scareFigure.visible = false;
  const figBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 1.1, 0.28),
    flatMetal(0x050608)
  );
  figBody.position.y = 0.55;
  const figHead = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.32, 0.32),
    flatMetal(0x0a0c10)
  );
  figHead.position.y = 1.35;
  scareFigure.add(figBody, figHead);
  scene.add(scareFigure);

  for (let i = 0; i < 6; i++) {
    const light = new THREE.PointLight(0xb8e0ff, 0.85, 16);
    light.position.set(
      cx - hw + 3 + (i % 3) * 5,
      2.8,
      cz - hd + 3 + Math.floor(i / 3) * 6
    );
    scene.add(light);
    serverLights.push(light);
  }

  interactables.push({
    id: 'radio',
    position: new THREE.Vector3(radioDeskPos.x, 1.0, radioDeskPos.z),
    radius: 2.4,
    hint: '[E] Poste radio — molette, ←/→ ou Q/D pour tuner (E pour quitter)',
    onInteract: () => {},
    canInteract: () => true,
  });

  interactables.push({
    id: 'beaconcut',
    position: new THREE.Vector3(cx, 1.2, cz),
    radius: 2.8,
    hint: '[E] COUPEZ BALISE 7',
    onInteract: () => {},
    canInteract: () => true,
  });

  const emergencyExitDoor = new THREE.Group();
  emergencyExitDoor.visible = false;
  emergencyExitDoor.position.set(cx + hw - 0.1, 0, cz + 0.5);
  const exitFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 2.3, 2.1),
    flatMetal(0x334455)
  );
  exitFrame.position.y = 1.15;
  const exitSignMat = emissiveNeon(COLORS.serverGreen, 0.15);
  const exitPanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 2.0, 1.85),
    exitSignMat
  );
  exitPanel.position.set(0.02, 1.1, 0);
  const exitLabel = createSignPanel('SORTIE URGENCE', '#44ff88', 1.6, 0.28);
  exitLabel.position.set(0.08, 2.05, 0);
  exitLabel.rotation.y = Math.PI / 2;
  emergencyExitDoor.add(exitFrame, exitPanel, exitLabel);
  scene.add(emergencyExitDoor);

  const exitInteractPos = new THREE.Vector3(cx + hw - 2.2, 1.0, cz + 0.5);
  interactables.push({
    id: 'emergencyexit',
    position: exitInteractPos,
    radius: 3.5,
    hint: '[E] Sortir — air libre',
    onInteract: () => {},
    canInteract: () => true,
  });

  return {
    interactables,
    crtMeshes,
    beaconCore,
    radioDesk: radioDeskPos,
    serverDoorPivot,
    rackDoors,
    scareFigure,
    serverLights,
    rackLeds,
    steamPositions,
    vuTexture: vuTex,
    emergencyExitDoor,
    emergencyExitSign: exitSignMat,
  };
}
