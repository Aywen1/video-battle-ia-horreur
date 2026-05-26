/**
 * Rideau de velours rouge en arrière-plan (derrière le bureau du présentateur).
 */
import { DoubleSide, Group, Mesh } from 'three';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { curtainGeometry, curtainTexture } from '../../utils/procedural';
import { PALETTE } from '../../utils/palette';

export function buildCurtain(width = 14, height = 5): Group {
  const group = new Group();
  const tex = curtainTexture();
  const mat = flatToon({
    color: PALETTE.cream,
    map: tex,
    roughness: 0.95,
    side: DoubleSide,
  });
  const geo = curtainGeometry(width, height, 16);
  const mesh = new Mesh(geo, mat);
  mesh.position.y = height / 2;
  mesh.receiveShadow = true;
  group.add(mesh);

  // Pelmet (frise du haut) — petit panneau rouge horizontal
  const pelmet = new Mesh(
    curtainGeometry(width + 0.5, 0.8, 18),
    flatToon({ color: PALETTE.cream, map: curtainTexture(), side: DoubleSide }),
  );
  pelmet.position.y = height + 0.3;
  pelmet.position.z = 0.05;
  group.add(pelmet);

  return group;
}
