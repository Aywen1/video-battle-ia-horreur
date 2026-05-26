import * as THREE from 'three';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface EmitterConfig {
  id: string;
  position: THREE.Vector3;
  count: number;
  color: number;
  size: number;
  speed: number;
  gravity: number;
  spread: THREE.Vector3;
  additive: boolean;
  /** 'rain' | 'dust' | 'steam' | 'spark' */
  mode: 'rain' | 'dust' | 'steam' | 'spark';
  active: boolean;
}

export class ParticleManager {
  private scene: THREE.Scene;
  private emitters = new Map<string, { cfg: EmitterConfig; particles: Particle[]; points: THREE.Points }>();
  private burstParticles: Particle[] = [];
  private burstPoints: THREE.Points | null = null;
  private burstGeo: THREE.BufferGeometry | null = null;
  private burstMat: THREE.PointsMaterial | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  addEmitter(cfg: EmitterConfig): void {
    const particles: Particle[] = [];
    for (let i = 0; i < cfg.count; i++) {
      particles.push(this.spawnParticle(cfg, true));
    }
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(cfg.count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: cfg.color,
      size: cfg.size,
      transparent: true,
      opacity: cfg.mode === 'dust' ? 0.35 : 0.55,
      blending: cfg.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this.emitters.set(cfg.id, { cfg, particles, points });
  }

  setEmitterActive(id: string, active: boolean): void {
    const e = this.emitters.get(id);
    if (e) e.cfg.active = active;
  }

  spawnBurst(pos: THREE.Vector3, count = 40, color = 0xffaa44): void {
    for (let i = 0; i < count; i++) {
      this.burstParticles.push({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 2 + 1,
        vz: (Math.random() - 0.5) * 3,
        life: 0.3 + Math.random() * 0.4,
        maxLife: 0.7,
      });
    }
    if (!this.burstPoints) {
      this.burstGeo = new THREE.BufferGeometry();
      this.burstGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      this.burstMat = new THREE.PointsMaterial({
        color,
        size: 0.08,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.burstPoints = new THREE.Points(this.burstGeo, this.burstMat);
      this.burstPoints.frustumCulled = false;
      this.scene.add(this.burstPoints);
    }
  }

  private spawnParticle(cfg: EmitterConfig, randomY = false): Particle {
    const s = cfg.spread;
    const p: Particle = {
      x: cfg.position.x + (Math.random() - 0.5) * s.x,
      y: cfg.position.y + (randomY ? Math.random() * s.y : 0),
      z: cfg.position.z + (Math.random() - 0.5) * s.z,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 1,
      maxLife: 1,
    };
    if (cfg.mode === 'rain') {
      p.vy = -cfg.speed * (0.8 + Math.random() * 0.4);
      p.vx = (Math.random() - 0.5) * 0.3;
    } else if (cfg.mode === 'dust') {
      p.vx = (Math.random() - 0.5) * cfg.speed * 0.2;
      p.vy = (Math.random() - 0.5) * cfg.speed * 0.1;
      p.vz = (Math.random() - 0.5) * cfg.speed * 0.2;
      p.maxLife = 2 + Math.random() * 3;
      p.life = Math.random() * p.maxLife;
    } else if (cfg.mode === 'steam') {
      p.vy = cfg.speed * (0.5 + Math.random() * 0.5);
      p.vx = (Math.random() - 0.5) * 0.15;
      p.vz = (Math.random() - 0.5) * 0.15;
      p.maxLife = 1.5 + Math.random();
      p.life = Math.random() * p.maxLife;
    }
    return p;
  }

  update(dt: number): void {
    for (const { cfg, particles, points } of this.emitters.values()) {
      if (!cfg.active) continue;
      const pos = points.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (cfg.mode === 'dust' || cfg.mode === 'steam') {
          p.life -= dt;
          if (p.life <= 0) {
            particles[i] = this.spawnParticle(cfg, cfg.mode === 'dust');
            p = particles[i];
          }
        }
        if (cfg.mode === 'rain' && p.y < cfg.position.y - cfg.spread.y) {
          particles[i] = this.spawnParticle(cfg, false);
          p = particles[i];
        }
        if (cfg.mode === 'steam') {
          p.y += cfg.gravity * dt * 0.5;
        } else {
          p.vy += cfg.gravity * dt;
        }
        pos.setXYZ(i, p.x, p.y, p.z);
      }
      pos.needsUpdate = true;
    }

    if (this.burstParticles.length > 0 && this.burstGeo) {
      const max = Math.max(this.burstParticles.length, 1);
      const arr = new Float32Array(max * 3);
      for (let i = this.burstParticles.length - 1; i >= 0; i--) {
        const p = this.burstParticles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 4 * dt;
        p.life -= dt;
        if (p.life <= 0) {
          this.burstParticles.splice(i, 1);
          continue;
        }
        arr[i * 3] = p.x;
        arr[i * 3 + 1] = p.y;
        arr[i * 3 + 2] = p.z;
      }
      this.burstGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      if (this.burstMat) {
        this.burstMat.opacity = Math.min(1, this.burstParticles.length / 20);
      }
    }
  }
}
