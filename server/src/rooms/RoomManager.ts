import { Room } from './Room';
import { ServerPlayer } from '../players/ServerPlayer';
import { GameMode } from '@shared/types/game';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerToRoom: Map<string, string> = new Map();

  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure uniqueness
    if (this.rooms.has(code)) {
      return this.generateRoomCode();
    }
    return code;
  }

  public createRoom(hostPlayer: ServerPlayer, gameMode: GameMode = 'deathmatch'): Room {
    const code = this.generateRoomCode();
    const room = new Room(code, hostPlayer, gameMode);
    this.rooms.set(code, room);
    this.playerToRoom.set(hostPlayer.id, code);
    return room;
  }

  public joinRoom(roomId: string, player: ServerPlayer): { success: boolean; room?: Room; error?: string } {
    const normalizedId = roomId.toUpperCase().trim();
    const room = this.rooms.get(normalizedId);

    if (!room) {
      return { success: false, error: 'Room not found. Check the room code and try again.' };
    }

    if (room.players.size >= room.maxPlayers) {
      return { success: false, error: 'Room is full (max 20 players).' };
    }

    const added = room.addPlayer(player);
    if (!added) {
      return { success: false, error: 'Failed to join room.' };
    }

    this.playerToRoom.set(player.id, normalizedId);
    return { success: true, room };
  }

  public leaveRoom(playerId: string): void {
    const roomId = this.playerToRoom.get(playerId);
    if (!roomId) return;

    this.playerToRoom.delete(playerId);
    const room = this.rooms.get(roomId);
    if (room) {
      room.removePlayer(playerId);
      if (room.players.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId.toUpperCase().trim());
  }

  public getPlayerRoom(playerId: string): Room | undefined {
    const roomId = this.playerToRoom.get(playerId);
    if (!roomId) return undefined;
    return this.rooms.get(roomId);
  }

  public getActiveRoomCount(): number {
    return this.rooms.size;
  }
}
