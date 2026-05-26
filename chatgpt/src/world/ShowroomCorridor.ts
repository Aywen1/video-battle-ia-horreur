import * as THREE from 'three';
import type { AdminCondition } from '../core/AdminTypes';
import { AudioSystem } from '../core/AudioSystem';
import { InteractionSystem, type Interactable } from '../interactions/InteractionSystem';
import { createBed, createBox, createMannequin, createPaperLabel, createPriceTag, createWardrobe, updatePriceTag } from './GeometryFactory';
import { createMaterials } from './Materials';

type PriceKind = 'lit' | 'armoire' | 'table';

type PriceObjective = {
  kind: PriceKind;
  mesh: THREE.Mesh;
  correctText: string;
  solved: boolean;
};

export class ShowroomCorridor {
  readonly obstacles: THREE.Box3[] = [];
  readonly interactables: Interactable[] = [];
  private readonly group = new THREE.Group();
  private readonly materials = createMaterials();
  private readonly farFigure = createMannequin(this.materials);
  private readonly lights: THREE.PointLight[] = [];
  private readonly ceilingFlicker = new THREE.PointLight(0xf4fbff, 18, 22, 1);
  private readonly ceilingPanel = createBox('grand plafonnier couloir', new THREE.Vector3(3.7, 0.06, 3.4), new THREE.Vector3(0, 3.02, -8.6), this.materials.supernatural);
  private readonly corridorFill = new THREE.HemisphereLight(0xffffff, 0x6d5140, 2.35);
  private readonly priceObjectives: PriceObjective[] = [];
  private readonly movingWardrobes: THREE.Group[] = [];
  private readonly wardrobeDoorPivots: THREE.Group[] = [];
  private readonly swingingSigns: THREE.Object3D[] = [];
  private readonly expectedOrder: PriceKind[] = ['lit', 'armoire', 'table'];
  private endDoor?: THREE.Mesh;
  private endDoorObstacle?: THREE.Box3;
  private reserveBuilt = false;
  private currentCamera?: THREE.Camera;
  private figureBehind = false;
  private solvedCount = 0;
  private endDoorOpen = false;
  private publicStoreRequested = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly audio: AudioSystem,
    private readonly interactions: InteractionSystem,
  ) {
    this.group.name = 'Couloir showroom';
    this.scene.add(this.group);
    this.buildShell();
    this.buildDisplays();
    this.buildAnimatedDecor();
    this.buildLights();
    this.buildInteractions();
    this.interactions.showMessage(['Rayon chambres : liquidation finale.', 'Corrige les prix dans l’ordre : lit, armoire, table.']);
  }

  getAdminConditions(): AdminCondition[] {
    return [
      {
        id: 'corridor-lit',
        label: '4. Couloir : prix du lit corrigé',
        checked: this.isPriceSolved('lit'),
        apply: () => this.adminSolvePrice('lit'),
      },
      {
        id: 'corridor-armoire',
        label: '5. Couloir : prix de l’armoire corrigé',
        checked: this.isPriceSolved('armoire'),
        apply: () => this.adminSolvePrice('armoire'),
      },
      {
        id: 'corridor-table',
        label: '6. Couloir : prix de la table corrigé',
        checked: this.isPriceSolved('table'),
        apply: () => this.adminSolvePrice('table'),
      },
      {
        id: 'corridor-reserve',
        label: '7. Couloir : réserve déverrouillée',
        checked: this.reserveBuilt,
        apply: () => {
          this.adminSolvePrice('lit');
          this.adminSolvePrice('armoire');
          this.adminSolvePrice('table');
          this.unlockReserveDoor();
        },
      },
      {
        id: 'corridor-reserve-open',
        label: '8. Couloir : porte de réserve ouverte',
        checked: this.endDoorOpen,
        apply: () => {
          this.adminSolvePrice('lit');
          this.adminSolvePrice('armoire');
          this.adminSolvePrice('table');
          this.unlockReserveDoor();
          this.openReserveDoor();
        },
      },
    ];
  }

  consumePublicStoreRequest(): boolean {
    if (!this.publicStoreRequested) {
      return false;
    }

    this.publicStoreRequested = false;
    return true;
  }

  update(delta: number, elapsed: number, camera: THREE.Camera): void {
    this.currentCamera = camera;
    const hardBlink = Math.sin(elapsed * 19) > 0.86 ? 0.68 : 1;
    const softPulse = 16 + Math.sin(elapsed * 3.4) * 1.8;
    this.ceilingFlicker.intensity = THREE.MathUtils.lerp(this.ceilingFlicker.intensity, softPulse * hardBlink, delta * 12);
    this.ceilingPanel.visible = hardBlink > 0.4;

    for (let i = 0; i < this.lights.length; i += 1) {
      const light = this.lights[i];
      const flicker = Math.sin(elapsed * (7 + i * 1.3)) > 0.93 ? 0.72 : 1;
      light.intensity = THREE.MathUtils.lerp(light.intensity, (7.4 + Math.sin(elapsed * 2 + i) * 0.42) * flicker, delta * 8);
    }

    if (this.solvedCount >= 2) {
      for (let i = 0; i < this.movingWardrobes.length; i += 1) {
        const wardrobe = this.movingWardrobes[i];
        wardrobe.rotation.z = THREE.MathUtils.lerp(wardrobe.rotation.z, i % 2 === 0 ? 0.025 : -0.025, delta * 2.5);
      }

      for (let i = 0; i < this.wardrobeDoorPivots.length; i += 1) {
        const pivot = this.wardrobeDoorPivots[i];
        const side = pivot.name.includes('gauche') ? 1 : -1;
        const target = side * (0.55 + (i % 3) * 0.08);
        pivot.rotation.y = THREE.MathUtils.lerp(pivot.rotation.y, target, delta * 2.8);
      }
    }

    if (this.figureBehind) {
      this.farFigure.rotation.z = Math.sin(elapsed * 8) * 0.025;
    }

    for (let i = 0; i < this.swingingSigns.length; i += 1) {
      const sign = this.swingingSigns[i];
      sign.rotation.z = Math.sin(elapsed * 2.6 + i * 0.8) * 0.09;
    }

    if (this.endDoorOpen && this.endDoor) {
      this.endDoor.rotation.y = THREE.MathUtils.lerp(this.endDoor.rotation.y, Math.PI * 0.54, delta * 1.9);
      this.endDoor.position.x = THREE.MathUtils.lerp(this.endDoor.position.x, 0.54, delta * 1.5);
    }
  }

  private buildShell(): void {
    const floor = createBox('sol couloir showroom', new THREE.Vector3(5.2, 0.18, 17), new THREE.Vector3(0, -0.09, -13), this.materials.floor);
    const ceiling = createBox('plafond couloir', new THREE.Vector3(4.2, 0.22, 17), new THREE.Vector3(0, 3.15, -13), this.materials.ceiling);
    const leftWall = createBox('mur gauche couloir', new THREE.Vector3(0.26, 3.2, 17), new THREE.Vector3(-2.6, 1.55, -13), this.materials.wall);
    const rightWall = createBox('mur droit couloir', new THREE.Vector3(0.26, 3.2, 17), new THREE.Vector3(2.6, 1.55, -13), this.materials.wall);
    const endWall = createBox('porte réserve fond couloir', new THREE.Vector3(4.2, 3.2, 0.26), new THREE.Vector3(0, 1.55, -21.5), this.materials.black);
    const endGlow = createBox('fente lumineuse fond couloir', new THREE.Vector3(1.2, 0.04, 0.04), new THREE.Vector3(0, 0.08, -21.35), this.materials.supernatural);
    this.endDoor = endWall;

    this.group.add(floor, ceiling, leftWall, rightWall, endWall, endGlow);
    [leftWall, rightWall].forEach((object) => this.addObstacle(object));
    this.endDoorObstacle = this.addObstacle(endWall);

    const sign = createPaperLabel('CORRIGER PRIX : LIT > ARMOIRE > TABLE', this.materials.sign);
    sign.position.set(0, 2.54, -7.4);
    sign.rotation.x = 0;
    sign.scale.set(1.62, 1.18, 1.18);
    this.group.add(sign);
  }

  private buildDisplays(): void {
    const bedDisplay = createBed(this.materials);
    bedDisplay.scale.set(0.56, 0.56, 0.56);
    bedDisplay.position.set(0, 0, -7.05);
    bedDisplay.rotation.y = Math.PI / 2;
    this.group.add(bedDisplay);
    this.createInteractivePriceTag('lit', 'TA CHAMBRE', '399€', new THREE.Vector3(-0.72, 1.02, -7.05), 0);

    for (let i = 0; i < 4; i += 1) {
      const z = -8.2 - i * 3.1;
      const leftModule = createWardrobe(this.materials);
      leftModule.position.set(-2.22, 0, z);
      leftModule.rotation.y = -Math.PI / 2;
      this.group.add(leftModule);
      this.movingWardrobes.push(leftModule);
      this.collectWardrobeDoors(leftModule);
      this.addObstacleBox(new THREE.Vector3(0.58, 2.35, 1.18), new THREE.Vector3(-2.28, 1.18, z));
      if (i === 0) {
        this.createInteractivePriceTag('armoire', '17€', '129€', new THREE.Vector3(-1.83, 1.5, z), Math.PI / 2);
      } else {
        this.createDecorPriceTag(i % 2 === 0 ? '89€' : '-50%', new THREE.Vector3(-1.83, 1.5, z), Math.PI / 2);
      }

      const rightModule = createWardrobe(this.materials);
      rightModule.position.set(2.22, 0, z - 1.1);
      rightModule.rotation.y = Math.PI / 2;
      this.group.add(rightModule);
      this.movingWardrobes.push(rightModule);
      this.collectWardrobeDoors(rightModule);
      this.addObstacleBox(new THREE.Vector3(0.58, 2.35, 1.18), new THREE.Vector3(2.28, 1.18, z - 1.1));
      this.createDecorPriceTag(i % 2 === 0 ? '149€' : '-30%', new THREE.Vector3(1.83, 1.5, z - 1.1), -Math.PI / 2);

      const lowTable = createBox('table basse showroom', new THREE.Vector3(0.9, 0.34, 0.42), new THREE.Vector3(i % 2 === 0 ? 0.58 : -0.58, 0.17, z - 0.55), this.materials.wood);
      this.group.add(lowTable);
      if (i === 1) {
        this.createInteractivePriceTag('table', 'DÉJÀ VENDU', '49€', new THREE.Vector3(lowTable.position.x, 0.62, lowTable.position.z - 0.24), 0);
      }
    }

    this.farFigure.position.set(0, 0, -19.4);
    this.farFigure.rotation.y = Math.PI;
    this.farFigure.scale.set(0.92, 0.92, 0.92);
    this.group.add(this.farFigure);
  }

  private buildAnimatedDecor(): void {
    for (let i = 0; i < 5; i += 1) {
      const rail = createBox('rail promo suspendu couloir', new THREE.Vector3(0.04, 0.04, 1.1), new THREE.Vector3(0, 2.42, -7.5 - i * 2.7), this.materials.metal);
      const sign = createPaperLabel(i % 2 === 0 ? 'LIQUIDATION' : 'NE PAS MESURER', this.materials.sign);
      sign.name = 'panneau suspendu couloir';
      sign.position.set(0, 2.08, -7.5 - i * 2.7);
      sign.scale.set(0.58, 0.58, 0.58);
      this.swingingSigns.push(sign);
      this.group.add(rail, sign);
    }

    for (let i = 0; i < 6; i += 1) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.07, 8), this.materials.metal);
      wheel.name = 'roulette meuble couloir';
      wheel.position.set(i % 2 === 0 ? -1.1 : 1.1, 0.12, -8.8 - i * 1.8);
      wheel.rotation.z = Math.PI / 2;
      this.group.add(wheel);
    }
  }

  private buildLights(): void {
    for (let i = 0; i < 4; i += 1) {
      const z = -7.2 - i * 4;
      const tube = createBox('tube néon couloir', new THREE.Vector3(1.8, 0.05, 0.08), new THREE.Vector3(0, 2.92, z), this.materials.supernatural);
      const light = new THREE.PointLight(0xb9d4ff, 7.4, 14, 1.05);
      light.position.set(0, 2.55, z);
      this.lights.push(light);
      this.group.add(tube, light);
    }

    this.ceilingFlicker.position.set(0, 2.72, -8.6);
    this.scene.add(this.corridorFill);
    this.group.add(this.ceilingPanel, this.ceilingFlicker);

    const endLight = new THREE.PointLight(0x50ffd0, 4.8, 9, 1.55);
    endLight.position.set(0, 0.8, -20.8);
    this.group.add(endLight);
  }

  private buildInteractions(): void {
    const endWall = this.group.getObjectByName('porte réserve fond couloir');
    if (!endWall) {
      return;
    }

    this.interactables.push({
      object: endWall,
      label: 'Ouvrir / inspecter la réserve',
      maxDistance: 2.6,
      onInteract: () => {
        this.audio.playDoorRattle(new THREE.Vector3(0, 1, -21.3));
        if (this.solvedCount >= this.expectedOrder.length) {
          this.openReserveDoor();
          return;
        }

        this.interactions.showMessage(['La porte de réserve ne réagit pas.', 'Le panneau demande de corriger les prix avant fermeture.']);
      },
    });
  }

  private createDecorPriceTag(text: string, position: THREE.Vector3, rotationY: number): void {
    const tag = createPriceTag(text);
    tag.position.copy(position);
    tag.rotation.y = rotationY;
    tag.renderOrder = 3;
    this.group.add(tag);
  }

  private collectWardrobeDoors(wardrobe: THREE.Group): void {
    const left = wardrobe.getObjectByName('pivot porte gauche armoire');
    const right = wardrobe.getObjectByName('pivot porte droite armoire');
    if (left instanceof THREE.Group) {
      this.wardrobeDoorPivots.push(left);
    }
    if (right instanceof THREE.Group) {
      this.wardrobeDoorPivots.push(right);
    }
  }

  private createInteractivePriceTag(kind: PriceKind, wrongText: string, correctText: string, position: THREE.Vector3, rotationY: number): void {
    const tag = createPriceTag(wrongText);
    tag.position.copy(position);
    tag.rotation.y = rotationY;
    tag.renderOrder = 4;
    this.group.add(tag);

    const objective: PriceObjective = {
      kind,
      mesh: tag,
      correctText,
      solved: false,
    };
    this.priceObjectives.push(objective);

    this.interactables.push({
      object: tag,
      label: `Corriger prix ${kind}`,
      maxDistance: 2.2,
      onInteract: () => this.handlePriceTag(objective),
    });
  }

  private handlePriceTag(objective: PriceObjective): void {
    if (objective.solved) {
      this.audio.playRegisterBeep(objective.mesh.position);
      this.interactions.showMessage('Cette étiquette est déjà corrigée.');
      return;
    }

    const expected = this.expectedOrder[this.solvedCount];
    if (objective.kind !== expected) {
      this.audio.playNeonCrack(objective.mesh.position);
      this.interactions.showMessage([`Mauvais rayon. Le panneau indique : ${expected}.`, 'Le prix rouge semble respirer sous tes doigts.']);
      return;
    }

    objective.solved = true;
    this.solvedCount += 1;
    updatePriceTag(objective.mesh, objective.correctText);
    this.audio.playPriceTagChange(objective.mesh.position);
    this.triggerCorrectionEvent(this.solvedCount);
  }

  private isPriceSolved(kind: PriceKind): boolean {
    return this.priceObjectives.some((objective) => objective.kind === kind && objective.solved);
  }

  private adminSolvePrice(kind: PriceKind): void {
    const objective = this.priceObjectives.find((item) => item.kind === kind);
    if (!objective || objective.solved) {
      return;
    }

    objective.solved = true;
    updatePriceTag(objective.mesh, objective.correctText);
    this.solvedCount = Math.max(this.solvedCount, this.expectedOrder.indexOf(kind) + 1);
  }

  private triggerCorrectionEvent(step: number): void {
    if (step === 1) {
      this.audio.playNeonCrack(new THREE.Vector3(0, 2.8, -8.6));
      window.setTimeout(() => this.audio.playReceiptPrint(new THREE.Vector3(0, 2.6, -8.6)), 150);
      for (const light of this.lights) {
        light.intensity *= 0.35;
      }
      this.interactions.showMessage('Le ticket de caisse imprime quelque part dans le plafond.');
      return;
    }

    if (step === 2) {
      this.audio.playClosetThump(new THREE.Vector3(-2.2, 1.2, -12.2));
      this.interactions.showMessage('Toutes les armoires se sont entrouvertes en même temps.');
      return;
    }

    if (this.currentCamera) {
      this.audio.playBehindWhisper(this.currentCamera);
      this.moveFigureBehindPlayer(this.currentCamera);
    }
    this.unlockReserveDoor();
  }

  private unlockReserveDoor(): void {
    if (this.reserveBuilt) {
      return;
    }

    this.reserveBuilt = true;
    this.buildReservePreview();
  }

  private openReserveDoor(): void {
    if (this.endDoorOpen) {
      return;
    }

    this.endDoorOpen = true;
    if (this.endDoorObstacle) {
      const index = this.obstacles.indexOf(this.endDoorObstacle);
      if (index >= 0) {
        this.obstacles.splice(index, 1);
      }
    }

    this.audio.playDoorRattle(new THREE.Vector3(0, 1, -21.3));
    this.publicStoreRequested = true;
    this.interactions.showMessage(['La réserve sent le plastique neuf.', 'Quelque chose tape contre les meubles emballés.']);
  }

  private buildReservePreview(): void {
    const reserveFloor = createBox('sol réserve visible', new THREE.Vector3(4.2, 0.16, 5.2), new THREE.Vector3(0, -0.08, -24.4), this.materials.floor);
    const reserveBack = createBox('fond réserve sombre', new THREE.Vector3(4.2, 3.1, 0.24), new THREE.Vector3(0, 1.55, -27.1), this.materials.black);
    const reserveLight = new THREE.PointLight(0xffe1a8, 2.1, 5.5, 1.7);
    reserveLight.position.set(0, 1.8, -24.8);
    this.group.add(reserveFloor, reserveBack, reserveLight);

    for (let i = 0; i < 5; i += 1) {
      const stack = createBox('meuble emballé réserve', new THREE.Vector3(0.55, 1.25 + i * 0.08, 0.42), new THREE.Vector3(-1.4 + i * 0.7, 0.62, -24.2 - (i % 2) * 0.8), this.materials.fabric);
      stack.rotation.y = (i - 2) * 0.08;
      this.group.add(stack);
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

  private moveFigureBehindPlayer(camera: THREE.Camera): void {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const behind = camera.position.clone().add(forward.multiplyScalar(-1.45));
    behind.y = 0;
    behind.x = THREE.MathUtils.clamp(behind.x, -1.2, 1.2);
    behind.z = THREE.MathUtils.clamp(behind.z, -16.8, -7.4);

    this.farFigure.visible = true;
    this.farFigure.position.copy(behind);
    this.farFigure.rotation.y = Math.atan2(camera.position.x - behind.x, camera.position.z - behind.z);
    this.farFigure.scale.set(1.04, 1.04, 1.04);
    this.figureBehind = true;

    window.setTimeout(() => {
      this.farFigure.visible = false;
      this.figureBehind = false;
    }, 3600);
  }
}
