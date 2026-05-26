import { WorldState } from './WorldState';

export type UndercoreStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface MissionUpdate {
  text: string;
  label: string;
}

export class UndercoreMission {
  constructor(private world: WorldState) {}

  getIntroMission(): MissionUpdate {
    return {
      text:
        'OBJECTIF 1/7 — Vous tombez sous la balise. L\'air sent le fer et la chair. ' +
        'Descendez le couloir vers le nord (Z). Trouvez ce qui émet le signal.',
      label: 'ACTE 4 — SOUS LA BALISE',
    };
  }

  advanceStep(): MissionUpdate | null {
    if (this.world.undercoreStep >= 6) return null;
    this.world.undercoreStep = (this.world.undercoreStep + 1) as UndercoreStep;
    return this.getMissionForStep(this.world.undercoreStep as UndercoreStep);
  }

  getMissionForStep(step: UndercoreStep): MissionUpdate {
    switch (step) {
      case 1:
        return {
          text:
            'OBJECTIF 2/7 — [E] sur le mur de badges. Tous portent le même matricule : 7-Δ. ' +
            'Combien de vous avant vous ?',
          label: 'ÉTAPE 2 — BADGES',
        };
      case 2:
        return {
          text:
            'OBJECTIF 3/7 — [E] sur les écrans CRT. Vous n\'avez jamais quitté la cabine. ' +
            'L\'extérieur était une simulation.',
          label: 'ÉTAPE 3 — BOUCLES',
        };
      case 3:
        return {
          text:
            'OBJECTIF 4/7 — [E] sur le corps. Le journal du technicien précédent… c\'est votre écriture.',
          label: 'ÉTAPE 4 — CORPS',
        };
      case 4:
        return {
          text:
            'OBJECTIF 5/7 — Maintenez [E] 3 s sur le cœur organique. Coupez le filament qui vous relie au signal.',
          label: 'ÉTAPE 5 — FILAMENT',
        };
      case 5:
        return {
          text:
            'OBJECTIF 6/7 — [E] devant le miroir. Qui regarde vraiment ?',
          label: 'ÉTAPE 6 — MIROIR',
        };
      case 6:
        return {
          text:
            'OBJECTIF 7/7 — [E] sur le terminal noyau. Lisez la vérité. Mettez fin à cette itération.',
          label: 'ÉTAPE 7 — FIN',
        };
      default:
        return this.getIntroMission();
    }
  }

  getTrailHint(step: number): string {
    switch (step) {
      case 0:
        return '→ Descendez le couloir vers le nord (Z)';
      case 1:
        return '→ Mur de badges devant vous (~12 m)';
      case 2:
        return '→ Salle des écrans CRT (~20 m)';
      case 3:
        return '→ Table d\'autopsie (~28 m)';
      case 4:
        return '→ Masse organique / antenne (~35 m)';
      case 5:
        return '→ Miroir au fond (~42 m)';
      case 6:
        return '→ Terminal noyau — toute la vérité (~45 m)';
      default:
        return '';
    }
  }

  getInteractHint(step: UndercoreStep): string | null {
    switch (step) {
      case 1:
        return '[E] Examiner le mur de badges 7-Δ';
      case 2:
        return '[E] Visionner les enregistrements CRT';
      case 3:
        return '[E] Lire le journal sur le corps';
      case 4:
        return '[E] Maintenir 3 s — couper le filament';
      case 5:
        return '[E] Regarder le miroir';
      case 6:
        return '[E] Terminal noyau — terminer';
      default:
        return null;
    }
  }

  canInteract(id: string): boolean {
    const s = this.world.undercoreStep;
    switch (id) {
      case 'uc_badges':
        return s === 1;
      case 'uc_crts':
        return s === 2;
      case 'uc_corpse':
        return s === 3;
      case 'uc_organ':
        return s === 4;
      case 'uc_mirror':
        return s === 5;
      case 'uc_terminal':
        return s === 6;
      default:
        return false;
    }
  }
}
