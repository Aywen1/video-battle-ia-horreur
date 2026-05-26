import * as THREE from 'three';

export type MaterialSet = ReturnType<typeof createMaterials>;

export function createMaterials(): Record<string, THREE.MeshStandardMaterial> {
  return {
    wall: new THREE.MeshStandardMaterial({ color: 0x9f9789, roughness: 0.92, metalness: 0.02, flatShading: true }),
    floor: new THREE.MeshStandardMaterial({ color: 0x302b29, roughness: 0.98, flatShading: true, map: makeCanvasTexture('floor') }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0x17191e, roughness: 0.9, flatShading: true }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6b4c36, roughness: 0.82, flatShading: true, map: makeCanvasTexture('wood') }),
    paleWood: new THREE.MeshStandardMaterial({ color: 0xb18d65, roughness: 0.78, flatShading: true, map: makeCanvasTexture('wood') }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x655f68, roughness: 0.95, flatShading: true, map: makeCanvasTexture('fabric') }),
    sheet: new THREE.MeshStandardMaterial({ color: 0xd9d2c7, roughness: 0.86, flatShading: true }),
    black: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.75, flatShading: true }),
    metal: new THREE.MeshStandardMaterial({ color: 0x5f656b, roughness: 0.52, metalness: 0.35, flatShading: true }),
    sign: new THREE.MeshStandardMaterial({ color: 0xf2dfad, roughness: 0.65, flatShading: true, emissive: 0x251b0d, emissiveIntensity: 0.18 }),
    mannequin: new THREE.MeshStandardMaterial({ color: 0xc9b7a0, roughness: 0.8, flatShading: true }),
    supernatural: new THREE.MeshStandardMaterial({ color: 0x83ffd6, emissive: 0x31f5c4, emissiveIntensity: 1.9, roughness: 0.4, flatShading: true }),
    mirror: new THREE.MeshStandardMaterial({ color: 0x59616b, metalness: 0.55, roughness: 0.18, flatShading: true, transparent: true, opacity: 0.72 }),
  };
}

function makeCanvasTexture(kind: 'floor' | 'wood' | 'fabric'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Impossible de creer une texture canvas.');
  }

  const base = kind === 'floor' ? '#302b29' : kind === 'wood' ? '#7a5437' : '#625c65';
  const line = kind === 'fabric' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.18)';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 900; i += 1) {
    const shade = Math.floor(Math.random() * 32);
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.08)`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }

  ctx.strokeStyle = line;
  ctx.lineWidth = kind === 'floor' ? 2 : 1;
  const step = kind === 'fabric' ? 10 : 24;
  for (let x = 0; x < 128; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (kind === 'wood' ? 10 : 0), 128);
    ctx.stroke();
  }

  if (kind === 'wood') {
    for (let y = 18; y < 128; y += 31) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y + Math.sin(y) * 4);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'floor' ? 5 : 2, kind === 'floor' ? 5 : 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
