/**
 * PlateauRoom — Chapitre 3 v2 « Le Plateau » (immersif + public choregraphie).
 *
 * Le joueur ouvre les yeux derriere le bureau presentateur. Le plateau est
 * **deja allume et vivant**. Un rideau de velours rouge masque la vue. Un
 * countdown TV "3... 2... 1..." s'enchaine, le rideau monte, la musique de
 * generique demarre, le public applaudit. La premiere cue card descend.
 *
 * Le public est hyper choregraphie : mexican wave des bouches quand on parle,
 * lean-forward en bloc quand on murmure, hands-up synchronise quand on crie
 * fort, spots individuels qui balaient les seats, freeze en hurlement
 * silencieux au climax.
 *
 * 3 phases :
 *   - INTRO  : 6s scriptees, curtain reveal + applause + premiere cue card.
 *   - DUEL   : 4 cues alternees cri / silence.
 *   - CLIMAX : cri ultime + screamer fullscreen + carton Ch4.
 */
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  Color,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SpotLight,
  Vector3,
} from 'three';
import { Room, RoomDeps, RoomUpdateContext, Interactable } from '../Room';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { PALETTE } from '../../utils/palette';
import { buildStageEnvironment, animateBorderBulbs } from '../props/StageEnvironment';
import { buildStageFloor } from '../props/StageFloor';
import { buildCurtain } from '../props/Curtain';
import {
  buildAudience,
  animateAudience,
  audienceApplause,
  audienceMexicanWave,
  audienceLeanForward,
  audienceHandsUp,
  audienceStand,
  audienceMouthChain,
  audienceFreezeScream,
} from '../props/AudienceSeats';
import { buildHostDesk } from '../props/HostDesk';
import { buildStageLights } from '../props/StageLights';
import { buildCRTCamera, animateCRTCamera } from '../props/CRTCamera';
import { GuestChild } from '../../entities/GuestChild';
import { PuppetHost } from '../../entities/PuppetHost';
import { PromptCard } from '../props/PromptCard';
import { EndChapterCard } from '../../ui/EndChapterCard';
import { FullscreenScreamer } from '../../ui/FullscreenScreamer';
import { clamp } from '../../utils/math';
import { DressingRoom } from './DressingRoom';

export type PlateauStart = 'intro' | 'duel' | 'climax';

type Phase = 'intro' | 'duel' | 'climax' | 'ending';

const clamp01 = (x: number): number => clamp(x, 0, 1);

interface DuelCue {
  text: string;
  subtitle: string;
  mode: 'scream' | 'silence';
  threshold: number;
  holdMs: number;
}

export class PlateauRoom extends Room {
  private deps: RoomDeps;
  private startAt: PlateauStart;
  private phase: Phase = 'intro';
  private phaseTime = 0;
  private cinematicSet = false;

  // Build
  private envBuild: ReturnType<typeof buildStageEnvironment> | null = null;
  private audienceBuild: ReturnType<typeof buildAudience> | null = null;
  private lightsBuild: ReturnType<typeof buildStageLights> | null = null;
  private crtBuild: ReturnType<typeof buildCRTCamera> | null = null;
  private guest: GuestChild | null = null;
  private hostPuppet: PuppetHost | null = null;
  private hostHomePos = new Vector3(0, 0.55, 2.5);
  private playerObject = new Object3D();
  private promptCard: PromptCard | null = null;
  private hemi: HemisphereLight | null = null;
  private ambient: AmbientLight | null = null;
  private hostTargetDummy = new Object3D();
  private endCard: EndChapterCard | null = null;
  private screamer: FullscreenScreamer | null = null;
  // Rideau de l'intro (devant le joueur, monte au reveal)
  private introCurtain: Group | null = null;
  // Spots individuels qui eclairent l'audience un par un
  private audienceSpots: SpotLight[] = [];
  // Wash de plafond sur le public (3 spots large pour eclairer la masse)
  private audienceWash: SpotLight[] = [];
  // Camera shake state (climax)
  private shakeAmount = 0;
  private shakePhase = 0;

  // Intro state
  private introScript = {
    countdown3Played: false,
    countdown2Played: false,
    countdown1Played: false,
    curtainStarted: false,
    bulbCascadeStarted: false,
    bulbCascadeIndex: 0,
    bulbCascadeTimer: 0,
    spotsIgnited: false,
    hostAnnounced: false,
    applauseTriggered: false,
    cueCardDescended: false,
    transitionDone: false,
  };
  private bulbBaseIntensity = 2.5;

  // Phase duel
  private duelCueIndex = 0;
  private duelCueTransitionAt = -Infinity;
  private duelCueStartTime = 0;
  private duelCueSuccess = false;
  private duelSilenceHoldMs = 0;
  private duelCues: DuelCue[] = [
    {
      text: 'DIS\nBONJOUR',
      subtitle: '(Crie pour qu\'il t\'entende.)',
      mode: 'scream',
      threshold: 0.40,
      holdMs: 700,
    },
    {
      text: 'TAIS-TOI\nMAINTENANT',
      subtitle: '(Ne fais plus un son.)',
      mode: 'silence',
      threshold: 0.10,
      holdMs: 4000,
    },
    {
      text: 'PLUS\nFORT',
      subtitle: '(Il n\'entend pas encore.)',
      mode: 'scream',
      threshold: 0.65,
      holdMs: 1100,
    },
    {
      text: 'PLUS\nUN\nMOT',
      subtitle: '(Retiens ta respiration.)',
      mode: 'silence',
      threshold: 0.08,
      holdMs: 6000,
    },
  ];

