/**
 * MicrophoneInput — capture du micro utilisateur pour la mécanique "cri/silence"
 * du Chapitre 3.
 *
 * - Demande l'accès au micro via getUserMedia (audio uniquement).
 * - Branche un AnalyserNode et calcule un RMS lissé.
 * - Effectue une calibration de 1.6s pour fixer un noise floor adapté à
 *   l'environnement du joueur (souffle, clim, etc.).
 * - Expose un fallback clavier : si le micro est refusé ou indisponible,
 *   maintenir ESPACE simule un cri.
 * - Optionnel : route le signal du micro vers un ConvolverNode (réverb) puis la
 *   sortie pour donner au joueur l'impression d'entendre sa propre voix
 *   résonner dans la salle. Coupé par défaut (risque de larsen sans casque).
 */

export type MicState = 'idle' | 'requesting' | 'calibrating' | 'ready' | 'fallback' | 'error';

export interface MicSnapshot {
  level: number;          // 0..1 normalisé (au-dessus du noise floor)
  raw: number;            // RMS brut 0..~0.5
  state: MicState;
  isFallback: boolean;
}

export class MicrophoneInput {
  state: MicState = 'idle';
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private convolver: ConvolverNode | null = null;
  private wetGain: GainNode | null = null;
  private dataBuffer: Float32Array<ArrayBuffer> | null = null;
  private smoothedRms = 0;
  private noiseFloor = 0.015;
  /** Niveau au-dessus duquel on considère "cri saturé" pour la normalisation. */
  private screamCeiling = 0.42;
  /** Fallback clavier : ESPACE maintenu = niveau ~1.0. */
  private keyboardScreaming = false;
  private fallback = false;
  /** Cue active : ses paramètres déterminent l'accumulation du hold timer. */
  private cueMode: 'scream' | 'silence' | 'idle' = 'idle';
  private cueThreshold = 0.5;
  /** Durée pendant laquelle la cue est satisfaite en continu (ms). */
  private cueHoldMs = 0;
  /** Time stamp de la dernière mise à jour. */
  private lastUpdate = 0;
  /** Anti-larsen : reverb désactivée par défaut. */
  private reverbEnabled = false;

  constructor() {
    // Listener clavier en fallback (toujours dispo)
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space') this.keyboardScreaming = true;
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Space') this.keyboardScreaming = false;
  };

