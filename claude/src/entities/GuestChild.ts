/**
 * GuestChild — l'enfant-marionnette invité du Chapitre 3.
 *
 * Petit puppet assis (≈0.7 m) face au présentateur (le joueur). Apparence de
 * "marionnette d'émission jeunesse" : tête disproportionnée, joues rondes,
 * vêtements colorés, yeux peints. Au fur et à mesure du chapitre, le visage se
 * déforme via setGrotesque (sourire qui se fend, dents apparentes, yeux qui
 * s'écartent).
 *
 * API :
 * - setEmotion(0..1)  : 0 = visage neutre triste, 1 = sourire forcé "présentable"
 * - setGrotesque(0..1): 0 = sourire normal, 1 = rictus de cauchemar
 * - lookAt(target)    : oriente la tête vers la position monde
 * - leanForward(t)    : 0..1 pour basculer le buste en avant (phase silence)
 * - blink()           : déclenche un clignement immédiat
 */
import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { flatToon } from '../rendering/materials/FlatToonMaterial';
import { PALETTE } from '../utils/palette';
import { clamp } from '../utils/math';

const clamp01 = (x: number): number => clamp(x, 0, 1);

export class GuestChild {
  group = new Group();
  private head = new Group();
  private body = new Group();
  private headMesh!: Mesh;
  private faceMat!: MeshStandardMaterial;
  private faceCanvas!: HTMLCanvasElement;
  private faceCtx!: CanvasRenderingContext2D;
  private faceTex!: CanvasTexture;
  // Hands resting on lap
  private leftArm = new Group();
  private rightArm = new Group();
  // États
  private emotion = 0;
  private grotesque = 0;
  private leanT = 0;
  private blinkTimer = 0;
  private idleTime = 0;
  private targetLookYaw = 0;
  private targetLookPitch = 0;
  private currentLookYaw = 0;
  private currentLookPitch = 0;
  /** Pulse de la tete en miroir du niveau micro (0..1). Lerp doux. */
  private headPulseLevel = 0;
  private currentHeadPulse = 0;

  constructor() {
    this.build();
    this.redrawFace();
  }