  // Phase climax
  private climaxThreshold = 0.85;
  private climaxRelaxedAt = -1;
  private climaxTriggered = false;
  private climaxHeartbeatTimer = 0;
  private hasShownEndCard = false;

  // Mic-reactive
  private smoothedReactiveLevel = 0;

  constructor(deps: RoomDeps, opts: { startAt?: PlateauStart } = {}) {
    super();
    this.deps = deps;
    this.startAt = opts.startAt ?? 'intro';
    this.build();
    this.applySpawnForStart();
  }

  private applySpawnForStart(): void {
    // Le joueur est assis derriere le bureau, face au public (vers +Z).
    // ATTENTION : en three.js, yaw=0 regarde -Z. Pour regarder +Z il faut yaw=PI.
    this.spawnPosition.set(0, 1.55, -1.4);
    this.spawnYaw = Math.PI; // regarde vers +Z (l'audience, l'enfant et le rideau d'intro)
    this.spawnPitch = 0;
  }

  // ============== Build ==============

  private build(): void {
    // ===== Environnement (sol/plafond/murs/ampoules) — reutilisation =====
    const env = buildStageEnvironment();
    this.envBuild = env;
    this.group.add(env.group);
    // Sauvegarde l'intensite de base des bulbes
    if (env.bulbs.length > 0) {
      const mat0 = env.bulbs[0].material as MeshStandardMaterial;
      this.bulbBaseIntensity = mat0.emissiveIntensity || 2.5;
    }

    // Plateau circulaire
    const stageFloor = buildStageFloor(5);
    this.group.add(stageFloor.group);

    // Rideau de fond du plateau : derriere le joueur (cote -Z, dos a la camera).
    // Le joueur ne le voit qu'en se retournant. Sert d'arriere-plan visuel.
    const bgCurtain = buildCurtain(14, 5);
    bgCurtain.position.set(0, 0, -4.5);
    this.group.add(bgCurtain);

    // Audience en face du joueur (z=+5..+8 — convention buildAudience)
    const audience = buildAudience();
    this.audienceBuild = audience;
    this.group.add(audience.group);

    // Bureau du presentateur : devant le joueur (entre lui et l'audience).
    // Le joueur est assis derriere son bureau a z=-1.4, le bureau a z=-0.4 face au public.
    const desk = buildHostDesk();
    desk.position.set(0, 0, -0.4);
    desk.rotation.y = Math.PI; // tourne le bureau vers le public (devant z=+1)
    this.group.add(desk);

    // ===== Chaise invite + GuestChild =====
    // L'invite est a cote du joueur sur sa droite, face au public (yaw=0 = face -Z... non +Z car le public est en +Z et le joueur regarde +Z)
    // Position : a droite du joueur (x=+1.4), legerement en avant (z=-1.2), face au public.
    const chairX = 1.4;
    const chairZ = -1.2;
    const chairFrame = new Mesh(
      new BoxGeometry(0.7, 0.05, 0.7),
      flatToon({ color: '#3a2010', roughness: 1.0 }),
    );
    chairFrame.position.set(chairX, 0.4, chairZ);
    this.group.add(chairFrame);
    const chairBack = new Mesh(
      new BoxGeometry(0.7, 0.85, 0.05),
      flatToon({ color: '#3a2010', roughness: 1.0 }),
    );
    // Dossier derriere l'invite (cote -Z car invite regarde +Z)
    chairBack.position.set(chairX, 0.82, chairZ - 0.32);
    this.group.add(chairBack);
    for (const [px, pz] of [
      [chairX - 0.30, chairZ - 0.30], [chairX + 0.30, chairZ - 0.30],
      [chairX - 0.30, chairZ + 0.30], [chairX + 0.30, chairZ + 0.30],
    ]) {
      const leg = new Mesh(
        new BoxGeometry(0.06, 0.4, 0.06),
        flatToon({ color: '#3a2010', roughness: 1.0 }),
      );
      leg.position.set(px, 0.2, pz);
      this.group.add(leg);
    }
    this.guest = new GuestChild();
    this.guest.setPosition(chairX, 0.43, chairZ);
    this.guest.setYaw(0); // face +Z (vers le public, comme le joueur)
    this.guest.setVisible(true);
    this.guest.setEmotion(0.3);
    this.guest.setGrotesque(0.0);
    this.group.add(this.guest.group);

    // ===== Lumieres de scene — plateau deja allume =====
    // Target des spots : juste devant le bureau (point ou le presentateur regarde).
    this.hostTargetDummy.position.set(0, 1.3, 0.5);
    this.group.add(this.hostTargetDummy);
    const lights = buildStageLights(this.hostTargetDummy);
    this.lightsBuild = lights;
    this.group.add(lights.group);
    for (const s of lights.spots) {
      s.light.intensity = s.baseIntensity;
    }

    // ===== Spots individuels sur l'audience (5 spots) =====
    this.buildAudienceSpots();

    // ===== Wash de plafond pour eclairer le public en masse =====
    this.buildAudienceWash();

    // ===== M. Sourire — presentateur physique, debout sur le plateau =====
    // Place entre la PromptCard et l'audience, face au joueur (rotY=Math.PI = face -Z).
    this.hostPuppet = new PuppetHost();
    this.hostPuppet.setPosition(this.hostHomePos.x, this.hostHomePos.y, this.hostHomePos.z, Math.PI);
    this.hostPuppet.setVisible(true);
    this.hostPuppet.awaken();
    this.group.add(this.hostPuppet.group);

    // ===== CRT camera : place devant a gauche, oriente vers le joueur =====
    const crt = buildCRTCamera(this.deps.webcamVideo);
    crt.group.position.set(-2.2, 0, 1.2);
    crt.group.rotation.y = Math.PI / 4;
    this.crtBuild = crt;
    this.group.add(crt.group);

    // ===== Ambient/hemi — plateau allume plus genereusement =====
    this.hemi = new HemisphereLight(new Color('#7a4858'), new Color('#1a0a18'), 0.95);
    this.group.add(this.hemi);
    this.ambient = new AmbientLight(new Color('#4a3040'), 0.70);
    this.group.add(this.ambient);

    // ===== PromptCard (cintre) =====
    this.promptCard = new PromptCard();
    // Position : suspendue au-dessus du plateau, devant le joueur (cote +Z)
    this.promptCard.group.position.set(0, 0, 1.5);
    this.promptCard.group.rotation.y = Math.PI; // face le joueur (qui regarde +Z)
    this.group.add(this.promptCard.group);

    // ===== Rideau d'intro : devant le joueur, suspendu, descend du plafond =====
    this.buildIntroCurtain();

    // ===== Colliders (joueur assis derriere son bureau) =====
    this.colliders = [
      new Box3(new Vector3(-12, 0, 8.5), new Vector3(12, 6, 8.7)),     // mur arriere audience
      new Box3(new Vector3(-12, 0, -5.0), new Vector3(12, 6, -4.8)),   // mur derriere joueur
      new Box3(new Vector3(8, 0, -5), new Vector3(8.2, 6, 9)),         // mur droit
      new Box3(new Vector3(-8.2, 0, -5), new Vector3(-8, 6, 9)),       // mur gauche
    ];
  }

