/**
 * BackstageRoom — Chapitre 2 : Les Coulisses.
 *
 * Architecture en 4 phases enchaînées sur ~3'30 :
 *   A) Corridor : entrée des coulisses, néons défaillants, affiches
 *   B) Régie   : mur de moniteurs + 6 cassettes VHS + magnétoscope
 *   C) Atelier : 8 corps suspendus + 12 têtes + stalker Weeping Angel
 *   D) Théâtre : 30 silhouettes assises + projecteur diffusant la webcam
 *
 * Le smile-meter est désactivé sur toute cette salle (libération apparente).
 * L'ambiance audio passe en "backstage hum" via AudioEngine.switchAmbience.
 * Le HUD passe en mode 'backstage' (cache ON AIR / AUDIMAT) puis 'final'
 * pendant la séquence du théâtre.
 */
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  Color,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Vector3,
} from 'three';
import { Room, RoomUpdateContext, RoomDeps, Interactable } from '../Room';
import { buildBackstageCorridor, animateCorridor, CorridorBuild } from '../props/BackstageCorridor';
import { buildMonitorWall, MonitorWallBuild } from '../props/MonitorWall';
import { buildVHSShelf, VHSShelfBuild, VHSCassette } from '../props/VHSShelf';
import { buildVCRMachine, VCRBuild } from '../props/VCRMachine';
import { buildPuppetWorkshop, PuppetWorkshopBuild } from '../props/PuppetWorkshop';
import { buildAudienceTheater, AudienceTheaterBuild, animateAudienceTheater, darkHostRise } from '../props/AudienceTheater';
import { buildBigScreenProjector, BigScreenBuild } from '../props/BigScreenProjector';
import { StalkerPuppet } from '../../entities/StalkerPuppet';
import { EndChapterCard } from '../../ui/EndChapterCard';
import { PlateauRoom } from './PlateauRoom';
import { flatToon } from '../../rendering/materials/FlatToonMaterial';

type BackstagePhase = 'corridor' | 'regie' | 'workshop' | 'theater' | 'ending';

/** Cibles disponibles pour le téléport debug. */
export type BackstageStart =
  | 'corridor'
  | 'regie'
  | 'regie-unlocked'
  | 'workshop'
  | 'theater';

export class BackstageRoom extends Room {
  private deps: RoomDeps;
  private phase: BackstagePhase = 'corridor';
  private phaseTime = 0;

  // Builds
  private corridor: CorridorBuild | null = null;
  private monitorWall: MonitorWallBuild | null = null;
  private vhsShelf: VHSShelfBuild | null = null;
  private vcr: VCRBuild | null = null;
  private workshop: PuppetWorkshopBuild | null = null;
  private theater: AudienceTheaterBuild | null = null;
  private projector: BigScreenBuild | null = null;
  private stalker: StalkerPuppet | null = null;
  private hemi: HemisphereLight | null = null;
  private ambient: AmbientLight | null = null;
  private endCard: EndChapterCard | null = null;
  /** Lampes ON/OFF — la régie démarre dans le noir, l'interrupteur boost tout. */
  private lightsOn = false;
  private switchLever: Mesh | null = null;
  private switchLED: Mesh | null = null;
  /** Halo PointLight vert autour de l'interrupteur (off une fois allumé). */
  private switchHaloLight: PointLight | null = null;
  /** Meshes "signal" (plaque émissive + flèche) à éteindre une fois allumé. */
  private switchHaloGroup: Mesh[] = [];
  /** Lumières conditionnelles (créées au build, activées par l'interrupteur). */
  private regieCeilingLight: PointLight | null = null;
  private regieCeilingPanel: Mesh | null = null;
  private workshopCeilingLight: PointLight | null = null;
  /** Lampes d'appoint allumées par l'interrupteur (régie + atelier + couloir). */
  private extraLights: PointLight[] = [];
  /** Meshes "néon plafond" supplémentaires à rendre émissifs à l'allumage. */
  private extraEmissivePanels: Mesh[] = [];

  // State général
  private interactables: Interactable[] = [];
  /** Cassette tenue par le joueur (null si rien). */
  private heldCassette: VHSCassette | null = null;
  /** Cassettes déjà insérées (pour ne pas répéter). */
  private playedCassettes = new Set<number>();
  /** True quand la cassette N°44 a été insérée. */
  private keyInserted = false;
  /** Compte le nombre total d'insertions (pour le subtitle 5/6). */
  private insertCount = 0;
  /** Cooldown sons néon. */
  private flickerSfxCooldown = 0;
  /** Indique si la porte vers l'atelier est passable. */
  private workshopUnlocked = false;
  /** Cooldown des pas du stalker. */
  private stalkerStepCooldown = 0;
  /** Cooldown des resets du stalker (anti spam). */
  private stalkerResetCooldown = 0;
  /** Compte des resets pour subtitle. */
  private stalkerResetCount = 0;
  /** Pulse de blackout après reset. */
  private blackoutTimer = 0;
  /** Step de la cinématique finale (théâtre → fin chapitre). */
  private finalStep = 0;
  /** Position de départ de la cinématique. */
  private hasShownEndCard = false;
  /** Marque la position du z séparation entre les phases (mur entre les zones). */
  private readonly zCorridorToRegie = 9;
  private readonly zRegieToWorkshop = 3;
  private readonly zWorkshopToTheater = -3;

  // ----- Subtitles d'ambiance déjà joués (one-shot) -----
  private flagCorridor2 = false;
  private flagCorridor10 = false;
  private flagRegieHello = false;
  private flagWorkshopFirst = false;

  /** Cible de démarrage (téléport debug). */
  private startAt: BackstageStart;

  constructor(deps: RoomDeps, opts: { startAt?: BackstageStart } = {}) {
    super();
    this.deps = deps;
    this.startAt = opts.startAt ?? 'corridor';
    this.build();
    // Override spawn selon startAt
    this.applySpawnForStart();
  }

