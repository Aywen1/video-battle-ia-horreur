import * as THREE from 'three';
import type { AdminCondition } from '../core/AdminTypes';
import { AudioSystem } from '../core/AudioSystem';
import { InteractionSystem, type Interactable } from '../interactions/InteractionSystem';
import { createBox, createMannequin, createPaperLabel } from './GeometryFactory';
import { createMaterials } from './Materials';
import type { WorldZone } from './ZoneTypes';

type FileId = 'room17' | 'occupant' | 'morvant';

export class SalesArchive implements WorldZone {
  readonly obstacles: THREE.Box3[] = [];
  readonly interactables: Interactable[] = [];
  private readonly group = new THREE.Group();
  private readonly materials = createMaterials();
  private readonly filesRead = new Set<FileId>();
  private readonly archiveGhosts: THREE.Object3D[] = [];
  private readonly hangingReceipts: THREE.Object3D[] = [];
  private readonly drawerRows: THREE.Object3D[] = [];
  private assemblyDoor?: THREE.Mesh;
  private assemblyDoorObstacle?: THREE.Box3;
  private assemblyOpen = false;
  private assemblyRequested = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly audio: AudioSystem,
    private readonly interactions: InteractionSystem,
  ) {
    this.group.name = 'Archives des ventes';
    this.scene.add(this.group);
    this.buildRoom();
    this.buildFiles();
    this.buildGhosts();
    this.buildInteractions();
    this.interactions.showMessage(['Archives des ventes Morvant.', 'Chaque dossier décrit une version de toi qui n’a pas quitté le magasin.']);
  }

  update(delta: number, elapsed: number, camera: THREE.Camera): void {
    for (let i = 0; i < this.archiveGhosts.length; i += 1) {
      const ghost = this.archiveGhosts[i];
      ghost.visible = this.filesRead.size > i && Math.sin(elapsed * 6 + i) > -0.2;
      const look = camera.position.clone().sub(ghost.position);
      ghost.rotation.y = Math.atan2(look.x, look.z);
      ghost.position.y = Math.sin(elapsed * 2 + i) * 0.025;
    }

    for (let i = 0; i < this.hangingReceipts.length; i += 1) {
      const receipt = this.hangingReceipts[i];
      receipt.rotation.z = Math.sin(elapsed * 2.2 + i) * 0.09;
      receipt.position.y += Math.sin(elapsed * 3.6 + i * 0.4) * 0.0008;
    }

    for (let i = 0; i < this.drawerRows.length; i += 1) {
      const drawer = this.drawerRows[i];
      drawer.position.x += Math.sin(elapsed * 1.7 + i) * 0.0009;
    }

    if (this.assemblyOpen && this.assemblyDoor) {
      this.assemblyDoor.rotation.y = THREE.MathUtils.lerp(this.assemblyDoor.rotation.y, -Math.PI * 0.55, delta * 1.7);
      this.assemblyDoor.position.x = THREE.MathUtils.lerp(this.assemblyDoor.position.x, -0.52, delta * 1.4);
    }
  }

  getAdminConditions(): AdminCondition[] {
    return [
      { id: 'archive-room17', label: '20. Archives : dossier Chambre 17 lu', checked: this.filesRead.has('room17'), apply: () => this.readFile('room17', true) },
      { id: 'archive-occupant', label: '21. Archives : dossier Occupant lu', checked: this.filesRead.has('occupant'), apply: () => this.readFile('occupant', true) },
      { id: 'archive-morvant', label: '22. Archives : dossier Morvant lu', checked: this.filesRead.has('morvant'), apply: () => this.readFile('morvant', true) },
      {
        id: 'archive-assembly-open',
        label: '23. Archives : salle d’assemblage ouverte',
        checked: this.assemblyOpen,
        apply: () => {
          this.readFile('room17', true);
          this.readFile('occupant', true);
          this.readFile('morvant', true);
          this.openAssemblyDoor();
        },
      },
    ];
  }

  consumeAssemblyRequest(): boolean {
    if (!this.assemblyRequested) {
      return false;
    }
    this.assemblyRequested = false;
    return true;
  }

  private buildRoom(): void {
    const floor = createBox('sol archives', new THREE.Vector3(7, 0.16, 11), new THREE.Vector3(0, -0.08, -66), this.materials.floor);
    const ceiling = createBox('plafond archives', new THREE.Vector3(7, 0.18, 11), new THREE.Vector3(0, 3.15, -66), this.materials.ceiling);
    const leftWall = createBox('mur gauche archives', new THREE.Vector3(0.22, 3.2, 11), new THREE.Vector3(-3.5, 1.55, -66), this.materials.wall);
    const rightWall = createBox('mur droit archives', new THREE.Vector3(0.22, 3.2, 11), new THREE.Vector3(3.5, 1.55, -66), this.materials.wall);
    const backWallLeft = createBox('mur assemblage gauche archives', new THREE.Vector3(2.6, 3.2, 0.22), new THREE.Vector3(-2.2, 1.55, -71.5), this.materials.wall);
    const backWallRight = createBox('mur assemblage droit archives', new THREE.Vector3(2.6, 3.2, 0.22), new THREE.Vector3(2.2, 1.55, -71.5), this.materials.wall);
    const backWallTop = createBox('linteau assemblage archives', new THREE.Vector3(1.7, 0.72, 0.22), new THREE.Vector3(0, 2.75, -71.5), this.materials.wall);
    const assemblyPortal = createBox('passage sombre assemblage', new THREE.Vector3(1.46, 2.35, 0.08), new THREE.Vector3(0, 1.13, -71.66), this.materials.black);
    const connectorFloor = createBox('seuil assemblage archives', new THREE.Vector3(1.55, 0.08, 1), new THREE.Vector3(0, -0.04, -71.9), this.materials.floor);
    const assemblyDoor = createBox('porte salle assemblage', new THREE.Vector3(1.55, 2.45, 0.16), new THREE.Vector3(0, 1.18, -71.38), this.materials.black);
    this.assemblyDoor = assemblyDoor;

    this.group.add(floor, ceiling, leftWall, rightWall, backWallLeft, backWallRight, backWallTop, assemblyPortal, connectorFloor, assemblyDoor);
    [leftWall, rightWall, backWallLeft, backWallRight, backWallTop].forEach((object) => this.addObstacle(object));
    this.assemblyDoorObstacle = this.addObstacle(assemblyDoor);

    for (let i = 0; i < 5; i += 1) {
      const shelf = createBox('étagère archives', new THREE.Vector3(0.58, 2.1, 1.7), new THREE.Vector3(i % 2 === 0 ? -2.8 : 2.8, 1.05, -63.2 - i * 1.3), this.materials.wood);
      shelf.rotation.y = i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
      this.group.add(shelf);
      this.addObstacleBox(new THREE.Vector3(0.7, 2.1, 1.7), shelf.position.clone());
    }

    for (let i = 0; i < 10; i += 1) {
      const drawer = createBox('tiroir archive entrouvert', new THREE.Vector3(0.44, 0.2, 0.42), new THREE.Vector3(i % 2 === 0 ? -2.42 : 2.42, 0.52 + (i % 3) * 0.42, -62.8 - i * 0.8), this.materials.metal);
      drawer.rotation.y = i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
      this.drawerRows.push(drawer);
      this.group.add(drawer);
    }

    for (let i = 0; i < 8; i += 1) {
      const receipt = createPaperLabel(i % 2 === 0 ? 'TICKET NON PAYÉ' : 'CLIENT ABSENT', this.materials.sign);
      receipt.name = 'ticket suspendu archive';
      receipt.position.set(-2.4 + (i % 4) * 1.6, 2.35, -63.2 - Math.floor(i / 4) * 3.2);
      receipt.scale.set(0.34, 0.34, 0.34);
      this.hangingReceipts.push(receipt);
      this.group.add(receipt);
    }

    const light = new THREE.PointLight(0xfff0c8, 4.2, 8, 1.4);
    light.position.set(0, 2.7, -66);
    this.group.add(light);
  }

  private buildFiles(): void {
    const files: Array<[FileId, string, THREE.Vector3]> = [
      ['room17', 'DOSSIER CHAMBRE 17', new THREE.Vector3(-1.7, 0.78, -64)],
      ['occupant', 'DOSSIER OCCUPANT', new THREE.Vector3(1.7, 0.78, -66.2)],
      ['morvant', 'DOSSIER MORVANT', new THREE.Vector3(-1.7, 0.78, -68.4)],
    ];

    for (const [id, label, position] of files) {
      const table = createBox(`table dossier ${id}`, new THREE.Vector3(1.55, 0.58, 0.9), new THREE.Vector3(position.x, 0.29, position.z), this.materials.wood);
      const folderBase = createBox(`chemise archive ${id}`, new THREE.Vector3(1.12, 0.055, 0.66), new THREE.Vector3(position.x, 0.61, position.z), this.materials.sign);
      const file = createPaperLabel(label, this.materials.sign);
      file.name = `dossier ${id}`;
      file.position.set(position.x, 0.646, position.z);
      file.rotation.x = -Math.PI / 2;
      file.scale.set(0.7, 0.7, 0.7);
      this.group.add(table, folderBase, file);
      this.addObstacleBox(new THREE.Vector3(1.55, 0.58, 0.9), new THREE.Vector3(position.x, 0.29, position.z));
    }
  }

  private buildGhosts(): void {
    for (let i = 0; i < 3; i += 1) {
      const ghost = createMannequin(this.materials);
      ghost.name = 'double archive';
      ghost.position.set(-1.8 + i * 1.8, 0, -70.2);
      ghost.scale.set(0.68, 0.68, 0.68);
      ghost.visible = false;
      this.archiveGhosts.push(ghost);
      this.group.add(ghost);
    }
  }

  private buildInteractions(): void {
    const texts: Record<FileId, string[]> = {
      room17: [
        'Rapport interne : la Chambre 17 n’est pas une chambre.',
        'C’est un prototype Morvant. Elle observe le visiteur, copie ses habitudes, puis reconstruit une pièce qui ressemble à son souvenir le plus intime.',
        'Quand la pièce devient crédible, le magasin tente de garder la personne à l’intérieur pour l’exposer comme preuve de confort.',
      ],
      occupant: [
        'Fiche produit : Occupant modèle.',
        'Un occupant modèle est un client encore vivant, immobilisé dans une chambre d’exposition.',
        'Il ne parle plus. Il rend simplement la scène plus vraie pour attirer le prochain visiteur.',
      ],
      morvant: [
        'Historique Morvant Meubles.',
        'Le magasin n’a jamais vraiment fermé : il se nourrit des rondes de nuit, des inventaires et des gens qui cherchent une sortie.',
        'Les badges, les prix et les tickets ne sont pas des outils. Ce sont des contrats. Si tu signes, tu deviens un meuble habité.',
      ],
    };

    (Object.keys(texts) as FileId[]).forEach((id) => {
      const file = this.group.getObjectByName(`dossier ${id}`);
      if (file) {
        this.interactables.push({
          object: file,
          label: `Lire ${id}`,
          maxDistance: 2.4,
          onInteract: () => this.readFile(id, false, texts[id]),
        });
      }
    });

    if (this.assemblyDoor) {
      this.interactables.push({
        object: this.assemblyDoor,
        label: 'Ouvrir salle d’assemblage',
        maxDistance: 2.6,
        onInteract: () => {
          if (this.filesRead.size < 3) {
            this.audio.playDoorRattle(new THREE.Vector3(0, 1, -71.2));
            this.interactions.showMessage(`Dossiers lus : ${this.filesRead.size}/3.`);
            return;
          }
          this.openAssemblyDoor();
        },
      });
    }
  }

  private readFile(id: FileId, silent = false, text?: string[]): void {
    if (this.filesRead.has(id)) {
      return;
    }
    this.filesRead.add(id);
    this.audio.playPaperRustle(new THREE.Vector3(0, 1, -66));
    this.audio.playHallucinationAppear(new THREE.Vector3(0, 1, -70));
    if (!silent && text) {
      this.interactions.showMessage(text);
    }
  }

  private openAssemblyDoor(): void {
    if (this.assemblyOpen) {
      this.assemblyRequested = true;
      return;
    }
    this.assemblyOpen = true;
    this.assemblyRequested = true;
    if (this.assemblyDoorObstacle) {
      const index = this.obstacles.indexOf(this.assemblyDoorObstacle);
      if (index >= 0) {
        this.obstacles.splice(index, 1);
      }
    }
    if (this.assemblyDoor) {
      this.assemblyDoor.visible = false;
    }
    this.audio.playDoorRattle(new THREE.Vector3(0, 1, -71.2));
    this.interactions.showMessage('La salle d’assemblage reconnaît ton dossier.');
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
