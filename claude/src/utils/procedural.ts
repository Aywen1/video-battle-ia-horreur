/**
 * Générateurs procéduraux : textures via Canvas2D et géométries custom.
 * Tout asset visuel non-primitif passe par une fonction de ce fichier.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  NearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three';
import { PALETTE } from './palette';
import { seededRandom, TAU } from './math';

/* -------------------------------------------------------------------------- */
/*                              Textures via canvas                           */
/* -------------------------------------------------------------------------- */

function makeCanvas(size: number): { ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  return { ctx, canvas };
}

function toTexture(canvas: HTMLCanvasElement, opts: { repeat?: number; filter?: 'linear' | 'nearest' } = {}): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = opts.repeat ? RepeatWrapping : ClampToEdgeWrapping;
  if (opts.repeat) tex.repeat.set(opts.repeat, opts.repeat);
  if (opts.filter === 'nearest') {
    tex.magFilter = NearestFilter;
    tex.minFilter = NearestFilter;
  } else {
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearFilter;
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * Plancher de studio : moquette bleue à grain large, légèrement irrégulière.
 */
export function carpetTexture(size = 256): Texture {
  const { ctx, canvas } = makeCanvas(size);
  const rng = seededRandom(1337);
  ctx.fillStyle = PALETTE.blueDim;
  ctx.fillRect(0, 0, size, size);
  // Grain dense de petits points cyan-blue plus clairs ou plus sombres
  for (let i = 0; i < size * size * 0.18; i++) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    const v = rng();
    if (v < 0.5) ctx.fillStyle = `rgba(91,192,235,${0.10 + v * 0.20})`;
    else ctx.fillStyle = `rgba(0,0,0,${0.05 + (v - 0.5) * 0.25})`;
    ctx.fillRect(x, y, 1, 1);
  }
  return toTexture(canvas, { repeat: 6 });
}

/**
 * Rideau de velours rouge : bandes verticales avec ombres douces.
 */
export function curtainTexture(size = 256): Texture {
  const { ctx, canvas } = makeCanvas(size);
  const bands = 12;
  const bandW = size / bands;
  for (let i = 0; i < bands; i++) {
    const grad = ctx.createLinearGradient(i * bandW, 0, (i + 1) * bandW, 0);
    grad.addColorStop(0, '#3a0610');
    grad.addColorStop(0.5, PALETTE.red);
    grad.addColorStop(1, '#3a0610');
    ctx.fillStyle = grad;
    ctx.fillRect(i * bandW, 0, bandW, size);
  }
  const rng = seededRandom(99);
  for (let i = 0; i < size * 40; i++) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.fillStyle = `rgba(0,0,0,${rng() * 0.08})`;
    ctx.fillRect(x, y, 1, 1);
  }
  return toTexture(canvas, { repeat: 1 });
}

/**
 * Marque "X" rouge au sol (gros gaffer croisé).
 */
export function stageMarkTexture(size = 256): Texture {
  const { ctx, canvas } = makeCanvas(size);
  ctx.clearRect(0, 0, size, size);
  ctx.lineCap = 'round';
  ctx.strokeStyle = PALETTE.red;
  ctx.lineWidth = size * 0.18;
  const m = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(m, m);
  ctx.lineTo(size - m, size - m);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size - m, m);
  ctx.lineTo(m, size - m);
  ctx.stroke();
  // Bruit léger pour donner un aspect adhésif un peu usé
  const rng = seededRandom(7);
  for (let i = 0; i < size * 8; i++) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.fillStyle = `rgba(0,0,0,${rng() * 0.18})`;
    ctx.fillRect(x, y, 1, 1);
  }
  return toTexture(canvas);
}

/**
 * Carton "cue card" : papier jaune-crème avec texte au marqueur (paramétrable).
 */