  private applySpawnForStart(): void {
    switch (this.startAt) {
      case 'corridor':
        this.spawnPosition.set(0, 1.65, 16);
        this.spawnYaw = 0;
        break;
      case 'regie':
      case 'regie-unlocked':
        this.spawnPosition.set(0, 1.65, 7.5);
        this.spawnYaw = 0;
        break;
      case 'workshop':
        this.spawnPosition.set(0, 1.65, 2.5);
        this.spawnYaw = 0;
        break;
      case 'theater':
        this.spawnPosition.set(0, 1.65, -3.5);
        this.spawnYaw = 0;
        break;
    }
    this.spawnPitch = 0;
  }

  private build(): void {
    // ----- Lumières ambiantes : assez basses pour ne pas tout révéler,
    // mais le joueur peut quand même se repérer. L'interrupteur les boostera.
    this.hemi = new HemisphereLight(new Color('#5a3540'), new Color('#0a0a0c'), 1.1);
    this.group.add(this.hemi);
    this.ambient = new AmbientLight(new Color('#3a2030'), 0.85);
    this.group.add(this.ambient);

    // ----- Veilleuse rouge sang qui éclaire vaguement la régie en permanence
    const baseGlow = new PointLight(new Color('#c04020'), 10, 12, 1.4);
    baseGlow.position.set(0, 2.7, 6);
    this.group.add(baseGlow);
    // Petite veilleuse couloir aussi (sinon trop noir pour arriver jusqu'au switch)
    const corridorGlow = new PointLight(new Color('#8a2a20'), 6, 10, 1.4);
    corridorGlow.position.set(0, 2.4, 13);
    this.group.add(corridorGlow);

    // ----- Panneau néon plafond régie (éteint au début, allumé via interrupteur)
    this.regieCeilingPanel = new Mesh(
      new BoxGeometry(2.4, 0.08, 0.5),
      flatToon({
        color: '#e8e2d0',
        emissive: '#f4e9d8',
        emissiveIntensity: 0,
        roughness: 0.4,
      }),
    );
    this.regieCeilingPanel.position.set(0, 2.95, 6);
    this.group.add(this.regieCeilingPanel);
    this.regieCeilingLight = new PointLight(new Color('#f4e9d8'), 0, 12, 1.4);
    this.regieCeilingLight.position.set(0, 2.85, 6);
    this.group.add(this.regieCeilingLight);
    // Atelier : même chose, panel pré-existant (les lampes rouge/verte) mais on
    // ajoute un éclairage central qui se déclenchera aussi via l'interrupteur.
    this.workshopCeilingLight = new PointLight(new Color('#f4e9d8'), 0, 18, 1.2);
    this.workshopCeilingLight.position.set(0, 3.0, 0);
    this.group.add(this.workshopCeilingLight);

    // ----- Lampes d'appoint (éteintes au start, allumées via interrupteur) -----
    // Plusieurs PointLights distribuées pour vraiment voir clair une fois on.
    const addExtra = (x: number, y: number, z: number, color: string, dist: number) => {
      const l = new PointLight(new Color(color), 0, dist, 1.2);
      l.position.set(x, y, z);
      this.group.add(l);
      this.extraLights.push(l);
    };
    // Régie (3 lampes : entrée, centre, fond)
    addExtra(-1.5, 2.85, 7.5, '#f4e9d8', 14);
    addExtra(1.5, 2.85, 7.5, '#f4e9d8', 14);
    addExtra(0, 2.85, 4.0, '#f4e9d8', 14);
    // Couloir (3 lampes le long du Z+)
    addExtra(0, 2.45, 11, '#fbeed0', 12);
    addExtra(0, 2.45, 13.5, '#fbeed0', 12);
    addExtra(0, 2.45, 15.8, '#fbeed0', 12);
    // Atelier (2 lampes supplémentaires)
    addExtra(-1.6, 2.85, 0.6, '#f4e9d8', 14);
    addExtra(1.6, 2.85, -0.6, '#f4e9d8', 14);
    // Néons "panel" supplémentaires émissifs sur le plafond régie (visibilité)
    const panelMat1 = flatToon({
      color: '#e8e2d0',
      emissive: '#f4e9d8',
      emissiveIntensity: 0,
      roughness: 0.4,
    });
    const panel1 = new Mesh(new BoxGeometry(1.6, 0.05, 0.35), panelMat1);
    panel1.position.set(-1.5, 2.95, 7.5);
    this.group.add(panel1);
    this.extraEmissivePanels.push(panel1);
    const panel2 = new Mesh(new BoxGeometry(1.6, 0.05, 0.35), panelMat1.clone());
    panel2.position.set(1.5, 2.95, 7.5);
    this.group.add(panel2);
    this.extraEmissivePanels.push(panel2);

    // Sol "passerelle" de la régie (X[-3, +3] Z[3, 9]) — sol neutre
    const regieFloor = new Mesh(
      new PlaneGeometry(6, 6),
      flatToon({ color: '#2a2424', roughness: 1.0 }),
    );
    regieFloor.rotation.x = -Math.PI / 2;
    regieFloor.position.set(0, 0, 6);
    this.group.add(regieFloor);
    // Plafond régie
    const regieCeil = new Mesh(
      new PlaneGeometry(6, 6),
      flatToon({ color: '#0a0a0a', roughness: 1.0 }),
    );
    regieCeil.rotation.x = Math.PI / 2;
    regieCeil.position.set(0, 3, 6);
    this.group.add(regieCeil);
    // Murs régie (gauche, droite, fond)
    const wallMat = flatToon({ color: '#3a302a', roughness: 1.0 });
    const wL = new Mesh(new PlaneGeometry(6, 3), wallMat);
    wL.rotation.y = Math.PI / 2;
    wL.position.set(-3, 1.5, 6);
    this.group.add(wL);
    const wR = new Mesh(new PlaneGeometry(6, 3), wallMat);
    wR.rotation.y = -Math.PI / 2;
    wR.position.set(3, 1.5, 6);
    this.group.add(wR);
    // Mur séparation régie/atelier (avec porte) — on dessine 2 plans qui
    // laissent une ouverture au milieu (X[-0.9, +0.9])
    const wallMatSep = flatToon({ color: '#3a302a', roughness: 1.0 });
    const wB_L = new Mesh(new PlaneGeometry(2.1, 3), wallMatSep);
    wB_L.position.set(-1.95, 1.5, this.zRegieToWorkshop);
    // Face vers +Z (vers le joueur qui est côté corridor) — pas de rotation
    this.group.add(wB_L);
    const wB_R = new Mesh(new PlaneGeometry(2.1, 3), wallMatSep);
    wB_R.position.set(1.95, 1.5, this.zRegieToWorkshop);
    this.group.add(wB_R);
    // Linteau au-dessus de la porte régie/atelier
    const lintel = new Mesh(
      new PlaneGeometry(1.8, 0.4),
      flatToon({ color: '#1a1612', roughness: 1.0 }),
    );
    lintel.position.set(0, 2.6, this.zRegieToWorkshop);
    this.group.add(lintel);

    // ----- Corridor (z=9..17) -----
    const corridor = buildBackstageCorridor();
    this.corridor = corridor;
    this.group.add(corridor.group);

    // ----- Interrupteur mural (entrée de la régie, côté droit) -----
    // Volontairement OVER-DESIGNED pour qu'on le repère même dans le noir :
    // grosse plaque émissive vert toxique + flèche peinte au-dessus + LED
    // rouge énorme qui clignote + halo PointLight local.
    // Position : côté droit, juste après le seuil du corridor → régie.
    const SW_X = 2.93;
    const SW_Y = 1.45;
    const SW_Z = 8.40;
    // Plaque arrière émissive (signal "interagis avec moi")
    const switchPlate = new Mesh(
      new BoxGeometry(0.46, 0.62, 0.012),
      flatToon({
        color: '#e8e2d0',
        emissive: '#9af0a8',
        emissiveIntensity: 0.95,
        roughness: 0.6,
      }),
    );
    switchPlate.position.set(2.985, SW_Y, SW_Z);
    switchPlate.rotation.y = -Math.PI / 2;
    this.group.add(switchPlate);
    // Cadre noir contrasté autour de la plaque (relief)
    const switchFrame = new Mesh(
      new BoxGeometry(0.50, 0.66, 0.022),
      flatToon({ color: '#0a0a0a', roughness: 0.5 }),
    );
    switchFrame.position.set(2.978, SW_Y, SW_Z);
    switchFrame.rotation.y = -Math.PI / 2;
    this.group.add(switchFrame);
    // Boîtier interrupteur (centre de la plaque)
    const switchBox = new Mesh(
      new BoxGeometry(0.22, 0.30, 0.06),
      flatToon({ color: '#1a1a1a', roughness: 0.5 }),
    );
    switchBox.position.set(2.965, SW_Y, SW_Z);
    switchBox.rotation.y = -Math.PI / 2;
    this.group.add(switchBox);
    // Levier (incliné vers le bas = OFF) — plus gros pour qu'on le voie
    this.switchLever = new Mesh(
      new BoxGeometry(0.07, 0.16, 0.05),
      flatToon({
        color: '#f4e9d8',
        emissive: '#f4e9d8',
        emissiveIntensity: 0.35,
        roughness: 0.4,
      }),
    );
    this.switchLever.position.set(2.92, SW_Y - 0.04, SW_Z);
    this.switchLever.rotation.y = -Math.PI / 2;
    this.switchLever.rotation.x = -0.55;
    this.group.add(this.switchLever);
    // LED rouge clignotante (plus grosse + animée dans update)
    this.switchLED = new Mesh(
      new BoxGeometry(0.06, 0.06, 0.012),
      flatToon({
        color: '#5a0808',
        emissive: '#ff2010',
        emissiveIntensity: 2.4,
        roughness: 0.5,
      }),
    );
    this.switchLED.position.set(2.93, SW_Y + 0.22, SW_Z);
    this.switchLED.rotation.y = -Math.PI / 2;
    this.group.add(this.switchLED);
    // Halo lumineux local pour qu'on repère même de loin
    this.switchHaloLight = new PointLight(new Color('#9af0a8'), 0.75, 3.5, 1.6);
    this.switchHaloLight.position.set(2.7, SW_Y, SW_Z);
    this.group.add(this.switchHaloLight);
    // Flèche peinte au-dessus de la plaque, pointant vers le bas (≈ panneau "ici")
    const arrowMat = flatToon({
      color: '#0a0a0a',
      emissive: '#ffd23f',
      emissiveIntensity: 0.9,
      roughness: 0.7,
    });
    const arrowShaft = new Mesh(new BoxGeometry(0.04, 0.28, 0.005), arrowMat);
    arrowShaft.position.set(2.99, SW_Y + 0.50, SW_Z);
    arrowShaft.rotation.y = -Math.PI / 2;
    this.group.add(arrowShaft);
    const arrowHeadL = new Mesh(new BoxGeometry(0.04, 0.10, 0.005), arrowMat);
    arrowHeadL.position.set(2.99, SW_Y + 0.36, SW_Z - 0.07);
    arrowHeadL.rotation.y = -Math.PI / 2;
    arrowHeadL.rotation.x = 0.85;
    this.group.add(arrowHeadL);
    const arrowHeadR = new Mesh(new BoxGeometry(0.04, 0.10, 0.005), arrowMat);
    arrowHeadR.position.set(2.99, SW_Y + 0.36, SW_Z + 0.07);
    arrowHeadR.rotation.y = -Math.PI / 2;
    arrowHeadR.rotation.x = -0.85;
    this.group.add(arrowHeadR);
    // Stockage pour pouvoir faire disparaître le marker à l'allumage
    this.switchHaloGroup = [switchPlate, arrowShaft, arrowHeadL, arrowHeadR];

    // ----- Doorway corridor → régie (raccord visuel) -----
    // Le corridor fait 3m de large × 2.5m de haut. La régie fait 6m × 3m.
    // On dessine 2 panneaux latéraux à z=9 qui couvrent l'écart de largeur,
    // + un linteau au-dessus pour cacher le saut de hauteur.
    const doorwayMat = flatToon({ color: '#2a2422', roughness: 1.0 });
    const dwL = new Mesh(new PlaneGeometry(1.5, 3), doorwayMat);
    dwL.position.set(-2.25, 1.5, 9);
    this.group.add(dwL);
    const dwR = new Mesh(new PlaneGeometry(1.5, 3), doorwayMat);
    dwR.position.set(2.25, 1.5, 9);
    this.group.add(dwR);
    // Linteau (au-dessus de l'ouverture)
    const dwTop = new Mesh(new PlaneGeometry(3, 0.5), doorwayMat);
    dwTop.position.set(0, 2.75, 9);
    this.group.add(dwTop);
    // Petit panneau qui éclaire faiblement le seuil (vert toxique)
    const exitSign = new Mesh(
      new PlaneGeometry(0.5, 0.18),
      flatToon({
        color: '#1a1612',
        emissive: '#3a9a3a',
        emissiveIntensity: 0.9,
        roughness: 0.6,
      }),
    );
    exitSign.position.set(0, 2.55, 9.01);
    this.group.add(exitSign);

    // ----- Mur de moniteurs (régie) -----
    // Placé sur le mur séparation atelier, côté GAUCHE (x[-3, -0.9]).
    // Face vers +Z pour que le joueur les voie en arrivant du corridor.
    const wall = buildMonitorWall(this.deps.webcamVideo);
    this.monitorWall = wall;
    wall.group.position.set(-1.95, 1.7, this.zRegieToWorkshop + 0.18);
    this.group.add(wall.group);

    // ----- Étagère VHS + cassettes -----
    // Sur le MUR DROIT (x = +3), face vers -X (centre de la régie).
    const shelf = buildVHSShelf();
    this.vhsShelf = shelf;
    shelf.group.position.set(2.85, 1.4, 5.5);
    shelf.group.rotation.y = -Math.PI / 2;
    this.group.add(shelf.group);

    // ----- Magnétoscope -----
    // Sur une console au CENTRE-AVANT de la régie, face vers +Z (joueur arrive
    // du corridor et le voit). Console basse pour ne pas masquer les moniteurs.
    const vcr = buildVCRMachine();
    this.vcr = vcr;
    vcr.group.position.set(0, 0.85, 5.0);
    // Pas de rotation : la fente est en local +Z → face joueur arrivant du +Z
    // Petit support sous le VCR
    const stand = new Mesh(
      new BoxGeometry(1.0, 0.85, 0.55),
      flatToon({ color: '#2a2010', roughness: 1.0 }),
    );
    stand.position.set(0, 0.42, 5.0);
    this.group.add(stand);
    this.group.add(vcr.group);

    // ----- Atelier (z=-3..3) -----
    const workshop = buildPuppetWorkshop();
    this.workshop = workshop;
    this.group.add(workshop.group);
    // Stalker (caché)
    this.stalker = new StalkerPuppet();
    this.group.add(this.stalker.group);

    // ----- Théâtre (z=-13..-3) -----
    const theater = buildAudienceTheater();
    this.theater = theater;
    this.group.add(theater.group);
    // Projecteur derrière le joueur (à l'entrée du théâtre, en hauteur)
    const projector = buildBigScreenProjector(
      this.deps.webcamVideo,
      { x: theater.screenAnchor.x, y: theater.screenAnchor.y, z: theater.screenAnchor.z },
      { x: 0, y: 3.2, z: -3.2 },
    );
    this.projector = projector;
    this.group.add(projector.group);

    // Mur séparation atelier/théâtre — porte ouverte au centre, et un cache
    // latéral qui ferme le jonction (atelier x=±3.5 vs théâtre x=±5.5)
    const sepMat = flatToon({ color: '#1a0a18', roughness: 1.0 });
    const wT_L = new Mesh(new PlaneGeometry(2.4, 3.2), sepMat);
    wT_L.position.set(-2.3, 1.6, this.zWorkshopToTheater);
    this.group.add(wT_L);
    const wT_R = new Mesh(new PlaneGeometry(2.4, 3.2), sepMat);
    wT_R.position.set(2.3, 1.6, this.zWorkshopToTheater);
    this.group.add(wT_R);
    const wT_Top = new Mesh(new PlaneGeometry(1.8, 0.4), sepMat);
    wT_Top.position.set(0, 3.0, this.zWorkshopToTheater);
    this.group.add(wT_Top);
    // Caches latéraux entre atelier (x±3.5) et théâtre (x±5.5)
    const sideMat = flatToon({ color: '#0a0a0c', roughness: 1.0 });
    const sideL = new Mesh(new PlaneGeometry(2.0, 3.5), sideMat);
    sideL.position.set(-4.5, 1.75, this.zWorkshopToTheater);
    this.group.add(sideL);
    const sideR = new Mesh(new PlaneGeometry(2.0, 3.5), sideMat);
    sideR.position.set(4.5, 1.75, this.zWorkshopToTheater);
    this.group.add(sideR);

    // ----- Colliders -----
    this.colliders = [];
    if (corridor) this.colliders.push(...corridor.colliders);
    // Régie : murs gauche/droite uniquement (entrée libre depuis le corridor à z=9)
    // + séparation atelier (porte de 1.8m au milieu).
    this.colliders.push(
      // Mur gauche x=-3
      new Box3(new Vector3(-3.2, 0, 3), new Vector3(-3, 3, 9.2)),
      // Mur droit x=+3
      new Box3(new Vector3(3, 0, 3), new Vector3(3.2, 3, 9.2)),
      // Séparation Régie/Atelier (avec porte au centre)
      new Box3(new Vector3(-3.2, 0, this.zRegieToWorkshop - 0.1), new Vector3(-0.9, 3, this.zRegieToWorkshop + 0.1)),
      new Box3(new Vector3(0.9, 0, this.zRegieToWorkshop - 0.1), new Vector3(3.2, 3, this.zRegieToWorkshop + 0.1)),
      // VHS shelf (mur droit, z=[4.85, 6.15])
      new Box3(new Vector3(2.6, 1.1, 4.85), new Vector3(3.0, 1.8, 6.15)),
      // Console VCR (centre régie)
      new Box3(new Vector3(-0.55, 0, 4.70), new Vector3(0.55, 1.05, 5.30)),
    );
    if (workshop) {
      this.colliders.push(...workshop.colliders);
      // Mur séparation atelier/théâtre + caches latéraux
      this.colliders.push(
        new Box3(new Vector3(-3.5, 0, this.zWorkshopToTheater - 0.1), new Vector3(-0.9, 3, this.zWorkshopToTheater + 0.1)),
        new Box3(new Vector3(0.9, 0, this.zWorkshopToTheater - 0.1), new Vector3(3.5, 3, this.zWorkshopToTheater + 0.1)),
        // Caches latéraux
        new Box3(new Vector3(-5.5, 0, this.zWorkshopToTheater - 0.1), new Vector3(-3.5, 3.5, this.zWorkshopToTheater + 0.1)),
        new Box3(new Vector3(3.5, 0, this.zWorkshopToTheater - 0.1), new Vector3(5.5, 3.5, this.zWorkshopToTheater + 0.1)),
      );
      // Porte ATELIER initialement BLOQUÉE (au milieu) — sera retirée à keyInserted
      this.workshopBlockIndex = this.colliders.length;
      this.colliders.push(
        new Box3(new Vector3(-0.95, 0, this.zRegieToWorkshop - 0.1), new Vector3(0.95, 3, this.zRegieToWorkshop + 0.1)),
      );
    }
    if (theater) this.colliders.push(...theater.colliders);

    // ----- Spawn : à l'entrée du corridor (z=16), face à la régie (yaw=0 → -Z) -----
    this.spawnPosition.set(0, 1.65, 16);
    this.spawnYaw = 0;
    this.spawnPitch = 0;

    // ----- Fog / background -----
    if (this.deps.scene.fog instanceof Fog) {
      this.deps.scene.fog.color.set('#0c0a0e');
      this.deps.scene.fog.near = 3;
      this.deps.scene.fog.far = 16;
    }
    this.deps.scene.background = new Color('#040405');

    this.refreshInteractables();
  }

