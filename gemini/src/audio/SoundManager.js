import * as THREE from 'three';

export class SoundManager {
    constructor(camera) {
        this.camera = camera;
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        
        this.audioContext = this.listener.context;
        this.sounds = {};
        
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        
        // Reprendre le contexte audio (nécessaire sur les navigateurs modernes après un geste utilisateur)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.createFootstepSound();
        this.createDroneSound();
        
        window.addEventListener('terminal-interacted', () => this.playErrorSound());
        
        this.initialized = true;
    }

    createDroneSound() {
        // Bourdonnement de fond (drone)
        this.droneOscillator = this.audioContext.createOscillator();
        this.droneOscillator.type = 'triangle';
        this.droneOscillator.frequency.value = 50; // Basse fréquence

        this.droneGain = this.audioContext.createGain();
        this.droneGain.gain.value = 0; // Silencieux au début

        this.droneOscillator.connect(this.droneGain);
        this.droneGain.connect(this.audioContext.destination);

        this.droneOscillator.start();
    }

    startDrone() {
        if (!this.initialized) return;
        const now = this.audioContext.currentTime;
        this.droneGain.gain.linearRampToValueAtTime(0.1, now + 2); // Monte doucement en volume
    }

    startCorruptedDrone() {
        if (!this.initialized) return;
        const now = this.audioContext.currentTime;
        this.droneOscillator.frequency.cancelScheduledValues(now);
        this.droneGain.gain.cancelScheduledValues(now);
        this.droneOscillator.frequency.setValueAtTime(80, now);
        this.droneGain.gain.linearRampToValueAtTime(0.3, now + 2);
    }

    increaseDroneIntensity() {
        if (!this.initialized) return;
        const now = this.audioContext.currentTime;
        // Augmente la fréquence et le volume pour créer de la tension
        this.droneOscillator.frequency.linearRampToValueAtTime(this.droneOscillator.frequency.value + 10, now + 1);
        this.droneGain.gain.linearRampToValueAtTime(this.droneGain.gain.value + 0.05, now + 1);
    }

    stopDrone() {
        if (!this.initialized || !this.droneGain) return;
        const now = this.audioContext.currentTime;
        this.droneGain.gain.cancelScheduledValues(now);
        this.droneOscillator.frequency.cancelScheduledValues(now);
        this.droneGain.gain.linearRampToValueAtTime(0, now + 1); // Baisse doucement le volume à 0
        // On réinitialise la fréquence pour la prochaine fois
        this.droneOscillator.frequency.linearRampToValueAtTime(50, now + 1);
    }