  private build(): void {
    // ----- Buste assis (chemise rouge + nœud jaune) -----
    const torsoMat = flatToon({ color: PALETTE.red, roughness: 0.95 });
    const torso = new Mesh(new CylinderGeometry(0.18, 0.24, 0.42, 10, 1), torsoMat);
    torso.position.y = 0.21;
    this.body.add(torso);
    // Col blanc
    const collar = new Mesh(
      new CylinderGeometry(0.20, 0.20, 0.04, 12, 1),
      flatToon({ color: PALETTE.cream, roughness: 0.7 }),
    );
    collar.position.y = 0.42;
    this.body.add(collar);
    // Nœud papillon
    const bow = new Mesh(
      new BoxGeometry(0.16, 0.06, 0.04),
      flatToon({ color: PALETTE.yellow, emissive: PALETTE.yellow, emissiveIntensity: 0.3 }),
    );
    bow.position.set(0, 0.42, 0.21);
    this.body.add(bow);

    // ----- Jambes -----
    const legMat = flatToon({ color: PALETTE.charcoal, roughness: 1.0 });
    const legL = new Mesh(new BoxGeometry(0.12, 0.30, 0.18), legMat);
    legL.position.set(-0.10, -0.05, 0.10);
    this.body.add(legL);
    const legR = new Mesh(new BoxGeometry(0.12, 0.30, 0.18), legMat);
    legR.position.set(0.10, -0.05, 0.10);
    this.body.add(legR);
    // Chaussures
    const shoeMat = flatToon({ color: '#5a2010', roughness: 0.8 });
    const shoeL = new Mesh(new BoxGeometry(0.13, 0.06, 0.22), shoeMat);
    shoeL.position.set(-0.10, -0.22, 0.20);
    this.body.add(shoeL);
    const shoeR = new Mesh(new BoxGeometry(0.13, 0.06, 0.22), shoeMat);
    shoeR.position.set(0.10, -0.22, 0.20);
    this.body.add(shoeR);

    // ----- Bras (posés sur les genoux) -----
    const armMat = flatToon({ color: PALETTE.red, roughness: 0.95 });
    const armLMesh = new Mesh(new CylinderGeometry(0.06, 0.07, 0.34, 8), armMat);
    armLMesh.position.y = -0.17;
    this.leftArm.add(armLMesh);
    this.leftArm.position.set(-0.22, 0.36, 0.0);
    this.leftArm.rotation.x = 0.95; // bras en avant, posés sur les cuisses
    this.body.add(this.leftArm);
    const armRMesh = new Mesh(new CylinderGeometry(0.06, 0.07, 0.34, 8), armMat);
    armRMesh.position.y = -0.17;
    this.rightArm.add(armRMesh);
    this.rightArm.position.set(0.22, 0.36, 0.0);
    this.rightArm.rotation.x = 0.95;
    this.body.add(this.rightArm);
    // Mains (gants crème)
    const handMat = flatToon({ color: PALETTE.cream, roughness: 0.95 });
    const handL = new Mesh(new BoxGeometry(0.10, 0.10, 0.10), handMat);
    handL.position.y = -0.34;
    this.leftArm.add(handL);
    const handR = new Mesh(new BoxGeometry(0.10, 0.10, 0.10), handMat);
    handR.position.y = -0.34;
    this.rightArm.add(handR);

    // ----- Tête (grosse par rapport au corps) -----
    this.faceCanvas = document.createElement('canvas');
    this.faceCanvas.width = 256;
    this.faceCanvas.height = 256;
    this.faceCtx = this.faceCanvas.getContext('2d')!;
    this.faceTex = new CanvasTexture(this.faceCanvas);
    this.faceTex.colorSpace = SRGBColorSpace;
    this.faceMat = flatToon({
      color: PALETTE.cream,
      emissive: '#1c1b1a',
      emissiveIntensity: 0.05,
      roughness: 0.85,
      map: this.faceTex,
    });
    // Tête en sphere (plus grosse en Y pour effet "tête d'enfant")
    const headGeo = new SphereGeometry(0.22, 16, 14);
    this.headMesh = new Mesh(headGeo, this.faceMat);
    this.headMesh.scale.set(1.05, 1.1, 1.0);
    this.head.add(this.headMesh);
    // Petits cheveux noirs : 3 boxes sur le sommet (style coupe au bol)
    const hairMat = flatToon({ color: '#1a1015', roughness: 1.0 });
    const hair1 = new Mesh(new BoxGeometry(0.42, 0.10, 0.36), hairMat);
    hair1.position.y = 0.16;
    this.head.add(hair1);
    const hair2 = new Mesh(new BoxGeometry(0.40, 0.16, 0.10), hairMat);
    hair2.position.set(0, 0.10, -0.20);
    this.head.add(hair2);
    // Oreilles minimalistes
    const earGeo = new BoxGeometry(0.05, 0.10, 0.05);
    const earL = new Mesh(earGeo, this.faceMat);
    earL.position.set(-0.23, 0.0, 0);
    this.head.add(earL);
    const earR = new Mesh(earGeo, this.faceMat);
    earR.position.set(0.23, 0.0, 0);
    this.head.add(earR);

    this.head.position.set(0, 0.62, 0.0);
    this.group.add(this.body);
    this.group.add(this.head);
  }

  // ============== API publique ==============

  setEmotion(value: number): void {
    const v = clamp01(value);
    if (Math.abs(v - this.emotion) < 0.01) return;
    this.emotion = v;
    this.redrawFace();
  }

  /**
   * 0..1 = deformation progressive. 1..2 = mode "gueule beante" du climax :
   * la bouche s'ouvre comme un trou noir, les dents doublent de taille, les
   * yeux deviennent des trous noirs sans iris.
   */
  setGrotesque(value: number): void {
    const v = clamp(value, 0, 2);
    if (Math.abs(v - this.grotesque) < 0.01) return;
    this.grotesque = v;
    this.redrawFace();
  }

  /** Active le pulse cardiaque de la tete en miroir du niveau du micro (0..1). */
  headPulse(level: number): void {
    this.headPulseLevel = clamp01(level);
  }

  /** Oriente la tête vers une position monde (rapide). */
  lookAt(worldTarget: Vector3): void {
    const wp = this.head.getWorldPosition(new Vector3());
    const dx = worldTarget.x - wp.x;
    const dy = worldTarget.y - wp.y;
    const dz = worldTarget.z - wp.z;
    this.targetLookYaw = Math.atan2(dx, dz);
    const horiz = Math.sqrt(dx * dx + dz * dz);
    this.targetLookPitch = Math.atan2(dy, horiz);
  }

  /** 0..1 — bascule le buste en avant (phase silence). */
  leanForward(t: number): void {
    this.leanT = clamp01(t);
  }

