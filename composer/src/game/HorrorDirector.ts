import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { HorrorEvents } from './HorrorEvents';
import { TowerHorror } from './horror/TowerHorror';
import { ServerHorror } from './horror/ServerHorror';
import { ExteriorHorror } from './horror/ExteriorHorror';
import { UndercoreHorror } from './horror/UndercoreHorror';
import { ScreamerType } from './horror/ScreamerOverlay';
import { AnimationSystem } from './AnimationSystem';
import { WorldState } from './WorldState';

export class HorrorDirector {
  cabin: HorrorEvents;
  tower: TowerHorror;
  server: ServerHorror;
  exterior: ExteriorHorror;
  undercore: UndercoreHorror;

  constructor(
    audio: AudioManager,
    world: WorldState,
    anim: AnimationSystem,
    onCrtWarning: (show: boolean) => void,
    onFlash: () => void,
    onMission: (text: string, label?: string) => void,
    onFullscreenScreamer: (type: ScreamerType) => Promise<void>
  ) {
    this.cabin = new HorrorEvents(audio, onCrtWarning, onFlash, onMission);
    this.tower = new TowerHorror(audio, world, anim);
    this.server = new ServerHorror(audio, world, anim);
    this.exterior = new ExteriorHorror(audio, world, onFullscreenScreamer);
    this.undercore = new UndercoreHorror(audio, world, onFullscreenScreamer);
  }

  registerChair(chair: THREE.Object3D): void {
    this.cabin.registerChair(chair);
  }

  registerOutsideFigure(mesh: THREE.Mesh): void {
    this.cabin.registerOutsideFigure(mesh);
  }

  registerTowerSilhouette(mesh: THREE.Mesh): void {
    this.tower.registerSilhouette(mesh);
  }

  updateCabin(
    dt: number,
    playerPos: THREE.Vector3,
    lookingAtCRT: boolean,
    crtStareTime: number
  ): void {
    this.cabin.update(dt, playerPos, lookingAtCRT, crtStareTime);
  }
}
