import * as THREE from 'three';
import type { AdminCondition } from '../core/AdminTypes';
import { AudioSystem } from '../core/AudioSystem';
import { InteractionSystem, type Interactable } from '../interactions/InteractionSystem';
import { createBed, createBox, createMannequin, createPaperLabel, createPriceTag, createWardrobe } from './GeometryFactory';
import { createMaterials } from './Materials';

type StoreAction = 'register' | 'breaker' | 'ledger' | 'window';

export class PublicStore {
  readonly obstacles: THREE.Box3[] = [];
  readonly interactables: Interactable[] = [];
  private readonly group = new THREE.Group();
  private readonly materials = createMaterials();
  private readonly completed = new Set<StoreAction>();
  private readonly ceilingLights: THREE.PointLight[] = [];
  private readonly goreFigure = new THREE.Group();
  private readonly bloodTrail: THREE.Mesh[] = [];
  private readonly ceilingDrips: THREE.Mesh[] = [];
  private readonly hallucinations: THREE.Object3D[] = [];
  private readonly animatedDecor: THREE.Object3D[] = [];
  private readonly serviceDoorGlow = new THREE.PointLight(0xff3355, 0, 9, 1.35);
  private serviceDoor?: THREE.Mesh;
  private serviceDoorObstacle?: THREE.Box3;
  private finalScreamerDone = false;
  private serviceExitOpen = false;
  private backroomsRequested = false;
  private backroomsUnlocked = false;
  private ceilingMeltActive = false;
  private hallucinationActiveUntil = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly audio: AudioSystem,
    private readonly interactions: InteractionSystem,
  ) {
    this.group.name = 'Grand magasin public';
    this.scene.add(this.group);
    this.buildShell();
    this.buildOutsideStreet();
    this.buildStoreFixtures();
    this.buildAnimatedDecor();
    this.buildLights();
    this.buildCreepySetpieces();
    this.buildGoreFigure();
    this.buildInteractions();
    this.interactions.showMessage(['Le magasin est encore allumé.', 'La sortie personnel ne s’ouvrira qu’après trois anomalies traitées.']);
  }

  update(delta: number, elapsed: number, _camera: THREE.Camera): void {
    for (let i = 0; i < this.ceilingLights.length; i += 1) {
      const light = this.ceilingLights[i];
      const flicker = this.finalScreamerDone ? (Math.sin(elapsed * 18 + i) > 0.45 ? 1.25 : 0.35) : 1;
      light.intensity = THREE.MathUtils.lerp(light.intensity, (this.finalScreamerDone ? 5.8 : 7.2) * flicker, delta * 7);
      light.color.setHex(this.finalScreamerDone ? 0xffc8c8 : 0xf4fbff);
    }

    if (this.finalScreamerDone) {
      this.goreFigure.rotation.y += delta * 0.8;
      this.goreFigure.position.y = Math.sin(elapsed * 12) * 0.035;
      this.serviceDoorGlow.intensity = THREE.MathUtils.lerp(this.serviceDoorGlow.intensity, 3.5, delta * 2);
    }

    this.updateBloodTrail(delta);
    this.updateCeilingDrips(delta, elapsed);
    this.updateHallucinations(elapsed);
    for (let i = 0; i < this.animatedDecor.length; i += 1) {
      const decor = this.animatedDecor[i];
      decor.rotation.y += delta * (0.18 + i * 0.02);
      decor.position.x += Math.sin(elapsed * 1.4 + i) * 0.0008;
    }

    if (this.serviceExitOpen && this.serviceDoor) {
      this.serviceDoor.rotation.y = THREE.MathUtils.lerp(this.serviceDoor.rotation.y, -Math.PI * 0.55, delta * 1.8);
      this.serviceDoor.position.x = THREE.MathUtils.lerp(this.serviceDoor.position.x, -0.62, delta * 1.5);
    }
  }

  getAdminConditions(): AdminCondition[] {
    return [
      {
        id: 'public-register',
        label: '9. Magasin public : caisse scannée',
        checked: this.completed.has('register'),
        apply: () => this.forceAction('register'),
      },
      {
        id: 'public-breaker',
        label: '10. Magasin public : tableau électrique réarmé',
        checked: this.completed.has('breaker'),
        apply: () => this.forceAction('breaker'),
      },
      {
        id: 'public-ledger',
        label: '11. Magasin public : registre service client lu',
        checked: this.completed.has('ledger'),
        apply: () => this.forceAction('ledger'),
      },
      {
        id: 'public-window',
        label: '12. Magasin public : vitrine inspectée',
        checked: this.completed.has('window'),
        apply: () => this.forceAction('window'),
      },
      {
        id: 'public-three-actions',
        label: '13. Magasin public : 3 actions validées',
        checked: this.completed.size >= 3,
        apply: () => {
          this.forceAction('register');
          this.forceAction('breaker');
          this.forceAction('ledger');
        },
      },
      {
        id: 'public-final-screamer',
        label: '14. Magasin public : screamer final déclenché',
        checked: this.finalScreamerDone,
        apply: () => this.triggerFinalScreamer(),
      },
      {
        id: 'public-service-exit',
        label: '15. Magasin public : sortie service ouverte',
        checked: this.serviceExitOpen,
        apply: () => {
          this.forceAction('register');
          this.forceAction('breaker');
          this.forceAction('ledger');
          this.triggerFinalScreamer();
          this.openServiceExit();
        },
      },
      {
        id: 'public-backrooms-entered',
        label: '16. Magasin public : backrooms accessibles',
        checked: this.backroomsUnlocked,
        apply: () => {
          this.forceAction('register');
          this.forceAction('breaker');
          this.forceAction('ledger');
          this.triggerFinalScreamer();
          this.openServiceExit();
        },
      },
    ];
  }

  consumeBackroomsRequest(): boolean {
    if (!this.backroomsRequested) {
      return false;
    }
    this.backroomsRequested = false;
    return true;
  }

  private buildShell(): void {
    const floor = createBox('sol carrelé magasin', new THREE.Vector3(16, 0.18, 18), new THREE.Vector3(0, -0.09, -34), this.materials.floor);
    const ceiling = createBox('plafond commercial magasin', new THREE.Vector3(16, 0.22, 18), new THREE.Vector3(0, 4.05, -34), this.materials.ceiling);
    const leftWall = createBox('mur gauche magasin', new THREE.Vector3(0.28, 4.1, 18), new THREE.Vector3(-8, 1.98, -34), this.materials.wall);
    const rightWall = createBox('mur droit magasin', new THREE.Vector3(0.28, 4.1, 18), new THREE.Vector3(8, 1.98, -34), this.materials.wall);
    const backWallLeft = createBox('mur service gauche magasin', new THREE.Vector3(6.9, 4.1, 0.28), new THREE.Vector3(-4.55, 1.98, -43), this.materials.wall);
    const backWallRight = createBox('mur service droit magasin', new THREE.Vector3(6.9, 4.1, 0.28), new THREE.Vector3(4.55, 1.98, -43), this.materials.wall);
    const backWallTop = createBox('linteau sortie personnel', new THREE.Vector3(2.2, 1.15, 0.28), new THREE.Vector3(0, 3.48, -43), this.materials.wall);
    const frontLeft = createBox('pilier vitrine gauche', new THREE.Vector3(2.2, 4.1, 0.28), new THREE.Vector3(-6.9, 1.98, -25), this.materials.wall);
    const frontRight = createBox('pilier vitrine droit', new THREE.Vector3(2.2, 4.1, 0.28), new THREE.Vector3(6.9, 1.98, -25), this.materials.wall);
    const window = createBox('grande vitrine rue', new THREE.Vector3(11, 2.7, 0.06), new THREE.Vector3(0, 2.1, -24.86), this.materials.mirror);
    const serviceDoor = createBox('porte sortie personnel', new THREE.Vector3(1.8, 2.8, 0.18), new THREE.Vector3(0, 1.35, -42.82), this.materials.black);
    this.serviceDoor = serviceDoor;
    this.serviceDoorGlow.position.set(0, 1.1, -42.2);
    const stairVoid = createBox('ombre au sol escalier employés', new THREE.Vector3(2.2, 0.025, 3), new THREE.Vector3(0, 0.015, -44.5), this.materials.black);

    this.group.add(floor, ceiling, leftWall, rightWall, backWallLeft, backWallRight, backWallTop, frontLeft, frontRight, window, stairVoid, serviceDoor, this.serviceDoorGlow);
    [leftWall, rightWall, backWallLeft, backWallRight, backWallTop, frontLeft, frontRight].forEach((object) => this.addObstacle(object));
    this.serviceDoorObstacle = this.addObstacle(serviceDoor);

    const stairMaterial = new THREE.MeshStandardMaterial({ color: 0x343a42, metalness: 0.45, roughness: 0.6, flatShading: true });
    for (let i = 0; i < 6; i += 1) {
      const step = createBox(
        'marches vers employés',
        new THREE.Vector3(1.7, 0.08 + i * 0.02, 0.38),
        new THREE.Vector3(0, 0.04 + i * 0.04, -43.45 - i * 0.38),
        stairMaterial,
      );
      this.group.add(step);
    }

    const storeSign = createPaperLabel('MORVANT MEUBLES - OUVERT LA NUIT', this.materials.sign);
    storeSign.position.set(0, 3.35, -25.05);
    storeSign.scale.set(1.7, 1.2, 1.2);
    this.group.add(storeSign);
  }

  private buildOutsideStreet(): void {
    const street = createBox('rue extérieure nuit', new THREE.Vector3(18, 0.12, 6), new THREE.Vector3(0, -0.15, -20.8), this.materials.black);
    this.group.add(street);

    const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), this.materials.supernatural);
    moon.name = 'lune dehors';
    moon.position.set(4.6, 5.8, -21.8);
    this.group.add(moon);

    for (let i = 0; i < 34; i += 1) {
      const star = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025 + Math.random() * 0.025, 0), this.materials.sign);
      star.position.set(-7 + Math.random() * 14, 4.7 + Math.random() * 2.4, -22.2 - Math.random() * 1.6);
      this.group.add(star);
    }

    for (let i = 0; i < 6; i += 1) {
      const building = createBox('immeuble extérieur', new THREE.Vector3(1.6, 1.5 + Math.random() * 1.4, 0.25), new THREE.Vector3(-6 + i * 2.4, 0.8, -22.8), this.materials.black);
      const lamp = new THREE.PointLight(0xffcf91, 0.8, 3.8, 2);
      lamp.position.set(-6 + i * 2.4, 1.7, -22.2);
      this.group.add(building, lamp);
    }
  }

  private buildStoreFixtures(): void {
    const register = createBox('caisse enregistreuse', new THREE.Vector3(2.2, 1.05, 1.1), new THREE.Vector3(-5.3, 0.52, -30.2), this.materials.wood);
    const scanner = createBox('scanner caisse', new THREE.Vector3(0.72, 0.16, 0.5), new THREE.Vector3(-5.3, 1.16, -30.05), this.materials.supernatural);
    const breaker = createBox('tableau électrique public', new THREE.Vector3(1, 1.55, 0.16), new THREE.Vector3(7.82, 1.6, -33.8), this.materials.metal);
    breaker.rotation.y = -Math.PI / 2;
    const desk = createBox('bureau service client', new THREE.Vector3(2.8, 0.88, 1.05), new THREE.Vector3(4.5, 0.44, -39.6), this.materials.wood);
    const ledger = createPaperLabel('REGISTRE CLIENTS 17', this.materials.sign);
    ledger.name = 'registre service client';
    ledger.position.set(4.5, 0.96, -39.98);
    ledger.rotation.x = -Math.PI / 2;
    const windowMarker = createPriceTag('REFLET');
    windowMarker.name = 'étiquette vitrine reflet';
    windowMarker.position.set(0, 1.45, -24.76);

    this.group.add(register, scanner, breaker, desk, ledger, windowMarker);
    [register, desk].forEach((object) => this.addObstacle(object));

    for (let i = 0; i < 5; i += 1) {
      const bed = createBed(this.materials);
      bed.scale.set(0.75, 0.75, 0.75);
      bed.position.set(-3.8 + (i % 2) * 7.6, 0, -33.2 - Math.floor(i / 2) * 3.2);
      bed.rotation.y = i % 2 === 0 ? 0.07 : -0.07;
      const tag = createPriceTag(i === 2 ? 'VENDU' : `${199 + i * 30}€`);
      tag.position.set(bed.position.x - 0.85, 1.12, bed.position.z + 0.7);
      this.group.add(bed, tag);
      this.addObstacleBox(new THREE.Vector3(1.6, 0.8, 2.2), new THREE.Vector3(bed.position.x, 0.4, bed.position.z));
    }

    for (let i = 0; i < 6; i += 1) {
      const shelf = createWardrobe(this.materials);
      shelf.position.set(-6.6 + i * 2.65, 0, -37.4);
      shelf.rotation.y = Math.PI;
      this.group.add(shelf);
      this.addObstacleBox(new THREE.Vector3(1.2, 2.4, 0.55), new THREE.Vector3(shelf.position.x, 1.2, shelf.position.z));
    }
  }

  private buildAnimatedDecor(): void {
    for (let i = 0; i < 4; i += 1) {
      const cart = new THREE.Group();
      cart.name = 'caddie abandonné animé';
      const basket = createBox('panier caddie', new THREE.Vector3(0.85, 0.42, 0.55), new THREE.Vector3(0, 0.55, 0), this.materials.metal);
      const handle = createBox('poignée caddie', new THREE.Vector3(0.9, 0.06, 0.08), new THREE.Vector3(0, 0.88, -0.34), this.materials.black);
      cart.add(basket, handle);
      for (let w = 0; w < 4; w += 1) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8), this.materials.black);
        wheel.position.set(w < 2 ? -0.35 : 0.35, 0.13, w % 2 === 0 ? -0.24 : 0.24);
        wheel.rotation.z = Math.PI / 2;
        cart.add(wheel);
      }
      cart.position.set(-5.2 + i * 3.4, 0, -31.5 - (i % 2) * 5.2);
      cart.rotation.y = (i - 1) * 0.35;
      this.animatedDecor.push(cart);
      this.group.add(cart);
    }

    for (let i = 0; i < 5; i += 1) {
      const mobile = createPriceTag(i % 2 === 0 ? 'OFFRE' : 'DERNIER');
      mobile.name = 'mobile promo magasin';
      mobile.position.set(-6 + i * 3, 2.45, -28.8 - (i % 2) * 7);
      mobile.scale.set(0.72, 0.72, 0.72);
      this.animatedDecor.push(mobile);
      this.group.add(mobile);
    }
  }

  private buildLights(): void {
    for (let x = -5.6; x <= 5.6; x += 3.7) {
      for (let z = -28.5; z >= -40.5; z -= 4) {
        const panel = createBox('dalle lumineuse magasin', new THREE.Vector3(1.8, 0.05, 0.9), new THREE.Vector3(x, 3.86, z), this.materials.supernatural);
        const light = new THREE.PointLight(0xf4fbff, 7.2, 8, 1.25);
        light.position.set(x, 3.45, z);
        this.ceilingLights.push(light);
        this.group.add(panel, light);
      }
    }
  }

  private buildCreepySetpieces(): void {
    const bloodMaterial = new THREE.MeshStandardMaterial({
      color: 0x6d0309,
      emissive: 0x2b0003,
      emissiveIntensity: 0.25,
      roughness: 0.9,
      flatShading: true,
    });

    for (let i = 0; i < 18; i += 1) {
      const stain = new THREE.Mesh(new THREE.CircleGeometry(0.18 + Math.random() * 0.28, 8), bloodMaterial);
      stain.name = 'tache de sang progressive';
      stain.position.set((Math.random() - 0.5) * 1.7, 0.012, -31.2 - i * 0.62);
      stain.rotation.x = -Math.PI / 2;
      stain.rotation.z = Math.random() * Math.PI;
      stain.scale.setScalar(0.001);
      this.bloodTrail.push(stain);
      this.group.add(stain);
    }

    const dripMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a080b,
      emissive: 0x120002,
      emissiveIntensity: 0.2,
      roughness: 0.85,
      flatShading: true,
    });

    for (let i = 0; i < 14; i += 1) {
      const drip = new THREE.Mesh(new THREE.ConeGeometry(0.12 + Math.random() * 0.12, 1, 6), dripMaterial);
      drip.name = 'plafond qui coule';
      drip.position.set(-5.5 + Math.random() * 11, 3.82, -30 - Math.random() * 10);
      drip.rotation.x = Math.PI;
      drip.scale.set(0.15, 0.001, 0.15);
      this.ceilingDrips.push(drip);
      this.group.add(drip);
    }

    for (let i = 0; i < 5; i += 1) {
      const ghost = createMannequin(this.materials);
      ghost.name = 'hallucination client';
      ghost.position.set(-5.8 + i * 2.9, 0, -32.4 - (i % 2) * 4.1);
      ghost.rotation.y = i % 2 === 0 ? Math.PI * 0.15 : -Math.PI * 0.2;
      ghost.scale.set(0.72, 0.72, 0.72);
      ghost.visible = false;
      this.hallucinations.push(ghost);
      this.group.add(ghost);
    }
  }

  private buildGoreFigure(): void {
    const body = createBox('masse gore corps', new THREE.Vector3(0.9, 1.6, 0.55), new THREE.Vector3(0, 0.92, 0), this.materials.black);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), this.materials.mannequin);
    head.name = 'masse gore tête';
    head.position.set(0, 1.95, -0.08);
    this.goreFigure.add(body, head);

    for (let i = 0; i < 22; i += 1) {
      const shard = createBox('fragment rouge procédural', new THREE.Vector3(0.08 + Math.random() * 0.22, 0.08 + Math.random() * 0.28, 0.04), new THREE.Vector3((Math.random() - 0.5) * 2.4, 0.3 + Math.random() * 1.9, (Math.random() - 0.5) * 1.3), this.materials.supernatural);
      shard.material = new THREE.MeshStandardMaterial({ color: 0x9c101b, emissive: 0x5a0207, emissiveIntensity: 0.55, roughness: 0.72, flatShading: true });
      shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.goreFigure.add(shard);
    }

    this.goreFigure.visible = false;
    this.goreFigure.position.set(0, 0, -35.2);
    this.group.add(this.goreFigure);
  }

  private buildInteractions(): void {
    this.addActionInteraction('caisse enregistreuse', 'Scanner le ticket', 'register', () => this.triggerRegisterScreamer());
    this.addActionInteraction('tableau électrique public', 'Réarmer le tableau', 'breaker', () => {
      this.audio.playElectricBuzz(new THREE.Vector3(7.6, 1.5, -33.8));
      this.ceilingMeltActive = true;
      this.interactions.showMessage('Les plafonniers cessent de vibrer pendant une seconde.');
    });
    this.addActionInteraction('registre service client', 'Lire le registre', 'ledger', () => {
      this.audio.playPaperRustle(new THREE.Vector3(4.5, 1, -40));
      this.triggerHallucinationBurst(3200);
      this.interactions.showMessage(['Dernière vente : Chambre d’Essai 17.', 'Acheteur : occupant modèle.']);
    });
    this.addActionInteraction('étiquette vitrine reflet', 'Inspecter le reflet', 'window', () => this.triggerWindowScreamer());

    if (this.serviceDoor) {
      this.interactables.push({
        object: this.serviceDoor,
        label: 'Ouvrir sortie personnel',
        maxDistance: 2.8,
        onInteract: () => {
          if (!this.finalScreamerDone) {
            this.interactions.showMessage('La poignée est chaude. Le magasin attend encore.');
            return;
          }

          this.openServiceExit();
        },
      });
    }
  }

  private addActionInteraction(objectName: string, label: string, action: StoreAction, effect: () => void): void {
    const object = this.group.getObjectByName(objectName);
    if (!object) {
      return;
    }

    this.interactables.push({
      object,
      label,
      maxDistance: 2.6,
      onInteract: () => {
        if (this.completed.has(action)) {
          this.interactions.showMessage('C’est déjà fait.');
          return;
        }

        this.completed.add(action);
        this.revealBloodForProgress();
        effect();
        this.checkFinalScreamer();
      },
    });
  }

  private forceAction(action: StoreAction): void {
    this.completed.add(action);
    this.revealBloodForProgress();
    this.checkFinalScreamer();
  }

  private triggerRegisterScreamer(): void {
    const hand = createBox('main caisse screamer', new THREE.Vector3(0.28, 0.1, 0.6), new THREE.Vector3(-5.3, 1.32, -29.58), this.materials.mannequin);
    const tag = createPriceTag('TOI');
    tag.position.set(-5.3, 1.48, -29.3);
    this.group.add(hand, tag);
    this.audio.playScannerBeep(hand.position);
    window.setTimeout(() => this.audio.playSmallScreamer(hand.position), 120);
    this.triggerHallucinationBurst(2200);
    window.setTimeout(() => {
      hand.visible = false;
      tag.visible = false;
    }, 1400);
  }

  private triggerWindowScreamer(): void {
    const face = createMannequin(this.materials);
    face.name = 'visage reflet vitrine';
    face.scale.set(0.65, 0.65, 0.65);
    face.position.set(0.9, 0.25, -24.25);
    face.rotation.y = Math.PI;
    this.group.add(face);
    this.audio.playHallucinationAppear(face.position);
    window.setTimeout(() => this.audio.playSmallScreamer(face.position), 80);
    this.triggerHallucinationBurst(2600);
    window.setTimeout(() => {
      face.visible = false;
      this.audio.playHallucinationDisappear(face.position);
    }, 750);
  }

  private checkFinalScreamer(): void {
    if (this.completed.size >= 3) {
      this.triggerFinalScreamer();
    }
  }

  private triggerFinalScreamer(): void {
    if (this.finalScreamerDone) {
      return;
    }

    this.finalScreamerDone = true;
    this.ceilingMeltActive = true;
    this.goreFigure.visible = true;
    this.goreFigure.scale.set(1.4, 1.4, 1.4);
    this.audio.playFullScreenScreamer(this.goreFigure.position);
    window.dispatchEvent(new CustomEvent('public-store-final-screamer'));
    this.interactions.showMessage(['Le rayon central s’écarte.', 'Quelque chose porte les prix sous sa peau.']);
  }

  private openServiceExit(): void {
    if (this.serviceExitOpen) {
      return;
    }

    this.serviceExitOpen = true;
    this.backroomsUnlocked = true;
    if (this.serviceDoorObstacle) {
      const index = this.obstacles.indexOf(this.serviceDoorObstacle);
      if (index >= 0) {
        this.obstacles.splice(index, 1);
      }
    }

    this.audio.playDoorRattle(new THREE.Vector3(0, 1, -42.3));
    this.backroomsRequested = true;
    this.interactions.showMessage('La sortie personnel s’ouvre sur un escalier sans lumière.');
  }

  private revealBloodForProgress(): void {
    const targetCount = Math.min(this.bloodTrail.length, this.completed.size * 5 + (this.finalScreamerDone ? this.bloodTrail.length : 0));
    this.audio.playBloodDrip(new THREE.Vector3(0, 0, -36));
    for (let i = 0; i < targetCount; i += 1) {
      const stain = this.bloodTrail[i];
      const targetScale = 0.75 + (i % 4) * 0.18;
      stain.userData.targetScale = targetScale;
    }
  }

  private updateBloodTrail(delta: number): void {
    for (const stain of this.bloodTrail) {
      const target = (stain.userData.targetScale as number | undefined) ?? 0.001;
      const next = THREE.MathUtils.lerp(stain.scale.x, target, delta * 1.8);
      stain.scale.setScalar(next);
    }
  }

  private updateCeilingDrips(delta: number, elapsed: number): void {
    const activeAmount = this.ceilingMeltActive ? 1 : 0;
    for (let i = 0; i < this.ceilingDrips.length; i += 1) {
      const drip = this.ceilingDrips[i];
      const targetY = activeAmount * (0.85 + (i % 5) * 0.28);
      drip.scale.y = THREE.MathUtils.lerp(drip.scale.y, Math.max(0.001, targetY), delta * 0.42);
      drip.position.y = 3.82 - drip.scale.y * 0.38;
      drip.rotation.z = Math.sin(elapsed * 1.8 + i) * 0.04;
    }
  }

  private triggerHallucinationBurst(duration: number): void {
    this.hallucinationActiveUntil = Math.max(this.hallucinationActiveUntil, performance.now() + duration);
    this.audio.playHallucinationAppear(new THREE.Vector3(0, 1.4, -34));
    for (const hallucination of this.hallucinations) {
      hallucination.visible = true;
    }
  }

  private updateHallucinations(elapsed: number): void {
    const active = performance.now() < this.hallucinationActiveUntil;
    for (let i = 0; i < this.hallucinations.length; i += 1) {
      const hallucination = this.hallucinations[i];
      hallucination.visible = active && Math.sin(elapsed * 10 + i) > -0.35;
      hallucination.rotation.y += active ? 0.006 : 0;
    }
  }

  private addObstacle(object: THREE.Object3D): THREE.Box3 {
    object.updateWorldMatrix(true, true);
    const obstacle = new THREE.Box3().setFromObject(object);
    this.obstacles.push(obstacle);
    return obstacle;
  }

  private addObstacleBox(size: THREE.Vector3, center: THREE.Vector3): void {
    const half = size.clone().multiplyScalar(0.5);
    this.obstacles.push(new THREE.Box3(center.clone().sub(half), center.clone().add(half)));
  }
}
