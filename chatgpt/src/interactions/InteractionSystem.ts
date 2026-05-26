import * as THREE from 'three';

export type Interactable = {
  object: THREE.Object3D;
  label: string;
  onInteract: () => void;
  maxDistance?: number;
};

export class InteractionSystem {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2(0, 0);
  private current?: Interactable;
  private dialogueQueue: string[] = [];
  private dialogueIndex = 0;
  private visibleText = '';
  private typeStartedAt = 0;
  private dialogueOpenedAt = 0;
  private typeDuration = 1000;
  private typing = false;
  private suppressMessageDepth = 0;

  constructor(
    private readonly camera: THREE.Camera,
    private readonly promptElement: HTMLElement,
    private readonly messageElement: HTMLElement,
  ) {}

  update(interactables: Interactable[]): void {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const objects = interactables.map((item) => item.object);
    const hits = this.raycaster.intersectObjects(objects, true);
    this.current = undefined;

    for (const hit of hits) {
      const interactable = interactables.find((item) => isDescendant(hit.object, item.object));
      if (!interactable) {
        continue;
      }

      const maxDistance = interactable.maxDistance ?? 2.4;
      if (hit.distance <= maxDistance) {
        this.current = interactable;
        break;
      }
    }

    this.promptElement.textContent = this.current && !this.hasActiveDialogue() ? `[E] ${this.current.label}` : '';
    this.updateDialogueText();
  }

  interact(): void {
    if (!this.current || this.hasActiveDialogue()) {
      return;
    }

    this.current.onInteract();
  }

  showMessage(message: string | string[], _duration = 4200): void {
    if (this.suppressMessageDepth > 0) {
      return;
    }

    const nextMessages = Array.isArray(message) ? message : [message];

    if (this.hasActiveDialogue()) {
      this.dialogueQueue.push(...nextMessages);
      this.renderDialogue();
      return;
    }

    this.dialogueQueue = nextMessages;
    this.dialogueIndex = 0;
    this.startCurrentPhrase();
  }

  withoutMessages(callback: () => void): void {
    this.suppressMessageDepth += 1;
    try {
      callback();
    } finally {
      this.suppressMessageDepth -= 1;
    }
  }

  hasActiveDialogue(): boolean {
    return this.dialogueQueue.length > 0;
  }

  advanceDialogue(): boolean {
    if (!this.hasActiveDialogue()) {
      return false;
    }

    // Ignore la pression qui a pu déclencher l'action juste avant l'ouverture du dialogue.
    if (performance.now() - this.dialogueOpenedAt < 260) {
      return true;
    }

    if (this.typing) {
      return true;
    }

    this.dialogueIndex += 1;
    if (this.dialogueIndex >= this.dialogueQueue.length) {
      this.dialogueQueue = [];
      this.messageElement.classList.remove('visible');
      this.messageElement.textContent = '';
      return true;
    }

    this.startCurrentPhrase();
    return true;
  }

  private startCurrentPhrase(): void {
    this.visibleText = '';
    this.typeStartedAt = performance.now();
    this.dialogueOpenedAt = performance.now();
    this.typeDuration = 1000;
    this.typing = true;
    this.messageElement.classList.add('visible');
    this.renderDialogue();
  }

  private updateDialogueText(): void {
    if (!this.hasActiveDialogue() || !this.typing) {
      return;
    }

    const phrase = this.dialogueQueue[this.dialogueIndex];
    const progress = Math.min(1, (performance.now() - this.typeStartedAt) / this.typeDuration);
    const visibleLength = Math.ceil(phrase.length * progress);
    this.visibleText = phrase.slice(0, visibleLength);
    if (progress >= 1) {
      this.typing = false;
    }

    this.renderDialogue();
  }

  private renderDialogue(): void {
    const phraseCount = this.dialogueQueue.length;
    const progress = phraseCount > 1 ? `${this.dialogueIndex + 1}/${phraseCount}` : '';
    this.messageElement.innerHTML = `
      <div class="dialogue-text">${this.visibleText}</div>
      <div class="dialogue-hint">${this.typing ? 'Lecture...' : `Espace : ${phraseCount > 1 && this.dialogueIndex < phraseCount - 1 ? 'phrase suivante' : 'fermer'}`} ${progress}</div>
    `;
  }
}

function isDescendant(object: THREE.Object3D, target: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current === target) {
      return true;
    }

    current = current.parent;
  }

  return false;
}
