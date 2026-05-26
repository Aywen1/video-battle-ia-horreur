import * as THREE from 'three';
import { InputManager } from './InputManager';
import { moveAndCollide, depenetrate } from '../utils/collision';
import { FloorZone, sampleGroundY } from '../world/FloorZones';
import { PlayBounds, clampToPlayBounds } from '../world/WorldBounds';
import { AABB } from '../utils/collision';

const WALK_SPEED = 4.2;
const SPRINT_SPEED = 7;
const CROUCH_SPEED = 2.2;
const EYE_HEIGHT = 1.65;
const CROUCH_HEIGHT = 1.0;
const PLAYER_RADIUS = 0.28;

export class Player {
  readonly camera: THREE.PerspectiveCamera;
  readonly flashlight: THREE.SpotLight;
  readonly flashlightTarget = new THREE.Object3D();

  position = new THREE.Vector3(0, EYE_HEIGHT, 2);
  yaw = Math.PI;
  pitch = 0;

  battery = 1;
  flashlightOn = true;
  exteriorDarkness = 0;
  isCrouching = false;

  private eyeHeight = EYE_HEIGHT;

  constructor(
    private input: InputManager,
    aspect: number
  ) {
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.05, 120);
    this.camera.position.copy(this.position);

    this.flashlight = new THREE.SpotLight(0xfff8ee, 3.2, 32, Math.PI / 5, 0.4, 1);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.shadow.bias = -0.0002;

    this.flashlightTarget.position.set(0, 0, -1);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;

    const coneGeo = new THREE.ConeGeometry(0.35, 2.5, 8, 1, true);
    coneGeo.translate(0, -1.25, 0);
    coneGeo.rotateX(-Math.PI / 2);
    this.flashlightCone = new THREE.Mesh(
      coneGeo,
      new THREE.MeshBasicMaterial({
        color: 0xfff8ee,
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
    );
    this.camera.add(this.flashlightCone);
  }

  private flashlightCone: THREE.Mesh;

  update(
    dt: number,
    walls: AABB[],
    floorZones: FloorZone[],
    bounds: PlayBounds,
    paused: boolean,
    depenetrateNow = false
  ): void {
    if (paused) return;

    const sens = this.input.sensitivity * 0.002;
    this.yaw -= this.input.mouseDelta.x * sens;
    this.pitch -= this.input.mouseDelta.y * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.35, 1.35);
    this.input.resetMouseDelta();

    if (this.input.keys.has('KeyF') && !this._fKeyHeld) {
      this.flashlightOn = !this.flashlightOn;
    }
    this._fKeyHeld = this.input.keys.has('KeyF');

    this.isCrouching = this.input.isDown('KeyC');
    this.eyeHeight = THREE.MathUtils.lerp(
      this.eyeHeight,
      this.isCrouching ? CROUCH_HEIGHT : EYE_HEIGHT,
      dt * 10
    );

    if (depenetrateNow) {
      depenetrate(this.position, PLAYER_RADIUS, walls);
    }

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = new THREE.Vector3();

    if (this.input.isDown('KeyW', 'KeyZ')) move.add(forward);
    if (this.input.isDown('KeyS')) move.sub(forward);
    if (this.input.isDown('KeyA', 'KeyQ')) move.sub(right);
    if (this.input.isDown('KeyD')) move.add(right);

    if (move.lengthSq() > 0) {
      move.normalize();
      const speed = this.input.isDown('ShiftLeft', 'ShiftRight')
        ? SPRINT_SPEED
        : this.isCrouching
          ? CROUCH_SPEED
          : WALK_SPEED;
      moveAndCollide(
        this.position,
        move.x * speed * dt,
        move.z * speed * dt,
        PLAYER_RADIUS,
        walls
      );
    }

    clampToPlayBounds(this.position, bounds);

    const groundY = sampleGroundY(
      this.position.x,
      this.position.z,
      floorZones,
      0
    );
    this.position.y = groundY + this.eyeHeight;

    if (this.flashlightOn) {
      const drain = this.exteriorDarkness > 0.5 ? 0.018 * 2.5 : 0.018;
      this.battery -= dt * drain;
      if (this.battery <= 0) {
        this.battery = 0;
        this.flashlightOn = false;
      }
    } else {
      this.battery = Math.min(1, this.battery + dt * 0.005);
    }

    const flicker =
      this.battery < 0.25 && this.flashlightOn
        ? 0.6 + Math.random() * 0.4
        : 1;
    this.flashlight.intensity = this.flashlightOn
      ? 3.2 * flicker * Math.max(0.35, this.battery)
      : 0;
    this.flashlight.visible = this.flashlightOn;
    this.flashlightCone.visible = this.flashlightOn;
    (this.flashlightCone.material as THREE.MeshBasicMaterial).opacity =
      this.flashlightOn ? 0.04 + flicker * 0.04 * Math.max(0.35, this.battery) : 0;

    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  private _fKeyHeld = false;
}
