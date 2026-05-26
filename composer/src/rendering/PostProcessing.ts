import * as THREE from 'three';
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  VignetteEffect,
  ChromaticAberrationEffect,
  NoiseEffect,
} from 'postprocessing';

export class PostProcessing {
  readonly composer: EffectComposer;
  private bloom: BloomEffect;
  private chroma: ChromaticAberrationEffect;
  private vignette: VignetteEffect;
  private noise: NoiseEffect;
  private renderer: THREE.WebGLRenderer;

  private baseBloom = 0.62;
  private baseChroma = 0.0012;
  private baseExposure = 1.9;
  private targetBloom = 0.62;
  private targetChroma = 0.0012;
  private targetExposure = 1.9;
  private pulseTimer = 0;
  private pulseBloomBoost = 0;
  private pulseChromaBoost = 0;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new BloomEffect({
      intensity: this.baseBloom,
      luminanceThreshold: 0.35,
      luminanceSmoothing: 0.25,
      mipmapBlur: true,
    });

    this.vignette = new VignetteEffect({
      darkness: 0.2,
      offset: 0.48,
    });

    this.chroma = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(this.baseChroma, this.baseChroma),
      radialModulation: true,
      modulationOffset: 0.4,
    });

    this.noise = new NoiseEffect({ premultiply: true });
    this.noise.blendMode.opacity.value = 0.045;

    const effectPass = new EffectPass(camera, this.bloom, this.vignette, this.chroma, this.noise);
    this.composer.addPass(effectPass);
  }

  update(dt: number): void {
    if (this.pulseTimer > 0) {
      this.pulseTimer -= dt;
      const fade = Math.max(0, this.pulseTimer / 0.5);
      this.targetBloom = this.baseBloom + this.pulseBloomBoost * fade;
      this.targetChroma = this.baseChroma + this.pulseChromaBoost * fade;
    } else {
      this.targetBloom = this.baseBloom;
      this.targetChroma = this.baseChroma;
      this.targetExposure = this.baseExposure;
    }

    const lerp = 1 - Math.pow(0.001, dt);
    this.bloom.intensity = THREE.MathUtils.lerp(this.bloom.intensity, this.targetBloom, lerp);
    const c = THREE.MathUtils.lerp(this.chroma.offset.x, this.targetChroma, lerp);
    this.chroma.offset.set(c, c);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(
      this.renderer.toneMappingExposure,
      this.targetExposure,
      lerp
    );
  }

  pulseBloom(intensity: number, duration = 0.45): void {
    this.pulseBloomBoost = intensity;
    this.pulseTimer = Math.max(this.pulseTimer, duration);
  }

  spikeChroma(amount: number, duration = 0.35): void {
    this.pulseChromaBoost = amount;
    this.pulseTimer = Math.max(this.pulseTimer, duration);
  }

  setExposure(value: number): void {
    this.baseExposure = value;
    this.targetExposure = value;
  }

  setZoneMood(bloom: number, exposure: number): void {
    this.baseBloom = bloom;
    this.baseExposure = exposure;
  }

  setHorrorDarkness(level: number): void {
    const v = THREE.MathUtils.clamp(level, 0, 1);
    this.baseBloom = THREE.MathUtils.lerp(0.45, 0.25, v);
    this.baseExposure = THREE.MathUtils.lerp(1.1, 0.55, v);
    this.vignette.darkness = THREE.MathUtils.lerp(0.2, 0.65, v);
    this.noise.blendMode.opacity.value = THREE.MathUtils.lerp(0.045, 0.12, v);
    this.targetBloom = this.baseBloom;
    this.targetExposure = this.baseExposure;
  }

  setHorrorPulse(): void {
    this.pulseBloom(0.85, 0.5);
    this.spikeChroma(0.0045, 0.4);
    this.targetExposure = this.baseExposure + 0.35;
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
  }

  render(): void {
    this.composer.render();
  }
}
