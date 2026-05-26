import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

/**
 * Scripts de malaise — build-up avant chaque pic.
 */
export class HorrorEvents {
  elapsed = 0;
  footstepTriggered = false;
  faxTriggered = false;
  voiceTriggered = false;
  chairMoved = false;
  lightningReady = false;
  crtFaceShown = false;

  private chair: THREE.Object3D | null = null;
  private chairOriginalRot = 0;
  private outsideFigure: THREE.Mesh | null = null;

  constructor(
    private audio: AudioManager,
    private onCrtWarning: (show: boolean) => void,
    private onFlash: () => void,
    private onMissionChange: (text: string, label?: string) => void
  ) {}

  registerChair(chair: THREE.Object3D): void {
    this.chair = chair;
    this.chairOriginalRot = chair.rotation.y;
  }

  registerOutsideFigure(mesh: THREE.Mesh): void {
    this.outsideFigure = mesh;
    mesh.visible = false;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    lookingAtCRT: boolean,
    crtStareTime: number
  ): void {
    this.elapsed += dt;

    if (this.elapsed > 18 && !this.footstepTriggered) {
      this.footstepTriggered = true;
      this.audio.playFootstepAbove();
      setTimeout(() => this.audio.playFootstepAbove(), 0.45);
    }

    if (this.elapsed > 28 && this.chair && !this.chairMoved) {
      this.chairMoved = true;
    }
    if (this.chair && this.chairMoved) {
      const target = this.chairOriginalRot + 0.35;
      this.chair.rotation.y = THREE.MathUtils.lerp(
        this.chair.rotation.y,
        target,
        dt * 0.5
      );
    }

    if (this.elapsed > 35 && !this.faxTriggered) {
      this.faxTriggered = true;
      this.audio.playFaxTone();
    }

    if (this.elapsed > 42 && !this.voiceTriggered) {
      this.voiceTriggered = true;
      this.audio.playSyntheticVoice('BADGE SECTEUR SEPT NON ENREGISTRE');
      this.onMissionChange(
        'Une voix synthétique a répondu sur les haut-parleurs : elle a lu un numéro de badge que vous n\'avez pas encore enregistré. ' +
          'Terminez les contrôles de la console et du casque, puis évitez de fixer les écrans CRT trop longtemps.',
        'ANOMALIE RADIO'
      );
    }

    if (lookingAtCRT && crtStareTime > 5) {
      this.onCrtWarning(true);
      if (crtStareTime > 6 && !this.crtFaceShown) {
        this.crtFaceShown = true;
        this.audio.playStaticBurst(0.6);
      }
    } else {
      this.onCrtWarning(false);
    }

    if (this.crtFaceShown && !lookingAtCRT && !this.lightningReady) {
      this.lightningReady = true;
      setTimeout(() => this.triggerLightningScare(), 800);
    }

    void playerPos;
  }

  private triggerLightningScare(): void {
    this.audio.playThunder();
    this.onFlash();
    if (this.outsideFigure) {
      this.outsideFigure.visible = true;
      setTimeout(() => {
        if (this.outsideFigure) this.outsideFigure.visible = false;
      }, 120);
    }
  }
}
