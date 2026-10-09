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

  private connectPromise: Promise<void> | null = null;

  constructor() {
    const envUrl = (import.meta as any).env?.VITE_WS_URL;
    const host = window.location.hostname;
    const isLocalOrLAN =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      window.location.port === '3000';

    if (envUrl) {
      this.url = envUrl;
    } else if (isLocalOrLAN) {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.url = `${wsProtocol}//${host}:3001`;
    } else {
      // Production fallback directly to deployed Render WebSocket server
      this.url = 'wss://decode-server.onrender.com';
    }
  }

  public connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    if (this.connectPromise && this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise((resolve, reject) => {
      try {
        if (this.ws) {
          try {
            this.ws.close();
          } catch (_) {}
        }

        this.ws = new WebSocket(this.url);

        const connectionTimeout = window.setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            this.connectPromise = null;
            reject(new Error(`Connection to ${this.url} timed out.`));
          }
        }, 8000);

        this.ws.onopen = () => {
          window.clearTimeout(connectionTimeout);
          this.connectPromise = null;
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
          window.clearTimeout(connectionTimeout);
          this.connectPromise = null;
          if (this.pingInterval) clearInterval(this.pingInterval);
          this.onDisconnectHandlers.forEach((cb) => cb());
        };

        this.ws.onerror = (err) => {
          window.clearTimeout(connectionTimeout);
          this.connectPromise = null;
          console.error('WebSocket connection error:', err);
          reject(err);
        };
      } catch (err) {
        this.connectPromise = null;
        reject(err);
      }
    });

    return this.connectPromise;
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
