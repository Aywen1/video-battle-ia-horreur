/**
 * AudienceFinalRoom — Chapitre 4, Phase 2 « Vue du public ».
 *
 * Le plateau du Ch3 est entierement reconstruit, mais le joueur spawn
 * **dans le public** : il est assis dans une chaise de la rangee 2.
 * Aucun controle — `controlsEnabled = false` via cinematic camera fixe.
 *
 * Une silhouette **N°45** (mannequin gris) entre par la droite et s'avance
 * vers le pupitre — exactement la position que le joueur occupait au Ch3.
 * M. Sourire (PuppetHost) accueille le nouveau candidat. L'audience
 * applaudit, des mains DOM (overlay HUD) applaudissent en bas d'ecran
 * (= "les mains du joueur" qui obeissent malgre lui).
 *
 * Final : la camera quitte la position du joueur, monte au-dessus, tourne,
 * et zoome sur **une marionnette N°44** placee a la position du spawn :
 * c'est le joueur, devenu spectateur. Son visage est fige avec un sourire.
 * Fade noir → EndChapterCard kind 'ch4-final'.
 */
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { Room, RoomDeps, RoomUpdateContext, Interactable } from '../Room';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { PALETTE } from '../../utils/palette';
import { clamp, damp } from '../../utils/math';
import { buildStageEnvironment } from '../props/StageEnvironment';
import { buildStageFloor } from '../props/StageFloor';
import { buildCurtain } from '../props/Curtain';
import { buildAudience, animateAudience, audienceApplause, audienceLookAt } from '../props/AudienceSeats';
import { buildHostDesk } from '../props/HostDesk';
import { buildStageLights, updateStageLights } from '../props/StageLights';
import { PuppetHost } from '../../entities/PuppetHost';
import { EndChapterCard } from '../../ui/EndChapterCard';

export type AudienceFinalStart = 'public' | 'credits';

const clamp01 = (x: number): number => clamp(x, 0, 1);

/** Index dans le tableau heads/bodies de la marionnette qui represente le joueur. */
const PLAYER_SEAT_INDEX = 13; // rangee 2, position centrale-droite

interface FinalScript {
  fadeInDone: boolean;
  hostEnterStarted: boolean;
  hostAnnounceDone: boolean;
  guestEntered: boolean;
  guestSeated: boolean;
  audienceLaughPlayed: boolean;
  cameraDetachStarted: boolean;
  playerSeatRevealed: boolean;
  finalScreechPlayed: boolean;
  cardShown: boolean;
}

export class AudienceFinalRoom extends Room {
  private deps: RoomDeps;
  private startAt: AudienceFinalStart;
  private phaseTime = 0;

  // Build refs
  private audienceBuild: ReturnType<typeof buildAudience> | null = null;
  private lightsBuild: ReturnType<typeof buildStageLights> | null = null;
  private envBuild: ReturnType<typeof buildStageEnvironment> | null = null;
  private hostPuppet: PuppetHost | null = null;
  private hostTargetDummy = new Object3D();
  private hemi: HemisphereLight | null = null;
  private ambient: AmbientLight | null = null;
  private audienceWash: SpotLight[] = [];

  // Le joueur en marionnette (visible apres detach camera)
  private playerSeatBadge: Mesh | null = null;
  private playerSeatPos = new Vector3(0, 2.05, 6.8); // calculée dans build()

  // Silhouette N°45 (mannequin gris)
  private guestSilhouette: Group | null = null;
  private guestStartPos = new Vector3(5, 0, -1.4);
  private guestTargetPos = new Vector3(0, 0, -1.4);

  // HUD : overlay mains qui applaudissent
  private handsOverlay: HTMLDivElement | null = null;
  private handLeft: HTMLDivElement | null = null;
  private handRight: HTMLDivElement | null = null;
  private handsActive = false;
  private handsClapPhase = 0;

  // Carte de fin
  private endCard: EndChapterCard | null = null;

