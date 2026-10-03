import { WebSocket } from 'ws';
import { RoomManager } from '../rooms/RoomManager';
import { ServerPlayer } from '../players/ServerPlayer';
import { ClientMessage } from '@shared/protocol/messages';

export class WebSocketHandler {
  private roomManager: RoomManager;
  private players: Map<WebSocket, ServerPlayer> = new Map();

  constructor(roomManager: RoomManager) {
    this.roomManager = roomManager;
  }

  public handleConnection(ws: WebSocket): void {
    const playerId = `p_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    let player: ServerPlayer | null = null;

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;

        switch (msg.type) {
          case 'CREATE_ROOM': {
            if (player) {
              this.roomManager.leaveRoom(player.id);
            }
            player = new ServerPlayer(
              playerId,
              msg.playerName || 'Agent',
              ws,
              msg.color || '#3B82F6',
              msg.accessory || 'fedora'
            );
            this.players.set(ws, player);

            const room = this.roomManager.createRoom(player, msg.gameMode || 'deathmatch');
            player.send({
              type: 'ROOM_JOINED',
              roomId: room.id,
              playerId: player.id,
              isHost: true,
              gameMode: room.gameMode
            });
            break;
          }

          case 'JOIN_ROOM': {
            if (player) {
              this.roomManager.leaveRoom(player.id);
            }
            player = new ServerPlayer(
              playerId,
              msg.playerName || 'Agent',
              ws,
              msg.color || '#EF4444',
              msg.accessory || 'fedora',
              msg.team || 'none'
            );
            this.players.set(ws, player);

            const result = this.roomManager.joinRoom(msg.roomId, player);
            if (result.success && result.room) {
              player.send({
                type: 'ROOM_JOINED',
                roomId: result.room.id,
                playerId: player.id,
                isHost: false,
                gameMode: result.room.gameMode
              });
            } else {
              player.send({
                type: 'ERROR',
                message: result.error || 'Could not join room.'
              });
            }
            break;
          }

          case 'SET_READY': {
            if (!player) return;
            const room = this.roomManager.getPlayerRoom(player.id);
            if (room) {
              room.setPlayerReady(player.id, msg.ready);
            }
            break;
          }

          case 'START_GAME': {
            if (!player) return;
            const room = this.roomManager.getPlayerRoom(player.id);
            if (room) {
              room.startGame(player.id);
            }
            break;
          }

          case 'SELECT_NUMBER': {
            if (!player) return;
            const room = this.roomManager.getPlayerRoom(player.id);
            if (room) {
              room.handleNumberSelection(player.id, msg.number);
            }
            break;
          }

          case 'PLAYER_INPUT': {
            if (!player) return;
            const room = this.roomManager.getPlayerRoom(player.id);
            if (room) {
              room.handlePlayerInput(player.id, msg);
            }
            break;
          }

          case 'ELIMINATION_ATTEMPT': {
            if (!player) return;
            const room = this.roomManager.getPlayerRoom(player.id);
            if (room) {
              room.handleEliminationAttempt(player.id, msg.targetId, msg.guessedNumber);
            }
            break;
          }

          case 'USE_GADGET': {
            if (!player) return;
            const room = this.roomManager.getPlayerRoom(player.id);
            if (room) {
              room.handleUseGadget(player.id, msg.gadget, msg.targetPosition, msg.direction);
            }
            break;
          }

          case 'PING': {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'PONG',
                  clientTimestamp: msg.timestamp,
                  serverTimestamp: Date.now()
                })
              );
            }
            break;
          }
        }
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    });

    ws.on('close', () => {
      if (player) {
        this.roomManager.leaveRoom(player.id);
        this.players.delete(ws);
      }
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for player ${playerId}:`, err);
    });
  }
}