  /** Index dans this.colliders du blocage milieu vers atelier. */
  private workshopBlockIndex = -1;

  override onEnter(): void {
    // Mode HUD coulisses (cache ON AIR/AUDIMAT)
    this.deps.hud.setAmbientMode('backstage');
    // Désactive le smile meter (libération apparente)
    this.deps.smileMeter.setActive(false);
    // Ambiance audio backstage
    this.deps.audio.switchAmbience('backstage');

    switch (this.startAt) {
      case 'corridor':
        setTimeout(() => {
          this.deps.hud.setSubtitle('(Tu ne devrais pas être ici.)', 3.5);
        }, 600);
        setTimeout(() => {
          this.deps.hud.setSubtitle('(Une LED rouge clignote tout au bout du couloir.)', 4);
        }, 4800);
        break;
      case 'regie':
        this.phase = 'regie';
        this.flagRegieHello = true;
        setTimeout(() => {
          this.deps.hud.setSubtitle('(Un interrupteur clignote à ta droite.)', 4);
        }, 400);
        this.refreshInteractables();
        break;
      case 'regie-unlocked':
        // Régie avec porte atelier déjà ouverte, lumières on
        this.toggleLights();
        this.phase = 'regie';
        this.flagRegieHello = true;
        this.keyInserted = true;
        if (this.vcr) this.vcr.setPlaying(true);
        if (this.monitorWall) this.monitorWall.showWebcam();
        this.unlockWorkshopDoor();
        setTimeout(() => {
          this.deps.hud.setSubtitle('(La porte du fond est ouverte.)', 3.5);
        }, 400);
        this.refreshInteractables();
        break;
      case 'workshop':
        this.toggleLights();
        this.keyInserted = true;
        this.unlockWorkshopDoor();
        if (this.vcr) this.vcr.setPlaying(true);
        if (this.monitorWall) this.monitorWall.showWebcam();
        // Active la phase workshop sans passer par enterWorkshop (pas de ctx)
        this.phase = 'workshop';
        this.flagWorkshopFirst = true;
        if (this.stalker && this.workshop) {
          this.stalker.setVisible(true);
          this.stalker.setPosition(this.workshop.stalkerSpawn.clone());
        }
        setTimeout(() => {
          this.deps.hud.setSubtitle('(Ne le quitte pas des yeux.)', 4);
        }, 400);
        this.refreshInteractables();
        break;
      case 'theater':
        this.toggleLights();
        this.keyInserted = true;
        this.unlockWorkshopDoor();
        if (this.vcr) this.vcr.setPlaying(true);
        if (this.monitorWall) this.monitorWall.showWebcam();
        this.phase = 'theater';
        this.finalStep = 0;
        this.phaseTime = 0;
        if (this.stalker) this.stalker.setVisible(false);
        this.deps.hud.setAmbientMode('final');
        this.deps.setCinematicCamera(new Vector3(0, 1.65, -4.0), 0.85, 0);
        break;
    }
  }

