/**
 * Générateurs de sons procéduraux via Web Audio API + Tone.js.
 * Aucun fichier externe — tout est synthétisé.
 */
import * as Tone from 'tone';

export interface ProceduralSound {
  start(): void;
  stop(): void;
  set?: (param: string, value: number) => void;
  dispose(): void;
}

/* --------- Drone ambiant (hum 60 Hz + harmoniques + filtre lent) ---------- */
export function makeStudioHum(): ProceduralSound {
  const filter = new Tone.Filter(220, 'lowpass').toDestination();
  filter.Q.value = 1.2;
  const gain = new Tone.Gain(0.08).connect(filter);

  const a = new Tone.Oscillator(60, 'sawtooth').connect(gain);
  const b = new Tone.Oscillator(120, 'sine').connect(gain);
  const c = new Tone.Oscillator(180, 'triangle').connect(gain);
  // LFO sur fréquence du filtre pour simuler un éclairage qui respire
  const lfo = new Tone.LFO(0.07, 180, 520).connect(filter.frequency);

  return {
    start() {
      a.start();
      b.start();
      c.start();
      lfo.start();
    },
    stop() {
      a.stop();
      b.stop();
      c.stop();
      lfo.stop();
    },
    set(param, value) {
      if (param === 'volume') gain.gain.rampTo(value, 0.5);
    },
    dispose() {
      a.dispose();
      b.dispose();
      c.dispose();
      lfo.dispose();
      gain.dispose();
      filter.dispose();
    },
  };
}

/* ------------------- Murmure d'audience continu (loopable) ---------------- */
export function makeAudienceMurmur(): ProceduralSound {
  // Bruit rose filtré + tremolo lent → impression de foule au loin
  const noise = new Tone.Noise('pink');
  const filter = new Tone.Filter(700, 'bandpass');
  filter.Q.value = 0.7;
  const trem = new Tone.Tremolo(0.5, 0.6).start();
  const gain = new Tone.Gain(0.04);
  noise.chain(filter, trem, gain, Tone.getDestination());
  return {
    start() {
      noise.start();
    },
    stop() {
      noise.stop();
    },
    set(param, value) {
      if (param === 'volume') gain.gain.rampTo(value, 0.4);
    },
    dispose() {
      noise.dispose();
      filter.dispose();
      trem.dispose();
      gain.dispose();
    },
  };
}

/* ------- Tense bass : drone sub piloté par setLevel(), pour zones warning -- */
export function makeTenseBass(): ProceduralSound & { setLevel(level: number): void } {
  const gain = new Tone.Gain(0).toDestination();
  const filter = new Tone.Filter(80, 'lowpass').connect(gain);
  filter.Q.value = 4;
  // Fondamentale sub-bass + sa quinte légèrement détonée pour battement inquiétant
  const a = new Tone.Oscillator(38, 'sine').connect(filter);
  const b = new Tone.Oscillator(57.2, 'sine').connect(filter);
  // LFO très lent sur le filtre pour donner un "souffle"
  const lfo = new Tone.LFO(0.13, 65, 110).connect(filter.frequency);
  return {
    start() {
      a.start();
      b.start();
      lfo.start();
    },
    stop() {
      a.stop();
      b.stop();
      lfo.stop();
    },
    setLevel(level: number) {
      gain.gain.rampTo(Math.max(0, Math.min(1, level)) * 0.35, 0.25);
    },
    set(param, value) {
      if (param === 'volume') gain.gain.rampTo(value, 0.25);
    },
    dispose() {
      a.dispose();
      b.dispose();
      lfo.dispose();
      filter.dispose();
      gain.dispose();
    },
  };
}

/* -------- Backstage hum : ambiance industrielle (compresseur + ventilo) -- */
export function makeBackstageHum(): ProceduralSound {
  const out = new Tone.Gain(0).toDestination();
  // Couche 1 : compresseur basse fréquence (50 Hz + harmoniques pleines)
  const subFilter = new Tone.Filter(140, 'lowpass').connect(out);
  subFilter.Q.value = 1.6;
  const subA = new Tone.Oscillator(50, 'sawtooth').connect(subFilter);
  const subB = new Tone.Oscillator(100, 'triangle').connect(subFilter);
  // Couche 2 : ventilo (bruit blanc filtré bandpass)
  const fanNoise = new Tone.Noise('white');
  const fanFilter = new Tone.Filter(380, 'bandpass').connect(out);
  fanFilter.Q.value = 1.1;
  fanNoise.connect(fanFilter);
  const fanGain = new Tone.Gain(0.06).connect(fanFilter);
  fanNoise.connect(fanGain);
  // LFO lent sur le filtre sub (effet "machine qui respire")
  const lfo = new Tone.LFO(0.08, 110, 180).connect(subFilter.frequency);
  return {
    start() {
      subA.start();
      subB.start();
      fanNoise.start();
      lfo.start();
      out.gain.rampTo(0.18, 1.5);
    },
    stop() {
      subA.stop();
      subB.stop();
      fanNoise.stop();
      lfo.stop();
      out.gain.rampTo(0, 0.6);
    },
    set(param, value) {
      if (param === 'volume') out.gain.rampTo(value, 0.5);
    },
    dispose() {
      subA.dispose();
      subB.dispose();
      fanNoise.dispose();
      fanFilter.dispose();
      subFilter.dispose();
      fanGain.dispose();
      lfo.dispose();
      out.dispose();
    },
  };
}

