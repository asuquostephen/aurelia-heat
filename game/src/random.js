// Aurelia Heat — deterministic seeded randomness.
// Port Aurelia must look identical for a given seed on every machine, so the
// game never calls Math.random while building the city. A small mulberry32
// generator gives us a fast, well-distributed stream from one integer seed.

export function hashSeed(seed) {
  let h = 2166136261 >>> 0;
  const text = String(seed);
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed) {
  let state = hashSeed(seed) || 0x9e3779b9;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function range(min, max) {
    return min + next() * (max - min);
  }
  function int(min, maxInclusive) {
    return Math.floor(range(min, maxInclusive + 1 - 1e-9));
  }
  function pick(list) {
    if (!list.length) return undefined;
    return list[Math.min(list.length - 1, Math.floor(next() * list.length))];
  }
  function chance(p) {
    return next() < p;
  }
  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }
  return { next, range, int, pick, chance, shuffle };
}

// A separate, non-deterministic stream for moment-to-moment gameplay jitter
// (bullet spread, pedestrian wobble). Gameplay jitter never shapes the city,
// so using the platform generator here cannot break world determinism.
export function jitter(amount) {
  return (Math.random() * 2 - 1) * amount;
}

export function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function wrapAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function turnToward(current, target, maxStep) {
  const diff = wrapAngle(target - current);
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}
