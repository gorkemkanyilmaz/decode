import { GameMode, RoundState, ClientPlayerSnapshot, ActiveGadgetEffect, PlayerPublicInfo, GadgetType } from '../types/game';

// Client -> Server
export type ClientMessage =
  | { type: 'CREATE_ROOM'; playerName: string; gameMode: GameMode; color: string; accessory: 'fedora' | 'cap' | 'headset' | 'goggles' | 'none' }
  | { type: 'JOIN_ROOM'; roomId: string; playerName: string; color: string; accessory: 'fedora' | 'cap' | 'headset' | 'goggles' | 'none'; team?: 'red' | 'blue' }
  | { type: 'SET_READY'; ready: boolean }
  | { type: 'START_GAME' }
  | { type: 'SELECT_NUMBER'; number: string } // Exactly 4 digits [0-9]{4}
  | {
      type: 'PLAYER_INPUT';
      seq: number;
      position: [number, number, number];
      rotationY: number;
      pitch: number;
      velocity: [number, number, number];
      isCrouching: boolean;
      isSprinting: boolean;
      isMoving: boolean;
    }
  | {
      type: 'ELIMINATION_ATTEMPT';
      targetId: string;
      guessedNumber: string;
    }
  | {
      type: 'USE_GADGET';
      gadget: GadgetType;
      targetPosition?: [number, number, number];
      direction?: [number, number, number];
    }
  | { type: 'PING'; timestamp: number };

// Server -> Client
export type ServerMessage =
  | {
      type: 'ROOM_JOINED';
      roomId: string;
      playerId: string;
      isHost: boolean;
      gameMode: GameMode;
    }
  | {
      type: 'ROOM_UPDATE';
      roomId: string;
      hostId: string;
      gameMode: GameMode;
      state: RoundState;
      players: PlayerPublicInfo[];
    }
  | {
      type: 'STATE_CHANGE';
      state: RoundState;
      timer: number;
      roundNumber: number;
    }
  | {
      type: 'NUMBER_SELECTION_REQUIRED';
      durationSec: number;
      isRespawn?: boolean;
    }
  | {
      type: 'GAME_SNAPSHOT';
      tick: number;
      timestamp: number;
      timer: number;
      players: ClientPlayerSnapshot[];
      activeGadgets: ActiveGadgetEffect[];
    }
  | {
      type: 'ELIMINATION_EVENT';
      attackerId: string;
      attackerName: string;
      victimId: string;
      victimName: string;
      eliminatedNumber: string;
      attackerScore: number;
      isSelfAttacker: boolean;
      isSelfVictim: boolean;
    }
  | {
      type: 'ELIMINATION_REJECTED';
      reason: 'wrong_number' | 'not_visible' | 'cooldown' | 'out_of_range' | 'invalid_target' | 'spawn_protected' | 'friendly_fire';
      cooldownSeconds: number;
      message: string;
    }
  | {
      type: 'GADGET_TRIGGERED';
      id: string;
      gadgetType: GadgetType;
      ownerId: string;
      ownerName: string;
      position: [number, number, number];
      duration: number;
      capturedNumber?: string; // Only sent to the user of Spy Camera if successful!
    }
  | {
      type: 'PONG';
      clientTimestamp: number;
      serverTimestamp: number;
    }
  | {
      type: 'ERROR';
      message: string;
    };