  private refreshInteractables(): void {
    this.interactables = [];
    // Interrupteur — disponible dès le couloir et tant que la lumière n'est
    // pas allumée (one-shot). Position à hauteur d'yeux + radius généreux.
    if (!this.lightsOn && this.switchLever) {
      this.interactables.push({
        position: new Vector3(2.85, 1.60, 8.45),
        radius: 1.1,
        label: 'Allumer la lumière',
        enabled: this.phase === 'corridor' || this.phase === 'regie',
        onInteract: () => this.toggleLights(),
      });
    }
    // Cassettes : interactables tant qu'elles ne sont pas prises (et que le
    // joueur n'en tient pas déjà une)
    if (this.vhsShelf && !this.heldCassette) {
      for (const c of this.vhsShelf.cassettes) {
        if (!c.picked) {
          const worldPos = c.group.getWorldPosition(new Vector3());
          this.interactables.push({
            position: worldPos,
            radius: 0.7,
            label: `Prendre ${c.label.split(' - ')[1]}`,
            enabled: this.phase === 'regie',
            onInteract: () => this.takeCassette(c),
          });
        }
      }
    }
    // VCR
    if (this.vcr && this.heldCassette) {
      const worldPos = this.vcr.group.getWorldPosition(new Vector3());
      worldPos.y = 1.0;
      this.interactables.push({
        position: worldPos,
        radius: 1.0,
        label: 'Insérer la cassette',
        enabled: this.phase === 'regie',
        onInteract: () => this.insertCassette(),
      });
    }
  }

