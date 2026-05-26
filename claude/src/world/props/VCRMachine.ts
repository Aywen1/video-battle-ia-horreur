/**
 * VCRMachine : magnétoscope vintage avec fente pour cassette. Interactable
 * principal de la régie : insérer la cassette tenue → joue la rédiffusion.
 *
 * Visuels : boîtier noir + fente crème + voyant rouge (idle) qui devient
 * vert quand "en lecture". Petite étagère intégrée pour poser la cassette
 * du joueur avant insertion.
 */
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { PALETTE } from '../../utils/palette';

export interface VCRBuild {
  group: Group;
  /** Boîtier principal — sert d'ancre pour le label d'interaction. */
  body: Mesh;
  /** Voyant d'état (rouge idle, vert lecture). */
  ledMaterial: MeshStandardMaterial;
  /** Petit "écran" de fente lumineux. */
  slotMaterial: MeshStandardMaterial;
  setPlaying(playing: boolean): void;
}

export function buildVCRMachine(): VCRBuild {
  const group = new Group();

  // Boîtier principal
  const body = new Mesh(
    new BoxGeometry(0.85, 0.16, 0.45),
    flatToon({ color: '#1a1a1a', roughness: 0.55 }),
  );
  body.position.set(0, 0.08, 0);
  group.add(body);

  // Fente cassette (rectangle crème enfoncé)
  const slotMaterial = flatToon({
    color: '#0a0a0a',
    emissive: '#3a2010',
    emissiveIntensity: 0.4,
    roughness: 0.7,
  }) as MeshStandardMaterial;
  const slot = new Mesh(new PlaneGeometry(0.22, 0.04), slotMaterial);
  slot.position.set(-0.15, 0.10, 0.226);
  group.add(slot);

  // Logo bandeau crème "MIDNIGHT MARK V"
  const logo = new Mesh(
    new BoxGeometry(0.30, 0.025, 0.005),
    flatToon({ color: PALETTE.cream, emissive: PALETTE.cream, emissiveIntensity: 0.25 }),
  );
  logo.position.set(0.15, 0.13, 0.228);
  group.add(logo);

  // Voyant LED (rouge → vert)
  const ledMaterial = flatToon({
    color: PALETTE.red,
    emissive: PALETTE.red,
    emissiveIntensity: 1.4,
    roughness: 0.3,
  }) as MeshStandardMaterial;
  const led = new Mesh(new BoxGeometry(0.025, 0.025, 0.005), ledMaterial);
  led.position.set(0.32, 0.08, 0.228);
  group.add(led);

  // Boutons (3 petits cubes)
  const btnMat = flatToon({ color: '#3a3a3a', roughness: 0.6 });
  for (let i = 0; i < 3; i++) {
    const btn = new Mesh(new BoxGeometry(0.04, 0.025, 0.005), btnMat);
    btn.position.set(-0.30 + i * 0.06, 0.04, 0.228);
    group.add(btn);
  }

  // Petite étagère intégrée à droite (pour poser la cassette)
  const tray = new Mesh(
    new BoxGeometry(0.22, 0.01, 0.16),
    flatToon({ color: '#2a2a2a', roughness: 0.65 }),
  );
  tray.position.set(0.30, 0.001, 0.05);
  group.add(tray);

  return {
    group,
    body,
    ledMaterial,
    slotMaterial,
    setPlaying(playing: boolean): void {
      if (playing) {
        ledMaterial.color.set(PALETTE.green);
        ledMaterial.emissive.set(PALETTE.green);
        ledMaterial.emissiveIntensity = 2.0;
        slotMaterial.emissive.set('#3aaa3a');
        slotMaterial.emissiveIntensity = 0.6;
      } else {
        ledMaterial.color.set(PALETTE.red);
        ledMaterial.emissive.set(PALETTE.red);
        ledMaterial.emissiveIntensity = 1.4;
        slotMaterial.emissive.set('#3a2010');
        slotMaterial.emissiveIntensity = 0.4;
      }
    },
  };
}
