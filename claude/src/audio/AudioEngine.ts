/**
 * AudioEngine : façade unique pour tout l'audio du jeu.
 * - Initialise Tone (nécessite un geste utilisateur)
 * - Lance/coupe les ambiances continues
 * - Expose les one-shots
 * - Module dynamiquement selon le niveau de stress
 */
import * as Tone from 'tone';
import {
  makeStudioHum,
  makeAudienceMurmur,
  makeHeartbeat,
  makeTenseBass,
  makeBackstageHum,
  playLaughTrack,
  playGlitchSting,
  playSpotIgnition,
  playHostUtterance,
  playApplauseSting,
  playPowerCut,
  playScreamerImpact,
  playFluorescentFlicker,
  playVHSInsert,
  playVHSPlay,
  playStalkerStep,
  playProjectorStart,
  playDoorOpen,
  playApplauseSwell,
  playChildGiggle,
  playChildWhisper,
  playCuecardDescend,
  playShowCueDing,
  playAudienceGasp,
  playAudienceScream,
  playClimaxScream,
  playTvIntroJingle,
  playCountdownBeep,
  makeStudioDrone,
  ProceduralSound,
} from './proceduralSounds';
import { SfxLibrary } from './SfxLibrary';

export type Ambience = 'studio' | 'backstage' | 'silent';

export class AudioEngine {
  private started = false;
  private hum: ProceduralSound | null = null;
  private murmur: ProceduralSound | null = null;
  private heart: (ProceduralSound & { setBpm(bpm: number): void }) | null = null;
  private tenseBass: (ProceduralSound & { setLevel(level: number): void }) | null = null;
  private backstageHum: ProceduralSound | null = null;
  private studioDrone: (ProceduralSound & { setLevel(level: number): void }) | null = null;
  private studioDroneActive = false;
  private ambience: Ambience = 'studio';
  private stress = 0;
  /** Cache de SFX charges depuis public/sfx/. Fallback procedural si manquant. */
  readonly sfx = new SfxLibrary();
  /** Loops SFX actives gerees par AudioEngine (drone studio + crt buzz). */
  private studioDroneUsingSfx = false;
  private crtBuzzActive = false;

  /** Doit être appelé depuis un click utilisateur. */
  async start(): Promise<void> {
    if (this.started) return;
    await Tone.start();
    this.hum = makeStudioHum();
    this.murmur = makeAudienceMurmur();
    this.heart = makeHeartbeat();
    this.tenseBass = makeTenseBass();
    this.backstageHum = makeBackstageHum();
    // Ambiance studio par défaut
    this.hum.start();
    this.murmur.start();
    this.heart.start();
    this.tenseBass.start();
    // backstageHum ne démarre qu'au switchAmbience('backstage')
    this.started = true;
    // Precharge les SFX en arriere-plan (non bloquant).
    // Les sons procedurales restent disponibles tant que les fichiers ne sont
    // pas charges, donc le jeu peut commencer immediatement.
    void this.sfx.load().then(() => {
      // Une fois charges, demarre les loops correspondant a l'ambiance courante.
      if (this.ambience === 'studio') {
        this.sfx.startLoop('audience_murmur_loop');
      } else if (this.ambience === 'backstage') {
        this.sfx.startLoop('backstage_hum_loop');
      }
      // Si studio drone etait deja actif (procedural), bascule vers SFX
      if (this.studioDroneActive && !this.studioDroneUsingSfx && this.sfx.has('studio_drone_loop')) {
        // Recupere le niveau courant depuis le procedural (on n'a pas getter,
        // on remet juste un niveau bas par defaut, le caller ajustera).
        this.studioDrone?.stop();
        const d = this.studioDrone;
        this.studioDrone = null;
        setTimeout(() => { try { d?.dispose(); } catch { /* ignore */ } }, 600);
        this.sfx.startLoop('studio_drone_loop', this.levelToDb(0.05));
        this.studioDroneUsingSfx = true;
      }
      // Idem pour le crt buzz s'il est actif
      if (this.crtBuzzActive && this.sfx.has('crt_buzz_loop')) {
        this.sfx.startLoop('crt_buzz_loop');
      }
    });
  }

