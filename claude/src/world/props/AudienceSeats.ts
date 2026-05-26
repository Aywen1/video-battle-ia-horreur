/**
 * Gradins d'audience plongés dans le noir, avec une rangée visible de
 * marionnettes-spectateurs aux sourires trop larges. Chaque tête a un visage
 * texturé légèrement différent. Animation : très légère respiration.
 */
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { audienceFaceTexture } from '../../utils/procedural';
import { PALETTE } from '../../utils/palette';
import { damp } from '../../utils/math';

export interface AudienceBuild {
  group: Group;
  heads: Mesh[];
  bodies: Mesh[];
  armsLeft: Mesh[];
  armsRight: Mesh[];
  /** Bouches : petits boxes noirs sur le visage qui s'ouvrent (scale.y). */
  mouths: Mesh[];
  /** Rotation Y de base de chaque tête (utilisée pour le retour). */
  headBaseYaw: number[];
  /** Position monde de référence pour chaque tête (calcul lookAt). */
  headWorldPos: Vector3[];
  /** Y de base de chaque body (pour standing offset). */
  bodyBaseY: number[];
  /** Y de base de chaque tête (1.55) pour standing offset. */
  headBaseY: number[];
  /** Phase d'applaudissement en cours (0 = inactif). */
  applauseTimer: number;
  applauseIntensity: number;
  /** Index de la marionnette "watcher" (toujours en lookAt partiel). */
  watcherIndex: number;
  /** Etat d'inclinaison (0 = droit, 1 = penché en avant). */
  bodyLeanT: number;
  /** Etat de standing (0 = assis, 1 = debout). */
  standT: number;
  /** Etat de hands-up (0 = bras applaudissants, 1 = bras leves au ciel). */
  handsUpT: number;
  /** Mode "freeze cri" : tous les seats figes en posture de hurlement. */
  frozenScream: boolean;
  /** Timestamp du dernier mouth chain (pour decay). */
  mouthChainTime: number;
}

