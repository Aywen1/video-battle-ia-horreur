import * as THREE from 'three';
import type { MaterialSet } from './Materials';

export function createBox(
  name: string,
  size: THREE.Vector3,
  position: THREE.Vector3,
  material: THREE.Material,
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z, 1, 1, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createBed(materials: MaterialSet): THREE.Group {
  const bed = new THREE.Group();
  bed.name = 'lit trop parfaitement fait';
  bed.add(createBox('sommier', new THREE.Vector3(2.25, 0.42, 3.1), new THREE.Vector3(0, 0.42, 0), materials.wood));
  bed.add(createBox('matelas', new THREE.Vector3(2.12, 0.34, 2.92), new THREE.Vector3(0, 0.82, 0.02), materials.sheet));
  bed.add(createBox('couverture pliee', new THREE.Vector3(2.16, 0.12, 1.24), new THREE.Vector3(0, 1.06, -0.76), materials.fabric));
  bed.add(createBox('oreiller gauche', new THREE.Vector3(0.78, 0.18, 0.45), new THREE.Vector3(-0.48, 1.12, 1.1), materials.sheet));
  bed.add(createBox('oreiller droit', new THREE.Vector3(0.78, 0.18, 0.45), new THREE.Vector3(0.48, 1.12, 1.1), materials.sheet));
  return bed;
}

export function createWardrobe(materials: MaterialSet): THREE.Group {
  const wardrobe = new THREE.Group();
  wardrobe.name = 'armoire modulaire';
  wardrobe.add(createBox('caisson armoire', new THREE.Vector3(1.45, 2.55, 0.58), new THREE.Vector3(0, 1.28, 0), materials.paleWood));

  const leftDoorPivot = new THREE.Group();
  leftDoorPivot.name = 'pivot porte gauche armoire';
  leftDoorPivot.position.set(-0.68, 1.28, -0.31);
  const leftDoor = createBox('porte gauche armoire', new THREE.Vector3(0.66, 2.32, 0.05), new THREE.Vector3(0.33, 0, 0), materials.wood);
  const leftHandle = createBox('poignee gauche', new THREE.Vector3(0.04, 0.42, 0.04), new THREE.Vector3(0.6, -0.06, -0.05), materials.metal);
  leftDoorPivot.add(leftDoor, leftHandle);

  const rightDoorPivot = new THREE.Group();
  rightDoorPivot.name = 'pivot porte droite armoire';
  rightDoorPivot.position.set(0.68, 1.28, -0.31);
  const rightDoor = createBox('porte droite armoire', new THREE.Vector3(0.66, 2.32, 0.05), new THREE.Vector3(-0.33, 0, 0), materials.wood);
  const rightHandle = createBox('poignee droite', new THREE.Vector3(0.04, 0.42, 0.04), new THREE.Vector3(-0.6, -0.06, -0.05), materials.metal);
  rightDoorPivot.add(rightDoor, rightHandle);

  wardrobe.add(leftDoorPivot, rightDoorPivot);
  return wardrobe;
}

export function createMannequin(materials: MaterialSet): THREE.Group {
  const mannequin = new THREE.Group();
  mannequin.name = 'personne sans visage';

  const coat = createBox('manteau sombre', new THREE.Vector3(0.5, 0.92, 0.24), new THREE.Vector3(0, 0.98, 0), materials.black);
  const chest = createBox('plastron beige', new THREE.Vector3(0.3, 0.64, 0.035), new THREE.Vector3(0, 1.02, -0.14), materials.fabric);
  const neck = createBox('cou mannequin', new THREE.Vector3(0.16, 0.18, 0.14), new THREE.Vector3(0, 1.51, 0), materials.mannequin);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.23, 1), materials.mannequin);
  head.name = 'tête sans visage';
  head.scale.set(0.82, 1.18, 0.72);
  head.position.set(0, 1.74, -0.02);
  head.castShadow = true;
  head.receiveShadow = true;

  const faceVoid = createBox('visage vide', new THREE.Vector3(0.2, 0.16, 0.018), new THREE.Vector3(0, 1.75, -0.2), materials.black);
  const leftArm = createBox('bras gauche trop long', new THREE.Vector3(0.11, 0.86, 0.11), new THREE.Vector3(-0.36, 0.94, -0.02), materials.black);
  const rightArm = createBox('bras droit trop long', new THREE.Vector3(0.11, 0.92, 0.11), new THREE.Vector3(0.36, 0.89, -0.02), materials.black);
  const leftHand = createBox('main gauche pâle', new THREE.Vector3(0.11, 0.18, 0.09), new THREE.Vector3(-0.36, 0.43, -0.04), materials.mannequin);
  const rightHand = createBox('main droite pâle', new THREE.Vector3(0.11, 0.18, 0.09), new THREE.Vector3(0.36, 0.34, -0.04), materials.mannequin);
  const leftLeg = createBox('jambe gauche noire', new THREE.Vector3(0.14, 0.88, 0.13), new THREE.Vector3(-0.13, 0.31, 0), materials.black);
  const rightLeg = createBox('jambe droite noire', new THREE.Vector3(0.14, 0.88, 0.13), new THREE.Vector3(0.13, 0.31, 0), materials.black);

  leftArm.rotation.z = -0.16;
  rightArm.rotation.z = 0.12;
  leftLeg.rotation.z = 0.04;
  rightLeg.rotation.z = -0.05;

  mannequin.add(coat, chest, neck, head, faceVoid, leftArm, rightArm, leftHand, rightHand, leftLeg, rightLeg);
  mannequin.rotation.z = -0.025;
  return mannequin;
}

export function createPaperLabel(text: string, material: THREE.Material): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Impossible de creer le panneau.');
  }

  ctx.fillStyle = '#ead7a7';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#372719';
  const fontSize = text.length > 32 ? 22 : text.length > 22 ? 30 : 42;
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, 0, 512, 12);
  ctx.fillRect(0, 116, 512, 12);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const labelMaterial = (material as THREE.MeshStandardMaterial).clone();
  labelMaterial.map = texture;
  labelMaterial.needsUpdate = true;

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), labelMaterial);
  mesh.name = text;
  return mesh;
}

export function createPriceTag(text: string): THREE.Mesh {
  const texture = createPriceTexture(text);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x8f0909,
    emissiveIntensity: 0.46,
    map: texture,
    roughness: 0.54,
    side: THREE.DoubleSide,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), material);
  mesh.name = `prix ${text}`;
  return mesh;
}

export function updatePriceTag(mesh: THREE.Mesh, text: string): void {
  const material = mesh.material as THREE.MeshStandardMaterial;
  material.map?.dispose();
  material.map = createPriceTexture(text);
  material.needsUpdate = true;
  mesh.name = `prix ${text}`;
}

function createPriceTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Impossible de créer une étiquette prix.');
  }

  ctx.fillStyle = '#b91520';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#ffefe5';
  const fontSize = text.length > 8 ? 24 : text.length > 5 ? 32 : 42;
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 58);
  ctx.font = 'bold 18px monospace';
  ctx.fillText('LIQUIDATION', 128, 98);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