  /** 0..1 — pilote les ambiances et le rythme cardiaque. */
  setStress(level: number): void {
    this.stress = Math.max(0, Math.min(1, level));
    if (!this.started) return;
    if (this.ambience === 'studio') {
      this.hum?.set?.('volume', 0.06 + this.stress * 0.10);
      this.murmur?.set?.('volume', 0.03 + this.stress * 0.05);
      if (this.heart) {
        this.heart.setBpm(60 + this.stress * 90);
        this.heart.set?.('volume', 0.15 + this.stress * 0.45);
      }
    }
  }

  /** Niveau du drone sub-bass d'avertissement (0 = off). */
  setTenseBass(level: number): void {
    this.tenseBass?.setLevel(level);
  }

  /**
   * Crossfade entre les ambiances. Studio = hum + murmur + heartbeat.
   * Backstage = backstageHum seul. Silent = tout off (pour finale).
   *
   * Quand les SFX MP3 sont charges, on layer:
   *  - audience_murmur_loop par-dessus en studio
   *  - backstage_hum_loop par-dessus en backstage
   *  - tout coupe en silent
   */
  switchAmbience(target: Ambience): void {
    if (!this.started || this.ambience === target) return;
    this.ambience = target;
    if (target === 'studio') {
      this.backstageHum?.set?.('volume', 0);
      this.hum?.start();
      this.murmur?.start();
      this.heart?.start();
      this.hum?.set?.('volume', 0.10);
      this.murmur?.set?.('volume', 0.05);
      this.heart?.set?.('volume', 0.25);
      // SFX loops
      this.sfx.stopLoop('backstage_hum_loop');
      this.sfx.startLoop('audience_murmur_loop');
    } else if (target === 'backstage') {
      this.hum?.set?.('volume', 0);
      this.murmur?.set?.('volume', 0);
      this.heart?.set?.('volume', 0);
      this.tenseBass?.setLevel(0);
      this.backstageHum?.start();
      this.backstageHum?.set?.('volume', 0.16);
      // SFX loops
      this.sfx.stopLoop('audience_murmur_loop');
      this.sfx.startLoop('backstage_hum_loop');
    } else {
      // silent
      this.hum?.set?.('volume', 0);
      this.murmur?.set?.('volume', 0);
      this.heart?.set?.('volume', 0);
      this.tenseBass?.setLevel(0);
      this.backstageHum?.set?.('volume', 0);
      this.sfx.stopLoop('audience_murmur_loop');
      this.sfx.stopLoop('backstage_hum_loop');
    }
  }

  /** Demarre/stoppe la boucle de buzz CRT (independante des ambiances). */
  startCrtBuzz(): void {
    if (!this.started || this.crtBuzzActive) return;
    if (!this.sfx.has('crt_buzz_loop')) return;
    this.sfx.startLoop('crt_buzz_loop');
    this.crtBuzzActive = true;
  }
  stopCrtBuzz(): void {
    if (!this.crtBuzzActive) return;
    this.sfx.stopLoop('crt_buzz_loop');
    this.crtBuzzActive = false;
  }

  // ============== One-shots ==============
  // Chaque methode essaie d'abord de jouer le SFX MP3 (si charge depuis
  // public/sfx/), sinon retombe sur le son procedural correspondant.

