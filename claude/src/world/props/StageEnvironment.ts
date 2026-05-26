/**
 * Murs/sol/plafond du studio (au-delà du plateau circulaire) + ampoules de
 * bordure pour habiller la scène et renforcer la perception "studio TV".
 */
import {
  AdditiveBlending,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
} from 'three';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { carpetTexture } from '../../utils/procedural';
import { PALETTE } from '../../utils/palette';

export interface StageEnvironmentBuild {
  group: Group;
  bulbs: Mesh[];
  borderLights: PointLight[];
}

export function buildStageEnvironment(): StageEnvironmentBuild {
  const group = new Group();
  const bulbs: Mesh[] = [];
  const borderLights: PointLight[] = [];

  // Sol global (au-delà du plateau)
  const floor = new Mesh(
    new PlaneGeometry(40, 40),
    flatToon({
      color: PALETTE.cream,
      map: carpetTexture(),
      roughness: 1.0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  group.add(floor);

  // Plafond bas teinté magenta sombre
  const ceiling = new Mesh(
    new PlaneGeometry(40, 40),
    flatToon({ color: '#1c1518', roughness: 1.0 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 6.0;
  group.add(ceiling);

  // Mur arrière (derrière les gradins)
  const wallBack = new Mesh(
    new BoxGeometry(40, 8, 0.4),
    flatToon({ color: '#1f1416', roughness: 1.0 }),
  );
  wallBack.position.set(0, 4, 11);
  group.add(wallBack);

  // Murs latéraux
  for (const x of [-12, 12]) {
    const w = new Mesh(
      new BoxGeometry(0.4, 8, 22),
      flatToon({ color: '#1f1416', roughness: 1.0 }),
    );
    w.position.set(x, 4, 2);
    group.add(w);
  }

  // Mur avant (derrière le rideau)
  const wallFront = new Mesh(
    new BoxGeometry(40, 8, 0.4),
    flatToon({ color: '#1f1416', roughness: 1.0 }),
  );
  wallFront.position.set(0, 4, -8);
  group.add(wallFront);

  // Ampoules de bordure de plateau (couronne d'ampoules style cabaret/loge)
  // Disposées en arc devant le rideau, ne touchent pas l'audience.
  const bulbColors = [PALETTE.yellow, PALETTE.magenta, PALETTE.blue, PALETTE.green];
  const bulbY = 0.35;
  const arcSteps = 22;
  for (let i = 0; i < arcSteps; i++) {
    const t = i / (arcSteps - 1);
    // Arc devant le rideau (Z = -3.5), épouse le bord du plateau (rayon ~5.4)
    const angle = (t - 0.5) * Math.PI * 0.9;
    const x = Math.sin(angle) * 5.3;
    const z = -3.4 + Math.cos(angle) * 0.0;
    const color = bulbColors[i % bulbColors.length];
    const bulb = new Mesh(
      new SphereGeometry(0.075, 12, 8),
      flatToon({
        color,
        emissive: color,
        emissiveIntensity: 2.5,
      }),
    );
    bulb.position.set(x, bulbY, z);
    group.add(bulb);
    bulbs.push(bulb);

    // Halo additif autour de chaque ampoule
    const halo = new Mesh(
      new SphereGeometry(0.18, 12, 8),
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.35,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    halo.position.copy(bulb.position);
    group.add(halo);

    // PointLight ponctuelle (intensité faible, distance courte)
    if (i % 3 === 0) {
      const pl = new PointLight(parseInt(color.slice(1), 16), 0.7, 3.2, 2.0);
      pl.position.copy(bulb.position);
      group.add(pl);
      borderLights.push(pl);
    }
  }

  return { group, bulbs, borderLights };
}

/** Petit chase animé sur les ampoules — leur intensité varie en vague. */
export function animateBorderBulbs(bulbs: Mesh[], time: number, stress: number): void {
  for (let i = 0; i < bulbs.length; i++) {
    const phase = i * 0.35 - time * 1.5;
    const wave = (Math.sin(phase) * 0.5 + 0.5) * (1 - stress * 0.6) + 0.4;
    const mat = bulbs[i].material as ReturnType<typeof flatToon>;
    mat.emissiveIntensity = 1.6 + wave * 1.6;
  }
}
