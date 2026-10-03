import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  v3,
  isLineOfSightClear,
  isForeheadFacingViewer,
  isViewerLookingAtTarget,
  isValidFourDigitNumber,
  rayIntersectsAABB
} from '../shared/utils/math';
import { BoundingBox } from '../shared/types/game';

describe('DECODED Math & Game Rules Tests', () => {
  it('validates 4-digit numbers with leading zeros correctly', () => {
    assert.strictEqual(isValidFourDigitNumber('0047'), true);
    assert.strictEqual(isValidFourDigitNumber('1829'), true);
    assert.strictEqual(isValidFourDigitNumber('9999'), true);
    assert.strictEqual(isValidFourDigitNumber('0000'), true);
    assert.strictEqual(isValidFourDigitNumber('123'), false);
    assert.strictEqual(isValidFourDigitNumber('12345'), false);
    assert.strictEqual(isValidFourDigitNumber('abcd'), false);
    assert.strictEqual(isValidFourDigitNumber(''), false);
  });

  it('detects ray-AABB intersections accurately', () => {
    const box: BoundingBox = {
      min: [-1, 0, -1],
      max: [1, 2, 1]
    };
    // Ray pointing directly at box
    const hit = rayIntersectsAABB(v3(0, 1, -5), v3(0, 0, 1), box, 10);
    assert.strictEqual(hit, true);

    // Ray pointing away from box
    const miss = rayIntersectsAABB(v3(0, 1, -5), v3(0, 0, -1), box, 10);
    assert.strictEqual(miss, false);

    // Ray pointing parallel to box
    const missParallel = rayIntersectsAABB(v3(5, 1, -5), v3(0, 0, 1), box, 10);
    assert.strictEqual(missParallel, false);
  });

  it('verifies line of sight is blocked by intervening obstacle', () => {
    const crate: BoundingBox = {
      min: [-1, 0, 4],
      max: [1, 2, 6]
    };
    const eyePos = v3(0, 1.6, 0);
    const targetHeadBehindCrate = v3(0, 1.6, 10);
    const targetHeadToSide = v3(5, 1.6, 10);

    const blocked = isLineOfSightClear(eyePos, targetHeadBehindCrate, [crate]);
    assert.strictEqual(blocked, false, 'Line of sight should be blocked when target is behind crate');

    const clear = isLineOfSightClear(eyePos, targetHeadToSide, [crate]);
    assert.strictEqual(clear, true, 'Line of sight should be clear when target is out of crate cover');
  });

  it('correctly determines whether target forehead is facing viewer', () => {
    const viewerPos = v3(0, 1.6, 0);
    const targetPos = v3(0, 0, 10);

    // If target is at (0, 0, 10) and viewer is at (0, 1.6, 0):
    // Viewer is in direction -Z from target.
    // In Three.js: yaw = 0 points towards -Z.
    // So target yaw = 0 means target faces towards viewer!
    const facing = isForeheadFacingViewer(targetPos, 0, viewerPos);
    assert.strictEqual(facing, true, 'Target facing -Z (towards viewer) should be readable');

    // Target yaw = Math.PI means target faces towards +Z (away from viewer)
    const turnedAway = isForeheadFacingViewer(targetPos, Math.PI, viewerPos);
    assert.strictEqual(turnedAway, false, 'Target turned around should hide their forehead number');
  });

  it('verifies viewer looking at target frustum check', () => {
    const viewerPos = v3(0, 1.6, 0);
    const targetPos = v3(0, 1.6, 10); // Target is in +Z direction
    // If viewer looks towards +Z (yaw = Math.PI):
    const lookingAt = isViewerLookingAtTarget(viewerPos, Math.PI, targetPos);
    assert.strictEqual(lookingAt, true);

    // If viewer looks towards -Z (yaw = 0):
    const lookingAway = isViewerLookingAtTarget(viewerPos, 0, targetPos);
    assert.strictEqual(lookingAway, false);
  });
});
