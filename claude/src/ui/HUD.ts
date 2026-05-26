/**
 * HUD : overlay DOM minimaliste.
 * - "ON AIR" rouge clignotant (haut gauche)
 * - Jauge AUDIMAT vintage (haut droite) — affichage déclenché par setMeterVisible
 * - Sous-titres bitmap (bas centre)
 * - Crosshair (centre) qui devient "main" sur survol d'un interactable
 * - Petit message de prompt (centre bas) "[E] Lire la carte"
 */
import { PALETTE } from '../utils/palette';

export type HudMode = 'studio' | 'backstage' | 'final' | 'plateau';

/** Mode du voice-meter selon la cue active. */
export type VoiceMode = 'idle' | 'scream' | 'silence';

export class HUD {
  root: HTMLDivElement;
  private onAir: HTMLDivElement;
  private audimat: HTMLDivElement;
  private audimatFill: HTMLDivElement;
  private audimatLabel: HTMLDivElement;
  private subtitle: HTMLDivElement;
  private crosshair: HTMLDivElement;
  private prompt: HTMLDivElement;
  private faceLost: HTMLDivElement;
  private inventory: HTMLDivElement;
  private fade: HTMLDivElement;
  // Voice meter (Chapitre 3)
  private voiceWrap: HTMLDivElement;
  private voiceBarContainer: HTMLDivElement;
  private voiceFill: HTMLDivElement;
  private voiceMarker: HTMLDivElement;
  private voiceCaption: HTMLDivElement;
  private voiceLabel: HTMLDivElement;
  private voiceFallbackTag: HTMLDivElement;
  private subtitleTimer: number | null = null;
  private meterVisible = false;
  private voiceVisible = false;
  private voiceMode: VoiceMode = 'idle';
  private voiceThreshold = 0.5;
  private tremorAmount = 0;
  private tremorRaf: number | null = null;
  private mode: HudMode = 'studio';

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.cssText = `
      position: fixed; inset: 0; pointer-events: none; z-index: 5;
      font-family: 'Courier New', 'Consolas', monospace;
      color: ${PALETTE.cream};
      user-select: none;
    `;
    parent.appendChild(this.root);

    // ON AIR
    this.onAir = document.createElement('div');
    this.onAir.style.cssText = `
      position: absolute; top: 18px; left: 22px;
      padding: 6px 14px;
      background: ${PALETTE.red};
      color: ${PALETTE.cream};
      font-weight: 900;
      letter-spacing: 0.18em;
      font-size: 14px;
      border: 2px solid #5a060e;
      box-shadow: 0 0 18px rgba(200, 16, 46, 0.6);
      animation: onAirBlink 1.8s infinite;
    `;
    this.onAir.textContent = '● ON AIR';
    this.root.appendChild(this.onAir);

    // Audimat
    this.audimat = document.createElement('div');
    this.audimat.style.cssText = `
      position: absolute; top: 18px; right: 22px;
      width: 240px; padding: 8px 12px;
      background: rgba(28, 27, 26, 0.65);
      border: 2px solid ${PALETTE.yellow};
      border-radius: 4px;
      backdrop-filter: blur(2px);
      box-shadow: 0 0 14px rgba(255,210,63,0.25);
      opacity: 0;
      transition: opacity 0.35s ease;
    `;
    this.audimatLabel = document.createElement('div');
    this.audimatLabel.textContent = 'AUDIMAT';
    this.audimatLabel.style.cssText = `
      font-size: 11px; letter-spacing: 0.3em; font-weight: 700;
      color: ${PALETTE.yellow}; margin-bottom: 4px;
    `;
    this.audimat.appendChild(this.audimatLabel);