/** Crépitement de néon défaillant : noise burst HP + tick métallique. */
export function playFluorescentFlicker(): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;

  // Tick métallique court
  const tick = ctx.createOscillator();
  tick.type = 'square';
  tick.frequency.setValueAtTime(3200, now);
  tick.frequency.exponentialRampToValueAtTime(1800, now + 0.02);
  const tickG = ctx.createGain();
  tickG.gain.setValueAtTime(0.0001, now);
  tickG.gain.exponentialRampToValueAtTime(0.12, now + 0.001);
  tickG.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
  tick.connect(tickG);
  tickG.connect(ctx.destination);
  tick.start(now);
  tick.stop(now + 0.03);

  // Noise burst filtré highpass
  const dur = 0.15 + Math.random() * 0.18;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    // Cluster d'impulsions pour effet "crépitement"
    d[i] = Math.random() < 0.4 ? (Math.random() * 2 - 1) : 0;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1800;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, now + 0.005);
  ng.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  noise.connect(hp);
  hp.connect(ng);
  ng.connect(ctx.destination);
  noise.start(now + 0.005);
  noise.stop(now + dur + 0.05);
}

/** Cassette VHS qui rentre : 3 clacks + whir de moteur. */
export function playVHSInsert(): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;

  // 3 clacks (chaque clack = noise burst court filtré)
  for (let i = 0; i < 3; i++) {
    const t = now + i * 0.12;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * Math.exp(-j / 400);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200 - i * 200;
    bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.value = 0.22 - i * 0.04;
    noise.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.05);
  }

  // Whir moteur (oscillator 90Hz qui se cale)
  const motor = ctx.createOscillator();
  motor.type = 'triangle';
  motor.frequency.setValueAtTime(70, now + 0.4);
  motor.frequency.exponentialRampToValueAtTime(95, now + 0.7);
  const motorG = ctx.createGain();
  motorG.gain.setValueAtTime(0.0001, now + 0.4);
  motorG.gain.exponentialRampToValueAtTime(0.07, now + 0.55);
  motorG.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  motor.connect(motorG);
  motorG.connect(ctx.destination);
  motor.start(now + 0.4);
  motor.stop(now + 1.3);
}

/** Whir VHS qui joue : tape hiss continu (one-shot court, 1.2s). */
export function playVHSPlay(): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  const dur = 1.2;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 4500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.10, now + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  noise.connect(hp);
  hp.connect(g);
  g.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + dur + 0.05);
}

/** Pas saccadé du stalker — impulsion + résonance basse. */
export function playStalkerStep(): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  // Impulsion (sub thud)
  const thud = ctx.createOscillator();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(110, now);
  thud.frequency.exponentialRampToValueAtTime(45, now + 0.18);
  const thudG = ctx.createGain();
  thudG.gain.setValueAtTime(0.0001, now);
  thudG.gain.exponentialRampToValueAtTime(0.30, now + 0.005);
  thudG.gain.exponentialRampToValueAtTime(0.0001, now + 0.20);
  thud.connect(thudG);
  thudG.connect(ctx.destination);
  thud.start(now);
  thud.stop(now + 0.22);
  // Petit clack métallique aigu
  const click = ctx.createOscillator();
  click.type = 'square';
  click.frequency.setValueAtTime(1600, now);
  click.frequency.exponentialRampToValueAtTime(700, now + 0.04);
  const clickG = ctx.createGain();
  clickG.gain.setValueAtTime(0.0001, now);
  clickG.gain.exponentialRampToValueAtTime(0.07, now + 0.002);
  clickG.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  click.connect(clickG);
  clickG.connect(ctx.destination);
  click.start(now);
  click.stop(now + 0.06);
}

/** Démarrage de projecteur de cinéma : clack + whir + tic-tac 15Hz. */
export function playProjectorStart(): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  // Clack lampe
  const lamp = ctx.createOscillator();
  lamp.type = 'square';
  lamp.frequency.setValueAtTime(900, now);
  lamp.frequency.exponentialRampToValueAtTime(280, now + 0.06);
  const lampG = ctx.createGain();
  lampG.gain.setValueAtTime(0.0001, now);
  lampG.gain.exponentialRampToValueAtTime(0.22, now + 0.003);
  lampG.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  lamp.connect(lampG);
  lampG.connect(ctx.destination);
  lamp.start(now);
  lamp.stop(now + 0.1);
  // Whir ventilateur
  const fan = ctx.createOscillator();
  fan.type = 'triangle';
  fan.frequency.setValueAtTime(95, now + 0.1);
  fan.frequency.exponentialRampToValueAtTime(140, now + 1.5);
  const fanG = ctx.createGain();
  fanG.gain.setValueAtTime(0.0001, now + 0.1);
  fanG.gain.exponentialRampToValueAtTime(0.10, now + 0.4);
  fanG.gain.linearRampToValueAtTime(0.06, now + 3.5);
  fan.connect(fanG);
  fanG.connect(ctx.destination);
  fan.start(now + 0.1);
  fan.stop(now + 3.8);
  // Tic-tac pellicule 15 Hz pendant 2.5s
  const tickRate = 15;
  const tickCount = Math.floor(tickRate * 2.5);
  for (let i = 0; i < tickCount; i++) {
    const t = now + 0.3 + i / tickRate;
    const tick = ctx.createOscillator();
    tick.type = 'square';
    tick.frequency.value = 4200;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.exponentialRampToValueAtTime(0.04, t + 0.001);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.010);
    tick.connect(tg);
    tg.connect(ctx.destination);
    tick.start(t);
    tick.stop(t + 0.012);
  }
}

