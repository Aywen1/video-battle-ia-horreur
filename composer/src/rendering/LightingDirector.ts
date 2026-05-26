import * as THREE from 'three';
import type { StormTexWithDraw } from '../world/materials';

interface FlickerLight {
  light: THREE.Light;
  base: number;
  min: number;
  max: number;
  nextFlicker: number;
}

export class LightingDirector {
  private flickers: FlickerLight[] = [];
  private dirLight: THREE.DirectionalLight | null = null;
  private dirBase = 1.75;
  private stormTex: StormTexWithDraw | null = null;
  private lightningTimer = 4;
  private seaMesh: THREE.Mesh | null = null;
  private seaOffset = 0;

  registerFlicker(light: THREE.Light, base: number, min = 0.65, max = 1.15): void {
    this.flickers.push({ light, base, min, max, nextFlicker: Math.random() * 2 });
  }

  registerDirectional(light: THREE.DirectionalLight): void {
    this.dirLight = light;
    this.dirBase = light.intensity;
  }

  registerStormSky(texture: THREE.CanvasTexture): void {
    this.stormTex = texture as StormTexWithDraw;
  }

  registerSea(mesh: THREE.Mesh): void {
    this.seaMesh = mesh;
  }

  triggerLightning(): void {
    if (this.dirLight) {
      this.dirLight.intensity = this.dirBase * 3.5;
      setTimeout(() => {
        if (this.dirLight) this.dirLight.intensity = this.dirBase;
      }, 80);
      setTimeout(() => {
        if (this.dirLight) this.dirLight.intensity = this.dirBase * 2;
      }, 140);
      setTimeout(() => {
        if (this.dirLight) this.dirLight.intensity = this.dirBase;
      }, 200);
    }
    this.stormTex?.drawStorm?.(1);
    setTimeout(() => this.stormTex?.drawStorm?.(0), 250);
  }

  setPhaseFog(scene: THREE.Scene, phase: string): void {
    switch (phase) {
      case 'cabin':
        scene.fog = new THREE.FogExp2(0x4a5a70, 0.007);
        break;
      case 'hallway':
      case 'tower':
        scene.fog = new THREE.FogExp2(0x3a4a58, 0.009);
        break;
      case 'server':
      case 'finale':
        scene.fog = new THREE.FogExp2(0x1a3040, 0.011);
        break;
      case 'exterior':
      case 'exterior_finale':
        scene.fog = new THREE.FogExp2(0xb8c8d8, 0.004);
        break;
      case 'undercore':
      case 'undercore_finale':
        scene.fog = new THREE.FogExp2(0x1a0808, 0.035);
        break;
      default:
        scene.fog = new THREE.FogExp2(0x4a5a70, 0.008);
    }
  }

  update(dt: number, _phase: string): void {
    for (const f of this.flickers) {
      f.nextFlicker -= dt;
      if (f.nextFlicker <= 0) {
        f.light.intensity = f.base * (f.min + Math.random() * (f.max - f.min));
        f.nextFlicker = 0.05 + Math.random() * 0.35;
      }
    }

    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this.triggerLightning();
      this.lightningTimer = 8 + Math.random() * 10;
    }

    if (this.seaMesh) {
      this.seaOffset += dt * 0.15;
      const pos = this.seaMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      if (pos) {
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const z = pos.getZ(i);
          pos.setY(i, Math.sin(x * 0.4 + this.seaOffset) * 0.12 + Math.cos(z * 0.3 + this.seaOffset * 1.2) * 0.08);
        }
        pos.needsUpdate = true;
        this.seaMesh.geometry.computeVertexNormals();
      }
    }
  }
}
