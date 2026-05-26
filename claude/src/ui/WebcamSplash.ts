/**
 * WebcamSplash : la première chose que voit le joueur.
 * 1) Titre stylé + bouton "ENTRER EN SCÈNE"
 * 2) Demande permission caméra + chargement MediaPipe
 * 3) Calibration sourire (neutre 2s puis large 2s)
 * 4) Demande permission micro + calibration (silence 1.5s puis cri 2s)
 * 5) Disparition, on rend la main au Game
 */
import { SmileDetector } from '../webcam/SmileDetector';
import { MicrophoneInput } from '../audio/MicrophoneInput';
import { PALETTE } from '../utils/palette';

export interface WebcamSplashResult {
  detector: SmileDetector;
  microphone: MicrophoneInput;
  audioStarted: boolean;
}

type Phase =
  | 'title'
  | 'requesting'
  | 'calibrating-neutral'
  | 'calibrating-smile'
  | 'mic-requesting'
  | 'calibrating-mic-floor'
  | 'calibrating-mic-scream'
  | 'done'
  | 'error';

export class WebcamSplash {
  root: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private subtitleEl: HTMLDivElement;
  private bigButton: HTMLButtonElement;
  private statusEl: HTMLDivElement;
  private retryBtn: HTMLButtonElement;
  private skipMicBtn: HTMLButtonElement;
  private micBar: HTMLDivElement;
  private micBarFill: HTMLDivElement;
  private phase: Phase = 'title';
  private resolveFn: ((res: WebcamSplashResult) => void) | null = null;
  private detector: SmileDetector | null = null;
  private microphone: MicrophoneInput;
  private samples: number[] = [];
  private phaseStart = 0;
  private rafId: number | null = null;
  private lastFrameTs = 0;

