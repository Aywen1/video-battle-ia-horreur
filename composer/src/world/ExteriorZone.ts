import * as THREE from 'three';
import {
  asphaltMaterial,
  foliageMaterial,
  realisticSkyMaterial,
  rockMaterial,
  mountainRockMaterial,
  cliffMaterial,
  gravelPathMaterial,
} from './materialsRealistic';
import { flatMetal } from './materials';
import { CLIFF_Z } from './exteriorColliders';
import {
  buildTerrainMesh,
  getTerrainHeight,
  EXTERIOR_LOCATIONS,
  TERRAIN_CENTER_Z,
  lerpPathX,
} from './exteriorTerrain';
import { Interactable } from '../entities/Interactable';
import { buildMirageRelay, buildTreelineSilhouette } from './exteriorParanormal';
import { buildTrailBloodDecals, buildBloodPoolMesh } from './exteriorBlood';

export interface ExteriorBuildResult {
  group: THREE.Group;
  buildingWindows: THREE.MeshStandardMaterial[];
  seaMesh: THREE.Mesh;
  skyMesh: THREE.Mesh;
  interactables: Interactable[];
  treelineFigure: THREE.Group;
  mirageBuilding: THREE.Group;
  relayBoxLight: THREE.PointLight;
  exteriorSun: THREE.DirectionalLight;
  exteriorHemi: THREE.HemisphereLight;
  bloodMeshes: THREE.Mesh[];
  monsterRoot: THREE.Group;
  buildingDoor: THREE.Group;
  shackGroup: THREE.Group;
}

function placeOnGround(obj: THREE.Object3D, x: number, z: number): void {
  obj.position.set(x, getTerrainHeight(x, z), z);
}

