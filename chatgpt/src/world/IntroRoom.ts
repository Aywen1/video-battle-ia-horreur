import * as THREE from 'three';
import type { AdminCondition } from '../core/AdminTypes';
import { AudioSystem } from '../core/AudioSystem';
import { InteractionSystem, type Interactable } from '../interactions/InteractionSystem';
import { createMaterials } from './Materials';
import { createBed, createBox, createMannequin, createPaperLabel, createPriceTag, createWardrobe } from './GeometryFactory';

export class IntroRoom {
  readonly obstacles: THREE.Box3[] = [];
  readonly interactables: Interactable[] = [];
  private readonly group = new THREE.Group();
  private readonly materials = createMaterials();
  private readonly neonLight = new THREE.PointLight(0xb9d4ff, 4.4, 13.5, 1.35);
  private readonly lampLight = new THREE.PointLight(0xffb86a, 3.2, 7.2, 1.65);
  private readonly doorGlow = new THREE.PointLight(0x50ffd0, 1.55, 3.8, 2.2);
  private readonly mannequin = createMannequin(this.materials);
  private readonly hangingTags: THREE.Object3D[] = [];
  private door?: THREE.Mesh;
  private doorObstacle?: THREE.Box3;
  private lampOn = true;
  private noticeRead = false;
  private lampTurnedOffAfterNotice = false;
  private anomalyArmed = false;
  private anomalyTriggered = false;
  private doorUnlocked = false;
  private doorOpening = false;
  private exitRequested = false;
  private currentCamera?: THREE.Camera;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly audio: AudioSystem,
    private readonly interactions: InteractionSystem,
  ) {
    this.group.name = 'Chambre dEssai 17';
    this.scene.add(this.group);
    this.scene.fog = new THREE.FogExp2(0x20232d, 0.024);

    this.buildShell();
    this.buildFurniture();
    this.buildAnimatedDecor();
    this.buildLighting();
    this.buildInteractions();
  }

  update(delta: number, elapsed: number, camera: THREE.Camera): void {
    this.currentCamera = camera;
    const nervousFlicker = Math.sin(elapsed * 18) > 0.92 ? 0.45 : 1;
    this.neonLight.intensity = 3.65 + Math.sin(elapsed * 3.7) * 0.22 * nervousFlicker;
    this.doorGlow.intensity = 1.4 + Math.sin(elapsed * 2.1) * 0.45;

    if (this.lampOn) {
      this.lampLight.intensity = 2.25 + Math.sin(elapsed * 5.1) * 0.06;
    }

    if (this.anomalyArmed && !this.anomalyTriggered && !this.cameraSeesMannequin(camera)) {
      this.anomalyTriggered = true;
      window.setTimeout(() => {
        this.mannequin.position.set(-2.18, 0, 2.38);
        this.mannequin.rotation.y = Math.PI * 0.92;
        this.audio.playMannequinMove(this.mannequin.position);
        this.audio.playBehindWhisper(camera);
        this.interactions.showMessage('Quelque chose a changé dans la chambre.', 3200);
      }, 850);
    }

    this.mannequin.rotation.z = THREE.MathUtils.lerp(this.mannequin.rotation.z, this.anomalyTriggered ? -0.07 : 0, delta * 1.5);
    for (let i = 0; i < this.hangingTags.length; i += 1) {
      const tag = this.hangingTags[i];
      tag.rotation.z = Math.sin(elapsed * 2.1 + i) * 0.08;
      tag.position.y += Math.sin(elapsed * 3.2 + i) * 0.0008;
    }

    if (this.doorOpening && this.door) {
      this.door.rotation.y = THREE.MathUtils.lerp(this.door.rotation.y, -Math.PI * 0.58, delta * 1.8);
      this.door.position.x = THREE.MathUtils.lerp(this.door.position.x, -0.44, delta * 1.4);
      this.doorGlow.intensity = THREE.MathUtils.lerp(this.doorGlow.intensity, 4.8, delta * 2.2);
    }
  }

  consumeExitRequest(): boolean {
    if (!this.exitRequested) {
      return false;
    }

    this.exitRequested = false;
    return true;
  }

  getAdminConditions(): AdminCondition[] {
    return [
      {
        id: 'intro-notice',
        label: '1. Chambre 17 : notice lue',
        checked: this.noticeRead,
        apply: () => {
          this.noticeRead = true;
          this.anomalyArmed = true;
        },
      },
      {
        id: 'intro-lamp',
        label: '2. Chambre 17 : lampe éteinte après lecture',
        checked: this.lampTurnedOffAfterNotice,
        apply: () => {
          this.noticeRead = true;
          this.lampOn = false;
          this.lampTurnedOffAfterNotice = true;
          this.lampLight.intensity = 0;
        },
      },
      {
        id: 'intro-door',
        label: '3. Chambre 17 : sortie ouverte',
        checked: this.doorUnlocked,
        apply: () => {
          this.noticeRead = true;
          this.lampTurnedOffAfterNotice = true;
          this.openDoor();
        },
      },
    ];
  }

  private buildShell(): void {
    const floor = createBox('sol showroom', new THREE.Vector3(8.6, 0.18, 10.4), new THREE.Vector3(0, -0.09, 0), this.materials.floor);
    const ceiling = createBox('plafond noir', new THREE.Vector3(8.6, 0.22, 10.4), new THREE.Vector3(0, 3.15, 0), this.materials.ceiling);
    const backWallLeft = createBox('mur fond gauche', new THREE.Vector3(3.25, 3.2, 0.28), new THREE.Vector3(-2.68, 1.55, -5.2), this.materials.wall);
    const backWallRight = createBox('mur fond droit', new THREE.Vector3(3.25, 3.2, 0.28), new THREE.Vector3(2.68, 1.55, -5.2), this.materials.wall);
    const backWallTop = createBox('linteau sortie', new THREE.Vector3(1.5, 0.64, 0.28), new THREE.Vector3(0, 2.86, -5.2), this.materials.wall);
    const frontWallLeft = createBox('mur entree gauche', new THREE.Vector3(3.25, 3.2, 0.28), new THREE.Vector3(-2.68, 1.55, 5.2), this.materials.wall);
    const frontWallRight = createBox('mur entree droit', new THREE.Vector3(3.25, 3.2, 0.28), new THREE.Vector3(2.68, 1.55, 5.2), this.materials.wall);
    const leftWall = createBox('mur gauche', new THREE.Vector3(0.28, 3.2, 10.4), new THREE.Vector3(-4.3, 1.55, 0), this.materials.wall);
    const rightWall = createBox('mur droit', new THREE.Vector3(0.28, 3.2, 10.4), new THREE.Vector3(4.3, 1.55, 0), this.materials.wall);
    const door = createBox('porte de sortie verrouillée', new THREE.Vector3(1.48, 2.42, 0.16), new THREE.Vector3(0, 1.18, -5.05), this.materials.black);
    const underDoorGlow = createBox('lueur sous la porte', new THREE.Vector3(1.2, 0.04, 0.04), new THREE.Vector3(0, 0.08, -4.93), this.materials.supernatural);
    this.door = door;

    this.group.add(floor, ceiling, backWallLeft, backWallRight, backWallTop, frontWallLeft, frontWallRight, leftWall, rightWall, door, underDoorGlow);
    [backWallLeft, backWallRight, backWallTop, frontWallLeft, frontWallRight, leftWall, rightWall].forEach((object) => this.addObstacle(object));
    this.doorObstacle = this.addObstacle(door);

    const label = createPaperLabel("CHAMBRE D'ESSAI 17", this.materials.sign);
    label.position.set(0, 2.48, -4.88);
    this.group.add(label);
  }

  private buildFurniture(): void {
    const bed = createBed(this.materials);
    bed.position.set(0.35, 0, -1.25);
    bed.rotation.y = -0.04;
    this.group.add(bed);
    this.addObstacle(bed);
    const bedPrice = createPriceTag('-70%');
    bedPrice.position.set(-0.92, 1.28, -0.08);
    bedPrice.rotation.y = -0.04;
    this.group.add(bedPrice);

    const wardrobe = createWardrobe(this.materials);
    wardrobe.position.set(3.23, 0, -1.15);
    wardrobe.rotation.y = Math.PI / 2;
    this.group.add(wardrobe);
    this.addObstacle(wardrobe);
    const wardrobePrice = createPriceTag('129€');
    wardrobePrice.position.set(2.82, 1.58, -1.15);
    wardrobePrice.rotation.y = -Math.PI / 2;
    this.group.add(wardrobePrice);

    const nightstand = createBox('table de chevet', new THREE.Vector3(0.72, 0.58, 0.68), new THREE.Vector3(-1.55, 0.29, -0.1), this.materials.wood);
    const lampBase = createBox('base lampe', new THREE.Vector3(0.24, 0.14, 0.24), new THREE.Vector3(-1.55, 0.66, -0.1), this.materials.metal);
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.42, 5, 1, true), this.materials.sign);
    lampShade.name = 'abat-jour';
    lampShade.position.set(-1.55, 0.98, -0.1);
    lampShade.castShadow = true;
    lampShade.receiveShadow = true;
    this.group.add(nightstand, lampBase, lampShade);
    this.addObstacle(nightstand);

    const mirror = createBox('miroir voile', new THREE.Vector3(1.18, 1.84, 0.06), new THREE.Vector3(-4.12, 1.48, -2.78), this.materials.mirror);
    mirror.rotation.y = Math.PI / 2;
    this.group.add(mirror);

    this.mannequin.position.set(-3.14, 0, 1.18);
    this.mannequin.rotation.y = Math.PI * 0.24;
    this.group.add(this.mannequin);
    this.addObstacle(this.mannequin);

    const noticeBack = createBox('support notice', new THREE.Vector3(0.04, 0.66, 1.92), new THREE.Vector3(4.12, 1.42, 1.55), this.materials.wood);
    const notice = createPaperLabel('NOTICE : ÉTEINDRE SI HABITÉE', this.materials.sign);
    notice.name = 'notice de montage impossible';
    notice.position.set(4.085, 1.42, 1.55);
    notice.rotation.y = -Math.PI / 2;
    notice.scale.set(1.12, 1.12, 1.12);
    this.group.add(noticeBack, notice);

    const exitArrow = createPaperLabel('SORTIE APRÈS CORRECTION', this.materials.sign);
    exitArrow.position.set(2.85, 1.42, -4.9);
    exitArrow.scale.set(0.78, 0.78, 0.78);
    this.group.add(exitArrow);
  }

  private buildAnimatedDecor(): void {
    for (let i = 0; i < 4; i += 1) {
      const cord = createBox('fil étiquette suspendue chambre', new THREE.Vector3(0.018, 0.58, 0.018), new THREE.Vector3(-2.2 + i * 1.35, 2.52, 2.25 - i * 0.75), this.materials.black);
      const tag = createPriceTag(i % 2 === 0 ? 'VENDU' : '17€');
      tag.name = 'étiquette suspendue chambre';
      tag.position.set(cord.position.x, 2.18, cord.position.z);
      tag.scale.set(0.58, 0.58, 0.58);
      this.hangingTags.push(tag);
      this.group.add(cord, tag);
    }

    const crackedFrame = createBox('cadre photo sans visage', new THREE.Vector3(0.08, 0.75, 1.05), new THREE.Vector3(-4.12, 1.75, 2.1), this.materials.wood);
    crackedFrame.rotation.y = Math.PI / 2;
    this.group.add(crackedFrame);
  }

  private buildLighting(): void {
    const ambient = new THREE.HemisphereLight(0x9aa8bd, 0x30241b, 1.08);
    const showroomFill = new THREE.PointLight(0x91a7c8, 1.55, 12, 1.8);
    const neonCase = createBox('caisson neon', new THREE.Vector3(3.8, 0.08, 0.22), new THREE.Vector3(0, 3.02, 1.15), this.materials.metal);
    const neonTube = createBox('tube neon', new THREE.Vector3(3.55, 0.05, 0.08), new THREE.Vector3(0, 2.95, 1.15), this.materials.supernatural);

    this.neonLight.position.set(0, 2.72, 1.05);
    this.lampLight.position.set(-1.55, 1.16, -0.1);
    this.doorGlow.position.set(0, 0.28, -4.62);
    showroomFill.position.set(0.4, 2.25, 2.6);

    this.scene.add(ambient);
    this.group.add(neonCase, neonTube, this.neonLight, this.lampLight, this.doorGlow, showroomFill);
  }

  private buildInteractions(): void {
    const lampPosition = new THREE.Vector3(-1.55, 1, -0.1);
    const doorPosition = new THREE.Vector3(0, 1, -4.7);
    const notice = this.group.getObjectByName('notice de montage impossible');
    const door = this.group.getObjectByName('porte de sortie verrouillée');
    const lamp = this.group.getObjectByName('abat-jour');

    if (notice) {
      this.interactables.push({
        object: notice,
        label: 'Lire la notice',
        maxDistance: 2.2,
        onInteract: () => {
          this.noticeRead = true;
          this.anomalyArmed = true;
          this.interactions.showMessage([
            '"Si une chambre semble habitée, éteignez la lumière avant de sortir."',
            'La phrase est imprimée par-dessus une autre consigne, plus ancienne.',
            '"Ne laissez jamais le mannequin apprendre votre posture."',
          ]);
          this.audio.playKnock(new THREE.Vector3(3.7, 1.4, 2.8));
        },
      });
    }

    if (lamp) {
      this.interactables.push({
        object: lamp,
        label: 'Actionner la lampe',
        maxDistance: 2.1,
        onInteract: () => {
          this.lampOn = !this.lampOn;
          this.lampLight.intensity = this.lampOn ? 2 : 0;
          if (!this.lampOn && this.noticeRead) {
            this.lampTurnedOffAfterNotice = true;
          }
          this.audio.playLampClick(lampPosition);
          this.interactions.showMessage(this.lampOn ? 'La chaleur revient. Trop vite.' : 'La chambre paraît moins vide dans le noir.');
        },
      });
    }

    if (door) {
      this.interactables.push({
        object: door,
        label: 'Forcer la sortie',
        maxDistance: 2.5,
        onInteract: () => {
          this.audio.playDoorRattle(doorPosition);
          if (this.canOpenDoor()) {
            this.openDoor();
            return;
          }

          const message = this.getDoorLockedMessage();
          this.interactions.showMessage(message);
        },
      });
    }
  }

  private canOpenDoor(): boolean {
    return this.noticeRead && this.lampTurnedOffAfterNotice;
  }

  private getDoorLockedMessage(): string[] {
    if (!this.noticeRead) {
      return ["La porte est verrouillée de l'autre côté.", 'Il doit y avoir une consigne dans la chambre.'];
    }

    if (!this.lampTurnedOffAfterNotice) {
      return ['La poignée tourne seule, puis se bloque.', 'La règle disait : éteignez la lumière avant de sortir.'];
    }

    return ['La poignée résiste encore.', 'Quelque chose bloque dans le bois. Réessaie.'];
  }

  private openDoor(): void {
    if (this.doorUnlocked) {
      this.exitRequested = true;
      return;
    }

    this.doorUnlocked = true;
    this.doorOpening = true;
    this.exitRequested = true;

    if (this.doorObstacle) {
      const index = this.obstacles.indexOf(this.doorObstacle);
      if (index >= 0) {
        this.obstacles.splice(index, 1);
      }
    }

    if (this.currentCamera) {
      this.audio.playBehindWhisper(this.currentCamera);
    }
    this.interactions.showMessage(['La serrure cède sans bruit.', 'Le magasin continue derrière la chambre.']);
  }

  private addObstacle(object: THREE.Object3D): THREE.Box3 {
    object.updateWorldMatrix(true, true);
    const obstacle = new THREE.Box3().setFromObject(object);
    this.obstacles.push(obstacle);
    return obstacle;
  }

  private cameraSeesMannequin(camera: THREE.Camera): boolean {
    const cameraDirection = new THREE.Vector3();
    const toMannequin = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    this.mannequin.getWorldPosition(toMannequin);
    toMannequin.sub(camera.position).normalize();
    return cameraDirection.dot(toMannequin) > 0.35;
  }
}
