/**
 * FullscreenScreamer — overlay DOM plein ecran qui affiche le visage monstrueux
 * de M. Sourire pour 1.2s avec shake + RGB shift + flash + fade-out.
 *
 * Utilise un canvas procedural (1024x1024) genere une seule fois au build de
 * la classe, puis converti en data URL pour etre utilise comme background sur
 * 3 layers (rouge, vert, bleu) en mix-blend `screen` pour l'effet RGB shift.
 *
 * z-index 9999 : au-dessus du HUD et du PauseMenu.
 */
import { PALETTE } from '../utils/palette';

export class FullscreenScreamer {
  private root: HTMLDivElement;
  private layerR: HTMLDivElement;
  private layerG: HTMLDivElement;
  private layerB: HTMLDivElement;
  private flash: HTMLDivElement;
  private dataUrl: string;
  private playing = false;
  private cleanupTimeouts: number[] = [];

  constructor(private parent: HTMLElement) {
    this.dataUrl = FullscreenScreamer.buildFaceDataUrl();

    this.root = document.createElement('div');
    this.root.style.cssText = `
      position: fixed; inset: 0;
      z-index: 9999;
      pointer-events: none;
      display: none;
      background: #000;
      overflow: hidden;
    `;

    const layerBase = `
      position: absolute; inset: 0;
      background-image: url(${this.dataUrl});
      background-position: center;
      background-repeat: no-repeat;
      background-size: 120% auto;
      opacity: 0;
      mix-blend-mode: screen;
      transform: scale(1.0);
      will-change: transform, opacity;
    `;

    this.layerR = document.createElement('div');
    this.layerR.style.cssText = layerBase + 'filter: hue-rotate(0deg) saturate(2.5);';
    this.root.appendChild(this.layerR);

    this.layerG = document.createElement('div');
    this.layerG.style.cssText = layerBase + 'filter: hue-rotate(120deg) saturate(2.5);';
    this.root.appendChild(this.layerG);

    this.layerB = document.createElement('div');
    this.layerB.style.cssText = layerBase + 'filter: hue-rotate(240deg) saturate(2.5);';
    this.root.appendChild(this.layerB);

    this.flash = document.createElement('div');
    this.flash.style.cssText = `
      position: absolute; inset: 0;
      background: #fff;
      opacity: 0;
      mix-blend-mode: screen;
      pointer-events: none;
    `;
    this.root.appendChild(this.flash);

    // Keyframes pour le shake
    const style = document.createElement('style');
    style.textContent = `
      @keyframes screamerShake {
        0%   { transform: translate(0, 0) scale(var(--scr-scale, 1.3)); }
        10%  { transform: translate(-8px, 6px) scale(var(--scr-scale, 1.3)); }
        20%  { transform: translate(7px, -4px) scale(var(--scr-scale, 1.3)); }
        30%  { transform: translate(-6px, -7px) scale(var(--scr-scale, 1.3)); }
        40%  { transform: translate(8px, 5px) scale(var(--scr-scale, 1.3)); }
        50%  { transform: translate(-7px, 3px) scale(var(--scr-scale, 1.3)); }
        60%  { transform: translate(6px, -6px) scale(var(--scr-scale, 1.3)); }
        70%  { transform: translate(-5px, 7px) scale(var(--scr-scale, 1.3)); }
        80%  { transform: translate(7px, -3px) scale(var(--scr-scale, 1.3)); }
        90%  { transform: translate(-4px, 5px) scale(var(--scr-scale, 1.3)); }
        100% { transform: translate(0, 0) scale(var(--scr-scale, 1.3)); }
      }
    `;
    document.head.appendChild(style);

    parent.appendChild(this.root);
  }

