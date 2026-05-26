import * as THREE from 'three';
import { AudioManager } from '../../audio/AudioManager';
import { AnimationSystem } from '../AnimationSystem';
import { WorldState } from '../WorldState';

import { ScreamerType } from './ScreamerOverlay';

export interface ServerHorrorContext {
  serverDoorPivot: THREE.Group;
  rackDoors: THREE.Mesh[];
  scareFigure: THREE.Group;
  serverLights: THREE.PointLight[];
  playerPos: THREE.Vector3;
  playerYaw: number;
  camera: THREE.Camera;
  onFlash: () => void;
  onMission: (text: string, label?: string) => void;
  onFinale: () => void;
  onFullscreenScreamer?: (type: ScreamerType) => Promise<void>;
}

export class ServerHorror {
  zoneElapsed = 0;
  buildUp = 0;
  entryDoorDone = false;
  drillStarted = false;
  screamerDone = false;
  finaleDone = false;

  constructor(
    private audio: AudioManager,
    private world: WorldState,
    private anim: AnimationSystem
  ) {}

  reset(): void {
    this.zoneElapsed = 0;
    this.buildUp = 0;
    this.entryDoorDone = false;
    this.drillStarted = false;
    this.screamerDone = false;
  }

  onEnterServer(ctx: ServerHorrorContext): void {
    if (this.entryDoorDone) return;
    this.entryDoorDone = true;
    this.anim.tweenRotationY(ctx.serverDoorPivot, -Math.PI * 0.45, 1.2);
    this.audio.playDoorSlam();
  }

  update(dt: number, ctx: ServerHorrorContext): void {
    if (this.world.phase !== 'server' && this.world.phase !== 'finale') return;
    this.zoneElapsed += dt;
    this.buildUp += dt;

    if (this.buildUp > 25 && !this.drillStarted) {
      this.drillStarted = true;
      this.audio.playFaxTone();
      this.world.playerHasSeenAnomaly = true;
    }

    if (this.buildUp > 20) {
      this.world.playerHasSeenAnomaly = true;
    }

    this.updateRackDoors(dt, ctx);
  }

  private updateRackDoors(dt: number, ctx: ServerHorrorContext): void {
    for (const door of ctx.rackDoors) {
      const rackPos = new THREE.Vector3();
      door.getWorldPosition(rackPos);
      const toRack = rackPos.sub(ctx.playerPos);
      const forward = new THREE.Vector3(0, 0, -1)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), ctx.playerYaw);
      if (forward.dot(toRack.normalize()) < -0.3 && door.rotation.y < 0.4) {
        door.rotation.y = THREE.MathUtils.lerp(door.rotation.y, 0.5, dt * 2);
        this.world.playerHasSeenAnomaly = true;
      }
    }
  }

  triggerBeaconScreamer(ctx: ServerHorrorContext): void {
    if (this.screamerDone || !this.world.canUseScreamer()) return;
    this.screamerDone = true;
    this.world.registerScreamer();

    const behind = ctx.playerPos.clone();
    const back = new THREE.Vector3(
      Math.sin(ctx.playerYaw),
      0,
      Math.cos(ctx.playerYaw)
    );
    behind.add(back.multiplyScalar(1.8));
    ctx.scareFigure.position.copy(behind);
    ctx.scareFigure.position.y = 0;

    const forward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(ctx.camera.quaternion);
    const toFigure = ctx.scareFigure.position.clone().sub(ctx.playerPos).normalize();
    if (forward.dot(toFigure) < 0.2) {
      ctx.scareFigure.visible = true;
      setTimeout(() => {
        ctx.scareFigure.visible = false;
      }, 200);
    }

    for (const l of ctx.serverLights) {
      l.intensity = 2.5;
    }
    setTimeout(() => {
      for (const l of ctx.serverLights) {
        l.intensity = 0.75;
      }
    }, 200);

    this.audio.playScareSting();
    ctx.onFlash();
    void ctx.onFullscreenScreamer?.('silhouette_window');
  }

  startFinale(ctx: ServerHorrorContext): void {
    if (this.finaleDone) return;
    this.finaleDone = true;
    this.world.phase = 'finale';
    this.world.finaleStarted = true;

    let delay = 0;
    for (let i = 0; i < 4; i++) {
      setTimeout(() => this.audio.playPhoneRing(), delay);
      delay += 2200;
    }

    ctx.onFinale();
    ctx.onMission(
      'La balise est coupée, mais le standard se met à sonner : quatre appels entrants s\'enchaînent, sans réponse possible. ' +
        'La sortie d\'urgence est ouverte — mur est de la salle serveurs ou trappe nord du couloir tour.',
      'FINALE — RELAIS 7'
    );
  }
}
