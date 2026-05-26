import * as THREE from 'three';
import { Player } from './Player';
import { WorldState } from './WorldState';
import { AnimationSystem } from './AnimationSystem';
import { HorrorDirector } from './HorrorDirector';
import { RadioTuner } from './RadioTuner';
import { AudioManager } from '../audio/AudioManager';
import { InputManager } from './InputManager';
import { MissionPanel } from '../ui/MissionPanel';
import { Interactable } from '../entities/Interactable';
import { AABB, depenetrate } from '../utils/collision';
import { FloorZone } from '../world/FloorZones';
import { PlayBounds, getBoundsForPhase } from '../world/WorldBounds';
import {
  buildObservationRoom,
  updateCRTTextures,
  pulseBeacon,
  CABIN_W,
} from '../world/ObservationRoom';
import { buildHallway } from '../world/HallwayZone';
import { buildHallwayColliders, buildDoorBlocker } from '../world/LevelColliders';
import {
  buildTowerDoorBlocker,
} from '../world/doorBlockers';
import {
  TOWER_DOOR_X,
  TOWER_DOOR_Z,
  TOWER_ENTRY_CX,
  HALL_END_X,
} from '../world/levelLayout';
import { buildCabinWalls } from '../world/cabinWalls';
import { buildTowerZone } from '../world/TowerZone';
import { buildTowerColliders } from '../world/towerColliders';
import { buildServerRoomZone } from '../world/ServerRoomZone';
import { buildServerColliders, SERVER_CX, SERVER_CZ, SERVER_W, SERVER_D } from '../world/serverColliders';
import { buildExteriorZone, lightBuildingWindows } from '../world/ExteriorZone';
import { buildExteriorColliders } from '../world/exteriorColliders';
import { TowerHorrorContext } from './horror/TowerHorror';
import { ServerHorrorContext } from './horror/ServerHorror';
import { ExteriorHorrorContext } from './horror/ExteriorHorror';
import { ScreamerType } from './horror/ScreamerOverlay';
import { ParticleManager } from '../rendering/ParticleManager';
import { LightingDirector } from '../rendering/LightingDirector';
import { PostProcessing } from '../rendering/PostProcessing';
import { CABIN_D } from '../world/ObservationRoom';
import { ExteriorMission, ExteriorStep } from './ExteriorMission';
import { exteriorFloorZone, getTerrainHeight, EXTERIOR_LOCATIONS } from '../world/exteriorTerrain';
import { ExteriorDarkening } from '../rendering/ExteriorDarkening';
import { ExteriorMonsters } from './horror/ExteriorMonsters';
import {
  registerBloodDripEmitter,
  setBloodDripActive,
  spawnBloodBurst,
} from '../world/exteriorBlood';
import { buildUndercoreZone } from '../world/UndercoreZone';
import { buildUndercoreColliders, UNDERCORE_CORRIDOR_HALF_W } from '../world/undercoreColliders';
import { undercoreFloorZone, getUndercoreGroundY } from '../world/undercoreFloor';
import { UndercoreMission, UndercoreStep } from './UndercoreMission';
import { UndercoreHorrorContext } from './horror/UndercoreHorror';

export class LevelManager {
  readonly world = new WorldState();
  readonly anim = new AnimationSystem();

  readonly interiorRoot = new THREE.Group();
  readonly exteriorRoot = new THREE.Group();
  readonly undercoreRoot = new THREE.Group();

  interactables: Interactable[] = [];
  floorZones: FloorZone[] = [];
  crtMeshes: THREE.Mesh[] = [];
  activeWalls: AABB[] = [];
  playBounds: PlayBounds;
  collidersChanged = false;

  beaconLight!: THREE.PointLight;
  doorPivot!: THREE.Group;
  towerDoorPivot!: THREE.Group;
  serverDoorPivot!: THREE.Group;
  antennaPivot!: THREE.Group;
  scareFigureTower!: THREE.Group;
  scareFigureServer!: THREE.Group;
  towerLights: THREE.PointLight[] = [];
  serverLights: THREE.PointLight[] = [];
  rackDoors: THREE.Mesh[] = [];

  serverEmergencyDoor!: THREE.Group;
  towerEmergencyDoor!: THREE.Group;
  private serverEmergencySign!: THREE.MeshStandardMaterial;
  private towerEmergencySign!: THREE.MeshStandardMaterial;

  exteriorMission!: ExteriorMission;
  exteriorInteractables: Interactable[] = [];
  private interiorFloorZones: FloorZone[] = [];
  private treelineFigure!: THREE.Group;
  private mirageBuilding!: THREE.Group;
  private relayBoxLight!: THREE.PointLight;
  private relayHoldTime = 0;
  private lastPlayer: Player | null = null;
  private exteriorDarkening: ExteriorDarkening | null = null;
  private exteriorMonsters: ExteriorMonsters | null = null;
  private buildingDoor: THREE.Group | null = null;

  undercoreMission!: UndercoreMission;
  undercoreInteractables: Interactable[] = [];
  private organMass!: THREE.Group;
  private mirrorFigure!: THREE.Group;
  private undercoreNeonLights: THREE.PointLight[] = [];
  private undercoreBadgeMeshes: THREE.Mesh[] = [];
  private undercoreCrtMeshes: THREE.Mesh[] = [];
  private undercoreHoldTime = 0;
  private onUndercoreEntry: (() => void | Promise<void>) | null = null;
  private onGameEnd: (() => void) | null = null;

  private particles: ParticleManager | null = null;
  private lighting: LightingDirector | null = null;
  private rackLeds: THREE.MeshStandardMaterial[][] = [];
  private statusLeds: THREE.MeshStandardMaterial[] = [];
  private vuTexture: THREE.CanvasTexture | null = null;
  private breakerPos = new THREE.Vector3();
  private ledChaseT = 0;
  private lastPhase = 'cabin';

