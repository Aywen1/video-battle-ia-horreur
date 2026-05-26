import * as THREE from 'three';
import { InputManager } from './InputManager';
import { Player } from './Player';
import { LevelManager } from './LevelManager';
import { AudioManager } from '../audio/AudioManager';
import { CABIN_W } from '../world/ObservationRoom';
import { PostProcessing } from '../rendering/PostProcessing';
import { ParticleManager } from '../rendering/ParticleManager';
import { LightingDirector } from '../rendering/LightingDirector';
import { TransitionManager } from '../rendering/TransitionManager';
import { ScreamerOverlay, ScreamerType } from './horror/ScreamerOverlay';
import { findNearestInteractable } from '../entities/Interactable';
import { MissionPanel } from '../ui/MissionPanel';

const MISSION_INTRO =
  'Vous êtes le technicien de garde au relais 7. La route est coupée par la tempête. ' +
  'Allez d\'abord à la console centrale et vérifiez que la balise émet correctement, ' +
  'puis examinez le casque et le badge sur l\'étagère du mur gauche. ' +
  'La porte du palier restera fermée tant que ces deux contrôles ne sont pas faits.';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private input: InputManager;
  private player: Player;
  private audio: AudioManager;
  private post: PostProcessing;
  private particles: ParticleManager;
  private lighting: LightingDirector;
  private windowDay!: THREE.DirectionalLight;
  private mission: MissionPanel;
  private level: LevelManager;
  private transition: TransitionManager;
  private screamer: ScreamerOverlay;

  private running = false;
  private paused = false;
  private inputLocked = false;
  private clock = new THREE.Clock();
  private crtStareTime = 0;
  private gameTime = 0;

  private ui = {
    hud: document.getElementById('hud')!,
    start: document.getElementById('start-screen')!,
    pause: document.getElementById('pause-menu')!,
    hint: document.getElementById('interaction-hint')!,
    battery: document.getElementById('battery-fill')!,
    crtWarning: document.getElementById('crt-warning')!,
    flash: document.getElementById('vignette-flash')!,
    radioHud: document.getElementById('radio-tuner')!,
    sensitivity: document.getElementById('sensitivity') as HTMLInputElement,
    btnSkipExterior: document.getElementById('btn-skip-exterior')!,
    btnSkipUndercore: document.getElementById('btn-skip-undercore')!,
    endScreen: document.getElementById('end-screen')!,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.85;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x4a5a72);

    this.input = new InputManager();
    this.mission = new MissionPanel();
    this.mission.setMission(MISSION_INTRO);

    this.particles = new ParticleManager(this.scene);
    this.lighting = new LightingDirector();
    this.transition = new TransitionManager();
    this.screamer = new ScreamerOverlay();

    this.level = new LevelManager(
      this.scene,
      this.audio = new AudioManager(),
      this.input,
      this.mission,
      () => {
        this.ui.flash.classList.add('active');
        this.post.setHorrorPulse();
        setTimeout(() => this.ui.flash.classList.remove('active'), 200);
      },
      (show) => this.ui.crtWarning.classList.toggle('hidden', !show),
      (type) => this.triggerFullscreenScreamer(type),
      () => void this.handleEmergencyExit()
    );

    const amb = new THREE.AmbientLight(0xe8eef8, 0.78);
    this.scene.add(amb);
    const hemi = new THREE.HemisphereLight(0xc8dff8, 0x6a7588, 1.2);
    this.scene.add(hemi);
    this.windowDay = new THREE.DirectionalLight(0xfff0e0, 1.9);
    this.windowDay.position.set(2, 14, -18);
    this.windowDay.target.position.set(4, 0, 0);
    this.windowDay.castShadow = true;
    this.windowDay.shadow.mapSize.set(2048, 2048);
    this.windowDay.shadow.camera.near = 0.5;
    this.windowDay.shadow.camera.far = 80;
    this.windowDay.shadow.camera.left = -20;
    this.windowDay.shadow.camera.right = 40;
    this.windowDay.shadow.camera.top = 20;
    this.windowDay.shadow.camera.bottom = -20;
    this.scene.add(this.windowDay);
    this.scene.add(this.windowDay.target);

    const hallLight = new THREE.PointLight(0xffeed8, 1.0, 22);
    hallLight.position.set(10, 2.5, 0);
    this.scene.add(hallLight);

    const aspect = window.innerWidth / window.innerHeight;
    this.player = new Player(this.input, aspect);
    this.scene.add(this.player.camera);

    this.post = new PostProcessing(this.renderer, this.scene, this.player.camera);
    this.level.setPostProcessing(this.post);
    this.level.setUndercoreEntryHandler(async () => {
      this.inputLocked = true;
      await this.transition.runTransition(() => {
        this.level.enterUndercoreWorld(this.player);
      }, 1200);
      this.inputLocked = false;
    });
    this.level.setGameEndHandler(() => this.handleGameEnd());
    this.level.bindVisualSystems(this.particles, this.lighting, this.windowDay);
    this.bindUI();
    window.addEventListener('resize', () => this.onResize());
  }

  private bindUI(): void {
    document.getElementById('btn-start')!.addEventListener('click', () => this.start());
    document.getElementById('btn-resume')!.addEventListener('click', () => this.resume());
    this.ui.btnSkipExterior.addEventListener('click', () => void this.skipToExterior());
    this.ui.btnSkipUndercore.addEventListener('click', () => void this.skipToUndercore());
    this.ui.sensitivity.addEventListener('input', () => {
      this.input.sensitivity = parseFloat(this.ui.sensitivity.value);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.running) {
        if (this.paused) this.resume();
        else this.pause();
      }
    });
  }

  private async start(): Promise<void> {
    this.ui.start.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    await this.audio.start();
    document.body.requestPointerLock();
    this.running = true;
    this.clock.start();
    this.loop();
  }

  private pause(): void {
    this.paused = true;
    this.ui.pause.classList.remove('hidden');
    this.ui.btnSkipExterior.classList.toggle(
      'hidden',
      this.level.world.isExteriorPhase() || this.level.world.isUndercorePhase()
    );
    this.ui.btnSkipUndercore.classList.toggle(
      'hidden',
      this.level.world.isUndercorePhase() || this.level.world.gameEnded
    );
    document.exitPointerLock();
  }

  private resume(): void {
    this.paused = false;
    this.ui.pause.classList.add('hidden');
    document.body.requestPointerLock();
  }

  private async skipToExterior(): Promise<void> {
    if (this.level.world.isExteriorPhase() || this.inputLocked) return;
    this.inputLocked = true;
    await this.transition.runTransition(() => {
      this.level.skipToExteriorWorld(this.player);
    });
    this.inputLocked = false;
    this.resume();
  }

  private async skipToUndercore(): Promise<void> {
    if (this.level.world.isUndercorePhase() || this.inputLocked) return;
    this.inputLocked = true;
    await this.transition.runTransition(() => {
      this.level.skipToUndercoreWorld(this.player);
    });
    this.inputLocked = false;
    this.resume();
  }

  private handleGameEnd(): void {
    this.ui.hud.classList.add('hidden');
    this.ui.endScreen.classList.remove('hidden');
    document.exitPointerLock();
    this.running = false;
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.player.camera.aspect = w / h;
    this.player.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.post.setSize(w, h);
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (!this.running) return;
    this.gameTime += dt;
    this.level.world.gameElapsed = this.gameTime;
    this.mission.update(dt);
    this.update(dt);
    this.post.update(dt);
    this.post.render();
  };

  private async triggerFullscreenScreamer(type: ScreamerType): Promise<void> {
    if (this.screamer.isActive) return;
    this.inputLocked = true;
    this.post.setHorrorPulse();
    await this.screamer.show(type);
    this.inputLocked = false;
  }

  private async handleEmergencyExit(): Promise<void> {
    if (!this.level.world.canAccessEmergencyExit() || this.inputLocked) return;
    this.inputLocked = true;
    await this.transition.runTransition(() => {
      this.level.enterExteriorWorld(this.player);
    });
    this.inputLocked = false;
  }

  private update(dt: number): void {
    let depenetrate = false;
    const movementBlocked =
      this.paused ||
      this.inputLocked ||
      this.screamer.isActive ||
      this.level.world.gameEnded;
    if (!movementBlocked) {
      depenetrate = this.level.preparePhysicsUpdate(this.player);
      depenetrate = this.processInteract() || depenetrate;
    }

    this.player.update(
      dt,
      this.level.activeWalls,
      this.level.floorZones,
      this.level.playBounds,
      movementBlocked,
      depenetrate
    );
    if (movementBlocked) return;

    this.level.updateDoors(dt);
    this.level.anim.update(dt);
    this.level.updateVisuals(this.gameTime);
    this.level.updateVisualSystems(dt);

    const lookingAtCRT = this.isLookingAtCRT();
    if (lookingAtCRT) this.crtStareTime += dt;
    else this.crtStareTime = Math.max(0, this.crtStareTime - dt * 2);

    if (this.level.world.phase === 'cabin') {
      this.level.horror.updateCabin(
        dt,
        this.player.position,
        lookingAtCRT,
        this.crtStareTime
      );
    }
    if (this.level.world.phase === 'tower') {
      this.level.horror.tower.update(
        dt,
        this.level.getTowerCtxForPlayer(this.player)
      );
    }
    if (this.level.world.phase === 'server' || this.level.world.phase === 'finale') {
      this.level.horror.server.update(
        dt,
        this.level.getServerCtxForPlayer(this.player)
      );
    }
    if (this.level.world.isExteriorPhase()) {
      this.level.updateExteriorMission(this.player, dt);
      this.level.horror.exterior.update(
        dt,
        this.level.getExteriorCtxForPlayer(this.player)
      );
    }

    if (this.level.world.isUndercorePhase() && !this.level.world.gameEnded) {
      this.level.updateUndercoreMission(this.player, dt);
      this.level.horror.undercore.update(
        dt,
        this.level.getUndercoreCtxForPlayer(this.player)
      );
    }

    this.level.radio.update(dt, () => {
      this.audio.playStaticBurst(0.4);
      this.mission.setMission(
        'Vous avez parlé sur 7.7 MHz alors que le micro était actif. Le grésillement s\'intensifie — restez silencieux.',
        '7.7 MHz — ERREUR'
      );
    });

    if (this.level.radio.listening) {
      this.ui.radioHud.textContent = this.level.radio.getHudText();
      this.ui.radioHud.classList.remove('hidden');
    } else {
      this.ui.radioHud.classList.add('hidden');
    }

    this.audio.update(dt, this.player.position);

    this.updateInteractHint();
    this.checkHallwayEvent();
    this.ui.battery.style.width = `${this.player.battery * 100}%`;
    this.input.resetMouseDelta();
  }

  /** Interaction avant le mouvement — depenetrate seulement si les colliders changent */
  private processInteract(): boolean {
    const near = findNearestInteractable(
      this.player.position,
      this.player.yaw,
      this.level.getActiveInteractables()
    );
    if (!near || (near.id === 'ext_relay' && this.level.world.exteriorStep === 9)) return false;
    if (!near || (near.id === 'uc_organ' && this.level.world.undercoreStep === 4)) return false;
    if (!this.input.consumeInteract()) return false;

    near.onInteract();
    if (
      near.id !== 'radio' &&
      near.id !== 'breaker' &&
      near.id !== 'beaconcut' &&
      near.id !== 'emergencyexit' &&
      !near.id.startsWith('ext_') &&
      !near.id.startsWith('uc_')
    ) {
      this.audio.playStaticBurst(0.3);
    }
    this.level.onInteract(near.id);

    if (near.id === 'towerdoor' || near.id === 'serverdescent' || near.id === 'emergencyexit') {
      this.level.rebuildColliders();
      return true;
    }
    return false;
  }

  private updateInteractHint(): void {
    if (this.level.world.isUndercorePhase() && !this.level.world.gameEnded) {
      const step = this.level.world.undercoreStep;
      const near = findNearestInteractable(
        this.player.position,
        this.player.yaw,
        this.level.getActiveInteractables()
      );
      if (!near || !this.level.undercoreMission.canInteract(near.id)) {
        const hint = this.level.undercoreMission.getTrailHint(step);
        if (hint) {
          this.ui.hint.textContent = hint;
          this.ui.hint.classList.remove('hidden');
          return;
        }
      }
    }

    if (this.level.world.isExteriorPhase()) {
      const step = this.level.world.exteriorStep;
      if (step >= 2 && step <= 11) {
        const near = findNearestInteractable(
          this.player.position,
          this.player.yaw,
          this.level.getActiveInteractables()
        );
        if (!near || !this.level.exteriorMission.canInteract(near.id)) {
          const hint = this.level.exteriorMission.getTrailHint(
            step,
            this.player.position
          );
          if (hint) {
            this.ui.hint.textContent = hint;
            this.ui.hint.classList.remove('hidden');
            return;
          }
        }
      }
    }

    const near = findNearestInteractable(
      this.player.position,
      this.player.yaw,
      this.level.getActiveInteractables()
    );
    if (near) {
      this.ui.hint.textContent = near.hint;
      this.ui.hint.classList.remove('hidden');
    } else {
      this.ui.hint.classList.add('hidden');
    }
  }

  private checkHallwayEvent(): void {
    const w = this.level.world;
    if (w.phase !== 'hallway' || w.hallwayEventTriggered) return;
    if (this.player.position.x > CABIN_W / 2 + 3) {
      w.hallwayEventTriggered = true;
      this.audio.playHallwayDraft();
      this.mission.setMission(
        'Courant d\'air froid dans la ventilation. Lisez le journal de maintenance sur le mur de gauche, ' +
          'puis ouvrez la porte de la tour radio au fond du couloir.',
        'COULOIR — SECTEUR B'
      );
    }
  }

  private isLookingAtCRT(): boolean {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), this.player.camera);
    const hits = ray.intersectObjects(this.level.crtMeshes, true);
    return hits.length > 0 && hits[0].distance < 5;
  }
}
