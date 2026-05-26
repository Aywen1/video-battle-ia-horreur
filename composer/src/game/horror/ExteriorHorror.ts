import * as THREE from 'three';

import { AudioManager } from '../../audio/AudioManager';

import { WorldState } from '../WorldState';

import { ScreamerType } from './ScreamerOverlay';

import { lightBuildingWindows } from '../../world/ExteriorZone';

import { CLIFF_Z } from '../../world/exteriorColliders';

import { EXTERIOR_LOCATIONS } from '../../world/exteriorTerrain';

import {

  spawnFootprintBurst,

  updateMirageOpacity,

} from '../../world/exteriorParanormal';

import { ParticleManager } from '../../rendering/ParticleManager';

import { LightingDirector } from '../../rendering/LightingDirector';

import { ExteriorMonsters } from './ExteriorMonsters';



export interface ExteriorHorrorContext {

  playerPos: THREE.Vector3;

  playerYaw: number;

  playerPitch: number;

  camera: THREE.Camera;

  scene: THREE.Scene;

  buildingWindows: THREE.MeshStandardMaterial[];

  treelineFigure: THREE.Group;

  mirageBuilding: THREE.Group;

  particles: ParticleManager | null;

  lighting: LightingDirector | null;

  monsters: ExteriorMonsters | null;

  gameTime: number;

  onFlash: () => void;

  onMission: (text: string, label?: string) => void;

  onFinaleEnd: () => void;

  onEnterUndercore: () => void;

  onTriggerEnding: () => void;

  pushPlayer: (dir: THREE.Vector3) => void;

}



export class ExteriorHorror {

  zoneElapsed = 0;

  footstepsDone = false;

  seaScreamerDone = false;

  wreckScreamerDone = false;

  bodyScreamerDone = false;

  buildingScreamerDone = false;

  whisperDone = false;

  mirageShown = false;

  relayScareDone = false;

  footprintTimer = 0;

  lookBackScreamerDone = false;

  silhouetteLookTime = 0;

  endingTriggered = false;



  constructor(

    private audio: AudioManager,

    private world: WorldState,

    private onFullscreenScreamer: (type: ScreamerType) => Promise<void>

  ) {}



  reset(): void {

    this.zoneElapsed = 0;

    this.footstepsDone = false;

    this.seaScreamerDone = false;

    this.wreckScreamerDone = false;

    this.bodyScreamerDone = false;

    this.buildingScreamerDone = false;

    this.whisperDone = false;

    this.mirageShown = false;

    this.relayScareDone = false;

    this.footprintTimer = 0;

    this.lookBackScreamerDone = false;

    this.silhouetteLookTime = 0;

    this.endingTriggered = false;
  }

  update(dt: number, ctx: ExteriorHorrorContext): void {

    if (!this.world.isExteriorPhase()) return;

    this.zoneElapsed += dt;

    const step = this.world.exteriorStep;



    if (this.zoneElapsed > 5 && !this.footstepsDone) {

      this.footstepsDone = true;

      this.audio.playDistantFootsteps();

    }



    if (step >= 1) {

      this.updateTreelineSilhouette(dt, ctx);

    }



    if (step >= 2 && !this.seaScreamerDone && this.isLookingAtSea(ctx)) {

      void this.triggerSeaScreamer(ctx);

    }



    if (step >= 3 && ctx.playerPos.z > 14 && !this.whisperDone) {

      this.whisperDone = true;

      this.audio.playWhisper();

    }



    if (step >= 11 && !this.mirageShown) {

      this.mirageShown = true;

      ctx.mirageBuilding.visible = true;

      this.audio.playMountainEcho();

      ctx.onMission(

        'Un second relais brille dans la vallée — impossible, vous venez de le quitter.',

        'MIRAGE'

      );

    }

    updateMirageOpacity(ctx.mirageBuilding, ctx.playerPos, step >= 11);



    if (step >= 10 && !this.relayScareDone) {

      this.relayScareDone = true;

      lightBuildingWindows(ctx.buildingWindows, ctx.buildingWindows.length);

      if (ctx.playerPos.distanceTo(EXTERIOR_LOCATIONS.buildingDoor) < 12) {

        void this.triggerBuildingScreamer(ctx);

      }

    }



    if (step >= 11) {

      this.footprintTimer += dt;

      if (this.footprintTimer > 8) {

        this.footprintTimer = 0;

        const behind = ctx.playerPos.clone();

        behind.x += Math.sin(ctx.playerYaw) * 3;

        behind.z += Math.cos(ctx.playerYaw) * 3;

        spawnFootprintBurst(ctx.particles, behind);

        this.audio.playWrongFootstep();

        this.checkLookBack(ctx, behind);

      }

    }



    if (ctx.monsters) {

      ctx.monsters.update(

        dt,

        step,

        {

          playerPos: ctx.playerPos,

          playerYaw: ctx.playerYaw,

          camera: ctx.camera,

          onFlash: ctx.onFlash,

          onScreamer: (type) => this.triggerScreamer(ctx, type),

          pushPlayer: ctx.pushPlayer,

        },

        this.audio,

        ctx.gameTime

      );

    }

  }



