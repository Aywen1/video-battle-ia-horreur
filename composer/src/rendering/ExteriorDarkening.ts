import * as THREE from 'three';
import { PostProcessing } from './PostProcessing';

export class ExteriorDarkening {
  level = 0;
  target = 0;
  private dayBg = new THREE.Color(0x4a5a72);
  private nightBg = new THREE.Color(0x0a0508);

  constructor(
    private scene: THREE.Scene,
    private post: PostProcessing | null,
    private sun: THREE.DirectionalLight | null,
    private hemi: THREE.HemisphereLight | null,
    private skyMesh: THREE.Mesh | null
  ) {}

  triggerNight(duration = 3): void {
    this.target = 1;
  }

  setLevelImmediate(v: number): void {
    this.level = v;
    this.target = v;
    this.apply(this.level);
  }

  update(dt: number): void {
    if (Math.abs(this.level - this.target) < 0.001) return;
    this.level = THREE.MathUtils.lerp(this.level, this.target, dt * 0.35);
    this.apply(this.level);
  }

  private apply(t: number): void {
    this.scene.background = this.dayBg.clone().lerp(this.nightBg, t);
    const fogColor = new THREE.Color(0xb8c8d8).lerp(new THREE.Color(0x1a0808), t);
    const density = THREE.MathUtils.lerp(0.004, 0.028, t);
    this.scene.fog = new THREE.FogExp2(fogColor.getHex(), density);

    if (this.sun) {
      this.sun.intensity = THREE.MathUtils.lerp(1.6, 0.04, t);
      this.sun.color.setHSL(0.08, 1, THREE.MathUtils.lerp(0.55, 0.15, t));
    }
    if (this.hemi) {
      this.hemi.intensity = THREE.MathUtils.lerp(1.4, 0.25, t);
      this.hemi.color.setHex(0xb8d4f0).lerp(new THREE.Color(0x331818), t);
      this.hemi.groundColor.setHex(0x3a5030).lerp(new THREE.Color(0x0a0808), t);
    }
    if (this.skyMesh?.material instanceof THREE.MeshBasicMaterial) {
      this.skyMesh.material.opacity = THREE.MathUtils.lerp(1, 0.35, t);
      this.skyMesh.material.transparent = t > 0.01;
      this.skyMesh.material.color.setRGB(
        THREE.MathUtils.lerp(1, 0.08, t),
        THREE.MathUtils.lerp(1, 0.04, t),
        THREE.MathUtils.lerp(1, 0.06, t)
      );
    }
    this.post?.setHorrorDarkness(t);
  }
}
