import { BoundingBox } from '../types/game';
import { GAME_CONSTANTS } from '../constants/game';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function v3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function v3FromArray(arr: [number, number, number]): Vec3 {
  return { x: arr[0], y: arr[1], z: arr[2] };
}

export function v3Distance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function v3DistanceSq(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function v3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function v3Normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function v3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Returns forward direction vector given yaw rotation (rotation around Y in radians)
 * In Three.js / standard 3D:
 * rotationY = 0 points towards -Z or +Z depending on setup.
 * Standard Three.js: player looks towards -Z when yaw=0:
 * forward = ( -sin(yaw), 0, -cos(yaw) )
 */
export function getForwardVector(yaw: number): Vec3 {
  return {
    x: -Math.sin(yaw),
    y: 0,
    z: -Math.cos(yaw)
  };
}

/**
 * Fast Ray - Axis-Aligned Bounding Box (AABB) intersection.
 * Returns true if the ray from `origin` in direction `dir` intersects the box between tmin and tmax.
 */
export function rayIntersectsAABB(
  origin: Vec3,
  dir: Vec3,
  box: BoundingBox,
  maxDist: number
): boolean {
  let tmin = 0.0;
  let tmax = maxDist;

  // X axis
  if (Math.abs(dir.x) < 1e-6) {
    if (origin.x < box.min[0] || origin.x > box.max[0]) return false;
  } else {
    const invD = 1.0 / dir.x;
    let t1 = (box.min[0] - origin.x) * invD;
    let t2 = (box.max[0] - origin.x) * invD;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  // Y axis
  if (Math.abs(dir.y) < 1e-6) {
    if (origin.y < box.min[1] || origin.y > box.max[1]) return false;
  } else {
    const invD = 1.0 / dir.y;
    let t1 = (box.min[1] - origin.y) * invD;
    let t2 = (box.max[1] - origin.y) * invD;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  // Z axis
  if (Math.abs(dir.z) < 1e-6) {
    if (origin.z < box.min[2] || origin.z > box.max[2]) return false;
  } else {
    const invD = 1.0 / dir.z;
    let t1 = (box.min[2] - origin.z) * invD;
    let t2 = (box.max[2] - origin.z) * invD;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  return tmax >= 0.0 && tmin <= maxDist;
}

/**
 * Checks if line of sight between eye and target forehead is blocked by any obstacle.
 */
export function isLineOfSightClear(
  eyePos: Vec3,
  targetForeheadPos: Vec3,
  obstacles: BoundingBox[]
): boolean {
  const diff = v3Sub(targetForeheadPos, eyePos);
  const dist = Math.sqrt(diff.x * diff.x + diff.y * diff.y + diff.z * diff.z);
  if (dist === 0) return true;
  const dir = { x: diff.x / dist, y: diff.y / dist, z: diff.z / dist };

  // Slightly shorten max distance so we don't self-intersect or intersect target's bounding box
  const checkDist = Math.max(0, dist - 0.2);

  for (const box of obstacles) {
    if (rayIntersectsAABB(eyePos, dir, box, checkDist)) {
      return false; // Occluded by obstacle!
    }
  }
  return true;
}

/**
 * Checks if target forehead is facing toward viewer.
 * `targetForward` is the direction the target's face/forehead is pointing.
 * Vector from target to viewer is `dirToViewer`.
 * Forehead is readable if dot product of targetForward and dirToViewer > MIN_FACING_DOT_PRODUCT.
 */
export function isForeheadFacingViewer(
  targetPos: Vec3,
  targetYaw: number,
  viewerEyePos: Vec3,
  minDot: number = GAME_CONSTANTS.MIN_FACING_DOT_PRODUCT
): boolean {
  const targetForward = getForwardVector(targetYaw);
  const diff = v3Sub(viewerEyePos, targetPos);
  const len = Math.sqrt(diff.x * diff.x + diff.z * diff.z); // horizontal facing
  if (len < 0.001) return true; // Right on top
  const dirToViewerHorizontal = { x: diff.x / len, y: 0, z: diff.z / len };

  const dot = v3Dot(targetForward, dirToViewerHorizontal);
  return dot > minDot;
}

/**
 * Checks if viewer is looking towards target (Frustum/FOV check).
 */
export function isViewerLookingAtTarget(
  viewerEyePos: Vec3,
  viewerYaw: number,
  targetPos: Vec3,
  fovCosine: number = 0.5 // ~60 degree half-angle (120 deg FOV cone)
): boolean {
  const viewerForward = getForwardVector(viewerYaw);
  const diff = v3Sub(targetPos, viewerEyePos);
  const len = Math.sqrt(diff.x * diff.x + diff.z * diff.z);
  if (len < 0.001) return true;
  const dirToTarget = { x: diff.x / len, y: 0, z: diff.z / len };

  const dot = v3Dot(viewerForward, dirToTarget);
  return dot > fovCosine;
}

/**
 * Validates a 4-digit number string
 */
export function isValidFourDigitNumber(num: string): boolean {
  return /^[0-9]{4}$/.test(num);
}
