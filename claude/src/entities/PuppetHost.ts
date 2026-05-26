/**
 * PuppetHost — "M. Sourire", le présentateur-marionnette.
 *
 * Géométrie low poly assemblée à partir de primitives Three.js :
 * - corps en tissu (cylindre + sphère pour le crâne)
 * - visage peint (texture procédurale : yeux fixes, sourire cousu)
 * - bras articulés gérés via "ficelles" (rotation simple)
 * - manche de marionnettiste qui dépasse au-dessus
 *
 * Animations clés :
 * - sleep   : tête baissée, immobile
 * - awaken  : glitch 1-frame puis lever de tête saccadé
 * - speak   : ouverture/fermeture de mâchoire saccadée
 * - distort : intensité de "wrongness" pilotée par stress (cou qui s'allonge,
 *             tête qui penche, mâchoire qui tombe, bras qui s'agitent)
 */
import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  Vector3,
} from 'three';
import { flatToon } from '../rendering/materials/FlatToonMaterial';
import { PALETTE } from '../utils/palette';
import { damp, TAU } from '../utils/math';

export type PuppetState = 'sleep' | 'idle' | 'speak' | 'distort';
export type EyeStage = 0 | 1 | 2;

interface FaceTexOpts {
  eyeStage?: EyeStage;
  mood?: number;
  openMouth?: number;
  /** 0..1 — la bouche cousue se "déchire" au-delà du sourire normal. */
  jawCrack?: number;
}

export interface PuppetHostBuild {
  group: Group;
  state: PuppetState;
}

export class PuppetHost {
  group = new Group();
  state: PuppetState = 'sleep';

  private head = new Group();
  private headMesh!: Mesh;
  private jaw = new Group();
  private jawMesh!: Mesh;
  private body = new Group();
  private armLeft = new Group();
  private armRight = new Group();
  private faceMat!: MeshStandardMaterial;

  private headPivotY = 0;
  private speakPhase = 0;
  private stress = 0;
  private speakingUntil = 0;
  /** Décalage de "glitch" appliqué pour un frame seulement. */
  private glitchTimer = 0;
  /** Stage de yeux courant (0=cousus, 1=mi-ouverts, 2=grand ouverts). */
  private currentEyeStage: EyeStage = 0;
  /** Si true, eyeStage est forcé par appel externe (clamp désactivé). */
  private eyeStageForced = false;
  /** Étirement de cou 0..1 — scale Y de la tête + offset Y proportionnel. */
  private neckStretch = 0;
  /** Twitch local sur Z de la tête, décroît exponentiellement. */
  private twitchZ = 0;
  /** État de l'attaque "lunge" : on snap la position du groupe en 3 paliers. */
  private lungeActive = false;
  private lungeFrom = new Vector3();
  private lungeTo = new Vector3();
  private lungeT = 0;
  private lungeDuration = 1;
  private lungeNextSnap = 0;
  private lungeSnapsDone = 0;
  private readonly lungeSnapCount = 3;
  /** Glide : interpolation continue (pour les retours, contraire stop-motion du lunge). */
  private glideActive = false;
  private glideFrom = new Vector3();
  private glideTo = new Vector3();
  private glideT = 0;
  private glideDuration = 0.5;
  /** Bras supplémentaires (tentacules). 8 bras qui se déplient pour le "câlin". */
  private extraArms: Array<{
    pivot: Group;
    side: number;
    baseRotZ: number;
    baseRotX: number;
    phase: number;
  }> = [];
  /** Ouverture courante des bras supplémentaires 0..1 (interpolé). */
  private armsOpen = 0;
  /** Cible d'ouverture (réglable par setArmsOpen). */
  private armsOpenTarget = 0;

  constructor() {
    this.build();
  }