  laugh(glitch = 0): void {
    if (!this.started) return;
    if (this.sfx.has('audience_canned_laugh')) {
      this.sfx.playOneShot('audience_canned_laugh');
      // Glitch optionnel pardessus pour conserver l'effet "VHS qui craque"
      if (glitch > 0.3) playGlitchSting(glitch * 0.5);
      return;
    }
    playLaughTrack(glitch);
  }
  glitchSting(intensity = 1): void {
    if (!this.started) return;
    if (this.sfx.has('glitch_sting')) {
      this.sfx.playOneShot('glitch_sting', (intensity - 1) * 4);
      return;
    }
    playGlitchSting(intensity);
  }
  spotIgnition(): void {
    if (!this.started) return;
    playSpotIgnition();
  }
  hostUtterance(syllables = 6, intensity = 1): void {
    if (!this.started) return;
    // Pour les vrais "punchlines" d'horreur, on utilise host_evil_laugh.
    // Sinon on garde le babillage procedural (plus modulable).
    if (intensity >= 1.2 && this.sfx.has('host_evil_laugh')) {
      this.sfx.playOneShot('host_evil_laugh');
      return;
    }
    playHostUtterance(syllables, intensity);
  }
  /** Rire diabolique de M. Sourire en one-shot (sans fallback procedural specifique). */
  hostEvilLaugh(): void {
    if (!this.started) return;
    if (this.sfx.has('host_evil_laugh')) this.sfx.playOneShot('host_evil_laugh');
    else playHostUtterance(8, 1.2);
  }
  /** Souffle distordu de M. Sourire (utilise pendant silences). */
  hostBreath(): void {
    if (!this.started) return;
    if (this.sfx.has('host_breath_distorted')) this.sfx.playOneShot('host_breath_distorted');
  }
  applauseSting(): void {
    if (!this.started) return;
    playApplauseSting();
  }
  powerCut(): void {
    if (!this.started) return;
    if (this.sfx.has('power_cut_thump')) {
      this.sfx.playOneShot('power_cut_thump');
      return;
    }
    playPowerCut();
  }
  /** GROS BRUIT d'arrivée du screamer — sub + noise + crash + roar. */
  screamerImpact(intensity = 1): void {
    if (!this.started) return;
    if (this.sfx.has('screamer_impact_loud')) {
      // Boost dB selon intensite (clamp pour eviter destruction d'oreille)
      const boost = Math.min(4, (intensity - 1) * 6);
      this.sfx.playOneShot('screamer_impact_loud', boost);
      return;
    }
    playScreamerImpact(intensity);
  }
  /** Crissement de violon strident — sting d'horreur classique. */
  metallicScreech(): void {
    if (!this.started) return;
    if (this.sfx.has('metallic_screech')) this.sfx.playOneShot('metallic_screech');
    else playGlitchSting(1.2);
  }
  /** Battement de coeur isole. */
  heartbeatPulse(): void {
    if (!this.started) return;
    if (this.sfx.has('heartbeat_slow')) this.sfx.playOneShot('heartbeat_slow');
  }
  fluorescentFlicker(): void {
    if (!this.started) return;
    playFluorescentFlicker();
  }
  vhsInsert(): void {
    if (!this.started) return;
    if (this.sfx.has('vhs_cassette_insert')) {
      this.sfx.playOneShot('vhs_cassette_insert');
      return;
    }
    playVHSInsert();
  }
  vhsPlay(): void {
    if (!this.started) return;
    playVHSPlay();
  }
  stalkerStep(): void {
    if (!this.started) return;
    playStalkerStep();
  }
  projectorStart(): void {
    if (!this.started) return;
    playProjectorStart();
  }
  doorOpen(): void {
    if (!this.started) return;
    playDoorOpen();
  }
  applauseSwell(intensity = 1): void {
    if (!this.started) return;
    if (this.sfx.has('applause_burst')) {
      const boost = (intensity - 1) * 3;
      this.sfx.playOneShot('applause_burst', boost);
      return;
    }
    playApplauseSwell(intensity);
  }
  childGiggle(): void {
    if (!this.started) return;
    if (this.sfx.has('child_giggle')) {
      this.sfx.playOneShot('child_giggle');
      return;
    }
    playChildGiggle();
  }
  childWhisper(): void {
    if (!this.started) return;
    if (this.sfx.has('child_whisper_hello')) {
      this.sfx.playOneShot('child_whisper_hello');
      return;
    }
    playChildWhisper();
  }
  /** Cri d'enfant aigu (apparition / bascule grotesque). */
  childScream(): void {
    if (!this.started) return;
    if (this.sfx.has('child_scream')) this.sfx.playOneShot('child_scream');
    else playAudienceScream(0.8);
  }
  cuecardDescend(): void {
    if (!this.started) return;
    playCuecardDescend();
  }
  showCueDing(): void {
    if (!this.started) return;
    playShowCueDing();
  }
  audienceGasp(): void {
    if (!this.started) return;
    if (this.sfx.has('audience_gasp')) {
      this.sfx.playOneShot('audience_gasp');
      return;
    }
    playAudienceGasp();
  }
  audienceScream(intensity = 1): void {
    if (!this.started) return;
    playAudienceScream(intensity);
  }
  climaxScream(intensity = 1): void {
    if (!this.started) return;
    // Au climax on superpose le screamer .mp3 (s'il existe) + child_scream pour
    // un effet "voix multiples" terrifiant. Sinon fallback procedural complet.
    if (this.sfx.has('screamer_impact_loud')) {
      const boost = Math.min(4, (intensity - 1) * 4);
      this.sfx.playOneShot('screamer_impact_loud', boost);
      if (this.sfx.has('child_scream')) this.sfx.playOneShot('child_scream', -3);
      return;
    }
    playClimaxScream(intensity);
  }
  tvIntroJingle(): void {
    if (!this.started) return;
    if (this.sfx.has('tv_show_intro_jingle')) {
      this.sfx.playOneShot('tv_show_intro_jingle');
      return;
    }
    playTvIntroJingle();
  }
  countdownBeep(): void {
    if (!this.started) return;
    if (this.sfx.has('studio_countdown_beep')) {
      this.sfx.playOneShot('studio_countdown_beep');
      return;
    }
    playCountdownBeep();
  }