  // Script state
  private script: FinalScript = {
    fadeInDone: false,
    hostEnterStarted: false,
    hostAnnounceDone: false,
    guestEntered: false,
    guestSeated: false,
    audienceLaughPlayed: false,
    cameraDetachStarted: false,
    playerSeatRevealed: false,
    finalScreechPlayed: false,
    cardShown: false,
  };

  constructor(deps: RoomDeps, opts: { startAt?: AudienceFinalStart } = {}) {
    super();
    this.deps = deps;
    this.startAt = opts.startAt ?? 'public';
    this.build();
    // Spawn = dans la chaise du public, regarde le plateau (-Z)
    // La position de PLAYER_SEAT_INDEX est calculée par buildAudience.
    // On va la lire après build() — ici on met une valeur par défaut.
    this.spawnPosition.copy(this.playerSeatPos);
    this.spawnYaw = 0; // regarde -Z (vers le plateau)
    this.spawnPitch = -0.05; // legerement vers le bas (on regarde la scene)
  }

  // ============== Build ==============

  private build(): void {
    // ===== Reutilisation Ch3 : environnement + sol + rideau bg =====
    const env = buildStageEnvironment();
    this.envBuild = env;
    this.group.add(env.group);
    // Ampoules a intensite normale
    if (env.bulbs.length > 0) {
      for (const b of env.bulbs) {
        const mat = b.material as MeshStandardMaterial;
        mat.emissiveIntensity = 2.5;
      }
    }

    const stageFloor = buildStageFloor(5);
    this.group.add(stageFloor.group);

    const bgCurtain = buildCurtain(14, 5);
    bgCurtain.position.set(0, 0, -4.5);
    this.group.add(bgCurtain);

    // Audience (le joueur est dans le public)
    const audience = buildAudience();
    this.audienceBuild = audience;
    this.group.add(audience.group);

    // Recupere la position exacte du seat joueur (calcule par buildAudience)
    if (audience.headWorldPos[PLAYER_SEAT_INDEX]) {
      const seatPos = audience.headWorldPos[PLAYER_SEAT_INDEX];
      this.playerSeatPos.copy(seatPos);
      this.spawnPosition.copy(seatPos);
    }

    // Cache la marionnette qui represente le joueur (on revele plus tard)
    if (audience.heads[PLAYER_SEAT_INDEX]) audience.heads[PLAYER_SEAT_INDEX].visible = false;
    if (audience.bodies[PLAYER_SEAT_INDEX]) audience.bodies[PLAYER_SEAT_INDEX].visible = false;
    // Cache aussi les bras
    const armL = audience.armsLeft[PLAYER_SEAT_INDEX];
    const armR = audience.armsRight[PLAYER_SEAT_INDEX];
    if (armL) {
      const pivot = armL.userData.pivot as Group | undefined;
      if (pivot) pivot.visible = false;
    }
    if (armR) {
      const pivot = armR.userData.pivot as Group | undefined;
      if (pivot) pivot.visible = false;
    }

    // Ajoute un badge "N°44" sur le corps du seat joueur (en plus, qui sera revele a la fin)
    this.playerSeatBadge = this.buildBadge('N°44');
    const bodyPos = audience.bodies[PLAYER_SEAT_INDEX]?.position;
    if (bodyPos) {
      this.playerSeatBadge.position.set(bodyPos.x, bodyPos.y + 0.05, bodyPos.z - 0.32);
    }
    this.playerSeatBadge.rotation.y = Math.PI; // visible depuis le plateau
    this.playerSeatBadge.visible = false; // revele a t=20
    this.group.add(this.playerSeatBadge);

    // Bureau du presentateur
    const desk = buildHostDesk();
    desk.position.set(0, 0, -0.4);
    desk.rotation.y = Math.PI;
    this.group.add(desk);

    // Spotlights de scene
    this.hostTargetDummy.position.set(0, 1.3, 0.5);
    this.group.add(this.hostTargetDummy);
    const lights = buildStageLights(this.hostTargetDummy);
    this.lightsBuild = lights;
    this.group.add(lights.group);
    for (const s of lights.spots) s.light.intensity = s.baseIntensity;

    // Audience wash
    this.buildAudienceWash();

    // M. Sourire (entre par la gauche au debut)
    this.hostPuppet = new PuppetHost();
    this.hostPuppet.setPosition(-3.5, 0.55, 1.0, Math.PI);
    this.hostPuppet.setVisible(true);
    this.hostPuppet.awaken();
    this.group.add(this.hostPuppet.group);

    // Silhouette N°45 (mannequin gris uni)
    this.guestSilhouette = this.buildSilhouette();
    this.guestSilhouette.position.copy(this.guestStartPos);
    this.guestSilhouette.visible = false; // apparait a t=10
    this.group.add(this.guestSilhouette);

    // Ambient + hemi
    this.hemi = new HemisphereLight(new Color('#7a4858'), new Color('#1a0a18'), 0.95);
    this.group.add(this.hemi);
    this.ambient = new AmbientLight(new Color('#4a3040'), 0.70);
    this.group.add(this.ambient);

    // Colliders : on bloque tout (le joueur ne doit pas pouvoir bouger)
    // (de toute façon controlsEnabled=false via cinematic, mais ceinture+bretelles)
    this.colliders = [
      new Box3(new Vector3(-12, 0, -5.0), new Vector3(12, 6, -4.8)),
      new Box3(new Vector3(-12, 0, 9.0), new Vector3(12, 6, 9.2)),
      new Box3(new Vector3(8, 0, -5), new Vector3(8.2, 6, 9)),
      new Box3(new Vector3(-8.2, 0, -5), new Vector3(-8, 6, 9)),
    ];
  }