  constructor(parent: HTMLElement, private videoEl: HTMLVideoElement, microphone: MicrophoneInput) {
    this.microphone = microphone;
    this.root = document.createElement('div');
    this.root.style.cssText = `
      position: fixed; inset: 0;
      background: radial-gradient(circle at 50% 30%, #2c0a1e 0%, #0a0608 70%);
      display: flex; align-items: center; justify-content: center; flex-direction: column;
      font-family: 'Courier New', monospace;
      color: ${PALETTE.cream};
      z-index: 20;
      overflow: hidden;
    `;
    // Effet "scanlines"
    const scan = document.createElement('div');
    scan.style.cssText = `
      position: absolute; inset: 0;
      background: repeating-linear-gradient(
        0deg,
        rgba(0,0,0,0.18) 0px,
        rgba(0,0,0,0.18) 1px,
        transparent 1px,
        transparent 3px);
      pointer-events: none;
      mix-blend-mode: multiply;
    `;
    this.root.appendChild(scan);

    // Spotlight d'ambiance (cercle lumineux derrière le titre)
    const spot = document.createElement('div');
    spot.style.cssText = `
      position: absolute; left: 50%; top: 28%;
      width: 700px; height: 700px;
      transform: translate(-50%, -50%);
      background: radial-gradient(circle, rgba(230,61,162,0.25) 0%, transparent 60%);
      filter: blur(20px);
      pointer-events: none;
    `;
    this.root.appendChild(spot);

    this.titleEl = document.createElement('div');
    this.titleEl.style.cssText = `
      position: relative;
      font-size: clamp(48px, 9vw, 110px);
      font-weight: 900;
      letter-spacing: 0.18em;
      color: ${PALETTE.yellow};
      text-shadow:
        0 0 30px rgba(230, 61, 162, 0.6),
        4px 0 ${PALETTE.magenta},
        -4px 0 ${PALETTE.blue};
      margin-bottom: 6px;
      animation: titleWobble 4s infinite ease-in-out;
    `;
    this.titleEl.textContent = "L'ÉMISSION";
    this.root.appendChild(this.titleEl);

    const sub = document.createElement('div');
    sub.style.cssText = `
      position: relative;
      font-size: clamp(28px, 4vw, 52px);
      letter-spacing: 0.5em;
      color: ${PALETTE.red};
      margin-bottom: 38px;
      text-shadow: 0 0 18px rgba(200, 16, 46, 0.7);
    `;
    sub.textContent = 'DE MINUIT';
    this.root.appendChild(sub);

    this.subtitleEl = document.createElement('div');
    this.subtitleEl.style.cssText = `
      position: relative;
      max-width: 620px;
      text-align: center;
      line-height: 1.6;
      font-size: 14px;
      letter-spacing: 0.04em;
      color: ${PALETTE.cream};
      opacity: 0.92;
      margin-bottom: 30px;
      padding: 0 30px;
    `;
    this.subtitleEl.innerHTML = `
      Ce jeu utilise <strong style="color:${PALETTE.yellow}">votre webcam</strong> pour
      mesurer votre sourire en temps réel.<br>
      Aucune image n'est enregistrée ni envoyée nulle part — tout se passe dans votre navigateur.<br>
      <span style="opacity:0.7;font-style:italic;">Recommandé : casque audio, pièce calme.</span>
    `;
    this.root.appendChild(this.subtitleEl);

    this.bigButton = document.createElement('button');
    this.bigButton.style.cssText = `
      position: relative;
      padding: 18px 42px;
      font-size: 18px; font-weight: 800;
      letter-spacing: 0.3em;
      background: ${PALETTE.yellow};
      color: #1c1b1a;
      border: 3px solid ${PALETTE.cream};
      cursor: pointer;
      font-family: inherit;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
      box-shadow: 0 0 22px rgba(255, 210, 63, 0.45);
    `;
    this.bigButton.textContent = 'ENTRER EN SCÈNE';
    this.bigButton.addEventListener('mouseenter', () => {
      this.bigButton.style.transform = 'scale(1.04)';
      this.bigButton.style.boxShadow = '0 0 35px rgba(255,210,63,0.7)';
    });
    this.bigButton.addEventListener('mouseleave', () => {
      this.bigButton.style.transform = 'scale(1)';
      this.bigButton.style.boxShadow = '0 0 22px rgba(255,210,63,0.45)';
    });
    this.bigButton.addEventListener('click', () => this.onStart());
    this.root.appendChild(this.bigButton);

    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText = `
      position: relative;
      margin-top: 30px; font-size: 13px;
      letter-spacing: 0.1em; opacity: 0.85;
      text-align: center;
      max-width: 600px;
      padding: 0 20px;
      min-height: 40px;
    `;
    this.root.appendChild(this.statusEl);

    this.retryBtn = document.createElement('button');
    this.retryBtn.style.cssText = `
      margin-top: 16px;
      padding: 8px 18px;
      font-family: inherit; font-size: 12px; letter-spacing: 0.2em;
      background: transparent; color: ${PALETTE.cream};
      border: 1px solid ${PALETTE.cream};
      cursor: pointer; display: none;
    `;
    this.retryBtn.textContent = 'RÉESSAYER';
    this.retryBtn.addEventListener('click', () => {
      this.retryBtn.style.display = 'none';
      this.statusEl.textContent = '';
      this.bigButton.style.display = 'inline-block';
      this.phase = 'title';
    });
    this.root.appendChild(this.retryBtn);

    // Barre de niveau micro (visible pendant les phases mic-*)
    this.micBar = document.createElement('div');
    this.micBar.style.cssText = `
      position: relative;
      width: 320px; height: 18px;
      margin-top: 18px;
      background: rgba(0,0,0,0.55);
      border: 1px solid ${PALETTE.cream};
      box-shadow: 0 0 14px rgba(255,210,63,0.15);
      display: none;
    `;
    this.micBarFill = document.createElement('div');
    this.micBarFill.style.cssText = `
      position: absolute; left: 0; top: 0; bottom: 0;
      width: 0%;
      background: linear-gradient(90deg, ${PALETTE.green} 0%, ${PALETTE.yellow} 50%, ${PALETTE.red} 100%);
      transition: width 0.05s linear;
    `;
    this.micBar.appendChild(this.micBarFill);
    this.root.appendChild(this.micBar);

    // Bouton "passer le micro" : fallback clavier
    this.skipMicBtn = document.createElement('button');
    this.skipMicBtn.style.cssText = `
      margin-top: 14px;
      padding: 8px 18px;
      font-family: inherit; font-size: 12px; letter-spacing: 0.2em;
      background: transparent; color: ${PALETTE.cream};
      border: 1px solid ${PALETTE.cream};
      cursor: pointer; display: none;
      opacity: 0.7;
    `;
    this.skipMicBtn.textContent = 'CONTINUER SANS MICRO (ESPACE = CRI)';
    this.skipMicBtn.addEventListener('mouseenter', () => {
      this.skipMicBtn.style.opacity = '1';
    });
    this.skipMicBtn.addEventListener('mouseleave', () => {
      this.skipMicBtn.style.opacity = '0.7';
    });
    this.skipMicBtn.addEventListener('click', () => this.useKeyboardFallback());
    this.root.appendChild(this.skipMicBtn);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes titleWobble {
        0%, 100% { transform: translateY(0) rotate(-0.5deg); }
        50%      { transform: translateY(-3px) rotate(0.5deg); }
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50%      { transform: scale(1.15); }
      }
    `;
    document.head.appendChild(style);

    parent.appendChild(this.root);
  }

  async showAndWait(): Promise<WebcamSplashResult> {
    return new Promise<WebcamSplashResult>((resolve) => {
      this.resolveFn = resolve;
    });
  }

  private async onStart(): Promise<void> {
    this.bigButton.style.display = 'none';
    this.phase = 'requesting';
    this.statusEl.innerHTML = 'Initialisation du détecteur de sourire…';
    try {
      this.detector = new SmileDetector(this.videoEl);
      await this.detector.initialize();
      this.statusEl.innerHTML = 'Demande d\'accès à la caméra…';
      await this.detector.requestWebcam();
      this.detector.start();
      // Petit délai pour que MediaPipe s'amorce
      await new Promise((r) => setTimeout(r, 600));
      // Calibration
      this.phase = 'calibrating-neutral';
      this.phaseStart = performance.now();
      this.samples = [];
      this.statusEl.innerHTML = `
        <div style="font-size:18px; margin-bottom:10px; color:${PALETTE.yellow}; letter-spacing:0.2em;">CALIBRATION</div>
        <div>Visage <strong>neutre</strong>. Ne souriez pas.</div>
        <div style="margin-top:8px; opacity:0.6; font-size:11px;">(2 secondes)</div>
      `;
      this.calibrationLoop();
    } catch (e) {
      console.error(e);
      this.phase = 'error';
      this.statusEl.innerHTML = `
        <div style="color:${PALETTE.red}; font-weight:700;">⚠ Impossible d'accéder à la caméra.</div>
        <div style="margin-top:6px; font-size:12px; opacity:0.85;">
          Le jeu nécessite ta webcam pour mesurer ton sourire en temps réel.
          Autorise l'accès dans ton navigateur puis réessaie.
        </div>
      `;
      this.retryBtn.style.display = 'inline-block';
    }
  }

  private calibrationLoop = (): void => {
    if (!this.detector) return;
    const elapsed = (performance.now() - this.phaseStart) / 1000;
    const raw = this.detector.getRawSmile();
    if (this.phase === 'calibrating-neutral') {
      if (elapsed > 0.6) this.samples.push(raw);
      if (elapsed > 2.2) {
        const neutral = this.samples.length
          ? this.samples.reduce((s, v) => s + v, 0) / this.samples.length
          : 0.05;
        this.samples = [];
        this.phase = 'calibrating-smile';
        this.phaseStart = performance.now();
        this.statusEl.innerHTML = `
          <div style="font-size:18px; margin-bottom:10px; color:${PALETTE.yellow}; letter-spacing:0.2em;">CALIBRATION</div>
          <div>Sourire <strong>maximum</strong>. Le plus large possible.</div>
          <div style="margin-top:8px; opacity:0.6; font-size:11px;">(2 secondes)</div>
        `;
        // Stocke temporairement le neutre via attribut
        this.detector.setCalibration({ neutralSmile: neutral, maxSmile: Math.max(neutral + 0.2, 0.4) });
      }
    } else if (this.phase === 'calibrating-smile') {
      if (elapsed > 0.6) this.samples.push(raw);
      if (elapsed > 2.5) {
        const maxSmile = this.samples.length
          ? Math.max(...this.samples)
          : 0.6;
        const neutral = this.detector.getCalibration().neutralSmile;
        this.detector.setCalibration({ neutralSmile: neutral, maxSmile: Math.max(maxSmile, neutral + 0.2) });
        // Enchaîne sur la phase micro
        void this.startMicCalibration();
        return;
      }
    }
    this.rafId = requestAnimationFrame(this.calibrationLoop);
  };

  // ============== Calibration micro ==============

  private async startMicCalibration(): Promise<void> {
    this.phase = 'mic-requesting';
    this.statusEl.innerHTML = `
      <div style="font-size:18px; margin-bottom:10px; color:${PALETTE.yellow}; letter-spacing:0.2em;">MICRO</div>
      <div>Demande d'accès au micro…</div>
      <div style="margin-top:8px; opacity:0.6; font-size:11px;">Si ton navigateur affiche une demande, autorise-le.</div>
    `;
    this.skipMicBtn.style.display = 'inline-block';
    const ok = await this.microphone.requestMicrophone();
    if (!ok) {
      // Refus utilisateur ou indisponible : fallback clavier
      this.statusEl.innerHTML = `
        <div style="color:${PALETTE.red}; font-weight:700; font-size:15px;">
          Micro indisponible. Tu pourras crier avec ESPACE.
        </div>
      `;
      this.skipMicBtn.style.display = 'none';
      setTimeout(() => this.finish(), 1200);
      return;
    }
    // Calibration noise floor
    this.phase = 'calibrating-mic-floor';
    this.statusEl.innerHTML = `
      <div style="font-size:18px; margin-bottom:10px; color:${PALETTE.yellow}; letter-spacing:0.2em;">CALIBRATION MICRO</div>
      <div>Ne dis <strong>rien</strong>. Reste totalement silencieux.</div>
      <div style="margin-top:8px; opacity:0.6; font-size:11px;">(2 secondes)</div>
    `;
    this.micBar.style.display = 'block';
    this.startMicMeter();
    await this.microphone.calibrateNoiseFloor(2000);
    // Calibration scream ceiling
    this.phase = 'calibrating-mic-scream';
    this.statusEl.innerHTML = `
      <div style="font-size:18px; margin-bottom:10px; color:${PALETTE.red}; letter-spacing:0.2em;">CALIBRATION MICRO</div>
      <div><strong>CRIE</strong> aussi fort que tu peux. Maintenant.</div>
      <div style="margin-top:8px; opacity:0.6; font-size:11px;">(2 secondes — vide tes poumons)</div>
    `;
    await this.microphone.calibrateScreamCeiling(2000);
    this.stopMicMeter();
    this.micBar.style.display = 'none';
    this.skipMicBtn.style.display = 'none';
    // Affichage des seuils trouvés (debug visible)
    const { noiseFloor, screamCeiling } = this.microphone.getCalibration();
    this.statusEl.innerHTML = `
      <div style="color:${PALETTE.green}; font-size:18px; font-weight:700;">✓ Calibré.</div>
      <div style="margin-top:8px; font-size:12px; opacity:0.75;">
        Silence : ${noiseFloor.toFixed(3)} · Cri : ${screamCeiling.toFixed(3)}
      </div>
      <div style="margin-top:6px; font-size:13px; opacity:0.85;">Le public est prêt.</div>
    `;
    this.phase = 'done';
    setTimeout(() => this.finish(), 1100);
  }

  /** Joueur a cliqué "passer le micro" → fallback clavier, on saute la calibration. */
  private useKeyboardFallback(): void {
    if (this.phase !== 'mic-requesting' && this.phase !== 'calibrating-mic-floor' && this.phase !== 'calibrating-mic-scream') return;
    this.microphone.enableFallbackMode();
    this.stopMicMeter();
    this.micBar.style.display = 'none';
    this.skipMicBtn.style.display = 'none';
    this.statusEl.innerHTML = `
      <div style="color:${PALETTE.cream}; font-size:14px; opacity:0.85;">
        OK. Tu pourras crier en maintenant <strong>ESPACE</strong>.
      </div>
    `;
    this.phase = 'done';
    setTimeout(() => this.finish(), 900);
  }

  /** Boucle d'affichage du niveau micro pendant les phases mic-* */
  private startMicMeter(): void {
    const meterTick = (): void => {
      if (this.phase !== 'calibrating-mic-floor' && this.phase !== 'calibrating-mic-scream') return;
      const now = performance.now();
      const dt = this.lastFrameTs ? now - this.lastFrameTs : 16;
      this.lastFrameTs = now;
      // On lit le RMS via une mise à jour "neutre" du micro (pas de cue active)
      this.microphone.setCue('idle', 0.5);
      const snap = this.microphone.update(dt);
      // En phase floor on affiche en valeur brute (sinon tout est à 0)
      // En phase scream on affiche normalisé (mais le ceiling n'est pas encore fixé,
      // donc on utilise une échelle raw * 4 plafonnée pour donner un retour visuel).
      const visual = this.phase === 'calibrating-mic-floor'
        ? Math.min(1, snap.raw * 12)
        : Math.min(1, snap.raw * 4);
      this.micBarFill.style.width = `${(visual * 100).toFixed(1)}%`;
      this.rafId = requestAnimationFrame(meterTick);
    };
    this.lastFrameTs = 0;
    this.rafId = requestAnimationFrame(meterTick);
  }

  private stopMicMeter(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private finish(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.root.style.transition = 'opacity 0.6s ease';
    this.root.style.opacity = '0';
    setTimeout(() => {
      this.root.style.display = 'none';
      if (this.resolveFn && this.detector) {
        this.resolveFn({ detector: this.detector, microphone: this.microphone, audioStarted: true });
      }
    }, 650);
  }

  dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.root.remove();
  }
}