    const bar = document.createElement('div');
    bar.style.cssText = `
      width: 100%; height: 14px;
      background: linear-gradient(to right,
        rgba(200, 16, 46, 0.6) 0%,
        rgba(200, 16, 46, 0.6) 18%,
        rgba(255, 210, 63, 0.5) 18%,
        rgba(255, 210, 63, 0.5) 45%,
        rgba(155, 197, 61, 0.55) 45%,
        rgba(155, 197, 61, 0.55) 100%);
      border: 1px solid #5a4220;
      position: relative;
      overflow: hidden;
    `;
    this.audimatFill = document.createElement('div');
    this.audimatFill.style.cssText = `
      position: absolute; right: 0; top: 0; bottom: 0;
      background: linear-gradient(to right, transparent, #1c1b1a 70%);
      width: 0%;
      transition: width 0.12s linear;
    `;
    bar.appendChild(this.audimatFill);
    this.audimat.appendChild(bar);
    // Graduations
    const grad = document.createElement('div');
    grad.style.cssText = `
      display: flex; justify-content: space-between;
      font-size: 9px; opacity: 0.65; margin-top: 3px; letter-spacing: 0.1em;
    `;
    grad.innerHTML = '<span>VIDE</span><span>POLI</span><span>OVATION</span>';
    this.audimat.appendChild(grad);
    this.root.appendChild(this.audimat);

    // Subtitle
    this.subtitle = document.createElement('div');
    this.subtitle.style.cssText = `
      position: absolute; bottom: 12%; left: 50%;
      transform: translateX(-50%);
      max-width: 780px; padding: 8px 18px;
      background: rgba(0,0,0,0.55);
      border-left: 3px solid ${PALETTE.yellow};
      border-right: 3px solid ${PALETTE.yellow};
      font-family: 'Courier New', monospace;
      font-size: 18px; font-weight: 700; letter-spacing: 0.04em;
      text-align: center;
      color: ${PALETTE.cream};
      opacity: 0;
      transition: opacity 0.25s ease;
      text-shadow: 0 1px 0 #000;
      white-space: pre-line;
    `;
    this.root.appendChild(this.subtitle);

    // Crosshair
    this.crosshair = document.createElement('div');
    this.crosshair.style.cssText = `
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 6px; height: 6px;
      background: ${PALETTE.cream};
      border-radius: 50%;
      mix-blend-mode: difference;
      transition: transform 0.12s ease, background 0.12s ease, width 0.12s ease;
      box-shadow: 0 0 2px rgba(0,0,0,0.5);
    `;
    this.root.appendChild(this.crosshair);

    // Prompt
    this.prompt = document.createElement('div');
    this.prompt.style.cssText = `
      position: absolute; top: calc(50% + 30px); left: 50%;
      transform: translateX(-50%);
      font-size: 13px; letter-spacing: 0.12em;
      color: ${PALETTE.cream};
      background: rgba(0,0,0,0.5);
      padding: 4px 10px;
      border: 1px solid ${PALETTE.yellow};
      opacity: 0;
      transition: opacity 0.18s ease;
    `;
    this.prompt.textContent = '';
    this.root.appendChild(this.prompt);

    // Face lost warning
    this.faceLost = document.createElement('div');
    this.faceLost.style.cssText = `
      position: absolute; top: 70px; right: 22px;
      padding: 4px 10px;
      background: rgba(200, 16, 46, 0.25);
      border: 1px dashed ${PALETTE.red};
      font-size: 11px; letter-spacing: 0.18em;
      color: ${PALETTE.cream};
      opacity: 0;
      transition: opacity 0.3s;
    `;
    this.faceLost.textContent = '⚠ VISAGE INTROUVABLE';
    this.root.appendChild(this.faceLost);

    // Inventory (objet tenu en main)
    this.inventory = document.createElement('div');
    this.inventory.style.cssText = `
      position: absolute; bottom: 22px; right: 22px;
      padding: 6px 12px;
      background: rgba(0, 0, 0, 0.55);
      border: 1px solid ${PALETTE.cream};
      font-size: 12px; letter-spacing: 0.16em;
      color: ${PALETTE.cream};
      opacity: 0;
      transition: opacity 0.25s ease;
    `;
    this.inventory.textContent = '';
    this.root.appendChild(this.inventory);

    // Fade overlay plein écran (transitions de salle, fade-to-black final)
    this.fade = document.createElement('div');
    this.fade.style.cssText = `
      position: fixed; inset: 0; background: #000;
      opacity: 0; pointer-events: none; z-index: 8;
      transition: opacity 0.4s ease;
    `;
    this.root.appendChild(this.fade);