export function buildAudience(): AudienceBuild {
  const group = new Group();
  const heads: Mesh[] = [];
  const bodies: Mesh[] = [];
  const armsLeft: Mesh[] = [];
  const armsRight: Mesh[] = [];
  const mouths: Mesh[] = [];
  const headBaseYaw: number[] = [];
  const headWorldPos: Vector3[] = [];
  const bodyBaseY: number[] = [];
  const headBaseY: number[] = [];

  // Gradins en pente : 3 plateformes a Z et Y croissants pour effet stade
  const rowConfigs = [
    { z: 5.6, baseY: 0.0, bodyY: 0.85, headY: 1.55 },
    { z: 6.8, baseY: 0.5, bodyY: 1.35, headY: 2.05 },
    { z: 8.0, baseY: 1.0, bodyY: 1.85, headY: 2.55 },
  ];
  for (const cfg of rowConfigs) {
    const plat = new Mesh(
      new BoxGeometry(13, 0.3, 1.4),
      flatToon({ color: PALETTE.charcoal, roughness: 0.95 }),
    );
    plat.position.set(0, cfg.baseY + 0.15, cfg.z);
    group.add(plat);
  }
  // Marche etroite tout au fond
  const stepBack = new Mesh(
    new BoxGeometry(13, 0.3, 1.2),
    flatToon({ color: PALETTE.charcoal, roughness: 0.95 }),
  );
  stepBack.position.set(0, 1.5 + 0.15, 9.0);
  group.add(stepBack);

  const fabricColors = [
    PALETTE.yellow,
    PALETTE.green,
    PALETTE.blue,
    PALETTE.magenta,
    PALETTE.red,
    PALETTE.cream,
  ];

  let globalIndex = 0;
  for (let row = 0; row < rowConfigs.length; row++) {
    const cfg = rowConfigs[row];
    const seatsInRow = 9; // 9 marionnettes par rangee
    for (let i = 0; i < seatsInRow; i++) {
      // Decalage de demi-pas pour les rangees impaires (gradins en quinconce)
      const xOffset = row % 2 === 0 ? 0 : 0.5;
      const x = (i - (seatsInRow - 1) / 2) * 1.1 + xOffset * 1.1;
      const z = cfg.z;
      const variant = globalIndex % 6;

      // Petite variation de taille pour eviter le clone army
      const sizeJitter = 0.92 + ((globalIndex * 37) % 10) / 100;
      const bodyHeight = 1.1 * sizeJitter;
      const headRadius = 0.32 * sizeJitter;
      const bodyY = cfg.bodyY * sizeJitter + (1 - sizeJitter) * 0.4;
      const headY = cfg.headY * sizeJitter + (1 - sizeJitter) * 0.4;

      // Corps
      const bodyColor = fabricColors[(globalIndex * 3) % fabricColors.length];
      const body = new Mesh(
        new CylinderGeometry(0.30 * sizeJitter, 0.40 * sizeJitter, bodyHeight, 10, 1),
        flatToon({ color: bodyColor, roughness: 0.95 }),
      );
      body.position.set(x, bodyY, z);
      bodyBaseY.push(bodyY);
      group.add(body);
      bodies.push(body);

      // Bras (pivots a partir des epaules)
      const armColor = bodyColor;
      const armPivotL = new Group();
      armPivotL.position.set(x - 0.28 * sizeJitter, bodyY + 0.55 * sizeJitter, z + 0.15);
      const armL = new Mesh(
        new BoxGeometry(0.13 * sizeJitter, 0.42 * sizeJitter, 0.13 * sizeJitter),
        flatToon({ color: armColor, roughness: 0.95 }),
      );
      armL.position.y = -0.20 * sizeJitter;
      armPivotL.add(armL);
      armPivotL.rotation.z = -0.4;
      group.add(armPivotL);
      armsLeft.push(armL);

      const armPivotR = new Group();
      armPivotR.position.set(x + 0.28 * sizeJitter, bodyY + 0.55 * sizeJitter, z + 0.15);
      const armR = new Mesh(
        new BoxGeometry(0.13 * sizeJitter, 0.42 * sizeJitter, 0.13 * sizeJitter),
        flatToon({ color: armColor, roughness: 0.95 }),
      );
      armR.position.y = -0.20 * sizeJitter;
      armPivotR.add(armR);
      armPivotR.rotation.z = 0.4;
      group.add(armPivotR);
      armsRight.push(armR);

      // Tete
      const head = new Mesh(
        new SphereGeometry(headRadius, 14, 10),
        flatToon({
          color: PALETTE.cream,
          map: audienceFaceTexture(variant),
          roughness: 0.9,
          emissive: '#180812',
          emissiveIntensity: 0.15,
        }),
      );
      head.position.set(x, headY, z);
      const baseYaw =
        (i - (seatsInRow - 1) / 2) * 0.03 + (Math.random() - 0.5) * 0.10;
      head.rotation.y = baseYaw;
      headBaseYaw.push(baseYaw);
      headBaseY.push(headY);
      headWorldPos.push(new Vector3(x, headY, z));
      group.add(head);
      heads.push(head);
      armL.userData.pivot = armPivotL;
      armR.userData.pivot = armPivotR;

      // Bouche
      const mouth = new Mesh(
        new BoxGeometry(0.10 * sizeJitter, 0.04, 0.04),
        flatToon({ color: '#1c0608', emissive: '#5a0010', emissiveIntensity: 0.4, roughness: 0.9 }),
      );
      mouth.position.set(0, -0.05, -0.30);
      mouth.scale.set(1, 1, 1);
      head.add(mouth);
      mouths.push(mouth);

      globalIndex++;
    }
  }

  // Mur du fond suggere par un plane noir
  const wallBack = new Mesh(
    new PlaneGeometry(14, 4),
    new MeshBasicMaterial({
      color: new Color(PALETTE.charcoal),
      transparent: true,
      opacity: 0.9,
      side: DoubleSide,
      fog: true,
    }),
  );
  wallBack.position.set(0, 3.5, 9.5);
  group.add(wallBack);

  return {
    group,
    heads,
    bodies,
    armsLeft,
    armsRight,
    mouths,
    headBaseYaw,
    headWorldPos,
    bodyBaseY,
    headBaseY,
    applauseTimer: 0,
    applauseIntensity: 0,
    watcherIndex: 3,
    bodyLeanT: 0,
    standT: 0,
    handsUpT: 0,
    frozenScream: false,
    mouthChainTime: 0,
  };
}

