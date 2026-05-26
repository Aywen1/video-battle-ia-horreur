/**
 * Game : orchestre tout. Singleton de fait, instancié dans main.ts.
 * - Initialise renderer + audio + webcam (déjà calibrée)
 * - Construit la salle initiale (StudioStage) puis gère les transitions
 * - Boucle de rendu (60 fps), pilote SmileMeter, post-FX, audio
 * - Gère pause / pointer lock
 */
import { Clock, Vector3 } from 'three';
import { Renderer } from '../rendering/Renderer';
import { Player } from './Player';
import { InputManager } from './InputManager';
import { AudioEngine } from '../audio/AudioEngine';
import { SmileDetector } from '../webcam/SmileDetector';
import { SmileMeter } from '../webcam/SmileMeter';
import { HUD } from '../ui/HUD';
import { PauseMenu, TeleportTargetKey } from '../ui/PauseMenu';
import { StudioStage, StudioStageStart } from '../world/rooms/StudioStage';
import { BackstageRoom, BackstageStart } from '../world/rooms/BackstageRoom';
import { PlateauRoom, PlateauStart } from '../world/rooms/PlateauRoom';
import { DressingRoom, DressingStart } from '../world/rooms/DressingRoom';
import { AudienceFinalRoom, AudienceFinalStart } from '../world/rooms/AudienceFinalRoom';
import { Interactable, Room, RoomDeps } from '../world/Room';
import { MicrophoneInput } from '../audio/MicrophoneInput';

export class Game {
  private renderer: Renderer;
  private player = new Player();
  private input: InputManager;
  private audio = new AudioEngine();
  private microphone: MicrophoneInput;
  private detector: SmileDetector;
  private meter: SmileMeter;
  private hud: HUD;
  private pause: PauseMenu;
  private room: Room;
  private clock = new Clock();
  private running = true;
  private paused = false;
  private webcamVideo: HTMLVideoElement;
  private tmpVec = new Vector3();
  private hoverTarget: Interactable | null = null;
  private interactionStarted = false;
  private deps: RoomDeps;
  private transitioning = false;

  constructor(container: HTMLElement, detector: SmileDetector, webcamVideo: HTMLVideoElement, microphone: MicrophoneInput) {
    this.renderer = new Renderer(container);
    this.detector = detector;
    this.microphone = microphone;
    this.meter = new SmileMeter(detector);
    this.input = new InputManager(this.renderer.canvas);
    this.webcamVideo = webcamVideo;

    this.hud = new HUD(container);
    this.pause = new PauseMenu(
      container,
      () => this.resume(),
      (target) => this.teleportTo(target),
    );

    this.deps = {
      scene: this.renderer.scene,
      audio: this.audio,
      hud: this.hud,
      smileMeter: this.meter,
      smileDetector: this.detector,
      postFX: this.renderer.postFX,
      webcamVideo,
      microphone: this.microphone,
      setCinematicCamera: (offset, weight, pitch, yaw) => {
        if (offset === null) {
          this.player.clearCinematic();
          this.player.controlsEnabled = true;
        } else {
          this.player.setCinematicOffset(offset, weight);
          this.player.controlsEnabled = false;
          // Si pitch/yaw fournis : utiliser un lerp doux via setCinematicPitch/Yaw.
          // Sinon (undefined) : laisser le state actuel — au premier appel on snap
          // seulement la position et on relache l'orientation.
          if (pitch !== undefined) this.player.setCinematicPitch(pitch);
          else this.player.setCinematicPitch(null);
          if (yaw !== undefined) this.player.setCinematicYaw(yaw);
          else this.player.setCinematicYaw(null);
        }
      },
      requestRoomTransition: (factory, fadeMs = 800) => {
        this.transitionToRoom(factory, fadeMs);
      },
    };

    this.room = new StudioStage(this.deps);
    this.renderer.scene.add(this.room.group);

    // Spawn
    this.player.position.copy(this.room.spawnPosition);
    this.player.yaw = this.room.spawnYaw;
    this.player.pitch = this.room.spawnPitch;
    this.player.setColliders(this.room.colliders);

    // Listener pour activer audio (Tone.start) et pointer lock au premier clic
    this.renderer.canvas.addEventListener('click', this.onCanvasClick);
  }

  async start(): Promise<void> {
    // Audio doit être lancé après un geste utilisateur — il l'a déjà été
    // implicitement via le bouton du splash, donc on peut l'amorcer ici.
    await this.audio.start();
    this.room.onEnter();
    this.loop();
  }

  /**
   * Transition de salle avec fade noir : on noircit l'écran, on dispose la
   * salle courante, on instancie la nouvelle, puis on dé-fade.
   */
  private async transitionToRoom(
    factory: (deps: RoomDeps) => Room,
    fadeMs = 800,
  ): Promise<void> {
    if (this.transitioning) return;
    this.transitioning = true;
    const halfSec = fadeMs / 2000;
    await this.hud.fadeTo(1, halfSec);
    // Dispose + retire la salle courante
    this.renderer.scene.remove(this.room.group);
    this.room.dispose();
    // Instancie la nouvelle
    const next = factory(this.deps);
    this.room = next;
    this.renderer.scene.add(next.group);
    // Repositionne le joueur sur le spawn de la nouvelle salle
    this.player.position.copy(next.spawnPosition);
    this.player.yaw = next.spawnYaw;
    this.player.pitch = next.spawnPitch;
    this.player.velocity.set(0, 0, 0);
    this.player.setColliders(next.colliders);
    next.onEnter();
    await this.hud.fadeTo(0, halfSec);
    this.transitioning = false;
  }