  private build(): void {
    // ----- Corps -----
    const torso = new Mesh(
      new CylinderGeometry(0.35, 0.45, 0.95, 12, 1),
      flatToon({ color: PALETTE.magenta, roughness: 1.0 }),
    );
    torso.position.y = 0.5;
    this.body.add(torso);

    // Petit nœud papillon
    const bow = new Mesh(
      new BoxGeometry(0.32, 0.12, 0.08),
      flatToon({ color: PALETTE.yellow, emissive: PALETTE.yellow, emissiveIntensity: 0.25 }),
    );
    bow.position.set(0, 0.92, 0.33);
    this.body.add(bow);

    // ----- Bras -----
    const armMat = flatToon({ color: PALETTE.magenta, roughness: 1.0 });
    const armLM = new Mesh(new CylinderGeometry(0.08, 0.1, 0.6, 8), armMat);
    armLM.position.y = -0.3;
    this.armLeft.add(armLM);
    this.armLeft.position.set(-0.4, 0.85, 0.0);
    this.armLeft.rotation.z = 0.25;
    this.body.add(this.armLeft);

    const armRM = new Mesh(new CylinderGeometry(0.08, 0.1, 0.6, 8), armMat);
    armRM.position.y = -0.3;
    this.armRight.add(armRM);
    this.armRight.position.set(0.4, 0.85, 0.0);
    this.armRight.rotation.z = -0.25;
    this.body.add(this.armRight);

    // Mains (petits cubes blancs comme des gants)
    const handMat = flatToon({ color: PALETTE.cream, roughness: 0.95 });
    const handL = new Mesh(new BoxGeometry(0.15, 0.15, 0.15), handMat);
    handL.position.y = -0.62;
    this.armLeft.add(handL);
    const handR = new Mesh(new BoxGeometry(0.15, 0.15, 0.15), handMat);
    handR.position.y = -0.62;
    this.armRight.add(handR);

    // ----- Bras supplémentaires (tentacules) -----
    // 8 bras répartis sur 4 hauteurs du torse, repliés contre le corps au repos.
    // Ils se déploient pour le "câlin" du climax. Détail subtilement inquiétant
    // visible dès qu'on regarde attentivement le présentateur.
    const extraArmMat = flatToon({ color: PALETTE.magenta, roughness: 1.0 });
    const extraHandMat = flatToon({ color: PALETTE.cream, roughness: 0.95 });
    const extraArmsData = [
      { x: -0.36, y: 0.78, z: 0.05, side: -1, idx: 0 },
      { x:  0.36, y: 0.78, z: 0.05, side:  1, idx: 1 },
      { x: -0.34, y: 0.58, z: 0.10, side: -1, idx: 2 },
      { x:  0.34, y: 0.58, z: 0.10, side:  1, idx: 3 },
      { x: -0.32, y: 0.35, z: 0.14, side: -1, idx: 4 },
      { x:  0.32, y: 0.35, z: 0.14, side:  1, idx: 5 },
      { x: -0.28, y: 0.14, z: 0.18, side: -1, idx: 6 },
      { x:  0.28, y: 0.14, z: 0.18, side:  1, idx: 7 },
    ];
    for (const d of extraArmsData) {
      const pivot = new Group();
      pivot.position.set(d.x, d.y, d.z);
      // Repos : collés au corps (légère ouverture pour ne pas clipper le torse)
      const baseRotZ = d.side * 0.2;
      const baseRotX = 0;
      pivot.rotation.z = baseRotZ;
      pivot.rotation.x = baseRotX;
      const arm = new Mesh(new CylinderGeometry(0.045, 0.06, 0.50, 6), extraArmMat);
      arm.position.y = -0.25;
      pivot.add(arm);
      const hand = new Mesh(new BoxGeometry(0.10, 0.10, 0.10), extraHandMat);
      hand.position.y = -0.52;
      pivot.add(hand);
      this.body.add(pivot);
      this.extraArms.push({
        pivot,
        side: d.side,
        baseRotZ,
        baseRotX,
        phase: d.idx * 0.7,
      });
    }

    // ----- Tête + visage -----
    this.faceMat = flatToon({
      color: PALETTE.cream,
      map: this.makeFaceTexture({ eyeStage: 0, mood: 0 }),
      roughness: 0.92,
      emissive: '#000000',
    });
    this.headMesh = new Mesh(new SphereGeometry(0.36, 16, 12), this.faceMat);
    this.headMesh.castShadow = true;
    this.head.add(this.headMesh);

    // Cheveux (calotte plus sombre, plate sur le dessus, retombante derrière)
    const hair = new Mesh(
      new SphereGeometry(0.37, 16, 12, 0, TAU, 0, Math.PI / 2.2),
      flatToon({ color: '#a8651f', roughness: 1.0, side: DoubleSide }),
    );
    hair.position.y = 0.02;
    this.head.add(hair);

    // Mâchoire : petite "bouche" séparée qu'on peut faire pivoter
    // (visuel : un petit cube crème en bas du visage, derrière la texture sourire)
    this.jawMesh = new Mesh(
      new BoxGeometry(0.18, 0.08, 0.05),
      flatToon({ color: '#1c1b1a', emissive: '#3a0808', emissiveIntensity: 0.2 }),
    );
    this.jawMesh.position.set(0, -0.16, 0.31);
    this.jaw.add(this.jawMesh);
    this.head.add(this.jaw);

    // Position de pivot de la tête (au sommet du corps)
    this.headPivotY = 1.05;
    this.head.position.y = this.headPivotY;
    this.body.add(this.head);

    // Manche de marionnettiste (cylindre fin qui dépasse vers le haut)
    const stick = new Mesh(
      new CylinderGeometry(0.018, 0.018, 2.2, 8),
      flatToon({ color: '#3a2818', roughness: 0.7 }),
    );
    stick.position.set(0, 2.0, 0);
    this.body.add(stick);

    // Place le groupe complet
    this.group.add(this.body);

    // État initial : "sleep" — tête baissée
    this.head.rotation.x = 0.65;
  }

