import * as THREE from 'three';

export class AudioSystem {
  private context?: AudioContext;
  private master?: GainNode;
  private readonly sfxCache = new Map<string, HTMLAudioElement>();
  private started = false;

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    this.context = new AudioContextClass();
    this.master = this.context.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.context.destination);
    this.started = true;

    this.startRoomTone();
    this.startAirNoise();
    this.playLoop('ambience_store_low_drone.mp3', 0.18);
    this.playLoop('ambience_showroom_hum.mp3', 0.16);
    this.playLoop('ambience_neon_buzz_loop.mp3', 0.12);
    this.playLoop('ambience_outside_night_street.mp3', 0.08);
  }

  updateListener(camera: THREE.Camera): void {
    if (!this.context) {
      return;
    }

    const listener = this.context.listener;
    const position = new THREE.Vector3();
    const forward = new THREE.Vector3();
    camera.getWorldPosition(position);
    camera.getWorldDirection(forward);

    listener.positionX.value = position.x;
    listener.positionY.value = position.y;
    listener.positionZ.value = position.z;
    listener.forwardX.value = forward.x;
    listener.forwardY.value = forward.y;
    listener.forwardZ.value = forward.z;
    listener.upX.value = 0;
    listener.upY.value = 1;
    listener.upZ.value = 0;
  }

  playKnock(position: THREE.Vector3): void {
    if (this.playSfx('distant_knock.mp3', 0.7)) {
      return;
    }

    this.playHit(position, 86, 0.8);
    window.setTimeout(() => this.playHit(position, 52, 0.42), 180);
  }

  playBehindWhisper(camera: THREE.Camera): void {
    if (!this.context || !this.master) {
      return;
    }

    if (this.playSfx('mannequin_whisper.mp3', 0.85)) {
      return;
    }

    const behind = new THREE.Vector3();
    camera.getWorldDirection(behind);
    behind.multiplyScalar(-1.8).add(camera.position);
    this.playFilteredNoise(behind, 0.95, 1.2);
  }

  playLampClick(position: THREE.Vector3): void {
    if (this.playSfx('flashlight_click.mp3', 0.55)) {
      return;
    }

    this.playHit(position, 420, 0.12);
  }

  playDoorRattle(position: THREE.Vector3): void {
    if (this.playSfx('door_locked_rattle.mp3', 0.75)) {
      return;
    }

    this.playHit(position, 140, 0.22);
    window.setTimeout(() => this.playHit(position, 110, 0.18), 75);
    window.setTimeout(() => this.playHit(position, 70, 0.28), 250);
  }

  playRegisterBeep(position: THREE.Vector3): void {
    if (this.playSfx('cash_register_beep.mp3', 0.75)) {
      return;
    }

    this.playHit(position, 920, 0.16);
    window.setTimeout(() => this.playHit(position, 1380, 0.09), 95);
  }

  playScannerBeep(position: THREE.Vector3): void {
    if (this.playSfx('scanner_beep.mp3', 0.75)) {
      return;
    }

    this.playRegisterBeep(position);
  }

  playReceiptPrint(position: THREE.Vector3): void {
    if (this.playSfx('receipt_print.mp3', 0.7)) {
      return;
    }

    this.playRegisterBeep(position);
  }

  playPriceTagChange(position: THREE.Vector3): void {
    if (this.playSfx('price_tag_change.mp3', 0.7)) {
      return;
    }

    this.playRegisterBeep(position);
  }

  playNeonCrack(position: THREE.Vector3): void {
    if (this.playSfx('neon_flicker.mp3', 0.8)) {
      return;
    }

    this.playHit(position, 1800, 0.16);
    window.setTimeout(() => this.playFilteredNoise(position, 0.95, 0.22), 45);
  }

  playClosetThump(position: THREE.Vector3): void {
    if (this.playSfx('wardrobe_thump.mp3', 0.85)) {
      return;
    }

    this.playHit(position, 62, 0.74);
    window.setTimeout(() => this.playHit(position, 48, 0.4), 110);
  }

  playElectricBuzz(position: THREE.Vector3): void {
    if (this.playSfx('reality_warp.mp3', 0.65)) {
      return;
    }

    this.playHit(position, 240, 0.24);
    window.setTimeout(() => this.playFilteredNoise(position, 0.75, 0.45), 35);
  }

  playPaperRustle(position: THREE.Vector3): void {
    if (this.playSfx('paper_rustle.mp3', 0.65)) {
      return;
    }

    this.playRegisterBeep(position);
  }

  playMannequinMove(position: THREE.Vector3): void {
    if (this.playSfx('mannequin_move.mp3', 0.75)) {
      return;
    }

    this.playClosetThump(position);
  }

  playHallucinationAppear(position: THREE.Vector3): void {
    if (this.playSfx('hallucination_appear.mp3', 0.8)) {
      return;
    }

    this.playNeonCrack(position);
  }

  playHallucinationDisappear(position: THREE.Vector3): void {
    if (this.playSfx('hallucination_disappear.mp3', 0.7)) {
      return;
    }

    this.playNeonCrack(position);
  }

  playBloodDrip(position: THREE.Vector3): void {
    if (this.playSfx('blood_drip.mp3', 0.45)) {
      return;
    }

    this.playHit(position, 310, 0.08);
  }

  playSmallScreamer(position: THREE.Vector3): void {
    if (this.playSfx('small_screamer_cash_register.mp3', 0.95)) {
      return;
    }

    this.playHit(position, 1250, 0.46);
    window.setTimeout(() => this.playHit(position, 540, 0.35), 80);
    window.setTimeout(() => this.playFilteredNoise(position, 1.25, 0.34), 20);
  }

  playFinalScreamer(position: THREE.Vector3): void {
    if (this.playSfx('final_screamer_impact.mp3', 0.95)) {
      window.setTimeout(() => this.playSfx('final_screamer_saturated_roar.mp3', 1), 80);
      return;
    }

    this.playHit(position, 55, 1.15);
    window.setTimeout(() => this.playHit(position, 960, 0.82), 65);
    window.setTimeout(() => this.playFilteredNoise(position, 2.4, 1.1), 40);
    window.setTimeout(() => this.playHit(position, 38, 0.95), 330);
  }

  playFullScreenScreamer(position: THREE.Vector3): void {
    if (this.playSfx('final_screamer_rise.mp3', 0.9)) {
      window.setTimeout(() => this.playSfx('final_screamer_impact.mp3', 1), 450);
      window.setTimeout(() => this.playSfx('final_screamer_saturated_roar.mp3', 1), 650);
      return;
    }

    this.playFinalScreamer(position);
    window.setTimeout(() => this.playHit(position, 1600, 1.2), 45);
    window.setTimeout(() => this.playHit(position, 75, 1.45), 120);
    window.setTimeout(() => this.playFilteredNoise(position, 3.4, 1.35), 20);
  }

  private startRoomTone(): void {
    if (!this.context || !this.master) {
      return;
    }

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.value = 46;
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    gain.gain.value = 0.045;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
  }

  private startAirNoise(): void {
    if (!this.context || !this.master) {
      return;
    }

    const buffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.35;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    source.buffer = buffer;
    source.loop = true;
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.8;
    gain.gain.value = 0.025;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  private playHit(position: THREE.Vector3, frequency: number, volume: number): void {
    if (!this.context || !this.master) {
      return;
    }

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.createPanner(position);
    const now = this.context.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * 0.35), now + 0.22);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  private playFilteredNoise(position: THREE.Vector3, volume: number, duration: number): void {
    if (!this.context || !this.master) {
      return;
    }

    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const panner = this.createPanner(position);
    const now = this.context.currentTime;

    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(620, now);
    filter.frequency.linearRampToValueAtTime(1280, now + duration);
    filter.Q.value = 7;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume * 0.08, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.master);
    source.start(now);
    source.stop(now + duration);
  }

  private createPanner(position: THREE.Vector3): PannerNode {
    if (!this.context) {
      throw new Error('Audio non initialise.');
    }

    const panner = this.context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'exponential';
    panner.refDistance = 1;
    panner.rolloffFactor = 1.6;
    panner.positionX.value = position.x;
    panner.positionY.value = position.y;
    panner.positionZ.value = position.z;
    return panner;
  }

  private playSfx(fileName: string, volume: number): boolean {
    const audio = this.getAudio(fileName);
    if (!audio) {
      return false;
    }

    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
    void audio.play().catch(() => undefined);
    return true;
  }

  private playLoop(fileName: string, volume: number): void {
    const audio = this.getAudio(fileName);
    if (!audio) {
      return;
    }

    audio.loop = true;
    audio.volume = volume;
    void audio.play().catch(() => undefined);
  }

  private getAudio(fileName: string): HTMLAudioElement | undefined {
    const cached = this.sfxCache.get(fileName);
    if (cached) {
      return cached.cloneNode(true) as HTMLAudioElement;
    }

    const audio = new Audio(`/sfx/${fileName}`);
    audio.preload = 'auto';
    this.sfxCache.set(fileName, audio);
    return audio.cloneNode(true) as HTMLAudioElement;
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
