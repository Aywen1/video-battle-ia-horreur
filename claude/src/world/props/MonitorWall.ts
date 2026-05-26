/**
 * MonitorWall : grille 3×3 de moniteurs CRT empilés. Chaque écran montre par
 * défaut le visage figé d'un "ancien invité" avec un nom et une date. Quand
 * on déclenche showWebcam(), tous les écrans switchent simultanément sur le
 * flux webcam du joueur (effet "tu es à présent l'invité").
 */
import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  PlaneGeometry,
  SRGBColorSpace,
  Texture,
  VideoTexture,
} from 'three';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { CRTScreenMaterial } from '../../rendering/materials/CRTScreenMaterial';
import { PALETTE } from '../../utils/palette';
import { seededRandom, TAU } from '../../utils/math';

const NAMES_DATES: Array<[string, string]> = [
  ['LUCAS', '1987'],
  ['SOPHIE', '1991'],
  ['NATHAN', '1994'],
  ['CHLOÉ', '1996'],
  ['HUGO', '2001'],
  ['LÉA', '2005'],
  ['NOAH', '2009'],
  ['ZOÉ', '2013'],
  ['N°44', 'CE SOIR'],
];

interface MonitorUnit {
  index: number;
  group: Group;
  screen: Mesh;
  childTex: CanvasTexture;
  webcamTex: Texture | null;
  crtMat: CRTScreenMaterial;
  state: 'face' | 'webcam' | 'static';
  staticBuf: Uint8ClampedArray | null;
}

export interface MonitorWallBuild {
  group: Group;
  monitors: MonitorUnit[];
  /** Bascule tous les écrans sur la webcam du joueur (climax phase B). */
  showWebcam(): void;
  /** Bascule en static blanc/noir (effet glitch). */
  showStatic(): void;
  /** Update du shader CRT (à appeler chaque frame). */
  update(time: number): void;
  dispose(): void;
}