  // ============== Interrupteur ==============
  private toggleLights(): void {
    if (this.lightsOn) return;
    this.lightsOn = true;
    // Bascule visuelle du levier (vers le haut = ON)
    if (this.switchLever) this.switchLever.rotation.x = 0.45;
    // LED passe au vert
    if (this.switchLED) {
      const mat = this.switchLED.material as MeshStandardMaterial;
      mat.color.set('#0a3a0a');
      mat.emissive.set('#3aff4a');
      mat.emissiveIntensity = 2.6;
    }
    // Éteint le halo + la plaque/flèche "signal" autour de l'interrupteur
    if (this.switchHaloLight) this.switchHaloLight.intensity = 0;
    for (const m of this.switchHaloGroup) {
      const mat = m.material as MeshStandardMaterial;
      mat.emissiveIntensity = 0;
    }
    // ===== BOOST MASSIF DE TOUTES LES LUMIÈRES =====
    // Three.js r155+ utilise des unités photométriques : il faut être généreux.
    if (this.hemi) {
      this.hemi.intensity = 3.2;
      this.hemi.color.set('#fff0d8');
      this.hemi.groundColor.set('#3a2820');
    }
    if (this.ambient) {
      this.ambient.intensity = 1.6;
      this.ambient.color.set('#fbeed0');
    }
    // Néons plafond régie + atelier
    if (this.regieCeilingLight) this.regieCeilingLight.intensity = 28;
    if (this.regieCeilingPanel) {
      const mat = this.regieCeilingPanel.material as MeshStandardMaterial;
      mat.emissiveIntensity = 2.2;
    }
    if (this.workshopCeilingLight) this.workshopCeilingLight.intensity = 22;
    // Lampes d'appoint réparties (régie + couloir + atelier)
    for (const l of this.extraLights) l.intensity = 14;
    for (const p of this.extraEmissivePanels) {
      const mat = p.material as MeshStandardMaterial;
      mat.emissiveIntensity = 1.8;
    }
    // Petit "clack" + crépitement de néon qui s'amorce
    this.deps.audio.fluorescentFlicker();
    setTimeout(() => this.deps.audio.fluorescentFlicker(), 220);
    setTimeout(() => this.deps.audio.fluorescentFlicker(), 460);
    // Flash blanc bref pour confirmer visuellement que ça vient de s'allumer
    this.deps.postFX.pulse(1.0, 0.45);
    // Sub
    this.deps.hud.setSubtitle('(La lumière jaillit. Tu vois mieux. Tu vois trop.)', 3.5);
    this.refreshInteractables();
  }

