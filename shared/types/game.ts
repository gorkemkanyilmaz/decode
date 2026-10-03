export type GameMode = 'deathmatch' | 'team_hunt' | 'last_standing';

export type RoundState =
  | 'LOBBY'
  | 'COUNTDOWN'
  | 'CHOOSE_NUMBER'
  | 'PLAYING'
  | 'ROUND_END'
  | 'MATCH_END';

export type Team = 'red' | 'blue' | 'none';

export type GadgetType = 'smoke' | 'flash' | 'decoy' | 'camera' | 'binoculars';

export interface PlayerCustomization {
  color: string;
  accessory: 'fedora' | 'cap' | 'headset' | 'goggles' | 'none';
  suitColor: string;
}

export interface PlayerPublicInfo {
  id: string;
  name: string;
  team: Team;
  customization: PlayerCustomization;
  isReady: boolean;
  score: number;
  kills: number;
  deaths: number;
  lives?: number;
}

export interface ClientPlayerSnapshot {
  id: string;
  position: [number, number, number];
  rotationY: number;
  pitch: number;
  velocity: [number, number, number];
  isCrouching: boolean;
  isSprinting: boolean;
  isMoving: boolean;
  isDead: boolean;
  isSpawnProtected: boolean;
  // Forehead number is ONLY sent to clients who have verified line-of-sight / observation
  // If not visible, this is null. For self, it is always own number.
  visibleNumber: string | null;
  score: number;
  kills: number;
  deaths: number;
  team: Team;
}

export interface ActiveGadgetEffect {
  id: string;
  type: GadgetType;
  ownerId: string;
  position: [number, number, number];
  duration: number;
  startTime: number;
  radius: number;
}

export interface BoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

export interface MapObjectDefinition {
  id: string;
  type:
    | 'crate'
    | 'crate_stack'
    | 'container'
    | 'barrier'
    | 'wall'
    | 'tree'
    | 'bush'
    | 'rock'
    | 'building'
    | 'ramp'
    | 'platform'
    | 'fence'
    | 'pillar';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color?: string;
  // Server-authoritative collision bounds (AABB or oriented boxes)
  bounds: BoundingBox;
}

export interface SpawnPoint {
  position: [number, number, number];
  rotationY: number;
  team?: Team;
}