export function buildExteriorZone(parent: THREE.Group): ExteriorBuildResult {
  const root = new THREE.Group();
  const buildingWindows: THREE.MeshStandardMaterial[] = [];
  const interactables: Interactable[] = [];

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(100, 24, 16),
    realisticSkyMaterial()
  );
  sky.position.y = 25;
  root.add(sky);

  const terrain = buildTerrainMesh();
  root.add(terrain);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(6, 58), asphaltMaterial());
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.04, 22);
  road.receiveShadow = true;
  root.add(road);

  for (let z = 12; z <= 30; z += 2) {
    const t = (z - 12) / 18;
    const px = THREE.MathUtils.lerp(-10, -22, t);
    const py = getTerrainHeight(px, z) + 0.05;
    const seg = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 2.2),
      gravelPathMaterial()
    );
    seg.rotation.x = -Math.PI / 2;
    seg.position.set(px, py, z);
    root.add(seg);
    if (z % 6 === 0) {
      const cairn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.25, 0.5, 5),
        rockMaterial()
      );
      cairn.position.set(px + 1.4, py + 0.25, z);
      root.add(cairn);
    }
  }

  const arrowMat = new THREE.MeshBasicMaterial({
    color: 0xcc2222,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  for (let z = 13; z <= 28; z += 4) {
    const px = lerpPathX(z);
    const py = getTerrainHeight(px, z) + 0.07;
    const arrow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), arrowMat);
    arrow.rotation.x = -Math.PI / 2;
    arrow.rotation.z = Math.PI / 2;
    arrow.position.set(px, py, z);
    root.add(arrow);
  }

  const trailSign = new THREE.Group();
  placeOnGround(trailSign, EXTERIOR_LOCATIONS.trailSign.x, EXTERIOR_LOCATIONS.trailSign.z);
  const signPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 1.6, 6),
    flatMetal(0x666655)
  );
  signPost.position.y = 0.8;
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.7, 0.08),
    flatMetal(0x8a7a60)
  );
  signBoard.position.y = 1.55;
  trailSign.add(signPost, signBoard);
  root.add(trailSign);

  const bloodMeshes = buildTrailBloodDecals(root);

  const bloodPoolGroup = new THREE.Group();
  placeOnGround(bloodPoolGroup, EXTERIOR_LOCATIONS.bloodPool.x, EXTERIOR_LOCATIONS.bloodPool.z);
  const poolMesh = buildBloodPoolMesh();
  poolMesh.position.y = 0.05;
  bloodPoolGroup.add(poolMesh);
  const poolLight = new THREE.PointLight(0xff2222, 0.4, 4);
  poolLight.position.y = 0.3;
  bloodPoolGroup.add(poolLight);
  root.add(bloodPoolGroup);
  bloodMeshes.push(poolMesh);

  const bodyGroup = new THREE.Group();
  placeOnGround(bodyGroup, EXTERIOR_LOCATIONS.hangingBody.x, EXTERIOR_LOCATIONS.hangingBody.z);
  const branch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 2.4, 5),
    new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.9 })
  );
  branch.rotation.z = Math.PI / 2;
  branch.position.set(0.6, 2.8, 0);
  const corpse = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.4, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x4a2020, roughness: 0.95 })
  );
  corpse.position.set(0.9, 1.6, 0);
  corpse.rotation.z = 0.25;
  const rope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4),
    flatMetal(0x332211)
  );
  rope.position.set(0.75, 2.2, 0);
  bodyGroup.add(branch, corpse, rope);
  root.add(bodyGroup);

  const shackGroup = new THREE.Group();
  placeOnGround(shackGroup, EXTERIOR_LOCATIONS.shack.x, EXTERIOR_LOCATIONS.shack.z);
  shackGroup.rotation.y = 0.35;
  const shackWalls = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 2.4, 2.8),
    new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.92 })
  );
  shackWalls.position.y = 1.2;
  const shackRoof = new THREE.Mesh(
    new THREE.ConeGeometry(2.4, 1.2, 4),
    new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9 })
  );
  shackRoof.position.y = 2.7;
  shackRoof.rotation.y = Math.PI / 4;
  const shackDoor = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.6, 0.08),
    flatMetal(0x221a12)
  );
  shackDoor.position.set(0, 0.8, 1.41);
  shackGroup.add(shackWalls, shackRoof, shackDoor);
  root.add(shackGroup);

  const monsterRoot = new THREE.Group();
  root.add(monsterRoot);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 50, 16, 8),
    new THREE.MeshStandardMaterial({
      color: 0x2a5070,
      roughness: 0.4,
      metalness: 0.1,
      emissive: 0x0a2030,
      emissiveIntensity: 0.2,
    })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -2, CLIFF_Z - 10);
  root.add(sea);

  for (let i = 0; i < 5; i++) {
    const cliff = new THREE.Mesh(
      new THREE.BoxGeometry(18, 4 + i * 0.5, 3),
      cliffMaterial()
    );
    cliff.position.set(-12 + i * 6, 1.5, CLIFF_Z + 1);
    cliff.rotation.x = -0.15;
    root.add(cliff);
  }

  for (let i = 0; i < 16; i++) {
    const mx = -32 + (i % 4) * 5 + Math.random() * 2;
    const mz = 8 + Math.floor(i / 4) * 10 + Math.random() * 4;
    const h = 6 + Math.random() * 10;
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(3 + Math.random() * 4, h, 6),
      mountainRockMaterial()
    );
    placeOnGround(mountain, mx, mz);
    mountain.position.y += h / 2;
    root.add(mountain);
    for (let r = 0; r < 2; r++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.8 + Math.random(), 0),
        rockMaterial()
      );
      placeOnGround(rock, mx + (Math.random() - 0.5) * 4, mz + (Math.random() - 0.5) * 4);
      rock.position.y += 0.4;
      root.add(rock);
    }
  }

  for (let i = 0; i < 18; i++) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 2.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 })
    );
    trunk.position.y = 1.1;
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 8, 6),
      foliageMaterial(0x2a6b38 + (i % 3) * 0x020202)
    );
    leaves.position.y = 2.6;
    tree.add(trunk, leaves);
    const tx = -24 + (i % 6) * 7 + (i % 2);
    const tz = -8 + Math.floor(i / 6) * 14;
    if (Math.abs(tx) < 5 && tz > 0 && tz < 20) continue;
    placeOnGround(tree, tx, tz);
    root.add(tree);
  }

  const building = new THREE.Group();
  placeOnGround(building, 0, -8);
  const body = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 8), flatMetal(0x4a5568));
  body.position.y = 2;
  building.add(body);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      const winMat = new THREE.MeshStandardMaterial({
        color: 0x8899aa,
        emissive: 0x223344,
        emissiveIntensity: 0.1,
        roughness: 0.2,
        metalness: 0.3,
      });
      buildingWindows.push(winMat);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1), winMat);
      win.position.set(-3.6 + col * 2.4, 1.5 + row * 1.8, 4.01);
      building.add(win);
    }
  }
  root.add(building);

  const buildingDoor = new THREE.Group();
  buildingDoor.position.set(0, getTerrainHeight(0, -4) + 1.1, -4);
  const doorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 2.2, 0.12),
    flatMetal(0x334455)
  );
  buildingDoor.add(doorMesh);
  root.add(buildingDoor);

  const marker = new THREE.Group();
  placeOnGround(marker, EXTERIOR_LOCATIONS.marker.x, EXTERIOR_LOCATIONS.marker.z);
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 1.4, 6),
    flatMetal(0x888888)
  );
  post.position.y = 0.7;
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.5, 0.06),
    flatMetal(0xcccccc)
  );
  sign.position.y = 1.35;
  marker.add(post, sign);
  root.add(marker);

  const wreck = new THREE.Group();
  placeOnGround(wreck, EXTERIOR_LOCATIONS.wreck.x, EXTERIOR_LOCATIONS.wreck.z);
  wreck.rotation.y = 0.4;
  const carBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.9, 4),
    new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.8 })
  );
  carBody.position.y = 0.55;
  const carRoof = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.7, 2),
    new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.85 })
  );
  carRoof.position.set(0, 1.2, -0.3);
  wreck.add(carBody, carRoof);
  root.add(wreck);

  const cross = new THREE.Group();
  placeOnGround(cross, EXTERIOR_LOCATIONS.cross.x, EXTERIOR_LOCATIONS.cross.z);
  const crossV = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 2.2, 0.12),
    flatMetal(0x666666)
  );
  crossV.position.y = 1.1;
  const crossH = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.12, 0.12),
    flatMetal(0x666666)
  );
  crossH.position.y = 1.6;
  cross.add(crossV, crossH);
  root.add(cross);

  const relayBox = new THREE.Group();
  placeOnGround(relayBox, EXTERIOR_LOCATIONS.relayBox.x, EXTERIOR_LOCATIONS.relayBox.z);
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.0, 0.5),
    flatMetal(0x2a3544)
  );
  box.position.y = 0.5;
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4),
    flatMetal(0x8899aa)
  );
  antenna.position.y = 1.3;
  relayBox.add(box, antenna);
  root.add(relayBox);

  const relayBoxLight = new THREE.PointLight(0x44ff88, 0, 8);
  relayBoxLight.position.set(
    EXTERIOR_LOCATIONS.relayBox.x,
    getTerrainHeight(EXTERIOR_LOCATIONS.relayBox.x, EXTERIOR_LOCATIONS.relayBox.z) + 1,
    EXTERIOR_LOCATIONS.relayBox.z
  );
  root.add(relayBoxLight);

  const barrier = new THREE.Group();
  placeOnGround(barrier, EXTERIOR_LOCATIONS.barrier.x, EXTERIOR_LOCATIONS.barrier.z);
  const barL = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 1.2, 3),
    flatMetal(0xcc4444)
  );
  barL.position.set(-1.5, 0.6, 0);
  const barR = barL.clone();
  barR.position.x = 1.5;
  const barSign = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.6, 0.08),
    flatMetal(0xddddcc)
  );
  barSign.position.y = 1.4;
  barrier.add(barL, barR, barSign);
  root.add(barrier);

  const treelineFigure = buildTreelineSilhouette();
  placeOnGround(treelineFigure, -18, 14);
  treelineFigure.position.y += 0.9;
  root.add(treelineFigure);

  const mirageBuilding = buildMirageRelay();
  mirageBuilding.position.set(-8, getTerrainHeight(-8, 38) + 2, 38);
  root.add(mirageBuilding);

  const hemi = new THREE.HemisphereLight(0xb8d4f0, 0x3a5030, 1.4);
  root.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
  sun.position.set(15, 25, 10);
  sun.castShadow = true;
  root.add(sun);

  const loc = EXTERIOR_LOCATIONS;
  interactables.push(
    {
      id: 'ext_marker',
      position: loc.marker.clone().setY(1.2),
      radius: 3,
      hint: '[E] Lire la borne kilométrique',
      onInteract: () => {},
      canInteract: () => true,
    },
    {
      id: 'ext_wreck',
      position: loc.wreck.clone().setY(1),
      radius: 3.5,
      hint: '[E] Fouiller l\'épave',
      onInteract: () => {},
      canInteract: () => true,
    },
    {
      id: 'ext_blood',
      position: loc.bloodPool.clone().setY(0.8),
      radius: 2.5,
      hint: '[E] Examiner la flaque de sang',
      onInteract: () => {},
      canInteract: () => true,
    },
    {
      id: 'ext_body',
      position: loc.hangingBody.clone().setY(1.5),
      radius: 3,
      hint: '[E] Examiner le corps',
      onInteract: () => {},
      canInteract: () => true,
    },
    {
      id: 'ext_cross',
      position: loc.cross.clone().setY(1.5),
      radius: 3,
      hint: '[E] Examiner la croix',
      onInteract: () => {},
      canInteract: () => true,
    },
    {
      id: 'ext_shack',
      position: loc.shack.clone().setY(1.2),
      radius: 3,
      hint: '[E] Lire le journal dans la cabane',
      onInteract: () => {},
      canInteract: () => true,
    },
    {
      id: 'ext_relay',
      position: loc.relayBox.clone().setY(1),
      radius: 2.8,
      hint: '[E] Réparer le boîtier relais',
      onInteract: () => {},
      canInteract: () => true,
    },
    {
      id: 'ext_door',
      position: loc.buildingDoor.clone().setY(1.2),
      radius: 2.5,
      hint: '[E] Ouvrir la porte du relais',
      onInteract: () => {},
      canInteract: () => true,
    },
    {
      id: 'ext_barrier',
      position: loc.barrier.clone().setY(1.2),
      radius: 4,
      hint: '[E] Atteindre la barrière',
      onInteract: () => {},
      canInteract: () => true,
    }
  );

  parent.add(root);

  return {
    group: root,
    buildingWindows,
    seaMesh: sea,
    skyMesh: sky,
    interactables,
    treelineFigure,
    mirageBuilding,
    relayBoxLight,
    exteriorSun: sun,
    exteriorHemi: hemi,
    bloodMeshes,
    monsterRoot,
    buildingDoor,
    shackGroup,
  };
}

export function lightBuildingWindows(
  windows: THREE.MeshStandardMaterial[],
  count: number,
  intensity = 1.2
): void {
  windows.forEach((mat, i) => {
    if (i < count) {
      mat.emissive.setHex(0xffcc66);
      mat.emissiveIntensity = intensity;
    }
  });
}

export { TERRAIN_CENTER_Z };
