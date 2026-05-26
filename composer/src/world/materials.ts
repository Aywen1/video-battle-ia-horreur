import * as THREE from 'three';

/** Palette cohérente — low poly soigné, accents colorés */
export const COLORS = {
  metal: 0x5a6578,
  metalDark: 0x3d4a5c,
  floor: 0x2d3748,
  wall: 0x3d4a5c,
  glass: 0x88c0d0,
  crt: 0x0d1117,
  crtGlow: 0x4af0c4,
  beacon: 0xc41e1e,
  storm: 0x1a2535,
  cable: 0x1e293b,
  cableRed: 0xcc3344,
  cableBlue: 0x3366cc,
  cableYellow: 0xccaa22,
  rust: 0x6b4423,
  safetyYellow: 0xf0c040,
  safetyOrange: 0xff8c42,
  neonCyan: 0x4af0c4,
  neonAmber: 0xffb347,
  serverGreen: 0x3dd68c,
  warningRed: 0xff3344,
  concrete: 0x6b7280,
  wood: 0x8b6914,
  carpet: 0x3a4a42,
};

export function flatMetal(color = COLORS.metal): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.75,
    metalness: 0.25,
  });
}

export function paintedWall(color = COLORS.wall): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.85,
    metalness: 0.05,
  });
}

export function emissiveNeon(
  color: number,
  intensity = 1.2
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    flatShading: true,
    roughness: 0.4,
    metalness: 0.1,
  });
}

export function wetGlass(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xc8dce8,
    transparent: true,
    opacity: 0.38,
    flatShading: true,
    roughness: 0.02,
    metalness: 0.2,
    side: THREE.DoubleSide,
    emissive: 0x88aacc,
    emissiveIntensity: 0.35,
  });
}

let safetyFloorTex: THREE.CanvasTexture | null = null;

export function safetyFloor(): THREE.MeshStandardMaterial {
  if (!safetyFloorTex) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#2a3340';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#f0c040';
    for (let i = 0; i < 128; i += 32) {
      ctx.fillRect(0, i, 16, 16);
      ctx.fillRect(16, i + 16, 16, 16);
    }
    safetyFloorTex = new THREE.CanvasTexture(canvas);
    safetyFloorTex.wrapS = safetyFloorTex.wrapT = THREE.RepeatWrapping;
    safetyFloorTex.repeat.set(4, 2);
  }
  return new THREE.MeshStandardMaterial({
    map: safetyFloorTex,
    flatShading: true,
    roughness: 0.7,
    metalness: 0.2,
  });
}

let gridFloorTex: THREE.CanvasTexture | null = null;

export function gridFloor(): THREE.MeshStandardMaterial {
  if (!gridFloorTex) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1a2228';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#3dd68c';
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 128; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.stroke();
    }
    gridFloorTex = new THREE.CanvasTexture(canvas);
    gridFloorTex.wrapS = gridFloorTex.wrapT = THREE.RepeatWrapping;
    gridFloorTex.repeat.set(6, 4);
  }
  return new THREE.MeshStandardMaterial({
    map: gridFloorTex,
    flatShading: true,
    roughness: 0.65,
    metalness: 0.3,
    emissive: 0x0a2018,
    emissiveIntensity: 0.15,
  });
}

export function createSignTexture(text: string, bg = '#c41e1e'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 40);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

let rainGlassTex: THREE.CanvasTexture | null = null;
let rainGlassCtx: CanvasRenderingContext2D | null = null;

export function createRainGlassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  rainGlassCtx = canvas.getContext('2d')!;
  rainGlassTex = new THREE.CanvasTexture(canvas);
  rainGlassTex.wrapS = THREE.ClampToEdgeWrapping;
  rainGlassTex.wrapT = THREE.RepeatWrapping;
  return rainGlassTex;
}