  getInteractables(): Interactable[] {
    return this.interactables;
  }

  // ============== Interactions ==============

  private takeCassette(c: VHSCassette): void {
    if (c.picked || this.heldCassette) return;
    c.picked = true;
    c.group.visible = false;
    this.heldCassette = c;
    this.deps.hud.setInventoryItem(c.label.split(' - ')[1]);
    this.deps.audio.glitchSting(0.15);
    this.refreshInteractables();
  }

  private insertCassette(): void {
    if (!this.heldCassette || !this.vcr) return;
    const c = this.heldCassette;
    this.heldCassette = null;
    this.deps.hud.setInventoryItem(null);
    this.deps.audio.vhsInsert();
    this.insertCount++;
    this.playedCassettes.add(c.index);
    // Petit délai puis playback
    setTimeout(() => {
      if (!this.vcr || !this.monitorWall) return;
      this.vcr.setPlaying(true);
      this.deps.audio.vhsPlay();
      this.deps.hud.setSubtitle(c.subtitle, 4.5);
      // Effet visuel : les écrans clignotent
      this.monitorWall.showStatic();
      setTimeout(() => {
        this.monitorWall?.update(performance.now() / 1000);
      }, 200);
      // Si la cassette est la clé (N°44), déclenche la révélation
      if (c.isKey) {
        setTimeout(() => this.triggerKeyReveal(), 1800);
      } else {
        // Sinon : on rejoue silent puis on remet une face d'enfant
        setTimeout(() => {
          if (this.monitorWall) {
            // Restaure les visages
            for (const m of this.monitorWall.monitors) {
              m.crtMat.setMap(m.childTex);
              m.state = 'face';
            }
            this.vcr?.setPlaying(false);
          }
          // Indique au joueur qu'il manque encore quelque chose
          if (this.insertCount === 5 && !this.keyInserted) {
            setTimeout(() => {
              this.deps.hud.setSubtitle('(Une cassette n\'a pas encore été lue.)', 3.5);
            }, 1500);
          }
        }, 5500);
      }
    }, 700);
    this.refreshInteractables();
  }

  private triggerKeyReveal(): void {
    if (!this.monitorWall || !this.vcr) return;
    this.keyInserted = true;
    // Tous les écrans → webcam joueur
    this.monitorWall.showWebcam();
    this.deps.audio.glitchSting(1.0);
    this.deps.postFX.pulse(1.0, 0.5);
    this.deps.hud.setSubtitle("M. SOURIRE : Tu es notre n°44.", 3.5);
    setTimeout(() => {
      this.deps.hud.setSubtitle("(La porte du fond claque. Elle s'ouvre.)", 3.0);
      this.deps.audio.doorOpen();
      this.unlockWorkshopDoor();
    }, 2400);
    // Le VCR reste sur "playing" tout le reste de la régie
  }

  private unlockWorkshopDoor(): void {
    if (this.workshopBlockIndex >= 0 && this.workshopBlockIndex < this.colliders.length) {
      // Remplace par une boîte vide (collider qui ne touche rien)
      this.colliders[this.workshopBlockIndex] = new Box3(
        new Vector3(0, -100, 0),
        new Vector3(0.01, -99, 0.01),
      );
      this.workshopUnlocked = true;
    }
  }

  // ============== Update principal ==============