function childFaceTexture(name: string, date: string, seed: number, size = 256): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rng = seededRandom(seed * 41 + 11);
  // Fond bleu sombre (VHS pause)
  ctx.fillStyle = '#0c1820';
  ctx.fillRect(0, 0, size, size);
  // Halo flou central (style projecteur)
  const grad = ctx.createRadialGradient(size / 2, size * 0.45, 10, size / 2, size * 0.45, size * 0.6);
  grad.addColorStop(0, 'rgba(255,210,180,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // Visage : ovale crème
  ctx.fillStyle = '#f0d6b0';
  ctx.beginPath();
  ctx.ellipse(size / 2, size * 0.45, size * 0.22, size * 0.28, 0, 0, TAU);
  ctx.fill();
  // Cheveux : calotte sombre
  ctx.fillStyle = ['#3a2010', '#1a1612', '#5a3a18', '#a85e1f'][seed % 4];
  ctx.beginPath();
  ctx.ellipse(size / 2, size * 0.30, size * 0.24, size * 0.18, 0, 0, TAU);
  ctx.fill();
  // Yeux : 2 points noirs (figés, "absents")
  ctx.fillStyle = '#1c1b1a';
  const eyeY = size * 0.42;
  ctx.beginPath();
  ctx.arc(size * 0.42, eyeY, size * 0.020, 0, TAU);
  ctx.arc(size * 0.58, eyeY, size * 0.020, 0, TAU);
  ctx.fill();
  // Cernes
  ctx.fillStyle = 'rgba(60,30,40,0.4)';
  ctx.beginPath();
  ctx.ellipse(size * 0.42, eyeY + size * 0.018, size * 0.04, size * 0.018, 0, 0, TAU);
  ctx.ellipse(size * 0.58, eyeY + size * 0.018, size * 0.04, size * 0.018, 0, 0, TAU);
  ctx.fill();
  // Bouche : ligne fine (pas de sourire — c'est ce qui dérange)
  ctx.strokeStyle = '#5a2218';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(size * 0.43, size * 0.58);
  ctx.lineTo(size * 0.57, size * 0.58);
  ctx.stroke();
  // Carte ID en bas
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, size * 0.83, size, size * 0.17);
  ctx.fillStyle = PALETTE.yellow;
  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(name, 14, size * 0.91);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = '18px "Courier New", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(date, size - 14, size * 0.91);
  // Petit grain VHS
  for (let i = 0; i < size * 8; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rng() * 0.06})`;
    ctx.fillRect(rng() * size, rng() * size, 1, 1);
  }
  // Une ligne de tracking horizontale aléatoire
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, size * (0.2 + rng() * 0.5), size, 2);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function staticTexture(size = 128): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const v = Math.random() * 255;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(i, j, 1, 1);
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function buildMonitorWall(webcamVideo: HTMLVideoElement | null): MonitorWallBuild {
  const group = new Group();
  const monitors: MonitorUnit[] = [];
  // Grille 3×3 de CRT empilés ; chaque CRT ~ 0.55 × 0.42 m + bezel
  const cols = 3;
  const rows = 3;
  const cellW = 0.62;
  const cellH = 0.55;
  const startX = -((cols - 1) * cellW) / 2;
  const startY = 0.7; // bas du moniteur le plus bas
  const webTex = webcamVideo ? new VideoTexture(webcamVideo) : null;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const unitGroup = new Group();
      const x = startX + c * cellW;
      const y = startY + (rows - 1 - r) * cellH;
      unitGroup.position.set(x, y, 0);
      // Carcasse (boîtier CRT)
      const housing = new Mesh(
        new BoxGeometry(cellW * 0.95, cellH * 0.95, 0.35),
        flatToon({ color: '#2a2a2a', roughness: 0.7 }),
      );
      housing.position.set(0, 0, -0.13);
      unitGroup.add(housing);
      // Bezel intérieur
      const bezel = new Mesh(
        new PlaneGeometry(cellW * 0.7, cellH * 0.7),
        flatToon({ color: '#0a0a0a', roughness: 0.4 }),
      );
      bezel.position.set(0, 0, 0.045);
      unitGroup.add(bezel);
      // Écran (shader CRT)
      const childTex = childFaceTexture(NAMES_DATES[idx][0], NAMES_DATES[idx][1], idx + 1);
      const crtMat = new CRTScreenMaterial(childTex, {
        chromatic: 0.005,
        intensity: 1.0,
        mirror: false,
      });
      const screen = new Mesh(new PlaneGeometry(cellW * 0.62, cellH * 0.62), crtMat);
      screen.position.set(0, 0, 0.05);
      unitGroup.add(screen);
      // Petit voyant rouge
      const led = new Mesh(
        new BoxGeometry(0.02, 0.02, 0.005),
        flatToon({ color: PALETTE.red, emissive: PALETTE.red, emissiveIntensity: 1.4 }),
      );
      led.position.set(cellW * 0.4, -cellH * 0.4, 0.05);
      unitGroup.add(led);

      group.add(unitGroup);
      monitors.push({
        index: idx,
        group: unitGroup,
        screen,
        childTex,
        webcamTex: webTex,
        crtMat,
        state: 'face',
        staticBuf: null,
      });
    }
  }

  return {
    group,
    monitors,
    showWebcam(): void {
      for (const m of monitors) {
        if (m.webcamTex) {
          m.crtMat.setMap(m.webcamTex);
          m.state = 'webcam';
        } else {
          m.crtMat.setMap(staticTexture());
          m.state = 'static';
        }
      }
    },
    showStatic(): void {
      for (const m of monitors) {
        m.crtMat.setMap(staticTexture(96));
        m.state = 'static';
      }
    },
    update(time: number): void {
      for (const m of monitors) {
        // L'intensité monte un poil en mode webcam pour souligner le moment
        m.crtMat.update(time, m.state === 'webcam' ? 1.3 : 1.0);
      }
    },
    dispose(): void {
      for (const m of monitors) {
        m.childTex.dispose();
        m.crtMat.dispose();
      }
    },
  };
}
