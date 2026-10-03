export const GAME_CONSTANTS = {
  // Map dimensions
  MAP_SIZE: 100, // 100m x 100m
  
  // Sight & Reading rules
  MAX_READING_DISTANCE: 28.0, // 28 meters default max distance to read 4 digits clearly
  BINOCULARS_READING_DISTANCE: 60.0, // With binoculars zoomed in
  // Dot product threshold: forehead normal vector (forward) vs vector toward viewer
  // For target's forehead to face viewer, target.forward . (viewer - target) > 0.15
  MIN_FACING_DOT_PRODUCT: 0.12, // approx ~83 degrees angle
  
  // Head Heights
  HEAD_HEIGHT_STANDING: 1.65,
  HEAD_HEIGHT_CROUCHING: 1.05,
  PLAYER_RADIUS: 0.45,
  
  // Movement
  SPEED_WALK: 5.5,
  SPEED_SPRINT: 8.8,
  SPEED_CROUCH: 3.0,
  JUMP_FORCE: 6.5,
  GRAVITY: 18.0,
  
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
    '#F97316'  // Orange
  ]
};
