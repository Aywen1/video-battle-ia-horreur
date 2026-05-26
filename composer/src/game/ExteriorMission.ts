import * as THREE from 'three';
import { WorldState } from './WorldState';
import { EXTERIOR_LOCATIONS, getNextWaypoint } from '../world/exteriorTerrain';

export type ExteriorStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface MissionUpdate {
  text: string;
  label: string;
}

export class ExteriorMission {
  constructor(private world: WorldState) {}

  getStep(): ExteriorStep {
    return this.world.exteriorStep as ExteriorStep;
  }

  advanceStep(): MissionUpdate | null {
    if (this.world.exteriorStep >= 12) return null;
    this.world.exteriorStep = (this.world.exteriorStep + 1) as ExteriorStep;
    return this.getMissionForStep(this.world.exteriorStep as ExteriorStep);
  }

  getIntroMission(): MissionUpdate {
    return {
      text:
        'OBJECTIF 1/12 — Marchez vers le NORD sur la route (touche Z). ' +
        'Appuyez sur [E] à la borne kilométrique.',
      label: 'ACTE 3 — ÉTAPE 1',
    };
  }

  getMissionForStep(step: ExteriorStep): MissionUpdate {
    switch (step) {
      case 1:
        return {
          text:
            'OBJECTIF 2/12 — Continuez au NORD jusqu\'à l\'épave (à droite). [E] pour fouiller.',
          label: 'ÉTAPE 2',
        };
      case 2:
        return {
          text:
            'OBJECTIF 3/12 — Allez à GAUCHE (Q) vers le panneau « SENTIER 7 ». ' +
            'Suivez les flèches rouges au sol.',
          label: 'ÉTAPE 3 — SENTIER',
        };
      case 3:
        return {
          text:
            'OBJECTIF 4/12 — Montez le sentier. [E] sur la flaque de sang.',
          label: 'ÉTAPE 4 — SANG',
        };
      case 4:
        return {
          text:
            'OBJECTIF 5/12 — Continuez vers le haut. [E] sur le corps dans l\'arbre.',
          label: 'ÉTAPE 5 — CORPS',
        };
      case 5:
        return {
          text:
            'OBJECTIF 6/12 — Atteignez la croix au sommet. [E] — la nuit va tomber.',
          label: 'ÉTAPE 6 — CROIX',
        };
      case 6:
        return {
          text:
            'OBJECTIF 7/12 — Redescendez vers la cabane (flanc ouest). Restez sur le sentier.',
          label: 'ÉTAPE 7 — DESCENTE',
        };
      case 7:
        return {
          text:
            'OBJECTIF 8/12 — Entrez dans la cabane. [E] pour lire le journal sanglant.',
          label: 'ÉTAPE 8 — CABANE',
        };
      case 8:
        return {
          text:
            'OBJECTIF 9/12 — Un monstre vous poursuit ! Courez vers le boîtier relais près du bâtiment.',
          label: 'ÉTAPE 9 — POURSUITE',
        };
      case 9:
        return {
          text:
            'OBJECTIF 10/12 — Maintenez [E] 2 s sur le boîtier relais pour réparer l\'antenne.',
          label: 'ÉTAPE 10 — BOÎTIER',
        };
      case 10:
        return {
          text:
            'OBJECTIF 11/12 — [E] sur la porte du relais. Traversez le bâtiment.',
          label: 'ÉTAPE 11 — RELAIS',
        };
      case 11:
        return {
          text:
            'OBJECTIF 12/12 — Reprenez la route au NORD. Des silhouettes vous guettent. ' +
            'Atteignez la barrière rouge.',
          label: 'ÉTAPE 12 — ROUTE',
        };
      case 12:
        return {
          text: 'La barrière finale est devant vous. [E] pour conclure l\'Acte 3.',
          label: 'FINALE',
        };
      default:
        return this.getIntroMission();
    }
  }

  getTrailHint(step: number, playerPos: THREE.Vector3): string {
    const wp = getNextWaypoint(step);
    if (!wp) return '';
    const dist = Math.round(playerPos.distanceTo(wp));
    if (step === 2) {
      return `→ Panneau SENTIER 7 à GAUCHE (~${dist} m) — suivez les flèches rouges`;
    }
    if (step >= 3 && step <= 5) {
      return `→ Sentier vers le haut (~${dist} m) — traces de sang au sol`;
    }
    if (step === 6 || step === 7) {
      return `→ Cabane en contrebas (~${dist} m)`;
    }
    if (step === 8 || step === 9) {
      return `→ Boîtier relais près du bâtiment (~${dist} m) — F pour lampe`;
    }
    if (step === 10) {
      return `→ Porte du relais (~${dist} m)`;
    }
    if (step >= 11) {
      return `→ Barrière au bout de la route NORD (~${dist} m)`;
    }
    return '';
  }

  getInteractHint(step: ExteriorStep): string | null {
    switch (step) {
      case 0:
        return '[E] Borne km — route au NORD';
      case 1:
        return '[E] Fouiller l\'épave (route, à droite)';
      case 3:
        return '[E] Examiner la flaque de sang';
      case 4:
        return '[E] Examiner le corps dans l\'arbre';
      case 5:
        return '[E] Examiner la croix — la nuit tombe';
      case 7:
        return '[E] Lire le journal dans la cabane';
      case 9:
        return '[E] Maintenir 2 s — réparer le boîtier';
      case 10:
        return '[E] Ouvrir la porte du relais';
      case 12:
        return '[E] Barrière finale — terminer';
      default:
        return null;
    }
  }

  canInteract(id: string): boolean {
    const s = this.world.exteriorStep;
    switch (id) {
      case 'ext_marker':
        return s === 0;
      case 'ext_wreck':
        return s === 1;
      case 'ext_blood':
        return s === 3;
      case 'ext_body':
        return s === 4;
      case 'ext_cross':
        return s === 5;
      case 'ext_shack':
        return s === 7;
      case 'ext_relay':
        return s === 9;
      case 'ext_door':
        return s === 10;
      case 'ext_barrier':
        return s === 12;
      default:
        return false;
    }
  }
}