  private buildAudienceSpots(): void {
    if (!this.audienceBuild) return;
    // 5 spots qui pointent sur les 5 seats centraux de l'audience
    const seats = this.audienceBuild;
    for (let i = 1; i <= 5; i++) {
      const seatPos = seats.headWorldPos[i];
      const colorPalette = [PALETTE.yellow, PALETTE.magenta, PALETTE.blue, PALETTE.green, PALETTE.red];
      const color = new Color(colorPalette[i - 1]);
      const sl = new SpotLight(color, 0, 14, Math.PI / 7, 0.5, 1.5);
      sl.position.set(seatPos.x, 5.8, seatPos.z - 2.2);
      const target = new Object3D();
      target.position.set(seatPos.x, 1.55, seatPos.z);
      this.group.add(target);
      sl.target = target;
      this.group.add(sl);
      this.audienceSpots.push(sl);
    }
  }

  private buildAudienceWash(): void {
    // 3 spots de plafond, cone tres large, qui eclairent les 3 zones de la masse.
    // Place a y=7.5 face vers le bas, cible niveau tete de la rangee centrale.
    const config: Array<{ x: number; z: number; tx: number; tz: number; color: string }> = [
      { x: -3.5, z: 6.0, tx: -3.5, tz: 6.8, color: '#fff6e0' },
      { x:  0.0, z: 6.0, tx:  0.0, tz: 6.8, color: '#ffe8d0' },
      { x:  3.5, z: 6.0, tx:  3.5, tz: 6.8, color: '#fff6e0' },
    ];
    for (const c of config) {
      const sl = new SpotLight(new Color(c.color), 0, 22, Math.PI / 3, 0.7, 1.2);
      sl.position.set(c.x, 7.5, c.z);
      const target = new Object3D();
      target.position.set(c.tx, 1.8, c.tz);
      this.group.add(target);
      sl.target = target;
      this.group.add(sl);
      this.audienceWash.push(sl);
    }
  }

  private buildIntroCurtain(): void {
    // Rideau d'intro : devant le joueur (qui est a z=-1.4 et regarde +Z).
    // On le place a z=+0.5 pour bien couvrir la vue de l'enfant + public.
    // Largeur 14 pour deborder a gauche et droite, hauteur 7 pour couvrir
    // tout le champ vertical depuis y=0 jusqu'au plafond.
    const curtain = buildCurtain(14, 7);
    curtain.position.set(0, 0, 0.5);
    this.introCurtain = curtain;
    this.group.add(curtain);
  }

  // ============== Lifecycle ==============

  override onEnter(): void {
    this.deps.hud.setAmbientMode('plateau');
    this.deps.audio.switchAmbience('studio');
    this.deps.smileMeter.setActive(false);
    this.applyCinematic();
    this.deps.hud.setVoiceCue('idle', 0.5);
    this.deps.microphone.setCue('idle', 0.5);
    this.deps.hud.setVoiceFallback(this.deps.microphone.isUsingFallback);
    // Drone studio : sub-bass + noise pink, monte progressivement de phase en phase
    this.deps.audio.startStudioDrone(0.05);
    // Buzz CRT discret (50Hz hum d'un vieux moniteur cathodique)
    this.deps.audio.startCrtBuzz();

    switch (this.startAt) {
      case 'intro':
        this.phase = 'intro';
        this.phaseTime = 0;
        // Rideau ferme (Y=0)
        if (this.introCurtain) this.introCurtain.position.y = 0;
        break;
      case 'duel':
        this.skipIntro();
        this.enterDuel();
        break;
      case 'climax':
        this.skipIntro();
        this.enterClimax();
        break;
    }
  }

