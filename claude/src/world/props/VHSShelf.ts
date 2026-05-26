/**
 * VHSShelf : étagère murale avec 6 cassettes VHS interactables. Chaque
 * cassette a une étiquette texturée (nom + numéro + date). Quand le joueur
 * en prend une, elle disparaît visuellement de l'étagère (deviendra invisible)
 * et son label apparaît en HUD via setInventoryItem.
 */
import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { PALETTE } from '../../utils/palette';
import { seededRandom, TAU } from '../../utils/math';

export interface VHSCassette {
  index: number;
  group: Group;
  label: string; // "Cassette - Lucas"
  subtitle: string; // sous-titre joué quand insérée
  isKey: boolean; // n°44 = clé qui déverrouille la suite
  picked: boolean;
}

export interface VHSShelfBuild {
  group: Group;
  cassettes: VHSCassette[];
}

const CASSETTES_DATA: Array<{
  name: string;
  date: string;
  label: string;
  subtitle: string;
  isKey: boolean;
}> = [
  { name: 'LUCAS', date: '1987', label: 'Cassette - LUCAS', subtitle: '(Lucas, 1987 — il riait fort. Trop fort.)', isKey: false },
  { name: 'SOPHIE', date: '1991', label: 'Cassette - SOPHIE', subtitle: '(Sophie, 1991 — elle ne voulait plus rentrer chez elle.)', isKey: false },
  { name: 'NATHAN', date: '1994', label: 'Cassette - NATHAN', subtitle: '(Nathan, 1994 — il pose la même question, encore et encore.)', isKey: false },
  { name: 'CHLOÉ', date: '1996', label: 'Cassette - CHLOÉ', subtitle: '(Chloé, 1996 — son sourire ne bouge plus.)', isKey: false },
  { name: 'LÉA', date: '2005', label: 'Cassette - LÉA', subtitle: '(Léa, 2005 — elle dit que c\'était hier.)', isKey: false },
  { name: 'N°44', date: 'CE SOIR', label: 'Cassette - N°44', subtitle: '(N°44 — CE SOIR. C\'est ton numéro.)', isKey: true },
];

function cassetteLabelTexture(name: string, date: string, isKey: boolean, seed: number): CanvasTexture {
  const w = 256;
  const h = 96;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rng = seededRandom(seed + 7);
  // Fond étiquette papier crème / jauni
  ctx.fillStyle = isKey ? '#ffe7a0' : '#f0e2c0';
  ctx.fillRect(0, 0, w, h);
  // Bordure rouge fine
  ctx.strokeStyle = isKey ? PALETTE.red : '#a08060';
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  // Nom (gros)
  ctx.fillStyle = isKey ? PALETTE.red : '#1c1b1a';
  ctx.font = `bold ${isKey ? 30 : 26}px "Courier New", monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(name, 12, 42);
  // Date
  ctx.fillStyle = '#3a2818';
  ctx.font = '16px "Courier New", monospace';
  ctx.fillText(date, 12, 70);
  // Numéro (à droite, pour cohérence visuelle)
  ctx.fillStyle = '#5a3a18';
  ctx.font = '14px "Courier New", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`VHS-${String(seed).padStart(3, '0')}`, w - 12, 70);
  // Petite marque "PROPRIÉTÉ ÉMISSION" semi-effacée
  ctx.save();
  ctx.translate(w - 60, 20);
  ctx.rotate(-0.15);
  ctx.fillStyle = 'rgba(110,15,15,0.3)';
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ÉMISSION DE MINUIT', 0, 0);
  ctx.restore();
  // Salissures
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(80,40,10,${rng() * 0.25})`;
    const r = 1 + rng() * 4;
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * h, r, 0, TAU);
    ctx.fill();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildSingleCassette(data: typeof CASSETTES_DATA[number], index: number): VHSCassette {
  const group = new Group();
  // Boîtier VHS (épaisseur ~3cm, 19×10cm en vrai — on prend 0.20×0.11×0.04 m)
  const body = new Mesh(
    new BoxGeometry(0.21, 0.11, 0.04),
    flatToon({ color: data.isKey ? '#2a0a0a' : '#1a1a1a', roughness: 0.6 }),
  );
  group.add(body);
  // Étiquette (plan sur la face avant)
  const label = new Mesh(
    new PlaneGeometry(0.19, 0.085),
    flatToon({ map: cassetteLabelTexture(data.name, data.date, data.isKey, index + 1), roughness: 0.95 }),
  );
  label.position.set(0, 0.005, 0.021);
  group.add(label);
  // Petite fenêtre de bande (rectangle noir mat en bas)
  const window = new Mesh(
    new BoxGeometry(0.12, 0.03, 0.005),
    flatToon({ color: '#0a0a0a', emissive: '#1a0808', emissiveIntensity: 0.1 }),
  );
  window.position.set(0, -0.038, 0.021);
  group.add(window);
  return {
    index,
    group,
    label: data.label,
    subtitle: data.subtitle,
    isKey: data.isKey,
    picked: false,
  };
}

export function buildVHSShelf(): VHSShelfBuild {
  const group = new Group();
  // Planche : 6 cassettes alignées sur une étagère murale
  const board = new Mesh(
    new BoxGeometry(1.6, 0.03, 0.30),
    flatToon({ color: '#4a3a22', roughness: 0.95 }),
  );
  board.position.set(0, 0, 0);
  group.add(board);
  // Petits équerres
  const bracketMat = flatToon({ color: '#2a2a2a', roughness: 0.6, metalness: 0.4 });
  for (const x of [-0.75, 0.75]) {
    const bracket = new Mesh(new BoxGeometry(0.03, 0.10, 0.20), bracketMat);
    bracket.position.set(x, -0.07, 0);
    group.add(bracket);
  }
  const cassettes: VHSCassette[] = [];
  // 6 cassettes verticalement debout, espacées
  for (let i = 0; i < CASSETTES_DATA.length; i++) {
    const c = buildSingleCassette(CASSETTES_DATA[i], i);
    // Verticales : on les tourne pour qu'elles soient debout côté tranche
    c.group.rotation.y = Math.PI / 2;
    const xOff = -0.65 + i * 0.26;
    c.group.position.set(xOff, 0.07, 0);
    group.add(c.group);
    cassettes.push(c);
  }
  return { group, cassettes };
}