  /**
   * Drone d'ambiance Ch3 — demarrage idempotent.
   * Si studio_drone_loop.mp3 est present, on l'utilise. Sinon fallback sub-bass procedural.
   */
  startStudioDrone(initialLevel = 0.05): void {
    if (!this.started) return;
    if (this.studioDroneActive) {
      this.setStudioDroneVolume(initialLevel);
      return;
    }
    if (this.sfx.has('studio_drone_loop')) {
      // SFX MP3 : initialLevel mappe de 0..1 vers -30dB..0dB
      const db = this.levelToDb(initialLevel);
      this.sfx.startLoop('studio_drone_loop', db);
      this.studioDroneUsingSfx = true;
    } else {
      if (!this.studioDrone) this.studioDrone = makeStudioDrone();
      this.studioDrone.start();
      this.studioDrone.setLevel(initialLevel);
      this.studioDroneUsingSfx = false;
    }
    this.studioDroneActive = true;
  }

  setStudioDroneVolume(level: number): void {
    if (!this.started || !this.studioDroneActive) return;
    if (this.studioDroneUsingSfx) {
      this.sfx.setLoopVolume('studio_drone_loop', this.levelToDb(level));
    } else {
      this.studioDrone?.setLevel(level);
    }
  }

  stopStudioDrone(): void {
    if (!this.studioDroneActive) return;
    this.studioDroneActive = false;
    if (this.studioDroneUsingSfx) {
      this.sfx.stopLoop('studio_drone_loop');
      this.studioDroneUsingSfx = false;
      return;
    }
    this.studioDrone?.stop();
    const d = this.studioDrone;
    this.studioDrone = null;
    setTimeout(() => {
      try {
        d?.dispose();
      } catch {
        /* ignore */
      }
    }, 800);
  }

  /** Convertit un niveau lineaire 0..1 en dB pour Tone.Player.volume. */
  private levelToDb(level: number): number {
    const clamped = Math.max(0.0001, Math.min(1, level));
    return 20 * Math.log10(clamped);
  }

  dispose(): void {
    this.sfx.dispose();
    this.hum?.dispose();
    this.murmur?.dispose();
    this.heart?.dispose();
    this.tenseBass?.dispose();
    this.backstageHum?.dispose();
    this.studioDrone?.dispose();
    this.hum = this.murmur = this.heart = this.tenseBass = this.backstageHum = null;
    this.studioDrone = null;
    this.studioDroneActive = false;
    this.studioDroneUsingSfx = false;
    this.crtBuzzActive = false;
    this.started = false;
  }
}
