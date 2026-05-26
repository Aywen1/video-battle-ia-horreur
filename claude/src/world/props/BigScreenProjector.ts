/**
 * BigScreenProjector : grand écran de cinéma (3m large) qui diffuse la
 * webcam du joueur en direct via CRTScreenMaterial agrandi. Inclut :
 *  - le grand écran (PlaneGeometry)
 *  - un faisceau de projection (cône additif semi-transparent)
 *  - des particules de poussière dans le faisceau (Points)
 *  - le boîtier projecteur en hauteur (au fond de la salle, derrière le joueur)
 *
 * setOn() allume tout d'un coup (écran + faisceau + particules).
 */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RingGeometry,
  Texture,
  VideoTexture,
} from 'three';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { CRTScreenMaterial } from '../../rendering/materials/CRTScreenMaterial';
import { PALETTE } from '../../utils/palette';

export interface BigScreenBuild {
  group: Group;
  screen: Mesh;
  crtMat: CRTScreenMaterial | null;
  beam: Mesh;
  particles: Points;
  projectorBody: Mesh;
  /** True quand le projecteur est en route. */
  on: boolean;
  setOn(on: boolean): void;
  update(time: number): void;
  dispose(): void;
}

export function buildBigScreenProjector(
  webcamVideo: HTMLVideoElement | null,
  screenPos: { x: number; y: number; z: number },
  /** Position du projecteur (généralement au fond de la salle, en hauteur). */
  projPos: { x: number; y: number; z: number },
): BigScreenBuild {
  const group = new Group();
  // Cadre en bois sombre autour de l'écran
  const frame = new Mesh(
    new BoxGeometry(3.4, 2.0, 0.10),
    flatToon({ color: '#1a1a1a', roughness: 0.7 }),
  );
  frame.position.set(screenPos.x, screenPos.y, screenPos.z - 0.06);
  group.add(frame);

  // L'écran (grand plan)
  let crtMat: CRTScreenMaterial | null = null;
  let screenTex: Texture | null = null;
  if (webcamVideo) {
    screenTex = new VideoTexture(webcamVideo);
    crtMat = new CRTScreenMaterial(screenTex, {
      mirror: true,
      chromatic: 0.008,
      intensity: 1.0,
    });
  }
  const screen = new Mesh(
    new PlaneGeometry(3.0, 1.7),
    crtMat ??
      flatToon({
        color: PALETTE.charcoal,
        emissive: '#1a0808',
        emissiveIntensity: 0.4,
      }),
  );
  screen.position.set(screenPos.x, screenPos.y, screenPos.z);
  group.add(screen);

  // Halo de projection : grand cône additif semi-transparent qui s'étend
  // du projecteur jusqu'à l'écran
  const dx = screenPos.x - projPos.x;
  const dy = screenPos.y - projPos.y;
  const dz = screenPos.z - projPos.z;
  const beamLen = Math.hypot(dx, dy, dz);
  const beam = new Mesh(
    new ConeGeometry(1.6, beamLen, 24, 1, true),
    new MeshBasicMaterial({
      color: 0xf4e9d8,
      transparent: true,
      opacity: 0.0,
      blending: AdditiveBlending,
      side: DoubleSide,
      depthWrite: false,
      fog: false,
    }),
  );
  // Le cône a son apex en haut (+Y) ; on l'oriente du projecteur vers l'écran.
  // Position : milieu du segment ; rotation : aligne -Y avec direction proj→screen
  beam.position.set(
    projPos.x + dx * 0.5,
    projPos.y + dy * 0.5,
    projPos.z + dz * 0.5,
  );
  beam.lookAt(screenPos.x, screenPos.y, screenPos.z);
  beam.rotateX(Math.PI / 2);
  group.add(beam);

  // Particules de poussière dans le faisceau (Points)
  const particleCount = 220;
  const positions = new Float32Array(particleCount * 3);
  const speeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    // Position aléatoire le long du faisceau, dans un cylindre fin
    const t = Math.random();
    const r = Math.random() * (0.2 + t * 1.4);
    const ang = Math.random() * Math.PI * 2;
    positions[i * 3] = projPos.x + dx * t + Math.cos(ang) * r;
    positions[i * 3 + 1] = projPos.y + dy * t + (Math.random() - 0.5) * 0.4;
    positions[i * 3 + 2] = projPos.z + dz * t + Math.sin(ang) * r;
    speeds[i] = 0.15 + Math.random() * 0.35;
  }
  const partGeo = new BufferGeometry();
  partGeo.setAttribute('position', new BufferAttribute(positions, 3));
  const partMat = new PointsMaterial({
    color: 0xf4e9d8,
    size: 0.04,
    transparent: true,
    opacity: 0.0,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    fog: false,
  });
  const particles = new Points(partGeo, partMat);
  particles.userData.speeds = speeds;
  particles.userData.basePos = positions.slice();
  group.add(particles);

  // Boîtier projecteur en hauteur (au fond de la salle, derrière le joueur)
  const projectorBody = new Mesh(
    new BoxGeometry(0.55, 0.30, 0.65),
    flatToon({ color: '#2a2a2a', roughness: 0.7 }),
  );
  projectorBody.position.set(projPos.x, projPos.y, projPos.z);
  group.add(projectorBody);
  // Lentille du projecteur
  const lens = new Mesh(
    new CylinderGeometry(0.10, 0.13, 0.18, 16),
    flatToon({ color: '#0a0a0a', metalness: 0.8, roughness: 0.2 }),
  );
  lens.rotation.x = Math.PI / 2;
  // Pose la lentille vers l'écran
  lens.position.set(projPos.x, projPos.y, projPos.z - 0.42);
  group.add(lens);
  // Bobine
  const reel = new Mesh(
    new CylinderGeometry(0.18, 0.18, 0.04, 24),
    flatToon({ color: '#3a3a3a', metalness: 0.4, roughness: 0.5 }),
  );
  reel.position.set(projPos.x, projPos.y + 0.35, projPos.z);
  reel.rotation.x = Math.PI / 2;
  group.add(reel);
  // Trépied (un seul pied centré pour rester simple)
  const stand = new Mesh(
    new CylinderGeometry(0.04, 0.04, projPos.y - 0.2, 8),
    flatToon({ color: '#1a1a1a' }),
  );
  stand.position.set(projPos.x, (projPos.y - 0.2) / 2, projPos.z);
  group.add(stand);
  // Anneau d'objectif lumineux (très faible au repos)
  const ring = new Mesh(
    new RingGeometry(0.10, 0.13, 18),
    new MeshBasicMaterial({
      color: 0xf4e9d8,
      transparent: true,
      opacity: 0.0,
      blending: AdditiveBlending,
      side: DoubleSide,
      depthWrite: false,
      fog: false,
    }),
  );
  ring.position.set(projPos.x, projPos.y, projPos.z - 0.515);
  group.add(ring);

  let onState = false;

  return {
    group,
    screen,
    crtMat,
    beam,
    particles,
    projectorBody,
    on: false,
    setOn(on: boolean): void {
      onState = on;
      this.on = on;
      const beamMat = beam.material as MeshBasicMaterial;
      beamMat.opacity = on ? 0.18 : 0;
      partMat.opacity = on ? 0.65 : 0;
      (ring.material as MeshBasicMaterial).opacity = on ? 0.85 : 0;
      if (crtMat) {
        crtMat.uniforms.uIntensity.value = on ? 1.0 : 0.0;
      }
    },
    update(time: number): void {
      crtMat?.update(time);
      if (onState) {
        // Anime les particules — elles dérivent doucement vers l'écran
        const positions = (particles.geometry.attributes.position as BufferAttribute);
        const base = particles.userData.basePos as Float32Array;
        const speeds = particles.userData.speeds as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          // Mouvement le long du faisceau (drift vers l'écran)
          const phase = (time * speeds[i] * 0.2) % 1;
          positions.array[i3] = base[i3] + dx * phase * 0.5;
          positions.array[i3 + 1] = base[i3 + 1] + Math.sin(time * 0.7 + i) * 0.04;
          positions.array[i3 + 2] = base[i3 + 2] + dz * phase * 0.5;
        }
        positions.needsUpdate = true;
        // Pulse subtil du beam
        const beamMat = beam.material as MeshBasicMaterial;
        beamMat.opacity = 0.16 + Math.sin(time * 4.5) * 0.04;
      }
    },
    dispose(): void {
      crtMat?.dispose();
      partGeo.dispose();
      partMat.dispose();
    },
  };
}
