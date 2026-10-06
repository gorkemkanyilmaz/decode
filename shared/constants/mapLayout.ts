import { MapObjectDefinition, SpawnPoint, BoundingBox, LadderDefinition } from '../types/game';

// Arena radius for circular boundary
export const ARENA_RADIUS = 40;

function box(
  id: string,
  type: MapObjectDefinition['type'],
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  rotY: number = 0,
  color?: string
): MapObjectDefinition {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  return {
    id,
    type,
    position: [x, y + hh, z],
    rotation: [0, rotY, 0],
    scale: [w, h, d],
    color,
    bounds: {
      min: [x - hw, y, z - hd],
      max: [x + hw, y + h, z + hd]
    }
  };
}

export const MAP_OBJECTS: MapObjectDefinition[] = [
  // ═══════════════════════════════════════════════════
  // CENTER ARENA - Main combat platform with low cover
  // ═══════════════════════════════════════════════════

  // Center platform (raised slightly for visual interest)
  box('center_platform', 'platform', 0, 0, 0, 6, 0.15, 6, 0, '#E8D5F5'),

  // Center cross barriers (low cover, 1.2m height - crouchable)
  box('center_barrier_n', 'barrier', 0, 0, -3.5, 4.0, 1.2, 0.7, 0, '#C4B5E3'),
  box('center_barrier_s', 'barrier', 0, 0, 3.5, 4.0, 1.2, 0.7, 0, '#C4B5E3'),
  box('center_barrier_w', 'barrier', -3.5, 0, 0, 0.7, 1.2, 4.0, 0, '#C4B5E3'),
  box('center_barrier_e', 'barrier', 3.5, 0, 0, 0.7, 1.2, 4.0, 0, '#C4B5E3'),

  // ═══════════════════════════════════════════════════
  // INNER RING (r ≈ 10-12m) - Medium cover structures
  // ═══════════════════════════════════════════════════

  // 4 crate clusters at cardinal directions
  box('crate_n1', 'crate', -1.0, 0, -11, 1.4, 1.2, 1.4, 0, '#FFB5BA'),
  box('crate_n2', 'crate', 0.8, 0, -11, 1.4, 1.2, 1.4, 0, '#FFC1C6'),
  box('crate_n3', 'crate', -0.1, 1.2, -11, 1.4, 1.2, 1.4, 0, '#FFD1D6'),

  box('crate_s1', 'crate', -1.0, 0, 11, 1.4, 1.2, 1.4, 0, '#B5D8FF'),
  box('crate_s2', 'crate', 0.8, 0, 11, 1.4, 1.2, 1.4, 0, '#C1DFFF'),
  box('crate_s3', 'crate', -0.1, 1.2, 11, 1.4, 1.2, 1.4, 0, '#D1E8FF'),

  box('crate_w1', 'crate', -11, 0, -1.0, 1.4, 1.2, 1.4, 0, '#B5FFD8'),
  box('crate_w2', 'crate', -11, 0, 0.8, 1.4, 1.2, 1.4, 0, '#C1FFE0'),
  box('crate_w3', 'crate', -11, 1.2, -0.1, 1.4, 1.2, 1.4, 0, '#D1FFE8'),

  box('crate_e1', 'crate', 11, 0, -1.0, 1.4, 1.2, 1.4, 0, '#FFE5B5'),
  box('crate_e2', 'crate', 11, 0, 0.8, 1.4, 1.2, 1.4, 0, '#FFECC1'),
  box('crate_e3', 'crate', 11, 1.2, -0.1, 1.4, 1.2, 1.4, 0, '#FFF2D1'),

  // 4 angled barriers between cardinal crate clusters
  box('barrier_ne', 'barrier', 8, 0, -8, 5.0, 1.3, 0.7, Math.PI / 4, '#D5C4E3'),
  box('barrier_se', 'barrier', 8, 0, 8, 5.0, 1.3, 0.7, -Math.PI / 4, '#D5C4E3'),
  box('barrier_nw', 'barrier', -8, 0, -8, 5.0, 1.3, 0.7, -Math.PI / 4, '#D5C4E3'),
  box('barrier_sw', 'barrier', -8, 0, 8, 5.0, 1.3, 0.7, Math.PI / 4, '#D5C4E3'),

  // ═══════════════════════════════════════════════════
  // MID RING (r ≈ 18-22m) - Larger cover pieces
  // ═══════════════════════════════════════════════════

  // Shipping containers (full height cover, climbable)
  box('container_n', 'container', 0, 0, -20, 6.0, 2.8, 2.5, 0, '#FFA0B0'),
  box('container_s', 'container', 0, 0, 20, 6.0, 2.8, 2.5, 0, '#A0C0FF'),
  box('container_w', 'container', -20, 0, 0, 2.5, 2.8, 6.0, 0, '#A0FFB0'),
  box('container_e', 'container', 20, 0, 0, 2.5, 2.8, 6.0, 0, '#FFD0A0'),

  // L-shaped walls at diagonals (bunker-like cover)
  // NE bunker
  box('bunker_ne_w1', 'building', 16, 0, -16, 6, 3.0, 0.8, 0, '#E0D0F0'),
  box('bunker_ne_w2', 'building', 19, 0, -13.5, 0.8, 3.0, 4.2, 0, '#E0D0F0'),
  // SW bunker
  box('bunker_sw_w1', 'building', -16, 0, 16, 6, 3.0, 0.8, 0, '#E0D0F0'),
  box('bunker_sw_w2', 'building', -19, 0, 13.5, 0.8, 3.0, 4.2, 0, '#E0D0F0'),
  // NW bunker
  box('bunker_nw_w1', 'building', -16, 0, -16, 0.8, 3.0, 6, 0, '#D0E0F0'),
  box('bunker_nw_w2', 'building', -13.5, 0, -19, 4.2, 3.0, 0.8, 0, '#D0E0F0'),
  // SE bunker
  box('bunker_se_w1', 'building', 16, 0, 16, 0.8, 3.0, 6, 0, '#D0E0F0'),
  box('bunker_se_w2', 'building', 13.5, 0, 19, 4.2, 3.0, 0.8, 0, '#D0E0F0'),

  // ═══════════════════════════════════════════════════
  // OUTER RING (r ≈ 28-35m) - Perimeter cover & decorations
  // ═══════════════════════════════════════════════════

  // Perimeter pillars (8 pillars around the edge)
  box('pillar_n', 'pillar', 0, 0, -30, 1.2, 3.5, 1.2, 0, '#D4A0E0'),
  box('pillar_s', 'pillar', 0, 0, 30, 1.2, 3.5, 1.2, 0, '#D4A0E0'),
  box('pillar_w', 'pillar', -30, 0, 0, 1.2, 3.5, 1.2, 0, '#D4A0E0'),
  box('pillar_e', 'pillar', 30, 0, 0, 1.2, 3.5, 1.2, 0, '#D4A0E0'),
  box('pillar_ne', 'pillar', 21, 0, -21, 1.2, 3.5, 1.2, 0, '#C4B0E0'),
  box('pillar_se', 'pillar', 21, 0, 21, 1.2, 3.5, 1.2, 0, '#C4B0E0'),
  box('pillar_nw', 'pillar', -21, 0, -21, 1.2, 3.5, 1.2, 0, '#C4B0E0'),
  box('pillar_sw', 'pillar', -21, 0, 21, 1.2, 3.5, 1.2, 0, '#C4B0E0'),

  // Outer barriers (waist-high cover near arena edge)
  box('outer_barrier_n2', 'barrier', 12, 0, -28, 5, 1.3, 0.7, 0, '#C4D5E3'),
  box('outer_barrier_s2', 'barrier', -12, 0, 28, 5, 1.3, 0.7, 0, '#C4D5E3'),
  box('outer_barrier_w1', 'barrier', -28, 0, -12, 0.7, 1.3, 5, 0, '#C4D5E3'),
  box('outer_barrier_w2', 'barrier', -28, 0, 12, 0.7, 1.3, 5, 0, '#C4D5E3'),
  box('outer_barrier_e1', 'barrier', 28, 0, -12, 0.7, 1.3, 5, 0, '#C4D5E3'),
  box('outer_barrier_e2', 'barrier', 28, 0, 12, 0.7, 1.3, 5, 0, '#C4D5E3'),

  // Rocks scattered at outer perimeter for natural feel
  box('rock_1', 'rock', -32, 0, -14, 3.0, 1.8, 2.5, 0, '#D4C4B8'),
  box('rock_2', 'rock', 32, 0, 14, 3.0, 1.8, 2.5, 0, '#D4C4B8'),
  box('rock_3', 'rock', -14, 0, 32, 2.5, 1.4, 2.0, 0, '#C8BCA8'),
  box('rock_4', 'rock', 14, 0, -32, 2.5, 1.4, 2.0, 0, '#C8BCA8'),

  // Trees at edge (decorative, with trunk collision)
  box('tree_trunk_1', 'tree', -26, 0, -26, 0.8, 4.0, 0.8, 0, '#8B6B4A'),
  box('tree_foliage_1', 'tree', -26, 2.5, -26, 3.0, 2.5, 3.0, 0, '#90D090'),
  box('tree_trunk_2', 'tree', 26, 0, 26, 0.8, 4.0, 0.8, 0, '#8B6B4A'),
  box('tree_foliage_2', 'tree', 26, 2.5, 26, 3.0, 2.5, 3.0, 0, '#90D090'),
  box('tree_trunk_3', 'tree', -26, 0, 26, 0.8, 4.0, 0.8, 0, '#8B6B4A'),
  box('tree_foliage_3', 'tree', -26, 2.5, 26, 3.0, 2.5, 3.0, 0, '#90D090'),
  box('tree_trunk_4', 'tree', 26, 0, -26, 0.8, 4.0, 0.8, 0, '#8B6B4A'),
  box('tree_foliage_4', 'tree', 26, 2.5, -26, 3.0, 2.5, 3.0, 0, '#90D090'),

  // Bushes near perimeter (soft cover - visible but passable)
  box('bush_1', 'bush', -18, 0, -30, 2.0, 1.0, 2.0, 0, '#80C880'),
  box('bush_2', 'bush', 18, 0, 30, 2.0, 1.0, 2.0, 0, '#80C880'),
  box('bush_3', 'bush', -30, 0, 18, 2.2, 1.1, 2.2, 0, '#80C880'),
  box('bush_4', 'bush', 30, 0, -18, 2.2, 1.1, 2.2, 0, '#80C880'),

  // Stacked Crates (Full concealment: 2.4m height, climbable with ladder)
  box('stack_1_base', 'crate_stack', -14, 0, -28, 2.4, 1.2, 2.4, 0, '#E8C0D0'),
  box('stack_1_top', 'crate_stack', -14, 1.2, -28, 1.4, 1.2, 1.4, 0, '#F0D0E0'),
  box('stack_2_base', 'crate_stack', 14, 0, 28, 2.4, 1.2, 2.4, 0, '#C0D0E8'),
  box('stack_2_top', 'crate_stack', 14, 1.2, 28, 1.4, 1.2, 1.4, 0, '#D0E0F0'),
  box('stack_ne_base', 'crate_stack', 25, 0, -10, 2.4, 1.2, 2.4, 0, '#E8C0D0'),
  box('stack_ne_top', 'crate_stack', 25, 1.2, -10, 1.4, 1.2, 1.4, 0, '#F0D0E0'),
  box('stack_sw_base', 'crate_stack', -25, 0, 10, 2.4, 1.2, 2.4, 0, '#C0D0E8'),
  box('stack_sw_top', 'crate_stack', -25, 1.2, 10, 1.4, 1.2, 1.4, 0, '#D0E0F0'),
];

