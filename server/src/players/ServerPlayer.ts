import { WebSocket } from 'ws';
import {
  PlayerCustomization,
  PlayerPublicInfo,
  ClientPlayerSnapshot,
  Team
} from '@shared/types/game';
import { GAME_CONSTANTS } from '@shared/constants/game';
import { Vec3, v3FromArray } from '@shared/utils/math';

export class ServerPlayer {
  public id: string;
  public name: string;
  public team: Team;
  public customization: PlayerCustomization;
  public ws: WebSocket;
  public isHost: boolean = false;
  public isReady: boolean = false;

  // Transform & Physics
  public position: [number, number, number] = [0, 0, 0];
  public rotationY: number = 0; // Yaw
  public pitch: number = 0;
  public velocity: [number, number, number] = [0, 0, 0];
  public isCrouching: boolean = false;
  public isSprinting: boolean = false;
  public isMoving: boolean = false;

  // Game state
  public secretNumber: string = '0000';
  public hasSelectedNumber: boolean = false;
  public isDead: boolean = false;
  public spawnProtectedUntil: number = 0;
  public deathTimestamp: number = 0;
  public score: number = 0;
  public kills: number = 0;
  public deaths: number = 0;
  public lives: number = 3;

  // Anti-spam & Cooldowns
  public cooldownUntil: number = 0;
  public lastInputSeq: number = 0;
  public lastPingTimestamp: number = Date.now();

  constructor(
    id: string,
    name: string,
    ws: WebSocket,
    color: string = '#3B82F6',
    accessory: 'fedora' | 'cap' | 'headset' | 'goggles' | 'none' = 'fedora',
    team: Team = 'none'
  ) {
    this.id = id;
    this.name = name;
    this.ws = ws;
    this.team = team;
    this.customization = {
      color,
      accessory,
      suitColor: '#1E293B'
    };
  }

  public setSecretNumber(num: string): void {
    this.secretNumber = num;
    this.hasSelectedNumber = true;
  }

  public getHeadPosition(): Vec3 {
    const headHeight = this.isCrouching
      ? GAME_CONSTANTS.HEAD_HEIGHT_CROUCHING
      : GAME_CONSTANTS.HEAD_HEIGHT_STANDING;
    return {
      x: this.position[0],
      y: this.position[1] + headHeight,
      z: this.position[2]
    };
  }

  public isSpawnProtected(): boolean {
    return Date.now() < this.spawnProtectedUntil;
  }

  public canAttemptElimination(): { can: boolean; remainingSec: number } {
    const now = Date.now();
    if (now < this.cooldownUntil) {
      return { can: false, remainingSec: Math.ceil((this.cooldownUntil - now) / 1000) };
    }
    return { can: true, remainingSec: 0 };
  }

  public applyCooldown(seconds: number): void {
    this.cooldownUntil = Date.now() + seconds * 1000;
  }

  public kill(): void {
    this.isDead = true;
    this.deathTimestamp = Date.now();
    this.deaths++;
    this.lives = Math.max(0, this.lives - 1);
  }

  public respawn(position: [number, number, number], rotationY: number): void {
    this.isDead = false;
    this.position = [...position];
    this.rotationY = rotationY;
    this.velocity = [0, 0, 0];
    this.isCrouching = false;
    this.isSprinting = false;
    this.isMoving = false;
    this.spawnProtectedUntil = Date.now() + GAME_CONSTANTS.SPAWN_PROTECTION_SEC * 1000;
  }

  public toPublicInfo(): PlayerPublicInfo {
    return {
      id: this.id,
      name: this.name,
      team: this.team,
      customization: this.customization,
      isReady: this.isReady,
      score: this.score,
      kills: this.kills,
      deaths: this.deaths,
      lives: this.lives
    };
  }

  public toClientSnapshot(visibleNumberForViewer: string | null): ClientPlayerSnapshot {
    return {
      id: this.id,
      position: [...this.position],
      rotationY: this.rotationY,
      pitch: this.pitch,
      velocity: [...this.velocity],
      isCrouching: this.isCrouching,
      isSprinting: this.isSprinting,
      isMoving: this.isMoving,
      isDead: this.isDead,
      isSpawnProtected: this.isSpawnProtected(),
      visibleNumber: visibleNumberForViewer,
      score: this.score,
      kills: this.kills,
      deaths: this.deaths,
      team: this.team
    };
  }

  public send(msg: any): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
