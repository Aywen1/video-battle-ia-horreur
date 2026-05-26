/**
 * DressingRoom — Chapitre 4, Phase 1 « La Loge ».
 *
 * Le joueur "se reveille" dans une loge minuscule eclairee par les ampoules
 * vanity d'un grand miroir. Le miroir, au lieu de refleter un avatar, montre
 * son **flux webcam en temps reel** (via CRTScreenMaterial). Puis, progressivement,
 * un **sourire grotesque rouge** se greffe par-dessus son visage.
 *
 * Sur le mur de gauche, une galerie de **43 portraits** numerotes N°1 a N°43 :
 * tous les anciens "invites" de l'emission. Sur la coiffeuse, une cassette
 * etiquetee N°44 = celle du joueur. Apres 14s scriptees, une porte s'ouvre,
 * lumiere violente, transition vers AudienceFinalRoom.
 *
 * Pas d'interaction joueur — tout est cinematique force (controlsEnabled=false
 * via player.setCinematicXxx).
 */
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  Vector3,
  VideoTexture,
} from 'three';
import { Room, RoomDeps, RoomUpdateContext, Interactable } from '../Room';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { CRTScreenMaterial } from '../../rendering/materials/CRTScreenMaterial';
import { PALETTE } from '../../utils/palette';
import { clamp, damp } from '../../utils/math';
import { AudienceFinalRoom } from './AudienceFinalRoom';
import type { MouthLandmarks } from '../../webcam/SmileDetector';

export type DressingStart = 'reveil' | 'miroir';

const clamp01 = (x: number): number => clamp(x, 0, 1);

interface DressingScript {
  ambientStarted: boolean;
  welcomeSpoken: boolean;
  smileGraftStarted: boolean;
  glitchStingPlayed: boolean;
  evilLaughPlayed: boolean;
  breathTickPlayed: boolean;
  announcePlayed: boolean;
  doorBurstPlayed: boolean;
  transitionRequested: boolean;
}

export class DressingRoom extends Room {
  private deps: RoomDeps;
  private startAt: DressingStart;
  private phaseTime = 0;
  private cinematicSet = false;

  // Build refs
  private vanityBulbs: Mesh[] = [];
  private vanityLights: PointLight[] = [];
  private mirrorMat: CRTScreenMaterial | null = null;
  /** Intensite du filtre "Snapchat smile" (0..1) — anime dans update(). */
  private smileFilterIntensity = 0;
  /**
   * Lissage des landmarks de la bouche pour eviter le tremblement (MediaPipe
   * tourne a 15fps, on lerp vers la cible chaque frame).
   */
  private smoothedMouth: MouthLandmarks | null = null;
  private doorPivot: Group | null = null;
  private doorLight: PointLight | null = null;
  private corridorGlow: Mesh | null = null;
  private ambientLight: AmbientLight | null = null;

  // Scripted state
  private script: DressingScript = {
    ambientStarted: false,
    welcomeSpoken: false,
    smileGraftStarted: false,
    glitchStingPlayed: false,
    evilLaughPlayed: false,
    breathTickPlayed: false,
    announcePlayed: false,
    doorBurstPlayed: false,
    transitionRequested: false,
  };

  constructor(deps: RoomDeps, opts: { startAt?: DressingStart } = {}) {
    super();
    this.deps = deps;
    this.startAt = opts.startAt ?? 'reveil';
    this.build();
    // Joueur assis face au miroir (z=-0.8), miroir en z=+1.0 → regarde +Z
    this.spawnPosition.set(0, 1.55, -0.8);
    this.spawnYaw = Math.PI; // regarde +Z
    this.spawnPitch = 0;
  }

  // ============== Build ==============

