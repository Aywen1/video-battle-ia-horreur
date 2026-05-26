/**
 * Bureau du présentateur : panneau frontal coloré + plateau, microphone vintage.
 */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { PALETTE } from '../../utils/palette';

export function buildHostDesk(): Group {
  const group = new Group();
  // Panneau frontal incurvé (cube avec extrusion)
  const front = new Mesh(
    new BoxGeometry(2.4, 1.1, 1.2),
    flatToon({ color: PALETTE.green, roughness: 0.9 }),
  );
  front.position.y = 0.55;
  group.add(front);

  // Trim doré (jaune) en haut du panneau
  const trim = new Mesh(
    new BoxGeometry(2.5, 0.08, 1.25),
    flatToon({ color: PALETTE.yellow, emissive: PALETTE.yellow, emissiveIntensity: 0.4 }),
  );
  trim.position.y = 1.12;
  group.add(trim);

  // Plateau (top du bureau)
  const top = new Mesh(
    new BoxGeometry(2.6, 0.08, 1.4),
    flatToon({ color: PALETTE.cream, roughness: 0.8 }),
  );
  top.position.y = 1.18;
  group.add(top);

  // Microphone vintage
  const micStand = new Mesh(
    new CylinderGeometry(0.018, 0.018, 0.5, 12),
    flatToon({ color: PALETTE.charcoal, metalness: 0.6, roughness: 0.3 }),
  );
  micStand.position.set(0.4, 1.18 + 0.25, 0);
  group.add(micStand);

  const micBase = new Mesh(
    new CylinderGeometry(0.12, 0.14, 0.05, 16),
    flatToon({ color: PALETTE.charcoal, metalness: 0.7, roughness: 0.3 }),
  );
  micBase.position.set(0.4, 1.18 + 0.025, 0);
  group.add(micBase);

  const micHead = new Mesh(
    new SphereGeometry(0.07, 16, 12),
    flatToon({ color: PALETTE.charcoal, metalness: 0.85, roughness: 0.25 }),
  );
  micHead.position.set(0.4, 1.18 + 0.55, 0);
  group.add(micHead);

  // Petite grille décorative sur le mic (anneau)
  const micRing = new Mesh(
    new TorusGeometry(0.08, 0.008, 8, 24),
    flatToon({ color: PALETTE.yellow, metalness: 0.8, roughness: 0.2 }),
  );
  micRing.rotation.x = Math.PI / 2;
  micRing.position.set(0.4, 1.18 + 0.55, 0);
  group.add(micRing);

  // Mug / verre sur le bureau (cylindre bleu)
  const mug = new Mesh(
    new CylinderGeometry(0.06, 0.07, 0.16, 14),
    flatToon({ color: PALETTE.blue, roughness: 0.7 }),
  );
  mug.position.set(-0.6, 1.18 + 0.08, 0.2);
  group.add(mug);

  // Petits "papiers" (script) sur le bureau
  const script = new Mesh(
    new BoxGeometry(0.4, 0.02, 0.3),
    flatToon({ color: PALETTE.cream }),
  );
  script.position.set(-0.1, 1.18 + 0.01, -0.2);
  script.rotation.y = -0.15;
  group.add(script);

  return group;
}