export const SPAWN_POINTS: SpawnPoint[] = [
  // 12 spawn points evenly distributed around the arena (every 30 degrees at r=32)
  { position: [0, 0, -32], rotationY: 0 },
  { position: [16, 0, -27.7], rotationY: Math.PI / 6 },
  { position: [27.7, 0, -16], rotationY: Math.PI / 3 },
  { position: [32, 0, 0], rotationY: Math.PI / 2 },
  { position: [27.7, 0, 16], rotationY: (2 * Math.PI) / 3 },
  { position: [16, 0, 27.7], rotationY: (5 * Math.PI) / 6 },
  { position: [0, 0, 32], rotationY: Math.PI },
  { position: [-16, 0, 27.7], rotationY: -(5 * Math.PI) / 6 },
  { position: [-27.7, 0, 16], rotationY: -(2 * Math.PI) / 3 },
  { position: [-32, 0, 0], rotationY: -Math.PI / 2 },
  { position: [-27.7, 0, -16], rotationY: -Math.PI / 3 },
  { position: [-16, 0, -27.7], rotationY: -Math.PI / 6 },
];

// Extract pure bounding boxes for rapid collision & raycasting
export const COLLISION_OBSTACLES: BoundingBox[] = MAP_OBJECTS.map((obj) => obj.bounds);

