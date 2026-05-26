import { MissionPortrait } from './MissionPortrait';

export class MissionPanel {
  private panel: HTMLElement;
  private labelEl: HTMLElement;
  private textEl: HTMLElement;
  private portrait: MissionPortrait;

  constructor() {
    this.panel = document.getElementById('mission-panel')!;
    this.labelEl = document.getElementById('mission-label')!;
    this.textEl = document.getElementById('mission-text')!;
    const canvas = document.getElementById('mission-portrait') as HTMLCanvasElement;
    this.portrait = new MissionPortrait(canvas);
  }

  setMission(text: string, label = 'CONSIGNE — RELAIS 7'): void {
    this.labelEl.textContent = label;
    this.panel.classList.add('mission-updating');
    this.textEl.textContent = text;
    requestAnimationFrame(() => {
      this.panel.classList.remove('mission-updating');
    });
  }

  update(dt: number): void {
    this.portrait.update(dt);
  }
}
