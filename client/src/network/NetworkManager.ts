import { ClientMessage, ServerMessage } from '@shared/protocol/messages';
import { GameMode, GadgetType } from '@shared/types/game';

export class NetworkManager {
  private ws: WebSocket | null = null;
  private url: string;
  public playerId: string = '';
  public roomId: string = '';
  public isHost: boolean = false;
  public pingMs: number = 0;
  private pingInterval: number | null = null;

  private messageHandlers: ((msg: ServerMessage) => void)[] = [];
  private onConnectHandlers: (() => void)[] = [];
  private onDisconnectHandlers: (() => void)[] = [];

  constructor() {
    const host = window.location.hostname || 'localhost';
    const port = 3001;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${host}:${port}`;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.startPingLoop();
          this.onConnectHandlers.forEach((cb) => cb());
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as ServerMessage;

            if (msg.type === 'PONG') {
              this.pingMs = Date.now() - msg.clientTimestamp;
            } else if (msg.type === 'ROOM_JOINED') {
              this.roomId = msg.roomId;
              this.playerId = msg.playerId;
              this.isHost = msg.isHost;
            }

            this.messageHandlers.forEach((cb) => cb(msg));
          } catch (e) {
            console.error('Error handling server message:', e);
          }
        };

        this.ws.onclose = () => {
          if (this.pingInterval) clearInterval(this.pingInterval);
          this.onDisconnectHandlers.forEach((cb) => cb());
        };

        this.ws.onerror = (err) => {
          console.error('WebSocket connection error:', err);
          reject(err);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  public onMessage(callback: (msg: ServerMessage) => void): void {
    this.messageHandlers.push(callback);
  }

  public onConnect(callback: () => void): void {
    this.onConnectHandlers.push(callback);
  }

  public onDisconnect(callback: () => void): void {
    this.onDisconnectHandlers.push(callback);
  }

  public send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startPingLoop(): void {
    this.pingInterval = window.setInterval(() => {
      this.send({ type: 'PING', timestamp: Date.now() });
    }, 2000);
  }

  // High-level API calls
  public createRoom(
    playerName: string,
    gameMode: GameMode,
    color: string,
    accessory: 'fedora' | 'cap' | 'headset' | 'goggles' | 'none'
  ): void {
    this.send({
      type: 'CREATE_ROOM',
      playerName,
      gameMode,
      color,
      accessory
    });
  }

  public joinRoom(
    roomId: string,
    playerName: string,
    color: string,
    accessory: 'fedora' | 'cap' | 'headset' | 'goggles' | 'none',
    team?: 'red' | 'blue'
  ): void {
    this.send({
      type: 'JOIN_ROOM',
      roomId,
      playerName,
      color,
      accessory,
      team
    });
  }

  public setReady(ready: boolean): void {
    this.send({ type: 'SET_READY', ready });
  }

  public startGame(): void {
    this.send({ type: 'START_GAME' });
  }

  public selectNumber(num: string): void {
    this.send({ type: 'SELECT_NUMBER', number: num });
  }

  public sendPlayerInput(
    seq: number,
    position: [number, number, number],
    rotationY: number,
    pitch: number,
    velocity: [number, number, number],
    isCrouching: boolean,
    isSprinting: boolean,
    isMoving: boolean
  ): void {
    this.send({
      type: 'PLAYER_INPUT',
      seq,
      position,
      rotationY,
      pitch,
      velocity,
      isCrouching,
      isSprinting,
      isMoving
    });
  }

  public attemptElimination(targetId: string, guessedNumber: string): void {
    this.send({
      type: 'ELIMINATION_ATTEMPT',
      targetId,
      guessedNumber
    });
  }

  public useGadget(gadget: GadgetType, targetPosition?: [number, number, number]): void {
    this.send({
      type: 'USE_GADGET',
      gadget,
      targetPosition
    });
  }
}
