/**
 * Porte "COULISSES" derrière le rideau, initialement verrouillée. Visible
 * uniquement quand le rideau s'écarte au climax.
 */
import { BoxGeometry, Group, Mesh, PlaneGeometry, SphereGeometry } from 'three';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { PALETTE } from '../../utils/palette';

export interface BackstageDoorBuild {
  group: Group;
  frame: Mesh;
  door: Mesh;
  knob: Mesh;
  sign: Mesh;
}

export function buildBackstageDoor(): BackstageDoorBuild {
  const group = new Group();

  // Cadre de porte
  const frame = new Mesh(
    new BoxGeometry(1.3, 2.4, 0.12),
    flatToon({ color: '#3a2422', roughness: 0.85 }),
  );
  frame.position.y = 1.2;
  group.add(frame);

  // Battant
  const door = new Mesh(
    new BoxGeometry(1.05, 2.15, 0.05),
    flatToon({ color: PALETTE.red, roughness: 0.7 }),
  );
  door.position.set(0, 1.15, 0.05);
  group.add(door);

  // Poignée
  const knob = new Mesh(
    new SphereGeometry(0.05, 12, 8),
    flatToon({ color: PALETTE.yellow, metalness: 0.7, roughness: 0.3 }),
  );
  knob.position.set(0.4, 1.1, 0.1);
  group.add(knob);

  // Panneau "COULISSES" au-dessus
  const sign = new Mesh(
    new PlaneGeometry(0.9, 0.18),
    flatToon({
      color: PALETTE.cream,
      emissive: PALETTE.yellow,
      emissiveIntensity: 0.6,
    }),
  );
  sign.position.set(0, 2.42, 0.07);
  group.add(sign);

  // Cachée initialement (placée derrière le rideau, à -3.6 z, hauteur réelle)
  group.visible = false;

  return { group, frame, door, knob, sign };
}