  private applyCinematic(): void {
    if (this.cinematicSet) return;
    this.cinematicSet = true;
    // Snap initial : position au spawn + pitch leger vers le bas (le joueur
    // est encore "endormi"). updateIntro animera ensuite frame par frame.
    this.deps.setCinematicCamera(new Vector3(0, 1.55, -1.4), 0.95, -0.18, Math.PI);
  }

  /** Skip immediat de l'intro pour les teleports. */
  private skipIntro(): void {
    if (this.introCurtain) {
      this.introCurtain.visible = false;
      this.introCurtain.position.y = 8;
    }
    if (this.lightsBuild) {
      for (const s of this.lightsBuild.spots) s.light.intensity = s.baseIntensity;
    }
    // Allume les wash audience a leur intensite de base
    for (const sl of this.audienceWash) sl.intensity = 4.0;
    this.introScript.transitionDone = true;
  }

  // ============== Phase INTRO ==============

  private updateIntro(dt: number, _ctx: RoomUpdateContext): void {
    const t = this.phaseTime;
    const s = this.introScript;

    // ===== 1) Animation camera frame-par-frame =====
    let camPosZ = -1.4;
    let camPitch = 0;
    let camYaw = Math.PI;
    if (t < 1.0) {
      // Phase tete-basse pre-jingle : pitch negatif (regarde le bureau), camera proche
      camPitch = -0.18 * (1 - t * 0.5);
    } else if (t < 3.0) {
      // Avant de monter le rideau : leger zoom-in (recule vers -1.25) + redresse la tete
      const k = (t - 1.0) / 2.0;
      camPosZ = -1.4 + k * 0.15;
      camPitch = -0.18 * (1 - k);
    } else if (t < 4.2) {
      // Rideau monte : on suit du regard (pitch monte legerement)
      const k = (t - 3.0) / 1.2;
      camPosZ = -1.25;
      camPitch = 0 + k * 0.14;
    } else if (t < 4.7) {
      // Stabilisation sur l'hote
      const k = (t - 4.2) / 0.5;
      camPosZ = -1.25 + k * 0.15;
      camPitch = 0.14 * (1 - k);
    } else if (t < 5.5) {
      // Pan : balayage du public (yaw oscille)
      const k = (t - 4.7) / 0.8;
      camYaw = Math.PI + Math.sin(k * Math.PI * 1.5) * 0.22;
      camPosZ = -1.1;
    } else {
      // Retour centre, descente de la PromptCard
      const k = clamp01((t - 5.5) / 0.5);
      camYaw = Math.PI + (1 - k) * Math.sin(2.0) * 0.22;
      camPosZ = -1.1 + k * -0.30;
    }
    this.deps.setCinematicCamera(new Vector3(0, 1.55, camPosZ), 0.95, camPitch, camYaw);

    // ===== 2) Eclairage cinematique en cascade =====
    this.updateIntroLights(t, dt);

    // ===== 3) Timeline audio + script =====
    if (t >= 0.4 && !s.countdown3Played && t < 0.6) {
      this.deps.audio.tvIntroJingle();
    }
    if (t >= 1.0 && !s.countdown3Played) {
      s.countdown3Played = true;
      this.deps.audio.countdownBeep();
      this.deps.hud.setSubtitle('ANTENNE DANS 3...', 0.8);
    }
    if (t >= 1.7 && !s.countdown2Played) {
      s.countdown2Played = true;
      this.deps.audio.countdownBeep();
      this.deps.hud.setSubtitle('2...', 0.8);
    }
    if (t >= 2.4 && !s.countdown1Played) {
      s.countdown1Played = true;
      this.deps.audio.countdownBeep();
      this.deps.hud.setSubtitle('1...', 0.8);
    }

    // t=3.0 : le rideau monte en 1.2s
    if (t >= 3.0 && !s.curtainStarted) {
      s.curtainStarted = true;
      this.deps.audio.cuecardDescend();
      // Flash blanc subtil sur l'ouverture
      this.deps.postFX.pulse(0.4, 0.25);
    }
    if (s.curtainStarted && this.introCurtain) {
      const k = clamp01((t - 3.0) / 1.2);
      const ease = k * k * (3 - 2 * k);
      this.introCurtain.position.y = ease * 7.0;
      if (k >= 1) this.introCurtain.visible = false;
    }

    // t=4.0 : M. Sourire annonce + flash + lookAt joueur
    if (t >= 4.0 && !s.hostAnnounced) {
      s.hostAnnounced = true;
      this.deps.audio.hostUtterance(10, 1.3);
      this.deps.hud.setSubtitle('M. SOURIRE : Mesdames et messieurs, accueillons... n44 !', 3.5);
      this.deps.postFX.pulse(0.65, 0.35);
      this.hostPuppet?.speak(2.0);
      // M. Sourire regarde le joueur, puis le public
      this.playerObject.position.set(0, 1.55, -1.4);
      this.hostPuppet?.lookAt(this.playerObject);
    }

    // t=4.7 : applause + spots audience cascade
    if (t >= 4.7 && !s.applauseTriggered) {
      s.applauseTriggered = true;
      this.deps.audio.applauseSwell(1.5);
      if (this.audienceBuild) audienceApplause(this.audienceBuild, 1.0, 3.2);
      this.deps.postFX.pulse(0.45, 0.4);
    }

    // t=5.5 : premiere cue card
    if (t >= 5.5 && !s.cueCardDescended) {
      s.cueCardDescended = true;
      this.showDuelCue();
    }

    // t=6.5 : transition vers duel
    if (t >= 6.5 && !s.transitionDone) {
      s.transitionDone = true;
      this.phase = 'duel';
      this.phaseTime = 0;
    }
  }

