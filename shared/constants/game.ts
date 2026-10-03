export const GAME_CONSTANTS = {
  // Map dimensions
  MAP_SIZE: 100, // 100m x 100m

  // Sight & Number Reading rules (Centrally configured)
  NUMBER_READ_DISTANCE: 16.0, // 16 meters default readable distance (Section 7: 12-18m)
  MAX_READING_DISTANCE: 16.0, // Alias for server & tests
  BINOCULARS_READING_DISTANCE: 40.0, // Zoomed in reading distance

  // Field of View check: observer camera forward vs direction to target
  // cos(45 deg) = 0.707 (within 45 degrees of camera center, Section 6)
  NUMBER_FOV_COSINE: 0.707,

  // Target facing check: forehead normal vector (forward) vs vector toward viewer
  // target.forward . (viewer - target) > NUMBER_FACE_THRESHOLD
  NUMBER_FACE_THRESHOLD: 0.15, // Section 8
  MIN_FACING_DOT_PRODUCT: 0.15, // Alias for server & tests

  // Head & Body Heights
  HEAD_HEIGHT_STANDING: 1.65,
  HEAD_HEIGHT_CROUCHING: 1.05,
  PLAYER_RADIUS: 0.42,

  // Movement & Physics Feel (Centrally configured, Section 41)
  WALK_SPEED: 4.5, // Natural walking speed (m/s)
  SPEED_WALK: 4.5, // Alias
  RUN_SPEED: 8.5, // Distinct, noticeably faster sprint speed (m/s)
  SPEED_SPRINT: 8.5, // Alias
  CROUCH_SPEED: 2.6, // Stealth crouch speed (m/s)
  SPEED_CROUCH: 2.6, // Alias

  ACCELERATION: 16.0, // Responsive, smooth acceleration (m/s^2)
  DECELERATION: 22.0, // Snappy braking without ice-skate slide (m/s^2)
  AIR_ACCELERATION: 5.0, // In-air maneuverability
  TURN_SPEED: 12.0, // Remote player rotation slerp speed
  GRAVITY: 22.0, // Grounded gravity (m/s^2)
  JUMP_FORCE: 7.0, // Crisp jump impulse
  CAMERA_SENSITIVITY: 0.0022,

  // Elimination rules
  WRONG_GUESS_COOLDOWN_SEC: 5.0,
  SPAWN_PROTECTION_SEC: 4.0,
  CHOOSE_NUMBER_TIME_SEC: 10,
  ROUND_DURATION_DEATHMATCH_SEC: 300, // 5 minutes

  // Server tick rate
  SERVER_TICK_RATE: 20, // 20 Hz
  SNAPSHOT_RATE: 20,

  // Gadgets
  SMOKE_RADIUS: 6.0,
  SMOKE_DURATION_SEC: 12.0,
  FLASH_RADIUS: 16.0,
  FLASH_DURATION_SEC: 4.5,
  CAMERA_DURATION_SEC: 5.0,

  // Scoring
  SCORE_PER_ELIMINATION: 100,
  SCORE_PENALTY_WRONG_GUESS: -20,
  SCORE_STREAK_BONUS: 25,

  // Default customization colors
  COLOR_PALETTE: [
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F97316' // Orange
  ]
};
