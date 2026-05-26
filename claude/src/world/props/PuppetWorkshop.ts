/**
 * PuppetWorkshop : atelier où sont fabriquées les marionnettes M. Sourire.
 *  - 8 corps suspendus à des crochets au plafond (variantes "vide" de PuppetHost)
 *  - étagère longue avec 12 têtes alignées (mélange eyeStage 0/1/2)
 *  - établi avec patrons, bobines de fil, paire de ciseaux géants
 *  - éclairage rouge/vert blafard (PointLights basses)
 *
 * Tous les corps sont statiques (pas de PuppetHost full, juste des géométries
 * réutilisées : torse + tête + bras pendants).
 */
import {
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { PALETTE } from '../../utils/palette';
import { seededRandom, TAU } from '../../utils/math';

export interface PuppetWorkshopBuild {
  group: Group;
  colliders: Box3[];
  bodies: Mesh[]; // corps suspendus
  heads: Mesh[]; // têtes sur l'étagère
  /** Spawnpoint d'apparition initial du stalker. */
  stalkerSpawn: Vector3;
  /** Position où le stalker reste téléporté après chaque reset (en arrière du joueur). */
  stalkerHomePos: Vector3;
}

function concreteTexture(size = 256): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rng = seededRandom(311);
  // Fond béton brut
  ctx.fillStyle = '#5a5048';
  ctx.fillRect(0, 0, size, size);
  // Granulés
  for (let i = 0; i < size * 12; i++) {
    const v = rng();
    ctx.fillStyle = v < 0.5 ? `rgba(0,0,0,${v * 0.3})` : `rgba(255,255,255,${(v - 0.5) * 0.2})`;
    ctx.fillRect(rng() * size, rng() * size, 1, 1);
  }
  // Taches d'huile rouge sombre (sang séché ?)
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `rgba(60,10,12,${0.3 + rng() * 0.4})`;
    const r = 8 + rng() * 30;
    ctx.beginPath();
    ctx.arc(rng() * size, rng() * size, r, 0, TAU);
    ctx.fill();
  }
  // Lignes de joints (carrelage gros)
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= size; x += size / 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 0; y <= size; y += size / 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.needsUpdate = true;
  return tex;
}