  private buildAudienceWash(): void {
    const config: Array<{ x: number; z: number; tx: number; tz: number; color: string }> = [
      { x: -3.5, z: 6.0, tx: -3.5, tz: 6.8, color: '#fff6e0' },
      { x:  0.0, z: 6.0, tx:  0.0, tz: 6.8, color: '#ffe8d0' },
      { x:  3.5, z: 6.0, tx:  3.5, tz: 6.8, color: '#fff6e0' },
    ];
    for (const c of config) {
      const sl = new SpotLight(new Color(c.color), 4, 22, Math.PI / 3, 0.7, 1.2);
      sl.position.set(c.x, 7.5, c.z);
      const target = new Object3D();
      target.position.set(c.tx, 1.8, c.tz);
      this.group.add(target);
      sl.target = target;
      this.group.add(sl);
      this.audienceWash.push(sl);
    }
  }

  /**
   * Mannequin gris uni : cylindre corps + sphere tete + cylindre bras.
   * Aucun visage, aucun detail — silhouette anonyme pour evoquer "le prochain".
   */
  private buildSilhouette(): Group {
    const g = new Group();
    const grey = '#5a5a60';
    const body = new Mesh(
      new CylinderGeometry(0.3, 0.4, 1.2, 10),
      flatToon({ color: grey, roughness: 1.0 }),
    );
    body.position.y = 0.9;
    g.add(body);

    const head = new Mesh(
      new SphereGeometry(0.32, 14, 10),
      flatToon({ color: grey, roughness: 1.0 }),
    );
    head.position.y = 1.65;
    g.add(head);

    // Bras simplifies
    for (const sign of [-1, 1]) {
      const arm = new Mesh(
        new BoxGeometry(0.14, 0.7, 0.14),
        flatToon({ color: grey, roughness: 1.0 }),
      );
      arm.position.set(sign * 0.36, 1.1, 0);
      g.add(arm);
    }

    // Petit numero "N°45" frontal
    const badge = this.buildBadge('N°45');
    badge.position.set(0, 1.0, 0.32);
    g.add(badge);
    return g;
  }

