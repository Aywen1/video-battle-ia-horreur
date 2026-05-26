export class InputManager {
  keys = new Set<string>();
  mouseDelta = { x: 0, y: 0 };
  /** Accumulation molette (normalisée par cran) pendant la frame */
  wheelDelta = 0;
  sensitivity = 0.8;
  interactPressed = false;
  private interactQueued = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.interactQueued = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) {
        this.mouseDelta.x += e.movementX;
        this.mouseDelta.y += e.movementY;
      }
    });

    window.addEventListener(
      'wheel',
      (e) => {
        if (!document.pointerLockElement) return;
        e.preventDefault();
        this.wheelDelta += Math.sign(e.deltaY) || (e.deltaY > 0 ? 1 : -1);
      },
      { passive: false }
    );
  }

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  consumeInteract(): boolean {
    if (this.interactQueued) {
      this.interactQueued = false;
      return true;
    }
    return false;
  }

  resetMouseDelta(): void {
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    this.wheelDelta = 0;
  }

  /** Molette accumulée cette frame (consommée par la radio avant reset). */
  consumeWheelDelta(): number {
    const w = this.wheelDelta;
    this.wheelDelta = 0;
    return w;
  }
}
