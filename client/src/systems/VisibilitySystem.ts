import * as THREE from 'three';
import { GAME_CONSTANTS } from '@shared/constants/game';
import { BoundingBox } from '@shared/types/game';
import { rayIntersectsAABB, v3 } from '@shared/utils/math';

export interface VisibilityTarget {
  position: THREE.Vector3;
  rotationY: number;
  isCrouching: boolean;
  isDead: boolean;
  isSpawnProtected?: boolean;
}

export class VisibilitySystem {
  /**
   * Centralized visibility check evaluating all gameplay visibility conditions:
   * 1. Target exists and is alive
   * 2. Target is within maximum readable distance
   * 3. Target is within observer's camera FOV cone
   * 4. Target forehead is facing toward observer
   * 5. Unobstructed line-of-sight raycast from observer eye to target forehead
   */
  public static isNumberVisible(
    observerCamera: THREE.PerspectiveCamera | THREE.Camera,
    target: VisibilityTarget,
    obstacles: BoundingBox[],
    customMaxDistance?: number
  ): boolean {
    // 1. Alive check
    if (target.isDead) {
      return false;
    }

    const maxDist = customMaxDistance || GAME_CONSTANTS.NUMBER_READ_DISTANCE;

    // 2. Head / Forehead position of target
    const headHeight = target.isCrouching
      ? GAME_CONSTANTS.HEAD_HEIGHT_CROUCHING
      : GAME_CONSTANTS.HEAD_HEIGHT_STANDING;

    const targetForeheadPos = new THREE.Vector3(
      target.position.x,
      target.position.y + headHeight,
      target.position.z
    );

    const observerPos = observerCamera.position;
    const diff = new THREE.Vector3().subVectors(targetForeheadPos, observerPos);
    const dist = diff.length();

    // 3. Distance check
    if (dist > maxDist || dist < 0.2) {
      return false;
    }

    const dirToTarget = diff.clone().divideScalar(dist);

    // 4. Observer Field Of View check:
    // Camera forward vector: (-sin(yaw), 0, -cos(yaw)) or getWorldDirection()
    const cameraForward = new THREE.Vector3();
    observerCamera.getWorldDirection(cameraForward);

    // Dot product between camera forward and direction to target forehead
    const fovDot = cameraForward.dot(dirToTarget);
    if (fovDot < GAME_CONSTANTS.NUMBER_FOV_COSINE) {
      return false;
    }

    // 5. Target Forehead Facing check:
    // Target forward direction: in our standard coordinate system, forward is (-sin(yaw), 0, -cos(yaw))
    const targetForward = new THREE.Vector3(
      -Math.sin(target.rotationY),
      0,
      -Math.cos(target.rotationY)
    );

    // Vector from target to observer (horizontal plane)
    const toObserverHoriz = new THREE.Vector3(
      observerPos.x - target.position.x,
      0,
      observerPos.z - target.position.z
    );
    const horizDist = toObserverHoriz.length();

    if (horizDist > 0.05) {
      toObserverHoriz.divideScalar(horizDist);
      const faceDot = targetForward.dot(toObserverHoriz);
      if (faceDot < GAME_CONSTANTS.NUMBER_FACE_THRESHOLD) {
        return false; // Target forehead is turned away from observer
      }
    }

    // 6. Line of Sight Raycast check:
    // Ray from observer eye to target forehead must not intersect any obstacle
    const rayOrigin = v3(observerPos.x, observerPos.y, observerPos.z);
    const rayDir = v3(dirToTarget.x, dirToTarget.y, dirToTarget.z);
    // Shorten check distance slightly (0.15m) to avoid self/target boundary clipping
    const checkDist = Math.max(0, dist - 0.15);

    for (const box of obstacles) {
      if (rayIntersectsAABB(rayOrigin, rayDir, box, checkDist)) {
        return false; // Obstructed by environmental object (crate, container, barrier, wall, etc.)
      }
    }

    return true;
  }
}