export const LADDERS: LadderDefinition[] = [
  // Ladder for container N (south face)
  {
    id: 'ladder_container_n',
    position: [0, 0, -18.7],
    height: 2.8,
    rotationY: 0,
    bounds: {
      min: [-0.6, 0, -19.3],
      max: [0.6, 2.9, -18.1]
    }
  },
  // Ladder for container S (north face)
  {
    id: 'ladder_container_s',
    position: [0, 0, 18.7],
    height: 2.8,
    rotationY: Math.PI,
    bounds: {
      min: [-0.6, 0, 18.1],
      max: [0.6, 2.9, 19.3]
    }
  },
  // Ladder for container W (east face)
  {
    id: 'ladder_container_w',
    position: [-18.7, 0, 0],
    height: 2.8,
    rotationY: Math.PI / 2,
    bounds: {
      min: [-19.3, 0, -0.6],
      max: [-18.1, 2.9, 0.6]
    }
  },
  // Ladder for container E (west face)
  {
    id: 'ladder_container_e',
    position: [18.7, 0, 0],
    height: 2.8,
    rotationY: -Math.PI / 2,
    bounds: {
      min: [18.1, 0, -0.6],
      max: [19.3, 2.9, 0.6]
    }
  },
  // Ladder for NE stacked crates
  {
    id: 'ladder_stack_ne',
    position: [25, 0, -8.7],
    height: 2.4,
    rotationY: 0,
    bounds: {
      min: [24.4, 0, -9.3],
      max: [25.6, 2.5, -8.1]
    }
  },
  // Ladder for SW stacked crates
  {
    id: 'ladder_stack_sw',
    position: [-25, 0, 11.3],
    height: 2.4,
    rotationY: Math.PI,
    bounds: {
      min: [-25.6, 0, 10.7],
      max: [-24.4, 2.5, 11.9]
    }
  },
];
