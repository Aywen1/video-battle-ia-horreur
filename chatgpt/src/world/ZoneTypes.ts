import * as THREE from 'three';
import type { AdminCondition } from '../core/AdminTypes';
import type { Interactable } from '../interactions/InteractionSystem';

export type WorldZone = {
  readonly obstacles: THREE.Box3[];
  readonly interactables: Interactable[];
  update(delta: number, elapsed: number, camera: THREE.Camera): void;
  getAdminConditions(): AdminCondition[];
};

export type EndingKind = 'refuse' | 'occupant';