    // ===== Voice meter (Chapitre 3) =====
    this.voiceWrap = document.createElement('div');
    this.voiceWrap.style.cssText = `
      position: absolute; left: 22px; top: 50%;
      transform: translateY(-50%);
      width: 78px; padding: 10px 8px 10px 8px;
      background: rgba(0,0,0,0.55);
      border: 2px solid ${PALETTE.yellow};
      backdrop-filter: blur(2px);
      box-shadow: 0 0 14px rgba(255,210,63,0.18);
      opacity: 0;
      transition: opacity 0.3s ease;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    `;
    this.voiceLabel = document.createElement('div');
    this.voiceLabel.textContent = 'VOIX';
    this.voiceLabel.style.cssText = `
      font-size: 11px; letter-spacing: 0.3em; font-weight: 700;
      color: ${PALETTE.yellow};
    `;
    this.voiceWrap.appendChild(this.voiceLabel);

    this.voiceBarContainer = document.createElement('div');
    this.voiceBarContainer.style.cssText = `
      position: relative;
      width: 28px; height: 220px;
      background: linear-gradient(to top,
        rgba(60,60,60,0.4) 0%,
        rgba(60,60,60,0.4) 12%,
        rgba(244,233,216,0.18) 12%,
        rgba(244,233,216,0.18) 60%,
        rgba(200,16,46,0.35) 60%,
        rgba(200,16,46,0.35) 100%);
      border: 1px solid #5a4220;
      overflow: hidden;
    `;
    this.voiceFill = document.createElement('div');
    this.voiceFill.style.cssText = `
      position: absolute; left: 0; right: 0; bottom: 0;
      height: 0%;
      background: linear-gradient(to top, ${PALETTE.green}, ${PALETTE.yellow} 60%, ${PALETTE.red});
      transition: height 0.06s linear;
    `;
    this.voiceBarContainer.appendChild(this.voiceFill);
    this.voiceMarker = document.createElement('div');
    this.voiceMarker.style.cssText = `
      position: absolute; left: -4px; right: -4px;
      height: 2px; bottom: 50%;
      background: ${PALETTE.yellow};
      box-shadow: 0 0 8px rgba(255,210,63,0.6);
      transition: bottom 0.25s ease, background 0.15s ease;
    `;
    this.voiceBarContainer.appendChild(this.voiceMarker);
    this.voiceWrap.appendChild(this.voiceBarContainer);

    this.voiceCaption = document.createElement('div');
    this.voiceCaption.textContent = 'CRIE';
    this.voiceCaption.style.cssText = `
      font-size: 10px; letter-spacing: 0.18em; font-weight: 800;
      color: ${PALETTE.cream}; text-align: center;
      animation: voiceCaptionBlink 1.6s infinite;
    `;
    this.voiceWrap.appendChild(this.voiceCaption);

    this.voiceFallbackTag = document.createElement('div');
    this.voiceFallbackTag.textContent = '[ ESPACE ]';
    this.voiceFallbackTag.style.cssText = `
      font-size: 9px; letter-spacing: 0.16em;
      color: ${PALETTE.cream}; opacity: 0.6;
      display: none;
    `;
    this.voiceWrap.appendChild(this.voiceFallbackTag);

    this.root.appendChild(this.voiceWrap);

    // Keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes onAirBlink {
        0%, 60%   { opacity: 1; box-shadow: 0 0 18px rgba(200,16,46,0.6); }
        70%, 95%  { opacity: 0.35; box-shadow: 0 0 6px rgba(200,16,46,0.2); }
        100%      { opacity: 1; }
      }
      @keyframes voiceCaptionBlink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.45; }
      }
    `;
    document.head.appendChild(style);
  }

  // ============== Voice Meter (Chapitre 3) ==============

  setVoiceMeterVisible(v: boolean): void {
    this.voiceVisible = v;
    this.voiceWrap.style.opacity = v ? '1' : '0';
  }

  /** `level` 0..1 — la barre se remplit depuis le bas. */
  setVoiceLevel(level: number): void {
    if (!this.voiceVisible) return;
    const clamped = Math.max(0, Math.min(1, level));
    this.voiceFill.style.height = `${clamped * 100}%`;
  }

  /**
   * Repère horizontal (seuil de la cue actuelle) à `threshold` 0..1.
   * `mode = 'scream'` : marqueur jaune, légende "CRIE AU-DESSUS".
   * `mode = 'silence'` : marqueur bleu, légende "RESTE EN DESSOUS".
   * `mode = 'idle'` : marqueur effacé.
   */
  setVoiceCue(mode: VoiceMode, threshold = 0.5): void {
    this.voiceMode = mode;
    this.voiceThreshold = threshold;
    this.voiceMarker.style.bottom = `${threshold * 100}%`;
    if (mode === 'scream') {
      this.voiceMarker.style.background = PALETTE.yellow;
      this.voiceMarker.style.boxShadow = '0 0 8px rgba(255,210,63,0.6)';
      this.voiceCaption.textContent = 'CRIE';
      this.voiceCaption.style.color = PALETTE.yellow;
      this.voiceCaption.style.display = '';
    } else if (mode === 'silence') {
      this.voiceMarker.style.background = PALETTE.blue;
      this.voiceMarker.style.boxShadow = '0 0 8px rgba(91,192,235,0.6)';
      this.voiceCaption.textContent = 'TAIS-TOI';
      this.voiceCaption.style.color = PALETTE.blue;
      this.voiceCaption.style.display = '';
    } else {
      this.voiceMarker.style.background = 'transparent';
      this.voiceMarker.style.boxShadow = 'none';
      this.voiceCaption.style.display = 'none';
    }
  }

  setVoiceFallback(active: boolean): void {
    this.voiceFallbackTag.style.display = active ? '' : 'none';
  }

  /** Pulse visuel quand une cue est réussie. */
  voiceCueSuccess(): void {
    this.voiceWrap.style.transform = 'translateY(-50%) scale(1.08)';
    this.voiceWrap.style.boxShadow = '0 0 36px rgba(255,210,63,0.7)';
    window.setTimeout(() => {
      this.voiceWrap.style.transform = 'translateY(-50%) scale(1)';
      this.voiceWrap.style.boxShadow = '0 0 14px rgba(255,210,63,0.18)';
    }, 220);
  }

  setMeterVisible(v: boolean): void {
    this.meterVisible = v;
    this.audimat.style.opacity = v ? '1' : '0';
  }

  /** `meter` 0..1 — la jauge se "vide" depuis la droite. */
  setMeter(meter: number): void {
    if (!this.meterVisible) return;
    const empty = (1 - Math.max(0, Math.min(1, meter))) * 100;
    this.audimatFill.style.width = `${empty}%`;
    // Couleur du contour selon zone (4 paliers : red < 0.18, orange < 0.28, yellow < 0.45, green)
    if (meter < 0.18) {
      this.audimat.style.borderColor = PALETTE.red;
      this.audimat.style.boxShadow = '0 0 18px rgba(200, 16, 46, 0.7)';
      this.tremorAmount = 0.9;
    } else if (meter < 0.28) {
      this.audimat.style.borderColor = '#ff7a1a';
      this.audimat.style.boxShadow = '0 0 18px rgba(255, 122, 26, 0.6)';
      this.tremorAmount = 0.55;
    } else if (meter < 0.45) {
      this.audimat.style.borderColor = PALETTE.yellow;
      this.audimat.style.boxShadow = '0 0 14px rgba(255, 210, 63, 0.4)';
      this.tremorAmount = 0;
    } else {
      this.audimat.style.borderColor = PALETTE.green;
      this.audimat.style.boxShadow = '0 0 14px rgba(155, 197, 61, 0.4)';
      this.tremorAmount = 0;
    }
    this.ensureTremorLoop();
  }

  /** Boucle locale qui applique un translate aléatoire sur la jauge. */
  private ensureTremorLoop(): void {
    if (this.tremorAmount > 0 && this.tremorRaf === null) {
      const tick = () => {
        if (this.tremorAmount <= 0) {
          this.audimat.style.transform = '';
          this.tremorRaf = null;
          return;
        }
        const a = this.tremorAmount;
        const dx = (Math.random() - 0.5) * 2 * a;
        const dy = (Math.random() - 0.5) * 2 * a;
        this.audimat.style.transform = `translate(${dx}px, ${dy}px)`;
        this.tremorRaf = window.requestAnimationFrame(tick);
      };
      this.tremorRaf = window.requestAnimationFrame(tick);
    }
  }

  setFaceLost(lost: boolean): void {
    this.faceLost.style.opacity = lost ? '1' : '0';
  }

  setSubtitle(text: string, durationSec = 3): void {
    this.subtitle.textContent = text;
    this.subtitle.style.opacity = '1';
    if (this.subtitleTimer !== null) clearTimeout(this.subtitleTimer);
    this.subtitleTimer = window.setTimeout(() => {
      this.subtitle.style.opacity = '0';
    }, durationSec * 1000);
  }

  setHover(label: string | null): void {
    if (label) {
      this.prompt.textContent = `[ E ] ${label}`;
      this.prompt.style.opacity = '1';
      this.crosshair.style.background = PALETTE.yellow;
      this.crosshair.style.width = '10px';
      this.crosshair.style.height = '10px';
    } else {
      this.prompt.style.opacity = '0';
      this.crosshair.style.background = PALETTE.cream;
      this.crosshair.style.width = '6px';
      this.crosshair.style.height = '6px';
    }
  }

  /** Modère le HUD (à l'allumage de la lumière). */
  setOpacity(o: number): void {
    this.root.style.opacity = String(o);
  }

  /**
   * Change le mode du HUD selon la salle. En backstage on cache la jauge,
   * le ON AIR et l'avertissement visage. En final on ne garde que les
   * sous-titres et le fade overlay.
   */
  setAmbientMode(mode: HudMode): void {
    this.mode = mode;
    if (mode === 'studio') {
      this.onAir.style.display = '';
      this.audimat.style.display = '';
      this.faceLost.style.display = '';
      this.crosshair.style.display = '';
      this.prompt.style.display = '';
      this.inventory.style.display = '';
      this.setVoiceMeterVisible(false);
    } else if (mode === 'backstage') {
      this.onAir.style.display = 'none';
      this.audimat.style.display = 'none';
      this.faceLost.style.display = 'none';
      this.crosshair.style.display = '';
      this.prompt.style.display = '';
      this.inventory.style.display = '';
      this.setVoiceMeterVisible(false);
    } else if (mode === 'plateau') {
      // Chapitre 3 : ON AIR revient, audimat off, voice-meter on, pas
      // de crosshair (joueur assis, immobile).
      this.onAir.style.display = '';
      this.audimat.style.display = 'none';
      this.faceLost.style.display = 'none';
      this.crosshair.style.display = 'none';
      this.prompt.style.display = 'none';
      this.inventory.style.display = 'none';
      this.setVoiceMeterVisible(true);
    } else {
      // final
      this.onAir.style.display = 'none';
      this.audimat.style.display = 'none';
      this.faceLost.style.display = 'none';
      this.crosshair.style.display = 'none';
      this.prompt.style.display = 'none';
      this.inventory.style.display = 'none';
      this.setVoiceMeterVisible(false);
    }
  }

  getMode(): HudMode {
    return this.mode;
  }

  /** Petit indicateur "TENU : ..." en bas à droite. null pour cacher. */
  setInventoryItem(label: string | null): void {
    if (label) {
      this.inventory.textContent = `TENU : ${label}`;
      this.inventory.style.opacity = '1';
    } else {
      this.inventory.style.opacity = '0';
    }
  }

  /**
   * Fade vers le noir (target=1) ou vers le clair (target=0). `durationSec`
   * contrôle la transition CSS. Renvoie une promise qui résout à la fin.
   */
  fadeTo(target: number, durationSec = 0.4): Promise<void> {
    this.fade.style.transition = `opacity ${durationSec}s ease`;
    this.fade.style.opacity = String(Math.max(0, Math.min(1, target)));
    return new Promise((res) => window.setTimeout(res, durationSec * 1000));
  }

  dispose(): void {
    if (this.subtitleTimer !== null) clearTimeout(this.subtitleTimer);
    if (this.tremorRaf !== null) window.cancelAnimationFrame(this.tremorRaf);
    this.root.remove();
  }
}
