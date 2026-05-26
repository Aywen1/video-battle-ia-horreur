/**
 * StudioStage : la première salle. Assemble plateau, gradins, rideau, bureau,
 * caméra CRT, M. Sourire et la porte coulisses. Gère aussi le script narratif
 * de la salle (réveil, segment d'interview, climax).
 */
import {
  AmbientLight,
  Box3,
  Color,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { Room, RoomUpdateContext, RoomDeps, Interactable } from '../Room';
import { BackstageRoom } from './BackstageRoom';
import { buildStageFloor } from '../props/StageFloor';
import { buildStageEnvironment, animateBorderBulbs } from '../props/StageEnvironment';
import { buildCurtain } from '../props/Curtain';
import {
  buildAudience,
  animateAudience,
  audienceLookAt,
  audienceApplause,
} from '../props/AudienceSeats';
import { buildHostDesk } from '../props/HostDesk';
import { buildCRTCamera, animateCRTCamera } from '../props/CRTCamera';
import { buildCueCard } from '../props/CueCard';
import { buildStageLights, ignite, updateStageLights } from '../props/StageLights';
import { buildBackstageDoor } from '../props/BackstageDoor';
import { PuppetHost } from '../../entities/PuppetHost';

// Alias historique — la salle utilise désormais directement RoomDeps.
export type StudioStageDeps = RoomDeps;

/** Cibles disponibles pour le téléport debug. */
export type StudioStageStart =
  | 'awakening'
  | 'discovery'
  | 'interview'
  | 'climax'
  | 'aftermath';

type Phase =
  | 'awaiting-start'
  | 'awakening'
  | 'discovery'
  | 'interview'
  | 'interview-fail'
  | 'climax'
  | 'aftermath';

interface InterviewQuestion {
  text: string;
  subtitle: string;
  duration: number;
}

const QUESTIONS: InterviewQuestion[] = [
  { text: 'QUESTION 1\nComment t\'appelles-tu, petit invité ?', subtitle: 'M. SOURIRE : Comment t\'appelles-tu, petit invité ?', duration: 9 },
  { text: 'QUESTION 2\nMontre-nous ton plus beau sourire !', subtitle: 'M. SOURIRE : Plus large ! Plus large que ça !', duration: 11 },
  { text: 'QUESTION 3\nEt si tu restais avec nous ? Pour toujours.', subtitle: 'M. SOURIRE : Tu vas adorer la suite. Promis.', duration: 12 },
];

export class StudioStage extends Room {
  private deps: StudioStageDeps;
  private phase: Phase = 'awaiting-start';

  // Pieces
  private hostPuppet = new PuppetHost();
  private hostTargetDummy = new Object3D(); // sert de target pour les SpotLight
  private cueCardGroup: Group = new Group();
  private cueCardActive = true;
  private crtBuild: ReturnType<typeof buildCRTCamera> | null = null;
  private audienceBuild: ReturnType<typeof buildAudience> | null = null;
  private envBuild: ReturnType<typeof buildStageEnvironment> | null = null;
  private lightsBuild: ReturnType<typeof buildStageLights> | null = null;
  private doorBuild: ReturnType<typeof buildBackstageDoor> | null = null;
  /** Référence au mesh du rideau pour pouvoir le masquer au climax. */
  private curtainGroup: Group | null = null;
  /** Si vrai, on freeze les animations de lumières (cinématique de coupure). */
  private blackedOut = false;
  private hemi: HemisphereLight | null = null;
  private ambient: AmbientLight | null = null;

  // State
  private phaseTime = 0;
  private questionIndex = 0;
  private questionTimer = 0;
  private failHoldTimer = 0;
  private aboveComfortDuration = 0;
  private spotsIgnitedCount = 0;
  private climaxStarted = false;
  private climaxTimer = 0;
  /** Step-counter pour les beats du climax (0 → 4). */
  private climaxStep = 0;
  /** Position d'origine de M. Sourire (pour préparer le lunge). */
  private hostHomePos = new Vector3();
  private interactables: Interactable[] = [];
  private crtExaminedAt = -Infinity;
  /** Cooldown du pulse en zone warning (s). */
  private warningPulseCooldown = 0;
  /** Cooldown des micro-flickers de spots en phase fail. */
  private failFlickerCooldown = 0;

  /** Cible de démarrage (téléport debug). */
  private startAt: StudioStageStart;

  constructor(deps: StudioStageDeps, opts: { startAt?: StudioStageStart } = {}) {
    super();
    this.deps = deps;
    this.startAt = opts.startAt ?? 'awakening';
    this.build();
  }

  private build(): void {
    // Sol global + murs + ampoules
    const env = buildStageEnvironment();
    this.envBuild = env;
    this.group.add(env.group);

    // Plateau circulaire
    const stageFloor = buildStageFloor(5);
    this.group.add(stageFloor.group);

    // Rideau (panneau de fond, derrière le bureau)
    const curtain = buildCurtain(14, 5);
    curtain.position.set(0, 0, -3.6);
    this.curtainGroup = curtain;
    this.group.add(curtain);

    // Audience
    const audience = buildAudience();
    this.audienceBuild = audience;
    this.group.add(audience.group);

    // Bureau du présentateur
    const desk = buildHostDesk();
    desk.position.set(0, 0, -1.9);
    this.group.add(desk);

    // M. Sourire derrière le bureau (assis)
    this.hostPuppet.setPosition(0, 0.55, -2.4, 0);
    this.hostHomePos.set(0, 0.55, -2.4);
    this.group.add(this.hostPuppet.group);

    // Caméra CRT face au joueur
    const crt = buildCRTCamera(this.deps.webcamVideo);
    crt.group.position.set(1.6, 0, 1.9);
    crt.group.rotation.y = -Math.PI / 4;
    this.crtBuild = crt;
    this.group.add(crt.group);

    // Cue card au sol près du X (à 0.7m côté joueur du X, vers le bureau).
    // Texte : un mot d'accueil qui sonne... pas tout à fait juste.
    const card = buildCueCard('BIENVENUE\n\nLE SOURIRE EST OBLIGATOIRE');
    card.position.set(0, 0.01, 1.6);
    card.rotation.y = -0.2;
    this.cueCardGroup = card;
    this.group.add(card);

    // Lumières de scène (target = position au-dessus du plateau)
    this.hostTargetDummy.position.set(0, 1.3, 1.0);
    this.group.add(this.hostTargetDummy);
    const lights = buildStageLights(this.hostTargetDummy);
    this.lightsBuild = lights;
    this.group.add(lights.group);

    // Lumière ambiante pour ne PAS avoir de noir total (cf. .cursorrules)
    this.hemi = new HemisphereLight(new Color('#3a2030'), new Color('#1a0a18'), 0.45);
    this.group.add(this.hemi);
    this.ambient = new AmbientLight(new Color('#180815'), 0.3);
    this.group.add(this.ambient);

    // Porte coulisses (cachée derrière le rideau)
    const door = buildBackstageDoor();
    door.group.position.set(2.5, 0, -3.7);
    door.group.rotation.y = -0.1;
    this.doorBuild = door;
    this.group.add(door.group);

    // Colliders : périmètre du plateau + bureau + gradins (front face)
    this.colliders = [
      // Bureau
      new Box3(new Vector3(-1.4, 0, -2.7), new Vector3(1.4, 1.3, -1.2)),
      // Bord avant des gradins (audience)
      new Box3(new Vector3(-6, 0, 5.2), new Vector3(6, 1.6, 11)),
      // Murs
      new Box3(new Vector3(-12, 0, -8.5), new Vector3(12, 8, -7.6)),
      new Box3(new Vector3(-12.5, 0, -8.5), new Vector3(-11.5, 8, 11)),
      new Box3(new Vector3(11.5, 0, -8.5), new Vector3(12.5, 8, 11)),
      new Box3(new Vector3(-12, 0, 10.5), new Vector3(12, 8, 11.5)),
      // Rideau / panneau arrière du plateau (empêche de passer derrière)
      new Box3(new Vector3(-7, 0, -3.9), new Vector3(7, 5.5, -3.3)),
    ];

    // Spawn : sur le X, regardant vers le bureau du présentateur (axe -Z).
    // Three.js caméra par défaut regarde -Z, donc yaw = 0 = face au host.
    this.spawnPosition.set(0, 1.65, 2.3);
    this.spawnYaw = 0;
    this.spawnPitch = 0;

    // Fog teintée magenta sombre (sera modulée plus tard)
    if (this.deps.scene.fog instanceof Fog) {
      this.deps.scene.fog.color.set('#23121f');
      this.deps.scene.fog.near = 5;
      this.deps.scene.fog.far = 24;
    }
    this.deps.scene.background = new Color('#0e0a0d');

    // Interactables initiaux
    this.refreshInteractables();
  }

  private refreshInteractables(): void {
    this.interactables = [];
    if (this.cueCardActive) {
      this.interactables.push({
        position: this.cueCardGroup.position.clone().setY(0.2),
        radius: 0.7,
        label: 'Lire la carte',
        enabled: this.phase === 'discovery',
        onInteract: () => this.onTakeCueCard(),
      });
    }
    if (this.crtBuild) {
      this.interactables.push({
        position: this.crtBuild.group.position.clone().setY(1.8),
        radius: 0.9,
        label: 'Examiner la caméra',
        enabled: true,
        onInteract: () => this.onExamineCRT(),
      });
    }
    if (this.doorBuild && this.doorBuild.group.visible) {
      this.interactables.push({
        position: this.doorBuild.group.position.clone().setY(1.2),
        radius: 1.0,
        label: 'Ouvrir la porte',
        enabled: this.phase === 'aftermath',
        onInteract: () => this.onTryDoor(),
      });
    }
  }

  getInteractables(): Interactable[] {
    return this.interactables;
  }

  /** Démarre la séquence d'éveil (appelé depuis Game une fois tout prêt). */
  beginAwakening(): void {
    if (this.phase !== 'awaiting-start') return;
    this.phase = 'awakening';
    this.phaseTime = 0;
    this.spotsIgnitedCount = 0;
    // HUD studio : on garde ON AIR/AUDIMAT/etc.
    this.deps.hud.setAmbientMode('studio');
    // Caméra allongée au sol, regardant le plafond
    this.deps.setCinematicCamera(new Vector3(0, 0.35, 2.3), 1, -Math.PI / 2.2);
  }

  /** Hook appelé par Game.ts quand la salle est ajoutée à la scène. */
  override onEnter(): void {
    switch (this.startAt) {
      case 'awakening':
        this.beginAwakening();
        break;
      case 'discovery':
        this.jumpToDiscovery();
        break;
      case 'interview':
        this.jumpToInterview();
        break;
      case 'climax':
        this.jumpToClimax();
        break;
      case 'aftermath':
        this.jumpToAftermath();
        break;
    }
  }

  /** Téléport : démarre directement en phase découverte (lumières on, debout). */
  private jumpToDiscovery(): void {
    this.deps.hud.setAmbientMode('studio');
    // Allume les spots
    if (this.lightsBuild) {
      for (const s of this.lightsBuild.spots) ignite(s, 0.1);
    }
    this.phase = 'discovery';
    this.phaseTime = 0;
    this.deps.hud.setSubtitle('(Quelque chose au sol. Une carte.)', 4);
    this.refreshInteractables();
  }

  /** Téléport : démarre directement en phase interview (cue card déjà prise). */
  private jumpToInterview(): void {
    this.jumpToDiscovery();
    this.cueCardGroup.visible = false;
    this.cueCardActive = false;
    this.hostPuppet.awaken();
    this.phase = 'interview';
    this.questionIndex = 0;
    this.questionTimer = 0;
    this.aboveComfortDuration = 0;
    this.deps.smileMeter.setActive(true);
    this.deps.smileMeter.setMeter(0.85);
    this.startQuestion();
    this.refreshInteractables();
  }

  /** Téléport : démarre directement au climax (les questions ont été passées). */
  private jumpToClimax(): void {
    this.jumpToInterview();
    this.questionIndex = QUESTIONS.length;
    this.startClimax();
  }

  /** Téléport : sort directement en aftermath, porte coulisses révélée. */
  private jumpToAftermath(): void {
    this.jumpToDiscovery();
    this.cueCardGroup.visible = false;
    this.cueCardActive = false;
    this.hostPuppet.setVisible(false);
    if (this.curtainGroup) this.curtainGroup.visible = false;
    if (this.doorBuild) this.doorBuild.group.visible = true;
    this.phase = 'aftermath';
    this.deps.hud.setSubtitle('À SUIVRE…', 5);
    this.refreshInteractables();
  }

  private onTakeCueCard(): void {
    if (this.phase !== 'discovery') return;
    // Fait disparaître la carte (elle "a été ramassée")
    this.cueCardGroup.visible = false;
    this.cueCardActive = false;
    // Glitch + réveil de la marionnette
    this.deps.audio.glitchSting(0.7);
    this.hostPuppet.awaken();
    this.hostPuppet.lookAt({ position: new Vector3(0, 1.4, 2.3) } as Object3D);
    setTimeout(() => {
      this.deps.audio.hostUtterance(8, 1);
      this.hostPuppet.speak(2.5);
    }, 350);
    this.phase = 'interview';
    this.questionIndex = 0;
    this.questionTimer = 0;
    this.aboveComfortDuration = 0;
    this.deps.smileMeter.setActive(true);
    this.deps.smileMeter.setMeter(0.85);
    this.startQuestion();
    this.refreshInteractables();
  }

  private startQuestion(): void {
    const q = QUESTIONS[this.questionIndex];
    this.deps.hud.setSubtitle(q.subtitle, q.duration - 0.5);
    this.questionTimer = q.duration;
    this.aboveComfortDuration = 0;
    // M. Sourire prononce les syllabes
    setTimeout(() => {
      this.deps.audio.hostUtterance(6 + this.questionIndex * 2, 1);
      this.hostPuppet.speak(3 + this.questionIndex * 0.5);
    }, 200);
  }

  private onExamineCRT(): void {
    const now = performance.now() / 1000;
    if (now - this.crtExaminedAt < 1.0) return;
    this.crtExaminedAt = now;
    this.deps.audio.glitchSting(0.4);
    this.deps.hud.setSubtitle("(Tu te vois à l'écran. Tu n'as pas l'air bien.)", 3.5);
  }

  private onTryDoor(): void {
    if (this.phase !== 'aftermath') return;
    // Bloque toute nouvelle interaction
    this.interactables = [];
    this.deps.hud.setSubtitle('(La porte cède.)', 2.5);
    this.deps.audio.doorOpen();
    // Game.fadeTo gère le fade global
    setTimeout(() => {
      this.deps.requestRoomTransition((d) => new BackstageRoom(d), 1200);
    }, 700);
  }

  update(dt: number, ctx: RoomUpdateContext): void {
    this.phaseTime += dt;

    // Anim de fond — coupées pendant le blackout cinématique
    if (!this.blackedOut) {
      if (this.envBuild) animateBorderBulbs(this.envBuild.bulbs, ctx.time, ctx.smileMeter.stress);
      if (this.lightsBuild) updateStageLights(this.lightsBuild.spots, ctx.smileMeter.stress, ctx.time, dt);
    }
    if (this.audienceBuild) animateAudience(this.audienceBuild, ctx.time, dt);
    if (this.crtBuild) animateCRTCamera(this.crtBuild, ctx.time);

    // PuppetHost
    this.hostPuppet.setStress(ctx.smileMeter.stress);
    if (this.phase === 'interview' || this.phase === 'interview-fail') {
      this.hostPuppet.lookAt({ position: ctx.playerPosition } as Object3D);
    }
    this.hostPuppet.update(dt, ctx.time);

    // ---- Gradient d'horreur selon zones AUDIMAT ----
    // Ne s'applique qu'en interview/interview-fail/climax (pas pendant
    // l'éveil cinématique ou la découverte tranquille).
    this.applyStressGradient(dt, ctx);

    // Brouillard qui s'épaissit légèrement avec le stress
    if (this.deps.scene.fog instanceof Fog) {
      this.deps.scene.fog.far = 24 - ctx.smileMeter.stress * 8;
    }

    // ---- Phases ----
    switch (this.phase) {
      case 'awakening':
        this.updateAwakening(dt);
        break;
      case 'discovery':
        break;
      case 'interview':
        this.updateInterview(dt, ctx);
        break;
      case 'interview-fail':
        this.updateInterviewFail(dt, ctx);
        break;
      case 'climax':
        this.updateClimax(dt, ctx);
        break;
      case 'aftermath':
        break;
    }
  }

  /**
   * Branchements automatiques sur les zones d'AUDIMAT.
   * - Vert (zone 0) : ambiance nominale.
   * - Jaune (zone 1) : tenseBass à 0.25, watcher seul fixe le joueur.
   * - Orange (zone 2) : tenseBass à 0.6, pulse régulier, audience partiellement tournée.
   * - Rouge (zone 3) : géré par la phase interview-fail.
   */
  private applyStressGradient(dt: number, ctx: RoomUpdateContext): void {
    const zone = ctx.smileMeter.zone;
    const isActiveInterview =
      this.phase === 'interview' ||
      this.phase === 'interview-fail' ||
      this.phase === 'climax';

    if (!isActiveInterview) {
      this.deps.audio.setTenseBass(0);
      return;
    }

    // tenseBass selon zone
    if (zone === 0) this.deps.audio.setTenseBass(0);
    else if (zone === 1) this.deps.audio.setTenseBass(0.25);
    else if (zone === 2) this.deps.audio.setTenseBass(0.6);
    // zone 3 : on laisse la phase fail s'en occuper

    // Pulse régulier en zone warning (orange)
    if (zone === 2) {
      this.warningPulseCooldown -= dt;
      if (this.warningPulseCooldown <= 0) {
        this.deps.postFX.pulse(0.45, 0.35);
        this.warningPulseCooldown = 0.9 + Math.random() * 0.3;
      }
    } else {
      this.warningPulseCooldown = 0;
    }

    // Audience : watcher permanent à faible weight, partiel dès zone 2.
    // En phase fail/climax c'est géré par les phases spécifiques.
    if (this.audienceBuild && this.phase === 'interview') {
      if (zone === 0) {
        audienceLookAt(this.audienceBuild, ctx.playerPosition, 0.4, dt, true);
      } else if (zone === 1) {
        audienceLookAt(this.audienceBuild, ctx.playerPosition, 0.5, dt, true);
      } else if (zone === 2) {
        // Partiel : ~50% en moyenne, mais on l'applique à tous
        audienceLookAt(this.audienceBuild, ctx.playerPosition, 0.55, dt, false);
      }
    }
  }

  private updateAwakening(dt: number): void {
    // 0.0s : silence + nuit
    // 0.6s : allumage spot 1
    // 1.4s : allumage spot 2
    // 2.2s : allumage spot 3 + applause débute
    // 3.0s : caméra se redresse (interpolation pitch + offset Y vers normal)
    // 4.5s : caméra full upright, contrôles rendus au joueur
    const t = this.phaseTime;
    if (!this.lightsBuild) return;

    const spots = this.lightsBuild.spots;
    const triggers = [0.6, 1.6, 2.6];
    while (this.spotsIgnitedCount < 3 && t >= triggers[this.spotsIgnitedCount]) {
      ignite(spots[this.spotsIgnitedCount], 0.9);
      this.deps.audio.spotIgnition();
      this.spotsIgnitedCount++;
    }
    if (t > 2.8 && t < 2.85) {
      this.deps.audio.laugh(0);
    }

    if (t > 3.0 && t < 5.0) {
      // Redressement progressif sur 2 s : pos Y de 0.35 → 1.65, pitch -PI/2.2 → 0
      const k = Math.min(1, (t - 3.0) / 2.0);
      const eased = 1 - Math.pow(1 - k, 3);
      const yOff = 0.35 + (1.65 - 0.35) * eased;
      const pitch = (-Math.PI / 2.2) * (1 - eased);
      this.deps.setCinematicCamera(new Vector3(0, yOff, 2.3), 1, pitch);
    }
    if (t >= 5.0) {
      // Fin de la cinématique : on rend le contrôle au joueur
      this.deps.setCinematicCamera(null, 0);
      this.phase = 'discovery';
      this.phaseTime = 0;
      this.deps.hud.setSubtitle('(Quelque chose au sol. Une carte.)', 4);
      this.refreshInteractables();
    }
  }

  private updateInterview(dt: number, ctx: RoomUpdateContext): void {
    this.questionTimer -= dt;
    if (!ctx.smileMeter.belowComfort) {
      this.aboveComfortDuration += dt;
    } else {
      this.aboveComfortDuration = Math.max(0, this.aboveComfortDuration - dt * 0.5);
    }
    if (ctx.smileMeter.belowCritical) {
      this.enterInterviewFail();
      return;
    }
    if (this.aboveComfortDuration > 4.0 || this.questionTimer < 0) {
      this.deps.audio.applauseSting();
      if (this.audienceBuild) audienceApplause(this.audienceBuild, 0.7, 1.2);
      this.questionIndex++;
      if (this.questionIndex >= QUESTIONS.length) {
        this.startClimax();
      } else {
        this.startQuestion();
      }
    }
  }

  private enterInterviewFail(): void {
    this.phase = 'interview-fail';
    this.failHoldTimer = 0;
    this.failFlickerCooldown = 0;
    // Cluster audio + visuel
    this.deps.audio.glitchSting(1);
    this.deps.audio.laugh(0.8);
    this.deps.postFX.pulse(1.0, 0.3);
    // M. Sourire fixe et terrifiant
    this.hostPuppet.setEyeStage(2, true);
    this.deps.hud.setSubtitle("(M. Sourire t'observe.)", 2.5);
  }

  private updateInterviewFail(dt: number, ctx: RoomUpdateContext): void {
    this.failHoldTimer += dt;

    // Audience figée vers le joueur
    if (this.audienceBuild) {
      audienceLookAt(this.audienceBuild, ctx.playerPosition, 1.0, dt, false);
    }

    // Spots qui clignotent en continu (flickers stochastiques)
    this.failFlickerCooldown -= dt;
    if (this.failFlickerCooldown <= 0 && this.lightsBuild) {
      const spots = this.lightsBuild.spots;
      const target = spots[Math.floor(Math.random() * spots.length)];
      // Saute brutalement entre 0.2 et 1.2 d'intensité
      target.light.intensity = Math.random() < 0.5 ? 0.2 : 1.2;
      (target.beam.material as MeshBasicMaterial).opacity = target.light.intensity * 0.18;
      this.failFlickerCooldown = 0.06 + Math.random() * 0.10;
    }

    // À t=1.0s : silence rompu par une utterance déformée
    if (this.failHoldTimer >= 1.0 && this.failHoldTimer - dt < 1.0) {
      this.deps.audio.hostUtterance(7, 1.4);
      this.hostPuppet.speak(1.2);
    }

    if (this.failHoldTimer > 2.5) {
      // Retour à la question (relâche eyeStage, retour à l'auto-mapping)
      this.hostPuppet.releaseEyeStage();
      this.deps.smileMeter.setMeter(0.55);
      this.phase = 'interview';
      this.startQuestion();
    }
  }

  private startClimax(): void {
    this.phase = 'climax';
    this.climaxStarted = false;
    this.climaxTimer = 0;
    this.climaxStep = 0;
    this.deps.smileMeter.setActive(false);
    this.deps.hud.setSubtitle('M. SOURIRE : Tu mérites un câlin...', 0.9);
  }

  /**
   * Climax (~5.2s) — screamer ULTRA RAPIDE avec GROS BRUIT d'arrivée +
   * câlin forcé 2s + retour + fausse normalité + blackout → porte révélée.
   *
   *   t=0.00 | sub "Tu mérites un câlin..."
   *   t=0.15 | eyeStage 1, audience verrouille, tenseBass max
   *   t=0.25 | LUNGE 0.25s, neckStretch=1, armsOpen=1, pulse(1.0, 0.25)
   *   t=0.50 | **GROS BRUIT** + eyeStage 2 + "VIENS DANS MES BRAS !" + pulse(1.2, 0.5)
   *   t=0.50-2.50 | CÂLIN : host suit, bras agités, pulses
   *   t=2.50 | RETOUR : glide 0.5s, bras se referment
   *   t=3.00 | À sa place, sub "...où en étions-nous ?"
   *   t=3.90 | releaseEyeStage, faux retour à la normale
   *   t=4.20 | SURPRISE — powerCut, blackout
   *   t=4.30 | host invisible, rideau invisible
   *   t=5.20 | relight, porte révélée, "À SUIVRE…"
   */
  private updateClimax(dt: number, ctx: RoomUpdateContext): void {
    this.climaxTimer += dt;
    const t = this.climaxTimer;
    const prev = t - dt;

    if (t >= 0.15 && this.audienceBuild && !this.blackedOut) {
      audienceLookAt(this.audienceBuild, ctx.playerPosition, 1.0, dt, false);
    }

    // Beat 1 : prep ultra rapide (t=0.15)
    if (this.climaxStep === 0 && t >= 0.15) {
      this.climaxStep = 1;
      this.hostPuppet.setEyeStage(1, true);
      this.deps.audio.setTenseBass(1.0);
    }

    // Beat 2 : LUNGE TRÈS RAPIDE (t=0.25) — 0.25s
    if (this.climaxStep === 1 && t >= 0.25) {
      this.climaxStep = 2;
      const target = this.computeHugTarget(ctx.playerPosition);
      this.hostPuppet.lunge(target, 0.25);
      this.hostPuppet.setNeckStretch(1);
      this.hostPuppet.setArmsOpen(1);
      this.deps.postFX.pulse(1.0, 0.25);
    }

    // Beat 3 : ARRIVÉE — GROS BRUIT + câlin commence (t=0.50)
    if (this.climaxStep === 2 && t >= 0.50) {
      this.climaxStep = 3;
      // GROS BRUIT — pile sur l'arrivée à bout portant du présentateur
      this.deps.audio.screamerImpact(1.2);
      this.hostPuppet.setEyeStage(2, true);
      this.deps.hud.setSubtitle('M. SOURIRE : VIENS DANS MES BRAS !', 1.8);
      this.deps.audio.hostUtterance(9, 1.6);
      this.hostPuppet.speak(2.0);
      this.deps.postFX.pulse(1.2, 0.5);
    }

    // Pendant le câlin (step 3) : suivi joueur + pulses + sous-titres
    if (this.climaxStep === 3) {
      if (!this.hostPuppet.isLungeActive()) {
        const target = this.computeHugTarget(ctx.playerPosition);
        this.hostPuppet.group.position.lerp(target, Math.min(1, dt * 4));
        const dx = ctx.playerPosition.x - this.hostPuppet.group.position.x;
        const dz = ctx.playerPosition.z - this.hostPuppet.group.position.z;
        const desiredYaw = Math.atan2(dx, dz);
        this.hostPuppet.group.rotation.y +=
          (desiredYaw - this.hostPuppet.group.rotation.y) * Math.min(1, dt * 6);
      }
      if (Math.floor(t * 1.4) !== Math.floor(prev * 1.4)) {
        this.deps.postFX.pulse(0.55, 0.35);
      }
      if (prev < 1.3 && t >= 1.3) {
        this.deps.hud.setSubtitle('M. SOURIRE : Tu es ma star pour toujours.', 1.3);
      }
      if (prev < 2.0 && t >= 2.0) {
        this.deps.hud.setSubtitle('(Ses doigts sont froids.)', 1.0);
        this.deps.audio.hostUtterance(3, 1.2);
      }
    }

    // Beat 4 : début du retour (t=2.50)
    if (this.climaxStep === 3 && t >= 2.50) {
      this.climaxStep = 4;
      this.hostPuppet.glide(this.hostHomePos, 0.5);
      this.hostPuppet.setArmsOpen(0);
      this.hostPuppet.setNeckStretch(0);
      this.hostPuppet.setEyeStage(1, true);
      this.deps.audio.setTenseBass(0.3);
      this.deps.hud.setSubtitle('M. SOURIRE : ...où en étions-nous ?', 1.8);
    }

    // Beat 5 : à sa place, faux retour à la normale (t=3.00)
    if (this.climaxStep === 4 && t >= 3.00) {
      this.climaxStep = 5;
      this.hostPuppet.group.rotation.y = 0;
    }
    if (this.climaxStep === 5 && t >= 3.90) {
      this.climaxStep = 6;
      this.hostPuppet.releaseEyeStage();
      this.deps.audio.setTenseBass(0);
    }

    // Beat 6 : SURPRISE — powerCut (t=4.20)
    if (this.climaxStep === 6 && t >= 4.20) {
      this.climaxStep = 7;
      this.climaxStarted = true;
      this.blackedOut = true;
      this.deps.audio.powerCut();
      this.deps.audio.setTenseBass(0);
      if (this.lightsBuild) {
        for (const s of this.lightsBuild.spots) {
          s.light.intensity = 0;
          (s.beam.material as MeshBasicMaterial).opacity = 0;
        }
      }
      if (this.envBuild) {
        for (const b of this.envBuild.bulbs) {
          (b.material as MeshStandardMaterial).emissiveIntensity = 0;
        }
      }
      this.deps.hud.setOpacity(0.12);
      this.deps.smileMeter.setMeter(0.5);
    }

    // Beat 7 : host disparaît (t=4.30)
    if (this.climaxStep === 7 && t >= 4.30) {
      this.climaxStep = 8;
      this.hostPuppet.setVisible(false);
      if (this.curtainGroup) this.curtainGroup.visible = false;
    }

    // Beat 8 : relight + porte révélée (t=5.20)
    if (this.climaxStep === 8 && t >= 5.20) {
      this.climaxStep = 9;
      this.blackedOut = false;
      if (this.doorBuild) this.doorBuild.group.visible = true;
      if (this.lightsBuild) {
        for (const s of this.lightsBuild.spots) {
          ignite(s, 0.6);
        }
      }
      this.deps.hud.setOpacity(1);
      this.deps.audio.laugh(0.4);
      this.deps.hud.setSubtitle('À SUIVRE…', 5);
      this.phase = 'aftermath';
      this.refreshInteractables();
    }
  }

  /**
   * Position idéale du host pour "câliner" le joueur :
   * à 0.7m du joueur, dans la direction du bureau d'origine.
   */
  private computeHugTarget(playerPos: Vector3): Vector3 {
    const dir = new Vector3()
      .subVectors(this.hostHomePos, playerPos)
      .setY(0);
    if (dir.lengthSq() < 0.0001) dir.set(0, 0, -1);
    else dir.normalize();
    return new Vector3(
      playerPos.x + dir.x * 0.7,
      0.55,
      playerPos.z + dir.z * 0.7,
    );
  }

  dispose(): void {
    this.hostPuppet.dispose();
    // Les autres meshes sont dans this.group qui sera retiré
    this.group.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        const mat = o.material as any;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      }
    });
  }
}