  private onCanvasClick = (): void => {
    if (this.paused) return;
    if (!this.input.isLocked()) {
      this.input.requestLock();
      this.interactionStarted = true;
    }
  };

  /**
   * Téléporte le joueur vers une phase / salle précise depuis le menu Pause.
   * Reset complètement la salle pour repartir d'un état propre.
   */
  private teleportTo(target: TeleportTargetKey): void {
    if (this.transitioning) return;
    // Reset des FX caméra éventuels (cinématique en cours, etc.)
    this.player.clearCinematic();
    this.player.controlsEnabled = true;
    // Construit le factory adapté à la cible
    let factory: (deps: RoomDeps) => Room;
    if (target.startsWith('studio-')) {
      const startAt = target.replace('studio-', '') as StudioStageStart;
      factory = (deps) => new StudioStage(deps, { startAt });
    } else if (target.startsWith('plateau-')) {
      const startAt = target.replace('plateau-', '') as PlateauStart;
      factory = (deps) => new PlateauRoom(deps, { startAt });
    } else if (target.startsWith('dressing-')) {
      const startAt = target.replace('dressing-', '') as DressingStart;
      factory = (deps) => new DressingRoom(deps, { startAt });
    } else if (target.startsWith('audience-')) {
      const startAt = target.replace('audience-', '') as AudienceFinalStart;
      factory = (deps) => new AudienceFinalRoom(deps, { startAt });
    } else {
      const startAt = target.replace('backstage-', '') as BackstageStart;
      factory = (deps) => new BackstageRoom(deps, { startAt });
    }
    // Quitte la pause et lance la transition (le fade masque le reset)
    this.paused = false;
    this.pause.hide();
    this.transitionToRoom(factory, 600).then(() => {
      this.input.requestLock();
    });
  }

  private resume(): void {
    this.paused = false;
    this.pause.hide();
    this.input.requestLock();
  }

  private pauseGame(): void {
    this.paused = true;
    this.input.releaseLock();
    this.pause.show();
  }

  private loop = (): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.elapsedTime;

    const input = this.input.consume();
    if (input.pauseJustPressed) {
      if (!this.paused) this.pauseGame();
    }
    if (this.paused) {
      // En pause : on ne mette à jour ni player, ni audio dynamique
      this.renderer.render(dt);
      return;
    }

    // Player
    this.player.update(dt, input);

    // Synchronise la caméra
    this.player.getCameraPosition(this.tmpVec);
    this.renderer.camera.position.copy(this.tmpVec);
    this.renderer.camera.rotation.set(this.player.pitch, this.player.yaw, 0, 'YXZ');

    // SmileMeter
    const state = this.meter.update(dt);

    // HUD
    this.hud.setMeterVisible(this.meter.isActive());
    this.hud.setMeter(state.meter);
    this.hud.setFaceLost(state.faceLost);

    // Hover sur interactable
    this.updateHover();

    // Interact
    if (input.interactJustPressed && this.hoverTarget && this.hoverTarget.enabled) {
      this.hoverTarget.onInteract();
    }

    // Audio stress
    this.audio.setStress(state.stress);

    // Post-FX stress
    this.renderer.postFX.setStress(state.stress);

    // Room
    this.room.update(dt, {
      time,
      playerPosition: this.tmpVec,
      playerYaw: this.player.yaw,
      playerPitch: this.player.pitch,
      smileMeter: state,
    });

    // Render
    this.renderer.render(dt);
  };

  private updateHover(): void {
    const cam = this.tmpVec; // already player camera pos
    // Forward direction
    const dirX = -Math.sin(this.player.yaw) * Math.cos(this.player.pitch);
    const dirY = Math.sin(this.player.pitch);
    const dirZ = -Math.cos(this.player.yaw) * Math.cos(this.player.pitch);

    let best: Interactable | null = null;
    let bestDot = 0.85; // seuil de "regard direct"
    const inters = this.room.getInteractables();
    for (const it of inters) {
      if (!it.enabled) continue;
      const dx = it.position.x - cam.x;
      const dy = it.position.y - cam.y;
      const dz = it.position.z - cam.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 3.5) continue;
      if (dist < it.radius * 0.5) {
        // Très près, on prend
        best = it;
        break;
      }
      const inv = 1 / dist;
      const dot = dx * dirX * inv + dy * dirY * inv + dz * dirZ * inv;
      // Ajuste le seuil selon la distance (plus loin = plus précis requis)
      const required = 1 - it.radius / Math.max(0.3, dist);
      if (dot > required && dot > bestDot) {
        best = it;
        bestDot = dot;
      }
    }

    this.hoverTarget = best;
    this.hud.setHover(best ? best.label : null);
  }

  dispose(): void {
    this.running = false;
    this.renderer.canvas.removeEventListener('click', this.onCanvasClick);
    this.room.dispose();
    this.renderer.dispose();
    this.hud.dispose();
    this.pause.dispose();
    this.input.dispose();
    this.audio.dispose();
    this.detector.dispose();
  }
}
