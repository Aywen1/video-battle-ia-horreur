export class Input {
  private readonly keys = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
  }

  get isLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  requestPointerLock(): void {
    this.canvas.requestPointerLock();
  }

  isDown(...codes: string[]): boolean {
    return codes.some((code) => this.keys.has(code.toLowerCase()));
  }

  consumeMouseDelta(): { x: number; y: number } {
    const delta = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return delta;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code.toLowerCase());
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code.toLowerCase());
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.isLocked) {
      return;
    }

    this.mouseDX += event.movementX;
    this.mouseDY += event.movementY;
  };
}
