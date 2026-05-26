/**
 * StageLights : 3 spots colorés (jaune key, magenta fill, rouge accent) +
 * faisceaux visibles via cônes semi-transparents. Allumage séquentiel à
 * l'ouverture. Modulés dynamiquement par le stress.
 */
import {
  AdditiveBlending,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SpotLight,
} from 'three';
import { PALETTE } from '../../utils/palette';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';

export interface StageLightSetup {
  group: Group;
  spots: StageSpot[];
}

export interface StageSpot {
  light: SpotLight;
  housing: Object3D;
  beam: Mesh;
  baseColor: number;
  baseIntensity: number;
  target: Object3D;
  flicker: number; // état interne de vacillement
}

const COLORS = [PALETTE.yellow, PALETTE.magenta, PALETTE.red];
const POSITIONS: Array<[number, number, number]> = [
  [-2.4, 5.0, 1.0], // key warm (jaune)
  [2.4, 5.0, 1.0], // fill magenta
  [0, 5.4, -1.5], // back accent rouge depuis derrière (rim sur le présentateur)
];

export function buildStageLights(target: Object3D): StageLightSetup {
  const group = new Group();
  const spots: StageSpot[] = [];

  for (let i = 0; i < POSITIONS.length; i++) {
    const [x, y, z] = POSITIONS[i];
    const color = parseInt(COLORS[i].slice(1), 16);

    // Housing (petit cylindre noir)
    const housing = new Mesh(
      new ConeGeometry(0.22, 0.4, 12, 1, true),
      flatToon({ color: PALETTE.charcoal, roughness: 0.7, side: DoubleSide }),
    );
    housing.position.set(x, y, z);
    // Oriente le housing vers la cible
    housing.lookAt(target.position);
    housing.rotateX(Math.PI / 2);
    group.add(housing);

    // SpotLight Three.js
    const light = new SpotLight(color, 0, 18, Math.PI / 5.5, 0.45, 1.4);
    light.position.set(x, y, z);
    light.target = target;
    group.add(light);

    // Beam visible (cône additif)
    const beam = new Mesh(
      new ConeGeometry(1.6, 5.6, 24, 1, true),
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.0,
        blending: AdditiveBlending,
        side: DoubleSide,
        depthWrite: false,
        fog: false,
      }),
    );
    // Pointer le beam vers la cible
    beam.position.set(x, y, z);
    const dx = target.position.x - x;
    const dy = target.position.y - y;
    const dz = target.position.z - z;
    const len = Math.hypot(dx, dy, dz);
    beam.scale.setScalar(1);
    beam.lookAt(target.position);
    beam.rotateX(Math.PI / 2);
    beam.position.x += (dx / len) * 2.8;
    beam.position.y += (dy / len) * 2.8;
    beam.position.z += (dz / len) * 2.8;
    group.add(beam);

    spots.push({
      light,
      housing,
      beam,
      baseColor: color,
      baseIntensity: 22,
      target,
      flicker: 0,
    });
  }
  return { group, spots };
}

/**
 * Allume un spot avec une rampe douce sur `durationSec`.
 */
export function ignite(spot: StageSpot, durationSec = 0.9): void {
  const start = performance.now();
  const beamMat = spot.beam.material as MeshBasicMaterial;
  function tick(): void {
    const t = (performance.now() - start) / (durationSec * 1000);
    const k = Math.min(1, Math.max(0, t));
    // Petit "blip" au début (overshoot)
    const overshoot = k < 0.15 ? Math.sin(k * Math.PI * 6) * 0.25 : 0;
    const ease = 1 - Math.pow(1 - k, 3);
    spot.light.intensity = (ease + overshoot) * spot.baseIntensity;
    beamMat.opacity = ease * 0.10;
    if (k < 1) requestAnimationFrame(tick);
  }
  tick();
}

/** Pilote le vacillement des lampes selon le stress. */
export function updateStageLights(spots: StageSpot[], stress: number, time: number, dt: number): void {
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    // Petit vacillement constant (réaliste, "secteur instable")
    const baseFlicker = Math.sin(time * 7 + i * 1.7) * 0.04 + Math.sin(time * 19 + i * 0.9) * 0.02;
    // Vacillement de stress (plus marqué)
    const stressFlicker = stress > 0.3 ? (Math.random() < stress * 0.45 ? -stress * 0.7 : 0) : 0;
    s.flicker = s.flicker * 0.85 + stressFlicker * 0.15;
    const mod = 1 + baseFlicker + s.flicker;
    s.light.intensity = s.baseIntensity * Math.max(0.1, mod);
    const beamMat = s.beam.material as MeshBasicMaterial;
    beamMat.opacity = 0.10 * Math.max(0.2, mod);
  }
}
