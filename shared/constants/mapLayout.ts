import { MapObjectDefinition, SpawnPoint, BoundingBox } from '../types/game';

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
  // Outer perimeter security walls (100m x 100m boundary)
  box('wall_north', 'wall', 0, 0, -50, 100, 5, 2, 0, '#334155'),
  box('wall_south', 'wall', 0, 0, 50, 100, 5, 2, 0, '#334155'),
  box('wall_west', 'wall', -50, 0, 0, 2, 5, 100, 0, '#334155'),
  box('wall_east', 'wall', 50, 0, 0, 2, 5, 100, 0, '#334155'),

  // Central Plaza: High-tech Spy Monument & Elevated Platform
  box('center_monument', 'building', 0, 0, 0, 8, 4, 8, 0, '#1E293B'),
  box('center_top_cover_1', 'barrier', 0, 4, 3, 4, 1.2, 0.6, 0, '#64748B'),
  box('center_top_cover_2', 'barrier', 0, 4, -3, 4, 1.2, 0.6, 0, '#64748B'),
  box('ramp_north', 'ramp', 0, 0, -8, 4, 2, 8, 0, '#475569'),
  box('ramp_south', 'ramp', 0, 0, 8, 4, 2, 8, 0, '#475569'),

  // Shipping Containers (Heavy Full Cover: 6m length x 2.6m height x 2.4m width)
  // Red side yard
  box('cntr_red_1', 'container', -25, 0, -20, 2.5, 2.8, 6.0, 0, '#DC2626'),
  box('cntr_red_2', 'container', -28, 0, -20, 2.5, 2.8, 6.0, 0, '#B91C1C'),
  box('cntr_red_stack', 'container', -26.5, 2.8, -20, 2.5, 2.8, 6.0, 0, '#991B1B'),
  box('cntr_blue_1', 'container', 25, 0, 20, 2.5, 2.8, 6.0, 0, '#2563EB'),
  box('cntr_blue_2', 'container', 28, 0, 20, 2.5, 2.8, 6.0, 0, '#1D4ED8'),
  box('cntr_blue_stack', 'container', 26.5, 2.8, 20, 2.5, 2.8, 6.0, 0, '#1E40AF'),
  box('cntr_teal_1', 'container', -18, 0, 25, 6.0, 2.8, 2.5, 0, '#0D9488'),
  box('cntr_orange_1', 'container', 18, 0, -25, 6.0, 2.8, 2.5, 0, '#EA580C'),

  // Medium Cover: Concrete Barriers (1.3m height - crouch completely hides, stand reveals forehead)
  box('barrier_mid_1', 'barrier', -10, 0, -5, 6, 1.3, 0.8, 0, '#94A3B8'),
  box('barrier_mid_2', 'barrier', 10, 0, 5, 6, 1.3, 0.8, 0, '#94A3B8'),
  box('barrier_mid_3', 'barrier', -5, 0, 10, 0.8, 1.3, 6, 0, '#94A3B8'),
  box('barrier_mid_4', 'barrier', 5, 0, -10, 0.8, 1.3, 6, 0, '#94A3B8'),
  box('barrier_west_1', 'barrier', -32, 0, 0, 8, 1.3, 0.8, 0, '#94A3B8'),
  box('barrier_east_1', 'barrier', 32, 0, 0, 8, 1.3, 0.8, 0, '#94A3B8'),

  // Low Cover: Wooden Crates (1.1m height - peek forehead easily, dangerous to stay behind)
  box('crate_1', 'crate', -8, 0, -16, 1.2, 1.2, 1.2, 0, '#D97706'),
  box('crate_2', 'crate', -6.5, 0, -16, 1.2, 1.2, 1.2, 0, '#B45309'),
  box('crate_3', 'crate', 8, 0, 16, 1.2, 1.2, 1.2, 0, '#D97706'),
  box('crate_4', 'crate', 6.5, 0, 16, 1.2, 1.2, 1.2, 0, '#B45309'),
  box('crate_5', 'crate', -20, 0, 5, 1.4, 1.4, 1.4, 0, '#D97706'),
  box('crate_6', 'crate', 20, 0, -5, 1.4, 1.4, 1.4, 0, '#D97706'),

  // Stacked Crates (Full concealment: 2.4m height)
  box('stack_1_base', 'crate_stack', -14, 0, -28, 2.4, 1.2, 2.4, 0, '#92400E'),
  box('stack_1_top', 'crate_stack', -14, 1.2, -28, 1.2, 1.2, 1.2, 0, '#B45309'),
  box('stack_2_base', 'crate_stack', 14, 0, 28, 2.4, 1.2, 2.4, 0, '#92400E'),
  box('stack_2_top', 'crate_stack', 14, 1.2, 28, 1.2, 1.2, 1.2, 0, '#B45309'),

  // Small Buildings / Security Bunkers (with tactical corridors)
  // Northwest Bunker
  box('bunker_nw_w1', 'building', -35, 0, -32, 10, 3.5, 1, 0, '#475569'),
  box('bunker_nw_w2', 'building', -40, 0, -37, 1, 3.5, 10, 0, '#475569'),
  box('bunker_nw_w3', 'building', -30, 0, -37, 1, 3.5, 10, 0, '#475569'),
  // Southeast Bunker
  box('bunker_se_w1', 'building', 35, 0, 32, 10, 3.5, 1, 0, '#475569'),
  box('bunker_se_w2', 'building', 40, 0, 37, 1, 3.5, 10, 0, '#475569'),
  box('bunker_se_w3', 'building', 30, 0, 37, 1, 3.5, 10, 0, '#475569'),

  // Pillars & Columns (Tactical peeking cover)
  box('pillar_1', 'pillar', -12, 0, 15, 1.2, 4.0, 1.2, 0, '#64748B'),
  box('pillar_2', 'pillar', -12, 0, 22, 1.2, 4.0, 1.2, 0, '#64748B'),
  box('pillar_3', 'pillar', 12, 0, -15, 1.2, 4.0, 1.2, 0, '#64748B'),
  box('pillar_4', 'pillar', 12, 0, -22, 1.2, 4.0, 1.2, 0, '#64748B'),

  // Rocks & Natural Formations
  box('rock_sw_1', 'rock', -36, 0, 28, 4.0, 2.2, 3.5, 0, '#78716C'),
  box('rock_sw_2', 'rock', -32, 0, 32, 3.0, 1.6, 2.5, 0, '#57534E'),
  box('rock_ne_1', 'rock', 36, 0, -28, 4.0, 2.2, 3.5, 0, '#78716C'),
  box('rock_ne_2', 'rock', 32, 0, -32, 3.0, 1.6, 2.5, 0, '#57534E'),

  // Stylized Low-Poly Trees (trunk + foliage colliders)
  box('tree_trunk_1', 'tree', -22, 0, -5, 0.8, 4.0, 0.8, 0, '#78350F'),
  box('tree_foliage_1', 'tree', -22, 2.5, -5, 3.2, 2.5, 3.2, 0, '#15803D'),
  box('tree_trunk_2', 'tree', 22, 0, 5, 0.8, 4.0, 0.8, 0, '#78350F'),
  box('tree_foliage_2', 'tree', 22, 2.5, 5, 3.2, 2.5, 3.2, 0, '#15803D'),
  box('tree_trunk_3', 'tree', 0, 0, -32, 0.8, 4.0, 0.8, 0, '#78350F'),
  box('tree_foliage_3', 'tree', 0, 2.5, -32, 3.2, 2.5, 3.2, 0, '#15803D'),
  box('tree_trunk_4', 'tree', 0, 0, 32, 0.8, 4.0, 0.8, 0, '#78350F'),
  box('tree_foliage_4', 'tree', 0, 2.5, 32, 3.2, 2.5, 3.2, 0, '#15803D'),

  // Bushes (Soft cover: 1.0m height - easily peek over)
  box('bush_1', 'bush', -15, 0, -8, 2.0, 1.0, 2.0, 0, '#16A34A'),
  box('bush_2', 'bush', 15, 0, 8, 2.0, 1.0, 2.0, 0, '#16A34A'),
  box('bush_3', 'bush', -28, 0, 15, 2.2, 1.1, 2.2, 0, '#16A34A'),
  box('bush_4', 'bush', 28, 0, -15, 2.2, 1.1, 2.2, 0, '#16A34A')
];

