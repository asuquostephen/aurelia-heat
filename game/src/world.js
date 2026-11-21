// Aurelia Heat — procedural city generation for Port Aurelia.
// The city is a regular avenue grid carved into city blocks. Each block is
// filled with buildings whose footprints, heights and roof details come from
// the seeded generator, so seed 1 always builds the same Port Aurelia.
// The southern edge gives way to sand and open sea; the middle of the map
// holds Aurelia Green, a park of lawns, paths and trees.

import { createRng } from './random.js';
import { WORLD_SIZE } from './config.js';

export const ROAD_LINES = [240, 840, 1440, 2040, 2640, 3240];
export const ROAD_HALF = 62;
export const PARK = { x: 1500, y: 1500, w: 600, h: 480 };
export const SEA_Y = 3380;
export const BEACH_Y = 3260;

export const PLACE_DEFS = [
  { id: 'garage', name: "Marlo's Garage", x: 840, y: 700 },
  { id: 'harbour', name: 'Aurelia Harbour', x: 840, y: 3000 },
  { id: 'market', name: 'Old Town Market', x: 500, y: 1440 },
  { id: 'hotel', name: 'Palm Court Hotel', x: 2640, y: 500 },
  { id: 'depot', name: 'South Depot', x: 1440, y: 2640 },
  { id: 'clinic', name: 'Aurelia Clinic', x: 2040, y: 1200 },
  { id: 'tower', name: 'Meridian Tower', x: 2640, y: 2040 },
  { id: 'beachclub', name: 'Driftline Beach Club', x: 2400, y: 3180 },
  { id: 'courthouse', name: 'Aurelia Courthouse', x: 1200, y: 2040 },
];

const ROOF_PALETTES = ['#5b4a3f', '#6e5a4a', '#47525e', '#7a6a55', '#54423a', '#3f4a55', '#8a7a5f', '#5e5348'];
const WALL_PALETTES = ['#c9b8a3', '#b7c2cc', '#d6c9a8', '#a8b8a4', '#cbb3a0', '#b0a6c2', '#d0d4d8', '#c2b280'];

function nearestRoadCoord(v) {
  let best = ROAD_LINES[0];
  let bestD = Infinity;
  for (const line of ROAD_LINES) {
    const d = Math.abs(v - line);
    if (d < bestD) { bestD = d; best = line; }
  }
  return best;
}

export function isOnRoad(x, y) {
  for (const line of ROAD_LINES) {
    if (Math.abs(x - line) <= ROAD_HALF) return true;
    if (Math.abs(y - line) <= ROAD_HALF) return true;
  }
  return false;
}

export function isInPark(x, y) {
  return x >= PARK.x && x <= PARK.x + PARK.w && y >= PARK.y && y <= PARK.y + PARK.h;
}

export function isSea(x, y) {
  return y >= SEA_Y;
}

export function isBeach(x, y) {
  return y >= BEACH_Y && y < SEA_Y;
}

export function laneOffsetFor(direction) {
  // Right-hand traffic: vehicles keep to the right of their travel direction.
  return 26;
}

export function snapToLane(x, y, heading) {
  const horizontal = Math.abs(Math.cos(heading)) > Math.abs(Math.sin(heading));
  if (horizontal) {
    const roadY = nearestRoadCoord(y);
    const dirSign = Math.cos(heading) >= 0 ? 1 : -1;
    return { x, y: roadY + dirSign * laneOffsetFor(heading), horizontal: true, road: roadY };
  }
  const roadX = nearestRoadCoord(x);
  const dirSign = Math.sin(heading) >= 0 ? 1 : -1;
  return { x: roadX - dirSign * laneOffsetFor(heading), y, horizontal: false, road: roadX };
}