/**
 * Respiration + applique standing offset + lean + hands-up + applaudissements.
 * Si frozenScream est actif, le state lean/stand/hands-up est fige a la posture
 * "hurlement silencieux" (debout, bras au ciel, penche en avant).
 */
export function animateAudience(build: AudienceBuild, time: number, dt: number): void {
  const lean = build.bodyLeanT * 0.55;
  const standY = build.standT * 0.55;
  for (let i = 0; i < build.bodies.length; i++) {
    const breathe = Math.sin(time * 0.6 + i * 1.7) * 0.012;
    build.bodies[i].position.y = build.bodyBaseY[i] + standY + breathe;
    build.bodies[i].rotation.x = lean;
    build.bodies[i].scale.y = 1 + breathe * 0.4;
    build.heads[i].position.y = build.headBaseY[i] + standY - build.bodyLeanT * 0.15 + breathe;
    build.heads[i].position.z = build.headWorldPos[i].z - build.bodyLeanT * 0.30;
    build.heads[i].rotation.x = lean * 0.6;
  }

  // Hands-up : interpole rotation Z des pivots vers les bras leves au ciel
  const hu = build.handsUpT;
  if (hu > 0.001 && build.applauseTimer <= 0 && !build.frozenScream) {
    // Cible : bras au ciel = pivot.rotation.z = +/- 2.4 (pour les 2 bras)
    for (let i = 0; i < build.armsLeft.length; i++) {
      const pivotL = build.armsLeft[i].userData.pivot as Group | undefined;
      const pivotR = build.armsRight[i].userData.pivot as Group | undefined;
      const sway = Math.sin(time * 3 + i * 0.7) * hu * 0.25;
      if (pivotL) pivotL.rotation.z = -0.4 + hu * (-1.6 + sway);
      if (pivotR) pivotR.rotation.z = 0.4 + hu * (1.6 + sway);
    }
  }

  // Applaudissements : 6 cycles/sec sur la durée du timer
  if (build.applauseTimer > 0) {
    const remaining = build.applauseTimer;
    const swing = Math.sin(time * 22) * 0.7 * build.applauseIntensity * Math.min(1, remaining * 2);
    for (let i = 0; i < build.armsLeft.length; i++) {
      const pivotL = build.armsLeft[i].userData.pivot as Group | undefined;
      const pivotR = build.armsRight[i].userData.pivot as Group | undefined;
      if (pivotL && pivotR) {
        pivotL.rotation.z = -0.4 + swing;
        pivotR.rotation.z = 0.4 - swing;
      }
    }
    build.applauseTimer -= dt;
    if (build.applauseTimer <= 0) {
      // Retour à la position neutre (sauf si handsUp ou frozen)
      if (build.handsUpT < 0.05 && !build.frozenScream) {
        for (let i = 0; i < build.armsLeft.length; i++) {
          const pivotL = build.armsLeft[i].userData.pivot as Group | undefined;
          const pivotR = build.armsRight[i].userData.pivot as Group | undefined;
          if (pivotL) pivotL.rotation.z = -0.4;
          if (pivotR) pivotR.rotation.z = 0.4;
        }
      }
      build.applauseTimer = 0;
      build.applauseIntensity = 0;
    }
  }
}

/**
 * Anime les bouches en mexican wave : chaque seat ouvre la bouche en cascade
 * de gauche a droite. L'amplitude depend du niveau micro.
 */
export function audienceMexicanWave(build: AudienceBuild, time: number, level: number): void {
  if (build.frozenScream) return;
  const amp = Math.min(1.4, level * 1.8);
  for (let i = 0; i < build.mouths.length; i++) {
    const phase = time * 5 - i * 0.45;
    const open = Math.max(0, Math.sin(phase)) * amp;
    const m = build.mouths[i];
    m.scale.y = 1 + open * 3.0;
    m.scale.x = 1 + open * 0.5;
  }
}

/** Interpole `bodyLeanT` vers `target` (0..1). */
export function audienceLeanForward(build: AudienceBuild, target: number, dt: number): void {
  if (build.frozenScream) return;
  build.bodyLeanT = damp(build.bodyLeanT, Math.max(0, Math.min(1, target)), 4, dt);
}