/** Grincement métallique + verrou qui claque (ouverture de porte). */
export function playDoorOpen(): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  // Grincement (oscillator pitchant + filter bandpass)
  const screech = ctx.createOscillator();
  screech.type = 'sawtooth';
  screech.frequency.setValueAtTime(320, now);
  screech.frequency.exponentialRampToValueAtTime(180, now + 0.45);
  const screechFilt = ctx.createBiquadFilter();
  screechFilt.type = 'bandpass';
  screechFilt.frequency.value = 900;
  screechFilt.Q.value = 8;
  const screechG = ctx.createGain();
  screechG.gain.setValueAtTime(0.0001, now);
  screechG.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
  screechG.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  screech.connect(screechFilt);
  screechFilt.connect(screechG);
  screechG.connect(ctx.destination);
  screech.start(now);
  screech.stop(now + 0.6);
  // Verrou qui claque à la fin
  const latch = ctx.createOscillator();
  latch.type = 'square';
  latch.frequency.setValueAtTime(1400, now + 0.55);
  latch.frequency.exponentialRampToValueAtTime(360, now + 0.62);
  const latchG = ctx.createGain();
  latchG.gain.setValueAtTime(0.0001, now + 0.55);
  latchG.gain.exponentialRampToValueAtTime(0.22, now + 0.557);
  latchG.gain.exponentialRampToValueAtTime(0.0001, now + 0.68);
  latch.connect(latchG);
  latchG.connect(ctx.destination);
  latch.start(now + 0.55);
  latch.stop(now + 0.7);
}

/* ----------------- Heartbeat dynamique (BPM piloté par stress) ------------ */
export function makeHeartbeat(): ProceduralSound & { setBpm(bpm: number): void } {
  const gain = new Tone.Gain(0.0).toDestination();
  const osc = new Tone.Oscillator(60, 'sine').start();
  const env = new Tone.AmplitudeEnvelope({ attack: 0.005, decay: 0.18, sustain: 0, release: 0.05 });
  osc.connect(env);
  env.connect(gain);

  let running = false;
  let bpm = 65;
  let timer = 0;
  let tick: number | null = null;

  const beat = () => {
    if (!running) return;
    env.triggerAttackRelease(0.18);
    setTimeout(() => env.triggerAttackRelease(0.16), (60 / bpm) * 1000 * 0.32);
  };

  const loop = () => {
    beat();
    tick = window.setTimeout(loop, (60 / bpm) * 1000);
  };

  return {
    start() {
      running = true;
      gain.gain.rampTo(0.5, 0.5);
      loop();
    },
    stop() {
      running = false;
      gain.gain.rampTo(0.0, 0.3);
      if (tick !== null) clearTimeout(tick);
    },
    setBpm(newBpm: number) {
      bpm = Math.max(45, Math.min(160, newBpm));
    },
    set(param, value) {
      if (param === 'volume') gain.gain.rampTo(value, 0.3);
    },
    dispose() {
      osc.dispose();
      env.dispose();
      gain.dispose();
      if (tick !== null) clearTimeout(tick);
    },
  };
}

/* -------------------- One-shots : laugh track, sting, etc. ---------------- */

/** Burst d'applaudissements / rire enregistré. `glitch` 0..1 = degré de dérangement. */
export function playLaughTrack(glitch = 0): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const dur = 1.4 + Math.random() * 0.6;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Petites impulsions de bruit (claps) à intervalles irréguliers
  let t = 0;
  while (t < data.length) {
    const burst = 50 + Math.floor(Math.random() * 120);
    for (let i = 0; i < burst && t < data.length; i++, t++) {
      const env = Math.exp(-i / 40);
      data[t] = (Math.random() * 2 - 1) * env * (0.6 + Math.random() * 0.4);
    }
    t += Math.floor(80 + Math.random() * 250);
  }
  // Ajout d'une porteuse "voyelle" pour simuler des voix
  for (let i = 0; i < data.length; i++) {
    const v = Math.sin((i / ctx.sampleRate) * 2 * Math.PI * 380) * 0.05;
    data[i] += v * (0.5 + 0.5 * Math.sin(i / 800));
  }
  // Glitch : on hache des segments aléatoires
  if (glitch > 0) {
    const slices = Math.floor(2 + glitch * 12);
    for (let s = 0; s < slices; s++) {
      const start = Math.floor(Math.random() * (data.length - 800));
      const len = Math.floor(80 + Math.random() * 400);
      for (let i = 0; i < len; i++) {
        data[start + i] = data[start + (i % 16)] * (1 - glitch * 0.5);
      }
    }
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.value = 0.35;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200 - glitch * 800;
  filter.Q.value = 0.9 + glitch * 2;
  src.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  src.start();
  src.stop(ctx.currentTime + dur);
}

/** Sting glitch : impact sub-bass + bruit filtré. `intensity` 0..1. */
export function playGlitchSting(intensity = 1): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;

  // Sub
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(80, now);
  sub.frequency.exponentialRampToValueAtTime(35, now + 0.6);
  const subG = ctx.createGain();
  subG.gain.setValueAtTime(0.0001, now);
  subG.gain.exponentialRampToValueAtTime(0.4 * intensity, now + 0.02);
  subG.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
  sub.connect(subG);
  subG.connect(ctx.destination);
  sub.start(now);
  sub.stop(now + 0.9);

  // Bruit filtré
  const bufferSize = Math.floor(ctx.sampleRate * 0.5);
  const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) nd[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.setValueAtTime(2000, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(400, now + 0.3);
  const noiseG = ctx.createGain();
  noiseG.gain.setValueAtTime(0.0001, now);
  noiseG.gain.exponentialRampToValueAtTime(0.2 * intensity, now + 0.005);
  noiseG.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseG);
  noiseG.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.4);
}

