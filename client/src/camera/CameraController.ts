import * as THREE from 'three';
import { GAME_CONSTANTS } from '@shared/constants/game';
import { WorldBuilder } from '../world/WorldBuilder';
import { SoundSystem } from '../audio/SoundSystem';

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public yaw: number = 0;
  public pitch: number = 0;

  public isCrouching: boolean = false;
  public isSprinting: boolean = false;
  public isMoving: boolean = false;
  public isGrounded: boolean = true;
  public isZoomed: boolean = false;

  private currentEyeHeight: number = GAME_CONSTANTS.HEAD_HEIGHT_STANDING;
  private headBobTimer: number = 0;
  private footstepTimer: number = 0;
  private worldBuilder: WorldBuilder;
  private soundSystem: SoundSystem;

  constructor(worldBuilder: WorldBuilder, soundSystem: SoundSystem) {
    this.worldBuilder = worldBuilder;
    this.soundSystem = soundSystem;

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
  }

  public setSpawn(pos: [number, number, number], rotY: number): void {
    this.position.set(pos[0], pos[1], pos[2]);
    this.velocity.set(0, 0, 0);
    this.yaw = rotY;
    this.pitch = 0;
    this.updateCameraTransform();
  }

  public toggleZoom(): boolean {
    this.isZoomed = !this.isZoomed;
    this.soundSystem.playBinocularZoom(this.isZoomed);
    return this.isZoomed;
  }

  public update(
    delta: number,
    moveInput: { moveX: number; moveZ: number; isSprinting: boolean; isCrouching: boolean; isJumping: boolean },
    yaw: number,
    pitch: number
  ): void {
    this.yaw = yaw;
    this.pitch = pitch;
    this.isCrouching = moveInput.isCrouching;
    this.isSprinting = moveInput.isSprinting && !this.isCrouching;

    // Smooth FOV zoom (75 normal, 25 zoomed in binoculars)
    const targetFov = this.isZoomed ? 25 : 75;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, delta * 12);
    this.camera.updateProjectionMatrix();

    // Determine current speed
    let speed = GAME_CONSTANTS.SPEED_WALK;
    if (this.isCrouching) speed = GAME_CONSTANTS.SPEED_CROUCH;
    else if (this.isSprinting) speed = GAME_CONSTANTS.SPEED_SPRINT;

    // Movement direction relative to camera yaw
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const moveDir = new THREE.Vector3()
      .addScaledVector(forward, moveInput.moveZ)
      .addScaledVector(right, moveInput.moveX);

    this.isMoving = moveDir.lengthSq() > 0.001;
    if (this.isMoving) {
      moveDir.normalize();
      this.velocity.x = moveDir.x * speed;
      this.velocity.z = moveDir.z * speed;
    } else {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, delta * 10);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, delta * 10);
    }

    // Jump & Gravity
    if (this.isGrounded && moveInput.isJumping) {
      this.velocity.y = GAME_CONSTANTS.JUMP_FORCE;
      this.isGrounded = false;
    }

    if (!this.isGrounded) {
      this.velocity.y -= GAME_CONSTANTS.GRAVITY * delta;
    }

    // Apply movement
    this.position.x += this.velocity.x * delta;
    this.position.y += this.velocity.y * delta;
    this.position.z += this.velocity.z * delta;

    // Ground floor collision
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Obstacle collision resolution
    const resolved = this.worldBuilder.resolveCollision(
      this.position,
      GAME_CONSTANTS.PLAYER_RADIUS,
      this.isCrouching ? GAME_CONSTANTS.HEAD_HEIGHT_CROUCHING : GAME_CONSTANTS.HEAD_HEIGHT_STANDING
    );
    this.position.x = resolved.x;
    this.position.y = resolved.y;
    this.position.z = resolved.z;

    // Eye height lerp (standing vs crouching)
    const targetHeight = this.isCrouching
      ? GAME_CONSTANTS.HEAD_HEIGHT_CROUCHING
      : GAME_CONSTANTS.HEAD_HEIGHT_STANDING;
    this.currentEyeHeight = THREE.MathUtils.lerp(this.currentEyeHeight, targetHeight, delta * 10);

    // Head bobbing & footsteps
    let bobOffset = 0;
    if (this.isMoving && this.isGrounded) {
      const bobSpeed = this.isSprinting ? 14 : 9;
      this.headBobTimer += delta * bobSpeed;
      bobOffset = Math.sin(this.headBobTimer) * (this.isSprinting ? 0.05 : 0.03);

      this.footstepTimer += delta * bobSpeed;
      if (this.footstepTimer >= Math.PI) {
        this.footstepTimer = 0;
        this.soundSystem.playFootstep(this.isSprinting);
      }
    } else {
      this.headBobTimer = 0;
    }

    this.updateCameraTransform(bobOffset);
  }

  private updateCameraTransform(bobOffset: number = 0): void {
    this.camera.position.set(
      this.position.x,
      this.position.y + this.currentEyeHeight + bobOffset,
      this.position.z
    );

    // Calculate rotation from yaw and pitch
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  public getForwardDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }
}