/** Interpole `handsUpT` vers `target` (0..1). */
export function audienceHandsUp(build: AudienceBuild, target: number, dt: number): void {
  if (build.frozenScream) return;
  build.handsUpT = damp(build.handsUpT, Math.max(0, Math.min(1, target)), 5, dt);
}

/** Interpole `standT` vers `target` (0..1). */
export function audienceStand(build: AudienceBuild, target: number, dt: number): void {
  if (build.frozenScream) return;
  build.standT = damp(build.standT, Math.max(0, Math.min(1, target)), 3, dt);
}

/**
 * Chain de bouches : a chaque tick toutes les `0.15s`, on ouvre la bouche
 * d'un seat differente en chaine. `intensity` 0..1 module l'ouverture.
 */
export function audienceMouthChain(build: AudienceBuild, dt: number, intensity: number): void {
  if (build.frozenScream || intensity <= 0.01) return;
  build.mouthChainTime += dt;
  const stepDur = 0.18;
  const idx = Math.floor(build.mouthChainTime / stepDur) % build.mouths.length;
  for (let i = 0; i < build.mouths.length; i++) {
    const m = build.mouths[i];
    // Decay general
    m.scale.y = m.scale.y + (1 - m.scale.y) * Math.min(1, dt * 8);
  }
  // Ouvre le seat courant violemment
  const m = build.mouths[idx];
  m.scale.y = 1 + intensity * 4.5;
  m.scale.x = 1 + intensity * 0.8;
}

/**
 * Fige tous les seats dans la posture "hurlement silencieux" :
 * - debout (standT = 1)
 * - penches en avant (bodyLeanT = 0.7)
 * - bras leves (handsUpT = 1)
 * - bouches grandes ouvertes (scale.y = 5)
 * Les setters lean/stand/hands-up sont alors ignores.
 */
export function audienceFreezeScream(build: AudienceBuild): void {
  build.frozenScream = true;
  build.bodyLeanT = 0.7;
  build.standT = 1.0;
  build.handsUpT = 1.0;
  for (let i = 0; i < build.mouths.length; i++) {
    const m = build.mouths[i];
    m.scale.y = 5.5;
    m.scale.x = 1.4;
  }
  // Force les bras tout en haut
  for (let i = 0; i < build.armsLeft.length; i++) {
    const pivotL = build.armsLeft[i].userData.pivot as Group | undefined;
    const pivotR = build.armsRight[i].userData.pivot as Group | undefined;
    if (pivotL) pivotL.rotation.z = -2.0;
    if (pivotR) pivotR.rotation.z = 2.0;
  }
}

/** Reset apres freeze. */
export function audienceUnfreeze(build: AudienceBuild): void {
  build.frozenScream = false;
}

/**
 * Oriente progressivement les têtes vers le joueur (lerp). `weight` 0..1
 * contrôle la force du lookAt (0 = position neutre, 1 = fixent franchement).
 * Si `onlyWatcher` est vrai, seule la marionnette `watcherIndex` est affectée.
 */
export function audienceLookAt(
  build: AudienceBuild,
  worldPos: Vector3,
  weight: number,
  dt: number,
  onlyWatcher = false,
): void {
  const w = Math.max(0, Math.min(1, weight));
  for (let i = 0; i < build.heads.length; i++) {
    if (onlyWatcher && i !== build.watcherIndex) continue;
    const head = build.heads[i];
    const base = build.headBaseYaw[i];
    const headWorld = build.headWorldPos[i];
    const dx = worldPos.x - headWorld.x;
    const dz = worldPos.z - headWorld.z;
    // Yaw désiré pour que le visage (regard local +Z) regarde le joueur
    const desired = Math.atan2(dx, dz);
    const target = base + (desired - base) * w;
    head.rotation.y = damp(head.rotation.y, target, 6, dt);
  }
}

/**
 * Déclenche un applaudissement de `durationSec` (par défaut 1s) à
 * une intensité 0..1.
 */
export function audienceApplause(
  build: AudienceBuild,
  intensity: number,
  durationSec = 1.0,
): void {
  build.applauseIntensity = Math.max(build.applauseIntensity, Math.max(0, Math.min(1, intensity)));
  build.applauseTimer = Math.max(build.applauseTimer, durationSec);
}