/** Bip d'allumage de spot (clack + buzz court). */
export function playSpotIgnition(): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;

  // Clack métallique
  const click = ctx.createOscillator();
  click.type = 'square';
  click.frequency.setValueAtTime(2400, now);
  click.frequency.exponentialRampToValueAtTime(700, now + 0.04);
  const clickG = ctx.createGain();
  clickG.gain.setValueAtTime(0.0001, now);
  clickG.gain.exponentialRampToValueAtTime(0.18, now + 0.002);
  clickG.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  click.connect(clickG);
  clickG.connect(ctx.destination);
  click.start(now);
  click.stop(now + 0.06);

  // Buzz qui monte
  const buzz = ctx.createOscillator();
  buzz.type = 'sawtooth';
  buzz.frequency.setValueAtTime(80, now + 0.04);
  buzz.frequency.exponentialRampToValueAtTime(120, now + 0.6);
  const buzzG = ctx.createGain();
  buzzG.gain.setValueAtTime(0.0001, now + 0.04);
  buzzG.gain.exponentialRampToValueAtTime(0.08, now + 0.15);
  buzzG.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
  const buzzFilt = ctx.createBiquadFilter();
  buzzFilt.type = 'lowpass';
  buzzFilt.frequency.value = 600;
  buzz.connect(buzzFilt);
  buzzFilt.connect(buzzG);
  buzzG.connect(ctx.destination);
  buzz.start(now + 0.04);
  buzz.stop(now + 0.8);
}

/** "Voix" FM dérangée de M. Sourire — pas de TTS, juste une porteuse pitched. */
export function playHostUtterance(syllables = 6, intensity = 1): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  let t = ctx.currentTime;
  for (let i = 0; i < syllables; i++) {
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const ampG = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 4;
    const baseF = 110 + Math.random() * 80;
    carrier.frequency.value = baseF;
    mod.frequency.value = baseF * (1.4 + Math.random() * 1.5);
    modGain.gain.value = 80 + Math.random() * 200 * intensity;
    filter.frequency.value = 800 + Math.random() * 1200;
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(filter);
    filter.connect(ampG);
    ampG.connect(ctx.destination);
    const dur = 0.08 + Math.random() * 0.16;
    ampG.gain.setValueAtTime(0.0001, t);
    ampG.gain.exponentialRampToValueAtTime(0.12 * intensity, t + 0.01);
    ampG.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    carrier.start(t);
    mod.start(t);
    carrier.stop(t + dur + 0.05);
    mod.stop(t + dur + 0.05);
    t += dur + 0.03 + Math.random() * 0.05;
  }
}

/** Petit jingle de réussite ("on aime ça !") — accord majeur trop sucré. */
export function playApplauseSting(): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99]; // Do Mi Sol
  notes.forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now + i * 0.04);
    g.gain.exponentialRampToValueAtTime(0.12, now + i * 0.04 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now + i * 0.04);
    osc.stop(now + 0.55);
  });
  // Petit bruit de paillettes
  playLaughTrack(0);
}

/**
 * SCREAMER IMPACT — gros bruit d'arrivée du présentateur.
 * Mix de 4 couches : sub-bass massif, noise burst, crash métallique aigu,
 * rugissement sawtooth qui descend. ~0.9s, attaque immédiate.
 */
