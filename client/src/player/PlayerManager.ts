import * as THREE from 'three';
import { CharacterModel } from './CharacterModel';
import { ClientPlayerSnapshot, PlayerPublicInfo, BoundingBox } from '@shared/types/game';
import { VisibilitySystem } from '../systems/VisibilitySystem';
import { GAME_CONSTANTS } from '@shared/constants/game';

interface RemotePlayerData {
  model: CharacterModel;
  targetPos: THREE.Vector3;
  currentPos: THREE.Vector3;
  targetYaw: number;
  currentYaw: number;
  pitch: number;
  isMoving: boolean;
  isSprinting: boolean;
  isCrouching: boolean;
  isDead: boolean;
  isSpawnProtected: boolean;
  revealedNumber: string | null;
  name: string;
}

export class PlayerManager {
  private scene: THREE.Scene;
  private remotePlayers: Map<string, RemotePlayerData> = new Map();
  public localPlayerId: string = '';
  public localPlayerCustomization: any = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public getRemotePlayer(id: string): RemotePlayerData | undefined {
    return this.remotePlayers.get(id);
  }

  public updateFromSnapshot(
    snapshots: ClientPlayerSnapshot[],
    playersPublicInfo: Map<string, PlayerPublicInfo>,
    currentLocalId?: string
  ): void {
    if (currentLocalId) {
      this.localPlayerId = currentLocalId;
    }

    // Clean up local player if it was mistakenly registered in remotePlayers
    if (this.localPlayerId && this.remotePlayers.has(this.localPlayerId)) {
      const selfRemote = this.remotePlayers.get(this.localPlayerId);
      if (selfRemote) {
        this.scene.remove(selfRemote.model.group);
        this.remotePlayers.delete(this.localPlayerId);
      }
    }

    // If local player ID is not yet confirmed, wait for identification before spawning remotes
    if (!this.localPlayerId) {
      return;
    }

    const presentIds = new Set<string>();

    for (const snap of snapshots) {
      presentIds.add(snap.id);

      if (snap.id === this.localPlayerId) {
        continue;
      }

      let remote = this.remotePlayers.get(snap.id);
      if (!remote) {
        const info = playersPublicInfo.get(snap.id);
        const customization = info?.customization || {
          color: '#3B82F6',
          accessory: 'fedora',
          suitColor: '#1E293B'
        };

        const model = new CharacterModel(customization, false);
        model.group.position.set(snap.position[0], snap.position[1], snap.position[2]);
        this.scene.add(model.group);

        remote = {
          model,
          targetPos: new THREE.Vector3(snap.position[0], snap.position[1], snap.position[2]),
          currentPos: new THREE.Vector3(snap.position[0], snap.position[1], snap.position[2]),
          targetYaw: snap.rotationY,
          currentYaw: snap.rotationY,
          pitch: snap.pitch,
          isMoving: snap.isMoving,
          isSprinting: snap.isSprinting,
          isCrouching: snap.isCrouching,
          isDead: snap.isDead,
          isSpawnProtected: snap.isSpawnProtected,
          revealedNumber: snap.visibleNumber,
          name: info?.name || 'Agent'
        };

        this.remotePlayers.set(snap.id, remote);
      }

      // Update movement targets
      remote.targetPos.set(snap.position[0], snap.position[1], snap.position[2]);
      remote.targetYaw = snap.rotationY;
      remote.pitch = snap.pitch;
      remote.isMoving = snap.isMoving;
      remote.isSprinting = snap.isSprinting;
      remote.isCrouching = snap.isCrouching;
      remote.isDead = snap.isDead;
      remote.isSpawnProtected = snap.isSpawnProtected;

      // When the server sends a revealed number, update the forehead badge
      if (snap.visibleNumber) {
        remote.revealedNumber = snap.visibleNumber;
        remote.model.setNumber(snap.visibleNumber);
      }
    }

    // Clean up disconnected players
    for (const [id, remote] of this.remotePlayers.entries()) {
      if (!presentIds.has(id)) {
        this.scene.remove(remote.model.group);
        this.remotePlayers.delete(id);
      }
    }
  }

