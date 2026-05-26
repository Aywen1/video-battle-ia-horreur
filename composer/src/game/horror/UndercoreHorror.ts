import * as THREE from 'three';
import { AudioManager } from '../../audio/AudioManager';
import { WorldState } from '../WorldState';
import { ScreamerType } from './ScreamerOverlay';
import { ParticleManager } from '../../rendering/ParticleManager';
import { spawnBloodBurst } from '../../world/exteriorBlood';

export interface UndercoreHorrorContext {
  playerPos: THREE.Vector3;
  playerYaw: number;
  playerPitch: number;
  camera: THREE.Camera;
  organMass: THREE.Group;
  mirrorFigure: THREE.Group;
  neonLights: THREE.PointLight[];
  badgeMeshes: THREE.Mesh[];
  crtMeshes: THREE.Mesh[];
  particles: ParticleManager | null;
  gameTime: number;
  onFlash: () => void;
  onMission: (text: string, label?: string) => void;
  onGameEnd: () => void;
}

export class UndercoreHorror {
  private entryDone = false;
  private badgeFallDone = false;
  private crtVoiceDone = false;
  private corpseScareDone = false;
  private mirrorStareTime = 0;
  private mirrorScareDone = false;
  private endingTriggered = false;

  constructor(
    private audio: AudioManager,
    private world: WorldState,
    private onFullscreenScreamer: (type: ScreamerType) => Promise<void>
  ) {}

  reset(): void {
    this.entryDone = false;
    this.badgeFallDone = false;
    this.crtVoiceDone = false;
    this.corpseScareDone = false;
    this.mirrorStareTime = 0;
    this.mirrorScareDone = false;
    this.endingTriggered = false;
  }

  onEnter(ctx: UndercoreHorrorContext): void {
    this.reset();
    ctx.mirrorFigure.visible = false;
    this.audio.playWhisper();
    this.audio.playHeartbeat(0.4);
    ctx.onMission(
      'L\'obscurité vous avale. Le sol pulse faiblement sous vos pas.',
      'SOUS LA BALISE'
    );
  }

  onBadgesRead(ctx: UndercoreHorrorContext): void {
    if (!this.badgeFallDone) {
      this.badgeFallDone = true;
      if (ctx.badgeMeshes[0]) {
        ctx.badgeMeshes[0].rotation.z = 0.8;
        ctx.badgeMeshes[0].position.y -= 0.4;
      }
      spawnBloodBurst(ctx.particles, ctx.playerPos.clone().setY(ctx.playerPos.y - 0.5));
      this.audio.playStaticBurst(0.3);
    }
    ctx.onMission(
      'Douze badges. Même matricule : 7-Δ. Même visage effacé. Vous n\'êtes pas le premier.',
      'BADGES'
    );
  }

  onCrtsViewed(ctx: UndercoreHorrorContext): void {
    if (!this.crtVoiceDone) {
      this.crtVoiceDone = true;
      ctx.crtMeshes.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 1.2;
      });
      this.audio.playSyntheticVoice('VOUS N AVEZ JAMAIS QUITTE LA CABINE');
      this.audio.playStaticBurst(0.5);
    }
    ctx.onMission(
      'Les CRTs rejouent vos actes. La balise n\'émet pas la position du relais — elle émet la vôtre. ' +
        'L\'extérieur était généré pour vous faire courir.',
      'RÉVÉLATION'
    );
  }

  async onCorpseRead(ctx: UndercoreHorrorContext): Promise<void> {
    if (this.corpseScareDone) return;
    this.corpseScareDone = true;
    spawnBloodBurst(ctx.particles, ctx.playerPos);
    this.audio.playExteriorSting();
    ctx.onFlash();
    await this.onFullscreenScreamer('mirror_self');
    ctx.onMission(
      'Le journal est écrit de votre main : « Je suis le signal. Je suis le relais. »',
      'CORPS'
    );
  }

  onFilamentCut(ctx: UndercoreHorrorContext): void {
    ctx.onMission(
      'Le filament se rompt. Un instant de silence. Puis… quelque chose respire encore.',
      'FILAMENT'
    );
  }

  onMirrorSeen(ctx: UndercoreHorrorContext): void {
    ctx.mirrorFigure.visible = true;
    this.audio.playIdentityVoice();
    ctx.onMission(
      'Le reflet n\'a pas vos yeux. Il n\'a jamais eu votre vie — seulement votre signal.',
      'MIROIR'
    );
  }

  triggerFinalEnding(ctx: UndercoreHorrorContext): void {
    if (this.endingTriggered) return;
    this.endingTriggered = true;
    void this.runEnding(ctx);
  }

  update(dt: number, ctx: UndercoreHorrorContext): void {
    if (!this.world.isUndercorePhase()) return;
    const step = this.world.undercoreStep;

    if (!this.entryDone) {
      this.entryDone = true;
    }

    this.audio.playHeartbeat(0.25 + step * 0.08);

    if (step >= 4 && ctx.organMass) {
      const pulse = 1 + Math.sin(ctx.gameTime * 4) * 0.06;
      ctx.organMass.scale.setScalar(pulse);
      if (step === 4) this.audio.playOrganPulse();
    }

    if (step >= 5 && ctx.mirrorFigure.visible) {
      const toMirror = new THREE.Vector3(0, 0, 44).sub(ctx.playerPos).normalize();
      const forward = new THREE.Vector3(0, 0, -1)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), ctx.playerYaw);
      if (forward.dot(toMirror) > 0.55) {
        this.mirrorStareTime += dt;
        if (this.mirrorStareTime > 2 && !this.mirrorScareDone) {
          this.mirrorScareDone = true;
          void this.onFullscreenScreamer('mirror_self');
        }
      } else {
        this.mirrorStareTime = 0;
      }
    }

    if (step >= 6) {
      ctx.neonLights.forEach((l, i) => {
        l.intensity = Math.max(0, 0.5 - (ctx.gameTime * 0.3 + i) % 3 * 0.2);
      });
    }
  }

  updateOrganHold(active: boolean, ctx: UndercoreHorrorContext): void {
    if (!active || this.world.undercoreStep !== 4) return;
    ctx.organMass.scale.setScalar(1 + Math.sin(ctx.gameTime * 8) * 0.08);
    this.audio.playOrganPulse();
  }

  private async runEnding(ctx: UndercoreHorrorContext): Promise<void> {
    ctx.neonLights.forEach((l) => (l.intensity = 0));
    this.audio.playExteriorSting();
    ctx.onFlash();
    await this.onFullscreenScreamer('face_close');
    this.audio.playSyntheticVoice('BALISE SEPT SIGNAL RETABLI TECHNICIEN SEPT DELTA ENREGISTRE');
    this.audio.playLoopStatic();
    this.world.phase = 'undercore_finale';
    this.world.gameEnded = true;
    ctx.onMission(
      'Vous avez tout appris. Rien n\'a changé. La balise continue. Une autre itération vous remplace déjà.',
      'FIN — RELAIS 7'
    );
    ctx.onGameEnd();
  }
}