export function updateRainGlass(t: number): void {
  if (!rainGlassTex || !rainGlassCtx) return;
  const ctx = rainGlassCtx;
  const w = 128;
  const h = 256;
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) {
    const x = (i * 17 + t * 40) % w;
    const y = ((i * 31 + t * 120) % h);
    ctx.strokeStyle = `rgba(180,210,255,${0.15 + (i % 3) * 0.08})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 1, y + 8 + (i % 4) * 2);
    ctx.stroke();
  }
  rainGlassTex.needsUpdate = true;
}

export function createCRTTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  const draw = (offset = 0) => {
    ctx.fillStyle = '#0a1210';
    ctx.fillRect(0, 0, 256, 192);

    for (let i = 0; i < 800; i++) {
      const v = Math.random() * 40;
      ctx.fillStyle = `rgba(74, 240, 196, ${v / 255})`;
      ctx.fillRect(
        Math.random() * 256,
        Math.random() * 192,
        1 + Math.random() * 2,
        1
      );
    }

    ctx.fillStyle = '#4af0c4';
    ctx.font = '10px monospace';
    ctx.fillText('BALISE 7 — RELAIS ACTIF', 12, 24 + offset);
    ctx.fillText('GPS: 48.4127 N  4.8912 W', 12, 42 + offset);
    ctx.fillText('Δ POSITION: +3.0m INT.', 12, 58 + offset);
    ctx.fillStyle = '#c41e1e';
    ctx.fillText('SIGNAL: ████████░░ 82%', 12, 78 + offset);
    ctx.fillStyle = '#6a9088';
    ctx.fillText('NE PAS TRANSMETTRE', 12, 100 + offset);
  };

  draw();
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  (tex as CanvasTextureWithUpdate).updateCRT = (t: number, coords?: string) => {
    draw(Math.sin(t * 4) * 2);
    if (coords) {
      const ctx2 = canvas.getContext('2d')!;
      ctx2.fillStyle = '#c41e1e';
      ctx2.font = '9px monospace';
      ctx2.fillText(coords, 12, 120);
    }
    tex.needsUpdate = true;
  };
  return tex;
}

interface CanvasTextureWithUpdate extends THREE.CanvasTexture {
  updateCRT?: (t: number, coords?: string) => void;
}

export interface StormSkyHandle {
  texture: THREE.CanvasTexture;
  mesh: THREE.Mesh;
  flash: (power: number) => void;
}

export function createStormSkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  drawStormSky(ctx, 0);
  const tex = new THREE.CanvasTexture(canvas);
  (tex as StormTexWithDraw).drawStorm = (flash = 0) => {
    drawStormSky(ctx, flash);
    tex.needsUpdate = true;
  };
  return tex;
}

interface StormTexWithDraw extends THREE.CanvasTexture {
  drawStorm?: (flash: number) => void;
}

export type { StormTexWithDraw };

function drawStormSky(ctx: CanvasRenderingContext2D, flash: number): void {
  const w = 512;
  const h = 256;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, flash > 0 ? '#8a9ab8' : '#5a6d85');
  grad.addColorStop(0.45, flash > 0 ? '#c8d8f0' : '#7a8fa8');
  grad.addColorStop(0.75, '#4a5a6e');
  grad.addColorStop(1, '#2a3545');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(230, 238, 255, ${(Math.random() * 0.22 + 0.05) * (1 + flash)})`;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * 120, Math.random() * 80 + 20, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createVUMeterTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#111820';
  ctx.fillRect(0, 0, 64, 32);
  const tex = new THREE.CanvasTexture(canvas);
  (tex as VUTexWithUpdate).updateVU = (levels: number[]) => {
    ctx.fillStyle = '#111820';
    ctx.fillRect(0, 0, 64, 32);
    for (let i = 0; i < levels.length; i++) {
      const h = levels[i] * 24;
      ctx.fillStyle = i < 4 ? '#3dd68c' : '#ffb347';
      ctx.fillRect(4 + i * 8, 28 - h, 5, h);
    }
    tex.needsUpdate = true;
  };
  return tex;
}

interface VUTexWithUpdate extends THREE.CanvasTexture {
  updateVU?: (levels: number[]) => void;
}
