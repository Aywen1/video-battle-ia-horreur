/**
 * Caméra TV CRT : trépied à roulettes + bras articulé + boîtier caméra
 * avec voyant REC rouge clignotant + petit écran de preview latéral qui
 * affiche la webcam du joueur (CRT shader). C'est aussi un interactable.
 */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  Texture,
  VideoTexture,
} from 'three';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';
import { PALETTE } from '../../utils/palette';
import { CRTScreenMaterial } from '../../rendering/materials/CRTScreenMaterial';

export interface CRTCameraBuild {
  group: Group;
  recLight: Mesh;
  screenMaterial: CRTScreenMaterial | null;
  screenMesh: Mesh;
}

export function buildCRTCamera(webcamVideo: HTMLVideoElement | null): CRTCameraBuild {
  const group = new Group();

  // Trépied : 3 jambes simplifiées en croix
  const legMat = flatToon({ color: PALETTE.charcoal, metalness: 0.4, roughness: 0.5 });
  for (let i = 0; i < 3; i++) {
    const leg = new Mesh(new CylinderGeometry(0.035, 0.045, 1.2, 8), legMat);
    leg.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.2, 0.6, Math.sin((i / 3) * Math.PI * 2) * 0.2);
    leg.rotation.x = Math.cos((i / 3) * Math.PI * 2) * 0.15;
    leg.rotation.z = -Math.sin((i / 3) * Math.PI * 2) * 0.15;
    group.add(leg);

    // Roulettes
    const wheel = new Mesh(new SphereGeometry(0.06, 12, 8), flatToon({ color: PALETTE.charcoal }));
    wheel.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.32, 0.06, Math.sin((i / 3) * Math.PI * 2) * 0.32);
    group.add(wheel);
  }

  // Colonne centrale
  const column = new Mesh(new CylinderGeometry(0.05, 0.05, 0.5, 10), legMat);
  column.position.y = 1.4;
  group.add(column);

  // Boîtier caméra (gros bloc gris foncé + détails crème)
  const body = new Mesh(
    new BoxGeometry(0.7, 0.45, 0.65),
    flatToon({ color: '#3a3a3e', roughness: 0.6 }),
  );
  body.position.y = 1.75;
  group.add(body);

  // Objectif (cylindre noir en avant)
  const lens = new Mesh(
    new CylinderGeometry(0.14, 0.16, 0.32, 18),
    flatToon({ color: PALETTE.charcoal, metalness: 0.8, roughness: 0.2 }),
  );
  lens.rotation.z = Math.PI / 2;
  // Le "front" de la caméra est en +Z (vers le joueur)
  lens.position.set(0, 1.75, 0.5);
  lens.rotation.x = Math.PI / 2;
  group.add(lens);

  // Voyant REC rouge (sphère émissive)
  const recLight = new Mesh(
    new SphereGeometry(0.04, 12, 8),
    flatToon({
      color: PALETTE.red,
      emissive: PALETTE.red,
      emissiveIntensity: 2.0,
    }),
  );
  recLight.position.set(0.28, 1.92, 0.34);
  group.add(recLight);

  // Étiquette "REC" (petit cube crème)
  const recTag = new Mesh(
    new BoxGeometry(0.16, 0.05, 0.01),
    flatToon({ color: PALETTE.cream, emissive: PALETTE.cream, emissiveIntensity: 0.3 }),
  );
  recTag.position.set(0.0, 1.92, 0.331);
  group.add(recTag);

  // Petit écran de prévisualisation : placé sur la face AVANT du boîtier,
  // à gauche de l'objectif, normale vers +Z local (= vers le joueur, puisque
  // le groupe entier est orienté vers lui). Légèrement enchâssé dans un
  // cadre noir pour éviter l'effet "post-it qui flotte".
  let screenMat: CRTScreenMaterial | null = null;
  let screenTex: Texture | null = null;
  if (webcamVideo) {
    screenTex = new VideoTexture(webcamVideo);
    screenMat = new CRTScreenMaterial(screenTex, { mirror: true, chromatic: 0.006, intensity: 1.0 });
  }

  // Bezel (cadre) légèrement plus grand, derrière l'écran
  const bezel = new Mesh(
    new PlaneGeometry(0.34, 0.27),
    flatToon({ color: PALETTE.charcoal, roughness: 0.6 }),
  );
  bezel.position.set(-0.3, 1.78, 0.327);
  group.add(bezel);

  const screen = new Mesh(
    new PlaneGeometry(0.28, 0.21),
    screenMat ??
      flatToon({ color: PALETTE.charcoal, emissive: '#1a0808', emissiveIntensity: 0.5 }),
  );
  screen.position.set(-0.3, 1.78, 0.332);
  group.add(screen);

  // Bras articulé (tube oblique vers le sol)
  const arm = new Mesh(
    new BoxGeometry(0.06, 0.06, 0.7),
    flatToon({ color: '#3a3a3e' }),
  );
  arm.position.set(0, 1.55, -0.05);
  group.add(arm);

  // Place la caméra à 2.6m devant le joueur (côté +Z par convention de la salle)
  return { group, recLight, screenMaterial: screenMat, screenMesh: screen };
}

/** Animation : voyant REC pulsé. */
export function animateCRTCamera(build: CRTCameraBuild, time: number): void {
  const pulse = 0.6 + 0.4 * (Math.sin(time * 2.4) > 0.6 ? 1 : 0);
  const mat = build.recLight.material as ReturnType<typeof flatToon>;
  mat.emissiveIntensity = 1.5 + pulse * 1.5;
  if (build.screenMaterial) {
    build.screenMaterial.update(time);
  }
}