  /**
   * Anime l'eclairage pendant l'intro :
   * - Bulbes en cascade droite-gauche
   * - AudienceWash ramp 0 -> 4 entre t=3 et t=4.5
   * - StageLights spots qui swing pendant l'annonce
   * - AudienceSpots qui s'allument en cascade sur l'applause
   */
  private updateIntroLights(t: number, dt: number): void {
    // -- Cascade bulbes (chaque bulb s'allume sequentiellement)
    if (t >= 3.0 && this.envBuild) {
      const s = this.introScript;
      if (!s.bulbCascadeStarted) s.bulbCascadeStarted = true;
      s.bulbCascadeTimer += dt;
      const stepDur = 0.05;
      const total = this.envBuild.bulbs.length;
      while (s.bulbCascadeIndex < total && s.bulbCascadeTimer >= stepDur) {
        const idx = total - 1 - s.bulbCascadeIndex;
        const mat = this.envBuild.bulbs[idx].material as MeshStandardMaterial;
        mat.emissiveIntensity = this.bulbBaseIntensity * 1.7;
        s.bulbCascadeIndex++;
        s.bulbCascadeTimer -= stepDur;
      }
    }

    // -- AudienceWash : ramp 0 -> 4 entre t=3 et t=4.5
    if (t < 3.0) {
      for (const sl of this.audienceWash) sl.intensity = 0;
    } else {
      const k = clamp01((t - 3.0) / 1.5);
      const ease = k * k * (3 - 2 * k);
      for (let i = 0; i < this.audienceWash.length; i++) {
        // Cascade : chaque spot demarre avec un peu de delai
        const delay = i * 0.15;
        const ki = clamp01((t - 3.0 - delay) / 1.3);
        const ei = ki * ki * (3 - 2 * ki);
        this.audienceWash[i].intensity = ei * 4.0 + Math.sin(t * 4 + i) * 0.3 * ease;
      }
    }

    // -- StageLights : swing latere pendant l'annonce host (t=4.0 a 4.7)
    if (this.lightsBuild) {
      for (let i = 0; i < this.lightsBuild.spots.length; i++) {
        const sp = this.lightsBuild.spots[i];
        if (t >= 4.0 && t < 4.8) {
          const swing = Math.sin((t - 4.0) * 8 + i * 1.7) * 0.4;
          sp.light.intensity = sp.baseIntensity * (1 + swing);
        } else if (t >= 3.0) {
          sp.light.intensity = sp.baseIntensity;
        } else {
          // Avant le rideau : spots tamises
          sp.light.intensity = sp.baseIntensity * 0.25;
        }
      }
    }

    // -- AudienceSpots : cascade au moment des applaudissements (4.7 -> 5.5)
    if (t >= 4.7 && t < 5.6) {
      for (let i = 0; i < this.audienceSpots.length; i++) {
        const delay = i * 0.08;
        const ki = clamp01((t - 4.7 - delay) / 0.6);
        const ei = ki * ki * (3 - 2 * ki);
        this.audienceSpots[i].intensity = ei * 5.0 * (0.6 + Math.sin(t * 6 + i) * 0.4);
      }
    } else if (t < 4.7) {
      for (const sl of this.audienceSpots) sl.intensity = 0;
    }
  }

  // ============== Phase DUEL ==============

  private enterDuel(): void {
    this.phase = 'duel';
    this.phaseTime = 0;
    this.duelCueIndex = 0;
    this.duelCueTransitionAt = -Infinity;
    this.duelCueSuccess = false;
    this.deps.audio.setStudioDroneVolume(0.15);
    this.showDuelCue();
  }

  private showDuelCue(): void {
    if (!this.promptCard || this.duelCueIndex >= this.duelCues.length) return;
    const cue = this.duelCues[this.duelCueIndex];
    this.duelCueSuccess = false;
    this.duelCueStartTime = this.phaseTime;
    this.duelSilenceHoldMs = 0;
    const tone = cue.mode === 'scream' ? 'scream' : 'silence';
    this.promptCard.setText(cue.text, cue.subtitle, tone);
    this.promptCard.descend(1.7, 1.2);
    this.deps.audio.cuecardDescend();
    this.deps.audio.showCueDing();
    this.deps.hud.setVoiceCue(cue.mode, cue.threshold);
    this.deps.microphone.setCue(cue.mode, cue.threshold);
  }

