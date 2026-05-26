/**
 * SmileMeter : transforme le score brut du SmileDetector en jauge "AUDIMAT"
 * pilotant le gameplay. Hystérésis pour éviter le flicker, dérive lente
 * vers le bas pour forcer la participation.
 */
import { damp } from '../utils/math';
import { SmileDetector } from './SmileDetector';

export interface SmileMeterState {
  /** Sourire instantané normalisé (0..1) lu depuis le détecteur. */
  smileNow: number;
  /** Niveau AUDIMAT (0..1) — la jauge affichée. Filtré et avec dérive. */
  meter: number;
  /** Stress 0..1 dérivé du meter (utile pour audio/post-FX). */
  stress: number;
  /** Sous le seuil critique → déclenche fail. */
  belowCritical: boolean;
  /** Sous le seuil de confort (zone jaune). */
  belowComfort: boolean;
  /** Entre warning et critical (zone orange) — pic de tension visuel/sonore. */
  inWarning: boolean;
  /** Visage non détecté. */
  faceLost: boolean;
  /** Niveau qualitatif : 0=green, 1=yellow, 2=orange, 3=red. */
  zone: 0 | 1 | 2 | 3;
}

export interface SmileMeterOptions {
  smoothing: number;
  decay: number;
  smileTarget: number;
  riseRate: number;
  /** Zone jaune commence en dessous. */
  comfortThreshold: number;
  /** Zone orange (warning) commence en dessous. */
  warningThreshold: number;
  /** Zone rouge (critical) — fail. */
  criticalThreshold: number;
}

const DEFAULTS: SmileMeterOptions = {
  smoothing: 6,
  decay: 0.06,
  smileTarget: 0.35,
  riseRate: 0.9,
  comfortThreshold: 0.45,
  warningThreshold: 0.28,
  criticalThreshold: 0.18,
};

export class SmileMeter {
  private opts: SmileMeterOptions;
  private detector: SmileDetector;
  private smoothed = 0;
  private meter = 1; // démarre plein
  private active = false;

  constructor(detector: SmileDetector, opts: Partial<SmileMeterOptions> = {}) {
    this.detector = detector;
    this.opts = { ...DEFAULTS, ...opts };
  }

  setActive(active: boolean): void {
    this.active = active;
  }

  isActive(): boolean {
    return this.active;
  }

  /** Forcer une valeur (utile pour le climax / cinématiques). */
  setMeter(v: number): void {
    this.meter = Math.max(0, Math.min(1, v));
  }

  update(dt: number): SmileMeterState {
    const raw = this.detector.getSmile();
    this.smoothed = damp(this.smoothed, raw, this.opts.smoothing, dt);

    if (this.active) {
      const delta = (this.smoothed - this.opts.smileTarget) * this.opts.riseRate * dt;
      this.meter += delta;
      this.meter -= this.opts.decay * dt;
      if (this.meter < 0) this.meter = 0;
      if (this.meter > 1) this.meter = 1;
    }

    const stress = 1 - this.meter;
    const belowCritical = this.meter < this.opts.criticalThreshold;
    const belowWarning = this.meter < this.opts.warningThreshold;
    const belowComfort = this.meter < this.opts.comfortThreshold;
    const inWarning = belowWarning && !belowCritical;
    const zone: 0 | 1 | 2 | 3 = belowCritical ? 3 : inWarning ? 2 : belowComfort ? 1 : 0;
    return {
      smileNow: this.smoothed,
      meter: this.meter,
      stress,
      belowComfort,
      belowCritical,
      inWarning,
      faceLost: !this.detector.isFaceDetected(),
      zone,
    };
  }
}
