/**
 * Cue card : carton jaune-crème posé au sol près du X, texte au marqueur.
 * Interactable principal d'amorçage du segment d'interview.
 */
import { DoubleSide, Group, Mesh, PlaneGeometry } from 'three';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { cueCardTexture } from '../../utils/procedural';

export function buildCueCard(text: string): Group {
  const group = new Group();
  const tex = cueCardTexture(text);
  const card = new Mesh(
    new PlaneGeometry(0.6, 0.45),
    flatToon({ color: '#ffffff', map: tex, side: DoubleSide, roughness: 1.0 }),
  );
  card.rotation.x = -Math.PI / 2;
  card.position.y = 0.015;
  group.add(card);

  // Petite ombre portée fake (cercle sombre)
  // (skip — la lumière la fait déjà)

  return group;
}