export function generateWorld(seed) {
  const rng = createRng(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];

  // City blocks sit between neighbouring avenues.
  const edges = [0, ...ROAD_LINES, WORLD_SIZE];
  for (let bi = 0; bi < edges.length - 1; bi++) {
    for (let bj = 0; bj < edges.length - 1; bj++) {
      const x0 = edges[bi] + ROAD_HALF + 14;
      const x1 = edges[bi + 1] - ROAD_HALF - 14;
      const y0 = edges[bj] + ROAD_HALF + 14;
      const y1 = edges[bj + 1] - ROAD_HALF - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      if (isInPark(cx, cy)) continue;
      if (cy > BEACH_Y - 60) continue;
      // Buildings fill a two-by-two slot grid inside the block; most slots
      // are built on, a few stay empty as yards and parking gaps.
      const cellW = (x1 - x0) / 2;
      const cellH = (y1 - y0) / 2;
      for (let sx = 0; sx < 2; sx++) {
        for (let sy = 0; sy < 2; sy++) {
          if (!rng.chance(0.68)) continue;
          const w = rng.range(80, Math.min(185, cellW - 26));
          const h = rng.range(80, Math.min(185, cellH - 26));
          const bx = x0 + sx * cellW + (cellW - w) / 2 + rng.range(-6, 6);
          const by = y0 + sy * cellH + (cellH - h) / 2 + rng.range(-6, 6);
          if (bx < x0 || by < y0 || bx + w > x1 || by + h > y1) continue;
        buildings.push({
          x: bx, y: by, w, h,
          height: rng.int(2, 9),
          wall: rng.pick(WALL_PALETTES),
          roof: rng.pick(ROOF_PALETTES),
          roofUnit: rng.chance(0.7),
          waterTank: rng.chance(0.28),
          helipad: rng.chance(0.08),
          sign: rng.chance(0.35),
        });
        }
      }
      // A tree or two on quieter blocks.
      if (rng.chance(0.5)) {
        trees.push({ x: x0 + rng.range(10, 40), y: y1 - rng.range(10, 40), r: rng.range(12, 20) });
      }
    }
  }

  // Park trees scattered through Aurelia Green.
  for (let i = 0; i < 46; i++) {
    trees.push({
      x: PARK.x + rng.range(24, PARK.w - 24),
      y: PARK.y + rng.range(24, PARK.h - 24),
      r: rng.range(13, 24),
    });
  }
  // Palms along the beachfront.
  for (let x = 160; x < WORLD_SIZE - 120; x += 150) {
    trees.push({ x: x + rng.range(-18, 18), y: BEACH_Y + rng.range(6, 42), r: rng.range(12, 18), palm: true });
  }

  // Street lamps at every junction corner and mid-block along avenues.
  for (const lx of ROAD_LINES) {
    for (const ly of ROAD_LINES) {
      lamps.push({ x: lx - ROAD_HALF - 8, y: ly - ROAD_HALF - 8 });
      lamps.push({ x: lx + ROAD_HALF + 8, y: ly + ROAD_HALF + 8 });
    }
    for (let t = 0; t < ROAD_LINES.length - 1; t++) {
      const mid = (ROAD_LINES[t] + ROAD_LINES[t + 1]) / 2;
      lamps.push({ x: lx + ROAD_HALF + 8, y: mid });
      lamps.push({ x: mid, y: lx - ROAD_HALF - 8 });
    }
  }

  const places = PLACE_DEFS.map((p) => ({ ...p }));
  return {
    seed,
    size: WORLD_SIZE,
    buildings,
    trees,
    lamps,
    places,
    park: { ...PARK },
    seaY: SEA_Y,
    beachY: BEACH_Y,
    roadLines: ROAD_LINES.slice(),
    roadHalf: ROAD_HALF,
  };
}

export function buildingAt(world, x, y, pad = 0) {
  for (const b of world.buildings) {
    if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) return b;
  }
  return null;
}

export function circleHitsBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

export function placeById(world, id) {
  return world.places.find((p) => p.id === id) || null;
}

export function summaryOf(world) {
  return {
    seed: world.seed,
    buildings: world.buildings.length,
    trees: world.trees.length,
    lamps: world.lamps.length,
    places: world.places.length,
  };
}