  private build(): void {
    // ===== Geometrie de la loge =====
    // Dimensions : 4m large, 3m profond, 3m haut
    // x ∈ [-2, 2], y ∈ [0, 3], z ∈ [-2, 2]

    // Sol : moquette rouge sang
    const floor = new Mesh(
      new PlaneGeometry(4, 4),
      flatToon({ color: '#5a0810', roughness: 1.0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.group.add(floor);

    // Plafond beige jauni
    const ceiling = new Mesh(
      new PlaneGeometry(4, 4),
      flatToon({ color: '#3a2818', roughness: 1.0 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 3;
    this.group.add(ceiling);

    // Mur fond (derriere le joueur, z=-2)
    const wallBack = new Mesh(
      new PlaneGeometry(4, 3),
      flatToon({ color: '#5a3818', roughness: 0.95 }),
    );
    wallBack.position.set(0, 1.5, -2);
    this.group.add(wallBack);

    // Mur miroir (devant le joueur, z=+2)
    const wallFront = new Mesh(
      new PlaneGeometry(4, 3),
      flatToon({ color: '#5a3818', roughness: 0.95 }),
    );
    wallFront.rotation.y = Math.PI;
    wallFront.position.set(0, 1.5, 2);
    this.group.add(wallFront);

    // Mur gauche (galerie portraits, x=-2)
    const wallLeft = new Mesh(
      new PlaneGeometry(4, 3),
      flatToon({ color: '#5a3818', roughness: 0.95 }),
    );
    wallLeft.rotation.y = Math.PI / 2;
    wallLeft.position.set(-2, 1.5, 0);
    this.group.add(wallLeft);

    // Mur droit (porte, x=+2)
    const wallRight = new Mesh(
      new PlaneGeometry(4, 3),
      flatToon({ color: '#5a3818', roughness: 0.95 }),
    );
    wallRight.rotation.y = -Math.PI / 2;
    wallRight.position.set(2, 1.5, 0);
    this.group.add(wallRight);

    // ===== Coiffeuse + miroir vanity =====
    this.buildVanity();

    // ===== Galerie des 43 portraits (mur gauche) =====
    this.buildPortraitGallery();

    // ===== Porte droite (mur de droite, s'ouvrira a t=14) =====
    this.buildDoor();

    // ===== Ambient + hemi : tres faible au debut, s'allume avec les bulbes =====
    this.ambientLight = new AmbientLight(new Color('#2a1818'), 0.15);
    this.group.add(this.ambientLight);

    // ===== Colliders : 4 murs + coiffeuse =====
    this.colliders = [
      new Box3(new Vector3(-2.1, 0, -2.1), new Vector3(2.1, 3, -2.0)), // mur fond
      new Box3(new Vector3(-2.1, 0, 2.0), new Vector3(2.1, 3, 2.1)),   // mur avant
      new Box3(new Vector3(-2.1, 0, -2.1), new Vector3(-2.0, 3, 2.1)), // mur gauche
      new Box3(new Vector3(2.0, 0, -2.1), new Vector3(2.1, 3, 2.1)),   // mur droit
      new Box3(new Vector3(-0.8, 0, 0.9), new Vector3(0.8, 0.95, 1.7)), // coiffeuse
    ];
  }

  /**
   * Coiffeuse en bois sombre + miroir vanity 1.4m x 1.4m avec 12 ampoules
   * autour. Le miroir affiche le flux webcam via CRTScreenMaterial et a un
   * second plane devant avec le sourire greffe.
   */
  private buildVanity(): void {
    // Plateau coiffeuse en z=+1.3 (contre le mur avant a z=+2)
    const deskTop = new Mesh(
      new BoxGeometry(1.6, 0.05, 0.7),
      flatToon({ color: '#3a2010', roughness: 0.85 }),
    );
    deskTop.position.set(0, 0.95, 1.3);
    this.group.add(deskTop);

    // Pieds de la coiffeuse
    for (const [px, pz] of [[-0.7, 1.05], [0.7, 1.05], [-0.7, 1.55], [0.7, 1.55]]) {
      const leg = new Mesh(
        new BoxGeometry(0.07, 0.93, 0.07),
        flatToon({ color: '#2a1408', roughness: 1.0 }),
      );
      leg.position.set(px, 0.47, pz);
      this.group.add(leg);
    }

    // ===== Miroir vanity (au mur, z=+1.95) =====
    let videoTex: Texture | null = null;
    if (this.deps.webcamVideo) {
      const vt = new VideoTexture(this.deps.webcamVideo);
      vt.colorSpace = SRGBColorSpace;
      videoTex = vt;
    }
    if (videoTex) {
      this.mirrorMat = new CRTScreenMaterial(videoTex, {
        mirror: true,
        chromatic: 0.003,
        intensity: 0.55,
      });
    }

    // Bezel doré autour du miroir
    const bezel = new Mesh(
      new PlaneGeometry(1.55, 1.55),
      flatToon({ color: PALETTE.yellowDim, emissive: PALETTE.yellowDim, emissiveIntensity: 0.2 }),
    );
    bezel.position.set(0, 1.85, 1.94);
    bezel.rotation.y = Math.PI;
    this.group.add(bezel);

    // Plan miroir (CRT) — le sourire grotesque est dessine DIRECTEMENT dans
    // le fragment shader (cf. CRTScreenMaterial.setMouthFilter), pas via un
    // overlay statique. Le filtre suit les landmarks MediaPipe en temps reel.
    const mirror = new Mesh(
      new PlaneGeometry(1.4, 1.4),
      this.mirrorMat ??
        flatToon({ color: PALETTE.charcoal, emissive: '#1a0808', emissiveIntensity: 0.4 }),
    );
    mirror.position.set(0, 1.85, 1.935);
    mirror.rotation.y = Math.PI;
    this.group.add(mirror);

    // ===== 12 ampoules vanity autour du miroir =====
    const bulbPositions: Array<[number, number]> = [];
    // Top row (5 bulbes)
    for (let i = 0; i < 5; i++) bulbPositions.push([(-0.6 + i * 0.30), 2.65]);
    // Bottom row (5)
    for (let i = 0; i < 5; i++) bulbPositions.push([(-0.6 + i * 0.30), 1.05]);
    // Left/right
    bulbPositions.push([-0.78, 1.85]);
    bulbPositions.push([0.78, 1.85]);

    for (const [bx, by] of bulbPositions) {
      const bulbMat = flatToon({
        color: PALETTE.cream,
        emissive: PALETTE.yellow,
        emissiveIntensity: 0,
      });
      const bulb = new Mesh(new SphereGeometry(0.04, 12, 8), bulbMat);
      bulb.position.set(bx, by, 1.93);
      this.group.add(bulb);
      this.vanityBulbs.push(bulb);

      // Point light associee (tres faible portee, juste pour eclairer le visage du joueur)
      const pl = new PointLight(new Color('#ffe8b0'), 0, 2.5, 1.6);
      pl.position.set(bx, by, 1.7);
      this.group.add(pl);
      this.vanityLights.push(pl);
    }

    // ===== Decor sur la coiffeuse : cassette N°44 =====
    this.buildVanityProps();
  }

  private buildVanityProps(): void {
    // Cassette VHS sur la coiffeuse, etiquetee "N°44"
    const cassette = new Mesh(
      new BoxGeometry(0.18, 0.025, 0.12),
      flatToon({ color: PALETTE.charcoal, roughness: 0.8 }),
    );
    cassette.position.set(-0.5, 0.98, 1.35);
    cassette.rotation.y = 0.2;
    this.group.add(cassette);

    // Etiquette papier creme avec "N°44 — CE SOIR"
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 192;
    labelCanvas.height = 128;
    const lctx = labelCanvas.getContext('2d')!;
    lctx.fillStyle = '#ffe7a0';
    lctx.fillRect(0, 0, 192, 128);
    lctx.strokeStyle = PALETTE.red;
    lctx.lineWidth = 3;
    lctx.strokeRect(4, 4, 184, 120);
    lctx.fillStyle = PALETTE.red;
    lctx.font = 'bold 38px "Courier New", monospace';
    lctx.textAlign = 'center';
    lctx.fillText('N°44', 96, 60);
    lctx.fillStyle = '#3a2818';
    lctx.font = 'bold 18px "Courier New", monospace';
    lctx.fillText('CE SOIR', 96, 92);
    const labelTex = new CanvasTexture(labelCanvas);
    labelTex.colorSpace = SRGBColorSpace;
    const labelMesh = new Mesh(
      new PlaneGeometry(0.16, 0.10),
      new MeshBasicMaterial({ map: labelTex }),
    );
    labelMesh.position.set(-0.5, 0.994, 1.35);
    labelMesh.rotation.x = -Math.PI / 2;
    labelMesh.rotation.z = 0.2;
    this.group.add(labelMesh);

    // Une rose flétrie posee a droite (petit cône rouge + tige verte)
    const rose = new Mesh(
      new SphereGeometry(0.04, 8, 6),
      flatToon({ color: PALETTE.redDim, roughness: 1.0 }),
    );
    rose.position.set(0.5, 1.02, 1.4);
    this.group.add(rose);
    const stem = new Mesh(
      new BoxGeometry(0.012, 0.18, 0.012),
      flatToon({ color: '#3a2010', roughness: 1.0 }),
    );
    stem.position.set(0.5, 0.95, 1.4);
    this.group.add(stem);
  }

  /**
   * Galerie murale : 43 mini-portraits numerotes N°1 a N°43, alignes sur
   * 5 rangees x ~9 colonnes. Couleurs sepia/jaunie, visage figé avec sourire.
   */
  private buildPortraitGallery(): void {
    const rows = 5;
    const cols = 9;
    const portraitSize = 0.30;
    const startX = -1.8; // x decroissant sur le mur gauche (z varie)
    const startY = 0.7;
    const gapY = 0.42;
    const gapZ = 0.36;
    let placed = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (placed >= 43) break;
        const num = placed + 1;
        const canvas = this.buildPortraitCanvas(num);
        const tex = new CanvasTexture(canvas);
        tex.colorSpace = SRGBColorSpace;
        const mat = new MeshBasicMaterial({ map: tex });
        // Cadre : un quad plus grand derriere
        const frameMat = flatToon({
          color: num === 44 ? PALETTE.red : '#1a0c08',
          roughness: 0.9,
        });
        const frame = new Mesh(
          new PlaneGeometry(portraitSize + 0.04, portraitSize + 0.04),
          frameMat,
        );
        const portrait = new Mesh(new PlaneGeometry(portraitSize, portraitSize), mat);
        const z = -1.6 + c * gapZ;
        const y = startY + r * gapY;
        // Murale gauche : x=-1.97, normale = +X
        frame.position.set(-1.97, y, z);
        portrait.position.set(-1.965, y, z);
        frame.rotation.y = Math.PI / 2;
        portrait.rotation.y = Math.PI / 2;
        this.group.add(frame);
        this.group.add(portrait);
        placed++;
      }
    }
  }

  private buildPortraitCanvas(num: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    // Fond sepia
    const sepia = num < 15 ? '#8a6840' : num < 30 ? '#a08458' : '#bca070';
    ctx.fillStyle = sepia;
    ctx.fillRect(0, 0, 128, 128);
    // Bordure papier
    ctx.strokeStyle = '#3a2410';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 124, 124);
    // Visage stylise : oval creme
    ctx.fillStyle = '#e8d8b8';
    ctx.beginPath();
    ctx.ellipse(64, 56, 30, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cheveux (variation aleatoire stable selon num)
    const hairStyles = ['#1a0c08', '#3a2010', '#5a3818', '#2a1408', '#7a5828'];
    ctx.fillStyle = hairStyles[num % hairStyles.length];
    ctx.beginPath();
    ctx.ellipse(64, 32, 32, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    // Yeux : 2 points noirs
    ctx.fillStyle = '#0a0408';
    ctx.beginPath();
    ctx.arc(54, 56, 2.5, 0, Math.PI * 2);
    ctx.arc(74, 56, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // SOURIRE GROTESQUE (la signature de chaque ancien candidat)
    ctx.strokeStyle = '#7a0010';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(64, 68, 14, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    // Petites dents blanches
    ctx.fillStyle = '#f4e8c8';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(52 + i * 5, 78, 3, 4);
    }
    // Etiquette inferieure : N°XX
    ctx.fillStyle = '#1a0a08';
    ctx.fillRect(4, 104, 120, 20);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`N°${num}`, 64, 119);
    // Taches de vieillissement
    for (let i = 0; i < 8; i++) {
      const sx = (num * 37 + i * 13) % 128;
      const sy = (num * 19 + i * 7) % 128;
      ctx.fillStyle = `rgba(60,40,20,${0.05 + (i * 0.02)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    return c;
  }

  /**
   * Porte sur le mur de droite (x=+2). Pivot a gauche de la porte (cote interieur).
   * Reste fermee jusqu'a t=14, puis s'ouvre violemment sur un couloir blanc lumineux.
   */
  private buildDoor(): void {
    const pivot = new Group();
    // Pivot positionne sur le bord interieur de la porte (cote face au joueur)
    pivot.position.set(1.98, 0, -0.7);
    this.group.add(pivot);
    this.doorPivot = pivot;

    // Le panneau de la porte est attache au pivot, decalé pour que sa charniere
    // soit a x=0 (local)
    const panel = new Mesh(
      new BoxGeometry(0.05, 2.2, 1.0),
      flatToon({ color: '#2a1408', roughness: 1.0 }),
    );
    panel.position.set(0, 1.1, 0.5); // decalage local : centre de la porte a +0.5 en z
    pivot.add(panel);

    // Petite poignee dorée
    const knob = new Mesh(
      new SphereGeometry(0.05, 10, 8),
      flatToon({ color: PALETTE.yellowDim, metalness: 0.7, roughness: 0.3 }),
    );
    knob.position.set(-0.03, 1.1, 0.92);
    pivot.add(knob);

    // Lueur de couloir (visible quand la porte s'ouvre) — gros plane blanc
    // place DERRIERE la porte (en +X global), face vers l'interieur de la loge
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 256;
    glowCanvas.height = 512;
    const gctx = glowCanvas.getContext('2d')!;
    const grad = gctx.createRadialGradient(128, 256, 30, 128, 256, 280);
    grad.addColorStop(0, 'rgba(255,250,230,1.0)');
    grad.addColorStop(0.6, 'rgba(255,230,180,0.6)');
    grad.addColorStop(1, 'rgba(40,20,10,0.0)');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 256, 512);
    const glowTex = new CanvasTexture(glowCanvas);
    glowTex.colorSpace = SRGBColorSpace;
    this.corridorGlow = new Mesh(
      new PlaneGeometry(1.2, 2.4),
      new MeshBasicMaterial({
        map: glowTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    this.corridorGlow.position.set(2.04, 1.2, -0.2);
    this.corridorGlow.rotation.y = -Math.PI / 2;
    this.group.add(this.corridorGlow);

    // Point light a l'exterieur (couloir) qui irradie quand la porte s'ouvre
    this.doorLight = new PointLight(new Color('#fff4d8'), 0, 7, 1.4);
    this.doorLight.position.set(2.6, 1.4, -0.2);
    this.group.add(this.doorLight);
  }

  // ============== Lifecycle ==============

  override onEnter(): void {
    this.deps.hud.setAmbientMode('final');
    this.deps.audio.switchAmbience('silent');
    this.deps.smileMeter.setActive(false);
    this.deps.hud.setVoiceCue('idle', 0.4);
    this.deps.microphone.setCue('idle', 0.4);
    // Drone tres bas pour ambiance creepy
    this.deps.audio.startStudioDrone(0.10);

    if (this.startAt === 'miroir') {
      // Skip directement au sourire greffe complet
      this.phaseTime = 6;
      this.smileFilterIntensity = 0.85;
      this.script.ambientStarted = true;
      this.script.welcomeSpoken = true;
      this.script.smileGraftStarted = true;
      for (const b of this.vanityBulbs) {
        const mat = b.material as MeshStandardMaterial;
        mat.emissiveIntensity = 2.5;
      }
      for (const pl of this.vanityLights) pl.intensity = 0.6;
    }

    // Initialise cinematic camera : pose fixe face au miroir, pitch leger
    this.applyCinematic();
  }

  private applyCinematic(): void {
    if (this.cinematicSet) return;
    this.cinematicSet = true;
    // Snap : joueur assis a y=1.55, regarde le miroir en +Z
    this.deps.setCinematicCamera(new Vector3(0, 1.55, -0.8), 0.95, 0.05, Math.PI);
  }

  // ============== Update ==============

  update(dt: number, _ctx: RoomUpdateContext): void {
    this.phaseTime += dt;
    const t = this.phaseTime;

    // Met a jour le CRT (scanlines anim) + filtre Snapchat
    if (this.mirrorMat) {
      this.mirrorMat.update(t, 0.55);
      this.updateMirrorFilter(dt, t);
    }

    // ===== Camera cinematique : pose fixe + micro head-bob respiration =====
    const bob = Math.sin(t * 0.7) * 0.008;
    const microPitch = 0.05 + Math.sin(t * 0.5) * 0.015;
    this.deps.setCinematicCamera(
      new Vector3(0, 1.55 + bob, -0.8),
      0.95,
      microPitch,
      Math.PI,
    );

    // ===== Script timeline =====
    const s = this.script;

    // t=0..2 : noir profond, host_breath ambient
    if (t > 0.5 && !s.ambientStarted) {
      s.ambientStarted = true;
      this.deps.audio.hostBreath();
    }

    // t=2 : ampoules vanity s'allument progressivement + ambient ramp
    if (t >= 2.0) {
      const k = clamp01((t - 2.0) / 2.0); // 2s pour s'allumer
      const ease = k * k * (3 - 2 * k);
      for (let i = 0; i < this.vanityBulbs.length; i++) {
        const bulb = this.vanityBulbs[i];
        const mat = bulb.material as MeshStandardMaterial;
        const delay = i * 0.06;
        const ki = clamp01((t - 2.0 - delay) / 1.5);
        const ei = ki * ki * (3 - 2 * ki);
        // Flicker leger
        const flicker = 0.85 + Math.sin(t * 18 + i * 1.3) * 0.15;
        mat.emissiveIntensity = ei * 2.5 * flicker;
        const pl = this.vanityLights[i];
        if (pl) pl.intensity = ei * 0.6 * flicker;
      }
      if (this.ambientLight) {
        this.ambientLight.intensity = 0.15 + ease * 0.35;
      }
    }

    // t=2.5 : M. Sourire (off) : "Bienvenue dans la famille."
    if (t >= 2.5 && !s.welcomeSpoken) {
      s.welcomeSpoken = true;
      this.deps.hud.setSubtitle('M. SOURIRE (off) : Bienvenue dans la famille.', 3.5);
      this.deps.audio.hostBreath();
    }

    // t=4..10 : sourire greffe apparait progressivement via le shader
    if (t >= 4.0 && !s.smileGraftStarted) {
      s.smileGraftStarted = true;
      this.deps.hud.setSubtitle('(Quelque chose change dans le miroir...)', 3.0);
    }
    if (s.smileGraftStarted) {
      // Camera shake leger entre t=5 et t=8 (la realite glisse)
      if (t > 5 && t < 8) {
        const shake = Math.sin(t * 32) * 0.005 * Math.sin((t - 5) * Math.PI / 3);
        this.deps.setCinematicCamera(
          new Vector3(shake, 1.55 + bob, -0.8 + shake * 0.5),
          0.95,
          microPitch + shake,
          Math.PI + shake * 0.3,
        );
      }
    }

    // t=6 : glitch_sting (sting horror sur l'apparition du sourire)
    if (t >= 6.0 && !s.glitchStingPlayed) {
      s.glitchStingPlayed = true;
      this.deps.audio.glitchSting(0.9);
      this.deps.postFX.pulse(0.6, 0.4);
    }

    // t=8 : host_evil_laugh discret
    if (t >= 8.0 && !s.evilLaughPlayed) {
      s.evilLaughPlayed = true;
      this.deps.audio.hostEvilLaugh();
      this.deps.hud.setSubtitle('M. SOURIRE (off) : Tu le vois maintenant.', 3.0);
    }

    // t=10 : second souffle
    if (t >= 10.5 && !s.breathTickPlayed) {
      s.breathTickPlayed = true;
      this.deps.audio.hostBreath();
    }

    // t=12 : annonce "PROCHAIN INVITÉ : N°45" + jingle
    if (t >= 12.0 && !s.announcePlayed) {
      s.announcePlayed = true;
      this.deps.audio.countdownBeep();
      setTimeout(() => this.deps.audio.tvIntroJingle(), 300);
      this.deps.hud.setSubtitle('VOIX : Prochain invite... N°45.', 3.5);
      this.deps.postFX.pulse(0.55, 0.35);
    }

    // t=14 : porte s'ouvre + lumiere violente, transition apres 1.2s
    if (t >= 14.0 && !s.doorBurstPlayed) {
      s.doorBurstPlayed = true;
      this.deps.audio.metallicScreech();
      this.deps.audio.screamerImpact(0.6);
      this.deps.postFX.pulse(1.0, 0.7);
    }
    if (s.doorBurstPlayed && this.doorPivot) {
      // Animation porte : rotation de 0 a -1.5 rad sur 1.0s
      const k = clamp01((t - 14.0) / 1.0);
      const ease = k * k * (3 - 2 * k);
      this.doorPivot.rotation.y = -ease * 1.5;
      if (this.doorLight) this.doorLight.intensity = ease * 12.0;
      if (this.corridorGlow) {
        const mat = this.corridorGlow.material as MeshBasicMaterial;
        mat.opacity = ease;
      }
    }

    // t=15.2 : transition vers AudienceFinalRoom
    if (t >= 15.2 && !s.transitionRequested) {
      s.transitionRequested = true;
      this.deps.requestRoomTransition((d) => new AudienceFinalRoom(d), 1000);
    }
  }

  /**
   * Pilote le filtre "Snapchat smile" du miroir CRT :
   * - Recupere les landmarks de la bouche depuis SmileDetector (MediaPipe)
   * - Lisse les valeurs (MediaPipe tourne a 15fps, on rend a 60fps)
   * - Augmente progressivement l'intensite entre t=4s et t=10s
   * - Pulse l'intensite a t=6s (glitch) et t=12s (annonce)
   *
   * Si pas de visage detecte : on garde le dernier landmark lisse (fallback),
   * ou bien on positionne le filtre au centre du miroir (vue par defaut).
   */
  private updateMirrorFilter(dt: number, t: number): void {
    if (!this.mirrorMat) return;

    // Cible d'intensite selon le timeline
    let targetIntensity = 0;
    if (this.startAt === 'miroir') {
      targetIntensity = 1.0;
    } else if (t >= 4.0) {
      // Ramp 0 -> 1.0 entre t=4 et t=10 (6s), avec easing exponentiel
      const k = clamp01((t - 4.0) / 6.0);
      targetIntensity = k * k * 1.0;
      // Pulse a t=6 (glitch sting) et t=12 (annonce)
      if (t >= 6.0 && t < 6.4) targetIntensity = Math.min(1.0, targetIntensity + 0.3);
      if (t >= 12.0) targetIntensity = 1.0;
    }
    this.smileFilterIntensity = damp(this.smileFilterIntensity, targetIntensity, 3.0, dt);

    // Recupere les landmarks frais depuis MediaPipe
    const fresh = this.deps.smileDetector.getMouthLandmarks();
    if (fresh) {
      if (!this.smoothedMouth) {
        this.smoothedMouth = JSON.parse(JSON.stringify(fresh)) as MouthLandmarks;
      } else {
        // Lerp doux vers la cible (lambda ~10 = stable mais reactif)
        const lambda = 10;
        const k = 1 - Math.exp(-lambda * dt);
        this.smoothedMouth.center.x += (fresh.center.x - this.smoothedMouth.center.x) * k;
        this.smoothedMouth.center.y += (fresh.center.y - this.smoothedMouth.center.y) * k;
        this.smoothedMouth.halfWidth += (fresh.halfWidth - this.smoothedMouth.halfWidth) * k;
        this.smoothedMouth.halfHeight += (fresh.halfHeight - this.smoothedMouth.halfHeight) * k;
        // Angle : on doit gerer le wraparound
        let da = fresh.angle - this.smoothedMouth.angle;
        if (da > Math.PI) da -= 2 * Math.PI;
        if (da < -Math.PI) da += 2 * Math.PI;
        this.smoothedMouth.angle += da * k;
      }
    }

    // Calcul stretch : progressif de 0 a 0.85 entre t=4 et t=14
    let stretch = 0;
    if (this.startAt === 'miroir') {
      stretch = 0.85;
    } else if (t >= 4) {
      const k = clamp01((t - 4.0) / 10.0);
      stretch = k * k * 0.85;
      // Petit twitch d'horreur quand le glitch sting joue
      if (t >= 6.0 && t < 6.5) stretch += 0.15 * (1 - (t - 6.0) / 0.5);
    }

    // Applique au shader
    if (this.smoothedMouth) {
      this.mirrorMat.setMouthFilter(
        this.smileFilterIntensity,
        this.smoothedMouth.center,
        Math.max(0.04, this.smoothedMouth.halfWidth),
        Math.max(0.015, this.smoothedMouth.halfHeight),
        this.smoothedMouth.angle,
        stretch,
      );
    } else {
      // Pas de visage detecte : filtre au centre par defaut
      this.mirrorMat.setMouthFilter(
        this.smileFilterIntensity * 0.6, // un peu moins fort sans landmarks
        { x: 0.5, y: 0.62 },
        0.13,
        0.04,
        0,
        stretch,
      );
    }
  }

  getInteractables(): Interactable[] {
    return [];
  }

  // ============== Dispose ==============

  dispose(): void {
    this.deps.audio.stopStudioDrone();
    this.deps.setCinematicCamera(null, 0);
    this.deps.postFX.setStress(0);
    if (this.mirrorMat) {
      const tex = this.mirrorMat.uniforms.uMap.value as Texture | null;
      tex?.dispose();
      this.mirrorMat.dispose();
    }
    this.group.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        const mat = o.material as MeshStandardMaterial | MeshStandardMaterial[];
        if (Array.isArray(mat)) {
          for (const m of mat) m.dispose();
        } else {
          mat.dispose?.();
        }
      }
    });
  }
}
