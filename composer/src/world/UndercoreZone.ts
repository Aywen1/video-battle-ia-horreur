import * as THREE from 'three';
import { flatMetal } from './materials';
import { Interactable } from '../entities/Interactable';
import { getUndercoreGroundY, UNDERCORE_LOCATIONS } from './undercoreFloor';
import {
  buildCorridorBloodDecals,
  buildCorpseProp,
  buildOrganMass,
  buildMirrorFigure,
  fleshMaterial,
} from './undercoreGore';
import { bloodDecalMaterial } from './exteriorBlood';

export interface UndercoreBuildResult {
  group: THREE.Group;
  interactables: Interactable[];
  neonLights: THREE.PointLight[];
  organMass: THREE.Group;
  mirrorFigure: THREE.Group;
  crtMeshes: THREE.Mesh[];
  badgeMeshes: THREE.Mesh[];
}

function groundY(x: number, z: number): number {
  return getUndercoreGroundY(x, z);
}

function buildCrtScreen(label: string, color: string): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, 128, 96);
  ctx.fillStyle = color;
  ctx.font = '10px monospace';
  ctx.fillText(label, 8, 20);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${40 + Math.random() * 80},${20 + Math.random() * 40},${20 + Math.random() * 30},0.4)`;
    ctx.fillRect(Math.random() * 128, Math.random() * 96, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.MeshStandardMaterial({
    map: tex,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.35,
    roughness: 0.3,
  });
}

export function buildUndercoreZone(parent: THREE.Group): UndercoreBuildResult {
  const root = new THREE.Group();
  const interactables: Interactable[] = [];
  const neonLights: THREE.PointLight[] = [];
  const crtMeshes: THREE.Mesh[] = [];
  const badgeMeshes: THREE.Mesh[] = [];

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x2a2520,
    roughness: 0.95,
    metalness: 0.02,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x3a3230,
    roughness: 0.92,
  });
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x1a1512,
    roughness: 0.98,
  });

  const corridorLen = 50;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2.4, corridorLen, 8, 32), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 22);
  floor.receiveShadow = true;
  root.add(floor);

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(corridorLen, 3), wallMat);
    wall.rotation.y = side * Math.PI / 2;
    wall.position.set(side * 1.15, 1.5, 22);
    root.add(wall);
  }

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(2.4, corridorLen), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 3, 22);
  root.add(ceiling);

  buildCorridorBloodDecals(root);

  for (let z = 4; z < 46; z += 6) {
    const neon = new THREE.PointLight(0xff2222, 0.5, 6);
    neon.position.set(0, 2.6, z);
    root.add(neon);
    neonLights.push(neon);
  }

  const loc = UNDERCORE_LOCATIONS;

  const badgeWallGroup = new THREE.Group();
  badgeWallGroup.position.set(loc.badgeWall.x, groundY(loc.badgeWall.x, loc.badgeWall.z), loc.badgeWall.z);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const badge = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.22, 0.04),
        flatMetal(0xccccaa)
      );
      badge.position.set(-0.55 + col * 0.38, 1.2 + row * 0.35, 0.02);
      badgeMeshes.push(badge);
      badgeWallGroup.add(badge);
    }
  }
  const badgeStain = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), bloodDecalMaterial());
  badgeStain.rotation.x = -Math.PI / 2;
  badgeStain.position.set(0, 0.02, 0.3);
  badgeWallGroup.add(badgeStain);
  root.add(badgeWallGroup);

  const crtGroup = new THREE.Group();
  crtGroup.position.set(loc.crtRoom.x, groundY(loc.crtRoom.x, loc.crtRoom.z), loc.crtRoom.z);
  const crtLabels = ['CABINE — GPS INT.', 'TOUR — BALISE 7', 'SERVEUR — COUPURE', 'EXT — SIMULATION'];
  const crtColors = ['#44ff88', '#ff8844', '#4488ff', '#ff4444'];
  for (let i = 0; i < 4; i++) {
    const mat = buildCrtScreen(crtLabels[i], crtColors[i]);
    const crt = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.65), mat);
    crt.position.set(-1.35 + i * 0.95, 1.4, 0);
    crtMeshes.push(crt);
    crtGroup.add(crt);
  }
  root.add(crtGroup);

  const corpse = buildCorpseProp();
  corpse.position.set(loc.corpseTable.x, groundY(loc.corpseTable.x, loc.corpseTable.z), loc.corpseTable.z);
  root.add(corpse);

  const organMass = buildOrganMass();
  organMass.position.set(loc.organMass.x, groundY(loc.organMass.x, loc.organMass.z), loc.organMass.z);
  root.add(organMass);

  const mirrorFrame = new THREE.Group();
  mirrorFrame.position.set(loc.mirror.x, groundY(loc.mirror.x, loc.mirror.z), loc.mirror.z);
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 2.2, 0.08),
    flatMetal(0x333333)
  );
  frame.position.y = 1.3;
  const mirrorGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 2.0),
    new THREE.MeshStandardMaterial({
      color: 0x888899,
      roughness: 0.1,
      metalness: 0.8,
      emissive: 0x110808,
      emissiveIntensity: 0.2,
    })
  );
  mirrorGlass.position.set(0, 1.3, 0.05);
  const mirrorFigure = buildMirrorFigure();
  mirrorFigure.position.set(0, 0, 0.15);
  mirrorFigure.visible = false;
  mirrorFrame.add(frame, mirrorGlass, mirrorFigure);
  root.add(mirrorFrame);

  const terminalGroup = new THREE.Group();
  terminalGroup.position.set(loc.terminal.x, groundY(loc.terminal.x, loc.terminal.z), loc.terminal.z);
  const termBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.6), flatMetal(0x2a3544));
  termBody.position.y = 0.9;
  const termScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.55),
    buildCrtScreen('NOYAU 7-D', '#ff2222')
  );
  termScreen.position.set(0, 1.15, 0.31);
  terminalGroup.add(termBody, termScreen);
  root.add(terminalGroup);

  const gy = (x: number, z: number, h: number) => groundY(x, z) + h;

  interactables.push(
    {
      id: 'uc_badges',
      position: new THREE.Vector3(loc.badgeWall.x, gy(loc.badgeWall.x, loc.badgeWall.z, 1.2), loc.badgeWall.z),
      radius: 2.5,
      hint: '[E] Examiner le mur de badges',
      onInteract: () => {},
      canInteract: () => true,
    },
    {
      id: 'uc_crts',
      position: new THREE.Vector3(loc.crtRoom.x, gy(loc.crtRoom.x, loc.crtRoom.z, 1.2), loc.crtRoom.z),
      radius: 2.8,
      hint: '[E] Visionner les enregistrements',
      onInteract: () => {},
      canInteract: () => true,
    },
    {
      id: 'uc_corpse',
      position: new THREE.Vector3(loc.corpseTable.x, gy(loc.corpseTable.x, loc.corpseTable.z, 1), loc.corpseTable.z),
      radius: 2.5,
      hint: '[E] Lire le journal du corps',
      onInteract: () => {},
      canInteract: () => true,
    },
    {
      id: 'uc_organ',
      position: new THREE.Vector3(loc.organMass.x, gy(loc.organMass.x, loc.organMass.z, 1.2), loc.organMass.z),
      radius: 2.8,
      hint: '[E] Maintenir 3 s — couper le filament',
      onInteract: () => {},
      canInteract: () => true,
    },
    {
      id: 'uc_mirror',
      position: new THREE.Vector3(loc.mirror.x, gy(loc.mirror.x, loc.mirror.z, 1.2), loc.mirror.z),
      radius: 2.2,
      hint: '[E] Regarder le miroir',
      onInteract: () => {},
      canInteract: () => true,
    },
    {
      id: 'uc_terminal',
      position: new THREE.Vector3(loc.terminal.x, gy(loc.terminal.x, loc.terminal.z, 1), loc.terminal.z),
      radius: 2.5,
      hint: '[E] Lire le noyau — fin',
      onInteract: () => {},
      canInteract: () => true,
    }
  );

  const amb = new THREE.AmbientLight(0x1a0808, 0.35);
  root.add(amb);
  const hemi = new THREE.HemisphereLight(0x331818, 0x0a0505, 0.4);
  root.add(hemi);

  parent.add(root);

  return {
    group: root,
    interactables,
    neonLights,
    organMass,
    mirrorFigure,
    crtMeshes,
    badgeMeshes,
  };
}