  /**
   * Declenche le screamer. Affiche le visage en plein ecran avec animation
   * d'attaque (200ms) + sustain shake (700ms) + explosion fade-out (300ms).
   */
  play(durationMs = 1200): void {
    if (this.playing) return;
    this.playing = true;
    this.clearTimeouts();

    this.root.style.display = 'block';

    // Frame 0 : apparition brutale, scale 1.3, opacite max
    const layers = [this.layerR, this.layerG, this.layerB];
    for (const l of layers) {
      l.style.setProperty('--scr-scale', '1.3');
      l.style.transition = 'none';
      l.style.transform = 'scale(1.3)';
      l.style.opacity = '0.95';
      l.style.animation = 'screamerShake 90ms infinite linear';
    }

    // Decalage RGB des 3 couches (effet glitch chromatic abbe)
    this.layerR.style.translate = '0 0';
    this.layerR.style.backgroundPosition = 'calc(50% - 16px) center';
    this.layerG.style.backgroundPosition = '50% center';
    this.layerB.style.backgroundPosition = 'calc(50% + 16px) center';

    // Flash blanc bref a t=200ms
    this.cleanupTimeouts.push(window.setTimeout(() => {
      this.flash.style.transition = 'opacity 60ms ease-out';
      this.flash.style.opacity = '0.85';
      this.cleanupTimeouts.push(window.setTimeout(() => {
        this.flash.style.opacity = '0';
      }, 60));
    }, 200));

    // Second flash plus diffus a t=600ms
    this.cleanupTimeouts.push(window.setTimeout(() => {
      this.flash.style.transition = 'opacity 100ms ease-out';
      this.flash.style.opacity = '0.55';
      this.cleanupTimeouts.push(window.setTimeout(() => {
        this.flash.style.opacity = '0';
      }, 100));
    }, 600));

    // Decalage RGB amplifie a t=300ms (pic glitch)
    this.cleanupTimeouts.push(window.setTimeout(() => {
      this.layerR.style.backgroundPosition = 'calc(50% - 30px) center';
      this.layerB.style.backgroundPosition = 'calc(50% + 30px) center';
    }, 300));

    // Explosion : scale 1.8 et fade-out a 75% de la duree
    const fadeStart = durationMs * 0.75;
    this.cleanupTimeouts.push(window.setTimeout(() => {
      for (const l of layers) {
        l.style.transition = 'transform 350ms ease-in, opacity 350ms ease-in';
        l.style.setProperty('--scr-scale', '1.8');
        l.style.animation = 'none';
        l.style.transform = 'scale(1.8)';
        l.style.opacity = '0';
      }
      this.root.style.transition = 'background-color 350ms ease-in';
      this.root.style.background = '#000';
    }, fadeStart));

    // Nettoyage final
    this.cleanupTimeouts.push(window.setTimeout(() => {
      this.root.style.display = 'none';
      for (const l of layers) {
        l.style.animation = 'none';
        l.style.transition = 'none';
      }
      this.playing = false;
    }, durationMs + 50));
  }

  dispose(): void {
    this.clearTimeouts();
    this.root.remove();
  }

  private clearTimeouts(): void {
    for (const id of this.cleanupTimeouts) clearTimeout(id);
    this.cleanupTimeouts = [];
  }

  // ============== Dessin du visage procedural ==============

