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
  public isGrounded: boolean = false;
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
    const groundY = this.worldBuilder.getGroundHeight(this.position, GAME_CONSTANTS.PLAYER_RADIUS);
    this.isGrounded = this.position.y <= groundY + 0.05;
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

    // Pitch limits: clamp between -80 deg and +80 deg (-1.40 to +1.40 rad)
    const maxPitch = (Math.PI / 2) * 0.88;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));

    this.isCrouching = moveInput.isCrouching;
    this.isSprinting = moveInput.isSprinting && !this.isCrouching;

    // Smooth FOV zoom for binoculars
    const targetFov = this.isZoomed ? 25 : 75;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, delta * 12);
    this.camera.updateProjectionMatrix();

    // 1. Determine target speed
    let targetSpeed = GAME_CONSTANTS.WALK_SPEED;
    if (this.isCrouching) {
      targetSpeed = GAME_CONSTANTS.CROUCH_SPEED;
    } else if (this.isSprinting) {
      targetSpeed = GAME_CONSTANTS.RUN_SPEED;
    }

    // 2. Compute desired movement direction relative to camera yaw
    // In our coordinate system, forward is (-sin(yaw), 0, -cos(yaw))
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const moveDir = new THREE.Vector3()
      .addScaledVector(forward, moveInput.moveZ)
      .addScaledVector(right, moveInput.moveX);

    const inputMagnitude = Math.min(1.0, moveDir.length());
    this.isMoving = inputMagnitude > 0.05;

    let targetVelX = 0;
    let targetVelZ = 0;

    if (this.isMoving) {
      moveDir.normalize();
      targetVelX = moveDir.x * targetSpeed * inputMagnitude;
      targetVelZ = moveDir.z * targetSpeed * inputMagnitude;
    }

    // 3. Acceleration / Deceleration model
    const accelRate = this.isGrounded
      ? (this.isMoving ? GAME_CONSTANTS.ACCELERATION : GAME_CONSTANTS.DECELERATION)
      : GAME_CONSTANTS.AIR_ACCELERATION;

    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetVelX, accelRate, delta);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, targetVelZ, accelRate, delta);

    // 4. Vertical velocity, Jump & Gravity
    const playerHeight = this.isCrouching
      ? GAME_CONSTANTS.HEAD_HEIGHT_CROUCHING
      : GAME_CONSTANTS.HEAD_HEIGHT_STANDING;

    const currentGroundY = this.worldBuilder.getGroundHeight(
      this.position,
      GAME_CONSTANTS.PLAYER_RADIUS
    );

    // If player is in the air above ground level, unground them immediately
    if (this.position.y > currentGroundY + 0.05) {
      this.isGrounded = false;
    }

    if (this.isGrounded && moveInput.isJumping) {
      this.velocity.y = GAME_CONSTANTS.JUMP_FORCE;
      this.isGrounded = false;
    }

    if (!this.isGrounded) {
      this.velocity.y -= GAME_CONSTANTS.GRAVITY * delta;
    }

    // 5. Integrate position
    this.position.x += this.velocity.x * delta;
    this.position.y += this.velocity.y * delta;
    this.position.z += this.velocity.z * delta;

    // Overhead ceiling collision check: prevent jumping through overhead bottoms
    if (this.velocity.y > 0) {
      const headY = this.position.y + playerHeight;
      for (const b of this.worldBuilder.obstacles) {
        if (
          this.position.x >= b.min[0] &&
          this.position.x <= b.max[0] &&
          this.position.z >= b.min[2] &&
          this.position.z <= b.max[2]
        ) {
          if (headY >= b.min[1] && this.position.y < b.min[1]) {
            this.position.y = Math.max(0, b.min[1] - playerHeight);
            this.velocity.y = 0;
            break;
          }
        }
      }
    }

    // 6. Ground & obstacle top landing detection (when falling or stationary)
    const landingGroundY = this.worldBuilder.getGroundHeight(
      this.position,
      GAME_CONSTANTS.PLAYER_RADIUS
    );

    if (this.velocity.y <= 0 && this.position.y <= landingGroundY) {
      this.position.y = landingGroundY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // 7. Obstacle lateral collision resolution (cylinder vs map boxes)
    const resolved = this.worldBuilder.resolveCollision(
      this.position,
      GAME_CONSTANTS.PLAYER_RADIUS,
      playerHeight
    );
    this.position.x = resolved.x;
    this.position.z = resolved.z;

    // Re-verify ground height after lateral resolution
    const finalGroundY = this.worldBuilder.getGroundHeight(
      this.position,
      GAME_CONSTANTS.PLAYER_RADIUS
    );

    if (this.velocity.y <= 0 && this.position.y <= finalGroundY) {
      this.position.y = finalGroundY;
      this.velocity.y = 0;
      this.isGrounded = true;
    } else if (this.position.y > finalGroundY + 0.05) {
      this.isGrounded = false;
    }

    // 8. Eye height interpolation (standing vs crouching)
    const targetHeight = this.isCrouching
      ? GAME_CONSTANTS.HEAD_HEIGHT_CROUCHING
      : GAME_CONSTANTS.HEAD_HEIGHT_STANDING;
    this.currentEyeHeight = THREE.MathUtils.lerp(this.currentEyeHeight, targetHeight, delta * 12);

    // 9. Head bobbing & footsteps
    let bobOffset = 0;
    const horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);

    if (horizontalSpeed > 0.4 && this.isGrounded) {
      // Cadence: scales with speed
      const bobFreq = this.isSprinting ? 14.5 : 8.5;
      const bobAmp = this.isSprinting ? 0.045 : 0.025;
      this.headBobTimer += delta * bobFreq;
      bobOffset = Math.sin(this.headBobTimer) * bobAmp;

      this.footstepTimer += delta * bobFreq;
      if (this.footstepTimer >= Math.PI) {
        this.footstepTimer = 0;
        this.soundSystem.playFootstep(this.isSprinting);
      }
    } else {
      this.headBobTimer = 0;
      this.footstepTimer = 0;
    }

    this.updateCameraTransform(bobOffset);
  }

  private updateCameraTransform(bobOffset: number = 0): void {
    this.camera.position.set(
      this.position.x,
      this.position.y + this.currentEyeHeight + bobOffset,
      this.position.z
    );

    // Apply pitch (X) and yaw (Y) in 'YXZ' order to guarantee no roll/tilt
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  public getForwardDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }
}
