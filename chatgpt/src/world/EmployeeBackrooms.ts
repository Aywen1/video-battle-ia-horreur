import * as THREE from 'three';
import type { AdminCondition } from '../core/AdminTypes';
import { AudioSystem } from '../core/AudioSystem';
import { InteractionSystem, type Interactable } from '../interactions/InteractionSystem';
import { createBox, createMannequin, createPaperLabel } from './GeometryFactory';
import { createMaterials } from './Materials';
import type { WorldZone } from './ZoneTypes';

export class EmployeeBackrooms implements WorldZone {
  readonly obstacles: THREE.Box3[] = [];
  readonly interactables: Interactable[] = [];
  private readonly group = new THREE.Group();
  private readonly materials = createMaterials();
  private readonly badges = new Set<number>();
  private readonly lockers: THREE.Object3D[] = [];
  private readonly hangingDecor: THREE.Object3D[] = [];
  private readonly watcher = createMannequin(this.materials);
  private archiveDoor?: THREE.Mesh;
  private archiveDoorObstacle?: THREE.Box3;
  private archiveRequested = false;
  private archiveDoorOpen = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly audio: AudioSystem,
    private readonly interactions: InteractionSystem,
  ) {
    this.group.name = 'Couloirs employés';
    this.scene.add(this.group);
    this.buildShell();
    this.buildEntranceStairs();
    this.buildLockersAndBadges();
    this.buildCreepyDecor();
    this.buildLights();
    this.buildInteractions();
    this.interactions.showMessage(['Zone employés.', 'Trois badges ouvrent les archives des ventes.']);
  }

  update(delta: number, elapsed: number, camera: THREE.Camera): void {
    for (let i = 0; i < this.lockers.length; i += 1) {
      const locker = this.lockers[i];
      const target = this.badges.size >= 2 ? Math.sin(elapsed * 2 + i) * 0.04 : 0;
      locker.rotation.z = THREE.MathUtils.lerp(locker.rotation.z, target, delta * 2);
    }

    if (this.badges.size >= 1) {
      const direction = camera.position.clone().sub(this.watcher.position);
      this.watcher.rotation.y = Math.atan2(direction.x, direction.z);
      this.watcher.visible = Math.sin(elapsed * 5) > -0.4;
    }

    if (this.archiveDoorOpen && this.archiveDoor) {
      this.archiveDoor.rotation.y = THREE.MathUtils.lerp(this.archiveDoor.rotation.y, Math.PI * 0.52, delta * 1.6);
      this.archiveDoor.position.x = THREE.MathUtils.lerp(this.archiveDoor.position.x, 0.48, delta * 1.3);
    }

    for (let i = 0; i < this.hangingDecor.length; i += 1) {
      const decor = this.hangingDecor[i];
      decor.rotation.z = Math.sin(elapsed * 2.4 + i * 1.7) * 0.07;
      decor.position.y += Math.sin(elapsed * 3.1 + i) * 0.0009;
    }
  }

  getAdminConditions(): AdminCondition[] {
    return [
      { id: 'backrooms-badge-1', label: '16. Backrooms : badge 1 récupéré', checked: this.badges.has(1), apply: () => this.collectBadge(1, true) },
      { id: 'backrooms-badge-2', label: '17. Backrooms : badge 2 récupéré', checked: this.badges.has(2), apply: () => this.collectBadge(2, true) },
      { id: 'backrooms-badge-3', label: '18. Backrooms : badge 3 récupéré', checked: this.badges.has(3), apply: () => this.collectBadge(3, true) },
      {
        id: 'backrooms-archive-open',
        label: '19. Backrooms : archives ouvertes',
        checked: this.archiveDoorOpen,
        apply: () => {
          this.collectBadge(1, true);
          this.collectBadge(2, true);
          this.collectBadge(3, true);
          this.openArchiveDoor();
        },
      },
    ];
  }

  consumeArchiveRequest(): boolean {
    if (!this.archiveRequested) {
      return false;
    }
    this.archiveRequested = false;
    return true;
  }

  private buildShell(): void {
    const floor = createBox('sol backrooms', new THREE.Vector3(5, 0.16, 16), new THREE.Vector3(0, -0.08, -51), this.materials.floor);
    const ceiling = createBox('plafond bas backrooms', new THREE.Vector3(5, 0.18, 16), new THREE.Vector3(0, 2.75, -51), this.materials.ceiling);
    const leftWall = createBox('mur métallique gauche backrooms', new THREE.Vector3(0.22, 2.9, 16), new THREE.Vector3(-2.5, 1.38, -51), this.materials.metal);
    const rightWall = createBox('mur métallique droit backrooms', new THREE.Vector3(0.22, 2.9, 16), new THREE.Vector3(2.5, 1.38, -51), this.materials.metal);
    const endWallLeft = createBox('mur archives gauche backrooms', new THREE.Vector3(1.55, 2.9, 0.22), new THREE.Vector3(-1.72, 1.38, -59), this.materials.metal);
    const endWallRight = createBox('mur archives droit backrooms', new THREE.Vector3(1.55, 2.9, 0.22), new THREE.Vector3(1.72, 1.38, -59), this.materials.metal);
    const endWallTop = createBox('linteau archives backrooms', new THREE.Vector3(1.65, 0.62, 0.22), new THREE.Vector3(0, 2.6, -59), this.materials.metal);
    const archiveDoor = createBox('porte archives', new THREE.Vector3(1.4, 2.35, 0.16), new THREE.Vector3(0, 1.12, -58.9), this.materials.black);
    const archivePortal = createBox('passage sombre archives', new THREE.Vector3(1.34, 2.3, 0.08), new THREE.Vector3(0, 1.14, -59.14), this.materials.black);
    const connectorFloor = createBox('seuil archives backrooms', new THREE.Vector3(1.42, 0.08, 1.1), new THREE.Vector3(0, -0.04, -59.48), this.materials.floor);
    this.archiveDoor = archiveDoor;

    this.group.add(floor, ceiling, leftWall, rightWall, endWallLeft, endWallRight, endWallTop, archivePortal, connectorFloor, archiveDoor);
    [leftWall, rightWall, endWallLeft, endWallRight, endWallTop].forEach((object) => this.addObstacle(object));
    this.archiveDoorObstacle = this.addObstacle(archiveDoor);

    const sign = createPaperLabel('PERSONNEL UNIQUEMENT', this.materials.sign);
    sign.position.set(0, 2.22, -58.78);
    this.group.add(sign);
  }

  private buildEntranceStairs(): void {
    const stairMaterial = new THREE.MeshStandardMaterial({ color: 0x3f454c, metalness: 0.45, roughness: 0.58, flatShading: true });
    for (let i = 0; i < 7; i += 1) {
      const step = createBox(
        'marche escalier employés',
        new THREE.Vector3(2.05, 0.09 + i * 0.018, 0.46),
        new THREE.Vector3(0, 0.02 + i * 0.045, -43.35 - i * 0.43),
        stairMaterial,
      );
      this.group.add(step);
    }

    const handrailLeft = createBox('rampe gauche escalier employés', new THREE.Vector3(0.08, 0.08, 3.2), new THREE.Vector3(-1.25, 0.82, -44.75), this.materials.metal);
    const handrailRight = createBox('rampe droite escalier employés', new THREE.Vector3(0.08, 0.08, 3.2), new THREE.Vector3(1.25, 0.82, -44.75), this.materials.metal);
    const darkOpening = createBox('ombre au sol cage escalier employés', new THREE.Vector3(2.35, 0.025, 3.2), new THREE.Vector3(0, 0.015, -44.75), this.materials.black);
    this.group.add(handrailLeft, handrailRight, darkOpening);
  }

  private buildLockersAndBadges(): void {
    const badgePositions = [
      new THREE.Vector3(-1.7, 1.15, -47.2),
      new THREE.Vector3(1.65, 1.15, -51.3),
      new THREE.Vector3(-1.65, 1.15, -55.4),
    ];

    for (let i = 0; i < 8; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -45.4 - Math.floor(i / 2) * 3.1;
      const locker = createBox('casier employé', new THREE.Vector3(0.55, 1.95, 0.42), new THREE.Vector3(side * 2.14, 0.98, z), this.materials.metal);
      locker.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      this.lockers.push(locker);
      this.group.add(locker);
      this.addObstacleBox(new THREE.Vector3(0.42, 1.9, 0.55), locker.position.clone());
    }

    badgePositions.forEach((position, index) => {
      const badge = this.createBadgeModel(index + 1);
      badge.name = `badge employé ${index + 1}`;
      badge.position.copy(position);
      badge.rotation.y = index === 1 ? -Math.PI / 2 : Math.PI / 2;
      this.group.add(badge);
    });

    this.watcher.position.set(0, 0, -56.6);
    this.watcher.scale.set(0.76, 0.76, 0.76);
    this.watcher.visible = false;
    this.group.add(this.watcher);
  }

  private buildCreepyDecor(): void {
    const blood = new THREE.MeshStandardMaterial({ color: 0x4d0208, emissive: 0x180003, emissiveIntensity: 0.18, roughness: 0.95, flatShading: true });
    const paper = new THREE.MeshStandardMaterial({ color: 0xd8c4a4, roughness: 0.82, flatShading: true, side: THREE.DoubleSide });

    for (let i = 0; i < 9; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const stain = new THREE.Mesh(new THREE.CircleGeometry(0.18 + (i % 3) * 0.08, 7), blood);
      stain.name = 'tache de sang mur backrooms';
      stain.position.set(side * 2.37, 0.7 + (i % 4) * 0.32, -45.3 - i * 1.28);
      stain.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      stain.scale.x = 0.65 + (i % 2) * 0.55;
      this.group.add(stain);
    }

    for (let i = 0; i < 10; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const tear = new THREE.Mesh(new THREE.PlaneGeometry(0.34 + Math.random() * 0.28, 0.16 + Math.random() * 0.34), paper);
      tear.name = 'papier déchiré backrooms';
      tear.position.set(side * 2.36, 1.05 + Math.random() * 1.25, -44.3 - Math.random() * 12.5);
      tear.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      tear.rotation.z = (Math.random() - 0.5) * 0.8;
      this.group.add(tear);
    }

    for (let i = 0; i < 12; i += 1) {
      const panel = createBox(
        'panneau mural métallique arraché',
        new THREE.Vector3(0.035, 0.55 + Math.random() * 0.55, 0.5 + Math.random() * 0.7),
        new THREE.Vector3(i % 2 === 0 ? -2.36 : 2.36, 1 + Math.random() * 1.1, -44.4 - Math.random() * 12.8),
        this.materials.metal,
      );
      panel.rotation.z = (Math.random() - 0.5) * 0.22;
      this.group.add(panel);
    }

    for (let i = 0; i < 5; i += 1) {
      const strip = createBox(
        'lambeau plastique suspendu employés',
        new THREE.Vector3(0.12, 0.65 + Math.random() * 0.5, 0.025),
        new THREE.Vector3(-0.8 + i * 0.4, 2.18, -46.2 - i * 2.2),
        paper,
      );
      strip.rotation.x = (Math.random() - 0.5) * 0.25;
      this.hangingDecor.push(strip);
      this.group.add(strip);
    }
  }

  private createBadgeModel(id: number): THREE.Group {
    const badge = new THREE.Group();
    const badgeMaterial = new THREE.MeshStandardMaterial({ color: 0xcfd6df, metalness: 0.5, roughness: 0.34, flatShading: true });
    const redMaterial = new THREE.MeshStandardMaterial({ color: 0x8e0712, emissive: 0x340004, emissiveIntensity: 0.28, roughness: 0.6, flatShading: true });
    const base = createBox('corps badge employé', new THREE.Vector3(0.46, 0.62, 0.07), new THREE.Vector3(0, 0, 0), badgeMaterial);
    const clip = createBox('clip badge employé', new THREE.Vector3(0.24, 0.08, 0.09), new THREE.Vector3(0, 0.36, 0.02), this.materials.metal);
    const stripe = createBox('bande rouge badge employé', new THREE.Vector3(0.42, 0.1, 0.08), new THREE.Vector3(0, -0.16, 0.04), redMaterial);
    const label = createPaperLabel(`E-${id}`, this.materials.sign);
    label.position.set(0, 0.07, 0.048);
    label.scale.set(0.22, 0.2, 0.2);
    badge.add(base, clip, stripe, label);
    return badge;
  }

  private buildLights(): void {
    for (let i = 0; i < 4; i += 1) {
      const z = -45.6 - i * 3.7;
      const tube = createBox('néon backrooms', new THREE.Vector3(1.9, 0.05, 0.08), new THREE.Vector3(0, 2.55, z), this.materials.supernatural);
      const light = new THREE.PointLight(0xcfe9ff, 6.2, 7.2, 1.35);
      light.position.set(0, 2.35, z);
      this.group.add(tube, light);
    }

    const entranceFill = new THREE.PointLight(0xfff0d0, 2.8, 5.5, 1.6);
    entranceFill.position.set(0, 1.6, -44.2);
    this.group.add(entranceFill);
  }

  private buildInteractions(): void {
    for (let id = 1; id <= 3; id += 1) {
      const badge = this.group.getObjectByName(`badge employé ${id}`);
      if (badge) {
        this.interactables.push({
          object: badge,
          label: `Prendre badge ${id}`,
          maxDistance: 2.3,
          onInteract: () => this.collectBadge(id),
        });
      }
    }

    if (this.archiveDoor) {
      this.interactables.push({
        object: this.archiveDoor,
        label: 'Ouvrir les archives',
        maxDistance: 2.6,
        onInteract: () => {
          if (this.badges.size < 3) {
            this.audio.playDoorRattle(new THREE.Vector3(0, 1, -58.8));
            this.interactions.showMessage(`Accès refusé. Badges employés : ${this.badges.size}/3.`);
            return;
          }
          this.openArchiveDoor();
        },
      });
    }
  }

  private collectBadge(id: number, silent = false): void {
    if (this.badges.has(id)) {
      return;
    }
    this.badges.add(id);
    this.audio.playRegisterBeep(new THREE.Vector3(0, 1, -50));
    const badge = this.group.getObjectByName(`badge employé ${id}`);
    if (badge) {
      badge.visible = false;
    }
    if (!silent) {
      this.interactions.showMessage(`Badge ${id} ajouté au trousseau.`);
    }
  }

  private openArchiveDoor(): void {
    if (this.archiveDoorOpen) {
      this.archiveRequested = true;
      return;
    }
    this.archiveDoorOpen = true;
    this.archiveRequested = true;
    if (this.archiveDoorObstacle) {
      const index = this.obstacles.indexOf(this.archiveDoorObstacle);
      if (index >= 0) {
        this.obstacles.splice(index, 1);
      }
    }
    if (this.archiveDoor) {
      this.archiveDoor.visible = false;
    }
    this.audio.playDoorRattle(new THREE.Vector3(0, 1, -58.8));
    this.interactions.showMessage('Les archives s’ouvrent sur une odeur de papier humide.');
  }

  private addObstacle(object: THREE.Object3D): THREE.Box3 {
    object.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(object);
    this.obstacles.push(box);
    return box;
  }

  private addObstacleBox(size: THREE.Vector3, center: THREE.Vector3): void {
    const half = size.clone().multiplyScalar(0.5);
    this.obstacles.push(new THREE.Box3(center.clone().sub(half), center.clone().add(half)));
  }
}