  /**
   * Genere une seule fois le visage monstrueux de M. Sourire sur un canvas
   * 1024x1024 et renvoie une data URL PNG reutilisable.
   */
  private static buildFaceDataUrl(): string {
    const W = 1024;
    const H = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Fond noir
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Halo rouge derriere le visage
    const halo = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.55);
    halo.addColorStop(0, 'rgba(200, 16, 46, 0.55)');
    halo.addColorStop(0.5, 'rgba(122, 31, 88, 0.25)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    // === Visage : maquillage blanc clown ===
    ctx.save();
    ctx.translate(W / 2, H / 2);

    // Forme ovale du maquillage blanc
    ctx.fillStyle = '#f4e9d8';
    ctx.beginPath();
    ctx.ellipse(0, -20, 320, 420, 0, 0, Math.PI * 2);
    ctx.fill();

    // Craquelures du maquillage (lignes noires irregulieres)
    ctx.strokeStyle = '#1c1b1a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r0 = 180 + Math.random() * 80;
      const r1 = r0 + 40 + Math.random() * 80;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 - 20);
      const midX = Math.cos(a + 0.1) * (r0 + 20) + (Math.random() - 0.5) * 30;
      const midY = Math.sin(a + 0.1) * (r0 + 20) + (Math.random() - 0.5) * 30 - 20;
      ctx.quadraticCurveTo(midX, midY, Math.cos(a + 0.2) * r1, Math.sin(a + 0.2) * r1 - 20);
      ctx.stroke();
    }

    // Petites taches de maquillage qui s'effrite
    ctx.fillStyle = '#1c1b1a';
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 100 + Math.random() * 220;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r - 20;
      const sz = 2 + Math.random() * 5;
      ctx.beginPath();
      ctx.arc(x, y, sz, 0, Math.PI * 2);
      ctx.fill();
    }

    // === Veines noires ===
    ctx.strokeStyle = 'rgba(28, 27, 26, 0.65)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const startX = (Math.random() - 0.5) * 500;
      const startY = -350 + Math.random() * 200;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      let x = startX;
      let y = startY;
      for (let j = 0; j < 8; j++) {
        x += (Math.random() - 0.5) * 60;
        y += 20 + Math.random() * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // === Yeux : 2 trous noirs avec halo rouge ===
    for (const eyeSign of [-1, 1]) {
      const ex = eyeSign * 120;
      const ey = -110;

      // Halo rouge autour de l'oeil
      const eyeHalo = ctx.createRadialGradient(ex, ey, 5, ex, ey, 100);
      eyeHalo.addColorStop(0, 'rgba(200, 16, 46, 0.9)');
      eyeHalo.addColorStop(0.6, 'rgba(107, 11, 25, 0.5)');
      eyeHalo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = eyeHalo;
      ctx.beginPath();
      ctx.arc(ex, ey, 110, 0, Math.PI * 2);
      ctx.fill();

      // Trou noir au centre
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 55, 65, 0, 0, Math.PI * 2);
      ctx.fill();

      // Petite pupille rouge brillante (point lumineux dans le noir)
      ctx.fillStyle = PALETTE.red;
      ctx.beginPath();
      ctx.arc(ex, ey + 5, 9, 0, Math.PI * 2);
      ctx.fill();
      // Reflet blanc sur la pupille
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 3, ey + 2, 3, 0, Math.PI * 2);
      ctx.fill();

      // Larmes noires qui coulent
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(ex - 15, ey + 30);
      ctx.quadraticCurveTo(ex - 18, ey + 100, ex - 8, ey + 220);
      ctx.quadraticCurveTo(ex, ey + 230, ex + 8, ey + 200);
      ctx.quadraticCurveTo(ex + 18, ey + 80, ex + 15, ey + 30);
      ctx.fill();
    }

    // === Nez ombre subtile ===
    ctx.fillStyle = 'rgba(122, 31, 88, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 35, 0, 0, Math.PI * 2);
    ctx.fill();

    // === Bouche : sourire glasgow GIGANTESQUE ===
    // Contour rouge sang
    ctx.fillStyle = PALETTE.red;
    ctx.beginPath();
    ctx.moveTo(-260, 60);
    // Coupure jusqu'aux oreilles
    ctx.quadraticCurveTo(-280, 90, -240, 140);
    ctx.quadraticCurveTo(-220, 200, -160, 240);
    ctx.quadraticCurveTo(-80, 280, 0, 290);
    ctx.quadraticCurveTo(80, 280, 160, 240);
    ctx.quadraticCurveTo(220, 200, 240, 140);
    ctx.quadraticCurveTo(280, 90, 260, 60);
    // Levre superieure
    ctx.quadraticCurveTo(180, 100, 100, 120);
    ctx.quadraticCurveTo(50, 110, 0, 120);
    ctx.quadraticCurveTo(-50, 110, -100, 120);
    ctx.quadraticCurveTo(-180, 100, -260, 60);
    ctx.fill();

    // Interieur noir de la bouche (la "gueule")
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(-220, 100);
    ctx.quadraticCurveTo(-200, 175, -130, 220);
    ctx.quadraticCurveTo(-65, 255, 0, 260);
    ctx.quadraticCurveTo(65, 255, 130, 220);
    ctx.quadraticCurveTo(200, 175, 220, 100);
    ctx.quadraticCurveTo(110, 140, 0, 145);
    ctx.quadraticCurveTo(-110, 140, -220, 100);
    ctx.fill();

    // === Dents jaunes saillantes ===
    const teethTop = [
      { x: -180, w: 32, h: 70 },
      { x: -140, w: 30, h: 90 },
      { x: -95,  w: 32, h: 100 },
      { x: -50,  w: 32, h: 115 },
      { x: -5,   w: 32, h: 105 },
      { x: 40,   w: 32, h: 110 },
      { x: 85,   w: 32, h: 95 },
      { x: 130,  w: 30, h: 80 },
      { x: 170,  w: 28, h: 65 },
    ];
    for (const t of teethTop) {
      const grad = ctx.createLinearGradient(t.x, 130, t.x, 130 + t.h);
      grad.addColorStop(0, '#FFD23F');
      grad.addColorStop(0.6, '#A4831F');
      grad.addColorStop(1, '#6B0B19');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(t.x - t.w / 2, 130);
      ctx.lineTo(t.x + t.w / 2, 130);
      ctx.lineTo(t.x + t.w / 3, 130 + t.h);
      ctx.lineTo(t.x - t.w / 3, 130 + t.h);
      ctx.closePath();
      ctx.fill();
      // Trait de separation
      ctx.strokeStyle = '#1c1b1a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Dents du bas (plus petites, moins nombreuses)
    const teethBot = [
      { x: -150, w: 26, h: 55 },
      { x: -100, w: 28, h: 70 },
      { x: -50,  w: 26, h: 65 },
      { x: 0,    w: 26, h: 70 },
      { x: 50,   w: 26, h: 60 },
      { x: 100,  w: 28, h: 65 },
      { x: 150,  w: 26, h: 50 },
    ];
    for (const t of teethBot) {
      const grad = ctx.createLinearGradient(t.x, 260, t.x, 260 - t.h);
      grad.addColorStop(0, '#A4831F');
      grad.addColorStop(0.4, '#FFD23F');
      grad.addColorStop(1, '#FFD23F');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(t.x - t.w / 2, 260);
      ctx.lineTo(t.x + t.w / 2, 260);
      ctx.lineTo(t.x + t.w / 3, 260 - t.h);
      ctx.lineTo(t.x - t.w / 3, 260 - t.h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1c1b1a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Gouttes de bave / salive
    ctx.fillStyle = 'rgba(255, 210, 63, 0.6)';
    for (let i = 0; i < 6; i++) {
      const tx = -120 + i * 48;
      ctx.beginPath();
      ctx.moveTo(tx - 4, 230);
      ctx.quadraticCurveTo(tx, 270 + Math.random() * 20, tx + 4, 230);
      ctx.fill();
    }

    ctx.restore();

    return canvas.toDataURL('image/png');
  }
}