  /**
   * Texture du visage paramétrée. Trois "stages" d'yeux qui changent la nature
   * de la peur : peints/cousus → mi-ouverts → grand ouverts (regard fixe).
   */
  private makeFaceTexture(opts: FaceTexOpts): Texture {
    const eyeStage: EyeStage = opts.eyeStage ?? 0;
    const mood = opts.mood ?? 0;
    const openMouth = opts.openMouth ?? 0;
    const jawCrack = opts.jawCrack ?? 0;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = PALETTE.cream;
    ctx.fillRect(0, 0, size, size);

    // Joues roses (taches blush) — s'estompent au stage 2 (le visage perd ses couleurs)
    const blushAlpha = eyeStage === 2 ? 0.25 : 1;
    ctx.fillStyle = `rgba(232,154,166,${blushAlpha})`;
    ctx.beginPath();
    ctx.ellipse(size * 0.25, size * 0.6, size * 0.08, size * 0.06, 0, 0, TAU);
    ctx.ellipse(size * 0.75, size * 0.6, size * 0.08, size * 0.06, 0, 0, TAU);
    ctx.fill();

    // ---- Yeux selon stage ----
    const eyeY = size * 0.42;
    const eyeLX = size * 0.36;
    const eyeRX = size * 0.64;
    if (eyeStage === 0) {
      // Peints noirs (croix de couture par-dessus)
      ctx.fillStyle = '#1c1b1a';
      ctx.beginPath();
      ctx.arc(eyeLX, eyeY, size * 0.07, 0, TAU);
      ctx.arc(eyeRX, eyeY, size * 0.07, 0, TAU);
      ctx.fill();
      // Croix de couture
      ctx.strokeStyle = '#5a3a18';
      ctx.lineWidth = size * 0.008;
      for (const cx of [eyeLX, eyeRX]) {
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.05, eyeY - size * 0.05);
        ctx.lineTo(cx + size * 0.05, eyeY + size * 0.05);
        ctx.moveTo(cx + size * 0.05, eyeY - size * 0.05);
        ctx.lineTo(cx - size * 0.05, eyeY + size * 0.05);
        ctx.stroke();
      }
    } else if (eyeStage === 1) {
      // Mi-ouverts : arc inférieur de l'œil visible, iris noir + pupille
      for (const cx of [eyeLX, eyeRX]) {
        // Sclera (blanc cassé) sous forme d'arc
        ctx.fillStyle = '#f0e3cf';
        ctx.beginPath();
        ctx.ellipse(cx, eyeY + size * 0.015, size * 0.075, size * 0.045, 0, 0, TAU);
        ctx.fill();
        // Iris bleu gelé
        ctx.fillStyle = '#3a5870';
        ctx.beginPath();
        ctx.arc(cx, eyeY + size * 0.015, size * 0.04, 0, TAU);
        ctx.fill();
        // Pupille noire
        ctx.fillStyle = '#1c1b1a';
        ctx.beginPath();
        ctx.arc(cx, eyeY + size * 0.015, size * 0.020, 0, TAU);
        ctx.fill();
        // Highlight
        ctx.fillStyle = PALETTE.cream;
        ctx.beginPath();
        ctx.arc(cx - size * 0.008, eyeY + size * 0.005, size * 0.008, 0, TAU);
        ctx.fill();
        // Paupière haute (arc sombre qui couvre le haut)
        ctx.fillStyle = PALETTE.cream;
        ctx.beginPath();
        ctx.rect(cx - size * 0.08, eyeY - size * 0.06, size * 0.16, size * 0.06);
        ctx.fill();
        // Trait paupière
        ctx.strokeStyle = '#3a2010';
        ctx.lineWidth = size * 0.008;
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.075, eyeY);
        ctx.quadraticCurveTo(cx, eyeY - size * 0.012, cx + size * 0.075, eyeY);
        ctx.stroke();
      }
    } else {
      // Grand ouverts : cercles blancs avec iris au centre + cernes noirs autour
      for (const cx of [eyeLX, eyeRX]) {
        // Cerne noir (effet "fatigué")
        ctx.fillStyle = 'rgba(40,20,30,0.35)';
        ctx.beginPath();
        ctx.ellipse(cx, eyeY, size * 0.12, size * 0.09, 0, 0, TAU);
        ctx.fill();
        // Sclera ronde et large
        ctx.fillStyle = '#fdf6e3';
        ctx.beginPath();
        ctx.arc(cx, eyeY, size * 0.09, 0, TAU);
        ctx.fill();
        // Iris vert toxique
        ctx.fillStyle = '#5b7a3d';
        ctx.beginPath();
        ctx.arc(cx, eyeY, size * 0.045, 0, TAU);
        ctx.fill();
        // Pupille noire dilatée
        ctx.fillStyle = '#1c1b1a';
        ctx.beginPath();
        ctx.arc(cx, eyeY, size * 0.028, 0, TAU);
        ctx.fill();
        // Highlight
        ctx.fillStyle = PALETTE.cream;
        ctx.beginPath();
        ctx.arc(cx - size * 0.012, eyeY - size * 0.012, size * 0.012, 0, TAU);
        ctx.fill();
        // Veines rouges (3 petites lignes)
        ctx.strokeStyle = 'rgba(180,30,30,0.65)';
        ctx.lineWidth = size * 0.006;
        for (let i = 0; i < 3; i++) {
          const ang = (i / 3) * TAU + 0.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * size * 0.085, eyeY + Math.sin(ang) * size * 0.085);
          ctx.quadraticCurveTo(
            cx + Math.cos(ang) * size * 0.06,
            eyeY + Math.sin(ang) * size * 0.06,
            cx + Math.cos(ang + 0.3) * size * 0.05,
            eyeY + Math.sin(ang + 0.3) * size * 0.05,
          );
          ctx.stroke();
        }
      }
    }

    // ---- Sourcils ----
    // Stage 0: posés naturellement. Stage 1: relevés méchants. Stage 2: hauts et fins.
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = size * (eyeStage === 2 ? 0.010 : 0.015);
    ctx.lineCap = 'round';
    const browYBase = size * (eyeStage === 2 ? 0.24 : eyeStage === 1 ? 0.27 : 0.30);
    const browTilt = (mood + eyeStage * 0.5) * 0.05 * size;
    ctx.beginPath();
    ctx.moveTo(size * 0.28, browYBase + browTilt);
    ctx.lineTo(size * 0.44, browYBase + size * 0.02 - browTilt);
    ctx.moveTo(size * 0.72, browYBase + browTilt);
    ctx.lineTo(size * 0.56, browYBase + size * 0.02 - browTilt);
    ctx.stroke();

    // ---- Bouche cousue ----
    ctx.strokeStyle = '#1c1b1a';
    ctx.lineWidth = size * 0.02;
    ctx.lineCap = 'round';
    const widthMouth = 0.38 + mood * 0.08 + jawCrack * 0.12;
    const mouthY = size * (0.72 + openMouth * 0.04);
    const mouthSag = size * (0.10 + mood * 0.06 + openMouth * 0.12 + jawCrack * 0.10);
    ctx.beginPath();
    ctx.moveTo(size * (0.5 - widthMouth / 2), mouthY);
    ctx.quadraticCurveTo(size * 0.5, mouthY + mouthSag, size * (0.5 + widthMouth / 2), mouthY);
    ctx.stroke();
    // Coutures perpendiculaires — au stage 2 et avec jawCrack > 0, on en saute
    // certaines (le fil s'est rompu)
    const stitches = 14;
    for (let i = 1; i < stitches; i++) {
      // Saute aléatoirement quelques coutures selon jawCrack
      const skipChance = jawCrack * 0.5;
      if (Math.random() < skipChance) continue;
      const t = i / stitches;
      const x = size * (0.5 - widthMouth / 2) + t * (size * widthMouth);
      const y = mouthY + Math.sin(t * Math.PI) * mouthSag;
      ctx.beginPath();
      ctx.moveTo(x - size * 0.012, y - size * 0.012);
      ctx.lineTo(x + size * 0.012, y + size * 0.012);
      ctx.moveTo(x + size * 0.012, y - size * 0.012);
      ctx.lineTo(x - size * 0.012, y + size * 0.012);
      ctx.stroke();
    }
    // Tâche rouge sombre qui fuit du coin si jawCrack > 0.5 (sang séché)
    if (jawCrack > 0.5) {
      ctx.fillStyle = `rgba(110,15,15,${(jawCrack - 0.5) * 0.7})`;
      ctx.beginPath();
      ctx.moveTo(size * (0.5 - widthMouth / 2), mouthY);
      ctx.quadraticCurveTo(
        size * (0.5 - widthMouth / 2) - size * 0.02,
        mouthY + size * 0.08,
        size * (0.5 - widthMouth / 2) + size * 0.005,
        mouthY + size * 0.15,
      );
      ctx.lineTo(size * (0.5 - widthMouth / 2) - size * 0.005, mouthY);
      ctx.fill();
    }

    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * Définit le stage d'yeux. `forced=true` désactive le mapping auto stress→eye
   * pendant que cette valeur est en vigueur (utile pour les moments scriptés).
   */
  setEyeStage(stage: EyeStage, forced = false): void {
    if (stage === this.currentEyeStage && this.eyeStageForced === forced) return;
    this.currentEyeStage = stage;
    this.eyeStageForced = forced;
    if (this.faceMat.map) (this.faceMat.map as Texture).dispose();
    this.faceMat.map = this.makeFaceTexture({
      eyeStage: stage,
      mood: stage === 2 ? 1 : stage === 1 ? 0.4 : 0,
      jawCrack: stage === 2 ? 0.6 : 0,
    });
    this.faceMat.needsUpdate = true;
  }

  /** Libère le contrôle manuel pour laisser le mapping auto reprendre. */
  releaseEyeStage(): void {
    this.eyeStageForced = false;
  }

  /** Étire la tête vers le haut (effet cou qui s'allonge). 0 = neutre, 1 = +45%. */
  setNeckStretch(amount: number): void {
    this.neckStretch = Math.max(0, Math.min(1, amount));
  }

  /**
   * Attaque "lunge" : le buste entier translate vers `targetWorldPos` en
   * `durationSec`, par 3 snaps discontinus (rendu stop-motion).
   * Le targetWorldPos est exprimé en monde, on calcule l'équivalent local.
   */
  lunge(targetWorldPos: Vector3, durationSec: number): void {
    this.lungeActive = true;
    this.lungeFrom.copy(this.group.position);
    // On convertit targetWorld en parent-local (parent du group = la scène).
    // Si le group est ajouté directement à la scène (cas ici), world == local.
    this.lungeTo.copy(targetWorldPos);
    this.lungeT = 0;
    this.lungeDuration = Math.max(0.15, durationSec);
    this.lungeNextSnap = 0;
    this.lungeSnapsDone = 0;
  }

  /** Annule un lunge en cours et remet la position d'origine si fournie. */
  cancelLunge(restoreTo?: Vector3): void {
    this.lungeActive = false;
    if (restoreTo) this.group.position.copy(restoreTo);
  }

  /** True tant que le lunge se joue (utile pour bloquer le suivi du joueur). */
  isLungeActive(): boolean {
    return this.lungeActive;
  }

  /**
   * Interpolation continue (smoothstep) vers une position monde. Différent du
   * lunge : pas de snap, mouvement fluide — idéal pour les retours discrets.
   */
  glide(targetWorldPos: Vector3, durationSec: number): void {
    this.glideActive = true;
    this.glideFrom.copy(this.group.position);
    this.glideTo.copy(targetWorldPos);
    this.glideT = 0;
    this.glideDuration = Math.max(0.1, durationSec);
  }

  /**
   * Déploie / replie les bras supplémentaires. 0 = collés au corps,
   * 1 = tendus vers l'avant en sway (effet "tentacules d'accueil").
   */
  setArmsOpen(value: number): void {
    this.armsOpenTarget = Math.max(0, Math.min(1, value));
  }

  /** Force la position immédiate du groupe (utile pour reset au début d'un beat). */
  forcePosition(pos: Vector3): void {
    this.group.position.copy(pos);
  }

  /** Réveil brutal : 1 frame de glitch puis lever de tête saccadé. */
  awaken(): void {
    this.state = 'idle';
    this.glitchTimer = 0.08;
    if (this.faceMat.map) (this.faceMat.map as Texture).dispose();
    this.faceMat.map = this.makeFaceTexture({ eyeStage: this.currentEyeStage, mood: 0 });
    this.faceMat.needsUpdate = true;
  }

  /** Déclenche un segment parlé d'environ `dur` secondes. */
  speak(dur = 2): void {
    this.state = 'speak';
    this.speakingUntil = performance.now() / 1000 + dur;
  }

  /** Niveau de "wrongness" 0..1 — modulé en continu par le SmileMeter. */
  setStress(s: number): void {
    this.stress = Math.max(0, Math.min(1, s));
  }

  /**
   * Téléporte le PuppetHost (utilisé pour la disparition au climax).
   * Le visible flag est géré séparément.
   */
  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  /** Tourne le buste / la tête vers une position cible (le joueur). */
  lookAt(target: Object3D): void {
    // Tourner uniquement la tête, pas le buste (ça rend plus inquiétant).
    const worldPos = target.position.clone();
    this.head.lookAt(worldPos);
    // Compense le pivot de base (le cou regarde naturellement +Z donc on inverse).
    this.head.rotation.y += Math.PI;
  }

  update(dt: number, time: number): void {
    // Mapping auto stress → eyeStage avec hystérésis (sauf si forcé)
    if (!this.eyeStageForced) {
      const s = this.stress;
      if (this.currentEyeStage === 0 && s > 0.45) this.setEyeStage(1);
      else if (this.currentEyeStage === 1 && s < 0.35) this.setEyeStage(0);
      else if (this.currentEyeStage === 1 && s > 0.80) this.setEyeStage(2);
      else if (this.currentEyeStage === 2 && s < 0.70) this.setEyeStage(1);
    }

    // Lunge a priorité sur tout sauf le sleep absolu
    if (this.lungeActive) {
      this.lungeT += dt;
      const progress = Math.min(1, this.lungeT / this.lungeDuration);
      const targetSnaps = Math.floor(progress * this.lungeSnapCount);
      if (targetSnaps > this.lungeSnapsDone && targetSnaps <= this.lungeSnapCount) {
        this.lungeSnapsDone = targetSnaps;
        const k = targetSnaps / this.lungeSnapCount;
        // Easing exponentiel : les derniers snaps sont plus rapides
        const eased = 1 - Math.pow(1 - k, 2.4);
        this.group.position.lerpVectors(this.lungeFrom, this.lungeTo, eased);
        // Petit décalage random pour rendu "stop-motion"
        this.group.position.x += (Math.random() - 0.5) * 0.04;
        this.group.position.z += (Math.random() - 0.5) * 0.04;
      }
      if (progress >= 1) {
        this.group.position.copy(this.lungeTo);
        this.lungeActive = false;
      }
    } else if (this.glideActive) {
      this.glideT += dt;
      const k = Math.min(1, this.glideT / this.glideDuration);
      // Smoothstep
      const eased = k * k * (3 - 2 * k);
      this.group.position.lerpVectors(this.glideFrom, this.glideTo, eased);
      if (k >= 1) {
        this.group.position.copy(this.glideTo);
        this.glideActive = false;
      }
    }

    // ---- Animation des bras supplémentaires ----
    this.armsOpen = damp(this.armsOpen, this.armsOpenTarget, 5, dt);
    if (this.extraArms.length > 0) {
      const open = this.armsOpen;
      for (const a of this.extraArms) {
        // Sway organique pour effet "tentacules vivantes"
        const swayZ = Math.sin(time * 3.0 + a.phase) * 0.22 * open;
        const swayX = Math.sin(time * 2.3 + a.phase * 1.3) * 0.18 * open;
        // Z : écartement latéral
        const targetZ = a.baseRotZ + a.side * 1.0 * open + swayZ;
        // X : inclinaison vers l'avant (-π/2 = pointe vers +Z dans repère local)
        const targetX = a.baseRotX - 1.1 * open + swayX;
        a.pivot.rotation.z = damp(a.pivot.rotation.z, targetZ, 7, dt);
        a.pivot.rotation.x = damp(a.pivot.rotation.x, targetX, 7, dt);
      }
    }

    if (this.state === 'sleep') {
      this.head.rotation.x = damp(this.head.rotation.x, 0.65, 4, dt);
      return;
    }
    if (this.glitchTimer > 0) {
      this.glitchTimer -= dt;
      this.head.position.set(
        (Math.random() - 0.5) * 0.05,
        this.headPivotY + (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05,
      );
      this.head.rotation.x = (Math.random() - 0.5) * 0.6;
      this.head.rotation.z = (Math.random() - 0.5) * 0.4;
      return;
    }

    // Micro-twitch aléatoire au-delà de stress 0.6
    if (this.stress > 0.6 && Math.random() < (this.stress - 0.6) * 0.06) {
      this.twitchZ = (Math.random() - 0.5) * 0.6;
    }
    this.twitchZ = damp(this.twitchZ, 0, 14, dt);

    // Y target combine pivot + stress lift + neckStretch
    const yTarget = this.headPivotY + this.stress * 0.10 + this.neckStretch * 0.22;
    this.head.position.x = damp(this.head.position.x, 0, 8, dt);
    this.head.position.y = damp(this.head.position.y, yTarget, 6, dt);
    this.head.position.z = damp(this.head.position.z, 0, 8, dt);

    // Scale Y de la tête : entre 1.0 et 1.45 selon neckStretch
    const sy = 1 + this.neckStretch * 0.45;
    this.headMesh.scale.y = damp(this.headMesh.scale.y, sy, 6, dt);

    const tiltTarget = this.stress * 0.55 * Math.sin(time * 0.7) + this.twitchZ;
    this.head.rotation.z = damp(this.head.rotation.z, tiltTarget, 3, dt);
    const downTarget = this.state === 'speak' ? -0.05 : -0.18 + this.stress * 0.25;
    this.head.rotation.x = damp(this.head.rotation.x, downTarget, 4, dt);

    this.body.position.y = Math.sin(time * 1.1) * 0.02;

    const armBase = 0.25;
    const armWobble = (this.state === 'speak' ? 0.4 : 0.1) + this.stress * 0.5;
    this.armLeft.rotation.z = armBase + Math.sin(time * 4 + 0.7) * armWobble;
    this.armRight.rotation.z = -armBase - Math.sin(time * 4) * armWobble;

    if (this.state === 'speak') {
      this.speakPhase += dt * (8 + this.stress * 6);
      const open = Math.max(0, Math.sin(this.speakPhase)) * (0.15 + this.stress * 0.25);
      this.jaw.position.y = -open * 0.4;
      this.jaw.rotation.x = open;
      if (performance.now() / 1000 > this.speakingUntil) {
        this.state = 'idle';
        this.jaw.position.y = 0;
        this.jaw.rotation.x = 0;
      }
    } else {
      this.jaw.position.y = damp(this.jaw.position.y, 0, 6, dt);
      this.jaw.rotation.x = damp(this.jaw.rotation.x, this.stress * 0.4, 4, dt);
    }
  }

  /** Position actuelle du group (utile pour calculer le retour après lunge). */
  getPosition(): Vector3 {
    return this.group.position.clone();
  }

  /** Stage des yeux actuel (lecture seule). */
  getEyeStage(): EyeStage {
    return this.currentEyeStage;
  }

  setPosition(x: number, y: number, z: number, rotY = 0): void {
    this.group.position.set(x, y, z);
    this.group.rotation.y = rotY;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        const m = o.material as MeshStandardMaterial;
        if (m.map) m.map.dispose();
        m.dispose();
      }
    });
  }
}
