import * as THREE from 'three';
import { WorldBuilder } from '../world/WorldBuilder';
import { CameraController } from '../camera/CameraController';
import { PlayerManager } from '../player/PlayerManager';
import { ParticleSystem } from '../world/ParticleSystem';
import { InputManager } from '../input/InputManager';
import { SoundSystem } from '../audio/SoundSystem';
import { NetworkManager } from '../network/NetworkManager';
import { UIManager } from '../ui/UIManager';
import { Minimap } from '../ui/Minimap';
import {
  RoundState,
  PlayerPublicInfo,
  GadgetType
} from '@shared/types/game';
import { GAME_CONSTANTS } from '@shared/constants/game';
import { ServerMessage } from '@shared/protocol/messages';

export class Game {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private worldBuilder!: WorldBuilder;
  private cameraController!: CameraController;
  private playerManager!: PlayerManager;
  private particleSystem!: ParticleSystem;
  private inputManager!: InputManager;
  private soundSystem!: SoundSystem;
  private networkManager!: NetworkManager;
  private uiManager!: UIManager;
  private minimap!: Minimap;

  // Local state
  private currentState: RoundState = 'LOBBY';
  private localNumber: string = '????';
  private localScore: number = 0;
  private localKills: number = 0;
  private localDeaths: number = 0;
  private roundTimer: number = 0;
  private hasSpawned: boolean = false;
  private wasDead: boolean = false;

  private playersMap: Map<string, PlayerPublicInfo> = new Map();
  private inputSequence: number = 0;
  private lastInputSendTime: number = 0;
  private clock: THREE.Clock = new THREE.Clock();

  // Performance & Debug
  private frameCount: number = 0;
  private lastFpsTime: number = 0;
  private currentFps: number = 60;
  private isDebugVisible: boolean = false;

  constructor() {
    this.initThree();
    this.initSystems();
    this.setupNetworkCallbacks();
    this.setupUICallbacks();
    this.setupInputCallbacks();

    this.uiManager.showMainMenu();

    // Start render loop
    this.animate();
  }