  private collidersCabin: AABB[] = [];
  private collidersHallway: AABB[] = [];
  private collidersTower: AABB[] = [];
  private collidersServer: AABB[] = [];
  private collidersExterior: AABB[] = [];
  private collidersUndercore: AABB[] = [];
  private buildingWindows: THREE.MeshStandardMaterial[] = [];
  private post: PostProcessing | null = null;
  private onExteriorFinaleEnd: (() => void) | null = null;
  private doorBlocker!: AABB;
  private towerDoorBlocker!: AABB;

  private consoleChecked = { value: false };
  private badgeExamined = { value: false };
  private logPanelRead = { value: false };
  private ceilingAlarmUpdate: (t: number) => void = () => {};
  private gameTime = 0;

  radio!: RadioTuner;
  horror!: HorrorDirector;

  constructor(
    private scene: THREE.Scene,
    private audio: AudioManager,
    private input: InputManager,
    private mission: MissionPanel,
    private onFlash: () => void,
    private onCrtWarning: (show: boolean) => void,
    private onFullscreenScreamer: (type: ScreamerType) => Promise<void>,
    private onEmergencyExit: () => void
  ) {
    this.exteriorRoot.visible = false;
    this.undercoreRoot.visible = false;
    this.scene.add(this.interiorRoot);
    this.scene.add(this.exteriorRoot);
    this.scene.add(this.undercoreRoot);
    this.playBounds = getBoundsForPhase('cabin');
    this.buildLevel();
  }

  setPostProcessing(post: PostProcessing): void {
    this.post = post;
  }

  setExteriorFinaleHandler(fn: () => void): void {
    this.onExteriorFinaleEnd = fn;
  }

  setUndercoreEntryHandler(fn: () => void | Promise<void>): void {
    this.onUndercoreEntry = fn;
  }

  setGameEndHandler(fn: () => void): void {
    this.onGameEnd = fn;
  }

