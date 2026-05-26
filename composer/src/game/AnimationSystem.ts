import * as THREE from 'three';

type TweenProp =
  | 'rotationY'
  | 'rotationX'
  | 'positionX'
  | 'positionY'
  | 'positionZ'
  | 'intensity'
  | 'emissive';

interface Tween {
  target: THREE.Object3D | THREE.Light | THREE.MeshStandardMaterial;
  prop: TweenProp;
  from: number;
  to: number;
  duration: number;
  elapsed: number;
  onComplete?: () => void;
}

export class AnimationSystem {
  private tweens: Tween[] = [];

  tweenRotationY(
    target: THREE.Object3D,
    to: number,
    duration: number,
    onComplete?: () => void
  ): void {
    this.tweens.push({
      target,
      prop: 'rotationY',
      from: target.rotation.y,
      to,
      duration,
      elapsed: 0,
      onComplete,
    });
  }

  tweenRotationX(
    target: THREE.Object3D,
    to: number,
    duration: number,
    onComplete?: () => void
  ): void {
    this.tweens.push({
      target,
      prop: 'rotationX',
      from: target.rotation.x,
      to,
      duration,
      elapsed: 0,
      onComplete,
    });
  }

  tweenPosition(
    target: THREE.Object3D,
    axis: 'x' | 'y' | 'z',
    to: number,
    duration: number,
    onComplete?: () => void
  ): void {
    const prop = axis === 'x' ? 'positionX' : axis === 'y' ? 'positionY' : 'positionZ';
    this.tweens.push({
      target,
      prop,
      from: target.position[axis],
      to,
      duration,
      elapsed: 0,
      onComplete,
    });
  }

  tweenLightIntensity(light: THREE.Light, to: number, duration: number): void {
    this.tweens.push({
      target: light,
      prop: 'intensity',
      from: light.intensity,
      to,
      duration,
      elapsed: 0,
    });
  }

  tweenEmissive(mat: THREE.MeshStandardMaterial, to: number, duration: number): void {
    this.tweens.push({
      target: mat,
      prop: 'emissive',
      from: mat.emissiveIntensity,
      to,
      duration,
      elapsed: 0,
    });
  }

  update(dt: number): void {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const t = this.tweens[i];
      t.elapsed += dt;
      const p = Math.min(1, t.elapsed / t.duration);
      const eased = p * p * (3 - 2 * p);
      const v = THREE.MathUtils.lerp(t.from, t.to, eased);

      if (t.target instanceof THREE.Object3D) {
        if (t.prop === 'rotationY') t.target.rotation.y = v;
        else if (t.prop === 'rotationX') t.target.rotation.x = v;
        else if (t.prop === 'positionX') t.target.position.x = v;
        else if (t.prop === 'positionY') t.target.position.y = v;
        else if (t.prop === 'positionZ') t.target.position.z = v;
      } else if (t.target instanceof THREE.Light && t.prop === 'intensity') {
        t.target.intensity = v;
      } else if (t.target instanceof THREE.MeshStandardMaterial && t.prop === 'emissive') {
        t.target.emissiveIntensity = v;
      }

      if (p >= 1) {
        t.onComplete?.();
        this.tweens.splice(i, 1);
      }
    }
  }
}