  /** Force un clignement immédiat. */
  blink(): void {
    this.blinkTimer = 0.16;
    this.redrawFace();
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  setYaw(yaw: number): void {
    this.group.rotation.y = yaw;
  }

  update(dt: number): void {
    this.idleTime += dt;
    // Lerp doux du regard
    const lerpRate = Math.min(1, dt * 5);
    this.currentLookYaw += (this.targetLookYaw - this.currentLookYaw) * lerpRate;
    this.currentLookPitch += (this.targetLookPitch - this.currentLookPitch) * lerpRate;
    this.head.rotation.y = this.currentLookYaw;
    this.head.rotation.x = -this.currentLookPitch * 0.6;
    // Lean forward
    this.body.rotation.x = this.leanT * 0.55;
    this.head.position.z = this.leanT * 0.15;
    this.head.position.y = 0.62 + this.leanT * 0.08;
    // Head pulse (cardiaque en miroir du micro)
    this.currentHeadPulse += (this.headPulseLevel - this.currentHeadPulse) * Math.min(1, dt * 8);
    const pulseScale = 1 + this.currentHeadPulse * 0.06;
    this.head.scale.set(pulseScale, pulseScale, pulseScale);
    // Clignement
    if (this.blinkTimer > 0) {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) this.redrawFace();
    } else {
      // Clignement aléatoire (rare quand grotesque, fréquent quand neutre)
      const blinkChance = Math.max(0, 1 - this.grotesque) * dt * 0.5;
      if (Math.random() < blinkChance) this.blink();
    }
  }

