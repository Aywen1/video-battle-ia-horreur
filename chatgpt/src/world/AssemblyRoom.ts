import * as THREE from 'three';
import type { AdminCondition } from '../core/AdminTypes';
import { AudioSystem } from '../core/AudioSystem';
import { InteractionSystem, type Interactable } from '../interactions/InteractionSystem';
import { createBed, createBox, createMannequin, createPaperLabel, createPriceTag } from './GeometryFactory';
import { createMaterials } from './Materials';
import type { EndingKind, WorldZone } from './ZoneTypes';

export class AssemblyRoom implements WorldZone {
  readonly obstacles: THREE.Box3[] = [];
  readonly interactables: Interactable[] = [];
  private readonly group = new THREE.Group();
  private readonly materials = createMaterials();
  private readonly tags: THREE.Mesh[] = [];
  private readonly fragments: THREE.Mesh[] = [];
  private readonly walls: THREE.Object3D[] = [];
  private readonly ceilingHooks: THREE.Object3D[] = [];
  private destroyedTags = 0;
  private finalChoiceReady = false;
  private ending?: EndingKind;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly audio: AudioSystem,
    private readonly interactions: InteractionSystem,
  ) {
    this.group.name = 'Salle d’assemblage';
    this.scene.add(this.group);
    this.buildRoom();
    this.buildCenterAssembly();
    this.buildAnimatedDecor();
    this.buildFinalTags();
    this.buildChoices();
    this.interactions.showMessage(['Salle d’assemblage.', 'Détruis les étiquettes OCCUPANT MODÈLE avant que la vitrine se referme.']);
  }

  update(delta: number, elapsed: number, _camera: THREE.Camera): void {
    const nightmare = this.destroyedTags / 4;
    for (let i = 0; i < this.walls.length; i += 1) {
      const wall = this.walls[i];
      const pulse = 1 + Math.sin(elapsed * 2.8 + i) * 0.035 * (1 + nightmare * 3);
      wall.scale.set(i < 2 ? pulse : 1, 1 + nightmare * 0.05, i >= 2 ? pulse : 1);
    }

    for (let i = 0; i < this.fragments.length; i += 1) {
      const fragment = this.fragments[i];
      fragment.visible = i < this.destroyedTags * 7 || this.finalChoiceReady;
      fragment.rotation.x += delta * (0.5 + i * 0.01);
      fragment.rotation.y += delta * (0.8 + i * 0.013);
      fragment.position.y += Math.sin(elapsed * 3 + i) * 0.0015;
    }

    for (let i = 0; i < this.ceilingHooks.length; i += 1) {
      const hook = this.ceilingHooks[i];
      hook.rotation.z = Math.sin(elapsed * 2.8 + i) * 0.16 * (0.5 + nightmare);
      hook.position.y = 2.35 + Math.sin(elapsed * 1.9 + i) * 0.04 * (0.4 + nightmare);
    }
  }

  getAdminConditions(): AdminCondition[] {
    return [
      { id: 'assembly-tag-1', label: '24. Assemblage : étiquette 1 détruite', checked: this.destroyedTags >= 1, apply: () => this.forceTags(1) },
      { id: 'assembly-tag-2', label: '25. Assemblage : étiquette 2 détruite', checked: this.destroyedTags >= 2, apply: () => this.forceTags(2) },
      { id: 'assembly-tag-3', label: '26. Assemblage : étiquette 3 détruite', checked: this.destroyedTags >= 3, apply: () => this.forceTags(3) },
      { id: 'assembly-tag-4', label: '27. Assemblage : étiquette 4 détruite', checked: this.destroyedTags >= 4, apply: () => this.forceTags(4) },
      { id: 'ending-refuse', label: '28. Fin : refus de vente choisi', checked: this.ending === 'refuse', apply: () => this.chooseEnding('refuse') },
      { id: 'ending-occupant', label: '29. Fin : occupant modèle choisi', checked: this.ending === 'occupant', apply: () => this.chooseEnding('occupant') },
      { id: 'ending-screen', label: '30. Fin : écran de fin affiché', checked: Boolean(this.ending), apply: () => this.chooseEnding('refuse') },
    ];
  }

  consumeEnding(): EndingKind | undefined {
    const ending = this.ending;
    this.ending = undefined;
    return ending;
  }

  getNightmareIntensity(): number {
    return this.finalChoiceReady ? 1 : this.destroyedTags / 4;
  }

  private buildRoom(): void {
    const floor = createBox('sol assemblage', new THREE.Vector3(10, 0.16, 11), new THREE.Vector3(0, -0.08, -80), this.materials.floor);
    const ceiling = createBox('plafond assemblage descendant', new THREE.Vector3(10, 0.22, 11), new THREE.Vector3(0, 3.25, -80), this.materials.ceiling);
    const leftWall = createBox('mur respirant gauche', new THREE.Vector3(0.24, 3.4, 11), new THREE.Vector3(-5, 1.65, -80), this.materials.wall);
    const rightWall = createBox('mur respirant droit', new THREE.Vector3(0.24, 3.4, 11), new THREE.Vector3(5, 1.65, -80), this.materials.wall);
    const backWall = createBox('mur final assemblage', new THREE.Vector3(10, 3.4, 0.24), new THREE.Vector3(0, 1.65, -85.5), this.materials.black);
    this.walls.push(leftWall, rightWall, backWall, ceiling);
    this.group.add(floor, ceiling, leftWall, rightWall, backWall);
    [leftWall, rightWall, backWall].forEach((object) => this.addObstacle(object));

    const redLight = new THREE.PointLight(0xff3045, 5, 11, 1.4);
    redLight.position.set(0, 2.4, -80);
    const coldLight = new THREE.PointLight(0xcdf3ff, 3.5, 9, 1.7);
    coldLight.position.set(0, 2.9, -75.2);
    this.group.add(redLight, coldLight);
  }

  private buildCenterAssembly(): void {
    const bed = createBed(this.materials);
    bed.scale.set(0.62, 0.62, 0.62);
    bed.position.set(0, 0, -80);
    bed.rotation.y = Math.PI / 2;
    const mannequin = createMannequin(this.materials);
    mannequin.position.set(0, 0.05, -80);
    mannequin.scale.set(1.1, 1.1, 1.1);
    this.group.add(bed, mannequin);

    for (let i = 0; i < 32; i += 1) {
      const fragment = createBox('fragment assemblage', new THREE.Vector3(0.08 + Math.random() * 0.22, 0.05 + Math.random() * 0.2, 0.04), new THREE.Vector3((Math.random() - 0.5) * 7, 0.2 + Math.random() * 2.2, -80 + (Math.random() - 0.5) * 7), this.materials.supernatural);
      fragment.material = new THREE.MeshStandardMaterial({ color: i % 2 ? 0x8f0b16 : 0xf0d2a0, emissive: i % 2 ? 0x4f0005 : 0x2b1a0c, emissiveIntensity: 0.35, roughness: 0.8, flatShading: true });
      fragment.visible = false;
      this.fragments.push(fragment);
      this.group.add(fragment);
    }
  }

  private buildAnimatedDecor(): void {
    for (let i = 0; i < 7; i += 1) {
      const hook = new THREE.Group();
      hook.name = 'crochet plafond assemblage';
      const cable = createBox('câble assemblage', new THREE.Vector3(0.035, 0.72, 0.035), new THREE.Vector3(0, 0.28, 0), this.materials.black);
      const claw = createBox('pince assemblage', new THREE.Vector3(0.34, 0.08, 0.08), new THREE.Vector3(0, -0.1, 0), this.materials.metal);
      hook.add(cable, claw);
      hook.position.set(-3.2 + i * 1.05, 2.35, -76.8 - (i % 3) * 2.2);
      this.ceilingHooks.push(hook);
      this.group.add(hook);
    }
  }

  private buildFinalTags(): void {
    const positions = [
      new THREE.Vector3(-2.8, 1.1, -77.4),
      new THREE.Vector3(2.8, 1.25, -78.4),
      new THREE.Vector3(-2.5, 1.35, -82.1),
      new THREE.Vector3(2.55, 1.1, -83.1),
    ];
    positions.forEach((position, index) => {
      const tag = createPriceTag('OCCUPANT');
      tag.name = `étiquette finale ${index + 1}`;
      tag.position.copy(position);
      tag.rotation.y = index % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
      this.tags.push(tag);
      this.group.add(tag);
      this.interactables.push({
        object: tag,
        label: `Déchirer étiquette ${index + 1}`,
        maxDistance: 2.5,
        onInteract: () => this.destroyTag(index),
      });
    });
  }

  private buildChoices(): void {
    const refuse = createPaperLabel('DÉTRUIRE LE TICKET', this.materials.sign);
    refuse.name = 'choix refus vente';
    refuse.position.set(-1.65, 1.25, -84.9);
    const sign = createPaperLabel('SIGNER OCCUPANT MODÈLE', this.materials.sign);
    sign.name = 'choix occupant modèle';
    sign.position.set(1.65, 1.25, -84.9);
    refuse.visible = false;
    sign.visible = false;
    this.group.add(refuse, sign);

    this.interactables.push(
      { object: refuse, label: 'Refuser la vente', maxDistance: 2.6, onInteract: () => this.chooseEnding('refuse') },
      { object: sign, label: 'Signer le ticket', maxDistance: 2.6, onInteract: () => this.chooseEnding('occupant') },
    );
  }

  private destroyTag(index: number): void {
    const tag = this.tags[index];
    if (!tag.visible) {
      return;
    }
    tag.visible = false;
    this.destroyedTags += 1;
    this.audio.playPriceTagChange(tag.position);
    this.audio.playNeonCrack(tag.position);
    if (this.destroyedTags >= 4) {
      this.prepareFinalChoice();
    } else {
      this.interactions.showMessage(`Étiquette détruite : ${this.destroyedTags}/4.`);
    }
  }

  private forceTags(count: number): void {
    while (this.destroyedTags < count) {
      const tag = this.tags[this.destroyedTags];
      if (tag) {
        tag.visible = false;
      }
      this.destroyedTags += 1;
    }
    if (this.destroyedTags >= 4) {
      this.prepareFinalChoice(true);
    }
  }

  private prepareFinalChoice(silent = false): void {
    if (this.finalChoiceReady) {
      return;
    }
    this.finalChoiceReady = true;
    this.audio.playFullScreenScreamer(new THREE.Vector3(0, 1.5, -80));
    window.dispatchEvent(new CustomEvent('public-store-final-screamer'));
    this.group.getObjectByName('choix refus vente')!.visible = true;
    this.group.getObjectByName('choix occupant modèle')!.visible = true;
    if (!silent) {
      this.interactions.showMessage(['Le magasin a fini l’assemblage.', 'Il ne reste qu’à choisir le prix de sortie.']);
    }
  }

  private chooseEnding(kind: EndingKind): void {
    if (!this.finalChoiceReady) {
      this.forceTags(4);
    }
    this.ending = kind;
  }

  private addObstacle(object: THREE.Object3D): void {
    object.updateWorldMatrix(true, true);
    this.obstacles.push(new THREE.Box3().setFromObject(object));
  }
}