  /** Petit plane avec une etiquette texturee de numero. */
  private buildBadge(text: string): Mesh {
    const c = document.createElement('canvas');
    c.width = 192;
    c.height = 96;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = PALETTE.cream;
    ctx.fillRect(0, 0, 192, 96);
    ctx.strokeStyle = PALETTE.red;
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, 186, 90);
    ctx.fillStyle = PALETTE.red;
    ctx.font = 'bold 52px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 96, 50);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    const m = new Mesh(
      new PlaneGeometry(0.20, 0.10),
      new MeshBasicMaterial({ map: tex, transparent: false }),
    );
    return m;
  }

  // ============== Hands overlay (DOM) ==============

  private buildHandsOverlay(): void {
    const parent = this.deps.hud.root.parentElement;
    if (!parent) return;
    this.handsOverlay = document.createElement('div');
    this.handsOverlay.style.cssText = `
      position: fixed;
      left: 0; right: 0; bottom: 0;
      height: 26vh;
      pointer-events: none;
      z-index: 9;
      display: flex;
      justify-content: center;
      align-items: flex-end;
      gap: 0px;
      opacity: 0;
      transition: opacity 1.0s ease;
    `;
    // Mains stylisees (sprites canvas crees a la volee)
    this.handLeft = document.createElement('div');
    this.handRight = document.createElement('div');
    const handDataUrl = this.buildHandDataUrl();
    const baseStyle = `
      width: 30vh;
      height: 26vh;
      background: url('${handDataUrl}') no-repeat center bottom;
      background-size: contain;
      filter: drop-shadow(0 -12px 14px rgba(0,0,0,0.7));
      transform-origin: bottom center;
      transition: transform 0.07s ease-out;
    `;
    this.handLeft.style.cssText = baseStyle + 'transform: translateX(0vw) rotate(-8deg);';
    this.handRight.style.cssText = baseStyle + 'transform: translateX(0vw) rotate(8deg) scaleX(-1);';
    this.handsOverlay.appendChild(this.handLeft);
    this.handsOverlay.appendChild(this.handRight);
    parent.appendChild(this.handsOverlay);
  }

  private buildHandDataUrl(): string {
    // Canvas low-poly d'une main : palme + 4 doigts. Couleur palette cream.
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 220;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#d6b58a';
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = 3;
    // Palme (carre arrondi)
    ctx.beginPath();
    ctx.moveTo(50, 220);
    ctx.lineTo(50, 110);
    ctx.quadraticCurveTo(50, 90, 70, 88);
    ctx.lineTo(186, 88);
    ctx.quadraticCurveTo(206, 90, 206, 110);
    ctx.lineTo(206, 220);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Doigts (4 colonnes)
    const fingerWidths = [25, 28, 26, 22];
    const fingerHeights = [60, 76, 70, 52];
    const fingerXs = [62, 100, 138, 174];
    for (let i = 0; i < 4; i++) {
      const fx = fingerXs[i];
      const fw = fingerWidths[i];
      const fh = fingerHeights[i];
      ctx.beginPath();
      ctx.moveTo(fx, 88);
      ctx.lineTo(fx, 88 - fh);
      ctx.quadraticCurveTo(fx + fw / 2, 88 - fh - 10, fx + fw, 88 - fh);
      ctx.lineTo(fx + fw, 88);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Pouce (petit bossage a gauche)
    ctx.beginPath();
    ctx.moveTo(50, 150);
    ctx.quadraticCurveTo(20, 140, 18, 175);
    ctx.quadraticCurveTo(20, 198, 50, 195);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return c.toDataURL('image/png');
  }

  private updateHands(dt: number, _clapping: boolean): void {
    if (!this.handsActive) return;
    this.handsClapPhase += dt * 8.0; // ~4Hz clapping
    const t = Math.abs(Math.sin(this.handsClapPhase));
    // Position : se rapprochent au centre quand t→1
    const apart = (1 - t) * 12; // vw
    if (this.handLeft && this.handRight) {
      this.handLeft.style.transform = `translateX(${apart}vw) rotate(-8deg) translateY(${(1 - t) * 4}vh)`;
      this.handRight.style.transform = `translateX(${-apart}vw) rotate(8deg) scaleX(-1) translateY(${(1 - t) * 4}vh)`;
    }
  }

  // ============== Lifecycle ==============

  override onEnter(): void {
    this.deps.hud.setAmbientMode('final');
    this.deps.audio.switchAmbience('studio');
    this.deps.smileMeter.setActive(false);
    this.deps.hud.setVoiceCue('idle', 0.4);
    this.deps.microphone.setCue('idle', 0.4);
    this.deps.audio.startStudioDrone(0.20);

    // Cinematic camera : assis dans la chaise, regarde le plateau
    this.deps.setCinematicCamera(
      this.playerSeatPos.clone(),
      0.95,
      this.spawnPitch,
      this.spawnYaw,
    );

    // Cree l'overlay mains
    this.buildHandsOverlay();

    // Affichage progressif des mains
    setTimeout(() => {
      if (this.handsOverlay) {
        this.handsOverlay.style.opacity = '1';
        this.handsActive = true;
      }
    }, 2000);

    if (this.startAt === 'credits') {
      // Saute directement a la carte finale
      this.phaseTime = 30;
      this.script.fadeInDone = true;
      this.script.hostEnterStarted = true;
      this.script.hostAnnounceDone = true;
      this.script.guestEntered = true;
      this.script.guestSeated = true;
      this.script.cameraDetachStarted = true;
      this.script.playerSeatRevealed = true;
      this.script.finalScreechPlayed = true;
      this.revealPlayerSeat();
    }
  }

  // ============== Update ==============

  update(dt: number, _ctx: RoomUpdateContext): void {
    this.phaseTime += dt;
    const t = this.phaseTime;
    const s = this.script;

    // Anim audience continue
    if (this.audienceBuild) {
      animateAudience(this.audienceBuild, t, dt);
    }
    if (this.lightsBuild) {
      updateStageLights(this.lightsBuild.spots, 0.3, t, dt);
    }
    this.hostPuppet?.update(dt, t);

    // ===== Phase 0..3 : fade in =====
    if (t >= 0.5 && !s.fadeInDone) {
      s.fadeInDone = true;
      this.deps.hud.setSubtitle('(Tu es... ailleurs. Assis.)', 3.0);
    }

    // ===== Phase 3..6 : M. Sourire entre depuis la gauche =====
    if (t >= 3.0 && !s.hostEnterStarted) {
      s.hostEnterStarted = true;
      this.deps.audio.tvIntroJingle();
    }
    if (this.hostPuppet && t >= 3.0 && t < 6.0) {
      const k = clamp01((t - 3.0) / 3.0);
      const ease = k * k * (3 - 2 * k);
      const x = -3.5 + ease * 3.5; // -3.5 → 0
      const z = 1.0 + ease * 1.5;  // 1.0 → 2.5 (position homePos)
      this.hostPuppet.setPosition(x, 0.55, z, Math.PI);
    }

    // ===== Phase 6..10 : annonce N°45 + applause =====
    if (t >= 6.0 && !s.hostAnnounceDone) {
      s.hostAnnounceDone = true;
      this.hostPuppet?.speak(3.0);
      this.deps.hud.setSubtitle('M. SOURIRE : Mesdames et messieurs, accueillons... N°45 !', 4.0);
      this.deps.audio.applauseSwell(1.5);
      if (this.audienceBuild) {
        audienceApplause(this.audienceBuild, 1.0, 4.0);
      }
      this.deps.postFX.pulse(0.55, 0.4);
      // Spots cascade : on simule en allumant max
      for (let i = 0; i < this.audienceWash.length; i++) {
        const sl = this.audienceWash[i];
        sl.intensity = 5.5;
      }
    }

    // ===== Phase 10..15 : silhouette N°45 entre =====
    if (t >= 10.0 && !s.guestEntered) {
      s.guestEntered = true;
      if (this.guestSilhouette) this.guestSilhouette.visible = true;
      this.deps.audio.hostBreath();
    }
    if (this.guestSilhouette && t >= 10.0 && t < 15.0) {
      const k = clamp01((t - 10.0) / 5.0);
      const ease = k * k * (3 - 2 * k);
      const pos = this.guestStartPos.clone().lerp(this.guestTargetPos, ease);
      this.guestSilhouette.position.copy(pos);
      // Leger sway de marche
      this.guestSilhouette.rotation.y = Math.sin(t * 6) * 0.05;
    }

    // ===== Phase 15..20 : N°45 s'est assis, M. Sourire ricane =====
    if (t >= 15.0 && !s.guestSeated) {
      s.guestSeated = true;
      if (this.guestSilhouette) {
        this.guestSilhouette.position.copy(this.guestTargetPos);
        this.guestSilhouette.rotation.y = 0;
      }
      this.deps.audio.hostEvilLaugh();
      this.deps.hud.setSubtitle('M. SOURIRE : Et n\'oublions pas... nos anciens invites.', 4.0);
    }

    if (t >= 17.0 && !s.audienceLaughPlayed) {
      s.audienceLaughPlayed = true;
      this.deps.audio.laugh(0.2);
      // Audience tourne la tete vers le joueur (= vers la marionnette N°44)
    }
    if (this.audienceBuild && t >= 17.0 && t < 21.0) {
      // Toute l'audience regarde la position du joueur
      audienceLookAt(this.audienceBuild, this.playerSeatPos, 0.8, dt);
    }

    // ===== Phase 20..24 : la camera se detache de la position joueur =====
    if (t >= 20.0 && !s.cameraDetachStarted) {
      s.cameraDetachStarted = true;
      this.deps.hud.setSubtitle('M. SOURIRE : Saluez-le. Il a ete... magnifique.', 4.5);
      this.deps.audio.metallicScreech();
      // Revele la marionnette N°44 a la position du joueur
      this.revealPlayerSeat();
      // Stoppe les mains qui applaudissent
      this.handsActive = false;
      if (this.handsOverlay) this.handsOverlay.style.opacity = '0';
      // Heartbeat lent en fond
      this.deps.audio.heartbeatPulse();
    }

    // ===== Phase 20..28 : camera move final =====
    if (t >= 20.0 && t < 28.0) {
      this.updateFinalCinematic(t);
    }

    // Heartbeat repetes pendant le zoom final
    if (t >= 22.0 && t < 28.0) {
      const beatPhase = (t - 22.0) / 1.5;
      if (Math.floor(beatPhase) !== Math.floor(beatPhase - dt / 1.5)) {
        this.deps.audio.heartbeatPulse();
      }
    }

    // ===== Phase 28..29 : screech + fade noir =====
    if (t >= 28.0 && !s.finalScreechPlayed) {
      s.finalScreechPlayed = true;
      this.deps.audio.metallicScreech();
      this.deps.audio.powerCut();
      this.deps.audio.stopStudioDrone();
      this.deps.audio.stopCrtBuzz();
      this.deps.postFX.pulse(1.0, 1.0);
      // Fade HUD vers noir
      this.deps.hud.fadeTo(1, 1.2);
    }

    // ===== Phase 30 : EndChapterCard =====
    if (t >= 30.0 && !s.cardShown) {
      s.cardShown = true;
      const parent = this.deps.hud.root.parentElement;
      if (parent) {
        this.endCard = new EndChapterCard(parent, 'ch4-final');
        setTimeout(() => this.endCard?.show(), 400);
      }
    }

    // ===== HUD : mains qui applaudissent (entre t=6 et t=20) =====
    if (t >= 6.0 && t < 20.0) {
      this.updateHands(dt, true);
    }
  }

  /**
   * Mouvement cinematique final : la camera quitte la position du joueur,
   * monte au-dessus du public, recule, puis revient se planter face a la
   * marionnette N°44 (avec un zoom progressif sur son visage).
   *
   * t=20..22 : la camera commence a lever (yaw devient libre, pitch monte)
   * t=22..25 : recul + montee
   * t=25..28 : descente + zoom sur la marionnette N°44
   */
  private updateFinalCinematic(t: number): void {
    const seat = this.playerSeatPos;
    if (t < 22.0) {
      // Phase A : la camera quitte la pose subjective. On la fait reculer
      // legerement et tourner pour montrer "je vois ma propre main"
      const k = clamp01((t - 20.0) / 2.0);
      const ease = k * k * (3 - 2 * k);
      const px = seat.x;
      const py = seat.y + ease * 0.2;
      const pz = seat.z + ease * 0.4; // recule un peu (vers le fond)
      const pitch = -0.05 + ease * 0.15; // legerement vers le bas
      const yaw = ease * 0.3; // commence a tourner a gauche
      this.deps.setCinematicCamera(new Vector3(px, py, pz), 0.95, pitch, yaw);
    } else if (t < 25.0) {
      // Phase B : monte et recule pour avoir une vue 3eme personne du public
      const k = clamp01((t - 22.0) / 3.0);
      const ease = k * k * (3 - 2 * k);
      const px = seat.x + ease * 1.2;
      const py = seat.y + 0.2 + ease * 1.8;
      const pz = seat.z + 0.4 + ease * 2.0; // recule vers +Z (derriere le public)
      const pitch = 0.10 + ease * (-0.45); // regarde nettement vers le bas
      const yaw = 0.3 + ease * 2.5; // tourne pour revenir face au seat
      this.deps.setCinematicCamera(new Vector3(px, py, pz), 0.95, pitch, yaw);
    } else {
      // Phase C : on est derriere le public, on se rapproche du seat joueur
      // face a son visage. Zoom progressif.
      const k = clamp01((t - 25.0) / 3.0);
      const ease = k * k * (3 - 2 * k);
      // Position cible : derriere le seat, legerement au-dessus, face au visage
      const targetPosBehind = new Vector3(
        seat.x + 1.2,
        seat.y + 2.0,
        seat.z + 2.4,
      );
      const targetPosFinal = new Vector3(
        seat.x + 0.0,
        seat.y + 0.15,
        seat.z + 0.8,
      );
      const camPos = targetPosBehind.clone().lerp(targetPosFinal, ease);
      // Pitch : regarde le visage (legerement vers le bas)
      const pitch = -0.35 + ease * 0.30; // -0.35 → -0.05
      // Yaw : doit pointer vers la marionnette. Position relative
      const dx = seat.x - camPos.x;
      const dz = seat.z - camPos.z;
      const desiredYaw = Math.atan2(dx, -dz); // yaw=0 regarde -Z
      this.deps.setCinematicCamera(camPos, 0.95, pitch, desiredYaw);

      // La marionnette N°44 tourne la tete vers la camera quand on s'approche
      if (this.audienceBuild) {
        const head = this.audienceBuild.heads[PLAYER_SEAT_INDEX];
        if (head && head.visible) {
          const dxh = camPos.x - seat.x;
          const dzh = camPos.z - seat.z;
          const yawToCam = Math.atan2(dxh, dzh);
          head.rotation.y = damp(head.rotation.y, yawToCam, 4, 0.016);
        }
      }
    }
  }

  /**
   * Revele la marionnette N°44 a la position du joueur. Avec un visage fige
   * qui sourit (genere par buildAudience), un badge N°44 visible sur le corps.
   */
  private revealPlayerSeat(): void {
    if (!this.audienceBuild) return;
    const head = this.audienceBuild.heads[PLAYER_SEAT_INDEX];
    const body = this.audienceBuild.bodies[PLAYER_SEAT_INDEX];
    if (head) head.visible = true;
    if (body) body.visible = true;
    const armL = this.audienceBuild.armsLeft[PLAYER_SEAT_INDEX];
    const armR = this.audienceBuild.armsRight[PLAYER_SEAT_INDEX];
    if (armL) {
      const pivot = armL.userData.pivot as Group | undefined;
      if (pivot) pivot.visible = true;
    }
    if (armR) {
      const pivot = armR.userData.pivot as Group | undefined;
      if (pivot) pivot.visible = true;
    }
    if (this.playerSeatBadge) this.playerSeatBadge.visible = true;
    this.script.playerSeatRevealed = true;
    // Flash de revelation
    this.deps.postFX.pulse(0.65, 0.5);
  }

  getInteractables(): Interactable[] {
    return [];
  }

  // ============== Dispose ==============

  dispose(): void {
    this.deps.audio.stopStudioDrone();
    this.deps.audio.stopCrtBuzz();
    this.deps.setCinematicCamera(null, 0);
    this.deps.postFX.setStress(0);
    this.endCard?.dispose();
    this.hostPuppet?.dispose();
    if (this.handsOverlay) {
      this.handsOverlay.remove();
      this.handsOverlay = null;
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
