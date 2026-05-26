import * as THREE from 'three';
import { Input } from './Input';

const PLAYER_RADIUS = 0.34;
const STANDING_HEIGHT = 1.68;
const CROUCH_HEIGHT = 1.12;
const JUMP_VELOCITY = 4.2;
const GRAVITY = 10.8;

export class Player {
  readonly flashlight: THREE.SpotLight;
  private readonly flashlightTarget = new THREE.Object3D();
  private yaw = 0;
  private pitch = 0;
  private battery = 1;
  private height = STANDING_HEIGHT;
  private verticalOffset = 0;
  private verticalVelocity = 0;
  private walkCycle = 0;
  private bobOffset = 0;
  private swayOffset = 0;
  private jumpWasDown = false;
  private readonly position = new THREE.Vector3(0, STANDING_HEIGHT, 4.6);

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly scene: THREE.Scene,
  ) {
    this.flashlight = new THREE.SpotLight(0xf3e7c8, 14, 10, Math.PI / 8, 0.74, 2.15);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.position.set(0.16, -0.12, -0.08);

    this.flashlightTarget.position.set(0, 0, -1);
    this.flashlight.target = this.flashlightTarget;

    this.camera.add(this.flashlight);
    this.camera.add(this.flashlightTarget);
    this.scene.add(this.camera);
    this.syncCamera();
  }

  update(delta: number, input: Input, obstacles: THREE.Box3[], suppressJump = false): void {
    if (input.isLocked) {
      this.updateLook(input);
    }

    const crouching = input.isDown('ControlLeft', 'ControlRight', 'KeyC');
    this.height = THREE.MathUtils.lerp(this.height, crouching ? CROUCH_HEIGHT : STANDING_HEIGHT, 10 * delta);

    const jumpDown = input.isDown('Space');
    if (!suppressJump && jumpDown && !this.jumpWasDown && this.verticalOffset === 0 && !crouching) {
      this.verticalVelocity = JUMP_VELOCITY;
    }
    this.jumpWasDown = jumpDown;

    this.verticalVelocity -= GRAVITY * delta;
    this.verticalOffset = Math.max(0, this.verticalOffset + this.verticalVelocity * delta);
    if (this.verticalOffset === 0) {
      this.verticalVelocity = 0;
    }

    const speed = input.isDown('ShiftLeft', 'ShiftRight') && !crouching ? 5.1 : crouching ? 1.75 : 3.05;
    const direction = this.getMoveDirection(input);
    if (direction.lengthSq() > 0) {
      direction.normalize().multiplyScalar(speed * delta);
      this.tryMove(direction, obstacles);
      this.battery = Math.max(0.08, this.battery - delta * 0.004);
      this.updateWalkBob(delta, speed, crouching);
    } else {
      this.battery = Math.max(0.08, this.battery - delta * 0.0015);
      this.updateWalkBob(delta, 0, crouching);
    }

    const tiredPulse = 0.9 + Math.sin(performance.now() * 0.005) * 0.06;
    this.flashlight.intensity = THREE.MathUtils.lerp(4.8, 14, this.battery) * tiredPulse;
    this.flashlight.distance = THREE.MathUtils.lerp(5.8, 10, this.battery);
    this.syncCamera();
  }

  getBattery(): number {
    return this.battery;
  }

  getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  private updateLook(input: Input): void {
    const delta = input.consumeMouseDelta();
    const sensitivity = Number.parseFloat(localStorage.getItem('sensitivity') ?? '0.0021');
    this.yaw -= delta.x * sensitivity;
    this.pitch -= delta.y * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.34, 1.34);
  }

  private getMoveDirection(input: Input): THREE.Vector3 {
    const forwardAmount = Number(input.isDown('KeyW', 'KeyZ')) - Number(input.isDown('KeyS'));
    const rightAmount = Number(input.isDown('KeyD')) - Number(input.isDown('KeyA', 'KeyQ'));

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    return forward.multiplyScalar(forwardAmount).add(right.multiplyScalar(rightAmount));
  }

  private tryMove(delta: THREE.Vector3, obstacles: THREE.Box3[]): void {
    const nextX = this.position.clone().add(new THREE.Vector3(delta.x, 0, 0));
    if (!this.collides(nextX, obstacles)) {
      this.position.x = nextX.x;
    }

    const nextZ = this.position.clone().add(new THREE.Vector3(0, 0, delta.z));
    if (!this.collides(nextZ, obstacles)) {
      this.position.z = nextZ.z;
    }
  }

  private collides(position: THREE.Vector3, obstacles: THREE.Box3[]): boolean {
    const feet = position.y - this.height;
    const head = position.y + 0.15;

    return obstacles.some((box) => {
      if (box.max.y < feet || box.min.y > head) {
        return false;
      }

      const expanded = box.clone().expandByVector(new THREE.Vector3(PLAYER_RADIUS, 0, PLAYER_RADIUS));
      return position.x > expanded.min.x && position.x < expanded.max.x && position.z > expanded.min.z && position.z < expanded.max.z;
    });
  }

  private syncCamera(): void {
    this.camera.position.set(this.position.x + this.swayOffset, this.height + this.verticalOffset + this.bobOffset, this.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  private updateWalkBob(delta: number, speed: number, crouching: boolean): void {
    const grounded = this.verticalOffset === 0;
    const moving = speed > 0 && grounded;
    if (moving) {
      const stride = crouching ? 7.5 : speed > 4 ? 11.5 : 9.2;
      const amplitude = crouching ? 0.026 : speed > 4 ? 0.082 : 0.064;
      this.walkCycle += delta * stride;
      this.bobOffset = THREE.MathUtils.lerp(this.bobOffset, Math.abs(Math.sin(this.walkCycle)) * amplitude, 9 * delta);
      this.swayOffset = THREE.MathUtils.lerp(this.swayOffset, Math.sin(this.walkCycle * 0.5) * amplitude * 0.45, 8 * delta);
      return;
    }

    this.bobOffset = THREE.MathUtils.lerp(this.bobOffset, 0, 8 * delta);
    this.swayOffset = THREE.MathUtils.lerp(this.swayOffset, 0, 8 * delta);
  }
}
