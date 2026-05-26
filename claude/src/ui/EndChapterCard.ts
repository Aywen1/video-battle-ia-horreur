/**
 * EndChapterCard : carton plein écran qui s'affiche au cliffhanger.
 *
 *   FIN DU CHAPITRE X
 *   CHAPITRE Y : NOM_PROCHAIN_CHAPITRE (apparition retardée)
 *   logo glitché en bas
 *
 * Pas de bouton — le jeu reste sur l'écran (effet viral).
 *
 * Variantes via le paramètre `kind` :
 *   - 'ch2-to-ch3' : « FIN DU CHAPITRE 2 / CHAPITRE 3 : LE PLATEAU »
 *   - 'ch3-to-ch4' : « FIN DU CHAPITRE 3 / CHAPITRE 4 : LE PUBLIC »
 *   - 'ch1-to-ch2' : compat legacy
 *   - 'ch4-final' : générique de fin (credits) avec bouton REJOUER
 */
import { PALETTE } from '../utils/palette';

export type ChapterCardKind = 'ch1-to-ch2' | 'ch2-to-ch3' | 'ch3-to-ch4' | 'ch4-final';

interface ChapterCardSpec {
  ending: string;
  next: string;
  caption: string;
  /** Si vrai, ce carton est le générique final : credits déroulants + bouton REJOUER. */
  isFinal?: boolean;
  /** Lignes de crédits (seulement si isFinal=true). */
  credits?: string[];
}

const CARD_SPECS: Record<ChapterCardKind, ChapterCardSpec> = {
  'ch1-to-ch2': {
    ending: 'FIN DU CHAPITRE 1',
    next: 'CHAPITRE 2 : LES COULISSES',
    caption: '— rétroactivement diffusé en différé —',
  },
  'ch2-to-ch3': {
    ending: 'FIN DU CHAPITRE 2',
    next: 'CHAPITRE 3 : LE PLATEAU',
    caption: '— tu n\'auras plus le choix de regarder —',
  },
  'ch3-to-ch4': {
    ending: 'FIN DU CHAPITRE 3',
    next: 'CHAPITRE 4 : LE PUBLIC',
    caption: '— ils étaient là depuis le début —',
  },
  'ch4-final': {
    ending: 'MERCI POUR VOTRE PARTICIPATION',
    next: 'ÉMISSION DE MINUIT',
    caption: '— prochain invité : N°45 —',
    isFinal: true,
    credits: [
      'Saison 1 — Épisode 44',
      '',
      'Réalisation : M. SOURIRE',
      'Production : LE PUBLIC',
      'Casting : N°1 à N°44',
      '',
      'Audimat : 100%',
      'Audience : 44 spectateurs',
      'Sourires recensés : 44',
      '',
      'PROCHAIN INVITÉ',
      'N°45',
      '— peut-être vous —',
    ],
  },
};

export class EndChapterCard {
  root: HTMLDivElement;
  private title: HTMLDivElement;
  private subtitle: HTMLDivElement;
  private logo: HTMLDivElement;
  private creditsBlock: HTMLDivElement | null = null;
  private replayBtn: HTMLButtonElement | null = null;
  private isFinal: boolean;

