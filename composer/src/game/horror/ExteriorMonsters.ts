import * as THREE from 'three';
import { AudioManager } from '../../audio/AudioManager';
import { ScreamerType } from './ScreamerOverlay';

export interface MonsterContext {
  playerPos: THREE.Vector3;
  playerYaw: number;
  camera: THREE.Camera;
  onFlash: () => void;
  onScreamer: (type: ScreamerType) => Promise<void>;
  pushPlayer: (dir: THREE.Vector3) => void;
}

export class ExteriorMonsters {
  readonly stalker: THREE.Group;
  readonly crawler: THREE.Group;
  readonly swarm: THREE.Group[] = [];

  private growlTimer = 12;
  private lastHitTime = -999;

  constructor(parent: THREE.Group) {
    this.stalker = buildMonster(0x0a0808, 1.9, 0.45);
    this.crawler = buildMonster(0x120808, 1.2, 0.7);
    this.crawler.scale.set(1.2, 0.7, 1.4);
    this.stalker.visible = false;
    this.crawler.visible = false;
    parent.add(this.stalker, this.crawler);

    for (let i = 0; i < 3; i++) {
      const s = buildMonster(0x050505, 1.6, 0.35);
      s.visible = false;
      this.swarm.push(s);
      parent.add(s);
    }
  }

  reset(): void {
    this.stalker.visible = false;
    this.crawler.visible = false;
    this.swarm.forEach((s) => (s.visible = false));
    this.growlTimer = 12;
  }

  update(
    dt: number,
    step: number,
    ctx: MonsterContext,
    audio: AudioManager,
    gameTime: number
  ): void {
    if (step >= 5) {
      this.updateStalker(dt, ctx, audio, gameTime);
    }
    if (step >= 8) {
      this.updateCrawler(dt, ctx, audio, gameTime);
    }
    if (step >= 11) {
      this.updateSwarm(dt, ctx, audio, gameTime);
    }
  }

  private updateStalker(
    dt: number,
    ctx: MonsterContext,
    audio: AudioManager,
    gameTime: number
  ): void {
    const m = this.stalker;
    const behind = new THREE.Vector3(
      ctx.playerPos.x + Math.sin(ctx.playerYaw) * 14,
      ctx.playerPos.y - 1.5,
      ctx.playerPos.z + Math.cos(ctx.playerYaw) * 14
    );
    if (!m.visible) {
      m.position.copy(behind);
      m.visible = true;
    }
    const toPlayer = ctx.playerPos.clone().sub(m.position);
    const dist = toPlayer.length();
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), ctx.playerYaw);
    const looking = forward.dot(toPlayer.normalize()) > 0.45;

    if (!looking && dist > 3) {
      m.position.lerp(ctx.playerPos, dt * 0.08);
      m.position.y = ctx.playerPos.y - 1.5;
    }
    this.tryHit(dist, ctx, audio, gameTime, 'silhouette_window');
    this.growlTimer -= dt;
    if (this.growlTimer <= 0) {
      audio.playMonsterGrowl();
      this.growlTimer = 20 + Math.random() * 20;
    }
    if (dist < 16) audio.playHeartbeat(THREE.MathUtils.clamp(1 - dist / 16, 0.2, 1));
  }

  private updateCrawler(
    dt: number,
    ctx: MonsterContext,
    audio: AudioManager,
    gameTime: number
  ): void {
    const m = this.crawler;
    if (!m.visible) {
      m.position.set(ctx.playerPos.x - 8, ctx.playerPos.y - 1.2, ctx.playerPos.z + 6);
      m.visible = true;
    }
    const toPlayer = ctx.playerPos.clone().sub(m.position);
    const dist = toPlayer.length();
    const speed = dist < 12 ? 0.22 : 0.1;
    m.position.add(toPlayer.normalize().multiplyScalar(speed * dt * 10));
    m.position.y = ctx.playerPos.y - 1.2;
    this.tryHit(dist, ctx, audio, gameTime, 'face_close');
    if (dist < 18) audio.playHeartbeat(0.8);
  }

  private updateSwarm(
    dt: number,
    ctx: MonsterContext,
    audio: AudioManager,
    gameTime: number
  ): void {
    this.swarm.forEach((s, i) => {
      if (!s.visible) {
        s.position.set(-6 + i * 5, ctx.playerPos.y - 1.4, ctx.playerPos.z + 8 + i * 2);
        s.visible = true;
      }
      s.position.x += Math.sin(gameTime + i) * dt * 0.5;
      const dist = s.position.distanceTo(ctx.playerPos);
      if (dist < 4) this.tryHit(dist, ctx, audio, gameTime, 'hands_glass');
    });
  }

  private tryHit(
    dist: number,
    ctx: MonsterContext,
    audio: AudioManager,
    gameTime: number,
    type: ScreamerType
  ): void {
    if (dist > 2.5 || gameTime - this.lastHitTime < 8) return;
    this.lastHitTime = gameTime;
    audio.playExteriorSting();
    ctx.onFlash();
    const away = ctx.playerPos.clone().sub(
      this.stalker.position.lengthSq() > 0 ? this.stalker.position : ctx.playerPos
    );
    if (away.lengthSq() < 0.01) away.set(0, 0, 1);
    away.normalize().multiplyScalar(3);
    ctx.pushPlayer(away);
    void ctx.onScreamer(type);
  }
}

function buildMonster(color: number, height: number, width: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height * 0.55, width * 0.6),
    new THREE.MeshStandardMaterial({ color, roughness: 0.95 })
  );
  body.position.y = height * 0.35;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.7, width * 0.7, width * 0.7),
    new THREE.MeshStandardMaterial({ color: 0x050505 })
  );
  head.position.y = height * 0.75;
  const eye = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.06, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 2 })
  );
  eye.position.set(width * 0.15, height * 0.78, width * 0.35);
  const eye2 = eye.clone();
  eye2.position.x = -width * 0.15;
  g.add(body, head, eye, eye2);
  return g;
}
