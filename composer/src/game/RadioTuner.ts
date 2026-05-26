import { AudioManager } from '../audio/AudioManager';
import { InputManager } from './InputManager';
import { WorldState } from './WorldState';

export type RadioCallback = (
  freq: number,
  message: string,
  label?: string
) => void;

const FREQ_MIN = 7.0;
const FREQ_MAX = 7.9;
const FREQ_STEP = 0.1;

export class RadioTuner {
  frequency = FREQ_MIN;
  listening = false;
  private tuneCooldown = 0;
  private spokeOn77 = false;
  private negative77 = false;

  constructor(
    private input: InputManager,
    private audio: AudioManager,
    private world: WorldState,
    private onMessage: RadioCallback
  ) {}

  startListening(): void {
    this.listening = true;
    this.onMessage(
      FREQ_MIN,
      'Fréquence 7.0 MHz — consigne maintenance : réglez le poste entre 7.0 et 7.9 MHz ' +
        '(molette, ←/→ ou Q/D). [E] pour quitter le poste.',
      'POSTE RADIO'
    );
    this.audio.playRadioTune(FREQ_MIN);
  }

  stopListening(): void {
    this.listening = false;
  }

  toggleListening(): void {
    if (this.listening) this.stopListening();
    else this.startListening();
  }

  update(dt: number, onNegative77?: () => void): void {
    if (!this.listening) return;
    this.tuneCooldown -= dt;

    const tuneLeft = this.input.isDown('KeyA', 'KeyQ', 'ArrowLeft');
    const tuneRight = this.input.isDown('KeyD', 'ArrowRight');
    const wheel = this.input.consumeWheelDelta();

    let step = 0;
    if (wheel !== 0) {
      step = (Math.sign(wheel) || 1) * FREQ_STEP;
    } else if (this.tuneCooldown <= 0) {
      if (tuneLeft && !tuneRight) step = -FREQ_STEP;
      else if (tuneRight && !tuneLeft) step = FREQ_STEP;
    }

    if (step !== 0) {
      const next =
        Math.round(
          Math.min(FREQ_MAX, Math.max(FREQ_MIN, this.frequency + step)) * 10
        ) / 10;
      if (next !== this.frequency) {
        this.frequency = next;
        this.tuneCooldown = wheel !== 0 ? 0.08 : 0.14;
        this.audio.playRadioTune(this.frequency);
        this.handleFrequency(onNegative77);
      }
    }

    if (
      this.frequency === 7.7 &&
      (this.input.isDown('KeyV') || this.input.isDown('KeyM'))
    ) {
      if (!this.spokeOn77) {
        this.spokeOn77 = true;
        this.negative77 = true;
        this.audio.playStaticBurst(0.5);
        onNegative77?.();
      }
    }
  }

  private handleFrequency(onNegative77?: () => void): void {
    const f = this.frequency;
    if (f === 7.0) {
      this.onMessage(
        7.0,
        '« Technicien de garde : vérifiez le transfert serveur, puis coupez la balise 7 si les coordonnées GPS pointent vers l\'intérieur du bâtiment. »',
        '7.0 MHz — CONSIGNE'
      );
      this.audio.playSyntheticVoice('COUPEZ LA BALISE SI GPS INTERIEUR');
    } else if (f === 7.4) {
      this.onMessage(
        7.4,
        'Static… puis une voix lit votre badge et votre position actuelle. Les coordonnées suivent vos pas.',
        '7.4 MHz — SUIVI'
      );
      this.world.playerHasSeenAnomaly = true;
      this.audio.playSyntheticVoice('POSITION SECTEUR SEPT MAINTENANT');
    } else if (f === 7.7) {
      this.onMessage(
        7.7,
        'Silence radio. Ne parlez pas — le micro du poste est actif (évitez V ou M).',
        '7.7 MHz — SILENCE'
      );
      if (this.negative77) onNegative77?.();
    } else if (f === 7.9) {
      this.onMessage(
        7.9,
        '« …coupez la balise. Coupez-la maintenant. » Allez au cœur de la salle et utilisez COUPEZ BALISE 7.',
        '7.9 MHz — ORDRE'
      );
      this.audio.playSyntheticVoice('COUPEZ LA BALISE');
    }
  }

  getHudText(): string {
    return this.listening ? `${this.frequency.toFixed(1)} MHz` : '';
  }
}
