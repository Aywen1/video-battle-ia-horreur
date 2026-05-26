/**
 * PromptCard — panneau de cue qui descend du cintre devant le présentateur.
 *
 * Géométrie : un grand plan rectangulaire (1.4 × 0.7 m) suspendu par 2 câbles.
 * Texture procédurale (CanvasTexture) avec un texte gigantesque, style
 * "instruction de plateau". Le panneau descend par interpolation Y, oscille
 * légèrement, et peut "glitcher" (clignoter / décaler) pour un effet inquiétant.
 *
 * API :
 * - setText(text)          : régénère la texture
 * - descend(targetY, dur)  : anime la descente
 * - rise(targetY, dur)     : anime la remontée
 * - update(dt)             : oscillations + glitch
 * - setGlitch(intensity)   : 0..1 — décalages aléatoires + clignotement
 */
import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { PALETTE } from '../../utils/palette';
import { clamp, lerp } from '../../utils/math';

const clamp01 = (x: number): number => clamp(x, 0, 1);

interface AnimState {
  active: boolean;
  fromY: number;
  toY: number;
  t: number;
  duration: number;
}

export class PromptCard {
  group = new Group();
  private panel!: Mesh;
  private panelMat!: MeshStandardMaterial;
  private cable1!: Mesh;
  private cable2!: Mesh;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private tex!: CanvasTexture;
  private currentText = '';
  private currentSubText = '';
  private currentTone: 'normal' | 'scream' | 'silence' = 'normal';
  /** EmissiveIntensity cible selon le tone (utilise par update() en absence de glitch). */
  private baseEmissive = 0.85;

  private idleTime = 0;
  private glitch = 0;
  /** Y de référence (haut du cintre) pour les câbles. */
  private cableTopY = 4.0;
  /** Y courant du panneau. */
  private panelY = 4.5; // caché au-dessus
  private anim: AnimState = { active: false, fromY: 0, toY: 0, t: 0, duration: 1 };

  constructor() {
    this.build();
  }

  private build(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new CanvasTexture(this.canvas);
    this.tex.colorSpace = SRGBColorSpace;
    // Materiau panel : couleur noire de base (le canvas dessine tout par dessus).
    // emissive blanche pour que le canvas soit auto-illumine et lisible meme sous
    // des spots tres intenses (sinon le tone-mapping crame les couleurs claires).
    this.panelMat = flatToon({
      color: '#0a0a0a',
      emissive: '#ffffff',
      emissiveIntensity: 0.85,
      emissiveMap: this.tex,
      roughness: 0.65,
      map: this.tex,
      side: DoubleSide,
    });
    this.panel = new Mesh(new PlaneGeometry(1.6, 0.8), this.panelMat);
    this.panel.position.y = 4.5; // caché au-dessus du cintre
    this.group.add(this.panel);

    // Cadre noir autour (2 plans très fins)
    const frameMat = flatToon({ color: '#0a0a0a', roughness: 0.6 });
    const frameTop = new Mesh(new BoxGeometry(1.7, 0.06, 0.02), frameMat);
    frameTop.position.set(0, 0.42, 0.01);
    this.panel.add(frameTop);
    const frameBot = new Mesh(new BoxGeometry(1.7, 0.06, 0.02), frameMat);
    frameBot.position.set(0, -0.42, 0.01);
    this.panel.add(frameBot);
    const frameL = new Mesh(new BoxGeometry(0.04, 0.85, 0.02), frameMat);
    frameL.position.set(-0.82, 0, 0.01);
    this.panel.add(frameL);
    const frameR = new Mesh(new BoxGeometry(0.04, 0.85, 0.02), frameMat);
    frameR.position.set(0.82, 0, 0.01);
    this.panel.add(frameR);

    // Câbles (créés dans le repère du group, longueur dynamique)
    const cableMat = flatToon({ color: '#1a1a1a', roughness: 1.0 });
    this.cable1 = new Mesh(new CylinderGeometry(0.012, 0.012, 1, 6), cableMat);
    this.cable1.position.set(-0.65, 3.0, 0);
    this.group.add(this.cable1);
    this.cable2 = new Mesh(new CylinderGeometry(0.012, 0.012, 1, 6), cableMat);
    this.cable2.position.set(0.65, 3.0, 0);
    this.group.add(this.cable2);

    this.setText('—', '', 'normal');
    this.updateCables();
  }

  /**
   * Régénère la texture avec un nouveau texte. `tone` change le code couleur :
   * - normal : crème sur fond crème pâle (texte jaune)
   * - scream : texte rouge sang sur fond crème
   * - silence : texte bleu sur fond crème
   */
  setText(text: string, subText = '', tone: 'normal' | 'scream' | 'silence' = 'normal'): void {
    this.currentText = text;
    this.currentSubText = subText;
    this.currentTone = tone;
    this.redraw();
  }

  /** Démarre une animation de descente. */
  descend(targetY: number, duration = 1.4): void {
    this.anim = {
      active: true,
      fromY: this.panelY,
      toY: targetY,
      t: 0,
      duration,
    };
  }

  /** Démarre une animation de remontée. */
  rise(targetY = 4.5, duration = 1.0): void {
    this.descend(targetY, duration);
  }

