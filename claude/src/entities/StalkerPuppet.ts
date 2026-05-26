/**
 * StalkerPuppet — variante "déchirée" de M. Sourire qui hante l'atelier.
 *
 *  - Silhouette élancée et silencieuse (pas de bras supplémentaires)
 *  - Texture craquelée, vêtements tachés (palette désaturée)
 *  - eyeStage 2 forcé permanent (regard fixe vert toxique)
 *  - Cou allongé en permanence
 *
 * Mécanique Weeping Angel :
 *  - Si dans le frustum de vision du joueur : totalement immobile.
 *  - Sinon : avance par snaps stop-motion (3 snaps/sec, ~0.4m / snap).
 *  - Si distance < 0.9m : reset à 8m derrière le joueur.
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
  Texture,
  Vector3,
} from 'three';
import { flatToon } from '../rendering/materials/FlatToonMaterial';
import { PALETTE } from '../utils/palette';
import { TAU } from '../utils/math';

export class StalkerPuppet {
  group = new Group();
  /** Distance avancée par snap. */
  stepDistance = 0.4;
  /** Intervalle entre 2 snaps quand non observé. */
  stepInterval = 0.33;
  /** Distance min sous laquelle on déclenche le reset. */
  resetDistance = 0.9;

  private head = new Group();
  private headMesh!: Mesh;
  private faceMat!: MeshStandardMaterial;
  private body = new Group();
  private stepTimer = 0;
  private observed = true;
  private snapJitter = 0;
  /** S'incrémente à chaque snap pour produire du "stop-motion". */
  private snapCount = 0;
  /** Cible monde du prochain snap (calcul incrémental). */
  private targetCache = new Vector3();

  constructor() {
    this.build();
  }

  private build(): void {
    // Torse "déchiré" — magenta très désaturé tachet
    const torso = new Mesh(
      new CylinderGeometry(0.30, 0.40, 1.05, 10, 1),
      flatToon({ color: '#5a2848', roughness: 1.0 }),
    );
    torso.position.y = 0.55;
    this.body.add(torso);

    // Bras pendants (long, fins)
    const armMat = flatToon({ color: '#4a2040', roughness: 1.0 });
    for (const side of [-1, 1]) {
      const arm = new Mesh(new CylinderGeometry(0.06, 0.07, 0.85, 8), armMat);
      arm.position.set(side * 0.32, 0.65, 0);
      arm.rotation.z = side * 0.08;
      this.body.add(arm);
      const hand = new Mesh(
        new BoxGeometry(0.12, 0.12, 0.12),
        flatToon({ color: '#c0a890', roughness: 1.0 }),
      );
      hand.position.set(side * 0.36, 0.25, 0);
      this.body.add(hand);
    }

    // Cou allongé (50% de plus que M. Sourire)
    const neck = new Mesh(
      new CylinderGeometry(0.10, 0.12, 0.35, 8),
      flatToon({ color: '#c0a890', roughness: 1.0 }),
    );
    neck.position.y = 1.20;
    this.body.add(neck);

    // Tête (légèrement plus petite, étirée)
    this.faceMat = flatToon({
      color: '#c4a890',
      map: this.makeTornFaceTexture(),
      roughness: 1.0,
    });
    this.headMesh = new Mesh(new SphereGeometry(0.32, 14, 10), this.faceMat);
    this.headMesh.scale.y = 1.25; // étiré verticalement
    this.head.add(this.headMesh);

    // Cheveux décoiffés
    const hair = new Mesh(
      new SphereGeometry(0.34, 14, 10, 0, TAU, 0, Math.PI / 2.0),
      flatToon({ color: '#1a1612', roughness: 1.0 }),
    );
    hair.position.y = 0.02;
    this.head.add(hair);

    this.head.position.y = 1.50;
    this.body.add(this.head);

    this.group.add(this.body);
    // Caché par défaut, la BackstageRoom le rendra visible
    this.group.visible = false;
  }

  /**
   * Visage déchiré : yeux grand ouverts verts toxiques + bouche déchirée
   * + traînées de sang séché. Pas de stitches : tout est "à vif".
   */
  private makeTornFaceTexture(): Texture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#c4a890';
    ctx.fillRect(0, 0, size, size);
    // Crevasses : lignes sombres irrégulières
    ctx.strokeStyle = 'rgba(40,20,30,0.7)';
    ctx.lineWidth = size * 0.008;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const ax = Math.random() * size;
      const ay = Math.random() * size;
      ctx.moveTo(ax, ay);
      for (let j = 0; j < 4; j++) {
        ctx.lineTo(ax + (Math.random() - 0.5) * size * 0.5, ay + (Math.random() - 0.5) * size * 0.5);
      }
      ctx.stroke();
    }
    // Yeux grand ouverts (stage 2)
    const eyeY = size * 0.42;
    for (const cx of [size * 0.36, size * 0.64]) {
      // Cerne noir
      ctx.fillStyle = 'rgba(40,20,30,0.6)';
      ctx.beginPath();
      ctx.ellipse(cx, eyeY, size * 0.13, size * 0.10, 0, 0, TAU);
      ctx.fill();
      // Sclera
      ctx.fillStyle = '#fdf6e3';
      ctx.beginPath();
      ctx.arc(cx, eyeY, size * 0.09, 0, TAU);
      ctx.fill();
      // Iris vert toxique
      ctx.fillStyle = '#3a7a3d';
      ctx.beginPath();
      ctx.arc(cx, eyeY, size * 0.045, 0, TAU);
      ctx.fill();
      // Pupille noire dilatée
      ctx.fillStyle = '#1c1b1a';
      ctx.beginPath();
      ctx.arc(cx, eyeY, size * 0.028, 0, TAU);
      ctx.fill();
      // Highlight petit (figé)
      ctx.fillStyle = PALETTE.cream;
      ctx.beginPath();
      ctx.arc(cx - size * 0.012, eyeY - size * 0.012, size * 0.010, 0, TAU);
      ctx.fill();
      // Veines rouges éparpillées
      ctx.strokeStyle = 'rgba(180,30,30,0.8)';
      ctx.lineWidth = size * 0.008;
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * TAU + 0.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * size * 0.085, eyeY + Math.sin(ang) * size * 0.085);
        ctx.quadraticCurveTo(
          cx + Math.cos(ang) * size * 0.06,
          eyeY + Math.sin(ang) * size * 0.06,
          cx + Math.cos(ang + 0.4) * size * 0.05,
          eyeY + Math.sin(ang + 0.4) * size * 0.05,
        );
        ctx.stroke();
      }
    }
    // Sourcils relevés méchamment
    ctx.strokeStyle = '#1a1612';
    ctx.lineWidth = size * 0.012;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(size * 0.26, size * 0.26);
    ctx.lineTo(size * 0.46, size * 0.30);
    ctx.moveTo(size * 0.74, size * 0.26);
    ctx.lineTo(size * 0.54, size * 0.30);
    ctx.stroke();
    // Bouche déchirée : fil arraché, lèvres ouvertes
    ctx.strokeStyle = '#5a1818';
    ctx.lineWidth = size * 0.022;
    ctx.beginPath();
    ctx.moveTo(size * 0.30, size * 0.70);
    ctx.quadraticCurveTo(size * 0.5, size * 0.86, size * 0.70, size * 0.70);
    ctx.stroke();
    // Filaments de couture pendants
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = size * 0.005;
    for (let i = 0; i < 8; i++) {
      const x = size * (0.32 + i * 0.05);
      const y = size * (0.72 + Math.abs(Math.sin(i)) * 0.05);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * size * 0.03, y + size * 0.035 + Math.random() * size * 0.02);
      ctx.stroke();
    }
    // Traînées de sang séché des coins de bouche
    ctx.fillStyle = 'rgba(110,15,15,0.75)';
    ctx.beginPath();
    ctx.moveTo(size * 0.30, size * 0.70);
    ctx.lineTo(size * 0.28, size * 0.92);
    ctx.lineTo(size * 0.32, size * 0.92);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size * 0.70, size * 0.70);
    ctx.lineTo(size * 0.72, size * 0.92);
    ctx.lineTo(size * 0.68, size * 0.92);
    ctx.closePath();
    ctx.fill();

    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  setPosition(pos: Vector3): void {
    this.group.position.copy(pos);
    this.snapCount = 0;
    this.stepTimer = 0;
  }

  getPosition(): Vector3 {
    return this.group.position.clone();
  }

  /** Téléporte le stalker à une position arbitraire (utilisé pour reset). */
  resetTo(pos: Vector3): void {
    this.group.position.copy(pos);
    this.snapCount = 0;
    this.stepTimer = 0;
  }

  /**
   * Met à jour le stalker :
   *  - `observed` : true si le joueur le regarde (dans le frustum de vision)
   *  - `targetPos` : position monde à atteindre
   * Renvoie true si une étape a été faite (pour jouer un son).
   */
  update(dt: number, observed: boolean, targetPos: Vector3): boolean {
    this.observed = observed;
    // Toujours orienté vers le joueur
    const dx = targetPos.x - this.group.position.x;
    const dz = targetPos.z - this.group.position.z;
    const yaw = Math.atan2(dx, dz);
    this.group.rotation.y = yaw;
    if (observed) {
      // Immobile, micro-tremblement à peine perceptible
      this.snapJitter *= 0.85;
      this.group.position.x += this.snapJitter * (Math.random() - 0.5) * 0.01;
      return false;
    }
    // Non observé : snap toutes les stepInterval secondes
    this.stepTimer += dt;
    if (this.stepTimer >= this.stepInterval) {
      this.stepTimer = 0;
      this.snapCount++;
      const dist = Math.hypot(dx, dz);
      if (dist <= 0.01) return false;
      const step = Math.min(this.stepDistance, dist);
      // Snap discontinu + petit décalage random pour effet stop-motion
      this.group.position.x += (dx / dist) * step + (Math.random() - 0.5) * 0.04;
      this.group.position.z += (dz / dist) * step + (Math.random() - 0.5) * 0.04;
      this.snapJitter = 1;
      return true;
    }
    return false;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        const m = o.material as MeshStandardMaterial;
        if (m.map) m.map.dispose();
        m.dispose();
      }
    });
  }
}