export function playScreamerImpact(intensity = 1): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  const I = Math.max(0, Math.min(1.5, intensity));

  // ---- Layer 1 : SUB-BASS MASSIF (impact dans la poitrine) ----
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(60, now);
  sub.frequency.exponentialRampToValueAtTime(28, now + 0.6);
  const subG = ctx.createGain();
  subG.gain.setValueAtTime(0.0001, now);
  subG.gain.exponentialRampToValueAtTime(0.85 * I, now + 0.01);
  subG.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
  sub.connect(subG);
  subG.connect(ctx.destination);
  sub.start(now);
  sub.stop(now + 0.9);

  // Sub second layer pour battement (43 Hz)
  const sub2 = ctx.createOscillator();
  sub2.type = 'sine';
  sub2.frequency.setValueAtTime(85, now);
  sub2.frequency.exponentialRampToValueAtTime(43, now + 0.5);
  const sub2G = ctx.createGain();
  sub2G.gain.setValueAtTime(0.0001, now);
  sub2G.gain.exponentialRampToValueAtTime(0.55 * I, now + 0.015);
  sub2G.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
  sub2.connect(sub2G);
  sub2G.connect(ctx.destination);
  sub2.start(now);
  sub2.stop(now + 0.75);

  // ---- Layer 2 : NOISE BURST (souffle qui balaye) ----
  const noiseDur = 0.6;
  const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * noiseDur), ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const noiseFilt = ctx.createBiquadFilter();
  noiseFilt.type = 'bandpass';
  // Le filtre balaye de l'aigu vers le grave (effet "whoosh inversé")
  noiseFilt.frequency.setValueAtTime(180, now);
  noiseFilt.frequency.exponentialRampToValueAtTime(4500, now + 0.05);
  noiseFilt.frequency.exponentialRampToValueAtTime(250, now + 0.55);
  noiseFilt.Q.value = 2.5;
  const noiseG = ctx.createGain();
  noiseG.gain.setValueAtTime(0.0001, now);
  noiseG.gain.exponentialRampToValueAtTime(0.45 * I, now + 0.025);
  noiseG.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  noise.connect(noiseFilt);
  noiseFilt.connect(noiseG);
  noiseG.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + noiseDur);

  // ---- Layer 3 : CRASH MÉTALLIQUE (cluster harmonique dissonant) ----
  const crashFreqs = [1320, 1735, 2110, 2580];
  for (let i = 0; i < crashFreqs.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(crashFreqs[i], now);
    osc.frequency.exponentialRampToValueAtTime(crashFreqs[i] * 0.45, now + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.10 * I, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 800;
    osc.connect(hp);
    hp.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  // ---- Layer 4 : RUGISSEMENT (sawtooth qui descend de 700 à 60 Hz) ----
  const roar = ctx.createOscillator();
  roar.type = 'sawtooth';
  roar.frequency.setValueAtTime(720, now);
  roar.frequency.exponentialRampToValueAtTime(60, now + 0.5);
  const roarFilt = ctx.createBiquadFilter();
  roarFilt.type = 'lowpass';
  roarFilt.frequency.setValueAtTime(2200, now);
  roarFilt.frequency.exponentialRampToValueAtTime(400, now + 0.4);
  roarFilt.Q.value = 6;
  // Waveshaper pour distorsion
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 128) - 1;
    curve[i] = Math.tanh(x * 4.5);
  }
  shaper.curve = curve;
  const roarG = ctx.createGain();
  roarG.gain.setValueAtTime(0.0001, now);
  roarG.gain.exponentialRampToValueAtTime(0.32 * I, now + 0.02);
  roarG.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  roar.connect(shaper);
  shaper.connect(roarFilt);
  roarFilt.connect(roarG);
  roarG.connect(ctx.destination);
  roar.start(now);
  roar.stop(now + 0.6);
}

/** Coup de tonnerre intérieur — pour le climax salle 1. */
export function playPowerCut(): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  // Bzzt + sub drop
  const noise = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 12000);
  noise.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(8000, now);
  filt.frequency.exponentialRampToValueAtTime(200, now + 0.5);
  const g = ctx.createGain();
  g.gain.value = 0.5;
  noise.connect(filt);
  filt.connect(g);
  g.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.6);

  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(120, now);
  sub.frequency.exponentialRampToValueAtTime(25, now + 1.0);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, now);
  sg.gain.exponentialRampToValueAtTime(0.55, now + 0.05);
  sg.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  sub.connect(sg);
  sg.connect(ctx.destination);
  sub.start(now);
  sub.stop(now + 1.3);
}

/* ===================== Chapitre 3 — Le Plateau ===================== */

/**
 * applauseSwell : applaudissements qui montent puis redescendent.
 * `intensity` 0..1 contrôle l'amplitude et la durée. Combinaison de bruit
 * blanc filtré + impulses pour les claps.
 */
export function playApplauseSwell(intensity = 1): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  const I = Math.max(0.1, Math.min(1.5, intensity));
  const dur = 1.8 + I * 1.6;

  // Couche 1 : bruit blanc filtré (foule lointaine)
  const len = Math.floor(ctx.sampleRate * dur);
  const noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = Math.sin((i / len) * Math.PI); // sinus sur la durée
    nd[i] = (Math.random() * 2 - 1) * env * 0.55;
  }
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuf;
  const noiseFilt = ctx.createBiquadFilter();
  noiseFilt.type = 'bandpass';
  noiseFilt.frequency.value = 1800;
  noiseFilt.Q.value = 0.6;
  const noiseG = ctx.createGain();
  noiseG.gain.value = 0.18 * I;
  noiseSrc.connect(noiseFilt);
  noiseFilt.connect(noiseG);
  noiseG.connect(ctx.destination);
  noiseSrc.start(now);
  noiseSrc.stop(now + dur);

  // Couche 2 : impulses de "claps" (bursts de bruit courts)
  const clapCount = Math.floor(16 + I * 28);
  for (let i = 0; i < clapCount; i++) {
    const t0 = now + Math.random() * (dur - 0.1);
    const clapBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
    const cd = clapBuf.getChannelData(0);
    for (let j = 0; j < cd.length; j++) {
      cd[j] = (Math.random() * 2 - 1) * Math.exp(-j / 220);
    }
    const clap = ctx.createBufferSource();
    clap.buffer = clapBuf;
    const clapHp = ctx.createBiquadFilter();
    clapHp.type = 'highpass';
    clapHp.frequency.value = 1200;
    const cg = ctx.createGain();
    const envCurve = Math.sin(((t0 - now) / dur) * Math.PI);
    cg.gain.value = 0.10 * I * envCurve;
    clap.connect(clapHp);
    clapHp.connect(cg);
    cg.connect(ctx.destination);
    clap.start(t0);
    clap.stop(t0 + 0.06);
  }
}

/**
 * childGiggle : petit rire d'enfant "pas tout à fait juste". Couche d'oscilla-
 * teurs avec pitch instable et un brin de distorsion.
 */
