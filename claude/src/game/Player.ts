/**
 * Player : contrôles FPS + collisions AABB. Pas de Three.Object3D ici —
 * uniquement la position/rotation et le calcul physique. Le renderer lit ces
 * valeurs pour positionner la caméra.
 */
import { Box3, Vector3 } from 'three';
import { InputState } from './InputManager';
import { clamp, damp } from '../utils/math';

export interface PlayerConfig {
  walkSpeed: number;
  sprintSpeed: number;
  crouchSpeed: number;
  standHeight: number;
  crouchHeight: number;
  radius: number;
  mouseSensitivity: number;
  maxPitch: number;
}

const DEFAULT_CONFIG: PlayerConfig = {
  walkSpeed: 3.0,
  sprintSpeed: 5.0,
  crouchSpeed: 1.5,
  standHeight: 1.65,
  crouchHeight: 0.9,
  radius: 0.35,
  mouseSensitivity: 0.0022,
  maxPitch: Math.PI / 2 - 0.05,
};

export class Player {
  position = new Vector3(0, 1.65, 0);
  velocity = new Vector3();
  yaw = 0;
  pitch = 0;
  height = DEFAULT_CONFIG.standHeight;
  private targetHeight = DEFAULT_CONFIG.standHeight;
  private cfg: PlayerConfig;
  private colliders: Box3[] = [];
  /** Si vrai, le player ne traite pas les inputs (cinématique d'ouverture, pause, etc.). */
  controlsEnabled = true;
  /** Override de la position caméra (utile pendant le réveil). */
  private cinematicOffset = new Vector3();
  private cinematicWeight = 0;
  private cinematicTargetWeight = 0;
  /** Yaw cible imposé par une cinématique (null = libre). Lerp en update(). */
  private cinematicYawTarget: number | null = null;
  /** Pitch cible imposé par une cinématique (null = libre). Lerp en update(). */
  private cinematicPitchTarget: number | null = null;

  constructor(cfg: Partial<PlayerConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    this.height = this.cfg.standHeight;
    this.targetHeight = this.cfg.standHeight;
  }

  setColliders(colliders: Box3[]): void {
    this.colliders = colliders;
  }

  /**
   * Donne un offset additionnel à la position caméra, lerpé doucement.
   * Quand `weight` revient à 0, le player reprend le contrôle.
   */
  setCinematicOffset(offset: Vector3, weight = 1): void {
    this.cinematicOffset.copy(offset);
    this.cinematicTargetWeight = weight;
  }

  clearCinematic(): void {
    this.cinematicTargetWeight = 0;
    this.cinematicYawTarget = null;
    this.cinematicPitchTarget = null;
  }

  /** Force le yaw progressivement vers `yaw`. Passe `null` pour relacher. */
  setCinematicYaw(yaw: number | null): void {
    this.cinematicYawTarget = yaw;
  }

  /** Force le pitch progressivement vers `pitch`. Passe `null` pour relacher. */
  setCinematicPitch(pitch: number | null): void {
    this.cinematicPitchTarget = pitch;
  }

  update(dt: number, input: InputState): void {
    // Caméra (souris) — toujours active sauf pendant les cinématiques d'ouverture
    if (this.controlsEnabled) {
      this.yaw -= input.mouseDX * this.cfg.mouseSensitivity;
      this.pitch -= input.mouseDY * this.cfg.mouseSensitivity;
      this.pitch = clamp(this.pitch, -this.cfg.maxPitch, this.cfg.maxPitch);
    }

    // Hauteur (crouch)
    this.targetHeight = input.crouch && this.controlsEnabled ? this.cfg.crouchHeight : this.cfg.standHeight;
    this.height = damp(this.height, this.targetHeight, 10, dt);

    // Mouvement (forward/back/strafe)
    let mx = 0;
    let mz = 0;
    if (this.controlsEnabled) {
      if (input.forward) mz -= 1;
      if (input.back) mz += 1;
      if (input.left) mx -= 1;
      if (input.right) mx += 1;
    }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
    }
    const speed = !this.controlsEnabled
      ? 0
      : input.crouch
        ? this.cfg.crouchSpeed
        : input.sprint
          ? this.cfg.sprintSpeed
          : this.cfg.walkSpeed;
    // Trois.js : la caméra à yaw=θ regarde dans la direction
    //   forward = (-sin θ, 0, -cos θ)  (rotation Ry de l'axe local -Z)
    //   right   = ( cos θ, 0, -sin θ)  (rotation Ry de l'axe local +X)
    // Donc le déplacement world = mx * right + (-mz) * forward, avec la
    // convention mz < 0 = forward.
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    const wx = (mx * cos + mz * sin) * speed;
    const wz = (-mx * sin + mz * cos) * speed;

    // Damping de la vélocité (pas d'inertie folle)
    this.velocity.x = damp(this.velocity.x, wx, 14, dt);
    this.velocity.z = damp(this.velocity.z, wz, 14, dt);

    // Intégration + collisions par axe
    this.moveAxis(this.velocity.x * dt, 0);
    this.moveAxis(0, this.velocity.z * dt);

    // Lerp du poids cinématique
    this.cinematicWeight = damp(this.cinematicWeight, this.cinematicTargetWeight, 3, dt);

    // Lerp yaw/pitch cinematique (snap doux quand le target est set)
    if (this.cinematicYawTarget !== null) {
      // Gestion du wrap-around angulaire (chemin court)
      let diff = this.cinematicYawTarget - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw = this.yaw + diff * Math.min(1, dt * 6);
    }
    if (this.cinematicPitchTarget !== null) {
      this.pitch = damp(this.pitch, this.cinematicPitchTarget, 6, dt);
    }
  }

  /** Position effective de la caméra (incluant la hauteur et l'offset cinématique). */
  getCameraPosition(out: Vector3): Vector3 {
    out.set(this.position.x, this.position.y - this.cfg.standHeight + this.height, this.position.z);
    if (this.cinematicWeight > 0.001) {
      out.lerp(this.cinematicOffset, this.cinematicWeight);
    }
    return out;
  }

  /** Pitch effectif (modulé par cinématique). */
  getEffectivePitch(): number {
    return this.pitch;
  }

  private moveAxis(dx: number, dz: number): void {
    const next = this.position.clone();
    next.x += dx;
    next.z += dz;
    if (!this.collides(next)) {
      this.position.copy(next);
    } else {
      // Push back : on essaie d'avancer un poil pour glisser le long du mur
      const half = next.clone();
      half.x = this.position.x + dx * 0.5;
      half.z = this.position.z + dz * 0.5;
      if (!this.collides(half)) {
        this.position.copy(half);
      }
    }
  }

  private _tmpBox = new Box3();
  private collides(pos: Vector3): boolean {
    const r = this.cfg.radius;
    this._tmpBox.min.set(pos.x - r, pos.y - this.cfg.standHeight, pos.z - r);
    this._tmpBox.max.set(pos.x + r, pos.y + 0.1, pos.z + r);
    for (const c of this.colliders) {
      if (this._tmpBox.intersectsBox(c)) return true;
    }
    return false;
  }
}
