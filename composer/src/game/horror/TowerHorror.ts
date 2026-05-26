import * as THREE from 'three';
import { AudioManager } from '../../audio/AudioManager';
import { AnimationSystem } from '../AnimationSystem';
import { WorldState } from '../WorldState';

import { ScreamerType } from './ScreamerOverlay';

export interface TowerHorrorContext {
  antennaPivot: THREE.Group;
  towerLights: THREE.PointLight[];
  scareFigure: THREE.Group;
  playerPos: THREE.Vector3;
  playerYaw: number;
  playerPitch: number;
  camera: THREE.Camera;
  onFlash: () => void;
  onMission: (text: string, label?: string) => void;
  onFullscreenScreamer?: (type: ScreamerType) => Promise<void>;
}

export class TowerHorror {
  zoneElapsed = 0;
  buildUp = 0;
  lightsOff = 0;
  windowSilhouetteShown = false;
  antennaLookTime = 0;
  antennaRotated = false;
  screamerDone = false;
  private silhouette: THREE.Mesh | null = null;

  constructor(
    private audio: AudioManager,
    private world: WorldState,
    private anim: AnimationSystem
  ) {}

  reset(): void {
    this.zoneElapsed = 0;
    this.buildUp = 0;
    this.lightsOff = 0;
    this.windowSilhouetteShown = false;
    this.antennaLookTime = 0;
    this.antennaRotated = false;
    this.screamerDone = false;
  }

  registerSilhouette(mesh: THREE.Mesh): void {
    this.silhouette = mesh;
    mesh.visible = false;
  }

  update(dt: number, ctx: TowerHorrorContext): void {
    if (this.world.phase !== 'tower') return;
    this.zoneElapsed += dt;
    this.buildUp += dt;

    if (this.zoneElapsed > 8 && this.lightsOff < ctx.towerLights.length) {
      const idx = Math.floor((this.zoneElapsed - 8) / 2);
      if (idx > this.lightsOff && idx <= ctx.towerLights.length) {
        this.lightsOff = idx;
        for (let i = 0; i < this.lightsOff; i++) {
          this.anim.tweenLightIntensity(ctx.towerLights[i], 0.05, 0.4);
        }
      }
    }

    if (this.buildUp > 20 && !this.windowSilhouetteShown && this.silhouette) {
      this.windowSilhouetteShown = true;
      this.silhouette.visible = true;
      setTimeout(() => {
        if (this.silhouette) this.silhouette.visible = false;
      }, 120);
      this.audio.playHallwayDraft();
    }

    this.updateAntenna(dt, ctx);

    if (this.buildUp > 20) {
      this.world.playerHasSeenAnomaly = true;
    }
  }

  private updateAntenna(dt: number, ctx: TowerHorrorContext): void {
    const antPos = new THREE.Vector3();
    ctx.antennaPivot.getWorldPosition(antPos);
    const toAnt = antPos.clone().sub(ctx.playerPos).normalize();
    const forward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(ctx.camera.quaternion)
      .normalize();
    const dot = forward.dot(toAnt);

    if (dot > 0.35) {
      this.antennaLookTime += dt;
      if (this.antennaLookTime > 3) {
        this.audio.playStaticBurst(0.15);
        this.world.playerHasSeenAnomaly = true;
        this.world.antennaAnomalySeen = true;
      }
    } else if (dot < -0.2 && !this.antennaRotated) {
      this.antennaRotated = true;
      this.world.playerHasSeenAnomaly = true;
      this.world.antennaAnomalySeen = true;
      this.anim.tweenRotationY(
        ctx.antennaPivot,
        ctx.antennaPivot.rotation.y + THREE.MathUtils.degToRad(15),
        0.6
      );
      this.audio.playMetalCreak();
    } else {
      this.antennaLookTime = Math.max(0, this.antennaLookTime - dt);
    }
  }

  triggerBreakerScreamer(ctx: TowerHorrorContext): void {
    if (this.screamerDone || !this.world.canUseScreamer()) return;
    if (!this.world.antennaAnomalySeen) return;

    this.screamerDone = true;
    this.world.registerScreamer();

    for (const l of ctx.towerLights) {
      l.intensity = 0;
    }
    setTimeout(() => {
      for (const l of ctx.towerLights) {
        l.intensity = 0.85;
      }
    }, 300);

    ctx.scareFigure.visible = true;
    setTimeout(() => {
      ctx.scareFigure.visible = false;
    }, 150);

    this.audio.playScareSting();
    ctx.onFlash();
    void ctx.onFullscreenScreamer?.('face_close');
    ctx.onMission(
      'Le disjoncteur a basculé dans le noir. Une silhouette a traversé la cage d\'escalier — redescendez vite vers la salle serveurs.',
      'TRANSFERT ACTIF'
    );
  }
}
