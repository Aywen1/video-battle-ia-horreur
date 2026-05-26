/**
 * PauseMenu : overlay DOM affiché quand le pointer lock est relâché (Échap).
 * Contient un bouton REPRENDRE et un panneau "téléport" pour sauter directement
 * dans une salle / phase (sert de raccourci dev pour tester sans refaire toute
 * l'émission).
 */
import { PALETTE } from '../utils/palette';

/** Clé unique d'une cible de téléport. */
export type TeleportTargetKey =
  | 'studio-awakening'
  | 'studio-discovery'
  | 'studio-interview'
  | 'studio-climax'
  | 'studio-aftermath'
  | 'backstage-corridor'
  | 'backstage-regie'
  | 'backstage-regie-unlocked'
  | 'backstage-workshop'
  | 'backstage-theater'
  | 'plateau-intro'
  | 'plateau-duel'
  | 'plateau-climax'
  | 'dressing-reveil'
  | 'dressing-miroir'
  | 'audience-public'
  | 'audience-credits';

interface TeleportButtonSpec {
  key: TeleportTargetKey;
  label: string;
  sublabel: string;
  group: 'studio' | 'backstage' | 'plateau' | 'final';
}

const TELEPORT_BUTTONS: TeleportButtonSpec[] = [
  { key: 'studio-awakening',         label: '1.1 — Réveil',          sublabel: 'plateau, X au sol',       group: 'studio' },
  { key: 'studio-discovery',         label: '1.2 — Découverte',      sublabel: 'spots allumés',           group: 'studio' },
  { key: 'studio-interview',         label: '1.3 — Interview',       sublabel: 'sourire-mètre actif',     group: 'studio' },
  { key: 'studio-climax',            label: '1.4 — Climax',          sublabel: 'screamer + câlin',        group: 'studio' },
  { key: 'studio-aftermath',         label: '1.5 — Coulisses',       sublabel: 'porte révélée',           group: 'studio' },
  { key: 'backstage-corridor',       label: '2.1 — Couloir',         sublabel: 'néons défaillants',       group: 'backstage' },
  { key: 'backstage-regie',          label: '2.2 — Régie (cassettes)', sublabel: 'mur de moniteurs',     group: 'backstage' },
  { key: 'backstage-regie-unlocked', label: '2.3 — Porte ouverte',    sublabel: 'atelier déverrouillé',  group: 'backstage' },
  { key: 'backstage-workshop',       label: '2.4 — Atelier',         sublabel: 'Weeping Angel',           group: 'backstage' },
  { key: 'backstage-theater',        label: '2.5 — Théâtre',         sublabel: 'cliffhanger final',       group: 'backstage' },
  { key: 'plateau-intro',            label: '3.1 — Intro rideau',      sublabel: 'curtain reveal + applause', group: 'plateau' },
  { key: 'plateau-duel',             label: '3.2 — Duel vocal',        sublabel: '4 cues cri / silence',  group: 'plateau' },
  { key: 'plateau-climax',           label: '3.3 — Climax',            sublabel: 'cri max + screamer',    group: 'plateau' },
  { key: 'dressing-reveil',          label: '4.1 — Loge réveil',       sublabel: 'noir → ampoules vanity', group: 'final' },
  { key: 'dressing-miroir',          label: '4.2 — Miroir (sourire)',  sublabel: 'webcam + sourire greffé', group: 'final' },
  { key: 'audience-public',          label: '4.3 — Vue du public',     sublabel: 'tu es N°44, N°45 arrive', group: 'final' },
  { key: 'audience-credits',         label: '4.4 — Crédits final',     sublabel: 'générique de fin',       group: 'final' },
];

export class PauseMenu {
  root: HTMLDivElement;
  private resumeBtn: HTMLButtonElement;
  private onResume: () => void;
  private onTeleport: (target: TeleportTargetKey) => void;