  /**
   * Updates remote player positions, rotations, animations, and dynamic 60 FPS visibility
   */
  public update(delta: number, camera?: THREE.Camera, obstacles?: BoundingBox[]): void {
    const lerpFactor = Math.min(1.0, delta * GAME_CONSTANTS.TURN_SPEED);

    for (const remote of this.remotePlayers.values()) {
      // 1. Position interpolation
      remote.currentPos.lerp(remote.targetPos, lerpFactor);
      remote.model.group.position.copy(remote.currentPos);

      // 2. Shortest-path yaw rotation
      let angleDiff = remote.targetYaw - remote.currentYaw;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      remote.currentYaw += angleDiff * lerpFactor;

      remote.model.group.rotation.y = remote.currentYaw;
      remote.model.headGroup.rotation.x = remote.pitch;

      // 3. Grounded procedural animation (walk, run, lean, swing, breathing)
      remote.model.updateAnimation(
        delta,
        remote.isMoving,
        remote.isSprinting,
        remote.isCrouching,
        remote.isDead,
        remote.isSpawnProtected
      );

      // Prevent near-clipping artifacts if a player is standing right against the camera lens
      if (camera) {
        const distToCam = camera.position.distanceTo(remote.currentPos);
        remote.model.headGroup.visible = distToCam > 0.42;
      }

      // 4. Client-side instantaneous visibility check (Section 47 & 48)
      if (camera && obstacles) {
        const isVisible = VisibilitySystem.isNumberVisible(
          camera,
          {
            position: remote.currentPos,
            rotationY: remote.currentYaw,
            isCrouching: remote.isCrouching,
            isDead: remote.isDead
          },
          obstacles
        );

        // Render the actual 4-digit number ONLY if visibility conditions are satisfied
        // If not visible (turned away, behind crate, out of FOV, too far): NOTHING is shown (no ????)
        remote.model.setNumberVisible(isVisible && remote.revealedNumber !== null);
      }
    }
  }

  /**
   * Finds the opponent currently in the player's crosshair cone
   */
  public getTargetInCrosshair(
    camera: THREE.PerspectiveCamera,
    obstacles: BoundingBox[],
    maxDistance: number = GAME_CONSTANTS.NUMBER_READ_DISTANCE
  ): { id: string; name: string; isForeheadVisible: boolean; dist: number } | null {
    let closestTarget: { id: string; name: string; isForeheadVisible: boolean; dist: number } | null = null;
    let minAngle = 0.22; // ~12 degrees cone of crosshair

    const cameraPos = camera.position;
    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);

    for (const [id, remote] of this.remotePlayers.entries()) {
      if (remote.isDead) continue;

      const headHeight = remote.isCrouching
        ? GAME_CONSTANTS.HEAD_HEIGHT_CROUCHING
        : GAME_CONSTANTS.HEAD_HEIGHT_STANDING;

      const headPos = new THREE.Vector3(
        remote.currentPos.x,
        remote.currentPos.y + headHeight,
        remote.currentPos.z
      );

      const toTarget = headPos.clone().sub(cameraPos);
      const dist = toTarget.length();
      if (dist > maxDistance) continue;

      toTarget.normalize();
      const dot = cameraDir.dot(toTarget);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

      if (angle < minAngle) {
        minAngle = angle;

        const isForeheadVisible = VisibilitySystem.isNumberVisible(
          camera,
          {
            position: remote.currentPos,
            rotationY: remote.currentYaw,
            isCrouching: remote.isCrouching,
            isDead: remote.isDead
          },
          obstacles,
          maxDistance
        );

        closestTarget = {
          id,
          name: remote.name,
          isForeheadVisible,
          dist
        };
      }
    }

    return closestTarget;
  }

  public getPlayerCount(): number {
    return this.remotePlayers.size + (this.localPlayerId ? 1 : 0);
  }

  /**
   * Returns positions of all remote players for minimap display
   */
  public getRemotePlayerPositions(): { position: THREE.Vector3; team: string }[] {
    const result: { position: THREE.Vector3; team: string }[] = [];
    for (const remote of this.remotePlayers.values()) {
      if (!remote.isDead) {
        result.push({
          position: remote.currentPos.clone(),
          team: 'none' // Team info not stored in RemotePlayerData, default to none
        });
      }
    }
    return result;
  }

  public clear(): void {
    for (const remote of this.remotePlayers.values()) {
      this.scene.remove(remote.model.group);
    }
    this.remotePlayers.clear();
  }
}