  /**
   * Demande l'accès au micro. À appeler depuis un geste utilisateur (clic).
   * Si l'utilisateur refuse, on bascule en fallback clavier sans throw.
   */
  async requestMicrophone(): Promise<boolean> {
    if (this.state === 'ready') return true;
    this.state = 'requesting';
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
    } catch (err) {
      console.warn('[MicrophoneInput] Permission refusée, fallback clavier.', err);
      this.fallback = true;
      this.state = 'fallback';
      return false;
    }
    // Construit le graphe audio
    this.ctx = new AudioContext();
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.0; // on lisse nous-mêmes
    this.dataBuffer = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
    this.source.connect(this.analyser);
    // Réverb procédurale (impulse synthétique) — pas connectée à la sortie par défaut
    this.convolver = this.ctx.createConvolver();
    this.convolver.buffer = this.buildImpulseResponse(this.ctx, 1.4, 2.4);
    this.wetGain = this.ctx.createGain();
    this.wetGain.gain.value = 0;
    this.source.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.ctx.destination);
    return true;
  }

  /**
   * Capture une fenêtre RMS pendant `durationMs`. Renvoie l'array trié.
   * Helper interne pour les calibrations.
   */
  private async captureRmsSamples(durationMs: number): Promise<number[]> {
    if (this.fallback || !this.analyser || !this.dataBuffer) return [];
    const samples: number[] = [];
    const start = performance.now();
    return new Promise<number[]>((resolve) => {
      const tick = (): void => {
        const now = performance.now();
        this.analyser!.getFloatTimeDomainData(this.dataBuffer!);
        let sum = 0;
        for (let i = 0; i < this.dataBuffer!.length; i++) {
          const v = this.dataBuffer![i];
          sum += v * v;
        }
        const rms = Math.sqrt(sum / this.dataBuffer!.length);
        samples.push(rms);
        if (now - start < durationMs) {
          requestAnimationFrame(tick);
        } else {
          samples.sort((a, b) => a - b);
          resolve(samples);
        }
      };
      tick();
    });
  }

  /**
   * Phase de calibration : capture 1.6s d'audio ambiant pour déterminer le
   * noise floor du joueur. Calibration "complète" (compat existante).
   */
  async calibrate(durationMs = 1600): Promise<void> {
    await this.calibrateNoiseFloor(durationMs);
  }

  /** Calibre le noise floor (le joueur reste silencieux). */
  async calibrateNoiseFloor(durationMs = 1600): Promise<void> {
    if (this.fallback) {
      this.state = 'ready';
      return;
    }
    this.state = 'calibrating';
    const samples = await this.captureRmsSamples(durationMs);
    if (samples.length > 0) {
      // Percentile 75 = robuste aux silences brefs sans être pollué par les
      // pics ponctuels.
      const idx = Math.floor(samples.length * 0.75);
      this.noiseFloor = Math.max(0.005, samples[idx] || 0.010);
    }
    this.state = 'ready';
  }

  /** Calibre le plafond "cri" (le joueur crie aussi fort qu'il peut). */
  async calibrateScreamCeiling(durationMs = 2000): Promise<void> {
    if (this.fallback) {
      this.state = 'ready';
      return;
    }
    this.state = 'calibrating';
    const samples = await this.captureRmsSamples(durationMs);
    if (samples.length > 0) {
      // Percentile 85 — on enlève les outliers (pic ponctuel d'overdrive).
      const idx = Math.floor(samples.length * 0.85);
      const peak = samples[idx] || samples[samples.length - 1];
      // Le screamCeiling représente "le niveau auquel la barre atteint 100%".
      // On le met à 80% du peak observé pour que le joueur puisse atteindre
      // 100% sans avoir à crier MAX absolu à chaque fois (fatigue vocale).
      this.screamCeiling = Math.max(
        this.noiseFloor + 0.04,
        peak * 0.80,
      );
    }
    this.state = 'ready';
  }

  /** Force manuellement les seuils de calibration. */
  setCalibration(noiseFloor: number, screamCeiling: number): void {
    this.noiseFloor = Math.max(0.001, noiseFloor);
    this.screamCeiling = Math.max(this.noiseFloor + 0.04, screamCeiling);
  }

  /** Renvoie les seuils courants (debug / affichage). */
  getCalibration(): { noiseFloor: number; screamCeiling: number } {
    return { noiseFloor: this.noiseFloor, screamCeiling: this.screamCeiling };
  }

  /** Bascule en mode fallback clavier (utile si l'utilisateur skip le micro). */
  enableFallbackMode(): void {
    this.fallback = true;
    this.state = 'fallback';
  }

  /**
   * Frame update : calcule le RMS, met à jour `level` et les compteurs de hold.
   * À appeler à chaque frame du loop principal.
   */
  update(dtMs: number): MicSnapshot {
    let level = 0;
    let raw = 0;
    if (this.fallback) {
      level = this.keyboardScreaming ? 1.0 : 0.0;
      raw = level * this.screamCeiling;
      this.smoothedRms = level;
    } else if (this.analyser && this.dataBuffer) {
      this.analyser.getFloatTimeDomainData(this.dataBuffer);
      let sum = 0;
      for (let i = 0; i < this.dataBuffer.length; i++) {
        const v = this.dataBuffer[i];
        sum += v * v;
      }
      raw = Math.sqrt(sum / this.dataBuffer.length);
      // Lissage exponentiel (attaque rapide, release un peu plus lent)
      const attack = raw > this.smoothedRms ? 0.55 : 0.18;
      this.smoothedRms = this.smoothedRms + (raw - this.smoothedRms) * attack;
      // Normalisation au-dessus du noise floor
      const dynRange = Math.max(0.001, this.screamCeiling - this.noiseFloor);
      level = Math.max(0, Math.min(1, (this.smoothedRms - this.noiseFloor) / dynRange));
    }
    // Hold-timer dynamique selon la cue active
    let cueMet = false;
    if (this.cueMode === 'scream') cueMet = level >= this.cueThreshold;
    else if (this.cueMode === 'silence') cueMet = level < this.cueThreshold;
    if (cueMet) this.cueHoldMs += dtMs;
    else this.cueHoldMs = 0;
    this.lastUpdate = performance.now();
    return {
      level,
      raw,
      state: this.state,
      isFallback: this.fallback,
    };
  }

  /**
   * Définit la cue courante. Reset le hold timer si la nature de la cue change.
   * `mode='idle'` désactive la détection.
   */
  setCue(mode: 'scream' | 'silence' | 'idle', threshold = 0.5): void {
    if (this.cueMode !== mode || Math.abs(this.cueThreshold - threshold) > 0.001) {
      this.cueMode = mode;
      this.cueThreshold = threshold;
      this.cueHoldMs = 0;
    }
  }

  /** Renvoie true si la cue courante est tenue depuis au moins `holdMs`. */
  isCueMet(holdMs = 800): boolean {
    return this.cueMode !== 'idle' && this.cueHoldMs >= holdMs;
  }

  /** Compat : renvoie true si le joueur crie au-dessus de `threshold` depuis `holdMs`. */
  isScreaming(threshold = 0.55, holdMs = 800): boolean {
    // Si la cue active est déjà 'scream' au même threshold, on réutilise le timer
    if (this.cueMode === 'scream' && Math.abs(this.cueThreshold - threshold) < 0.001) {
      return this.cueHoldMs >= holdMs;
    }
    const lvl = this.smoothedRmsNormalized;
    return lvl >= threshold;
  }

  /** Compat : renvoie true si le joueur reste silencieux sous `threshold` depuis `holdMs`. */
  isSilent(threshold = 0.08, holdMs = 1500): boolean {
    if (this.cueMode === 'silence' && Math.abs(this.cueThreshold - threshold) < 0.001) {
      return this.cueHoldMs >= holdMs;
    }
    const lvl = this.smoothedRmsNormalized;
    return lvl < threshold;
  }

  /** Niveau "live" sans nouveau update — utilisé pour les helpers. */
  get smoothedRmsNormalized(): number {
    const dynRange = Math.max(0.001, this.screamCeiling - this.noiseFloor);
    return Math.max(0, Math.min(1, (this.smoothedRms - this.noiseFloor) / dynRange));
  }

  /** Active/désactive la réverb sur la voix (effet "salle"). À éviter sans casque. */
  setReverbEnabled(enabled: boolean): void {
    this.reverbEnabled = enabled;
    if (this.wetGain && this.ctx) {
      const target = enabled ? 0.35 : 0;
      this.wetGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.15);
    }
  }

  get isReady(): boolean {
    return this.state === 'ready' || this.state === 'fallback';
  }

  get isUsingFallback(): boolean {
    return this.fallback;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
    }
    if (this.ctx) {
      void this.ctx.close();
    }
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.convolver = null;
    this.wetGain = null;
    this.dataBuffer = null;
  }

  /** Impulse response synthétique : décroissance exponentielle bruitée. */
  private buildImpulseResponse(ctx: AudioContext, durationSec: number, decay: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const buf = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        // Bruit blanc * décroissance exponentielle
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }
}