export function playChildGiggle(): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  // 4-6 syllabes courtes à hauteur instable
  const sylCount = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < sylCount; i++) {
    const t0 = now + i * 0.13 + Math.random() * 0.02;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const baseFreq = 480 + Math.random() * 180;
    osc.frequency.setValueAtTime(baseFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * (0.7 + Math.random() * 0.4), t0 + 0.08);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.10);
    // Distorsion légère
    const shape = ctx.createWaveShaper();
    const c = new Float32Array(256);
    for (let k = 0; k < 256; k++) {
      const x = (k / 128) - 1;
      c[k] = Math.tanh(x * 2.5);
    }
    shape.curve = c;
    osc.connect(shape);
    shape.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.12);
  }
}

/**
 * childWhisper : souffle filtré, voix murmurante. Bruit blanc passé dans
 * un filtre passe-bas modulé.
 */
export function playChildWhisper(): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  const dur = 1.4 + Math.random() * 0.6;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    d[i] = (Math.random() * 2 - 1);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1400, now);
  lp.frequency.linearRampToValueAtTime(2400, now + dur * 0.5);
  lp.frequency.linearRampToValueAtTime(800, now + dur);
  lp.Q.value = 2.5;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 400;
  // Tremolo lent (souffle "respirant")
  const tremG = ctx.createGain();
  const tremLfo = ctx.createOscillator();
  tremLfo.frequency.value = 4;
  const tremLfoG = ctx.createGain();
  tremLfoG.gain.value = 0.08;
  tremLfo.connect(tremLfoG);
  tremLfoG.connect(tremG.gain);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.10, now + 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  tremG.gain.value = 1;
  src.connect(hp);
  hp.connect(lp);
  lp.connect(tremG);
  tremG.connect(g);
  g.connect(ctx.destination);
  src.start(now);
  src.stop(now + dur);
  tremLfo.start(now);
  tremLfo.stop(now + dur);
}

/**
 * cuecardDescend : grincement de treuil + petit clack métallique.
 * Combinaison d'un sawtooth qui descend en fréquence et d'un noise burst.
 */
export function playCuecardDescend(): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  // Grincement (osc qui module en pitch)
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 1.0);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 7;
  // LFO de wobble
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 9;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 40;
  lfo.connect(lfoG);
  lfoG.connect(osc.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.10, now + 0.08);
  g.gain.linearRampToValueAtTime(0.08, now + 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  osc.connect(bp);
  bp.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 1.2);
  lfo.start(now);
  lfo.stop(now + 1.2);
  // Petit clack final
  setTimeout(() => {
    const c = ctx.currentTime;
    const noise = ctx.createBufferSource();
    const nbuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
    const nd = nbuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) {
      nd[i] = (Math.random() * 2 - 1) * Math.exp(-i / 180);
    }
    noise.buffer = nbuf;
    const hp2 = ctx.createBiquadFilter();
    hp2.type = 'highpass';
    hp2.frequency.value = 2000;
    const ng = ctx.createGain();
    ng.gain.value = 0.18;
    noise.connect(hp2);
    hp2.connect(ng);
    ng.connect(ctx.destination);
    noise.start(c);
    noise.stop(c + 0.08);
  }, 1100);
}

/** dial-tone bref qui annonce une cue card */
export function playShowCueDing(): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  const notes = [880, 1320];
  notes.forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now + i * 0.10);
    g.gain.exponentialRampToValueAtTime(0.15, now + i * 0.10 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.10 + 0.45);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now + i * 0.10);
    osc.stop(now + i * 0.10 + 0.50);
  });
}

/**
 * audienceGasp — soupir collectif court de l'audience (entre 2 cues).
 */
export function playAudienceGasp(): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 0.7);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = Math.sin((i / len) * Math.PI);
    d[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(800, now);
  bp.frequency.linearRampToValueAtTime(400, now + 0.7);
  bp.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.value = 0.22;
  src.connect(bp);
  bp.connect(g);
  g.connect(ctx.destination);
  src.start(now);
  src.stop(now + 0.7);
}

/**
 * audienceScream — l'audience hurle (utilisé en pression sur le joueur dans
 * la phase F si le joueur ne crie pas).
 */
export function playAudienceScream(intensity = 1): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  const I = Math.max(0.1, Math.min(1.5, intensity));
  const dur = 1.6;
  const len = Math.floor(ctx.sampleRate * dur);
  // Couche bruit blanc filtré comme un cri de foule
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = Math.exp(-Math.pow((i / len) - 0.3, 2) * 8);
    d[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1400;
  bp.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.value = 0.32 * I;
  src.connect(bp);
  bp.connect(g);
  g.connect(ctx.destination);
  src.start(now);
  src.stop(now + dur);
  // Couche voix d'enfants (osc sawtooth modulé) par-dessus
  for (let i = 0; i < 5; i++) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const base = 500 + Math.random() * 400;
    o.frequency.setValueAtTime(base, now);
    o.frequency.linearRampToValueAtTime(base * 1.5, now + 0.4);
    o.frequency.linearRampToValueAtTime(base * 0.7, now + dur);
    const shp = ctx.createWaveShaper();
    const c = new Float32Array(256);
    for (let k = 0; k < 256; k++) {
      const x = (k / 128) - 1;
      c[k] = Math.tanh(x * 3.2);
    }
    shp.curve = c;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, now);
    og.gain.exponentialRampToValueAtTime(0.08 * I, now + 0.2);
    og.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(shp);
    shp.connect(og);
    og.connect(ctx.destination);
    o.start(now);
    o.stop(now + dur);
  }
}

