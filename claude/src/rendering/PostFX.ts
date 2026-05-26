/**
 * Pipeline post-processing : Bloom, Vignette, Grain pellicule, Aberration
 * chromatique, Tone mapping ACES. Tout est exposé via getters pour qu'on
 * puisse l'animer en réponse au stress (SmileMeter).
 */
import { PerspectiveCamera, WebGLRenderer, Scene } from 'three';
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  VignetteEffect,
  NoiseEffect,
  ChromaticAberrationEffect,
  ToneMappingEffect,
  ToneMappingMode,
  BlendFunction,
  KernelSize,
  VignetteTechnique,
} from 'postprocessing';
import { Vector2 } from 'three';

export class PostFX {
  composer: EffectComposer;
  bloom: BloomEffect;
  vignette: VignetteEffect;
  noise: NoiseEffect;
  chroma: ChromaticAberrationEffect;
  toneMapping: ToneMappingEffect;
  /** Pulse additionnel d'aberration chromatique, indépendant du stress nominal. */
  private pulseAmount = 0;
  private pulseDuration = 0;
  private pulseElapsed = 0;
  /** Base stress 0..1, mémorisé pour pouvoir composer avec le pulse. */
  private baseStress = 0;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
    this.composer = new EffectComposer(renderer, {
      multisampling: Math.min(2, renderer.capabilities.getMaxAnisotropy()),
    });
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new BloomEffect({
      intensity: 0.6,
      luminanceThreshold: 0.78,
      luminanceSmoothing: 0.4,
      kernelSize: KernelSize.LARGE,
      mipmapBlur: true,
    });

    this.vignette = new VignetteEffect({
      technique: VignetteTechnique.DEFAULT,
      offset: 0.32,
      darkness: 0.7,
    });

    this.noise = new NoiseEffect({
      blendFunction: BlendFunction.OVERLAY,
      premultiply: true,
    });
    this.noise.blendMode.opacity.value = 0.18;

    this.chroma = new ChromaticAberrationEffect({
      offset: new Vector2(0.0015, 0.0015),
      radialModulation: true,
      modulationOffset: 0.3,
    });

    this.toneMapping = new ToneMappingEffect({
      mode: ToneMappingMode.ACES_FILMIC,
    });

    this.composer.addPass(new EffectPass(camera, this.bloom, this.chroma, this.vignette, this.noise, this.toneMapping));
  }

  /** Module le post-FX selon le niveau de stress 0..1. */
  setStress(stress: number): void {
    this.baseStress = Math.max(0, Math.min(1, stress));
    this.applyAll();
  }

  /**
   * Pulse ponctuel d'aberration chromatique + bloom + grain par-dessus
   * le niveau nominal. `intensity` 0..1, `durationSec` typique 0.2-0.5.
   * Réutilisé pour la zone warning (pulse régulier) et les échecs (one-shot).
   */
  pulse(intensity: number, durationSec: number): void {
    // Si déjà en cours, on prend le max (pas de dégradation visible)
    if (intensity * (1 - this.pulseElapsed / Math.max(0.001, this.pulseDuration)) <
        this.pulseAmount * (1 - this.pulseElapsed / Math.max(0.001, this.pulseDuration))) {
      return;
    }
    this.pulseAmount = Math.max(0, Math.min(1, intensity));
    this.pulseDuration = Math.max(0.05, durationSec);
    this.pulseElapsed = 0;
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
  }

  render(dt: number): void {
    if (this.pulseAmount > 0) {
      this.pulseElapsed += dt;
      if (this.pulseElapsed >= this.pulseDuration) {
        this.pulseAmount = 0;
        this.pulseElapsed = 0;
        this.pulseDuration = 0;
        this.applyAll();
      } else {
        this.applyAll();
      }
    }
    this.composer.render(dt);
  }

  /** Combine baseStress + pulse courant et applique aux effets. */
  private applyAll(): void {
    const pulseT = this.pulseDuration > 0 ? 1 - this.pulseElapsed / this.pulseDuration : 0;
    const pulse = this.pulseAmount * Math.max(0, pulseT);
    const s = Math.max(0, Math.min(1, this.baseStress + pulse));
    this.bloom.intensity = 0.6 + s * 0.7;
    const off = 0.0015 + s * 0.0065 + pulse * 0.006;
    this.chroma.offset.set(off, off);
    this.noise.blendMode.opacity.value = 0.16 + s * 0.20 + pulse * 0.10;
    this.vignette.darkness = 0.68 + s * 0.22 + pulse * 0.10;
  }

  dispose(): void {
    this.composer.dispose();
  }
}