export function cueCardTexture(text: string, width = 512, height = 384): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  // Fond papier
  ctx.fillStyle = PALETTE.cream;
  ctx.fillRect(0, 0, width, height);
  // Bord
  ctx.strokeStyle = '#a09076';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, width - 16, height - 16);
  // Texte tracé "marqueur"
  ctx.fillStyle = '#1c1b1a';
  ctx.font = 'bold 48px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapLines(ctx, text, width - 60);
  const lineH = 56;
  const startY = height / 2 - ((lines.length - 1) * lineH) / 2;
  lines.forEach((l, i) => ctx.fillText(l, width / 2, startY + i * lineH));
  // Tâches d'usure
  const rng = seededRandom(text.length * 13);
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(120,90,40,${rng() * 0.15})`;
    const r = 4 + rng() * 14;
    ctx.beginPath();
    ctx.arc(rng() * width, rng() * height, r, 0, TAU);
    ctx.fill();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const test = current ? current + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Visage de marionnette spectateur : œil rond + sourire trop large dessiné sur tissu.
 * Le paramètre `variant` change la couleur du tissu et la forme du sourire.
 */
export function audienceFaceTexture(variant: number, size = 256): Texture {
  const { ctx, canvas } = makeCanvas(size);
  const rng = seededRandom(variant * 17 + 3);
  // Fond tissu (couleur tirée de la palette)
  const fabricColors = [PALETTE.yellow, PALETTE.green, PALETTE.blue, PALETTE.magenta, PALETTE.cream];
  const base = fabricColors[variant % fabricColors.length];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // Grain feutrine
  for (let i = 0; i < size * 30; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rng() * 0.10})`;
    ctx.fillRect(rng() * size, rng() * size, 1, 1);
  }
  // Yeux
  const eyeR = size * 0.07;
  const eyeY = size * 0.42;
  ctx.fillStyle = '#1c1b1a';
  ctx.beginPath();
  ctx.arc(size * 0.36, eyeY, eyeR, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(size * 0.64, eyeY, eyeR, 0, TAU);
  ctx.fill();
  // Reflet
  ctx.fillStyle = PALETTE.cream;
  ctx.beginPath();
  ctx.arc(size * 0.34, eyeY - eyeR * 0.3, eyeR * 0.3, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(size * 0.62, eyeY - eyeR * 0.3, eyeR * 0.3, 0, TAU);
  ctx.fill();
  // Sourire trop large
  ctx.strokeStyle = '#1c1b1a';
  ctx.lineWidth = size * 0.025;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const wMouth = 0.42 + (rng() - 0.5) * 0.08;
  const mouthY = size * 0.66;
  ctx.moveTo(size * (0.5 - wMouth / 2), mouthY);
  ctx.quadraticCurveTo(size * 0.5, mouthY + size * 0.16, size * (0.5 + wMouth / 2), mouthY);
  ctx.stroke();
  // Petites dents pour les variants pairs
  if (variant % 2 === 0) {
    ctx.fillStyle = PALETTE.cream;
    const teeth = 6;
    for (let i = 0; i < teeth; i++) {
      const tx = size * (0.5 - wMouth / 2 + ((i + 0.5) / teeth) * wMouth);
      const ty = mouthY + size * 0.05;
      ctx.fillRect(tx - 3, ty, 6, 8);
    }
  }
  return toTexture(canvas);
}

/* -------------------------------------------------------------------------- */
/*                              Géométries custom                             */
/* -------------------------------------------------------------------------- */

/**
 * Drapé de rideau : grille de quads avec sommets en arcs pour simuler des plis.
 */
export function curtainGeometry(width: number, height: number, folds = 14): BufferGeometry {
  const cols = folds * 2; // chaque fold = creux + crête
  const rows = 12;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= cols; x++) {
      const u = x / cols;
      const v = y / rows;
      const px = (u - 0.5) * width;
      const py = (v - 0.5) * height;
      // Profondeur Z sinusoïdale (les plis sortent vers le joueur)
      const pz = Math.cos(u * folds * TAU) * 0.18;
      // Léger affaissement en bas (rideau qui touche le sol)
      const sag = Math.sin(v * Math.PI) * 0.05;
      positions.push(px, py, pz - sag);
      uvs.push(u, v);
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const a = y * (cols + 1) + x;
      const b = a + 1;
      const c = a + (cols + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