/**
 * Jingle de generique TV — 3.5s.
 *
 * Accord majeur 7e jazzy (C-E-G-Bb-D) avec Rhodes-like sine + bass sawtooth
 * lowpass + petite cymbale. Termine sur un sting metalique aigu. Ambiance
 * "L'Emission de Minuit, votre show TV preferé".
 */
export function playTvIntroJingle(): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;

  // Notes de l'accord (Cmaj7add9)
  const notes = [
    { f: 130.81, type: 'sawtooth' as OscillatorType, gain: 0.18 }, // C3 bass
    { f: 261.63, type: 'sine' as OscillatorType,     gain: 0.22 }, // C4 root
    { f: 329.63, type: 'sine' as OscillatorType,     gain: 0.16 }, // E4
    { f: 392.00, type: 'sine' as OscillatorType,     gain: 0.16 }, // G4
    { f: 466.16, type: 'sine' as OscillatorType,     gain: 0.12 }, // Bb4
    { f: 587.33, type: 'sine' as OscillatorType,     gain: 0.10 }, // D5 (add9)
  ];
  for (const n of notes) {
    const o = ctx.createOscillator();
    o.type = n.type;
    o.frequency.value = n.f;
    // Filtre lowpass pour le bass
    let outNode: AudioNode = o;
    if (n.type === 'sawtooth') {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 400;
      lp.Q.value = 0.7;
      o.connect(lp);
      outNode = lp;
    }
    // Petite vibrato tres lente (Rhodes-feel)
    if (n.type === 'sine') {
      const vibLfo = ctx.createOscillator();
      vibLfo.type = 'sine';
      vibLfo.frequency.value = 4.5;
      const vibGain = ctx.createGain();
      vibGain.gain.value = 2.5;
      vibLfo.connect(vibGain);
      vibGain.connect(o.frequency);
      vibLfo.start(now);
      vibLfo.stop(now + 3.6);
    }
    const g = ctx.createGain();
    // Enveloppe ADSR cosy
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(n.gain, now + 0.12);
    g.gain.setValueAtTime(n.gain, now + 2.6);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);
    outNode.connect(g);
    g.connect(ctx.destination);
    o.start(now);
    o.stop(now + 3.6);
  }

  // Petit arpege descendant pour la fin (sting metallique)
  const stingNotes = [1046.50, 783.99, 587.33, 392.00];
  for (let i = 0; i < stingNotes.length; i++) {
    const tStart = now + 2.9 + i * 0.08;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = stingNotes[i];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, tStart);
    g.gain.exponentialRampToValueAtTime(0.18, tStart + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, tStart + 0.35);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(tStart);
    o.stop(tStart + 0.4);
  }

  // Cymbale brushed sur le dernier sting (white noise + HP)
  const cymTs = now + 3.15;
  const cymBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.45), ctx.sampleRate);
  const cd = cymBuf.getChannelData(0);
  for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1);
  const cymSrc = ctx.createBufferSource();
  cymSrc.buffer = cymBuf;
  const cymHp = ctx.createBiquadFilter();
  cymHp.type = 'highpass';
  cymHp.frequency.value = 7500;
  cymHp.Q.value = 0.5;
  const cymG = ctx.createGain();
  cymG.gain.setValueAtTime(0.0001, cymTs);
  cymG.gain.exponentialRampToValueAtTime(0.14, cymTs + 0.01);
  cymG.gain.exponentialRampToValueAtTime(0.0001, cymTs + 0.42);
  cymSrc.connect(cymHp);
  cymHp.connect(cymG);
  cymG.connect(ctx.destination);
  cymSrc.start(cymTs);
  cymSrc.stop(cymTs + 0.45);
}

/**
 * Beep pro de countdown TV (3... 2... 1...). 120ms, sine 880Hz + harmonique
 * 1760Hz, decay rapide.
 */
export function playCountdownBeep(): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  for (const f of [880, 1760]) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(f === 880 ? 0.28 : 0.10, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.13);
  }
}

/**
 * Cri strident du climax Ch3 — 1.2s, syncrhonisé avec le screamer fullscreen.
 *
 * Layers :
 *  - A : white noise highpass 800Hz, distortion, rampe 0 -> max en 80ms
 *  - B : cluster harmoniques dissonants (440, 466, 622, 740 Hz) modulés
 *  - C : sweep descendant rugissement
 *  - D : voix d'enfant déformée (saw 700Hz -> 250Hz)
 */
