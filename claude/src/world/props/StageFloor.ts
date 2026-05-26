/**
 * Plateau circulaire : disque crème + bordure rouge + marque "X" au sol.
 */
import {
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
  RingGeometry,
} from 'three';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { stageMarkTexture } from '../../utils/procedural';
import { PALETTE } from '../../utils/palette';

export interface StageFloorBuild {
  group: Group;
  markPosition: { x: number; z: number };
}

export function buildStageFloor(radius = 5): StageFloorBuild {
  const group = new Group();

  // Sol principal du plateau (couleur crème, légèrement chaud)
  const floor = new Mesh(
    new CircleGeometry(radius, 48),
    flatToon({ color: PALETTE.cream, roughness: 0.85 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  group.add(floor);

  // Bordure rouge
  const border = new Mesh(
    new RingGeometry(radius - 0.12, radius, 64),
    flatToon({ color: PALETTE.red, roughness: 0.7 }),
  );
  border.rotation.x = -Math.PI / 2;
  border.position.y = 0.01;
  group.add(border);

  // Marque X (gaffer rouge) au centre, légèrement décalée pour que le joueur
  // se "réveille" dessus avec le bureau du présentateur en face.
  const mark = new Mesh(
    new PlaneGeometry(0.9, 0.9),
    flatToon({
      color: PALETTE.cream,
      map: stageMarkTexture(),
      transparent: true,
      roughness: 0.9,
      side: DoubleSide,
    }),
  );
  mark.rotation.x = -Math.PI / 2;
  const markX = 0;
  const markZ = 2.3; // côté joueur (le présentateur sera en -Z)
  mark.position.set(markX, 0.02, markZ);
  group.add(mark);

  return { group, markPosition: { x: markX, z: markZ } };
}
