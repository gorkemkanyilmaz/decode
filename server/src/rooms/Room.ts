import { ServerPlayer } from '../players/ServerPlayer';
import {
  GameMode,
  RoundState,
  GadgetType,
  ActiveGadgetEffect,
  SpawnPoint,
  BoundingBox
} from '@shared/types/game';
import { GAME_CONSTANTS } from '@shared/constants/game';
import { MAP_OBJECTS, SPAWN_POINTS, COLLISION_OBSTACLES } from '@shared/constants/mapLayout';
import {
  v3,
  v3FromArray,
  v3Distance,
  isLineOfSightClear,
  isForeheadFacingViewer,
  isViewerLookingAtTarget,
  isValidFourDigitNumber
} from '@shared/utils/math';
import { ServerMessage } from '@shared/protocol/messages';

export class Room {
  public id: string;
  public hostId: string;
  public gameMode: GameMode;
  public maxPlayers: number;
  public state: RoundState = 'LOBBY';
  public players: Map<string, ServerPlayer> = new Map();
  public roundTimer: number = 0;
  public roundNumber: number = 1;
  public activeGadgets: ActiveGadgetEffect[] = [];

  private tickInterval: NodeJS.Timeout | null = null;
  private stateTimerInterval: NodeJS.Timeout | null = null;
  private currentTick: number = 0;
  private isDestroyed: boolean = false;

  constructor(id: string, hostPlayer: ServerPlayer, gameMode: GameMode = 'deathmatch', maxPlayers: number = 16) {
    this.id = id;
    this.hostId = hostPlayer.id;
    this.gameMode = gameMode;
    this.maxPlayers = maxPlayers;

    this.addPlayer(hostPlayer);
    hostPlayer.isHost = true;

    this.startTickLoop();
  }

  public addPlayer(player: ServerPlayer): boolean {
    if (this.players.size >= this.maxPlayers) {
      return false;
    }
    this.players.set(player.id, player);

    // Auto team assignment if team mode
    if (this.gameMode === 'team_hunt') {
      const redCount = Array.from(this.players.values()).filter((p) => p.team === 'red').length;
      const blueCount = Array.from(this.players.values()).filter((p) => p.team === 'blue').length;
      player.team = redCount <= blueCount ? 'red' : 'blue';
    }

    this.broadcastRoomUpdate();
    return true;
  }

  public removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    this.players.delete(playerId);

    if (this.players.size === 0) {
      this.destroy();
      return;
    }

    // Reassign host if host left
    if (this.hostId === playerId) {
      const nextHost = this.players.values().next().value;
      if (nextHost) {
        this.hostId = nextHost.id;
        nextHost.isHost = true;
      }
    }

    this.broadcastRoomUpdate();