function workshopWallTexture(size = 256): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rng = seededRandom(521);
  ctx.fillStyle = '#3a302a';
  ctx.fillRect(0, 0, size, size);
  // Stries verticales (planches)
  for (let x = 0; x < size; x += 32) {
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  // Salissures
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(60,30,10,${rng() * 0.3})`;
    const r = 3 + rng() * 12;
    ctx.beginPath();
    ctx.arc(rng() * size, rng() * size, r, 0, TAU);
    ctx.fill();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.needsUpdate = true;
  return tex;
}

function buildHangingBody(seed: number): Group {
  const g = new Group();
  // Variantes : couleur du costume légèrement différente
  const tonalities = [PALETTE.magenta, PALETTE.magentaDim, PALETTE.redDim, '#7a3a8a', '#5a2870', '#8a3060'];
  const torsoColor = tonalities[seed % tonalities.length];
  // Crochet en métal
  const hook = new Mesh(
    new CylinderGeometry(0.015, 0.015, 0.18, 8),
    flatToon({ color: '#a0a0a0', metalness: 0.9, roughness: 0.3 }),
  );
  hook.position.y = 0;
  g.add(hook);
  // Câble qui descend
  const cable = new Mesh(
    new CylinderGeometry(0.005, 0.005, 0.25, 6),
    flatToon({ color: '#1a1a1a' }),
  );
  cable.position.y = -0.24;
  g.add(cable);
  // Torse
  const torso = new Mesh(
    new CylinderGeometry(0.32, 0.42, 0.85, 10, 1),
    flatToon({ color: torsoColor, roughness: 1.0 }),
  );
  torso.position.y = -0.78;
  g.add(torso);
  // Bras pendants
  const armMat = flatToon({ color: torsoColor, roughness: 1.0 });
  for (const side of [-1, 1]) {
    const arm = new Mesh(new CylinderGeometry(0.07, 0.09, 0.55, 8), armMat);
    arm.position.set(side * 0.36, -0.80, 0);
    arm.rotation.z = side * 0.05;
    g.add(arm);
    const hand = new Mesh(
      new BoxGeometry(0.13, 0.13, 0.13),
      flatToon({ color: PALETTE.cream, roughness: 0.95 }),
    );
    hand.position.set(side * 0.40, -1.08, 0);
    g.add(hand);
  }
  // Tête manquante ? Pour 30% des corps on enlève la tête (effet "œuvre incomplète")
  if (seed % 3 !== 0) {
    const head = new Mesh(
      new SphereGeometry(0.32, 12, 10),
      flatToon({ color: '#d8b896', roughness: 0.95 }),
    );
    head.position.y = -0.20;
    g.add(head);
    // Petits points yeux (cousus)
    const eyeMat = flatToon({ color: '#1c1b1a' });
    for (const x of [-0.10, 0.10]) {
      const eye = new Mesh(new SphereGeometry(0.03, 8, 6), eyeMat);
      eye.position.set(x, -0.18, 0.30);
      g.add(eye);
    }
  } else {
    // Cou avec moignon ensanglanté
    const stump = new Mesh(
      new CylinderGeometry(0.10, 0.12, 0.10, 8),
      flatToon({ color: '#5a1a18', roughness: 1.0, emissive: '#1a0808', emissiveIntensity: 0.1 }),
    );
    stump.position.y = -0.34;
    g.add(stump);
  }
  // Léger balancement initial (le seed décale la rotation)
  g.rotation.z = (seed % 5 - 2) * 0.04;
  g.rotation.y = (seed % 7) * 0.18;
  return g;
}

function buildAlignedHead(eyeStage: 0 | 1 | 2, seed: number): Mesh {
  const head = new Mesh(
    new SphereGeometry(0.18, 14, 10),
    flatToon({ color: '#d8b896', roughness: 0.95 }),
  );
  // Petits yeux selon stage : on dessine une mini-texture simple
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#d8b896';
  ctx.fillRect(0, 0, size, size);
  // Stitches X pour stage 0
  const eyeY = size * 0.42;
  const lx = size * 0.36;
  const rx = size * 0.64;
  if (eyeStage === 0) {
    ctx.fillStyle = '#1c1b1a';
    for (const cx of [lx, rx]) {
      ctx.beginPath();
      ctx.arc(cx, eyeY, size * 0.05, 0, TAU);
      ctx.fill();
    }
  } else if (eyeStage === 1) {
    for (const cx of [lx, rx]) {
      ctx.fillStyle = '#f0e3cf';
      ctx.beginPath();
      ctx.ellipse(cx, eyeY, size * 0.06, size * 0.04, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#3a5870';
      ctx.beginPath();
      ctx.arc(cx, eyeY, size * 0.025, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1c1b1a';
      ctx.beginPath();
      ctx.arc(cx, eyeY, size * 0.012, 0, TAU);
      ctx.fill();
    }
  } else {
    for (const cx of [lx, rx]) {
      ctx.fillStyle = '#fdf6e3';
      ctx.beginPath();
      ctx.arc(cx, eyeY, size * 0.07, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5b7a3d';
      ctx.beginPath();
      ctx.arc(cx, eyeY, size * 0.035, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1c1b1a';
      ctx.beginPath();
      ctx.arc(cx, eyeY, size * 0.022, 0, TAU);
      ctx.fill();
    }
  }
  // Bouche cousue
  ctx.strokeStyle = '#1c1b1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(size * 0.36, size * 0.68);
  ctx.quadraticCurveTo(size * 0.5, size * 0.78, size * 0.64, size * 0.68);
  ctx.stroke();
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  (head.material as MeshStandardMaterial).map = tex;
  (head.material as MeshStandardMaterial).needsUpdate = true;
  head.userData.headSeed = seed;
  return head;
}

export function buildPuppetWorkshop(): PuppetWorkshopBuild {
  const group = new Group();
  // Pièce : X [-3.5, +3.5], Z [-3, +3], hauteur 3.2
  const minX = -3.5;
  const maxX = 3.5;
  const minZ = -3;
  const maxZ = 3;
  const height = 3.2;
  const lenZ = maxZ - minZ; // 6
  const widX = maxX - minX; // 7

  // Sol béton
  const floor = new Mesh(
    new PlaneGeometry(widX, lenZ),
    flatToon({ color: '#5a5048', map: concreteTexture(), roughness: 1.0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  group.add(floor);

  // Plafond sombre
  const ceiling = new Mesh(
    new PlaneGeometry(widX, lenZ),
    flatToon({ color: '#0a0a0a', roughness: 1.0 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, height, 0);
  group.add(ceiling);

  // Murs
  const wallMat = flatToon({ color: '#3a302a', map: workshopWallTexture(), roughness: 1.0, side: DoubleSide });
  const wallLeft = new Mesh(new PlaneGeometry(lenZ, height), wallMat);
  wallLeft.rotation.y = Math.PI / 2;
  wallLeft.position.set(minX, height / 2, 0);
  group.add(wallLeft);
  const wallRight = new Mesh(new PlaneGeometry(lenZ, height), wallMat);
  wallRight.rotation.y = -Math.PI / 2;
  wallRight.position.set(maxX, height / 2, 0);
  group.add(wallRight);
  // Murs face/arrière avec ouvertures gérées par BackstageRoom (on ne les
  // dessine pas ici pour laisser passer le joueur entre Régie et Théâtre).

  // Lampes blafardes : 1 rouge à gauche, 1 verte à droite
  const lampRed = new PointLight(new Color('#a02418'), 1.6, 8, 1.8);
  lampRed.position.set(minX + 1, height - 0.6, minZ + 1);
  group.add(lampRed);
  const lampGreen = new PointLight(new Color('#3aaa48'), 1.4, 8, 1.8);
  lampGreen.position.set(maxX - 1, height - 0.6, maxZ - 1);
  group.add(lampGreen);

  // Rail au plafond avec 8 corps suspendus
  const rail = new Mesh(
    new BoxGeometry(widX - 1, 0.08, 0.08),
    flatToon({ color: '#3a3a3a', metalness: 0.6, roughness: 0.5 }),
  );
  rail.position.set(0, height - 0.1, 0.5);
  group.add(rail);
  const bodies: Mesh[] = [];
  const positions = [-2.6, -1.85, -1.1, -0.35, 0.4, 1.15, 1.9, 2.65];
  for (let i = 0; i < 8; i++) {
    const body = buildHangingBody(i + 1);
    body.position.set(positions[i], height - 0.18, 0.5);
    group.add(body);
    // On garde la référence du premier mesh enfant pour bodies[]
    const firstMesh = body.children.find((c) => c instanceof Mesh) as Mesh;
    if (firstMesh) bodies.push(firstMesh);
  }

  // Étagère murale longue avec 12 têtes alignées (mur de gauche, mi-hauteur)
  const shelfBoard = new Mesh(
    new BoxGeometry(0.4, 0.04, lenZ - 0.6),
    flatToon({ color: '#4a3a22', roughness: 0.95 }),
  );
  shelfBoard.position.set(minX + 0.25, 1.30, 0);
  group.add(shelfBoard);
  const heads: Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const stage = (i % 3) as 0 | 1 | 2;
    const head = buildAlignedHead(stage, i + 1);
    head.position.set(minX + 0.25, 1.50, -2.3 + i * 0.40);
    // Face tournée vers la pièce (centre)
    head.rotation.y = -Math.PI / 2;
    group.add(head);
    heads.push(head);
  }

  // Établi (côté mur du fond)
  const bench = new Mesh(
    new BoxGeometry(1.6, 0.08, 0.7),
    flatToon({ color: '#3a2818', roughness: 1.0 }),
  );
  bench.position.set(2, 0.9, minZ + 0.9);
  group.add(bench);
  // Pieds
  for (const dx of [-0.7, 0.7]) {
    for (const dz of [-0.30, 0.30]) {
      const leg = new Mesh(
        new BoxGeometry(0.06, 0.86, 0.06),
        flatToon({ color: '#2a1c10', roughness: 0.9 }),
      );
      leg.position.set(2 + dx, 0.43, minZ + 0.9 + dz);
      group.add(leg);
    }
  }
  // Patrons (feuilles posées) — fines planes
  for (let i = 0; i < 3; i++) {
    const paper = new Mesh(
      new PlaneGeometry(0.28, 0.36),
      flatToon({ color: '#e8e2c8', roughness: 1.0 }),
    );
    paper.rotation.x = -Math.PI / 2;
    paper.position.set(1.5 + i * 0.30, 0.945, minZ + 0.8);
    paper.rotation.z = (i - 1) * 0.08;
    group.add(paper);
  }
  // Bobines de fil (cylindres colorés)
  const spoolColors = [PALETTE.yellow, PALETTE.red, PALETTE.magenta, PALETTE.green];
  for (let i = 0; i < 4; i++) {
    const spool = new Mesh(
      new CylinderGeometry(0.05, 0.05, 0.10, 12),
      flatToon({ color: spoolColors[i], roughness: 0.6 }),
    );
    spool.position.set(2.7, 1.0, minZ + 0.7 - i * 0.18);
    spool.rotation.x = Math.PI / 2;
    group.add(spool);
  }
  // Ciseaux géants (deux lames + un anneau)
  const scissorsBlade = flatToon({ color: '#c0c0c0', metalness: 0.85, roughness: 0.25 });
  const blade1 = new Mesh(new BoxGeometry(0.30, 0.02, 0.04), scissorsBlade);
  blade1.position.set(2.4, 0.96, minZ + 1.3);
  blade1.rotation.z = 0.2;
  group.add(blade1);
  const blade2 = new Mesh(new BoxGeometry(0.30, 0.02, 0.04), scissorsBlade);
  blade2.position.set(2.4, 0.96, minZ + 1.3);
  blade2.rotation.z = -0.2;
  group.add(blade2);
  const ring1 = new Mesh(
    new CylinderGeometry(0.05, 0.05, 0.02, 12),
    flatToon({ color: '#3a3a3a', roughness: 0.5 }),
  );
  ring1.position.set(2.6, 0.96 + 0.06, minZ + 1.3);
  ring1.rotation.x = Math.PI / 2;
  group.add(ring1);
  const ring2 = new Mesh(
    new CylinderGeometry(0.05, 0.05, 0.02, 12),
    flatToon({ color: '#3a3a3a', roughness: 0.5 }),
  );
  ring2.position.set(2.6, 0.96 - 0.06, minZ + 1.3);
  ring2.rotation.x = Math.PI / 2;
  group.add(ring2);

  // Murs (colliders : murs gauche/droite + une partie du fond pour ne pas
  // sortir du décor ; les ouvertures vers Régie/Théâtre sont gérées par BackstageRoom).
  const colliders: Box3[] = [
    new Box3(new Vector3(minX - 0.4, 0, minZ - 0.4), new Vector3(minX, height, maxZ + 0.4)),
    new Box3(new Vector3(maxX, 0, minZ - 0.4), new Vector3(maxX + 0.4, height, maxZ + 0.4)),
    // Établi (mince collider)
    new Box3(new Vector3(1.2, 0, minZ + 0.55), new Vector3(2.8, 1.0, minZ + 1.25)),
  ];

  return {
    group,
    colliders,
    bodies,
    heads,
    stalkerSpawn: new Vector3(0, 0, minZ + 0.5),
    stalkerHomePos: new Vector3(0, 0, minZ + 0.5),
  };
}