  dispose(): void {
    this.faceTex.dispose();
    this.faceMat.dispose();
    this.group.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        if (o.material !== this.faceMat) {
          (o.material as MeshStandardMaterial).dispose();
        }
      }
    });
  }

  // ============== Rendu visage ==============

  private redrawFace(): void {
    const ctx = this.faceCtx;
    const W = this.faceCanvas.width;
    const H = this.faceCanvas.height;
    ctx.clearRect(0, 0, W, H);
    // Fond couleur peau (légèrement rosé)
    ctx.fillStyle = '#f4dccd';
    ctx.fillRect(0, 0, W, H);
    // Joues roses (taches rondes)
    ctx.fillStyle = '#e8a8a0';
    ctx.beginPath();
    ctx.arc(W * 0.30, H * 0.62, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W * 0.70, H * 0.62, 22, 0, Math.PI * 2);
    ctx.fill();

    // === Yeux ===
    const eyeY = H * 0.46;
    const eyeOffset = this.grotesque * 14; // s'écartent quand grotesque
    const eyeOpenness = this.blinkTimer > 0 ? 0.08 : 1.0;
    this.drawEye(ctx, W * 0.36 - eyeOffset, eyeY, eyeOpenness, this.grotesque);
    this.drawEye(ctx, W * 0.64 + eyeOffset, eyeY, eyeOpenness, this.grotesque);

    // === Sourcils === (légèrement levés en emotion=1)
    ctx.strokeStyle = '#2a1a10';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const browTilt = (1 - this.emotion) * 0.18 - this.grotesque * 0.12;
    this.drawBrow(ctx, W * 0.36 - eyeOffset, eyeY - 26, -browTilt);
    this.drawBrow(ctx, W * 0.64 + eyeOffset, eyeY - 26, browTilt);

    // === Nez === petit point
    ctx.fillStyle = '#c08a78';
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.58, 5, 0, Math.PI * 2);
    ctx.fill();

    // === Bouche ===
    this.drawMouth(ctx, W * 0.5, H * 0.75);

    this.faceTex.needsUpdate = true;
  }

  private drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, openness: number, grot: number): void {
    // En mode "trou noir" (grot > 1) : le blanc disparait, oeil entierement noir
    const blackHole = Math.max(0, Math.min(1, grot - 1));
    // Blanc de l'œil (diminue au profit du noir quand grot > 1)
    const grotBase = Math.min(1, grot);
    ctx.fillStyle = blackHole > 0.5 ? '#1a0a0a' : '#ffffff';
    const eyeW = 22 + grotBase * 8 + blackHole * 14;
    const eyeH = 14 * openness + grotBase * 6 * openness + blackHole * 10 * openness;
    ctx.beginPath();
    ctx.ellipse(x, y, eyeW, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();
    if (blackHole < 0.95) {
      // Iris (bleu sombre) — disparait progressivement quand blackHole monte
      ctx.fillStyle = '#2c4858';
      ctx.globalAlpha = 1 - blackHole;
      ctx.beginPath();
      ctx.arc(x, y, 8 * Math.min(1, openness * 4), 0, Math.PI * 2);
      ctx.fill();
      // Pupille (rouge si grotesque > 0.5)
      ctx.fillStyle = grotBase > 0.5 ? '#c8102e' : '#0a0a0a';
      ctx.beginPath();
      ctx.arc(x, y, 4 * Math.min(1, openness * 4), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // Pupille rouge enorme dans le trou noir (lueur menacante)
      ctx.fillStyle = '#c8102e';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Contour œil (trait noir)
    ctx.strokeStyle = '#1a0a0a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(x, y, eyeW, eyeH, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawBrow(ctx: CanvasRenderingContext2D, x: number, y: number, tilt: number): void {
    const halfW = 16;
    ctx.beginPath();
    ctx.moveTo(x - halfW, y + tilt * halfW);
    ctx.lineTo(x + halfW, y - tilt * halfW);
    ctx.stroke();
  }

  private drawMouth(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const emo = this.emotion;
    const grot = this.grotesque;
    const beant = Math.max(0, Math.min(1, grot - 1));
    const grotBase = Math.min(1, grot);
    // Sourire base (arc qui monte si emotion > 0)
    const mouthW = 40 + grotBase * 50 + beant * 30;
    const smileDepth = -12 + emo * 24 + grotBase * 10;
    ctx.strokeStyle = '#7a1010';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - mouthW, y);
    ctx.quadraticCurveTo(x, y + smileDepth, x + mouthW, y);
    ctx.stroke();
    // Lèvres rouges (remplissage léger)
    if (grotBase > 0.3) {
      ctx.fillStyle = '#a01828';
      ctx.beginPath();
      ctx.moveTo(x - mouthW, y);
      ctx.quadraticCurveTo(x, y + smileDepth + 8, x + mouthW, y);
      ctx.quadraticCurveTo(x, y + smileDepth - 4, x - mouthW, y);
      ctx.fill();
    }
    // === Mode "GUEULE BÉANTE" (grot > 1) : trou noir + dents 2x ===
    if (beant > 0.05) {
      const jawHeight = 30 + beant * 70;
      // Trou noir de la gorge
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(x - mouthW, y);
      ctx.quadraticCurveTo(x, y + jawHeight + 20, x + mouthW, y);
      ctx.quadraticCurveTo(x, y - 6, x - mouthW, y);
      ctx.fill();
      // Levres rouges encadrant la gueule
      ctx.strokeStyle = '#7a1010';
      ctx.lineWidth = 5 + beant * 3;
      ctx.beginPath();
      ctx.moveTo(x - mouthW, y);
      ctx.quadraticCurveTo(x, y + jawHeight + 20, x + mouthW, y);
      ctx.stroke();
      // Dents superieures GEANTES (2x taille normale, pointues)
      const bigTeeth = 7;
      const bigTeethW = (mouthW * 2 - 8) / bigTeeth;
      const bigTeethH = (16 + beant * 16) * 2;
      ctx.fillStyle = '#FFD23F';
      ctx.strokeStyle = '#3a2010';
      ctx.lineWidth = 2;
      for (let i = 0; i < bigTeeth; i++) {
        const tx = x - mouthW + 4 + i * bigTeethW;
        ctx.beginPath();
        ctx.moveTo(tx, y - 2);
        ctx.lineTo(tx + bigTeethW - 2, y - 2);
        ctx.lineTo(tx + bigTeethW / 2 - 1, y + bigTeethH);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // Dents inferieures GEANTES (vers le haut)
      ctx.fillStyle = '#A4831F';
      for (let i = 0; i < bigTeeth - 1; i++) {
        const tx = x - mouthW + 4 + bigTeethW / 2 + i * bigTeethW;
        const ty = y + jawHeight + 6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + bigTeethW - 2, ty);
        ctx.lineTo(tx + bigTeethW / 2 - 1, ty - bigTeethH * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (grotBase > 0.4) {
      // Dents apparentes quand grotesque > 0.4 (mode normal)
      const teethCount = 6 + Math.floor(grotBase * 4);
      const teethW = (mouthW * 2 - 8) / teethCount;
      ctx.fillStyle = '#f0e8d0';
      ctx.strokeStyle = '#3a2010';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < teethCount; i++) {
        const tx = x - mouthW + 4 + i * teethW;
        const ty = y - 6 + Math.sin(i * 0.7) * 2;
        ctx.beginPath();
        ctx.rect(tx, ty, teethW - 2, 10 + grotBase * 6);
        ctx.fill();
        ctx.stroke();
      }
    }
    // Fissures aux commissures quand grot > 0.7 (effet "Glasgow smile")
    if (grot > 0.7) {
      ctx.strokeStyle = '#3a0808';
      ctx.lineWidth = 2.5;
      const crackLen = (Math.min(grot, 1.5) - 0.7) * 60;
      ctx.beginPath();
      ctx.moveTo(x - mouthW, y);
      ctx.lineTo(x - mouthW - crackLen, y - crackLen * 0.5);
      ctx.moveTo(x + mouthW, y);
      ctx.lineTo(x + mouthW + crackLen, y - crackLen * 0.5);
      ctx.stroke();
    }
  }
}