  private updateDuel(dt: number, ctx: RoomUpdateContext, _micLevel: number): void {
    if (this.duelCueIndex >= this.duelCues.length) {
      // Toutes les cues passees, transition climax apres petit delai
      if (this.phaseTime - this.duelCueTransitionAt > 2.5) {
        this.enterClimax();
      }
      return;
    }
    const cue = this.duelCues[this.duelCueIndex];
    this.guest?.lookAt(new Vector3(ctx.playerPosition.x, ctx.playerPosition.y, ctx.playerPosition.z));

    // Anim "silence" : l'enfant penche vers le joueur, whispers aleatoires
    if (cue.mode === 'silence' && !this.duelCueSuccess) {
      if (this.deps.microphone.isCueMet(0)) {
        this.duelSilenceHoldMs += dt * 1000;
      } else {
        this.duelSilenceHoldMs = Math.max(0, this.duelSilenceHoldMs - dt * 1500);
      }
      const progress = clamp01(this.duelSilenceHoldMs / cue.holdMs);
      this.guest?.leanForward(progress);
      if (Math.random() < dt * 0.6) this.deps.audio.childWhisper();
      // Souffle distordu de M. Sourire pendant les silences (rare, immersif)
      if (Math.random() < dt * 0.18) this.deps.audio.hostBreath();
    }

    // Detection succes
    if (!this.duelCueSuccess && this.deps.microphone.isCueMet(cue.holdMs)) {
      this.duelCueSuccess = true;
      this.deps.hud.voiceCueSuccess();
      this.duelCueTransitionAt = this.phaseTime;
      this.onCueSuccess(this.duelCueIndex);
      setTimeout(() => {
        this.promptCard?.rise(4.5, 0.9);
      }, 600);
      this.deps.hud.setVoiceCue('idle', 0.4);
      this.deps.microphone.setCue('idle', 0.4);
      setTimeout(() => {
        this.duelCueIndex++;
        if (this.duelCueIndex < this.duelCues.length) {
          this.showDuelCue();
        } else {
          this.duelCueTransitionAt = this.phaseTime;
        }
      }, 2400);
    }

    if (!this.duelCueSuccess) {
      const elapsedOnCue = this.phaseTime - this.duelCueStartTime;
      if (cue.mode === 'scream' && elapsedOnCue > 22 && Math.floor(elapsedOnCue) % 7 === 0 && Math.floor(elapsedOnCue - dt) % 7 !== 0) {
        this.deps.audio.audienceGasp();
        this.deps.hud.setSubtitle('(L\'audience commence a s\'impatienter.)', 2.5);
      }
    }
  }

  private onCueSuccess(idx: number): void {
    if (!this.guest || !this.audienceBuild) return;
    const aud = this.audienceBuild;
    // Flash blanc + pression generique sur chaque succes
    this.deps.postFX.pulse(0.55, 0.35);
    switch (idx) {
      case 0:
        this.deps.audio.applauseSwell(0.55);
        audienceApplause(aud, 0.55, 1.6);
        setTimeout(() => {
          this.deps.audio.childGiggle();
          this.deps.hud.setSubtitle('L\'INVITE : Bonjour... mon ami...', 3.5);
          this.guest?.setEmotion(0.45);
        }, 700);
        break;
      case 1:
        this.guest.leanForward(0);
        this.deps.audio.applauseSwell(0.45);
        this.deps.hud.setSubtitle('M. SOURIRE (off) : Bien. Tres bien.', 2.8);
        this.deps.audio.hostUtterance(5, 0.8);
        this.guest.setGrotesque(0.25);
        this.guest.setEmotion(0.7);
        break;
      case 2:
        this.deps.audio.applauseSwell(0.85);
        this.deps.postFX.pulse(0.8, 0.4);
        audienceApplause(aud, 0.85, 1.8);
        this.guest.setGrotesque(0.55);
        this.guest.setEmotion(1.0);
        this.promptCard?.setGlitch(0.4);
        setTimeout(() => this.promptCard?.setGlitch(0), 600);
        // L'enfant commence a paraitre dangereux : petit cri etouffe
        setTimeout(() => this.deps.audio.childScream(), 900);
        break;
      case 3:
        this.deps.audio.applauseSwell(0.55);
        this.guest.leanForward(0);
        this.guest.setGrotesque(1.0);
        this.deps.hud.setSubtitle('M. SOURIRE (off) : Parfait. Il est temps.', 3.5);
        // Rire diabolique de M. Sourire avant le climax
        setTimeout(() => this.deps.audio.hostEvilLaugh(), 1400);
        break;
    }
  }

  // ============== Phase CLIMAX ==============

  private enterClimax(): void {
    this.phase = 'climax';
    this.phaseTime = 0;
    this.climaxRelaxedAt = -1;
    this.climaxTriggered = false;
    this.deps.audio.setStudioDroneVolume(0.35);
    // Crissement metallique d'horreur sur la bascule en climax
    this.deps.audio.metallicScreech();
    this.deps.postFX.pulse(0.6, 0.5);
    if (this.promptCard) {
      this.promptCard.setText('HURLE\nTON NOM', '(Aussi fort que tu peux.)', 'scream');
      this.promptCard.descend(1.7, 1.4);
    }
    this.deps.audio.cuecardDescend();
    this.deps.audio.showCueDing();
    this.deps.hud.setVoiceCue('scream', this.climaxThreshold);
    this.deps.microphone.setCue('scream', this.climaxThreshold);
    this.deps.hud.setSubtitle('M. SOURIRE : Donne-leur tout ce qui te reste.', 4.5);
    this.deps.audio.hostUtterance(7, 1.1);
    this.guest?.setGrotesque(1.1);
    this.guest?.setEmotion(1.0);
    // M. Sourire : passe en mode terrifie (yeux dilates) + cou qui s'allonge
    this.hostPuppet?.setEyeStage(2);
    this.hostPuppet?.setNeckStretch(0.4);
    this.hostPuppet?.speak(2.5);
    // Battements de coeur lents et rares pendant le climax
    this.climaxHeartbeatTimer = 0;
  }