    if (this.state === 'PLAYING') {
      this.checkEndConditions();
    }
  }

  public setPlayerReady(playerId: string, ready: boolean): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isReady = ready;
      this.broadcastRoomUpdate();
    }
  }

  public startGame(requestingPlayerId: string): boolean {
    if (requestingPlayerId !== this.hostId) return false;
    if (this.state !== 'LOBBY') return false;

    this.transitionTo('COUNTDOWN', 3);
    return true;
  }

  public handleNumberSelection(playerId: string, chosenNumber: string): boolean {
    if (!isValidFourDigitNumber(chosenNumber)) return false;
    const player = this.players.get(playerId);
    if (!player) return false;

    player.setSecretNumber(chosenNumber);

    // If all players have selected numbers during CHOOSE_NUMBER, immediately start
    if (this.state === 'CHOOSE_NUMBER') {
      const allSelected = Array.from(this.players.values()).every((p) => p.hasSelectedNumber);
      if (allSelected) {
        this.transitionTo('PLAYING', GAME_CONSTANTS.ROUND_DURATION_DEATHMATCH_SEC);
      }
    }
    return true;
  }

  public handlePlayerInput(
    playerId: string,
    data: {
      seq: number;
      position: [number, number, number];
      rotationY: number;
      pitch: number;
      velocity: [number, number, number];
      isCrouching: boolean;
      isSprinting: boolean;
      isMoving: boolean;
    }
  ): void {
    const player = this.players.get(playerId);
    if (!player || player.isDead) return;

    player.lastInputSeq = data.seq;
    player.position = data.position;
    player.rotationY = data.rotationY;
    player.pitch = data.pitch;
    player.velocity = data.velocity;
    player.isCrouching = data.isCrouching;
    player.isSprinting = data.isSprinting;
    player.isMoving = data.isMoving;
  }

  /**
   * Authoritative elimination validation
   */
  public handleEliminationAttempt(attackerId: string, targetId: string, guessedNumber: string): void {
    const attacker = this.players.get(attackerId);
    let target = this.players.get(targetId);

    if (!attacker || !target) return;

    if (this.state !== 'PLAYING') {
      attacker.send({
        type: 'ELIMINATION_REJECTED',
        reason: 'invalid_target',
        cooldownSeconds: 0,
        message: 'Match is not active.'
      });
      return;
    }

    if (attacker.isDead) {
      attacker.send({
        type: 'ELIMINATION_REJECTED',
        reason: 'invalid_target',
        cooldownSeconds: 0,
        message: 'You are eliminated.'
      });
      return;
    }

    if (target.isDead) {
      attacker.send({
        type: 'ELIMINATION_REJECTED',
        reason: 'invalid_target',
        cooldownSeconds: 0,
        message: 'Target is already eliminated.'
      });
      return;
    }

    if (attacker.id === target.id) {
      return; // Cannot eliminate yourself
    }

    if (this.gameMode === 'team_hunt' && attacker.team === target.team) {
      attacker.send({
        type: 'ELIMINATION_REJECTED',
        reason: 'friendly_fire',
        cooldownSeconds: 1,
        message: 'Cannot eliminate teammate.'
      });
      return;
    }

    // Check cooldown
    const cooldown = attacker.canAttemptElimination();
    if (!cooldown.can) {
      attacker.send({
        type: 'ELIMINATION_REJECTED',
        reason: 'cooldown',
        cooldownSeconds: cooldown.remainingSec,
        message: `Keypad cooling down (${cooldown.remainingSec}s).`
      });
      return;
    }

    // Target resolution: If targetId is not specified or ambiguous, match any active opponent with this number
    if (!target) {
      for (const p of this.players.values()) {
        if (p.id !== attacker.id && !p.isDead && p.secretNumber === guessedNumber) {
          if (this.gameMode !== 'team_hunt' || p.team !== attacker.team) {
            target = p;
            break;
          }
        }
      }
    }

    if (!target) {
      // Guessed number matches nobody
      attacker.score = Math.max(0, attacker.score + GAME_CONSTANTS.SCORE_PENALTY_WRONG_GUESS);
      attacker.applyCooldown(GAME_CONSTANTS.WRONG_GUESS_COOLDOWN_SEC);
      attacker.send({
        type: 'ELIMINATION_REJECTED',
        reason: 'wrong_number',
        cooldownSeconds: GAME_CONSTANTS.WRONG_GUESS_COOLDOWN_SEC,
        message: 'Invalid 4-digit code.'
      });
      return;
    }

    // Check spawn protection
    if (target.isSpawnProtected()) {
      attacker.send({
        type: 'ELIMINATION_REJECTED',
        reason: 'spawn_protected',
        cooldownSeconds: 1,
        message: 'Target is currently under spawn shield.'
      });
      return;
    }

    // Validate 4-digit number
    if (target.secretNumber === guessedNumber) {
      // SUCCESSFUL ELIMINATION!
      target.kill();
      attacker.kills++;
      attacker.score += GAME_CONSTANTS.SCORE_PER_ELIMINATION;

      // Broadcast elimination to everyone
      this.broadcastElimination(attacker, target, guessedNumber);

      // Handle respawn flow
      if (this.gameMode === 'deathmatch') {
        setTimeout(() => {
          if (this.isDestroyed || this.state !== 'PLAYING') return;
          this.respawnPlayer(target);
        }, 4000);
      } else if (this.gameMode === 'last_standing') {
        this.checkEndConditions();
      }
    } else {
      // INCORRECT GUESS!
      attacker.applyCooldown(GAME_CONSTANTS.WRONG_GUESS_COOLDOWN_SEC);
      attacker.score = Math.max(0, attacker.score + GAME_CONSTANTS.SCORE_PENALTY_WRONG_GUESS);

      attacker.send({
        type: 'ELIMINATION_REJECTED',
        reason: 'wrong_number',
        cooldownSeconds: GAME_CONSTANTS.WRONG_GUESS_COOLDOWN_SEC,
        message: 'INCORRECT NUMBER! Security breach triggered penalty cooldown.'
      });
    }
  }

  public handleUseGadget(
    playerId: string,
    gadget: GadgetType,
    targetPosition?: [number, number, number],
    direction?: [number, number, number]
  ): void {
    const player = this.players.get(playerId);
    if (!player || player.isDead || this.state !== 'PLAYING') return;

    // Check 15-second cooldown for tactical deployment gadgets (smoke, flash, camera)
    if (gadget === 'smoke' || gadget === 'flash' || gadget === 'camera') {
      const cd = player.canUseGadget(gadget);
      if (!cd.can) {
        return; // Reject spam while cooling down
      }
      player.setGadgetCooldown(gadget, GAME_CONSTANTS.GADGET_COOLDOWN_SEC);
    }

    const id = `gadget_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const pos: [number, number, number] = targetPosition || [
      player.position[0],
      player.position[1] + 0.5,
      player.position[2]
    ];

    let duration = 5;
    let radius = 5;
    let capturedNumber: string | undefined = undefined;

    if (gadget === 'smoke') {
      duration = GAME_CONSTANTS.SMOKE_DURATION_SEC;
      radius = GAME_CONSTANTS.SMOKE_RADIUS;
    } else if (gadget === 'flash') {
      duration = GAME_CONSTANTS.FLASH_DURATION_SEC;
      radius = GAME_CONSTANTS.FLASH_RADIUS;
    } else if (gadget === 'camera') {
      duration = GAME_CONSTANTS.CAMERA_DURATION_SEC;
      // Camera snaps opponent in front if visible
      for (const other of this.players.values()) {
        if (other.id !== player.id && !other.isDead) {
          const eye = player.getHeadPosition();
          const targetHead = other.getHeadPosition();
          const dist = v3Distance(eye, targetHead);
          if (dist <= GAME_CONSTANTS.MAX_READING_DISTANCE) {
            const los = isLineOfSightClear(eye, targetHead, COLLISION_OBSTACLES);
            const facing = isForeheadFacingViewer(v3FromArray(other.position), other.rotationY, eye);
            if (los && facing) {
              capturedNumber = other.secretNumber;
              break;
            }
          }
        }
      }
    }

    const gadgetEffect: ActiveGadgetEffect = {
      id,
      type: gadget,
      ownerId: player.id,
      position: pos,
      duration,
      startTime: Date.now(),
      radius
    };

    this.activeGadgets.push(gadgetEffect);

    // Notify all players about gadget visual/audio trigger
    for (const p of this.players.values()) {
      p.send({
        type: 'GADGET_TRIGGERED',
        id,
        gadgetType: gadget,
        ownerId: player.id,
        ownerName: player.name,
        position: pos,
        duration,
        capturedNumber: p.id === player.id ? capturedNumber : undefined
      });
    }

    setTimeout(() => {
      this.activeGadgets = this.activeGadgets.filter((g) => g.id !== id);
    }, duration * 1000);
  }

  private transitionTo(newState: RoundState, timerSec: number): void {
    this.state = newState;
    this.roundTimer = timerSec;

    if (this.stateTimerInterval) {
      clearInterval(this.stateTimerInterval);
      this.stateTimerInterval = null;
    }

    // Broadcast state change
    this.broadcast({
      type: 'STATE_CHANGE',
      state: this.state,
      timer: this.roundTimer,
      roundNumber: this.roundNumber
    });

    if (newState === 'COUNTDOWN') {
      this.stateTimerInterval = setInterval(() => {
        this.roundTimer--;
        if (this.roundTimer <= 0) {
          clearInterval(this.stateTimerInterval!);
          this.transitionTo('CHOOSE_NUMBER', GAME_CONSTANTS.CHOOSE_NUMBER_TIME_SEC);
        }
      }, 1000);
    } else if (newState === 'CHOOSE_NUMBER') {
      // Spawn players at designated points
      this.spawnAllPlayers();

      // Send prompt for number selection
      for (const p of this.players.values()) {
        p.send({
          type: 'NUMBER_SELECTION_REQUIRED',
          durationSec: GAME_CONSTANTS.CHOOSE_NUMBER_TIME_SEC
        });
      }

      this.stateTimerInterval = setInterval(() => {
        this.roundTimer--;
        if (this.roundTimer <= 0) {
          clearInterval(this.stateTimerInterval!);
          // Ensure all players have a number
          for (const p of this.players.values()) {
            if (!p.hasSelectedNumber) {
              const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
              p.setSecretNumber(rand);
            }
          }
          this.transitionTo('PLAYING', GAME_CONSTANTS.ROUND_DURATION_DEATHMATCH_SEC);
        }
      }, 1000);
    } else if (newState === 'PLAYING') {
      this.stateTimerInterval = setInterval(() => {
        this.roundTimer--;
        if (this.roundTimer <= 0) {
          clearInterval(this.stateTimerInterval!);
          this.transitionTo('ROUND_END', 8);
        }
      }, 1000);
    } else if (newState === 'ROUND_END') {
      this.stateTimerInterval = setInterval(() => {
        this.roundTimer--;
        if (this.roundTimer <= 0) {
          clearInterval(this.stateTimerInterval!);
          this.roundNumber++;
          // Reset players for next match
          for (const p of this.players.values()) {
            p.isDead = false;
            p.hasSelectedNumber = false;
            p.lives = 3;
          }
          this.transitionTo('LOBBY', 0);
        }
      }, 1000);
    }
  }

  private spawnAllPlayers(): void {
    const spawns = [...SPAWN_POINTS].sort(() => Math.random() - 0.5);
    let index = 0;

    for (const player of this.players.values()) {
      const spawn = spawns[index % spawns.length];
      player.respawn(spawn.position, spawn.rotationY);
      index++;
    }
  }

  private respawnPlayer(player: ServerPlayer): void {
    // Pick spawn far from active living players
    const livingPlayers = Array.from(this.players.values()).filter((p) => !p.isDead && p.id !== player.id);
    let bestSpawn = SPAWN_POINTS[0];
    let maxMinDist = -1;

    for (const spawn of SPAWN_POINTS) {
      let minDist = 9999;
      for (const other of livingPlayers) {
        const d = v3Distance(v3FromArray(spawn.position), v3FromArray(other.position));
        if (d < minDist) minDist = d;
      }
      if (minDist > maxMinDist) {
        maxMinDist = minDist;
        bestSpawn = spawn;
      }
    }

    player.respawn(bestSpawn.position, bestSpawn.rotationY);
    player.hasSelectedNumber = false;

    // Prompt player for a new number
    player.send({
      type: 'NUMBER_SELECTION_REQUIRED',
      durationSec: 6,
      isRespawn: true
    });

    // Auto assign if not picked in 6 seconds
    setTimeout(() => {
      if (!player.hasSelectedNumber) {
        const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        player.setSecretNumber(rand);
      }
    }, 6000);
  }

  private checkEndConditions(): void {
    if (this.state !== 'PLAYING') return;

    if (this.gameMode === 'last_standing') {
      const alivePlayers = Array.from(this.players.values()).filter((p) => !p.isDead && p.lives > 0);
      if (alivePlayers.length <= 1) {
        this.transitionTo('ROUND_END', 8);
      }
    }
  }

  private broadcastElimination(attacker: ServerPlayer, victim: ServerPlayer, num: string): void {
    for (const p of this.players.values()) {
      p.send({
        type: 'ELIMINATION_EVENT',
        attackerId: attacker.id,
        attackerName: attacker.name,
        victimId: victim.id,
        victimName: victim.name,
        eliminatedNumber: num,
        attackerScore: attacker.score,
        isSelfAttacker: p.id === attacker.id,
        isSelfVictim: p.id === victim.id
      });
    }
  }

  public broadcastRoomUpdate(): void {
    const playersList = Array.from(this.players.values()).map((p) => p.toPublicInfo());
    this.broadcast({
      type: 'ROOM_UPDATE',
      roomId: this.id,
      hostId: this.hostId,
      gameMode: this.gameMode,
      state: this.state,
      players: playersList
    });
  }

  private broadcast(msg: any): void {
    for (const p of this.players.values()) {
      p.send(msg);
    }
  }

  private startTickLoop(): void {
    const tickIntervalMs = 1000 / GAME_CONSTANTS.SERVER_TICK_RATE;

    this.tickInterval = setInterval(() => {
      if (this.isDestroyed) return;
      this.currentTick++;

      if (this.state === 'PLAYING' || this.state === 'CHOOSE_NUMBER') {
        this.broadcastSnapshots();
      }
    }, tickIntervalMs);
  }

  /**
   * Generates secure authoritative snapshots for each connected player
   */
  private broadcastSnapshots(): void {
    const now = Date.now();
    const smokeObstacles: BoundingBox[] = this.activeGadgets
      .filter((g) => g.type === 'smoke')
      .map((g) => ({
        min: [g.position[0] - g.radius, g.position[1], g.position[2] - g.radius],
        max: [g.position[0] + g.radius, g.position[1] + g.radius, g.position[2] + g.radius]
      }));
    const allObstacles = [...COLLISION_OBSTACLES, ...smokeObstacles];

    const allPlayers = Array.from(this.players.values());

    for (const viewer of allPlayers) {
      const viewerEye = viewer.getHeadPosition();
      const playerSnapshots = [];

      for (const target of allPlayers) {
        let visibleNumber: string | null = null;

        if (target.id === viewer.id) {
          // Self can always see their own chosen number
          visibleNumber = target.secretNumber;
        } else if (!target.isDead && !viewer.isDead) {
          // Check line-of-sight & forehead visibility rules
          const targetHead = target.getHeadPosition();
          const dist = v3Distance(viewerEye, targetHead);

          if (dist <= GAME_CONSTANTS.MAX_READING_DISTANCE) {
            const hasLOS = isLineOfSightClear(viewerEye, targetHead, allObstacles);
            if (hasLOS) {
              const isFacing = isForeheadFacingViewer(
                v3FromArray(target.position),
                target.rotationY,
                viewerEye
              );
              if (isFacing) {
                const lookingAt = isViewerLookingAtTarget(
                  viewerEye,
                  viewer.rotationY,
                  v3FromArray(target.position)
                );
                if (lookingAt) {
                  // SECURE: Target number is legitimately readable!
                  visibleNumber = target.secretNumber;
                }
              }
            }
          }
        }

        playerSnapshots.push(target.toClientSnapshot(visibleNumber));
      }

      viewer.send({
        type: 'GAME_SNAPSHOT',
        tick: this.currentTick,
        timestamp: now,
        timer: this.roundTimer,
        players: playerSnapshots,
        activeGadgets: this.activeGadgets
      });
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.stateTimerInterval) clearInterval(this.stateTimerInterval);
  }
}