export const SPAWN_POINTS: SpawnPoint[] = [
  // Red zone spawns
  { position: [-38, 0, -38], rotationY: Math.PI / 4, team: 'red' },
  { position: [-25, 0, -35], rotationY: Math.PI / 2, team: 'red' },
  { position: [-35, 0, -20], rotationY: 0, team: 'red' },
  { position: [-42, 0, -25], rotationY: Math.PI / 3, team: 'red' },

  // Blue zone spawns
  { position: [38, 0, 38], rotationY: -3 * Math.PI / 4, team: 'blue' },
  { position: [25, 0, 35], rotationY: -Math.PI / 2, team: 'blue' },
  { position: [35, 0, 20], rotationY: Math.PI, team: 'blue' },
  { position: [42, 0, 25], rotationY: -2 * Math.PI / 3, team: 'blue' },

  // Neutral / FFA tactical spawns
  { position: [-35, 0, 35], rotationY: -Math.PI / 4 },
  { position: [35, 0, -35], rotationY: 3 * Math.PI / 4 },
  { position: [-20, 0, 0], rotationY: Math.PI / 2 },
  { position: [20, 0, 0], rotationY: -Math.PI / 2 },
  { position: [0, 0, -25], rotationY: 0 },
  { position: [0, 0, 25], rotationY: Math.PI },
  { position: [-10, 0, -38], rotationY: Math.PI / 2 },
  { position: [10, 0, 38], rotationY: -Math.PI / 2 }
];

// Extract pure bounding boxes for rapid collision & raycasting
export const COLLISION_OBSTACLES: BoundingBox[] = MAP_OBJECTS.map((obj) => obj.bounds);