  private updateClimax(dt: number, _ctx: RoomUpdateContext, micLevel: number): void {
    if (this.climaxTriggered) return;
    const t = this.phaseTime;

    // Battement de coeur lent toutes les ~2.2s pendant le climax
    this.climaxHeartbeatTimer += dt;
    if (this.climaxHeartbeatTimer >= 2.2) {
      this.climaxHeartbeatTimer = 0;
      this.deps.audio.heartbeatPulse();
    }

    if (micLevel >= 0.78) {
      this.guest?.setGrotesque(1.8);
      this.promptCard?.setGlitch(0.8);
      // Le guest hurle silencieusement avec le joueur (rare)
      if (Math.random() < dt * 0.4) this.deps.audio.childScream();
    } else if (micLevel >= 0.65) {
      this.guest?.setGrotesque(1.5);
      this.promptCard?.setGlitch(0.5);
    } else if (micLevel >= 0.50) {
      this.guest?.setGrotesque(1.2);
    }

    if (this.deps.microphone.isCueMet(1000)) {
      this.triggerScreamer();
      return;
    }

    if (t > 8 && t < 25 && this.climaxRelaxedAt < 0 && Math.floor(t) === 12 && Math.floor(t - dt) !== 12) {
      this.deps.hud.setSubtitle('M. SOURIRE (off) : Plus fort. PLUS FORT.', 3.0);
      this.deps.audio.hostUtterance(4, 1.2);
    }
    if (t > 25 && this.climaxRelaxedAt < 0) {
      this.climaxRelaxedAt = t;
      this.climaxThreshold = 0.65;
      this.deps.hud.setVoiceCue('scream', this.climaxThreshold);
      this.deps.microphone.setCue('scream', this.climaxThreshold);
      this.deps.hud.setSubtitle('M. SOURIRE (off) : Crie. CRIE !', 3.0);
    }
    if (Math.floor(t * 0.5) !== Math.floor((t - dt) * 0.5) && t > 4 && t < 30) {
      this.deps.audio.audienceGasp();
    }
  }

  private triggerScreamer(): void {
    if (this.climaxTriggered) return;
    this.climaxTriggered = true;
    this.deps.hud.voiceCueSuccess();
    this.deps.hud.setVoiceCue('idle', 0.4);
    this.deps.microphone.setCue('idle', 0.4);
    this.deps.audio.screamerImpact(1.4);
    this.deps.audio.climaxScream(1.2);
    this.deps.audio.hostEvilLaugh();
    this.deps.audio.stopStudioDrone();
    this.deps.audio.stopCrtBuzz();
    this.deps.postFX.pulse(1.0, 1.0);
    this.guest?.setGrotesque(2.0);
    this.promptCard?.setGlitch(0);
    this.promptCard?.rise(5.0, 0.4);
    // M. Sourire fait un lunge vers le joueur pile sur le screamer
    this.hostPuppet?.setNeckStretch(1.0);
    this.hostPuppet?.lunge(new Vector3(0, 1.55, -1.4), 0.4);
    // Freeze audience en hurlement silencieux pile sur le screamer
    if (this.audienceBuild) audienceFreezeScream(this.audienceBuild);
    // Affiche le screamer fullscreen
    const parent = this.deps.hud.root.parentElement ?? document.body;
    this.screamer = new FullscreenScreamer(parent);
    this.screamer.play(1200);
    setTimeout(() => {
      this.deps.hud.fadeTo(1, 0.6);
      this.deps.audio.switchAmbience('silent');
      this.deps.audio.powerCut();
    }, 1100);
    setTimeout(() => {
      this.phase = 'ending';
      this.phaseTime = 0;
      this.showEndChapter();
    }, 2600);
  }

  // ============== Choregraphie audience mic-reactive ==============

