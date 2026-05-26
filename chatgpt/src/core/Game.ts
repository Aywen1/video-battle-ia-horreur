import * as THREE from 'three';
import type { AdminCondition } from './AdminTypes';
import { PostProcessing } from '../effects/PostProcessing';
import { InteractionSystem } from '../interactions/InteractionSystem';
import { AssemblyRoom } from '../world/AssemblyRoom';
import { EmployeeBackrooms } from '../world/EmployeeBackrooms';
import { IntroRoom } from '../world/IntroRoom';
import { PublicStore } from '../world/PublicStore';
import { SalesArchive } from '../world/SalesArchive';
import { ShowroomCorridor } from '../world/ShowroomCorridor';
import type { EndingKind } from '../world/ZoneTypes';
import { AudioSystem } from './AudioSystem';
import { Input } from './Input';
import { Player } from './Player';

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 80);
  private readonly clock = new THREE.Clock();
  private readonly input: Input;
  private readonly audio = new AudioSystem();
  private readonly player: Player;
  private readonly interactions: InteractionSystem;
  private readonly room: IntroRoom;
  private readonly post: PostProcessing;
  private corridor?: ShowroomCorridor;
  private publicStore?: PublicStore;
  private backrooms?: EmployeeBackrooms;
  private archive?: SalesArchive;
  private assembly?: AssemblyRoom;
  private readonly overlay: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly message: HTMLDivElement;
  private readonly battery: HTMLDivElement;
  private readonly adminMenu: HTMLDivElement;
  private readonly screamerOverlay: HTMLDivElement;
  private readonly endingOverlay: HTMLDivElement;
  private running = false;
  private elapsed = 0;
  private gameStarted = false;
  private gameEnded = false;
  private closingAdminMenu = false;
  private suppressJumpUntilSpaceUp = false;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x0d0f16);
    this.container.appendChild(this.renderer.domElement);

    this.overlay = this.createOverlay();
    this.prompt = this.createHudElement('prompt');
    this.message = this.createHudElement('message');
    this.battery = this.createHudElement('battery');
    this.adminMenu = this.createAdminMenu();
    this.screamerOverlay = this.createScreamerOverlay();
    this.endingOverlay = this.createEndingOverlay();
    this.container.append(this.overlay, this.adminMenu, this.screamerOverlay, this.endingOverlay, this.prompt, this.message, this.battery);

    this.input = new Input(this.renderer.domElement);
    this.player = new Player(this.camera, this.scene);
    this.interactions = new InteractionSystem(this.camera, this.prompt, this.message);
    this.room = new IntroRoom(this.scene, this.audio, this.interactions);
    this.post = new PostProcessing(this.renderer, this.scene, this.camera);

    this.bindEvents();
    this.resize();
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(this.tick);
  }

  private readonly tick = (): void => {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += delta;

    if (this.input.isLocked) {
      this.player.update(delta, this.input, this.getObstacles(), this.interactions.hasActiveDialogue() || this.suppressJumpUntilSpaceUp);
      this.room.update(delta, this.elapsed, this.camera);
      this.ensureCorridorFromRoomExit();

      this.corridor?.update(delta, this.elapsed, this.camera);
      this.ensurePublicStoreFromCorridorExit();

      this.publicStore?.update(delta, this.elapsed, this.camera);
      this.ensureBackroomsFromPublicStoreExit();

      this.backrooms?.update(delta, this.elapsed, this.camera);
      this.ensureArchiveFromBackroomsExit();

      this.archive?.update(delta, this.elapsed, this.camera);
      this.ensureAssemblyFromArchiveExit();

      this.assembly?.update(delta, this.elapsed, this.camera);
      const ending = this.assembly?.consumeEnding();
      if (ending) {
        this.showEnding(ending);
      }
      this.interactions.update(this.getInteractables());
    }

    this.audio.updateListener(this.camera);
    this.updateHud();
    this.post.setNightmareIntensity(this.assembly?.getNightmareIntensity() ?? 0);
    this.post.render(delta, this.player.getBattery());
  };

  private bindEvents(): void {
    window.addEventListener('resize', this.resize);
    window.addEventListener('public-store-final-screamer', () => this.flashScreamerOverlay());
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape' && this.adminMenu.classList.contains('visible')) {
        event.preventDefault();
        this.closeAdminMenu();
        return;
      }

      if (event.code === 'Space' && !event.repeat && this.interactions.advanceDialogue()) {
        this.suppressJumpUntilSpaceUp = true;
        event.preventDefault();
        return;
      }

      if (event.code === 'KeyE' && this.input.isLocked) {
        this.interactions.interact();
      }
    });
    window.addEventListener('keyup', (event) => {
      if (event.code === 'Space') {
        this.suppressJumpUntilSpaceUp = false;
      }
    });

    document.addEventListener('pointerlockchange', () => {
      if (this.input.isLocked) {
        this.closingAdminMenu = false;
        this.overlay.classList.add('hidden');
        this.adminMenu.classList.remove('visible');
        return;
      }

      if (this.closingAdminMenu) {
        this.overlay.classList.add('hidden');
        this.adminMenu.classList.remove('visible');
        return;
      }

      if (this.gameEnded) {
        this.overlay.classList.add('hidden');
        this.adminMenu.classList.remove('visible');
      } else if (this.gameStarted) {
        this.showAdminMenu();
      } else {
        this.overlay.classList.remove('hidden');
      }
    });

    this.renderer.domElement.addEventListener('click', () => this.enterGame());
    this.overlay.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).matches('button.start')) {
        this.enterGame();
      }
    });
    this.endingOverlay.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).matches('button.restart')) {
        window.location.reload();
      }
    });
  }

  private async enterGame(): Promise<void> {
    await this.audio.start();
    this.gameStarted = true;
    this.input.requestPointerLock();
  }

  private readonly resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.post?.resize(width, height);
  };

  private updateHud(): void {
    const batteryPercent = Math.round(this.player.getBattery() * 100);
    this.battery.textContent = `lampe ${batteryPercent}%`;
  }

  private getObstacles(): THREE.Box3[] {
    return [
      ...this.room.obstacles,
      ...(this.corridor?.obstacles ?? []),
      ...(this.publicStore?.obstacles ?? []),
      ...(this.backrooms?.obstacles ?? []),
      ...(this.archive?.obstacles ?? []),
      ...(this.assembly?.obstacles ?? []),
    ];
  }

  private getInteractables() {
    return [
      ...this.room.interactables,
      ...(this.corridor?.interactables ?? []),
      ...(this.publicStore?.interactables ?? []),
      ...(this.backrooms?.interactables ?? []),
      ...(this.archive?.interactables ?? []),
      ...(this.assembly?.interactables ?? []),
    ];
  }

  private getAdminConditions(): AdminCondition[] {
    return [
      ...this.room.getAdminConditions(),
      ...(this.corridor?.getAdminConditions() ?? []),
      ...(this.publicStore?.getAdminConditions() ?? []),
      ...(this.backrooms?.getAdminConditions() ?? []),
      ...(this.archive?.getAdminConditions() ?? []),
      ...(this.assembly?.getAdminConditions() ?? []),
    ];
  }

  private ensureCorridorFromRoomExit(): void {
    if (this.room.consumeExitRequest() && !this.corridor) {
      this.corridor = new ShowroomCorridor(this.scene, this.audio, this.interactions);
    }
  }

  private ensurePublicStoreFromCorridorExit(): void {
    if (this.corridor?.consumePublicStoreRequest() && !this.publicStore) {
      this.publicStore = new PublicStore(this.scene, this.audio, this.interactions);
    }
  }

  private ensureBackroomsFromPublicStoreExit(): void {
    if (this.publicStore?.consumeBackroomsRequest() && !this.backrooms) {
      this.backrooms = new EmployeeBackrooms(this.scene, this.audio, this.interactions);
    }
  }

  private ensureArchiveFromBackroomsExit(): void {
    if (this.backrooms?.consumeArchiveRequest() && !this.archive) {
      this.archive = new SalesArchive(this.scene, this.audio, this.interactions);
    }
  }

  private ensureAssemblyFromArchiveExit(): void {
    if (this.archive?.consumeAssemblyRequest() && !this.assembly) {
      this.assembly = new AssemblyRoom(this.scene, this.audio, this.interactions);
    }
  }

  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="panel">
        <p class="eyebrow">Ancien magasin Morvant / ronde de nuit</p>
        <h1>La Chambre d'Essai 17</h1>
        <p>
          Le magasin de meubles Morvant a fermé avant liquidation. Cette nuit, tu dois vérifier
          les chambres d'exposition avant leur démolition.
        </p>
        <p>
          La chambre 17 n'existe sur aucun plan. Pourtant, une fiche de ronde te demande d'y
          corriger un détail. Si une chambre semble habitée, éteins la lumière avant de sortir.
        </p>
        <button class="start">Entrer dans le showroom</button>
        <p class="controls">ZQSD/WASD mouvement · Espace sauter · Shift sprint · Ctrl/C s'accroupir · E interagir · Échap pause</p>
      </div>
    `;

    return overlay;
  }

  private createAdminMenu(): HTMLDivElement {
    const menu = document.createElement('div');
    menu.className = 'admin-menu';
    menu.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.matches('button.resume')) {
        this.closeAdminMenu();
        return;
      }

      if (target instanceof HTMLInputElement && target.type === 'checkbox') {
        const condition = this.getAdminConditions().find((item) => item.id === target.dataset.conditionId);
        if (!condition || condition.checked) {
          this.renderAdminMenu();
          return;
        }

        this.interactions.withoutMessages(() => {
          condition.apply();
          this.ensureCorridorFromRoomExit();
          this.ensurePublicStoreFromCorridorExit();
          this.ensureBackroomsFromPublicStoreExit();
          this.ensureArchiveFromBackroomsExit();
          this.ensureAssemblyFromArchiveExit();
        });
        this.renderAdminMenu();
      }
    });
    return menu;
  }

  private createScreamerOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'screamer-overlay';
    overlay.innerHTML = `
      <div class="screamer-face">
        <div class="screamer-eye left"></div>
        <div class="screamer-eye right"></div>
        <div class="screamer-mouth"></div>
      </div>
    `;
    return overlay;
  }

  private flashScreamerOverlay(): void {
    this.screamerOverlay.classList.remove('visible');
    void this.screamerOverlay.offsetWidth;
    this.screamerOverlay.classList.add('visible');
    window.setTimeout(() => this.screamerOverlay.classList.remove('visible'), 1050);
  }

  private createEndingOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'ending-overlay';
    return overlay;
  }

  private showEnding(kind: EndingKind): void {
    const minutes = Math.max(1, Math.round(this.elapsed / 60));
    const copy =
      kind === 'refuse'
        ? {
            title: 'Fin - Refus de vente',
            state: 'Le magasin perd ta forme, mais garde ses rayons ouverts.',
            text: 'Tu as détruit l’étiquette finale. Morvant ne peut plus te vendre comme chambre habitée. La Chambre 17 reste quelque part dans le magasin, vide pour la première fois.',
          }
        : {
            title: 'Fin - Occupant modèle',
            state: 'Tu es exposé, rangé, éclairé.',
            text: 'Tu as signé le ticket. Le magasin a terminé son prototype : la Chambre 17 devient une vitrine parfaite, et la silhouette au fond du lit porte enfin ton prix.',
          };

    this.endingOverlay.innerHTML = `
      <div class="ending-panel">
        <p class="eyebrow">Morvant Meubles / inventaire terminé</p>
        <h1>${copy.title}</h1>
        <p>${copy.text}</p>
        <p class="ending-state">${copy.state}</p>
        <p class="ending-time">Temps approximatif : ${minutes} min</p>
        <button class="restart">Recommencer</button>
      </div>
    `;
    this.gameEnded = true;
    document.exitPointerLock?.();
    this.overlay.classList.add('hidden');
    this.adminMenu.classList.remove('visible');
    this.endingOverlay.classList.add('visible');
  }

  private showAdminMenu(): void {
    this.closingAdminMenu = false;
    this.renderAdminMenu();
    this.overlay.classList.add('hidden');
    this.adminMenu.classList.add('visible');
  }

  private closeAdminMenu(): void {
    this.closingAdminMenu = true;
    this.overlay.classList.add('hidden');
    this.adminMenu.classList.remove('visible');
    window.setTimeout(() => {
      this.input.requestPointerLock();
    }, 0);
  }

  private renderAdminMenu(): void {
    const conditions = this.getAdminConditions();
    const rows = conditions
      .map(
        (condition) => `
          <label class="admin-condition ${condition.checked ? 'done' : ''}">
            <input type="checkbox" data-condition-id="${condition.id}" ${condition.checked ? 'checked disabled' : ''} />
            <span>${condition.label}</span>
          </label>
        `,
      )
      .join('');

    this.adminMenu.innerHTML = `
      <div class="admin-panel">
        <p class="eyebrow">Admin menu / test rapide</p>
        <h2>Conditions de progression</h2>
        <p class="admin-help">Coche une étape pour la valider sans refaire toute la boucle de jeu.</p>
        <div class="admin-list">${rows}</div>
        <button class="resume">Reprendre</button>
      </div>
    `;
  }

  private createHudElement(className: string): HTMLDivElement {
    const element = document.createElement('div');
    element.className = className;
    return element;
  }
}
