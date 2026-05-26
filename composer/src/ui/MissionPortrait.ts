/** Portrait procédural — opérateur radio low poly */
export class MissionPortrait {
  private ctx: CanvasRenderingContext2D;
  private t = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    this.draw(0);
  }

  update(dt: number): void {
    this.t += dt;
    this.draw(this.t);
  }

  private draw(t: number): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const s = w / 72;
    const cx = w / 2;

    ctx.fillStyle = '#1a202c';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#2d3748';
    ctx.beginPath();
    ctx.moveTo(8 * s, h - 4 * s);
    ctx.lineTo(w - 8 * s, h - 4 * s);
    ctx.lineTo(w - 12 * s, 28 * s);
    ctx.lineTo(12 * s, 28 * s);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#4a5568';
    ctx.fillRect(cx - 18 * s, 32 * s, 36 * s, 36 * s);

    const bob = Math.sin(t * 1.2) * 1.5 * s;

    ctx.fillStyle = '#3d4a5c';
    ctx.beginPath();
    ctx.arc(cx, 30 * s + bob, 20 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1a2535';
    ctx.fillRect(cx - 5 * s, 26 * s + bob, 3 * s, 3 * s);
    ctx.fillRect(cx + 2 * s, 26 * s + bob, 3 * s, 3 * s);
    if (Math.sin(t * 3) > 0.7) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(cx - 4 * s, 25 * s + bob, 1.5 * s, 1.5 * s);
    }

    ctx.fillStyle = '#2d3748';
    ctx.fillRect(cx - 14 * s, 16 * s + bob * 0.5, 28 * s, 16 * s);

    const ledOn = Math.sin(t * 4) > 0.2;
    ctx.fillStyle = ledOn ? '#c41e1e' : '#4a2020';
    ctx.fillRect(cx + 10 * s, 20 * s, 7 * s, 7 * s);

    ctx.fillStyle = '#5a6578';
    ctx.fillRect(8 * s, 50 * s, 12 * s, 22 * s);
    ctx.fillRect(w - 20 * s, 52 * s, 10 * s, 18 * s);

    ctx.fillStyle = '#6a7588';
    ctx.fillRect(cx - 10 * s, 62 * s, 20 * s, 8 * s);

    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }

    ctx.strokeStyle = 'rgba(196, 30, 30, 0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  }
}
