/**
 * BackstageCorridor : tunnel d'entrée des coulisses.
 *  - Sol carrelé sale (damier crème/charbon avec taches)
 *  - Murs panneaux gris industriels + plinthes rouillées
 *  - 3 néons défaillants au plafond (clignotent)
 *  - 4 affiches déchirées de "L'ÉMISSION DE MINUIT"
 *
 * Toutes les textures sont procédurales (canvas2D). Le couloir occupe
 * X = [-1.6, +1.6], Z = [9, 17], hauteur 2.5m. Le joueur entre par +Z (z=17)
 * et sort par -Z (z=9, débouchant sur la régie).
 */
import {
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { PALETTE } from '../../utils/palette';
import { seededRandom, TAU } from '../../utils/math';

export interface CorridorBuild {
  group: Group;
  colliders: Box3[];
  /** Néons défaillants — animés par animateCorridor. */
  neons: Array<{
    panel: Mesh;
    light: PointLight;
    seed: number;
    onLevel: number;
    nextEventAt: number;
    isOn: boolean;
    flickerDuration: number;
  }>;
  /** Affiches déchirées (Mesh plan). */
  posters: Mesh[];
  /** Z de l'extrémité Régie (sortie). */
  exitZ: number;
}

function tiledFloorTexture(size = 256): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rng = seededRandom(73);
  const cells = 8;
  const cellSize = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const dark = (x + y) % 2 === 0;
      ctx.fillStyle = dark ? '#2a2424' : '#a89a7b';
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      // Taches
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `rgba(${dark ? 0 : 30},${dark ? 0 : 20},${dark ? 0 : 15},${rng() * 0.35})`;
        const r = 2 + rng() * 6;
        ctx.beginPath();
        ctx.arc(
          x * cellSize + rng() * cellSize,
          y * cellSize + rng() * cellSize,
          r,
          0,
          TAU,
        );
        ctx.fill();
      }
      // Joint
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }
  // Salissure globale
  for (let i = 0; i < size * 8; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rng() * 0.10})`;
    ctx.fillRect(rng() * size, rng() * size, 1, 1);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(2, 4);
  tex.needsUpdate = true;
  return tex;
}

function wallPanelTexture(size = 256): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rng = seededRandom(101);
  // Fond gris industriel
  ctx.fillStyle = '#4a4842';
  ctx.fillRect(0, 0, size, size);
  // Panneaux horizontaux (3 bandes)
  for (let i = 0; i < 3; i++) {
    const y = (i + 1) * (size / 4);
    ctx.strokeStyle = '#2a2826';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
    // Reflet
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y - 1);
    ctx.lineTo(size, y - 1);
    ctx.stroke();
  }
  // Rivets aux coins
  ctx.fillStyle = '#1c1a18';
  for (let i = 0; i < 3; i++) {
    const y = (i + 1) * (size / 4);
    for (const x of [8, size - 8]) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, TAU);
      ctx.fill();
    }
  }
  // Taches de rouille et grain
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(110,50,20,${rng() * 0.35})`;
    const r = 2 + rng() * 8;
    ctx.beginPath();
    ctx.arc(rng() * size, rng() * size, r, 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < size * 20; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rng() * 0.12})`;
    ctx.fillRect(rng() * size, rng() * size, 1, 1);
  }
  // Plinthe rouillée en bas
  ctx.fillStyle = '#6a3a1c';
  ctx.fillRect(0, size - 20, size, 20);
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rng() * 0.5})`;
    ctx.fillRect(rng() * size, size - 20 + rng() * 18, 1 + rng() * 3, 1);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.needsUpdate = true;
  return tex;
}

