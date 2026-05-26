export type ScreamerType = 'face_close' | 'silhouette_window' | 'hands_glass' | 'mirror_self';

export class ScreamerOverlay {
  private overlay: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private active = false;

  constructor() {
    this.overlay = document.getElementById('screamer-overlay')!;
    this.canvas = document.getElementById('screamer-canvas') as HTMLCanvasElement;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Screamer canvas 2D unavailable');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get isActive(): boolean {
    return this.active;
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  show(type: ScreamerType, durationMs = 850): Promise<void> {
    if (this.active) return Promise.resolve();
    this.active = true;
    this.resize();
    this.draw(type);
    this.overlay.classList.remove('hidden');

    return new Promise((resolve) => {
      setTimeout(() => {
        this.overlay.classList.add('hidden');
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.active = false;
        resolve();
      }, durationMs);
    });
  }

  private draw(type: ScreamerType): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    if (type === 'silhouette_window') {
      ctx.fillStyle = '#f4f4f0';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#050505';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.42, w * 0.12, h * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(w * 0.46, h * 0.55, w * 0.08, h * 0.35);
      return;
    }

    if (type === 'hands_glass') {
      ctx.fillStyle = 'rgba(20,30,40,0.85)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(180,190,200,0.25)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1a1a1a';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(
          w * 0.5 + side * w * 0.18,
          h * 0.55,
          w * 0.09,
          h * 0.14,
          side * 0.3,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.fillRect(
          w * 0.5 + side * w * 0.18 - w * 0.03,
          h * 0.62,
          w * 0.06,
          h * 0.22
        );
      }
      return;
    }

    if (type === 'mirror_self') {
      ctx.fillStyle = '#0a0508';
      ctx.fillRect(0, 0, w, h);
      const cx = w * 0.5;
      const cy = h * 0.46;
      const r = Math.min(w, h) * 0.28;
      ctx.fillStyle = '#4a2830';
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 0.1, r * 1.1, r * 1.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f0f0f0';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.35, cy - r * 0.05, r * 0.18, r * 0.1, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + r * 0.35, cy - r * 0.05, r * 0.18, r * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.4, r * 0.08, r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(180,20,20,${Math.random() * 0.4})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
      return;
    }

    // face_close
    ctx.fillStyle = '#0a0808';
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.5;
    const cy = h * 0.48;
    const faceR = Math.min(w, h) * 0.32;

    ctx.fillStyle = '#3a2820';
    ctx.beginPath();
    ctx.ellipse(cx, cy, faceR, faceR * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.ellipse(cx - faceR * 0.32, cy - faceR * 0.1, faceR * 0.14, faceR * 0.2, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + faceR * 0.32, cy - faceR * 0.1, faceR * 0.14, faceR * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1a0808';
    ctx.beginPath();
    ctx.ellipse(cx, cy + faceR * 0.35, faceR * 0.22, faceR * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }
}
