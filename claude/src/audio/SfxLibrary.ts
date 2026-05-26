/**
 * SfxLibrary — cache de Tone.Player charges depuis `/public/sfx/...`.
 *
 * - `load()` precharge tous les .mp3 referencees dans `SFX_REGISTRY`. Si un
 *   fichier est manquant (404) ou pourri, on log un warning et on laisse
 *   l'AudioEngine retomber sur son equivalent procedural (fallback).
 * - `has(key)` : true si le fichier est charge et utilisable.
 * - `playOneShot(key, opts)` : joue le SFX UNE fois. Pour les SFX joues
 *   en rafale (gasp, beep, applause), on clone le buffer dans un nouveau
 *   Player jetable. Pour les SFX joues rarement, on reutilise le Player.
 * - `startLoop(key, opts)` / `stopLoop(key)` / `setLoopVolume(key, vol)` :
 *   gestion des loops avec fadeIn/fadeOut elegant.
 *
 * Tous les SFX sont routes vers la destination Tone (master).
 */
import * as Tone from 'tone';

export type SfxKey =
  // Ambient (loops)
  | 'studio_drone_loop'
  | 'audience_murmur_loop'
  | 'crt_buzz_loop'
  | 'backstage_hum_loop'
  // Voice
  | 'host_evil_laugh'
  | 'host_breath_distorted'
  | 'child_giggle'
  | 'child_whisper_hello'
  | 'child_scream'
  // Show
  | 'tv_show_intro_jingle'
  | 'studio_countdown_beep'
  | 'applause_burst'
  | 'audience_canned_laugh'
  | 'audience_gasp'
  // Scare
  | 'screamer_impact_loud'
  | 'glitch_sting'
  | 'metallic_screech'
  | 'heartbeat_slow'
  // Mech
  | 'power_cut_thump'
  | 'vhs_cassette_insert';

interface SfxEntry {
  /** Chemin relatif a la racine de l'app (sert via Vite public/). */
  url: string;
  /** Volume en dB (positif = boost, negatif = attenue). Default 0. */
  volumeDb?: number;
  /** Boucle ? Si true, c'est une ambiance qu'on demarre/stoppe via startLoop. */
  loop?: boolean;
  /** Fade-in pour les loops (en secondes). */
  fadeIn?: number;
  /** Fade-out pour les loops (en secondes). */
  fadeOut?: number;
}

/**
 * Catalogue central. Modifier ici les volumes/fades sans toucher au code.
 *
 * - Le drone, les murmures et le hum sont mixees pour rester discrets.
 * - Le screamer est BOOSTE (+3dB) — c'est le moment cle du jeu.
 * - Les beeps/applause sont reduits pour ne pas saturer.
 */
const SFX_REGISTRY: Record<SfxKey, SfxEntry> = {
  // Ambient
  studio_drone_loop:     { url: '/sfx/ambient/studio_drone_loop.mp3',     loop: true, volumeDb: -8,  fadeIn: 1.2, fadeOut: 0.8 },
  audience_murmur_loop:  { url: '/sfx/ambient/audience_murmur_loop.mp3',  loop: true, volumeDb: -14, fadeIn: 1.5, fadeOut: 1.0 },
  crt_buzz_loop:         { url: '/sfx/ambient/crt_buzz_loop.mp3',         loop: true, volumeDb: -18, fadeIn: 0.6, fadeOut: 0.6 },
  backstage_hum_loop:    { url: '/sfx/ambient/backstage_hum_loop.mp3',    loop: true, volumeDb: -10, fadeIn: 1.5, fadeOut: 1.5 },
  // Voice
  host_evil_laugh:       { url: '/sfx/voice/host_evil_laugh.mp3',         volumeDb: -2 },
  host_breath_distorted: { url: '/sfx/voice/host_breath_distorted.mp3',   volumeDb: -6 },
  child_giggle:          { url: '/sfx/voice/child_giggle.mp3',            volumeDb: -3 },
  child_whisper_hello:   { url: '/sfx/voice/child_whisper_hello.mp3',     volumeDb: -2 },
  child_scream:          { url: '/sfx/voice/child_scream.mp3',            volumeDb: 0 },
  // Show
  tv_show_intro_jingle:  { url: '/sfx/show/tv_show_intro_jingle.mp3',     volumeDb: -4 },
  studio_countdown_beep: { url: '/sfx/show/studio_countdown_beep.mp3',    volumeDb: -8 },
  applause_burst:        { url: '/sfx/show/applause_burst.mp3',           volumeDb: -4 },
  audience_canned_laugh: { url: '/sfx/show/audience_canned_laugh.mp3',    volumeDb: -4 },
  audience_gasp:         { url: '/sfx/show/audience_gasp.mp3',            volumeDb: -2 },
  // Scare
  screamer_impact_loud:  { url: '/sfx/scare/screamer_impact_loud.mp3',    volumeDb: +3 },
  glitch_sting:          { url: '/sfx/scare/glitch_sting.mp3',            volumeDb: -2 },
  metallic_screech:      { url: '/sfx/scare/metallic_screech.mp3',        volumeDb: -3 },
  heartbeat_slow:        { url: '/sfx/scare/heartbeat_slow.mp3',          volumeDb: -3 },
  // Mech
  power_cut_thump:       { url: '/sfx/mech/power_cut_thump.mp3',          volumeDb: -1 },
  vhs_cassette_insert:   { url: '/sfx/mech/vhs_cassette_insert.mp3',      volumeDb: -3 },
};

interface LoopState {
  player: Tone.Player;
  /** Volume cible en dB (mis a jour par setLoopVolume). */
  targetVolumeDb: number;
  /** Etat : true entre startLoop et stopLoop. */
  running: boolean;
}

