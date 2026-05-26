/**
 * InputManager : centralise clavier + souris + pointer lock.
 * Le code gameplay ne touche jamais aux events DOM directement.
 */

export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  crouch: boolean;
  interact: boolean;
  interactJustPressed: boolean;
  pauseJustPressed: boolean;
  mouseDX: number;
  mouseDY: number;
  locked: boolean;
}

export class InputManager {
  private state: InputState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
    crouch: false,
    interact: false,
    interactJustPressed: false,
    pauseJustPressed: false,
    mouseDX: 0,
    mouseDY: 0,
    locked: false,
  };
  private interactWasPressed = false;
  private domElement: HTMLElement;

  /**
   * Mapping par `event.code` (POSITION PHYSIQUE nommée selon QWERTY).
   * Sur AZERTY, les positions physiques `KeyW`/`KeyA` correspondent aux
   * touches Z/Q — donc ZQSD physique fonctionne nativement via ce mapping.
   */
  private codeMap: Record<string, keyof InputState> = {
    KeyW: 'forward',
    KeyS: 'back',
    KeyA: 'left',
    KeyD: 'right',
    ArrowUp: 'forward',
    ArrowDown: 'back',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ShiftLeft: 'sprint',
    ShiftRight: 'sprint',
    KeyC: 'crouch',
    ControlLeft: 'crouch',
    KeyE: 'interact',
  };

  /**
   * Mapping par `event.key` (LETTRE RÉELLEMENT TAPÉE, layout-aware).
   * Garantit que les vraies lettres Z Q S D E C sont bien lues quelle que
   * soit la disposition clavier (AZERTY, QWERTY, BÉPO, etc.).
   */
  private keyMap: Record<string, keyof InputState> = {
    z: 'forward',
    q: 'left',
    s: 'back',
    d: 'right',
    w: 'forward', // tolérance QWERTY
    a: 'left',    // tolérance QWERTY
    e: 'interact',
    c: 'crouch',
  };

  private resolveAction(e: KeyboardEvent): keyof InputState | undefined {
    const byCode = this.codeMap[e.code];
    if (byCode !== undefined) return byCode;
    return this.keyMap[e.key.toLowerCase()];
  }

  constructor(domElement: HTMLElement) {
    this.domElement = domElement;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  requestLock(): void {
    this.domElement.requestPointerLock();
  }

  releaseLock(): void {
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  isLocked(): boolean {
    return this.state.locked;
  }

  /** Lit l'état courant et reset les flags "just pressed" / mouse delta. */
  consume(): InputState {
    const snapshot: InputState = { ...this.state };
    this.state.mouseDX = 0;
    this.state.mouseDY = 0;
    this.state.interactJustPressed = false;
    this.state.pauseJustPressed = false;
    return snapshot;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Escape' || e.key === 'Escape') {
      this.state.pauseJustPressed = true;
      return;
    }
    const k = this.resolveAction(e);
    if (k !== undefined) {
      if (k === 'interact' && !this.interactWasPressed) {
        this.state.interactJustPressed = true;
      }
      (this.state[k] as boolean) = true;
      if (k === 'interact') this.interactWasPressed = true;
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const k = this.resolveAction(e);
    if (k !== undefined) {
      (this.state[k] as boolean) = false;
      if (k === 'interact') this.interactWasPressed = false;
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.state.locked) return;
    this.state.mouseDX += e.movementX;
    this.state.mouseDY += e.movementY;
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.state.locked) return;
    if (e.button === 0) {
      // Clic gauche = interagir
      if (!this.interactWasPressed) this.state.interactJustPressed = true;
      this.state.interact = true;
      this.interactWasPressed = true;
      // Release sur mouseup
      const up = (): void => {
        this.state.interact = false;
        this.interactWasPressed = false;
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mouseup', up);
    }
  };

  private onPointerLockChange = (): void => {
    this.state.locked = document.pointerLockElement === this.domElement;
  };

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
  }
}