  onEnterExterior(ctx: ExteriorHorrorContext): void {

    this.reset();

    ctx.treelineFigure.visible = false;

    ctx.mirageBuilding.visible = false;

    ctx.monsters?.reset();

    this.audio.playWindAmbient();

  }



  onWreckSearched(ctx: ExteriorHorrorContext): void {

    if (this.wreckScreamerDone) return;

    this.wreckScreamerDone = true;

    this.audio.playStaticBurst(0.55);

    void this.triggerScreamer(ctx, 'hands_glass');

  }



  onBodyExamined(ctx: ExteriorHorrorContext): void {

    if (this.bodyScreamerDone) return;

    this.bodyScreamerDone = true;

    void this.triggerScreamer(ctx, 'face_close');

  }



  onShackRead(ctx: ExteriorHorrorContext): void {

    this.audio.playWhisper();

    ctx.onMission(

      'Le journal parle de « ceux qui rampent dans le noir ». Courez vers le relais.',

      'CABANE'

    );

  }



  onRelayFixed(ctx: ExteriorHorrorContext): void {

    lightBuildingWindows(ctx.buildingWindows, ctx.buildingWindows.length, 1.5);

  }



  triggerFinalEnding(ctx: ExteriorHorrorContext): void {

    if (this.endingTriggered) return;

    this.endingTriggered = true;

    void this.triggerEnding(ctx);

  }



  private updateTreelineSilhouette(dt: number, ctx: ExteriorHorrorContext): void {

    const fig = ctx.treelineFigure;

    const dist = ctx.playerPos.distanceTo(fig.position);

    if (dist > 25 || dist < 8) {

      fig.visible = false;

      this.silhouetteLookTime = 0;

      return;

    }

    fig.visible = true;

    const toFig = fig.position.clone().sub(ctx.playerPos).normalize();

    const forward = new THREE.Vector3(0, 0, -1)

      .applyAxisAngle(new THREE.Vector3(0, 1, 0), ctx.playerYaw);

    const dot = forward.dot(toFig);

    if (dot > 0.5) {

      this.silhouetteLookTime += dt;

      if (this.silhouetteLookTime > 1) fig.visible = false;

    } else {

      this.silhouetteLookTime = 0;

      fig.position.x += (ctx.playerPos.x - fig.position.x) * dt * 0.15;

    }

  }



  private checkLookBack(ctx: ExteriorHorrorContext, behind: THREE.Vector3): void {

    if (this.lookBackScreamerDone) return;

    const toPrints = behind.clone().sub(ctx.playerPos).normalize();

    const forward = new THREE.Vector3(0, 0, -1)

      .applyAxisAngle(new THREE.Vector3(0, 1, 0), ctx.playerYaw);

    if (forward.dot(toPrints) > 0.6) {

      this.lookBackScreamerDone = true;

      void this.triggerScreamer(ctx, 'silhouette_window');

    }

  }



  private isLookingAtSea(ctx: ExteriorHorrorContext): boolean {

    if (ctx.playerPitch > -0.1) return false;

    const forward = new THREE.Vector3(0, 0, -1)

      .applyAxisAngle(new THREE.Vector3(0, 1, 0), ctx.playerYaw);

    return forward.z < -0.4 && ctx.playerPos.z > CLIFF_Z + 25;

  }



  private async triggerScreamer(

    ctx: ExteriorHorrorContext,

    type: ScreamerType

  ): Promise<void> {

    if (!this.world.canUseScreamer()) return;

    this.world.registerScreamer();

    this.audio.playExteriorSting();

    ctx.onFlash();

    await this.onFullscreenScreamer(type);

  }



  private async triggerSeaScreamer(ctx: ExteriorHorrorContext): Promise<void> {

    this.seaScreamerDone = true;

    await this.triggerScreamer(ctx, 'silhouette_window');

  }



  private async triggerBuildingScreamer(ctx: ExteriorHorrorContext): Promise<void> {

    if (this.buildingScreamerDone) return;

    this.buildingScreamerDone = true;

    await this.triggerScreamer(ctx, 'face_close');

  }



  private async triggerEnding(ctx: ExteriorHorrorContext): Promise<void> {

    this.world.registerScreamer();

    this.audio.playExteriorSting();

    ctx.onFlash();

    await this.onFullscreenScreamer('face_close');

    ctx.onMission(
      'La barrière s\'effondre. Le sol cède. Quelque chose vous tire vers le noyau de la balise.',
      'ACTE 4'
    );

    ctx.onEnterUndercore();
  }

}

