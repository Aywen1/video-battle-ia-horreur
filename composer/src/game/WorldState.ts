export type GamePhase =
  | 'cabin'
  | 'hallway'
  | 'tower'
  | 'server'
  | 'finale'
  | 'exterior'
  | 'exterior_night'
  | 'exterior_finale'
  | 'undercore'
  | 'undercore_finale';

export class WorldState {
  phase: GamePhase = 'cabin';
  consoleChecked = false;
  badgeExamined = false;
  doorUnlocked = false;
  doorOpenProgress = 0;
  logPanelRead = false;
  hallwayEventTriggered = false;

  towerDoorUnlocked = false;
  towerDoorOpenProgress = 0;
  breakerActivated = false;
  antennaAnomalySeen = false;

  serverDoorOpen = false;
  beaconCut = false;
  finaleStarted = false;

  /** Acte 3 — extérieur */
  exteriorEntered = false;
  exteriorScreamersSeen = 0;
  emergencyExitUnlocked = false;
  exteriorStep = 0;
  exteriorMarkerRead = false;
  exteriorWreckSearched = false;
  exteriorCrossReached = false;
  exteriorRelayFixed = false;
  exteriorTrailEntered = false;
  exteriorNightStarted = false;
  exteriorShackRead = false;
  exteriorDoorOpened = false;

  /** Acte 4 — sous la balise */
  undercoreEntered = false;
  undercoreStep = 0;
  undercoreBadgesRead = false;
  undercoreTapesSeen = false;
  undercoreCorpseRead = false;
  undercoreFilamentCut = false;
  undercoreMirrorSeen = false;
  gameEnded = false;

  /** Horreur globale */
  screamersUsed = 0;
  lastScreamerTime = -999;
  playerHasSeenAnomaly = false;
  gameElapsed = 0;

  canUnlockDoor(): boolean {
    return this.consoleChecked && this.badgeExamined && !this.doorUnlocked;
  }

  isDoorOpen(): boolean {
    return this.doorOpenProgress >= 1;
  }

  canUnlockTower(): boolean {
    return this.logPanelRead && !this.towerDoorUnlocked;
  }

  canEnterServer(): boolean {
    return this.breakerActivated;
  }

  canAccessEmergencyExit(): boolean {
    return (
      !this.exteriorEntered &&
      (this.phase === 'server' || this.phase === 'finale')
    );
  }

  isExteriorPhase(): boolean {
    return (
      this.phase === 'exterior' ||
      this.phase === 'exterior_night' ||
      this.phase === 'exterior_finale'
    );
  }

  isUndercorePhase(): boolean {
    return this.phase === 'undercore' || this.phase === 'undercore_finale';
  }

  canUseScreamer(): boolean {
    const max = this.isUndercorePhase() ? 6 : this.isExteriorPhase() ? 8 : 2;
    const cooldown = this.isUndercorePhase() ? 8 : this.isExteriorPhase() ? 12 : 60;
    const elapsedOk =
      this.isUndercorePhase() || this.isExteriorPhase() || this.gameElapsed > 30;
    return (
      this.screamersUsed < max &&
      elapsedOk &&
      (this.playerHasSeenAnomaly ||
        this.isExteriorPhase() ||
        this.isUndercorePhase()) &&
      this.gameElapsed - this.lastScreamerTime > cooldown
    );
  }

  registerScreamer(): void {
    this.screamersUsed++;
    this.lastScreamerTime = this.gameElapsed;
    if (this.isExteriorPhase()) {
      this.exteriorScreamersSeen++;
    }
  }
}
