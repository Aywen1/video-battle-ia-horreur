/**
 * AudienceTheater : la "Scène B" — salle de cinéma INVERSÉE. 6 rangées de
 * fauteuils vintage rouges (12 par rangée) sur un sol incliné, dont
 * ~30 sièges sont peuplés de silhouettes en cire (anciens invités figés).
 *
 * La scène est de l'autre côté (côté écran). Le joueur entre face aux
 * fauteuils et doit ressentir que C'EST LUI le spectacle.
 *
 * Le présentateur sombre est dans la 3e rangée et est exposé séparément
 * (darkHost) pour pouvoir l'animer dans la cinématique finale.
 */
import {
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
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

export interface TheaterSilhouette {
  group: Group;
  /** Tête (pour pouvoir l'orienter dans la cinématique). */
  head: Group;
  row: number;
  col: number;
  /** True pour la silhouette qui sera "le présentateur" (3e rangée, milieu). */
  isHost: boolean;
}

export interface AudienceTheaterBuild {
  group: Group;
  colliders: Box3[];
  silhouettes: TheaterSilhouette[];
  /** Référence directe au présentateur sombre. */
  darkHost: TheaterSilhouette;
  /** Position de l'écran (pour le projecteur). */
  screenAnchor: Vector3;
  /** Pos du joueur quand il "fait face à l'écran" (anchor cinématique). */
  facePlayerPos: Vector3;
}

function carpetTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rng = seededRandom(891);
  ctx.fillStyle = '#3a0a14';
  ctx.fillRect(0, 0, size, size);
  // Motif géométrique en losanges (style cinéma)
  ctx.strokeStyle = 'rgba(220,170,90,0.18)';
  ctx.lineWidth = 1;
  for (let y = 0; y < size; y += 16) {
    ctx.beginPath();
    for (let x = -16; x < size + 16; x += 32) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 16, y + 8);
      ctx.moveTo(x + 16, y);
      ctx.lineTo(x, y + 8);
    }
    ctx.stroke();
  }
  // Salissures
  for (let i = 0; i < size * 8; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rng() * 0.12})`;
    ctx.fillRect(rng() * size, rng() * size, 1, 1);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(3, 4);
  tex.needsUpdate = true;
  return tex;
}

function buildVintageSeat(): Group {
  const g = new Group();
  // Assise
  const seat = new Mesh(
    new BoxGeometry(0.50, 0.10, 0.45),
    flatToon({ color: '#6a1018', roughness: 1.0 }),
  );
  seat.position.y = 0.45;
  g.add(seat);
  // Dossier (haut)
  const back = new Mesh(
    new BoxGeometry(0.50, 0.95, 0.10),
    flatToon({ color: '#6a1018', roughness: 1.0 }),
  );
  back.position.set(0, 0.95, -0.18);
  g.add(back);
  // Accoudoirs
  for (const side of [-1, 1]) {
    const arm = new Mesh(
      new BoxGeometry(0.05, 0.12, 0.45),
      flatToon({ color: '#3a0814', roughness: 1.0 }),
    );
    arm.position.set(side * 0.27, 0.55, 0);
    g.add(arm);
  }
  // Pied central
  const leg = new Mesh(
    new CylinderGeometry(0.07, 0.10, 0.40, 8),
    flatToon({ color: '#1a1a1a', metalness: 0.4, roughness: 0.6 }),
  );
  leg.position.y = 0.20;
  g.add(leg);
  // Petit liseré crème sur le dossier
  const piping = new Mesh(
    new BoxGeometry(0.50, 0.02, 0.005),
    flatToon({ color: PALETTE.cream, emissive: PALETTE.cream, emissiveIntensity: 0.05 }),
  );
  piping.position.set(0, 1.40, -0.115);
  g.add(piping);
  return g;
}

function waxFaceTexture(seed: number): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rng = seededRandom(seed * 23 + 5);
  // Visage cire pâle
  ctx.fillStyle = '#d8c4a8';
  ctx.fillRect(0, 0, size, size);
  // Yeux fermés (lignes courtes)
  ctx.strokeStyle = '#3a2818';
  ctx.lineWidth = 2;
  const eyeY = size * 0.42;
  ctx.beginPath();
  ctx.moveTo(size * 0.30, eyeY);
  ctx.quadraticCurveTo(size * 0.36, eyeY + 4, size * 0.42, eyeY);
  ctx.moveTo(size * 0.58, eyeY);
  ctx.quadraticCurveTo(size * 0.64, eyeY + 4, size * 0.70, eyeY);
  ctx.stroke();
  // Bouche très fine (à peine ouverte)
  ctx.beginPath();
  ctx.moveTo(size * 0.40, size * 0.66);
  ctx.lineTo(size * 0.60, size * 0.66);
  ctx.stroke();
  // Joues très légèrement rosées (presque rien)
  ctx.fillStyle = 'rgba(200,100,80,0.10)';
  ctx.beginPath();
  ctx.arc(size * 0.30, size * 0.55, 8, 0, TAU);
  ctx.arc(size * 0.70, size * 0.55, 8, 0, TAU);
  ctx.fill();
  // Salissures / craquelures de cire
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(100,80,60,${0.2 + rng() * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rng() * size, rng() * size);
    ctx.lineTo(rng() * size, rng() * size);
    ctx.stroke();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildWaxSilhouette(seed: number, isHost: boolean): TheaterSilhouette {
  const group = new Group();
  const head = new Group();
  // Corps : torse assis + jambes (mais cachées par le siège)
  const torsoColor = isHost ? '#1a1a1a' : ['#5a4a3a', '#3a3a4a', '#4a3a4a', '#2a2a2a'][seed % 4];
  const torso = new Mesh(
    new CylinderGeometry(0.20, 0.28, 0.65, 8, 1),
    flatToon({ color: torsoColor, roughness: 1.0 }),
  );
  torso.position.y = 0.35;
  group.add(torso);
  // Bras le long du corps
  for (const side of [-1, 1]) {
    const arm = new Mesh(
      new CylinderGeometry(0.06, 0.07, 0.45, 6),
      flatToon({ color: torsoColor, roughness: 1.0 }),
    );
    arm.position.set(side * 0.22, 0.42, 0.02);
    group.add(arm);
  }
  // Col / chemise crème pour le host
  if (isHost) {
    const collar = new Mesh(
      new CylinderGeometry(0.18, 0.20, 0.10, 8),
      flatToon({ color: PALETTE.cream, roughness: 0.95 }),
    );
    collar.position.y = 0.68;
    group.add(collar);
    // Cravate noire
    const tie = new Mesh(
      new BoxGeometry(0.05, 0.30, 0.02),
      flatToon({ color: '#0a0a0a', roughness: 0.6 }),
    );
    tie.position.set(0, 0.52, 0.15);
    group.add(tie);
  }
  // Tête
  const headMesh = new Mesh(
    new SphereGeometry(0.15, 12, 10),
    flatToon({
      color: isHost ? '#e8d8c0' : '#d8c4a8',
      map: waxFaceTexture(seed + (isHost ? 100 : 0)),
      roughness: 1.0,
    }),
  );
  head.add(headMesh);
  if (isHost) {
    // Cheveux noirs courts
    const hair = new Mesh(
      new SphereGeometry(0.16, 12, 10, 0, TAU, 0, Math.PI / 2.3),
      flatToon({ color: '#1a1612', roughness: 1.0 }),
    );
    hair.position.y = 0.02;
    head.add(hair);
  } else {
    // Cheveux variés
    const hairColors = ['#3a2010', '#5a3a18', '#a85e1f', '#1a1612'];
    const hair = new Mesh(
      new SphereGeometry(0.16, 12, 10, 0, TAU, 0, Math.PI / 2.0),
      flatToon({ color: hairColors[seed % 4], roughness: 1.0 }),
    );
    hair.position.y = 0.02;
    head.add(hair);
  }
  // Tête légèrement inclinée (sauf host qui regarde droit devant)
  if (!isHost) {
    head.rotation.x = 0.15 + (seed % 5 - 2) * 0.03;
    head.rotation.z = (seed % 3 - 1) * 0.05;
  }
  head.position.y = 0.85;
  group.add(head);
  return { group, head, row: 0, col: 0, isHost };
}

export function buildAudienceTheater(): AudienceTheaterBuild {
  const group = new Group();
  // Salle : X [-6, +6], Z [-13, -3], hauteur 4
  const minX = -5.5;
  const maxX = 5.5;
  const minZ = -13;
  const maxZ = -3;
  const height = 4.0;
  const lenZ = maxZ - minZ; // 10
  const widX = maxX - minX; // 11

  // Sol incliné (les fauteuils s'élèvent vers le fond/-Z)
  const floor = new Mesh(
    new PlaneGeometry(widX, lenZ),
    flatToon({ color: '#3a0a14', map: carpetTexture(), roughness: 1.0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, (minZ + maxZ) / 2);
  // Inclinaison très légère (~5°) — pour le visuel sans casser la physique
  floor.rotation.z = -0.04;
  group.add(floor);

  // Plafond voûté (utilise un cylindre tronqué)
  const ceiling = new Mesh(
    new CylinderGeometry(8, 8, lenZ, 16, 1, true, Math.PI * 1.3, Math.PI * 0.4),
    flatToon({ color: '#1a0a18', roughness: 1.0 }),
  );
  ceiling.rotation.z = Math.PI / 2;
  ceiling.position.set(0, height + 3.0, (minZ + maxZ) / 2);
  group.add(ceiling);

  // Murs
  const wallMat = flatToon({ color: '#3a1a30', roughness: 1.0 });
  const wallLeft = new Mesh(new PlaneGeometry(lenZ, height), wallMat);
  wallLeft.rotation.y = Math.PI / 2;
  wallLeft.position.set(minX, height / 2, (minZ + maxZ) / 2);
  group.add(wallLeft);
  const wallRight = new Mesh(new PlaneGeometry(lenZ, height), wallMat);
  wallRight.rotation.y = -Math.PI / 2;
  wallRight.position.set(maxX, height / 2, (minZ + maxZ) / 2);
  group.add(wallRight);
  // Mur du fond (côté écran, où le projecteur sera placé)
  const wallScreen = new Mesh(new PlaneGeometry(widX, height), flatToon({ color: '#0a0a0a', roughness: 1.0 }));
  wallScreen.position.set(0, height / 2, minZ);
  group.add(wallScreen);

  // Quelques lampes en applique (rouge sombre)
  for (const x of [minX + 0.05, maxX - 0.05]) {
    for (const z of [minZ + 2.5, maxZ - 1.5]) {
      const sconce = new Mesh(
        new SphereGeometry(0.15, 8, 6),
        flatToon({
          color: PALETTE.red,
          emissive: PALETTE.red,
          emissiveIntensity: 1.2,
          roughness: 0.6,
        }),
      );
      sconce.position.set(x, 2.6, z);
      group.add(sconce);
      const pl = new PointLight(new Color('#a02418'), 0.6, 5, 1.8);
      pl.position.set(x, 2.6, z);
      group.add(pl);
    }
  }

  // 6 rangées de fauteuils. La rangée 1 (la plus proche de l'écran) est à
  // z=maxZ - 1.5, et chaque rangée recule de 0.9m vers -Z.
  // 12 fauteuils par rangée, séparés de 0.55m. ~30 sont peuplés.
  const seatsPerRow = 12;
  const rowCount = 6;
  const rowSpacing = 1.0;
  const seatSpacing = 0.60;
  const rowStartZ = maxZ - 1.8; // 1ère rangée
  const seatStartX = -((seatsPerRow - 1) * seatSpacing) / 2;

  const silhouettes: TheaterSilhouette[] = [];
  let darkHost: TheaterSilhouette | null = null;
  const occupiedPlan: boolean[][] = [];
  const rng = seededRandom(421);
  for (let r = 0; r < rowCount; r++) {
    occupiedPlan.push([]);
    for (let c = 0; c < seatsPerRow; c++) {
      // Densité décroissante avec les rangées arrières
      const density = 0.7 - r * 0.05;
      occupiedPlan[r][c] = rng() < density;
    }
  }
  // Force la silhouette host à row=2, col=6 (3e rangée, centre)
  occupiedPlan[2][6] = true;

  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < seatsPerRow; c++) {
      const seat = buildVintageSeat();
      const z = rowStartZ - r * rowSpacing;
      // Surélévation par rangée (sol incliné effet visuel)
      const y = r * 0.12;
      seat.position.set(seatStartX + c * seatSpacing, y, z);
      // Les fauteuils sont tournés vers le joueur (+Z) - donc face = +Z
      seat.rotation.y = Math.PI;
      group.add(seat);
      if (occupiedPlan[r][c]) {
        const isHost = r === 2 && c === 6;
        const sil = buildWaxSilhouette(r * seatsPerRow + c, isHost);
        sil.row = r;
        sil.col = c;
        sil.group.position.set(seatStartX + c * seatSpacing, y + 0.55, z);
        sil.group.rotation.y = Math.PI;
        group.add(sil.group);
        silhouettes.push(sil);
        if (isHost) darkHost = sil;
      }
    }
  }
  if (!darkHost) {
    // Fallback : crée un host à part si jamais
    const fallback = buildWaxSilhouette(999, true);
    fallback.group.position.set(0, 0.91, rowStartZ - 2 * rowSpacing);
    fallback.group.rotation.y = Math.PI;
    group.add(fallback.group);
    silhouettes.push(fallback);
    darkHost = fallback;
  }

  // Estrade côté écran
  const stage = new Mesh(
    new BoxGeometry(widX, 0.40, 1.6),
    flatToon({ color: '#1a1a1a', roughness: 1.0 }),
  );
  stage.position.set(0, 0.20, minZ + 0.8);
  group.add(stage);

  // Colliders : murs + fauteuils en bloc (par rangée) + estrade
  const colliders: Box3[] = [
    // Murs
    new Box3(new Vector3(minX - 0.4, 0, minZ - 0.4), new Vector3(minX, height, maxZ + 0.4)),
    new Box3(new Vector3(maxX, 0, minZ - 0.4), new Vector3(maxX + 0.4, height, maxZ + 0.4)),
    new Box3(new Vector3(minX - 0.4, 0, minZ - 0.4), new Vector3(maxX + 0.4, height, minZ + 0.05)),
    // Estrade
    new Box3(new Vector3(minX, 0, minZ + 0.05), new Vector3(maxX, 0.45, minZ + 1.65)),
  ];
  // Rangées de fauteuils — un long pavé qui bloque
  for (let r = 0; r < rowCount; r++) {
    const z = rowStartZ - r * rowSpacing;
    const y = r * 0.12;
    colliders.push(
      new Box3(
        new Vector3(seatStartX - 0.3, y, z - 0.35),
        new Vector3(seatStartX + (seatsPerRow - 1) * seatSpacing + 0.3, y + 1.6, z + 0.25),
      ),
    );
  }

  return {
    group,
    colliders,
    silhouettes,
    darkHost: darkHost!,
    screenAnchor: new Vector3(0, 2.2, minZ + 0.5),
    facePlayerPos: new Vector3(0, 1.65, maxZ - 0.8),
  };
}

/**
 * Anime les silhouettes (oscillations imperceptibles + le présentateur
 * peut être animé pour "se lever").
 */
export function animateAudienceTheater(
  build: AudienceTheaterBuild,
  time: number,
): void {
  for (const s of build.silhouettes) {
    if (s.isHost) continue;
    // Micro-oscillation respiration
    s.group.position.y +=
      Math.sin(time * 0.6 + s.row * 1.3 + s.col * 0.7) * 0.0006;
  }
}

/**
 * Fait "se lever et se tourner" le présentateur sombre vers la cible.
 * `progress` 0..1 (animation pilotée par la BackstageRoom).
 */
export function darkHostRise(
  build: AudienceTheaterBuild,
  progress: number,
  facingPos: Vector3,
): void {
  const host = build.darkHost;
  const k = Math.max(0, Math.min(1, progress));
  // 1) Lent décollage du fauteuil (Y monte)
  host.group.position.y = 0.91 + k * 0.7;
  // 2) Rotation vers le joueur (yaw)
  const dx = facingPos.x - host.group.position.x;
  const dz = facingPos.z - host.group.position.z;
  const targetYaw = Math.atan2(dx, dz);
  // De Math.PI (assis face écran) vers targetYaw (face joueur)
  const startYaw = Math.PI;
  host.group.rotation.y = startYaw + (targetYaw - startYaw) * k;
  // 3) Tête se redresse
  host.head.rotation.x = (1 - k) * 0.1;
}