    playGlitchSound() {
        if (!this.initialized) return;
        const now = this.audioContext.currentTime;
        
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100 + Math.random() * 500, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.1);
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        
        osc.start(now);
        osc.stop(now + 0.1);
    }

    playSuccessSound() {
        if (!this.initialized) return;
        const now = this.audioContext.currentTime;
        
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.1);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        
        osc.start(now);
        osc.stop(now + 0.3);
    }

    playElevatorSound() {
        if (!this.initialized) return;
        const now = this.audioContext.currentTime;
        
        // Son de machinerie lourde
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(40, now);
        osc.frequency.linearRampToValueAtTime(60, now + 2); // Accélération
        osc.frequency.setValueAtTime(60, now + 4);
        osc.frequency.linearRampToValueAtTime(20, now + 6); // Décélération
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 1);
        gain.gain.setValueAtTime(0.3, now + 5);
        gain.gain.linearRampToValueAtTime(0, now + 6);
        
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        
        osc.start(now);
        osc.stop(now + 6);
    }

    playAnomalyPurgeSound() {
        if (!this.initialized) return;
        const now = this.audioContext.currentTime;
        
        // Son électrique aigu qui s'éteint
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.5);
        
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        
        osc.start(now);
        osc.stop(now + 0.5);
    }

    playScreamerSound() {
        if (!this.initialized) return;
        const now = this.audioContext.currentTime;
        
        // Bruit strident insupportable
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(1000, now);
        
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(1200, now);
        
        // Modulation de fréquence très rapide (FM) pour faire "grincer" le son
        const modOsc = this.audioContext.createOscillator();
        const modGain = this.audioContext.createGain();
        modOsc.type = 'sine';
        modOsc.frequency.value = 50;
        modGain.gain.value = 500;
        modOsc.connect(modGain);
        modGain.connect(osc1.frequency);
        modGain.connect(osc2.frequency);
        
        gain.gain.setValueAtTime(1.0, now); // Volume MAX
        gain.gain.setValueAtTime(1.0, now + 1);
        gain.gain.linearRampToValueAtTime(0, now + 1.1);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioContext.destination);
        
        osc1.start(now);
        osc2.start(now);
        modOsc.start(now);
        
        osc1.stop(now + 1.1);
        osc2.stop(now + 1.1);
        modOsc.stop(now + 1.1);
    }

    playVoiceWhisper() {
        if (!this.initialized) return;
        const now = this.audioContext.currentTime;
        
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(150, now);
        osc1.frequency.linearRampToValueAtTime(100, now + 4);
        
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(100, now);
        
        // Modulation pour faire une "voix"
        const modOsc = this.audioContext.createOscillator();
        const modGain = this.audioContext.createGain();
        modOsc.type = 'sine';
        modOsc.frequency.value = 10;
        modGain.gain.value = 50;
        modOsc.connect(modGain);
        modGain.connect(osc1.frequency);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 1);
        gain.gain.setValueAtTime(0.2, now + 3);
        gain.gain.linearRampToValueAtTime(0, now + 4);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioContext.destination);
        
        osc1.start(now);
        osc2.start(now);
        modOsc.start(now);
        
        osc1.stop(now + 4);
        osc2.stop(now + 4);
        modOsc.stop(now + 4);
    }

    playPhoneRing() {
        if (!this.initialized) return;
        const now = this.audioContext.currentTime;
        
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.setValueAtTime(1000, now + 0.1);
        osc.frequency.setValueAtTime(800, now + 0.2);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.setValueAtTime(0.1, now + 0.05);
        gain.gain.setValueAtTime(0, now + 0.3);
        
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        
        osc.start(now);
        osc.stop(now + 0.3);
    }

    playHeartbeat() {
        if (!this.initialized) return;
        const now = this.audioContext.currentTime;
        
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(40, now);
        osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.5);
        
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        
        osc.start(now);
        osc.stop(now + 0.5);
    }

    createFootstepSound() {
        // Bruit de pas simple (bruit blanc filtré)
        const bufferSize = this.audioContext.sampleRate * 0.1; // 100ms
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        this.footstepBuffer = buffer;
        this.lastStepTime = 0;
    }

    playFootstep(isSprinting) {
        if (!this.initialized) return;
        
        const now = this.audioContext.currentTime;
        const interval = isSprinting ? 0.3 : 0.5;
        
        if (now - this.lastStepTime > interval) {
            const source = this.audioContext.createBufferSource();
            source.buffer = this.footstepBuffer;
            
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1000;
            
            const gain = this.audioContext.createGain();
            gain.gain.setValueAtTime(0.15, now); // Volume réduit
            gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
            
            source.connect(filter);
            filter.connect(gain);
            gain.connect(this.audioContext.destination);
            
            source.start(now);
            this.lastStepTime = now;
        }
    }

    playErrorSound() {
        if (!this.initialized) return;
        
        const now = this.audioContext.currentTime;
        
        // Son désagréable (dissonance)
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        // Utiliser linearRampToValueAtTime au lieu de exponentialRampToValueAtTime pour éviter les erreurs si la valeur de départ est 0
        osc.frequency.linearRampToValueAtTime(50, now + 0.5);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
        
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        
        osc.start(now);
        osc.stop(now + 0.5);
    }
}