  private applyMicReactive(level: number, dt: number, time: number): void {
    this.smoothedReactiveLevel += (level - this.smoothedReactiveLevel) * Math.min(1, dt * 8);
    const lv = this.smoothedReactiveLevel;

    // PostFX : stress augmente avec la voix + base de pression en climax
    const basePressure = this.phase === 'climax' ? 0.25 : 0.10;
    this.deps.postFX.setStress(basePressure + lv * 0.40);

    // Spots de scene : palpitent en miroir du niveau
    if (this.lightsBuild) {
      const spots = this.lightsBuild.spots;
      for (let i = 0; i < spots.length; i++) {
        const s = spots[i];
        const baseFlicker = Math.sin(time * 7 + i * 1.7) * 0.04 + Math.sin(time * 19 + i * 0.9) * 0.02;
        const voicePulse = (lv - 0.20) * 0.6;
        const mod = 1 + baseFlicker + Math.max(-0.5, voicePulse);
        s.light.intensity = s.baseIntensity * Math.max(0.2, mod);
        const beamMat = s.beam.material as MeshBasicMaterial;
        beamMat.opacity = 0.10 * Math.max(0.3, mod);
      }
    }

    // AudienceWash : reagit au mic
    //  - silence (lv<0.10) : tamise dramatique (1.5)
    //  - parole : base 4.0
    //  - cri fort : ramp jusqu'a 7
    for (let i = 0; i < this.audienceWash.length; i++) {
      const sl = this.audienceWash[i];
      let target = 4.0;
      if (lv < 0.10) target = 1.5;
      else if (lv > 0.55) target = 4.0 + (lv - 0.55) * 7;
      // En climax : pulse fort
      if (this.phase === 'climax') target = 5.0 + lv * 3.5;
      const flick = Math.sin(time * 5 + i * 2.1) * 0.15;
      sl.intensity = sl.intensity + (target * (1 + flick) - sl.intensity) * Math.min(1, dt * 6);
    }

    // M. Sourire reagit : stress proportionnel au level, regarde le joueur
    if (this.hostPuppet) {
      this.hostPuppet.setStress(this.phase === 'climax' ? 0.85 + lv * 0.15 : 0.3 + lv * 0.5);
      // Suivre le joueur du regard (a chaque frame en duel/climax)
      this.playerObject.position.set(0, 1.55, -1.4);
      this.hostPuppet.lookAt(this.playerObject);
    }

    // Tete de l'enfant pulse
    this.guest?.headPulse(lv);

    // Bulbes : flicker plus marque quand on parle
    if (this.envBuild) {
      const bulbStress = clamp01(lv - 0.2) * 0.7;
      animateBorderBulbs(this.envBuild.bulbs, time, bulbStress);
    }

    // ===== Heartbeat visuel : pulse postFX pendant silence prolonge =====
    if (lv < 0.10 && this.phase === 'duel') {
      // toutes les ~1.2s un battement
      if (Math.floor(time * 0.8) !== Math.floor((time - dt) * 0.8)) {
        this.deps.postFX.pulse(0.3, 0.2);
      }
    }

    // ===== Camera shake en climax =====
    if (this.phase === 'climax') {
      this.shakePhase += dt * 25;
      this.shakeAmount = Math.min(0.06, 0.02 + lv * 0.06);
      const sx = Math.sin(this.shakePhase) * this.shakeAmount;
      const sy = Math.cos(this.shakePhase * 1.3) * this.shakeAmount;
      this.deps.setCinematicCamera(
        new Vector3(sx, 1.55 + sy, -1.4),
        0.95,
        sy * 0.3,
        Math.PI + sx * 0.4,
      );
    }

    // ===== Choregraphie audience =====
    if (this.audienceBuild) {
      const aud = this.audienceBuild;

      audienceMexicanWave(aud, time, lv);

      if (lv > 0.45) {
        audienceMouthChain(aud, dt, clamp01((lv - 0.45) * 2.2));
      }

      if (lv < 0.12) {
        audienceLeanForward(aud, 1.0 - lv / 0.12, dt);
      } else if (this.phase !== 'climax') {
        audienceLeanForward(aud, 0, dt);
      }

      if (this.phase === 'climax') {
        audienceHandsUp(aud, Math.max(0.4, lv), dt);
        audienceStand(aud, clamp01(0.3 + lv * 0.9), dt);
      } else if (lv > 0.55) {
        audienceHandsUp(aud, clamp01((lv - 0.55) * 2.5), dt);
      } else {
        audienceHandsUp(aud, 0, dt);
        audienceStand(aud, 0, dt);
      }

      // Spots individuels
      for (let i = 0; i < this.audienceSpots.length; i++) {
        const sl = this.audienceSpots[i];
        const phase = time * 2.0 + i * 1.3;
        const modulator = 0.5 + Math.sin(phase) * 0.5;
        const baseInt = this.phase === 'climax' ? 6 : Math.max(0, lv * 4);
        sl.intensity = baseInt * (0.4 + modulator * 0.6);
      }
    }
  }

  // ============== Update principal ==============

  override update(dt: number, ctx: RoomUpdateContext): void {
    this.phaseTime += dt;
    const time = ctx.time;

    // Animations toujours actives
    if (this.audienceBuild) animateAudience(this.audienceBuild, time, dt);
    if (this.crtBuild) animateCRTCamera(this.crtBuild, time);
    this.promptCard?.update(dt);
    this.guest?.update(dt);
    this.hostPuppet?.update(dt, time);

    // Voice meter live
    const micSnap = this.deps.microphone.update(dt * 1000);
    this.deps.hud.setVoiceLevel(micSnap.level);

    // Phase routing
    switch (this.phase) {
      case 'intro':
        this.updateIntro(dt, ctx);
        break;
      case 'duel':
        this.updateDuel(dt, ctx, micSnap.level);
        break;
      case 'climax':
        this.updateClimax(dt, ctx, micSnap.level);
        break;
      case 'ending':
        break;
    }

    // Mic reactive : actif APRES l'intro et avant l'ending
    if (this.phase === 'duel' || this.phase === 'climax') {
      this.applyMicReactive(micSnap.level, dt, time);
    } else if (this.phase === 'intro') {
      // Reset doux des modulations pendant l'intro pour pas mover les bouches
      this.smoothedReactiveLevel *= 0.9;
    }
  }

  getInteractables(): Interactable[] {
    return [];
  }

  // ============== Ending ==============

  private showEndChapter(): void {
    if (this.hasShownEndCard) return;
    this.hasShownEndCard = true;
    const parent = this.deps.hud.root.parentElement;
    if (parent) {
      this.endCard = new EndChapterCard(parent, 'ch3-to-ch4');
      setTimeout(() => this.endCard?.show(), 400);
    }
    // Enchaine automatiquement vers le Chapitre 4 — Le Public.
    // 7s laissent le temps de lire le titre + sous-titre + caption.
    setTimeout(() => {
      this.deps.requestRoomTransition((d) => new DressingRoom(d), 1200);
    }, 7000);
  }

  // ============== Dispose ==============

  dispose(): void {
    this.guest?.dispose();
    this.hostPuppet?.dispose();
    this.promptCard?.dispose();
    this.endCard?.dispose();
    this.screamer?.dispose();
    this.deps.audio.stopStudioDrone();
    this.deps.audio.stopCrtBuzz();
    this.group.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        const mat = o.material as MeshStandardMaterial | MeshStandardMaterial[];
        if (Array.isArray(mat)) {
          for (const m of mat) m.dispose();
        } else {
          mat.dispose();
        }
      }
    });
    this.deps.setCinematicCamera(null, 0);
    this.deps.postFX.setStress(0);
  }
}