  update(dt: number, ctx: RoomUpdateContext): void {
    this.phaseTime += dt;
    const time = ctx.time;

    // Anims des moniteurs / projector
    this.monitorWall?.update(time);
    this.projector?.update(time);

    // LED + halo de l'interrupteur : pulsent tant que la lumière n'est pas
    // allumée. Pulse rapide pour bien attirer l'œil.
    if (!this.lightsOn) {
      const pulse = 0.5 + 0.5 * Math.max(0, Math.sin(time * 3.2));
      if (this.switchLED) {
        const mat = this.switchLED.material as MeshStandardMaterial;
        mat.emissiveIntensity = 1.2 + pulse * 2.4;
      }
      if (this.switchHaloLight) {
        this.switchHaloLight.intensity = 0.55 + pulse * 0.85;
      }
      // Plaque émissive + flèche : pulsent doucement aussi
      for (let i = 0; i < this.switchHaloGroup.length; i++) {
        const mat = this.switchHaloGroup[i].material as MeshStandardMaterial;
        const base = i === 0 ? 0.65 : 0.7; // plaque un peu plus calme, flèches plus vives
        mat.emissiveIntensity = base + pulse * 0.55;
      }
    }

    // Anime corridor (néons défaillants)
    this.flickerSfxCooldown -= dt;
    if (this.corridor) {
      animateCorridor(this.corridor, time, dt, () => {
        if (this.flickerSfxCooldown <= 0) {
          this.deps.audio.fluorescentFlicker();
          this.flickerSfxCooldown = 0.7 + Math.random() * 1.5;
        }
      });
    }

    // Anime silhouettes théâtre
    if (this.theater) animateAudienceTheater(this.theater, time);

    // Détection de phase par z du joueur
    const z = ctx.playerPosition.z;
    if (this.phase === 'corridor' && z < this.zCorridorToRegie + 0.5) {
      this.enterRegie();
    } else if (
      this.phase === 'regie' &&
      this.workshopUnlocked &&
      z < this.zRegieToWorkshop + 0.5
    ) {
      this.enterWorkshop(ctx);
    } else if (
      this.phase === 'workshop' &&
      z < this.zWorkshopToTheater + 0.5
    ) {
      this.enterTheater(ctx);
    }

    // Mise à jour par phase
    switch (this.phase) {
      case 'corridor':
        this.updateCorridor(dt);
        break;
      case 'regie':
        this.updateRegie(dt);
        break;
      case 'workshop':
        this.updateWorkshop(dt, ctx);
        break;
      case 'theater':
        this.updateTheater(dt, ctx);
        break;
      case 'ending':
        this.updateEnding(dt, ctx);
        break;
    }

    // Refresh interactables si le joueur tient/lâche une cassette
    if (this.phase === 'regie') this.refreshInteractables();
  }

  // ----- Phase A : Corridor -----
  private updateCorridor(_dt: number): void {
    if (!this.flagCorridor2 && this.phaseTime >= 2) {
      this.flagCorridor2 = true;
      this.deps.hud.setSubtitle('(Le silence est différent ici.)', 3.5);
    }
    if (!this.flagCorridor10 && this.phaseTime >= 10) {
      this.flagCorridor10 = true;
      this.deps.hud.setSubtitle('(Quelque chose grogne dans les murs.)', 3.5);
    }
  }

  // ----- Transitions -----
  private enterRegie(): void {
    this.phase = 'regie';
    this.phaseTime = 0;
    if (!this.flagRegieHello) {
      this.flagRegieHello = true;
      // Priorité absolue : pointer l'interrupteur si la lumière est encore éteinte.
      if (!this.lightsOn) {
        setTimeout(() => {
          this.deps.hud.setSubtitle('(Un interrupteur clignote à ta droite. Allume.)', 4);
        }, 600);
        setTimeout(() => {
          this.deps.hud.setSubtitle("(Le mur de moniteurs. Des visages que tu n'as jamais vus.)", 4);
        }, 5200);
        setTimeout(() => {
          this.deps.hud.setSubtitle('(Essaie les cassettes. Une seule te concernera.)', 4);
        }, 9800);
      } else {
        setTimeout(() => {
          this.deps.hud.setSubtitle("(Le mur de moniteurs. Des visages que tu n'as jamais vus.)", 4);
        }, 800);
        setTimeout(() => {
          this.deps.hud.setSubtitle('(Essaie les cassettes. Une seule te concernera.)', 4);
        }, 5500);
      }
    }
    this.refreshInteractables();
  }

  private updateRegie(_dt: number): void {
    // Rien d'autre — tout est piloté par les interactions
  }

  private enterWorkshop(ctx: RoomUpdateContext): void {
    this.phase = 'workshop';
    this.phaseTime = 0;
    this.deps.hud.setInventoryItem(null);
    if (!this.flagWorkshopFirst) {
      this.flagWorkshopFirst = true;
      setTimeout(() => {
        this.deps.hud.setSubtitle('(Ne le quitte pas des yeux.)', 4);
      }, 600);
    }
    // Active le stalker à l'entrée
    if (this.stalker && this.workshop) {
      this.stalker.setVisible(true);
      this.stalker.setPosition(this.workshop.stalkerSpawn.clone());
    }
    this.refreshInteractables();
  }

  // ----- Phase C : Workshop / Stalker -----
  private updateWorkshop(dt: number, ctx: RoomUpdateContext): void {
    if (!this.stalker || !this.workshop) return;
    if (this.blackoutTimer > 0) {
      this.blackoutTimer -= dt;
      return;
    }
    // Frustum check simple : dot(playerForward, dirToStalker) > 0.5 et distance < 12m
    const playerYaw = ctx.playerYaw;
    const fwd = new Vector3(-Math.sin(playerYaw), 0, -Math.cos(playerYaw));
    const stalkerPos = this.stalker.group.position;
    const toS = new Vector3(
      stalkerPos.x - ctx.playerPosition.x,
      0,
      stalkerPos.z - ctx.playerPosition.z,
    );
    const dist = toS.length();
    let observed = false;
    if (dist > 0.01 && dist < 14) {
      toS.normalize();
      const dot = fwd.x * toS.x + fwd.z * toS.z;
      // Le stalker est observé s'il est dans le cône avant. Mais comme il
      // s'avance toujours derrière le joueur (Z plus haut), on inverse :
      // il faut explicitement se retourner pour l'observer.
      observed = dot > 0.55;
    }
    // Si le joueur tourne le dos, le stalker peut avancer
    const stepped = this.stalker.update(dt, observed, ctx.playerPosition);
    if (stepped) {
      this.stalkerStepCooldown -= dt;
      if (this.stalkerStepCooldown <= 0) {
        this.deps.audio.stalkerStep();
        this.stalkerStepCooldown = 0.20 + Math.random() * 0.12;
      }
    }
    // Reset si trop près
    this.stalkerResetCooldown -= dt;
    if (dist < this.stalker.resetDistance && this.stalkerResetCooldown <= 0) {
      this.triggerStalkerReset(ctx);
    }
  }