function tornPosterTexture(seed: number, size = 256): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rng = seededRandom(seed * 11 + 3);
  // Fond magenta brûlé
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, PALETTE.magentaDim);
  grad.addColorStop(0.4, '#2a0a20');
  grad.addColorStop(1, PALETTE.charcoal);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // Titre
  ctx.fillStyle = PALETTE.yellow;
  ctx.font = 'bold 28px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText("L'ÉMISSION", size / 2, size * 0.25);
  ctx.fillText('DE MINUIT', size / 2, size * 0.36);
  // Sous-titre
  ctx.fillStyle = PALETTE.cream;
  ctx.font = '14px "Courier New", monospace';
  ctx.fillText('CHAQUE NUIT À MINUIT', size / 2, size * 0.50);
  ctx.fillText('AVEC M. SOURIRE', size / 2, size * 0.58);
  // Petit smiley
  ctx.fillStyle = PALETTE.yellow;
  ctx.beginPath();
  ctx.arc(size / 2, size * 0.75, size * 0.10, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1c1b1a';
  ctx.beginPath();
  ctx.arc(size * 0.46, size * 0.73, size * 0.012, 0, TAU);
  ctx.arc(size * 0.54, size * 0.73, size * 0.012, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#1c1b1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(size / 2, size * 0.77, size * 0.05, 0, Math.PI);
  ctx.stroke();
  // Déchirures : on efface des polygones aléatoires
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    const cx = rng() * size;
    const cy = rng() * size;
    const steps = 6 + Math.floor(rng() * 4);
    for (let j = 0; j < steps; j++) {
      const a = (j / steps) * TAU;
      const r = 20 + rng() * 70;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  // Bord supérieur déchiqueté
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 0; i <= 10; i++) {
    ctx.lineTo((i / 10) * size, rng() * 14);
  }
  ctx.lineTo(size, 0);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // Bavures sombres aléatoires
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.3 + rng() * 0.4})`;
    const w = 6 + rng() * 24;
    const h = 1 + rng() * 4;
    ctx.fillRect(rng() * size, rng() * size, w, h);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function buildBackstageCorridor(): CorridorBuild {
  const group = new Group();
  const minX = -1.5;
  const maxX = 1.5;
  const minZ = 9;
  const maxZ = 17;
  const height = 2.5;
  const lenZ = maxZ - minZ; // 8
  const widX = maxX - minX; // 3

  // Sol
  const floorTex = tiledFloorTexture();
  const floor = new Mesh(
    new PlaneGeometry(widX, lenZ),
    flatToon({ color: PALETTE.cream, map: floorTex, roughness: 0.85 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  group.add(floor);

  // Plafond
  const ceiling = new Mesh(
    new PlaneGeometry(widX, lenZ),
    flatToon({ color: '#1a1816', roughness: 1.0 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set((minX + maxX) / 2, height, (minZ + maxZ) / 2);
  group.add(ceiling);

  // Murs (gauche, droite, fond ; le devant est ouvert vers la régie en z=minZ)
  const wallTex = wallPanelTexture();
  const wallMat = flatToon({ color: '#4a4842', map: wallTex, roughness: 0.9 });
  const wallLeft = new Mesh(new PlaneGeometry(lenZ, height), wallMat.clone());
  wallLeft.rotation.y = Math.PI / 2;
  wallLeft.position.set(minX, height / 2, (minZ + maxZ) / 2);
  group.add(wallLeft);
  const wallRight = new Mesh(new PlaneGeometry(lenZ, height), wallMat.clone());
  wallRight.rotation.y = -Math.PI / 2;
  wallRight.position.set(maxX, height / 2, (minZ + maxZ) / 2);
  group.add(wallRight);
  // Mur du fond (côté +Z, où le joueur arrive)
  const wallBack = new Mesh(new PlaneGeometry(widX, height), wallMat.clone());
  wallBack.position.set((minX + maxX) / 2, height / 2, maxZ);
  wallBack.rotation.y = Math.PI;
  group.add(wallBack);

  // Néons défaillants (3 panneaux au plafond)
  const neons: CorridorBuild['neons'] = [];
  const neonPositions = [maxZ - 1.4, (minZ + maxZ) / 2, minZ + 1.4];
  for (let i = 0; i < 3; i++) {
    const panel = new Mesh(
      new BoxGeometry(0.8, 0.05, 0.18),
      flatToon({
        color: '#e8e2d0',
        emissive: PALETTE.cream,
        emissiveIntensity: 0.9,
        roughness: 0.4,
      }),
    );
    panel.position.set(0, height - 0.05, neonPositions[i]);
    group.add(panel);
    // Petite source ponctuelle pour éclairer
    const pl = new PointLight(new Color('#f4e9d8'), 1.2, 5, 1.4);
    pl.position.set(0, height - 0.2, neonPositions[i]);
    group.add(pl);
    neons.push({
      panel,
      light: pl,
      seed: i * 17 + 3,
      onLevel: 1,
      nextEventAt: 1 + i * 0.7,
      isOn: true,
      flickerDuration: 0,
    });
  }

  // Affiches déchirées : 4 au mur (2 à gauche, 2 à droite)
  const posters: Mesh[] = [];
  const posterPlan = [
    { side: 'left' as const, z: maxZ - 2.0 },
    { side: 'right' as const, z: maxZ - 3.6 },
    { side: 'left' as const, z: minZ + 3.4 },
    { side: 'right' as const, z: minZ + 1.8 },
  ];
  posterPlan.forEach((p, i) => {
    const poster = new Mesh(
      new PlaneGeometry(0.75, 1.0),
      new MeshStandardMaterial({
        map: tornPosterTexture(i + 1),
        transparent: true,
        roughness: 1.0,
      }),
    );
    if (p.side === 'left') {
      poster.position.set(minX + 0.01, 1.5, p.z);
      poster.rotation.y = Math.PI / 2;
    } else {
      poster.position.set(maxX - 0.01, 1.5, p.z);
      poster.rotation.y = -Math.PI / 2;
    }
    group.add(poster);
    posters.push(poster);
  });

  // Colliders : murs gauche / droite / fond. Le bas reste ouvert pour entrer en régie.
  const colliders: Box3[] = [
    new Box3(new Vector3(minX - 0.5, 0, minZ - 0.5), new Vector3(minX, height, maxZ + 0.5)),
    new Box3(new Vector3(maxX, 0, minZ - 0.5), new Vector3(maxX + 0.5, height, maxZ + 0.5)),
    new Box3(new Vector3(minX - 0.5, 0, maxZ), new Vector3(maxX + 0.5, height, maxZ + 0.5)),
  ];

  return { group, colliders, neons, posters, exitZ: minZ };
}

/**
 * Anime les néons : tirage stochastique d'événements de coupure / crépitement.
 * onFlickerEvent est appelé à chaque "ON brutal" (pour jouer un son).
 */
export function animateCorridor(
  build: CorridorBuild,
  time: number,
  dt: number,
  onFlickerEvent?: () => void,
): void {
  for (const n of build.neons) {
    // Petit vacillement permanent
    const tremor = Math.sin(time * 9 + n.seed) * 0.06 + Math.sin(time * 23 + n.seed * 1.3) * 0.03;
    // Tirage stochastique d'un événement
    if (time >= n.nextEventAt) {
      // Switch entre on/off ou flicker rapide
      if (n.isOn) {
        n.isOn = false;
        n.flickerDuration = 0.05 + Math.random() * 0.35;
      } else {
        n.isOn = true;
        n.flickerDuration = 0;
        onFlickerEvent?.();
      }
      n.nextEventAt = time + (n.isOn ? 1.5 + Math.random() * 3.5 : 0.05 + Math.random() * 0.4);
    }
    const target = n.isOn ? 1 + tremor : Math.random() < 0.3 ? 0.25 : 0.0;
    n.onLevel = n.onLevel * 0.6 + target * 0.4;
    const intensity = Math.max(0, n.onLevel);
    n.light.intensity = 1.2 * intensity;
    const mat = n.panel.material as MeshStandardMaterial;
    mat.emissiveIntensity = 0.9 * intensity;
  }
}
