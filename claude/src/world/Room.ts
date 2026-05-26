/**
 * Room : classe de base pour toute salle du jeu. Expose la liste de colliders
 * AABB statiques, la position de spawn et les hooks de update/dispose.
 */
import { Box3, Group, Scene, Vector3 } from 'three';
import type { AudioEngine } from '../audio/AudioEngine';
import type { HUD } from '../ui/HUD';
import type { SmileMeter } from '../webcam/SmileMeter';
import type { SmileDetector } from '../webcam/SmileDetector';
import type { PostFX } from '../rendering/PostFX';
import type { MicrophoneInput } from '../audio/MicrophoneInput';

export abstract class Room {
  group = new Group();
  colliders: Box3[] = [];
  spawnPosition = new Vector3(0, 1.65, 0);
  spawnYaw = 0;
  spawnPitch = 0;

  abstract update(dt: number, ctx: RoomUpdateContext): void;
  abstract dispose(): void;

  /** Liste des interactables actuellement présents (rechargée à chaque update si besoin). */
  abstract getInteractables(): Interactable[];

  /** Hook appelé juste après que la salle a été ajoutée à la scène. Par défaut noop. */
  onEnter(): void {
    /* override si besoin */
  }
}

/**
 * Dependencies communes à toutes les salles. Permet à `Game.ts` d'instancier
 * des salles polymorphes via un factory.
 */
export interface RoomDeps {
  scene: Scene;
  audio: AudioEngine;
  hud: HUD;
  smileMeter: SmileMeter;
  smileDetector: SmileDetector;
  postFX: PostFX;
  webcamVideo: HTMLVideoElement | null;
  microphone: MicrophoneInput;
  setCinematicCamera(offset: Vector3 | null, weight: number, pitch?: number, yaw?: number): void;
  requestRoomTransition(factory: (deps: RoomDeps) => Room, fadeMs?: number): void;
}

export interface RoomUpdateContext {
  time: number;
  playerPosition: Vector3;
  /** Yaw monde du joueur (caméra horizontale). Utile aux mécaniques type Weeping Angel. */
  playerYaw: number;
  playerPitch: number;
  smileMeter: {
    meter: number;
    stress: number;
    belowComfort: boolean;
    belowCritical: boolean;
    inWarning: boolean;
    faceLost: boolean;
    zone: 0 | 1 | 2 | 3;
  };
}

export interface Interactable {
  /** Pour l'instant on raycast contre une bounding sphere par simplicité. */
  position: Vector3;
  radius: number;
  label: string;
  onInteract(): void;
  enabled: boolean;
}