export function playClimaxScream(intensity = 1): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  const I = Math.max(0.1, Math.min(1.5, intensity));
  const dur = 1.2;

  // ---- Layer A : noise burst stridant ----
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i * 0.013));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(800, now);
  hp.frequency.linearRampToValueAtTime(2000, now + 0.5);
  hp.Q.value = 1.2;
  // Distortion
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 128) - 1;
    curve[i] = Math.tanh(x * 5);
  }
  shaper.curve = curve;
  const noiseG = ctx.createGain();
  noiseG.gain.setValueAtTime(0.0001, now);
  noiseG.gain.exponentialRampToValueAtTime(0.55 * I, now + 0.08);
  noiseG.gain.setValueAtTime(0.55 * I, now + 0.7);
  noiseG.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  noise.connect(hp);
  hp.connect(shaper);
  shaper.connect(noiseG);
  noiseG.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + dur);

  // ---- Layer B : cluster harmoniques dissonants ----
  const clusterFreqs = [440, 466, 622, 740, 880];
  for (const f0 of clusterFreqs) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, now);
    // Modulation FM rapide
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 8 + Math.random() * 6;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 18;
    lfo.connect(lfoG);
    lfoG.connect(o.frequency);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, now);
    og.gain.exponentialRampToValueAtTime(0.08 * I, now + 0.12);
    og.gain.setValueAtTime(0.08 * I, now + 0.7);
    og.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(og);
    og.connect(ctx.destination);
    o.start(now);
    lfo.start(now);
    o.stop(now + dur);
    lfo.stop(now + dur);
  }

  // ---- Layer C : sweep descendant rugissement ----
  const roar = ctx.createOscillator();
  roar.type = 'sawtooth';
  roar.frequency.setValueAtTime(950, now);
  roar.frequency.exponentialRampToValueAtTime(110, now + 0.9);
  const roarFilt = ctx.createBiquadFilter();
  roarFilt.type = 'lowpass';
  roarFilt.frequency.setValueAtTime(3200, now);
  roarFilt.frequency.exponentialRampToValueAtTime(500, now + 0.8);
  roarFilt.Q.value = 5;
  const roarG = ctx.createGain();
  roarG.gain.setValueAtTime(0.0001, now);
  roarG.gain.exponentialRampToValueAtTime(0.28 * I, now + 0.05);
  roarG.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  roar.connect(roarFilt);
  roarFilt.connect(roarG);
  roarG.connect(ctx.destination);
  roar.start(now);
  roar.stop(now + dur);

  // ---- Layer D : voix enfant déformée ----
  const child = ctx.createOscillator();
  child.type = 'sawtooth';
  child.frequency.setValueAtTime(700, now);
  child.frequency.linearRampToValueAtTime(450, now + 0.3);
  child.frequency.linearRampToValueAtTime(250, now + dur);
  const childShape = ctx.createWaveShaper();
  const cCurve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 128) - 1;
    cCurve[i] = Math.tanh(x * 3.5);
  }
  childShape.curve = cCurve;
  const childG = ctx.createGain();
  childG.gain.setValueAtTime(0.0001, now);
  childG.gain.exponentialRampToValueAtTime(0.18 * I, now + 0.15);
  childG.gain.setValueAtTime(0.18 * I, now + 0.6);
  childG.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  child.connect(childShape);
  childShape.connect(childG);
  childG.connect(ctx.destination);
  child.start(now);
  child.stop(now + dur);

  // ---- Sub impact a t=0 pour caler avec le visage ----
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(70, now);
  sub.frequency.exponentialRampToValueAtTime(30, now + 0.8);
  const subG = ctx.createGain();
  subG.gain.setValueAtTime(0.0001, now);
  subG.gain.exponentialRampToValueAtTime(0.65 * I, now + 0.015);
  subG.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
  sub.connect(subG);
  subG.connect(ctx.destination);
  sub.start(now);
  sub.stop(now + 1.05);
}

/**
 * Drone d'ambiance studio TV — sub-bass 55Hz + noise pink lowpass 200Hz +
 * LFO lent pour un "soulevement de salle" inquietant. Volume controlable
 * via setLevel(0..1).
 *
 * Utilise pendant tout le Ch3 :
 *  - intro 0.05  (presque inaudible, semer la tension)
 *  - duel  0.15  (palpable)
 *  - climax 0.35 (massif)
 *  - screamer : stop() — silence brutal apres pour amplifier le screamer
 */
export function makeStudioDrone(): ProceduralSound & { setLevel(level: number): void } {
  const masterGain = new Tone.Gain(0).toDestination();

  // Couche 1 : sub-bass 55Hz sinus pur (le souffle de la salle).
  const subOsc = new Tone.Oscillator(55, 'sine');
  const subGain = new Tone.Gain(0.6).connect(masterGain);
  subOsc.connect(subGain);

  // Couche 2 : deuxieme fondamentale tres legerement detonee (battement lent).
  const sub2 = new Tone.Oscillator(55.3, 'sine');
  const sub2Gain = new Tone.Gain(0.4).connect(masterGain);
  sub2.connect(sub2Gain);

  // Couche 3 : noise pink lowpass 200Hz pour masse + grain.
  const noise = new Tone.Noise('pink');
  const noiseFilter = new Tone.Filter(200, 'lowpass');
  noiseFilter.Q.value = 1.2;
  const noiseGain = new Tone.Gain(0.25).connect(masterGain);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);

  // LFO 0.08Hz sur le filter freq du noise — souffle de salle vivante.
  const lfo = new Tone.LFO(0.08, 140, 280).connect(noiseFilter.frequency);

  return {
    start(): void {
      subOsc.start();
      sub2.start();
      noise.start();
      lfo.start();
    },
    stop(): void {
      masterGain.gain.rampTo(0, 0.4);
      // On laisse 0.5s avant de stopper les oscillateurs pour le fade-out
      setTimeout(() => {
        try {
          subOsc.stop();
          sub2.stop();
          noise.stop();
          lfo.stop();
        } catch {
          /* ignore stop errors si deja arrete */
        }
      }, 500);
    },
    setLevel(level: number): void {
      // Clamp + courbe douce
      const v = Math.max(0, Math.min(1, level));
      masterGain.gain.rampTo(v * 0.55, 0.6);
    },
    set(param, value): void {
      if (param === 'volume') masterGain.gain.rampTo(value, 0.6);
    },
    dispose(): void {
      subOsc.dispose();
      sub2.dispose();
      noise.dispose();
      noiseFilter.dispose();
      lfo.dispose();
      subGain.dispose();
      sub2Gain.dispose();
      noiseGain.dispose();
      masterGain.dispose();
    },
  };
}

