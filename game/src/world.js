// Port Aurelia itself: a grid of avenues with city blocks between them, generated from
// the seed. Roads are the spaces between block columns/rows; each block holds one to
// four buildings with sidewalks around them, except the central park and the beach.
// The world answers the questions the simulation asks: is this point on a road, does
// this circle hit a building, which road centre is nearest, and where can things spawn.

import { DISTRICTS, ROOF_COLOURS, WORLD } from './config.js';
import { pick, range, rangeInt, weightedPick } from './random.js';

export function createWorld(random) {
  const size = WORLD.size;
  const block = WORLD.block;
  const roadHalf = WORLD.roadWidth / 2;
  /** Avenue centrelines: 0, block, 2*block, ... plus the far edge. */
  const centres = [];
  for (let c = 0; c <= size; c += block) centres.push(c);

  const buildings = [];
  const trees = [];
  const lamps = [];

  function isRoadCoord(v) {
    for (const c of centres) if (Math.abs(v - c) <= roadHalf) return true;
    return false;
  }

  // Blocks: the squares between avenues. Block (i,j) spans from avenue i's far edge
  // to avenue i+1's near edge.
  for (let i = 0; i < centres.length - 1; i += 1) {
    for (let j = 0; j < centres.length - 1; j += 1) {
      const x0 = centres[i] + roadHalf;
      const y0 = centres[j] + roadHalf;
      const w = block - WORLD.roadWidth;
      const h = block - WORLD.roadWidth;
      // The central block is the park; the southern row meets the beach.
      const isPark = i === 3 && j === 3;
      if (isPark) {
        for (let t = 0; t < 26; t += 1) {
          trees.push({ x: x0 + range(random, 24, w - 24), y: y0 + range(random, 24, h - 24), r: range(random, 13, 22) });
        }
        continue;
      }
      if (y0 > WORLD.beachY - block) {
        // Beachfront blocks: low buildings set back from the sand.
        const bw = range(random, 150, 210);
        const bh = range(random, 90, 130);
        buildings.push(makeBuilding(x0 + (w - bw) / 2, y0 + 26, bw, bh, random));
        continue;
      }
      const count = rangeInt(random, 1, 3);
      if (count === 1) {
        buildings.push(makeBuilding(x0 + 22, y0 + 22, w - 44, h - 44, random));
      } else {
        const hw = (w - 58) / 2;
        const hh = (h - 58) / 2;
        const spots = [
          [x0 + 18, y0 + 18], [x0 + 40 + hw, y0 + 18],
          [x0 + 18, y0 + 40 + hh], [x0 + 40 + hw, y0 + 40 + hh],
        ];
        for (let s = 0; s < count + 1 && s < spots.length; s += 1) {
          buildings.push(makeBuilding(spots[s][0], spots[s][1], hw, hh, random));
        }
      }
      if (random() < 0.5) trees.push({ x: x0 + range(random, 14, 40), y: y0 + range(random, 14, h - 14), r: range(random, 10, 16) });
    }
  }

  // Street lamps along the avenues. Each lamp also carries its dusk glow: a seeded
  // size class (weightedPick favours the standard pool of light) and a flicker phase,
  // so the renderer can light the streets at dusk with no runtime randomness.
  for (const c of centres) {
    for (let v = 90; v < size; v += 270) {
      lamps.push(makeLamp(c + roadHalf + 8, v, random));
      lamps.push(makeLamp(v, c + roadHalf + 8, random));
    }
  }

  function makeLamp(x, y, rng) {
    return {
      x, y,
      glow: weightedPick(rng, [[0.8, 1], [1, 3], [1.3, 1]]),
      phase: range(rng, 0, Math.PI * 2),
    };
  }

  function makeBuilding(x, y, w, h, rng) {
    const details = [];
    const boxes = rangeInt(rng, 1, 4);
    for (let d = 0; d < boxes; d += 1) {
      details.push({ x: range(rng, 8, Math.max(10, w - 42)), y: range(rng, 8, Math.max(10, h - 42)), w: range(rng, 16, 34), h: range(rng, 14, 26) });
    }
    return {
      x, y, w, h,
      colour: pick(rng, ROOF_COLOURS),
      floors: rangeInt(rng, 2, 14),
      details,
      name: '',
    };
  }

  /** Named places the story uses; each sits on a road junction so it can be driven to. */
  const places = {
    garage: { name: "Tito's Garage", x: 450, y: 2250 },
    docks: { name: 'Dockside Pier 9', x: 2250, y: 3150 },
    heights: { name: 'Palm Heights Hotel', x: 3150, y: 450 },
    park: { name: 'Aurelia Park', x: 1800, y: 1800 },
    downtown: { name: 'Downtown Plaza', x: 2700, y: 2250 },
    hospital: { name: 'Aurelia General', x: 900, y: 900 },
    airport: { name: 'Aurelia Airfield Gate', x: 3150, y: 3150 },
    beach: { name: 'Coral Beach', x: 1350, y: 3150 },
    hideout: { name: 'Old Town Safehouse', x: 450, y: 450 },
  };

  function districtAt(x, y) {
    for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
    return 'PORT AURELIA';
  }

  function isOnRoad(x, y) {
    if (y > WORLD.beachY) return false;
    return isRoadCoord(x) || isRoadCoord(y);
  }

  function isWater(x, y) {
    return y > WORLD.waterY;
  }

  function isBlocked(x, y) {
    if (x < 8 || y < 8 || x > size - 8 || y > size - 8) return true;
    if (isWater(x, y)) return true;
    for (const b of buildings) {
      if (x > b.x - 4 && x < b.x + b.w + 4 && y > b.y - 4 && y < b.y + b.h + 4) return true;
    }
    return false;
  }

  /** Push a circle (x, y, r) out of every building it overlaps; returns how hard it hit (0..1). */
  function collideCircle(pos, r) {
    let impact = 0;
    for (const b of buildings) {
      const nx = Math.max(b.x, Math.min(pos.x, b.x + b.w));
      const ny = Math.max(b.y, Math.min(pos.y, b.y + b.h));
      const dx = pos.x - nx;
      const dy = pos.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        const push = r - d;
        if (d2 > 0.01) {
          pos.x += (dx / d) * push;
          pos.y += (dy / d) * push;
        } else {
          // Centre inside the rect: leave by the nearest face.
          const left = pos.x - b.x;
          const right = b.x + b.w - pos.x;
          const top = pos.y - b.y;
          const bottom = b.y + b.h - pos.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) pos.x = b.x - r;
          else if (m === right) pos.x = b.x + b.w + r;
          else if (m === top) pos.y = b.y - r;
          else pos.y = b.y + b.h + r;
        }
        impact = Math.max(impact, Math.min(1, push / r));
      }
    }
    pos.x = Math.max(r, Math.min(size - r, pos.x));
    pos.y = Math.max(r, Math.min(WORLD.waterY - r + 40, pos.y));
    return impact;
  }

  /** A random point on a road near (x, y), for spawning traffic and parked cars. */
  function roadPointNear(rng, x, y, minDist, maxDist) {
    for (let tries = 0; tries < 24; tries += 1) {
      const vertical = rng() < 0.5;
      const centre = pick(rng, centres);
      const along = Math.max(30, Math.min(size - 30, (vertical ? y : x) + range(rng, -maxDist, maxDist)));
      const px = vertical ? centre + range(rng, -roadHalf + 16, roadHalf - 16) : along;
      const py = vertical ? along : centre + range(rng, -roadHalf + 16, roadHalf - 16);
      const d = Math.hypot(px - x, py - y);
      if (d >= minDist && d <= maxDist + 400 && !isBlocked(px, py)) return { x: px, y: py };
    }
    return { x: 450, y: 450 };
  }

  /** A sidewalk point: just off a road, not inside a building. */
  function sidewalkPointNear(rng, x, y, maxDist) {
    for (let tries = 0; tries < 24; tries += 1) {
      const p = roadPointNear(rng, x, y, 0, maxDist);
      const px = p.x + range(rng, -70, 70);
      const py = p.y + range(rng, -70, 70);
      if (!isBlocked(px, py) && !isOnRoad(px, py)) return { x: px, y: py };
    }
    return { x: 480, y: 480 };
  }

  return {
    size, centres, buildings, trees, lamps, places,
    districtAt, isOnRoad, isWater, isBlocked, collideCircle, roadPointNear, sidewalkPointNear,
  };
}