  private initThree(): void {
    const container = document.getElementById('canvas-container')!;

    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    // Cap pixel ratio for mobile battery & performance
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.cameraController.camera.aspect = window.innerWidth / window.innerHeight;
      this.cameraController.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private initSystems(): void {
    this.soundSystem = new SoundSystem();
    this.worldBuilder = new WorldBuilder(this.scene);
    this.cameraController = new CameraController(this.worldBuilder, this.soundSystem);
    this.playerManager = new PlayerManager(this.scene);
    this.particleSystem = new ParticleSystem(this.scene);
    this.inputManager = new InputManager(this.renderer.domElement);
    this.networkManager = new NetworkManager();
    // Auto-connect to WebSocket server on boot so room actions are instantaneous
    this.networkManager.connect().catch((e) => {
      console.warn('Initial WebSocket auto-connect notice:', e);
    });
    this.uiManager = new UIManager(this.soundSystem);
    this.minimap = new Minimap();
    this.minimap.hide(); // Hidden until in-game

    // Initial camera position overlooking arena
    this.cameraController.setSpawn([0, 15, 35], 0);
    this.cameraController.pitch = -0.35;
  }

  private setupNetworkCallbacks(): void {
    this.networkManager.onMessage((msg: ServerMessage) => {
      switch (msg.type) {
        case 'ROOM_JOINED': {
          this.playerManager.localPlayerId = msg.playerId;
          this.networkManager.playerId = msg.playerId;
          this.networkManager.roomId = msg.roomId;
          this.networkManager.isHost = msg.isHost;

          // Re-render lobby if already in LOBBY state to ensure host controls (Start Match button) are visible
          if (this.playersMap.size > 0 && this.currentState === 'LOBBY') {
            this.uiManager.showLobby(
              msg.roomId,
              msg.isHost,
              Array.from(this.playersMap.values()),
              msg.gameMode
            );
          }
          break;
        }

        case 'ROOM_UPDATE': {
          this.playersMap.clear();
          for (const p of msg.players) {
            this.playersMap.set(p.id, p);
          }

          if (msg.state === 'LOBBY') {
            const isHost =
              this.networkManager.isHost ||
              (!!this.networkManager.playerId && (msg as any).hostId === this.networkManager.playerId) ||
              (msg.players.length > 0 && msg.players[0].id === this.networkManager.playerId);

            this.uiManager.showLobby(
              msg.roomId,
              isHost,
              msg.players,
              msg.gameMode
            );
          }
          break;
        }

        case 'STATE_CHANGE': {
          this.currentState = msg.state;
          this.roundTimer = msg.timer;

          if (msg.state === 'COUNTDOWN') {
            this.soundSystem.playCountdownBeep(false);
          } else if (msg.state === 'PLAYING') {
            this.soundSystem.playRoundStart();
            this.uiManager.showHUD(this.localNumber);
            this.minimap.show();
            if (!this.hasSpawned) {
              // Ensure player is at ground level immediately rather than high preview camera
              this.cameraController.setSpawn([0, 0, 0], 0);
            }
          } else if (msg.state === 'ROUND_END') {
            this.hasSpawned = false;
            this.minimap.hide();
            const playersList = Array.from(this.playersMap.values());
            const winner = playersList.sort((a, b) => b.score - a.score)[0];
            this.uiManager.showRoundEnd(playersList, winner?.name || 'Top Agent');
          } else if (msg.state === 'LOBBY') {
            this.hasSpawned = false;
            this.minimap.hide();
          }
          break;
        }

        case 'NUMBER_SELECTION_REQUIRED': {
          this.uiManager.showChooseNumberScreen(msg.durationSec, msg.isRespawn);
          break;
        }

        case 'GAME_SNAPSHOT': {
          this.roundTimer = msg.timer;
          this.playerManager.updateFromSnapshot(msg.players, this.playersMap, this.networkManager.playerId);

          // Update local player state from snapshot
          const selfSnap = msg.players.find((p) => p.id === this.networkManager.playerId);
          if (selfSnap) {
            this.localScore = selfSnap.score;
            this.localKills = selfSnap.kills;
            this.localDeaths = selfSnap.deaths;
            if (selfSnap.visibleNumber) {
              this.localNumber = selfSnap.visibleNumber;
            }

            // Align local camera with authoritative spawn position on ground upon entering match or respawning
            if (this.currentState === 'PLAYING' || this.currentState === 'COUNTDOWN') {
              if (!this.hasSpawned || (this.wasDead && !selfSnap.isDead)) {
                this.cameraController.setSpawn(selfSnap.position, selfSnap.rotationY);
                this.inputManager.yaw = selfSnap.rotationY;
                this.inputManager.pitch = 0;
                this.hasSpawned = true;
              }
            }
            this.wasDead = selfSnap.isDead;
          }
          break;
        }

        case 'ELIMINATION_EVENT': {
          this.uiManager.addEliminationFeedItem(msg.attackerName, msg.victimName, msg.eliminatedNumber);

          // Find victim position for VFX
          const victim = this.playerManager.getRemotePlayer(msg.victimId);
          if (victim) {
            this.particleSystem.spawnEliminationEffect([
              victim.currentPos.x,
              victim.currentPos.y + 1,
              victim.currentPos.z
            ]);
          } else {
            this.particleSystem.spawnEliminationEffect([
              this.cameraController.position.x,
              this.cameraController.position.y,
              this.cameraController.position.z
            ]);
          }

          if (msg.isSelfAttacker) {
            this.localScore = msg.attackerScore;
            this.uiManager.showEliminationSuccess(msg.victimName, msg.eliminatedNumber);
          }
          break;
        }

        case 'ELIMINATION_REJECTED': {
          this.uiManager.showEliminationRejected(msg.message, msg.cooldownSeconds);
          break;
        }

        case 'GADGET_TRIGGERED': {
          if (msg.gadgetType === 'smoke') {
            this.soundSystem.playGadgetSmoke();
            this.particleSystem.spawnSmoke(msg.id, msg.position, msg.duration, 6.0);
          } else if (msg.gadgetType === 'flash') {
            this.soundSystem.playGadgetFlash();
            this.particleSystem.spawnFlashEffect(msg.position, GAME_CONSTANTS.FLASH_RADIUS);

            // Check distance to player camera for blinding flash overlay
            const camPos = this.cameraController.camera.position;
            const flashPos = new THREE.Vector3(msg.position[0], msg.position[1], msg.position[2]);
            const dist = camPos.distanceTo(flashPos);
            if (dist <= GAME_CONSTANTS.FLASH_RADIUS) {
              const intensity = Math.max(0.35, 1.0 - (dist / GAME_CONSTANTS.FLASH_RADIUS) * 0.65);
              this.uiManager.triggerFlashbang(intensity, GAME_CONSTANTS.FLASH_DURATION_SEC);
            }
          } else if (msg.gadgetType === 'camera') {
            this.soundSystem.playCameraShutter();
            this.uiManager.triggerCameraShutterFlash();
            if (msg.capturedNumber) {
              this.uiManager.showSpyCameraPhotoCard(msg.capturedNumber);
            } else if (msg.ownerId === this.networkManager.playerId) {
              this.uiManager.showNotification('📷 SPY SATELLITE: NO TARGET IN DIRECT SIGHT');
            }
          }
          break;
        }
      }
    });
  }

  private setupUICallbacks(): void {
    this.uiManager.onCreateRoom = async () => {
      const connected = await this.ensureConnected();
      if (!connected) {
        this.uiManager.showMenuError('Sunucuya bağlanılamadı. Lütfen sunucunun açık olduğundan veya internet bağlantınızdan emin olun.');
        return;
      }
      this.networkManager.createRoom(
        this.uiManager.playerName,
        this.uiManager.gameMode,
        this.uiManager.playerColor,
        this.uiManager.playerAccessory
      );
    };

    this.uiManager.onJoinRoom = async (code: string) => {
      const connected = await this.ensureConnected();
      if (!connected) {
        this.uiManager.showMenuError('Sunucuya bağlanılamadı. Lütfen sunucunun açık olduğundan veya internet bağlantınızdan emin olun.');
        return;
      }
      this.networkManager.joinRoom(
        code,
        this.uiManager.playerName,
        this.uiManager.playerColor,
        this.uiManager.playerAccessory
      );
    };

    this.uiManager.onSetReady = (ready: boolean) => {
      this.networkManager.setReady(ready);
    };

    this.uiManager.onStartGame = () => {
      this.networkManager.startGame();
    };

    this.uiManager.onNumberSelected = (num: string) => {
      this.localNumber = num;
      this.networkManager.selectNumber(num);

      // Re-enter the arena HUD immediately after number confirmation
      if (this.currentState === 'PLAYING') {
        this.uiManager.showHUD(this.localNumber);
        if (window.innerWidth > 768) {
          this.minimap.show();
        }
      }
    };

    this.uiManager.onEliminationAttempt = (targetId: string, guessedNumber: string) => {
      this.networkManager.attemptElimination(targetId, guessedNumber);
    };

    this.uiManager.onGadgetClick = (gadget: GadgetType) => {
      this.handleGadgetAction(gadget);
    };

    this.uiManager.onQualityChange = (q: 'low' | 'medium' | 'high') => {
      this.worldBuilder.setGraphicsQuality(q);
    };
  }

  private setupInputCallbacks(): void {
    this.inputManager.onDecodeToggle = () => {
      if (this.currentState === 'PLAYING') {
        const target = this.playerManager.getTargetInCrosshair(
          this.cameraController.camera,
          this.worldBuilder.obstacles
        );
        this.uiManager.toggleKeypad(target?.id, target?.name);
      }
    };

    this.inputManager.onGadgetUse = (slot: number) => {
      const gadgets: GadgetType[] = ['smoke', 'flash', 'camera', 'binoculars'];
      const gadget = gadgets[slot - 1];
      if (gadget) {
        this.handleGadgetAction(gadget);
      }
    };

    this.inputManager.onDebugToggle = (key: string) => {
      if (key === 'F1') {
        this.isDebugVisible = !this.isDebugVisible;
        const debugElem = document.getElementById('debug-overlay');
        if (debugElem) {
          debugElem.classList.toggle('visible', this.isDebugVisible);
        }
      }
    };
  }

  private handleGadgetAction(gadget: GadgetType): void {
    if (this.currentState !== 'PLAYING') return;

    // Do NOT trigger gadgets when player is typing numeric cipher into keypad modal
    if (this.uiManager.isKeypadOpen) return;

    if (gadget === 'binoculars') {
      this.cameraController.toggleZoom();
      return;
    }

    // Check 15-second cooldown
    if (this.uiManager.isGadgetOnCooldown(gadget)) {
      return;
    }

    const camPos = this.cameraController.camera.position;
    const forward = this.cameraController.getForwardDirection();
    const throwDist = 6.5;
    const spawnY = Math.max(0.6, camPos.y + forward.y * throwDist);
    const targetPos: [number, number, number] = [
      camPos.x + forward.x * throwDist,
      spawnY,
      camPos.z + forward.z * throwDist
    ];

    this.uiManager.startGadgetCooldown(gadget, GAME_CONSTANTS.GADGET_COOLDOWN_SEC);
    this.networkManager.useGadget(gadget, targetPos);
  }

  private async ensureConnected(): Promise<boolean> {
    try {
      await this.networkManager.connect();
      return true;
    } catch (e) {
      console.warn('Network connect:', e);
      return false;
    }
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);

    // 1. Update Camera and Local Movement
    if (this.currentState === 'PLAYING') {
      this.inputManager.update(delta);
      const moveInput = this.inputManager.getMovementInput();
      this.cameraController.update(
        delta,
        moveInput,
        this.inputManager.yaw,
        this.inputManager.pitch
      );

      // Send input snapshot to server at 20 Hz
      const now = performance.now();
      if (now - this.lastInputSendTime >= 50) {
        this.lastInputSendTime = now;
        this.inputSequence++;
        this.networkManager.sendPlayerInput(
          this.inputSequence,
          [
            this.cameraController.position.x,
            this.cameraController.position.y,
            this.cameraController.position.z
          ],
          this.cameraController.yaw,
          this.cameraController.pitch,
          [
            this.cameraController.velocity.x,
            this.cameraController.velocity.y,
            this.cameraController.velocity.z
          ],
          this.cameraController.isCrouching,
          this.cameraController.isSprinting,
          this.cameraController.isMoving
        );
      }

      // Check crosshair target using centralized VisibilitySystem
      const target = this.playerManager.getTargetInCrosshair(
        this.cameraController.camera,
        this.worldBuilder.obstacles
      );

      // Update minimap (local player and obstacles only)
      this.minimap.update(
        this.cameraController.position,
        this.cameraController.yaw
      );

      this.uiManager.updateHUD(
        this.roundTimer,
        this.localScore,
        this.localKills,
        this.localDeaths,
        target
      );
    }

    // 2. Update Remote Players (position interpolation, animations, 60 FPS visibility)
    this.playerManager.update(delta, this.cameraController.camera, this.worldBuilder.obstacles);

    // 3. Update Particles
    this.particleSystem.update(delta);

    // 4. Render
    this.renderer.render(this.scene, this.cameraController.camera);

    // 5. Debug Stats
    this.frameCount++;
    const nowTime = performance.now();
    if (nowTime - this.lastFpsTime >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = nowTime;

      if (this.isDebugVisible) {
        const fpsElem = document.getElementById('debug-fps');
        const pingElem = document.getElementById('debug-ping');
        const posElem = document.getElementById('debug-pos');
        if (fpsElem) fpsElem.innerText = this.currentFps.toString();
        if (pingElem) pingElem.innerText = `${this.networkManager.pingMs}ms`;
        if (posElem) {
          const p = this.cameraController.position;
          posElem.innerText = `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
        }
      }
    }
  };
}