  constructor(parent: HTMLElement, kind: ChapterCardKind = 'ch2-to-ch3') {
    const spec = CARD_SPECS[kind];
    this.isFinal = !!spec.isFinal;
    this.root = document.createElement('div');
    this.root.style.cssText = `
      position: fixed; inset: 0;
      background: #000;
      z-index: 12;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: ${this.isFinal ? '18px' : '26px'};
      pointer-events: ${this.isFinal ? 'auto' : 'none'};
      opacity: 0;
      transition: opacity 1.4s ease;
      font-family: 'Courier New', monospace;
      color: ${PALETTE.cream};
    `;
    parent.appendChild(this.root);

    this.title = document.createElement('div');
    this.title.textContent = spec.ending;
    this.title.style.cssText = `
      font-size: ${this.isFinal ? '30px' : '38px'};
      font-weight: 900;
      letter-spacing: ${this.isFinal ? '0.20em' : '0.32em'};
      color: ${PALETTE.cream};
      text-shadow: 0 0 14px rgba(255,210,63,0.35);
      text-align: center;
      padding: 0 20px;
    `;
    this.root.appendChild(this.title);

    this.subtitle = document.createElement('div');
    this.subtitle.textContent = spec.next;
    this.subtitle.style.cssText = `
      font-size: ${this.isFinal ? '34px' : '22px'};
      font-weight: 700;
      letter-spacing: 0.40em;
      color: ${PALETTE.yellow};
      opacity: 0;
      transition: opacity 1.6s ease 1.5s;
      text-align: center;
    `;
    this.root.appendChild(this.subtitle);

    // Bloc credits (seulement pour la carte finale)
    if (this.isFinal && spec.credits) {
      this.creditsBlock = document.createElement('div');
      this.creditsBlock.style.cssText = `
        font-size: 14px;
        line-height: 1.9;
        letter-spacing: 0.20em;
        color: ${PALETTE.cream};
        text-align: center;
        opacity: 0;
        transition: opacity 2.2s ease 3.5s;
        max-width: 520px;
        margin-top: 14px;
      `;
      this.creditsBlock.innerHTML = spec.credits
        .map((line) => {
          if (line === '') return '<div style="height:8px;"></div>';
          if (line === 'N°45') {
            return `<div style="font-size:28px;font-weight:900;color:${PALETTE.red};letter-spacing:0.45em;margin:8px 0;text-shadow:0 0 12px rgba(200,16,46,0.5);">${line}</div>`;
          }
          if (line.startsWith('PROCHAIN')) {
            return `<div style="font-size:11px;letter-spacing:0.50em;color:${PALETTE.yellow};margin-top:18px;">${line}</div>`;
          }
          if (line.startsWith('—')) {
            return `<div style="font-size:11px;font-style:italic;color:${PALETTE.cream};opacity:0.7;letter-spacing:0.15em;">${line}</div>`;
          }
          return `<div>${line}</div>`;
        })
        .join('');
      this.root.appendChild(this.creditsBlock);
    }

    // Logo glitché en bas
    this.logo = document.createElement('div');
    this.logo.textContent = "L'ÉMISSION DE MINUIT";
    this.logo.style.cssText = `
      position: absolute;
      bottom: ${this.isFinal ? '14%' : '8%'};
      font-size: 14px;
      letter-spacing: 0.5em;
      color: ${PALETTE.red};
      opacity: 0;
      transition: opacity 2.2s ease 3.0s;
      animation: chapterLogoFlicker 1.2s infinite;
    `;
    this.root.appendChild(this.logo);

    // Petite mention copyright pseudo-épisode
    const credits = document.createElement('div');
    credits.textContent = spec.caption;
    credits.style.cssText = `
      position: absolute;
      bottom: 4%;
      font-size: 10px;
      letter-spacing: 0.18em;
      color: ${PALETTE.cream};
      opacity: 0;
      transition: opacity 2.0s ease 4.0s;
    `;
    this.root.appendChild(credits);

    // Bouton REJOUER (carte finale uniquement)
    if (this.isFinal) {
      this.replayBtn = document.createElement('button');
      this.replayBtn.textContent = 'REJOUER';
      this.replayBtn.style.cssText = `
        position: absolute;
        bottom: 9%;
        padding: 10px 26px;
        background: transparent;
        border: 2px solid ${PALETTE.yellow};
        color: ${PALETTE.yellow};
        font-family: 'Courier New', monospace;
        font-size: 14px;
        letter-spacing: 0.32em;
        font-weight: 700;
        cursor: pointer;
        opacity: 0;
        transition: opacity 1.5s ease 6.0s, background 0.2s, color 0.2s;
        pointer-events: auto;
      `;
      this.replayBtn.onmouseenter = (): void => {
        if (this.replayBtn) {
          this.replayBtn.style.background = PALETTE.yellow;
          this.replayBtn.style.color = '#000';
        }
      };
      this.replayBtn.onmouseleave = (): void => {
        if (this.replayBtn) {
          this.replayBtn.style.background = 'transparent';
          this.replayBtn.style.color = PALETTE.yellow;
        }
      };
      this.replayBtn.onclick = (): void => {
        window.location.reload();
      };
      this.root.appendChild(this.replayBtn);
    }

    // Animation injectée une seule fois
    if (!document.getElementById('end-chapter-card-style')) {
      const style = document.createElement('style');
      style.id = 'end-chapter-card-style';
      style.textContent = `
        @keyframes chapterLogoFlicker {
          0%, 92%, 100% { opacity: 1; transform: translateX(0); }
          93% { opacity: 0.3; transform: translateX(2px); }
          95% { opacity: 0.9; transform: translateX(-2px); }
          97% { opacity: 0.5; }
        }
      `;
      document.head.appendChild(style);
    }

    this.root.dataset.credits = '';
    (this.root as any)._credits = credits;
  }

  show(): void {
    this.root.style.opacity = '1';
    window.setTimeout(() => {
      this.subtitle.style.opacity = '1';
    }, 50);
    window.setTimeout(() => {
      this.logo.style.opacity = '1';
    }, 50);
    window.setTimeout(() => {
      const credits = (this.root as any)._credits as HTMLDivElement;
      if (credits) credits.style.opacity = '1';
    }, 50);
    if (this.creditsBlock) {
      window.setTimeout(() => {
        if (this.creditsBlock) this.creditsBlock.style.opacity = '1';
      }, 50);
    }
    if (this.replayBtn) {
      window.setTimeout(() => {
        if (this.replayBtn) this.replayBtn.style.opacity = '1';
      }, 50);
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