  private triggerStalkerReset(ctx: RoomUpdateContext): void {
    if (!this.stalker) return;
    this.stalkerResetCooldown = 1.5;
    this.stalkerResetCount++;
    this.deps.audio.screamerImpact(0.8);
    this.deps.postFX.pulse(1.0, 0.4);
    this.deps.hud.fadeTo(1, 0.05);
    this.blackoutTimer = 0.4;
    // Téléporte le stalker à 8m derrière le joueur (dans le sens opposé au déplacement)
    const playerYaw = ctx.playerYaw;
    const back = new Vector3(Math.sin(playerYaw), 0, Math.cos(playerYaw)); // -fwd
    const target = new Vector3(
      ctx.playerPosition.x + back.x * 8,
      0,
      ctx.playerPosition.z + back.z * 8,
    );
    // Clamp dans la pièce
    target.x = Math.max(-3.2, Math.min(3.2, target.x));
    target.z = Math.max(-2.5, Math.min(2.5, target.z));
    this.stalker.resetTo(target);
    // Sub
    const subtitleMsg =
      this.stalkerResetCount === 1
        ? '(Recommence. Plus vite.)'
        : this.stalkerResetCount === 2
          ? "(Il s'amuse. Continue.)"
          : '(Cours.)';
    this.deps.hud.setSubtitle(subtitleMsg, 2.5);
    // Re-fade clear après le blackout
    setTimeout(() => {
      this.deps.hud.fadeTo(0, 0.4);
    }, 400);
  }

  // ----- Phase D : Theater / Révélation -----
  private enterTheater(_ctx: RoomUpdateContext): void {
    this.phase = 'theater';
    this.phaseTime = 0;
    this.finalStep = 0;
    // Cache le stalker
    if (this.stalker) this.stalker.setVisible(false);
    // Mode HUD final (cache crosshair + prompts + inventory)
    this.deps.hud.setAmbientMode('final');
    // Caméra cinématique douce : on force le pitch à 0 (regard horizontal)
    this.deps.setCinematicCamera(new Vector3(0, 1.65, -4.0), 0.85, 0);
  }

  private updateTheater(dt: number, ctx: RoomUpdateContext): void {
    const t = this.phaseTime;
    const prev = t - dt;

    // Maintien du cinématique : le joueur tourne légèrement vers l'écran
    if (this.finalStep === 0 && t >= 2.0) {
      this.finalStep = 1;
      // Allume le projecteur
      this.projector?.setOn(true);
      this.deps.audio.projectorStart();
    }
    if (this.finalStep === 1 && t >= 4.0) {
      this.finalStep = 2;
      this.deps.hud.setSubtitle('M. SOURIRE : Bienvenue à votre première émission, n°44.', 3.8);
      this.deps.audio.hostUtterance(7, 1.0);
    }
    if (this.finalStep === 2 && t >= 8.0) {
      this.finalStep = 3;
      this.deps.hud.setSubtitle('M. SOURIRE : Asseyez-vous. Le spectacle va commencer.', 3.5);
      this.deps.audio.hostUtterance(6, 1.1);
    }
    // Lever du présentateur sombre (t=10..13)
    if (t >= 10 && t <= 13 && this.theater) {
      const progress = Math.max(0, Math.min(1, (t - 10) / 3));
      darkHostRise(this.theater, progress, ctx.playerPosition);
    }
    if (this.finalStep === 3 && t >= 10.2) {
      this.finalStep = 4;
      // Petit son de mouvement
      this.deps.audio.stalkerStep();
    }
    if (this.finalStep === 4 && t >= 12) {
      this.finalStep = 5;
      this.deps.hud.setSubtitle('M. SOURIRE : Tu as encore tellement de choses à apprendre.', 4.0);
      this.deps.audio.hostUtterance(10, 1.4);
      this.deps.postFX.pulse(0.5, 0.6);
    }
    // Fade to black + coupe son projecteur (t=14)
    if (this.finalStep === 5 && t >= 14) {
      this.finalStep = 6;
      // Cut total
      this.deps.hud.fadeTo(1, 1.0);
      this.deps.audio.switchAmbience('silent');
      this.projector?.setOn(false);
      // Coupe la musique : powerCut bref
      this.deps.audio.powerCut();
    }
    // Affiche end card (t=15.5)
    if (this.finalStep === 6 && t >= 15.5) {
      this.finalStep = 7;
      this.phase = 'ending';
      this.phaseTime = 0;
      this.showEndChapter();
    }
  }

  /** Bascule auto vers Ch3 lancée une seule fois. */
  private chapter3TransitionStarted = false;

  private updateEnding(_dt: number, _ctx: RoomUpdateContext): void {
    // Le joueur reste bloqué : on garde le cinematic offset (yaw fixe).
    // Après 6 s, on bascule sur le Chapitre 3 (Le Plateau).
    if (!this.chapter3TransitionStarted && this.phaseTime >= 6.0) {
      this.chapter3TransitionStarted = true;
      setTimeout(() => {
        this.endCard?.dispose();
        this.endCard = null;
        this.deps.requestRoomTransition(
          (d) => new PlateauRoom(d, { startAt: 'intro' }),
          900,
        );
      }, 200);
    }
  }

  private showEndChapter(): void {
    if (this.hasShownEndCard) return;
    this.hasShownEndCard = true;
    // Repère le parent du HUD pour y greffer l'EndChapterCard
    const parent = this.deps.hud.root.parentElement;
    if (parent) {
      // Cliffhanger Ch2 → Ch3
      this.endCard = new EndChapterCard(parent, 'ch2-to-ch3');
      // Petit délai après le fade pour le révéler en douceur
      setTimeout(() => this.endCard?.show(), 500);
    }
  }

  // ============== Dispose ==============

  dispose(): void {
    this.monitorWall?.dispose();
    this.projector?.dispose();
    this.stalker?.dispose();
    this.endCard?.dispose();
    this.group.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        const mat = o.material as any;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      }
    });
  }
}