  constructor(
    parent: HTMLElement,
    onResume: () => void,
    onTeleport: (target: TeleportTargetKey) => void,
  ) {
    this.onResume = onResume;
    this.onTeleport = onTeleport;
    this.root = document.createElement('div');
    this.root.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(28,27,26,0.78);
      display: none;
      align-items: center; justify-content: center;
      z-index: 10;
      font-family: 'Courier New', monospace;
      color: ${PALETTE.cream};
      backdrop-filter: blur(6px);
      overflow-y: auto;
      padding: 24px 0;
    `;
    const card = document.createElement('div');
    card.style.cssText = `
      width: 520px; max-width: 92vw; padding: 24px 28px 22px;
      border: 2px solid ${PALETTE.yellow};
      background: rgba(0,0,0,0.6);
      text-align: center;
      box-shadow: 0 0 30px rgba(255,210,63,0.18);
    `;
    const title = document.createElement('div');
    title.textContent = 'PAUSE';
    title.style.cssText = `
      font-size: 30px; letter-spacing: 0.3em; font-weight: 900;
      color: ${PALETTE.yellow}; margin-bottom: 6px;
    `;
    card.appendChild(title);

    const hint = document.createElement('div');
    hint.style.cssText = `
      font-size: 12px; opacity: 0.7;
      letter-spacing: 0.1em; margin-bottom: 18px;
    `;
    hint.textContent = "L'émission est en pause. Reprends quand tu seras prêt.";
    card.appendChild(hint);

    this.resumeBtn = document.createElement('button');
    this.resumeBtn.textContent = 'REPRENDRE';
    this.resumeBtn.style.cssText = `
      padding: 12px 28px; font-size: 14px;
      font-family: inherit; letter-spacing: 0.2em; font-weight: 700;
      background: ${PALETTE.yellow}; color: #1c1b1a;
      border: 2px solid ${PALETTE.cream};
      cursor: pointer;
      transition: transform 0.1s ease;
    `;
    this.resumeBtn.addEventListener('click', () => this.onResume());
    this.resumeBtn.addEventListener('mouseenter', () => {
      this.resumeBtn.style.transform = 'scale(1.04)';
    });
    this.resumeBtn.addEventListener('mouseleave', () => {
      this.resumeBtn.style.transform = 'scale(1.0)';
    });
    card.appendChild(this.resumeBtn);

    // ===== Section Téléport =====
    const tpTitle = document.createElement('div');
    tpTitle.textContent = '— TÉLÉPORT —';
    tpTitle.style.cssText = `
      margin-top: 24px; margin-bottom: 4px;
      font-size: 12px; letter-spacing: 0.3em;
      color: ${PALETTE.yellow}; opacity: 0.85;
    `;
    card.appendChild(tpTitle);

    const tpHint = document.createElement('div');
    tpHint.style.cssText = `
      font-size: 10px; opacity: 0.55;
      letter-spacing: 0.1em; margin-bottom: 12px;
    `;
    tpHint.textContent = 'Saute directement à une phase. Pratique pour retester.';
    card.appendChild(tpHint);

    // Sous-titre Chapitre 1
    card.appendChild(this.makeGroupLabel('CHAPITRE 1 — STUDIO'));
    card.appendChild(this.makeGroupGrid(TELEPORT_BUTTONS.filter(b => b.group === 'studio')));
    card.appendChild(this.makeGroupLabel('CHAPITRE 2 — COULISSES'));
    card.appendChild(this.makeGroupGrid(TELEPORT_BUTTONS.filter(b => b.group === 'backstage')));
    card.appendChild(this.makeGroupLabel('CHAPITRE 3 — LE PLATEAU'));
    card.appendChild(this.makeGroupGrid(TELEPORT_BUTTONS.filter(b => b.group === 'plateau')));
    card.appendChild(this.makeGroupLabel('CHAPITRE 4 — LE PUBLIC'));
    card.appendChild(this.makeGroupGrid(TELEPORT_BUTTONS.filter(b => b.group === 'final')));

    const controls = document.createElement('div');
    controls.style.cssText = `
      margin-top: 20px;
      font-size: 11px; line-height: 1.6;
      opacity: 0.6; letter-spacing: 0.06em;
      text-align: left;
    `;
    controls.innerHTML = `
      <div style="text-align:center; margin-bottom:8px; opacity:0.85;">CONTRÔLES</div>
      <div>Z Q S D : se déplacer</div>
      <div>Souris : regarder autour</div>
      <div>Shift : sprinter</div>
      <div>C ou Ctrl : s'accroupir</div>
      <div>E ou clic gauche : interagir</div>
      <div>Échap : pause</div>
    `;
    card.appendChild(controls);

    this.root.appendChild(card);
    parent.appendChild(this.root);
  }

  private makeGroupLabel(text: string): HTMLDivElement {
    const lab = document.createElement('div');
    lab.textContent = text;
    lab.style.cssText = `
      font-size: 10px; letter-spacing: 0.25em;
      opacity: 0.55; margin: 10px 0 6px;
      text-align: left; border-bottom: 1px dashed rgba(255,210,63,0.25);
      padding-bottom: 4px;
    `;
    return lab;
  }

  private makeGroupGrid(buttons: TeleportButtonSpec[]): HTMLDivElement {
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    `;
    for (const spec of buttons) {
      grid.appendChild(this.makeTeleportButton(spec));
    }
    return grid;
  }

  private makeTeleportButton(spec: TeleportButtonSpec): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.style.cssText = `
      padding: 8px 10px; font-family: inherit;
      background: rgba(255,210,63,0.04);
      color: ${PALETTE.cream};
      border: 1px solid rgba(255,210,63,0.35);
      cursor: pointer;
      text-align: left;
      transition: background 0.12s ease, border-color 0.12s ease;
    `;
    const main = document.createElement('div');
    main.textContent = spec.label;
    main.style.cssText = `font-size: 12px; letter-spacing: 0.08em; font-weight: 700;`;
    const sub = document.createElement('div');
    sub.textContent = spec.sublabel;
    sub.style.cssText = `font-size: 10px; opacity: 0.55; margin-top: 2px;`;
    btn.appendChild(main);
    btn.appendChild(sub);
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(255,210,63,0.14)';
      btn.style.borderColor = PALETTE.yellow;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255,210,63,0.04)';
      btn.style.borderColor = 'rgba(255,210,63,0.35)';
    });
    btn.addEventListener('click', () => {
      this.onTeleport(spec.key);
    });
    return btn;
  }

  show(): void {
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  dispose(): void {
    this.root.remove();
  }
}
