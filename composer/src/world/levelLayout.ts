import { CABIN_W } from './ObservationRoom';

/** Couloir + tour + serveur — tout au rez-de-chaussée (y = 0) */
export const HALL_OX = CABIN_W / 2;
export const HALL_LEN = 8.5;
export const HALL_HALF_Z = 1.38;
export const HALL_END_X = HALL_OX + HALL_LEN;

/** Porte cabine → couloir (alignée sur cabinWalls.ts) */
export const CABIN_DOOR_X = CABIN_W / 2 + 0.05;
export const CABIN_DOOR_HALF_Z = 0.72;

/** Porte couloir → tour */
export const TOWER_DOOR_X = HALL_END_X + 0.25;
export const TOWER_DOOR_Z = 0;
export const TOWER_DOOR_HALF_Z = 0.68;

export const TOWER_ENTRY_HALF = 3.5;
export const TOWER_ENTRY_CX = HALL_END_X + TOWER_ENTRY_HALF;
export const TOWER_ENTRY_CZ = 0;
export const TOWER_ROOM_D = 5.5;

/** Passage couloir tour → salle serveurs (mur nord) */
export const TOWER_CORRIDOR_HALF_X = 1.15;
export const TOWER_NORTH_WALL_Z =
  TOWER_ENTRY_CZ - TOWER_ROOM_D / 2;

/** Entrée couloir dans la salle serveurs (mur ouest) */
export const SERVER_ENTRANCE_X = 19;
export const SERVER_ENTRANCE_Z = -4;
export const SERVER_ENTRANCE_HALF_Z = 1.5;

export const GROUND_Y = 0;