  setGlitch(intensity: number): void {
    this.glitch = clamp01(intensity);
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  /**
   * Frame update : oscillations + animation + glitch.
   */
  update(dt: number): void {
    this.idleTime += dt;
    // Animation de descente
    if (this.anim.active) {
      this.anim.t += dt;
      const t = clamp01(this.anim.t / this.anim.duration);
      // Ease in/out
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.panelY = lerp(this.anim.fromY, this.anim.toY, ease);
      if (t >= 1) this.anim.active = false;
    }
    // Petite oscillation (le panneau pendule légèrement)
    const sway = Math.sin(this.idleTime * 0.9) * 0.012;
    const yJitter = this.glitch > 0 ? (Math.random() - 0.5) * 0.04 * this.glitch : 0;
    this.panel.position.y = this.panelY + sway + yJitter;
    this.panel.rotation.z = Math.sin(this.idleTime * 0.6) * 0.02 + (this.glitch > 0 ? (Math.random() - 0.5) * 0.06 * this.glitch : 0);
    // Emissive : module par tone, glitche aleatoirement quand glitch > 0
    if (this.glitch > 0) {
      const flick = Math.random() > 0.7 ? 0.1 : this.baseEmissive;
      this.panelMat.emissiveIntensity = flick;
    } else {
      this.panelMat.emissiveIntensity = this.baseEmissive;
    }
    this.updateCables();
  }

  dispose(): void {
    this.tex.dispose();
    this.panelMat.dispose();
    this.group.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        if (o.material !== this.panelMat) {
          (o.material as MeshStandardMaterial).dispose();
        }
      }
    });
  }

  // ============== Internals ==============

  private updateCables(): void {
    const panelY = this.panel.position.y;
    const cableLen = Math.max(0.05, this.cableTopY - panelY - 0.4);
    const cableCenterY = panelY + 0.4 + cableLen * 0.5;
    this.cable1.scale.y = cableLen;
    this.cable2.scale.y = cableLen;
    this.cable1.position.y = cableCenterY;
    this.cable2.position.y = cableCenterY;
  }

  private redraw(): void {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Palette par tone : fond sombre + texte clair lumineux pour lisibilite max
    // sous spots intenses.
    let bgColor = '#1a0d10';
    let bandColor: string = PALETTE.yellow;
    let textColor = '#fff6c8';
    let subColor = '#d8c498';
    let labelText = 'INSTRUCTION';
    let labelTextColor = '#1a1a1a';
    let footerColor = '#a08068';
    this.baseEmissive = 0.85;
    if (this.currentTone === 'scream') {
      bgColor = '#2a0608';
      bandColor = PALETTE.red;
      textColor = '#ffffff';
      subColor = '#ffd0d0';
      labelText = 'CRIE — FORT';
      labelTextColor = '#ffffff';
      footerColor = '#d8807a';
      this.baseEmissive = 1.15;
    } else if (this.currentTone === 'silence') {
      bgColor = '#0a1a30';
      bandColor = PALETTE.blue;
      textColor = '#dff0ff';
      subColor = '#9ec6e8';
      labelText = 'SILENCE TOTAL';
      labelTextColor = '#04203a';
      footerColor = '#5a90c0';
      this.baseEmissive = 0.65;
    }

    // Fond sombre + grain
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    // Halo de fond subtil (gradient radial pour donner de la profondeur)
    const grad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W / 1.4);
    grad.addColorStop(0, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Bandeau supérieur coloré
    ctx.fillStyle = bandColor;
    ctx.fillRect(0, 0, W, 64);
    ctx.fillStyle = labelTextColor;
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`> ${labelText}`, 22, 44);

    // Texte principal avec outline noir pour lisibilite
    ctx.font = 'bold 96px "Impact", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = textColor;
    this.drawWrappedText(this.currentText, W / 2, H / 2 - (this.currentSubText ? 50 : 0), W - 40, 110, true);

    // Sous-texte
    if (this.currentSubText) {
      ctx.font = 'bold 38px "Courier New", monospace';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = subColor;
      this.drawWrappedText(this.currentSubText, W / 2, H / 2 + 130, W - 60, 50, true);
    }

    // Marque "L'EMISSION DE MINUIT" en bas
    ctx.fillStyle = footerColor;
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText("L'EMISSION DE MINUIT", W / 2, H - 22);

    // Lignes d'usure verticales (subtiles)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const x = (i / 8) * W + Math.random() * 20;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + Math.random() * 6, H);
      ctx.stroke();
    }
    this.tex.needsUpdate = true;
  }

  /** Wrappe + dessine texte centre, avec optionnel outline (stroke avant fill). */
  private drawWrappedText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    stroked: boolean,
  ): void {
    const lines = this.wrapLines(text, maxWidth);
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    for (let i = 0; i < lines.length; i++) {
      const ly = startY + i * lineHeight;
      if (stroked) this.ctx.strokeText(lines[i], x, ly);
      this.ctx.fillText(lines[i], x, ly);
    }
  }

  private wrapLines(text: string, maxWidth: number): string[] {
    const raw = text.split('\n');
    const out: string[] = [];
    for (const line of raw) {
      const words = line.split(' ');
      let current = '';
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (this.ctx.measureText(test).width > maxWidth && current) {
          out.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) out.push(current);
    }
    return out;
  }

}