  private buildLevel(): void {
    const parent = this.interiorRoot as unknown as THREE.Scene;
    const room = buildObservationRoom(parent);
    const cabin = buildCabinWalls(parent);
    this.collidersCabin = cabin.colliders;
    this.collidersHallway = buildHallwayColliders();
    this.collidersTower = buildTowerColliders();
    this.collidersServer = buildServerColliders();
    this.doorBlocker = buildDoorBlocker();
    this.towerDoorBlocker = buildTowerDoorBlocker();

    this.rebuildColliders();
    this.interactables = [...room.interactables];
    this.crtMeshes = [...room.crtMeshes];
    this.beaconLight = room.beaconLight;
    this.ceilingAlarmUpdate = room.ceilingAlarm.update;
    this.doorPivot = room.doorPivot;
    this.consoleChecked = room.consoleChecked;
    this.badgeExamined = room.badgeExamined;

    const hallway = buildHallway(parent, () => this.world.doorUnlocked);
    this.floorZones = [...hallway.floorZones];
    this.interactables.push(...hallway.interactables);

    const tower = buildTowerZone(parent);
    this.floorZones.push(...tower.floorZones);
    this.interactables.push(...tower.interactables);
    this.towerDoorPivot = tower.towerDoorPivot;
    this.antennaPivot = tower.antennaPivot;
    this.scareFigureTower = tower.scareFigure;
    this.towerLights = tower.towerLights;
    this.statusLeds = tower.statusLeds;
    this.breakerPos.copy(tower.breakerPos);

    const server = buildServerRoomZone(parent);
    this.interactables.push(...server.interactables);
    this.crtMeshes.push(...server.crtMeshes);
    this.serverDoorPivot = server.serverDoorPivot;
    this.scareFigureServer = server.scareFigure;
    this.serverLights = server.serverLights;
    this.rackDoors = server.rackDoors;
    this.rackLeds = server.rackLeds;
    this.vuTexture = server.vuTexture;
    this.serverEmergencyDoor = server.emergencyExitDoor;
    this.serverEmergencySign = server.emergencyExitSign;
    this.towerEmergencyDoor = tower.emergencyExitDoor;
    this.towerEmergencySign = tower.emergencyExitSign;

    this._visualRoom = room;
    this._visualHallway = hallway;
    this._visualServer = server;

    const exterior = buildExteriorZone(this.exteriorRoot);
    this.collidersExterior = buildExteriorColliders();
    this.buildingWindows = exterior.buildingWindows;
    this._visualExterior = exterior;
    this.exteriorInteractables = exterior.interactables;
    this.treelineFigure = exterior.treelineFigure;
    this.mirageBuilding = exterior.mirageBuilding;
    this.relayBoxLight = exterior.relayBoxLight;
    this.buildingDoor = exterior.buildingDoor;
    this.exteriorMonsters = new ExteriorMonsters(exterior.monsterRoot);

    const undercore = buildUndercoreZone(this.undercoreRoot);
    this.collidersUndercore = buildUndercoreColliders();
    this._visualUndercore = undercore;
    this.undercoreInteractables = undercore.interactables;
    this.organMass = undercore.organMass;
    this.mirrorFigure = undercore.mirrorFigure;
    this.undercoreNeonLights = undercore.neonLights;
    this.undercoreBadgeMeshes = undercore.badgeMeshes;
    this.undercoreCrtMeshes = undercore.crtMeshes;

    const windowSil = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.9, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x0a0c10 })
    );
    windowSil.position.set(TOWER_ENTRY_CX, 1.8, TOWER_DOOR_Z);
    parent.add(windowSil);

    this.horror = new HorrorDirector(
      this.audio,
      this.world,
      this.anim,
      this.onCrtWarning,
      this.onFlash,
      (t, l) => this.mission.setMission(t, l),
      this.onFullscreenScreamer
    );
    this.horror.registerChair(room.chair);
    this.horror.registerOutsideFigure(room.outsideFigure);
    this.horror.registerTowerSilhouette(windowSil);

    this.radio = new RadioTuner(
      this.input,
      this.audio,
      this.world,
      (freq, text, label) => {
        if (freq === 7.4) {
          const p = this.lastPlayerPos;
          text =
            `Static… une voix lit : « badge 7-Δ, position ${p.x.toFixed(1)}, ${p.z.toFixed(1)} ». ` +
            'Les coordonnées suivent vos pas.';
        }
        this.mission.setMission(text, label);
      }
    );

    this.setupInteractableHandlers();
    this.addTowerDoorInteractable();
  }

  private _visualRoom: ReturnType<typeof buildObservationRoom> | null = null;
  private _visualHallway: ReturnType<typeof buildHallway> | null = null;
  private _visualServer: ReturnType<typeof buildServerRoomZone> | null = null;
  private _visualExterior: ReturnType<typeof buildExteriorZone> | null = null;
  private _visualUndercore: ReturnType<typeof buildUndercoreZone> | null = null;

  bindVisualSystems(
    particles: ParticleManager,
    lighting: LightingDirector,
    dirLight: THREE.DirectionalLight
  ): void {
    this.particles = particles;
    this.lighting = lighting;
    if (!this._visualRoom) return;

    lighting.registerDirectional(dirLight);
    lighting.registerStormSky(this._visualRoom.stormSkyTex);
    lighting.registerSea(this._visualRoom.seaMesh);
    lighting.registerFlicker(this._visualRoom.cabinNeon, 1.35);

    for (const nl of this._visualHallway?.neonLights ?? []) {
      lighting.registerFlicker(nl, nl.intensity);
    }

    particles.addEmitter({
      id: 'rain',
      position: new THREE.Vector3(0, 5, -CABIN_D / 2 - 1),
      count: 400,
      color: 0xaaccff,
      size: 0.06,
      speed: 14,
      gravity: 0,
      spread: new THREE.Vector3(12, 6, 2),
      additive: true,
      mode: 'rain',
      active: true,
    });

    particles.addEmitter({
      id: 'cabinDust',
      position: new THREE.Vector3(0, 1.5, 0),
      count: 80,
      color: 0xffeedd,
      size: 0.04,
      speed: 0.3,
      gravity: 0,
      spread: new THREE.Vector3(8, 2, 6),
      additive: true,
      mode: 'dust',
      active: true,
    });

    particles.addEmitter({
      id: 'hallDust',
      position: new THREE.Vector3(HALL_END_X, 1.5, 0),
      count: 60,
      color: 0xccddff,
      size: 0.035,
      speed: 0.25,
      gravity: 0,
      spread: new THREE.Vector3(14, 1.5, 2.5),
      additive: true,
      mode: 'dust',
      active: true,
    });

    for (let i = 0; i < Math.min(4, this._visualServer?.steamPositions.length ?? 0); i++) {
      const pos = this._visualServer!.steamPositions[i];
      particles.addEmitter({
        id: `steam${i}`,
        position: pos.clone(),
        count: 25,
        color: 0xcccccc,
        size: 0.12,
        speed: 0.4,
        gravity: -0.2,
        spread: new THREE.Vector3(0.4, 0.2, 0.4),
        additive: false,
        mode: 'steam',
        active: true,
      });
    }
  }

  private lastPlayerPos = new THREE.Vector3();

  /** Sync état + colliders AVANT le mouvement du joueur. Retourne true si depenetrate requis. */
  preparePhysicsUpdate(player: Player): boolean {
    const needDepenetrate = this.collidersChanged;
    const prevDoor = this.world.doorUnlocked;
    const prevTower = this.world.towerDoorUnlocked;
    const prevPhase = this.world.phase;

    this.syncFlags();
    if (this.world.canUnlockDoor()) {
      this.tryUnlockCabinDoor(this.audio);
    }
    this.updatePhase(player);
    this.rebuildColliders();

    this.collidersChanged = false;
    return (
      needDepenetrate ||
      this.world.doorUnlocked !== prevDoor ||
      this.world.towerDoorUnlocked !== prevTower ||
      this.world.phase !== prevPhase
    );
  }

  private addTowerDoorInteractable(): void {
    this.interactables.push({
      id: 'towerdoor',
      position: new THREE.Vector3(TOWER_DOOR_X, 1.0, TOWER_DOOR_Z),
      radius: 2.4,
      hint: '[E] Ouvrir la porte de la tour radio',
      onInteract: () => {
        if (!this.world.canUnlockTower()) return;
        this.world.towerDoorUnlocked = true;
        this.markCollidersDirty();
        this.audio.playDoorUnlock();
        this.mission.setMission(
          'La porte de la tour est ouverte. Entrez dans la salle technique, activez le disjoncteur « TRANSFERT SERVEUR » sur le panneau du fond, ' +
            'puis empruntez le couloir de service vers la grande salle serveurs.',
          'TOUR RADIO'
        );
      },
      canInteract: () =>
        this.logPanelRead.value &&
        !this.world.towerDoorUnlocked &&
        this.world.doorUnlocked,
    });
  }

  private markCollidersDirty(): void {
    this.collidersChanged = true;
    this.rebuildColliders();
  }

  private setupInteractableHandlers(): void {
    const breaker = this.interactables.find((i) => i.id === 'breaker');
    if (breaker) {
      breaker.onInteract = () => this.onBreaker();
      breaker.canInteract = () =>
        this.world.towerDoorUnlocked && !this.world.breakerActivated;
    }

    const descent = this.interactables.find((i) => i.id === 'serverdescent');
    if (descent) {
      descent.onInteract = () => this.onDescendToServer();
      descent.canInteract = () => this.world.breakerActivated;
    }

    const radio = this.interactables.find((i) => i.id === 'radio');
    if (radio) {
      radio.onInteract = () => {
        this.radio.toggleListening();
        this.showRadioHud(this.radio.listening);
      };
      radio.canInteract = () =>
        this.world.phase === 'server' || this.world.phase === 'finale';
    }

    const cut = this.interactables.find((i) => i.id === 'beaconcut');
    if (cut) {
      cut.onInteract = () => this.onCutBeacon();
      cut.canInteract = () =>
        this.world.phase === 'server' &&
        !this.world.beaconCut &&
        this.radio.frequency >= 7.85;
    }

    for (const exit of this.interactables.filter((i) => i.id === 'emergencyexit')) {
      exit.onInteract = () => this.onEmergencyExit();
      exit.canInteract = () => this.world.canAccessEmergencyExit();
    }

    const log = this.interactables.find((i) => i.id === 'logpanel');
    if (log) {
      const orig = log.onInteract;
      log.onInteract = () => {
        orig();
        this.logPanelRead.value = true;
        this.world.logPanelRead = true;
        this.mission.setMission(
          'Le journal confirme que la balise renvoie la position des gens à l\'intérieur. ' +
            'La porte de la tour radio au fond du couloir peut maintenant s\'ouvrir : activez-y le transfert serveur.',
          'JOURNAL — TOUR'
        );
        this.audio.playSyntheticVoice('ACTIVER TRANSFERT PUIS COUPER BALISE');
      };
    }
  }

  private onBreaker(): void {
    this.world.breakerActivated = true;
    this.audio.playAlarmBeep();
    this.particles?.spawnBurst(this.breakerPos, 50, 0xffaa44);
    this.horror.tower.triggerBreakerScreamer(this.getTowerCtx());
    this.mission.setMission(
      'Le transfert serveur est alimenté. Passez par le couloir de service au nord de la tour pour rejoindre la grande salle serveurs, ' +
        'puis utilisez le poste radio pour trouver la fréquence 7.9 MHz.',
      'DISJONCTEUR ACTIF'
    );
  }

  private onDescendToServer(): void {
    this.enterServerPhase();
    this.horror.server.onEnterServer(this.getServerCtx());
    this.mission.setMission(
      'Vous êtes dans la salle serveurs. Le poste radio est dans l\'annexe à droite : ' +
        'écoutez les fréquences de 7.0 à 7.9 MHz (molette souris ou A/D), trouvez l\'ordre sur 7.9, puis coupez la balise 7 au centre. ' +
        'Une sortie d\'urgence vient de s\'ouvrir au mur est (panneau vert « SORTIE URGENCE »).',
      'SALLE SERVEURS'
    );
  }

  private enterServerPhase(): void {
    if (this.world.phase === 'server' || this.world.phase === 'finale') return;
    this.world.phase = 'server';
    this.playBounds = getBoundsForPhase('server');
    this.markCollidersDirty();
    this.unlockEmergencyExit();
  }

  private unlockEmergencyExit(): void {
    if (this.world.emergencyExitUnlocked) return;
    this.world.emergencyExitUnlocked = true;
    this.serverEmergencyDoor.visible = true;
    this.towerEmergencyDoor.visible = true;
    this.audio.playDoorUnlock();
  }

  enterExteriorWorld(player: Player): void {
    if (this.world.exteriorEntered) return;

    this.interiorRoot.visible = false;
    this.exteriorRoot.visible = true;
    this.world.phase = 'exterior';
    this.world.exteriorEntered = true;
    this.world.exteriorStep = 0;
    this.exteriorMission = new ExteriorMission(this.world);
    this.interiorFloorZones = [...this.floorZones];
    this.floorZones = [exteriorFloorZone];
    this.playBounds = getBoundsForPhase('exterior');
    this.rebuildColliders();
    this.lighting?.setPhaseFog(this.scene, 'exterior');
    const spawnX = 0;
    const spawnZ = 8;
    const groundY = getTerrainHeight(spawnX, spawnZ);
    player.position.set(spawnX, groundY + 1.65, spawnZ);
    player.yaw = 0;
    depenetrate(player.position, 0.28, this.collidersExterior);
    this.collidersChanged = true;
    this.post?.setZoneMood(0.45, 1.1);

    if (this._visualExterior) {
      this.lighting?.registerSea(this._visualExterior.seaMesh);
    }

    this.particles?.addEmitter({
      id: 'exteriorMist',
      position: new THREE.Vector3(0, 0.4, -5),
      count: 120,
      color: 0xccddee,
      size: 0.15,
      speed: 0.15,
      gravity: 0,
      spread: new THREE.Vector3(25, 0.5, 20),
      additive: false,
      mode: 'dust',
      active: true,
    });

    this.particles?.addEmitter({
      id: 'exteriorLeaves',
      position: new THREE.Vector3(-15, 2, 20),
      count: 60,
      color: 0x6a8a50,
      size: 0.08,
      speed: 0.4,
      gravity: -0.05,
      spread: new THREE.Vector3(12, 3, 18),
      additive: false,
      mode: 'dust',
      active: true,
    });

    if (this.particles) {
      registerBloodDripEmitter(
        this.particles,
        new THREE.Vector3(-14, 4, 20)
      );
    }

    if (this._visualExterior) {
      this.exteriorDarkening = new ExteriorDarkening(
        this.scene,
        this.post,
        this._visualExterior.exteriorSun,
        this._visualExterior.exteriorHemi,
        this._visualExterior.skyMesh
      );
      this.exteriorDarkening.setLevelImmediate(0);
    }
    this.exteriorMonsters?.reset();

    this.setupExteriorInteractables();
    const intro = this.exteriorMission.getIntroMission();
    this.mission.setMission(intro.text, intro.label);
    this.horror.exterior.onEnterExterior(this.getExteriorCtxForPlayer(player));
  }

  /** Raccourci pause — saute les Actes 1–2 et téléporte dehors */
  skipToExteriorWorld(player: Player): void {
    if (this.world.exteriorEntered) return;

    this.world.consoleChecked = true;
    this.world.badgeExamined = true;
    this.world.doorUnlocked = true;
    this.world.doorOpenProgress = 1;
    this.world.logPanelRead = true;
    this.world.towerDoorUnlocked = true;
    this.world.towerDoorOpenProgress = 1;
    this.world.breakerActivated = true;
    this.world.beaconCut = true;
    this.world.finaleStarted = true;
    this.world.emergencyExitUnlocked = true;
    this.world.playerHasSeenAnomaly = true;
    this.world.phase = 'finale';

    this.enterExteriorWorld(player);
  }

  /** Raccourci pause — saute directement à l'Acte 4 */
  skipToUndercoreWorld(player: Player): void {
    if (this.world.undercoreEntered) return;

    if (!this.world.exteriorEntered) {
      this.world.consoleChecked = true;
      this.world.badgeExamined = true;
      this.world.doorUnlocked = true;
      this.world.doorOpenProgress = 1;
      this.world.logPanelRead = true;
      this.world.towerDoorUnlocked = true;
      this.world.towerDoorOpenProgress = 1;
      this.world.breakerActivated = true;
      this.world.beaconCut = true;
      this.world.finaleStarted = true;
      this.world.emergencyExitUnlocked = true;
      this.world.playerHasSeenAnomaly = true;
      this.world.exteriorEntered = true;
      this.world.exteriorStep = 12;
    }

    this.enterUndercoreWorld(player);
  }

  enterUndercoreWorld(player: Player): void {
    if (this.world.undercoreEntered) return;

    this.exteriorRoot.visible = false;
    this.interiorRoot.visible = false;
    this.undercoreRoot.visible = true;
    this.world.phase = 'undercore';
    this.world.undercoreEntered = true;
    this.world.undercoreStep = 0;
    this.undercoreMission = new UndercoreMission(this.world);
    this.floorZones = [undercoreFloorZone];
    this.playBounds = getBoundsForPhase('undercore');
    this.rebuildColliders();
    this.lighting?.setPhaseFog(this.scene, 'undercore');
    this.scene.background = new THREE.Color(0x0a0508);

    const spawnZ = 2;
    const spawnY = getUndercoreGroundY(0, spawnZ);
    player.position.set(0, spawnY + 1.65, spawnZ);
    player.yaw = 0;
    depenetrate(player.position, 0.28, this.collidersUndercore);
    this.collidersChanged = true;
    this.post?.setHorrorDarkness(0.85);

    if (this.particles) {
      registerBloodDripEmitter(this.particles, new THREE.Vector3(0, 2.5, 15));
      setBloodDripActive(this.particles, true);
      this.particles.addEmitter({
        id: 'undercoreMist',
        position: new THREE.Vector3(0, 0.5, 20),
        count: 80,
        color: 0x661818,
        size: 0.12,
        speed: 0.08,
        gravity: 0,
        spread: new THREE.Vector3(1.5, 0.4, 25),
        additive: false,
        mode: 'dust',
        active: true,
      });
    }

    for (const nl of this.undercoreNeonLights) {
      this.lighting?.registerFlicker(nl, nl.intensity, 0.2, 0.7);
    }

    this.setupUndercoreInteractables();
    const intro = this.undercoreMission.getIntroMission();
    this.mission.setMission(intro.text, intro.label);
    this.horror.undercore.onEnter(this.getUndercoreCtxForPlayer(player));
  }

  getActiveInteractables(): Interactable[] {
    if (this.world.isUndercorePhase()) return this.undercoreInteractables;
    if (this.world.isExteriorPhase()) return this.exteriorInteractables;
    return this.interactables;
  }

  private setupUndercoreInteractables(): void {
    for (const item of this.undercoreInteractables) {
      item.canInteract = () => this.undercoreMission.canInteract(item.id);
      item.onInteract = () => void this.onUndercoreInteract(item.id);
    }
  }

  private async onUndercoreInteract(id: string): Promise<void> {
    const player = this.lastPlayer;
    if (!player) return;
    const ctx = this.getUndercoreCtxForPlayer(player);

    switch (id) {
      case 'uc_badges':
        this.world.undercoreBadgesRead = true;
        this.horror.undercore.onBadgesRead(ctx);
        break;
      case 'uc_crts':
        this.world.undercoreTapesSeen = true;
        this.horror.undercore.onCrtsViewed(ctx);
        break;
      case 'uc_corpse':
        this.world.undercoreCorpseRead = true;
        await this.horror.undercore.onCorpseRead(ctx);
        break;
      case 'uc_organ':
        return;
      case 'uc_mirror':
        this.world.undercoreMirrorSeen = true;
        this.horror.undercore.onMirrorSeen(ctx);
        break;
      case 'uc_terminal':
        this.horror.undercore.triggerFinalEnding(ctx);
        return;
    }

    const update = this.undercoreMission.advanceStep();
    if (update) this.mission.setMission(update.text, update.label);
  }

  updateUndercoreMission(player: Player, dt: number): void {
    if (!this.world.isUndercorePhase() || this.world.gameEnded) return;
    const p = player.position;

    if (Math.abs(p.x) > UNDERCORE_CORRIDOR_HALF_W) {
      p.x = THREE.MathUtils.clamp(p.x, -0.65, 0.65);
      depenetrate(p, 0.28, this.collidersUndercore);
      this.collidersChanged = true;
    }

    const step = this.world.undercoreStep;

    if (step === 0 && p.z > 10) {
      const update = this.undercoreMission.advanceStep();
      if (update) this.mission.setMission(update.text, update.label);
    }

    if (step === 4 && this.undercoreMission.canInteract('uc_organ')) {
      const organWorld = new THREE.Vector3();
      this.organMass.getWorldPosition(organWorld);
      const nearOrgan = p.distanceTo(organWorld) < 3.2;
      const organ = this.undercoreInteractables.find((i) => i.id === 'uc_organ');
      if (organ) {
        organ.hint =
          nearOrgan && this.undercoreHoldTime > 0
            ? `[E] Coupure… ${Math.max(0, 3 - this.undercoreHoldTime).toFixed(1)} s`
            : '[E] Maintenir 3 s — couper le filament organique';
      }
      const holding = nearOrgan && this.input.isDown('KeyE');
      this.horror.undercore.updateOrganHold(!!holding, this.getUndercoreCtxForPlayer(player));
      if (holding) {
        this.undercoreHoldTime += dt;
        if (this.undercoreHoldTime >= 3) {
          this.undercoreHoldTime = 0;
          this.world.undercoreFilamentCut = true;
          spawnBloodBurst(this.particles, this.organMass.position.clone().setY(1.5));
          this.horror.undercore.onFilamentCut(this.getUndercoreCtxForPlayer(player));
          const update = this.undercoreMission.advanceStep();
          if (update) this.mission.setMission(update.text, update.label);
        }
      } else {
        this.undercoreHoldTime = 0;
      }
    }

    const s = step as UndercoreStep;
    for (const item of this.undercoreInteractables) {
      if (item.id === 'uc_organ' && step === 4) continue;
      const hint = this.undercoreMission.getInteractHint(s);
      if (hint && this.undercoreMission.canInteract(item.id)) {
        item.hint = hint;
      }
    }
  }

  getUndercoreCtxForPlayer(player: Player): UndercoreHorrorContext {
    return {
      playerPos: this.lastPlayerPos,
      playerYaw: player.yaw,
      playerPitch: player.pitch,
      camera: player.camera,
      organMass: this.organMass,
      mirrorFigure: this.mirrorFigure,
      neonLights: this.undercoreNeonLights,
      badgeMeshes: this.undercoreBadgeMeshes,
      crtMeshes: this.undercoreCrtMeshes,
      particles: this.particles,
      gameTime: this.gameTime,
      onFlash: this.onFlash,
      onMission: (t, l) => this.mission.setMission(t, l),
      onGameEnd: () => this.onGameEnd?.(),
    };
  }

  private setupExteriorInteractables(): void {
    for (const item of this.exteriorInteractables) {
      item.canInteract = () => this.exteriorMission.canInteract(item.id);
      item.onInteract = () => this.onExteriorInteract(item.id);
    }
  }

  private onExteriorInteract(id: string): void {
    const player = this.lastPlayer;
    if (!player) return;
    const ctx = this.getExteriorCtxForPlayer(player);

    switch (id) {
      case 'ext_marker':
        this.world.exteriorMarkerRead = true;
        break;
      case 'ext_wreck':
        this.world.exteriorWreckSearched = true;
        this.horror.exterior.onWreckSearched(ctx);
        break;
      case 'ext_blood':
        spawnBloodBurst(this.particles, EXTERIOR_LOCATIONS.bloodPool.clone().setY(0.5));
        this.audio.playBloodDrip();
        setBloodDripActive(this.particles, true);
        break;
      case 'ext_body':
        this.horror.exterior.onBodyExamined(ctx);
        break;
      case 'ext_cross':
        this.world.exteriorCrossReached = true;
        this.world.exteriorNightStarted = true;
        this.world.phase = 'exterior_night';
        this.exteriorDarkening?.triggerNight();
        setBloodDripActive(this.particles, true);
        break;
      case 'ext_shack':
        this.world.exteriorShackRead = true;
        this.horror.exterior.onShackRead(ctx);
        break;
      case 'ext_relay':
        return;
      case 'ext_door':
        this.world.exteriorDoorOpened = true;
        if (this.buildingDoor) {
          this.buildingDoor.rotation.y = -Math.PI / 2;
          this.buildingDoor.position.x -= 0.6;
        }
        lightBuildingWindows(this.buildingWindows, this.buildingWindows.length, 1.4);
        break;
      case 'ext_barrier':
        this.horror.exterior.triggerFinalEnding(ctx);
        return;
    }

    const update = this.exteriorMission.advanceStep();
    if (update) this.mission.setMission(update.text, update.label);
  }

  updateExteriorMission(player: Player, dt: number): void {
    if (!this.world.isExteriorPhase()) return;
    const p = player.position;
    const step = this.world.exteriorStep;

    if (
      step === 2 &&
      !this.world.exteriorTrailEntered &&
      (p.distanceTo(EXTERIOR_LOCATIONS.trailEntry) < 10 ||
        (p.x < -7 && p.z > 11))
    ) {
      this.world.exteriorTrailEntered = true;
      const update = this.exteriorMission.advanceStep();
      if (update) this.mission.setMission(update.text, update.label);
    }

    if (step === 6 && p.z < 24) {
      const update = this.exteriorMission.advanceStep();
      if (update) this.mission.setMission(update.text, update.label);
    }

    if (step === 11 && p.z > 35) {
      const update = this.exteriorMission.advanceStep();
      if (update) this.mission.setMission(update.text, update.label);
    }

    if (step === 9 && this.exteriorMission.canInteract('ext_relay')) {
      const nearRelay = p.distanceTo(EXTERIOR_LOCATIONS.relayBox) < 3.5;
      const relay = this.exteriorInteractables.find((i) => i.id === 'ext_relay');
      if (relay) {
        relay.hint =
          nearRelay && this.relayHoldTime > 0
            ? `[E] Réparation… ${Math.max(0, 2 - this.relayHoldTime).toFixed(1)} s`
            : '[E] Maintenir 2 s — boîtier relais (près du bâtiment)';
      }
      if (nearRelay && this.input.isDown('KeyE')) {
        this.relayHoldTime += dt;
        if (this.relayHoldTime >= 2) {
          this.relayHoldTime = 0;
          this.world.exteriorRelayFixed = true;
          this.relayBoxLight.intensity = 1.2;
          this.horror.exterior.onRelayFixed(this.getExteriorCtxForPlayer(player));
          const update = this.exteriorMission.advanceStep();
          if (update) this.mission.setMission(update.text, update.label);
        }
      } else {
        this.relayHoldTime = 0;
      }
    }

    player.exteriorDarkness = this.exteriorDarkening?.level ?? 0;

    const s = step as ExteriorStep;
    for (const item of this.exteriorInteractables) {
      if (item.id === 'ext_relay' && step === 9) continue;
      const hint = this.exteriorMission.getInteractHint(s);
      if (hint && this.exteriorMission.canInteract(item.id)) {
        item.hint = hint;
      }
    }
  }

  pushExteriorPlayer(dir: THREE.Vector3): void {
    const player = this.lastPlayer;
    if (!player) return;
    player.position.add(dir);
    depenetrate(player.position, 0.28, this.collidersExterior);
    this.collidersChanged = true;
  }

  getExteriorCtxForPlayer(player: Player): ExteriorHorrorContext {
    return {
      playerPos: this.lastPlayerPos,
      playerYaw: player.yaw,
      playerPitch: player.pitch,
      camera: player.camera,
      scene: this.scene,
      buildingWindows: this.buildingWindows,
      treelineFigure: this.treelineFigure,
      mirageBuilding: this.mirageBuilding,
      particles: this.particles,
      lighting: this.lighting,
      monsters: this.exteriorMonsters,
      gameTime: this.gameTime,
      onFlash: this.onFlash,
      onMission: (t, l) => this.mission.setMission(t, l),
      onFinaleEnd: () => this.onExteriorFinaleEnd?.(),
      onEnterUndercore: () => void this.onUndercoreEntry?.(),
      onTriggerEnding: () => {},
      pushPlayer: (dir) => this.pushExteriorPlayer(dir),
    };
  }

  private onCutBeacon(): void {
    this.world.beaconCut = true;
    this.horror.server.triggerBeaconScreamer(this.getServerCtx());
    this.horror.server.startFinale(this.getServerCtx());
  }

  private getTowerCtx(): TowerHorrorContext {
    return {
      antennaPivot: this.antennaPivot,
      towerLights: this.towerLights,
      scareFigure: this.scareFigureTower,
      playerPos: this.lastPlayerPos,
      playerYaw: 0,
      playerPitch: 0,
      camera: new THREE.PerspectiveCamera(),
      onFlash: this.onFlash,
      onMission: (t, l) => this.mission.setMission(t, l),
      onFullscreenScreamer: this.onFullscreenScreamer,
    };
  }

  getTowerCtxForPlayer(player: Player): TowerHorrorContext {
    return {
      ...this.getTowerCtx(),
      playerYaw: player.yaw,
      playerPitch: player.pitch,
      camera: player.camera,
    };
  }

  getServerCtxForPlayer(player: Player): ServerHorrorContext {
    return {
      serverDoorPivot: this.serverDoorPivot,
      rackDoors: this.rackDoors,
      scareFigure: this.scareFigureServer,
      serverLights: this.serverLights,
      playerPos: this.lastPlayerPos,
      playerYaw: player.yaw,
      camera: player.camera,
      onFlash: this.onFlash,
      onMission: (t, l) => this.mission.setMission(t, l),
      onFinale: () => this.unlockEmergencyExit(),
      onFullscreenScreamer: this.onFullscreenScreamer,
    };
  }

  private getServerCtx(): ServerHorrorContext {
    return this.getServerCtxForPlayer({
      yaw: 0,
      camera: new THREE.PerspectiveCamera(),
    } as Player);
  }

  rebuildColliders(): void {
    if (this.world.isUndercorePhase()) {
      this.activeWalls = [...this.collidersUndercore];
      return;
    }
    if (this.world.isExteriorPhase()) {
      this.activeWalls = [...this.collidersExterior];
      return;
    }

    const list: AABB[] = [...this.collidersCabin];

    if (!this.world.doorUnlocked) {
      list.push(this.doorBlocker);
    } else {
      list.push(...this.collidersHallway);

      if (!this.world.towerDoorUnlocked) {
        list.push(this.towerDoorBlocker);
      } else {
        list.push(...this.collidersTower);
      }

      if (this.world.phase === 'server' || this.world.phase === 'finale') {
        list.push(...this.collidersServer);
      }
    }

    this.activeWalls = list;
  }

  syncFlags(): void {
    this.world.consoleChecked = this.consoleChecked.value;
    this.world.badgeExamined = this.badgeExamined.value;
    this.world.logPanelRead = this.logPanelRead.value;
  }

  tryUnlockCabinDoor(audio: AudioManager): boolean {
    if (!this.world.canUnlockDoor()) return false;
    this.world.doorUnlocked = true;
    if (this.world.doorOpenProgress === 0) {
      this.markCollidersDirty();
      this.playBounds = getBoundsForPhase('hallway');
      audio.playDoorUnlock();
      audio.playAlarmBeep();
      this.mission.setMission(
        'La porte du palier est déverrouillée. Passez à droite et suivez le couloir métallique jusqu\'au fond. ' +
          'Lisez le journal de maintenance sur le mur gauche avant d\'ouvrir la tour radio.',
        'ACCÈS PALIER OUVERT'
      );
    }
    return true;
  }

  updateDoors(dt: number): void {
    if (this.world.doorUnlocked && this.world.doorOpenProgress < 1) {
      this.world.doorOpenProgress = Math.min(
        1,
        this.world.doorOpenProgress + dt * 1.2
      );
      this.doorPivot.rotation.y =
        -Math.PI * 0.55 * this.world.doorOpenProgress;
    }
    if (this.world.towerDoorUnlocked && this.world.towerDoorOpenProgress < 1) {
      this.world.towerDoorOpenProgress = Math.min(
        1,
        this.world.towerDoorOpenProgress + dt * 1.2
      );
      this.towerDoorPivot.rotation.y =
        -Math.PI * 0.5 * this.world.towerDoorOpenProgress;
    }
  }

  updatePhase(player: Player): void {
    const p = player.position;
    this.lastPlayer = player;
    this.lastPlayerPos.copy(p);

    if (this.world.isExteriorPhase()) {
      this.playBounds = getBoundsForPhase(this.world.phase);
      if (this.world.phase !== this.lastPhase) {
        this.lighting?.setPhaseFog(this.scene, this.world.phase);
        this.lastPhase = this.world.phase;
      }
      return;
    }

    if (this.world.isUndercorePhase()) {
      this.playBounds = getBoundsForPhase(this.world.phase);
      if (this.world.phase !== this.lastPhase) {
        this.lighting?.setPhaseFog(this.scene, this.world.phase);
        this.lastPhase = this.world.phase;
      }
      return;
    }

    const hw = SERVER_W / 2;
    const hd = SERVER_D / 2;
    const inServerRoom =
      this.world.breakerActivated &&
      p.x > SERVER_CX - hw + 0.5 &&
      p.x < SERVER_CX + hw - 0.5 &&
      p.z > SERVER_CZ - hd + 0.5 &&
      p.z < SERVER_CZ + hd - 0.5;
    if (
      inServerRoom &&
      this.world.phase !== 'server' &&
      this.world.phase !== 'finale'
    ) {
      this.enterServerPhase();
    }

    if (
      p.x > CABIN_W / 2 + 0.5 &&
      this.world.doorUnlocked &&
      this.world.phase === 'cabin'
    ) {
      this.world.phase = 'hallway';
    }
    if (
      p.x > HALL_END_X + 0.5 &&
      this.world.towerDoorUnlocked &&
      this.world.phase === 'hallway'
    ) {
      this.world.phase = 'tower';
      this.horror.tower.reset();
    }

    if (this.world.phase !== this.lastPhase) {
      this.lighting?.setPhaseFog(this.scene, this.world.phase);
      this.lastPhase = this.world.phase;
    }

    if (this.world.doorUnlocked) {
      this.playBounds = getBoundsForPhase(
        this.world.phase === 'server' || this.world.phase === 'finale'
          ? 'server'
          : 'hallway'
      );
    }
  }

  updateVisuals(gameTime: number): void {
    this.gameTime = gameTime;
    this.ceilingAlarmUpdate(gameTime);
    pulseBeacon(this.beaconLight, gameTime);
    const coords = `Δ INT: ${(3 + Math.sin(gameTime) * 0.1).toFixed(1)}m`;
    updateCRTTextures(this.crtMeshes, gameTime, coords);

    this.antennaPivot.rotation.y = gameTime * 0.05;
    const dish = this.antennaPivot.children[1];
    if (dish) dish.rotation.z = Math.sin(gameTime * 0.5) * 0.08;

    this.ledChaseT += 0.016;
    const chaseIdx = Math.floor(this.ledChaseT * 3) % 4;
    for (const rack of this.rackLeds) {
      rack.forEach((mat, i) => {
        mat.emissiveIntensity = i === chaseIdx ? 1.4 : 0.25;
      });
    }

    for (let i = 0; i < this.statusLeds.length; i++) {
      this.statusLeds[i].emissiveIntensity =
        0.5 + Math.sin(gameTime * 2 + i) * 0.4;
    }

    if (this.vuTexture && 'updateVU' in this.vuTexture) {
      const levels = Array.from({ length: 6 }, (_, i) =>
        0.3 + Math.abs(Math.sin(gameTime * 4 + i * 0.8)) * 0.7
      );
      (this.vuTexture as { updateVU: (l: number[]) => void }).updateVU(levels);
    }

    const exitActive = this.world.canAccessEmergencyExit();
    if (this.serverEmergencyDoor) {
      this.serverEmergencyDoor.visible = exitActive;
      this.towerEmergencyDoor.visible = exitActive;
    }
    if (exitActive && this.serverEmergencySign) {
      const pulse = 0.6 + Math.sin(gameTime * 4) * 0.4;
      this.serverEmergencySign.emissiveIntensity = pulse;
      this.towerEmergencySign.emissiveIntensity = pulse;
    }

    if (this.world.isExteriorPhase() && this.relayBoxLight) {
      if (this.world.exteriorRelayFixed) {
        this.relayBoxLight.intensity =
          0.8 + Math.sin(gameTime * 3) * 0.3;
      }
    }

    if (this.world.isExteriorPhase() && this.exteriorDarkening) {
      if (this.world.exteriorNightStarted || this.world.exteriorStep >= 5) {
        this.exteriorDarkening.update(0.016);
      }
    }
  }

  updateVisualSystems(dt: number): void {
    this.particles?.update(dt);
    this.lighting?.update(dt, this.world.phase);
  }

  showRadioHud(_show: boolean): void {
    const el = document.getElementById('radio-tuner');
    if (el) el.classList.toggle('hidden', !this.radio.listening);
  }

  onInteract(id: string): void {
    if (id === 'console') {
      this.mission.setMission(
        'La console confirme que la balise 7 émet toujours, mais les coordonnées GPS pointent vers l\'intérieur de la cabine. ' +
          'Examinez le casque sur l\'étagère du mur gauche si ce n\'est pas déjà fait.',
        'CONSOLE — BALISE 7'
      );
      this.audio.playSyntheticVoice('COORDONNEES RECALCULEES INTERIEUR');
    }
    if (id === 'badge') {
      this.mission.setMission(
        'Badge vierge « 7-Δ-NULL » sous le casque jaune. Vérifiez la console pour débloquer la sortie.',
        'CASQUE ET BADGE'
      );
    }
  }
}
