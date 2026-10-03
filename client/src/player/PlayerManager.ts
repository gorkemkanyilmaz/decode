import * as THREE from 'three';
import { CharacterModel } from './CharacterModel';
import { ClientPlayerSnapshot, PlayerPublicInfo } from '@shared/types/game';

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
  visibleNumber: string | null;
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

  public updateFromSnapshot(
    snapshots: ClientPlayerSnapshot[],
    playersPublicInfo: Map<string, PlayerPublicInfo>
  ): void {
    const presentIds = new Set<string>();

    for (const snap of snapshots) {
      presentIds.add(snap.id);

      if (snap.id === this.localPlayerId) {
        // Local player handled separately by camera/controller
        continue;
      }

      let remote = this.remotePlayers.get(snap.id);
      if (!remote) {
        // Instantiate new character
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
          visibleNumber: snap.visibleNumber,
          name: info?.name || 'Agent'
        };

        this.remotePlayers.set(snap.id, remote);
      }

      // Update interpolation targets
      remote.targetPos.set(snap.position[0], snap.position[1], snap.position[2]);
      remote.targetYaw = snap.rotationY;
      remote.pitch = snap.pitch;
      remote.isMoving = snap.isMoving;
      remote.isSprinting = snap.isSprinting;
      remote.isCrouching = snap.isCrouching;
      remote.isDead = snap.isDead;
      remote.isSpawnProtected = snap.isSpawnProtected;
      remote.visibleNumber = snap.visibleNumber;

      // Update forehead badge display
      remote.model.foreheadBadge.setNumber(snap.visibleNumber);
    }

    // Remove disconnected players
    for (const [id, remote] of this.remotePlayers.entries()) {
      if (!presentIds.has(id)) {
        this.scene.remove(remote.model.group);
        this.remotePlayers.delete(id);
      }
    }
  }

  public update(delta: number): void {
    const lerpFactor = Math.min(1.0, delta * 15);

    for (const remote of this.remotePlayers.values()) {
      // Position lerp
      remote.currentPos.lerp(remote.targetPos, lerpFactor);
      remote.model.group.position.copy(remote.currentPos);

      // Angle interpolation
      let angleDiff = remote.targetYaw - remote.currentYaw;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      remote.currentYaw += angleDiff * lerpFactor;

      remote.model.group.rotation.y = remote.currentYaw;
      remote.model.headGroup.rotation.x = remote.pitch;

      remote.model.updateAnimation(
        delta,
        remote.isMoving,
        remote.isSprinting,
        remote.isCrouching,
        remote.isDead,
        remote.isSpawnProtected
      );
    }
  }

  /**
   * Finds the best opponent currently targeted by the player's crosshair (ray from camera forward)
   */
  public getTargetInCrosshair(
    cameraPos: THREE.Vector3,
    cameraDir: THREE.Vector3,
    maxDistance: number = 30
  ): { id: string; name: string; isForeheadVisible: boolean; dist: number } | null {
    let closestTarget: { id: string; name: string; isForeheadVisible: boolean; dist: number } | null = null;
    let minAngle = 0.25; // within ~14 degrees cone of crosshair

    for (const [id, remote] of this.remotePlayers.entries()) {
      if (remote.isDead) continue;

      const headPos = new THREE.Vector3(
        remote.currentPos.x,
        remote.currentPos.y + (remote.isCrouching ? 1.05 : 1.65),
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
        closestTarget = {
          id,
          name: remote.name,
          isForeheadVisible: remote.visibleNumber !== null,
          dist
        };
      }
    }

    return closestTarget;
  }

  public getPlayerCount(): number {
    return this.remotePlayers.size + (this.localPlayerId ? 1 : 0);
  }

  public clear(): void {
    for (const remote of this.remotePlayers.values()) {
      this.scene.remove(remote.model.group);
    }
    this.remotePlayers.clear();
  }
}