export class SfxLibrary {
  /** Buffer charge par cle. null = echec de chargement. */
  private buffers = new Map<SfxKey, Tone.ToneAudioBuffer | null>();
  /** Player partage par cle (pour loops + reutilisation rapide one-shot). */
  private players = new Map<SfxKey, Tone.Player>();
  /** Etat des loops actifs. */
  private loops = new Map<SfxKey, LoopState>();
  private loadPromise: Promise<void> | null = null;

  /** Demarre le chargement de TOUS les SFX en parallele. Resolu quand tout est tente. */
  load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    const entries = Object.entries(SFX_REGISTRY) as Array<[SfxKey, SfxEntry]>;
    this.loadPromise = Promise.allSettled(
      entries.map(([key, entry]) => this.loadOne(key, entry)),
    ).then((results) => {
      let ok = 0;
      let fail = 0;
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const key = entries[i][0];
        if (r.status === 'fulfilled' && r.value) ok++;
        else {
          fail++;
          // eslint-disable-next-line no-console
          console.warn(`[SfxLibrary] ${key} unavailable, falling back to procedural`);
        }
      }
      // eslint-disable-next-line no-console
      console.info(`[SfxLibrary] loaded ${ok}/${entries.length} SFX (${fail} fallback)`);
    });
    return this.loadPromise;
  }

  private loadOne(key: SfxKey, entry: SfxEntry): Promise<boolean> {
    return new Promise((resolve) => {
      const buf = new Tone.ToneAudioBuffer(
        entry.url,
        () => {
          this.buffers.set(key, buf);
          // Cree un Player partage initial
          const player = new Tone.Player({
            url: buf,
            loop: !!entry.loop,
            fadeIn: entry.fadeIn ?? 0,
            fadeOut: entry.fadeOut ?? 0,
            autostart: false,
          }).toDestination();
          player.volume.value = entry.volumeDb ?? 0;
          this.players.set(key, player);
          resolve(true);
        },
        (err) => {
          // eslint-disable-next-line no-console
          console.warn(`[SfxLibrary] failed to load ${entry.url}:`, err);
          this.buffers.set(key, null);
          resolve(false);
        },
      );
    });
  }

  /** True si le fichier est charge et pret a etre joue. */
  has(key: SfxKey): boolean {
    const buf = this.buffers.get(key);
    return !!buf && buf.loaded;
  }

  /**
   * Joue un one-shot. Si un meme key est deja en cours, on clone le buffer
   * dans un Player jetable (utile pour beeps en rafale). Volume optionnel en
   * dB (additionne au volume du registry).
   */
  playOneShot(key: SfxKey, volumeDbOffset = 0): void {
    if (!this.has(key)) return;
    const entry = SFX_REGISTRY[key];
    if (entry.loop) {
      // Les loops ne passent pas par playOneShot
      return;
    }
    const sharedPlayer = this.players.get(key);
    if (!sharedPlayer) return;

    // Si le player partage est libre, on l'utilise directement.
    if (sharedPlayer.state !== 'started') {
      try {
        sharedPlayer.volume.value = (entry.volumeDb ?? 0) + volumeDbOffset;
        sharedPlayer.start();
      } catch {
        /* ignore "Source must be started before pausing" etc. */
      }
      return;
    }

    // Sinon : Player jetable (cas rafale). dispose() automatique a la fin.
    const buf = this.buffers.get(key);
    if (!buf) return;
    const onePlayer = new Tone.Player(buf).toDestination();
    onePlayer.volume.value = (entry.volumeDb ?? 0) + volumeDbOffset;
    onePlayer.onstop = (): void => {
      try {
        onePlayer.dispose();
      } catch {
        /* ignore */
      }
    };
    onePlayer.start();
  }

  /** Demarre une boucle si pas deja active. Volume initial = registry value. */
  startLoop(key: SfxKey, initialVolumeDb?: number): void {
    if (!this.has(key)) return;
    const entry = SFX_REGISTRY[key];
    if (!entry.loop) return;
    let state = this.loops.get(key);
    if (state?.running) return;
    if (!state) {
      const player = this.players.get(key);
      if (!player) return;
      state = {
        player,
        targetVolumeDb: initialVolumeDb ?? entry.volumeDb ?? 0,
        running: false,
      };
      this.loops.set(key, state);
    }
    const target = initialVolumeDb ?? state.targetVolumeDb;
    state.targetVolumeDb = target;
    state.player.volume.value = target;
    try {
      state.player.start();
      state.running = true;
    } catch {
      /* ignore double start */
    }
  }

  /** Ajuste le volume d'une boucle en dB (rampe lisse 0.4s). */
  setLoopVolume(key: SfxKey, volumeDb: number): void {
    const state = this.loops.get(key);
    if (!state || !state.running) return;
    state.targetVolumeDb = volumeDb;
    state.player.volume.rampTo(volumeDb, 0.4);
  }

  /** Stoppe une boucle avec son fadeOut. */
  stopLoop(key: SfxKey): void {
    const state = this.loops.get(key);
    if (!state || !state.running) return;
    try {
      state.player.stop();
    } catch {
      /* ignore */
    }
    state.running = false;
  }

  /** Coupe tous les loops actifs (utile au switch de salle). */
  stopAllLoops(): void {
    for (const key of this.loops.keys()) {
      this.stopLoop(key);
    }
  }

  dispose(): void {
    this.stopAllLoops();
    for (const p of this.players.values()) {
      try {
        p.dispose();
      } catch {
        /* ignore */
      }
    }
    for (const b of this.buffers.values()) {
      try {
        b?.dispose();
      } catch {
        /* ignore */
      }
    }
    this.players.clear();
    this.buffers.clear();
    this.loops.clear();
  }
}
