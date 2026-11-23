// Aurelia Heat — seeded randomness and small numeric helpers.
//
// Port Aurelia is a procedural city, and a procedural city is only fair
// when every machine builds the same one. Nothing in world generation may
// touch Math.random: the layout has to be a pure function of the seed.
// This module is that function. A string-hash of the seed feeds a
// mulberry32 generator, and every building footprint, tree and lamp in
// the city is drawn from the resulting stream in a fixed order.
//
// WARNING, written for whoever edits this file next: the numeric stream
// is load-bearing. The constants below are not style. Change any one of
// them — an increment, a shift, a divisor — and seed 1 quietly builds a
// different city, saved screenshots stop matching, and every determinism
// check in the project goes red for reasons that look unrelated. The
// helpers may be rearranged; the arithmetic may not.

// hashSeed folds any seed value (number or text) into a 32-bit unsigned
// integer with the FNV-1a hash: start from the offset basis, then for
// each character xor the byte in and multiply by the FNV prime. Math.imul
// keeps the multiplication in 32-bit integer land, and the final >>> 0
// reinterprets the result as unsigned.
export function hashSeed(seed) {
  const FNV_OFFSET_BASIS = 2166136261;
  const FNV_PRIME = 16777619;
  const text = String(seed);
  let h = FNV_OFFSET_BASIS >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}

// createRng builds one independent mulberry32 stream. The generator
// keeps a single 32-bit state word; each draw advances it by the golden
// gamma increment and runs the state through two xor-shift/multiply
// mixing rounds before scaling the top bits into the [0, 1) interval.
// A hashed seed of exactly zero would make a poor state, so it falls
// back to the golden ratio constant instead.
export function createRng(seed) {
  let state = hashSeed(seed) || 0x9e3779b9;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Uniform float in [min, max).
  function range(min, max) {
    return min + next() * (max - min);
  }

  // Uniform integer in [min, maxInclusive]. The tiny epsilon keeps the
  // top of the interval reachable-but-never-exceeded when the float
  // lands a hair under the boundary; do not "clean it up".
  function int(min, maxInclusive) {
    return Math.floor(range(min, maxInclusive + 1 - 1e-9));
  }

  // Uniform element of a list; an empty list yields undefined. The index
  // is clamped so a draw of exactly 1 (impossible from next(), but cheap
  // to guard) can never read past the end.
  function pick(list) {
    if (!list.length) return undefined;
    const idx = Math.floor(next() * list.length);
    return list[Math.min(list.length - 1, idx)];
  }

  // True with probability p, decided by a single draw.
  function chance(p) {
    return next() < p;
  }

  // Fisher–Yates shuffle of a copy; the caller's array is never mutated.
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

// jitter is deliberately NOT part of the seeded world stream. It serves
// moment-to-moment gameplay wobble — bullet spread, a pedestrian's
// stagger — where being different every run is the point. It reads the
// platform generator, which is safe precisely because nothing it feeds
// is ever baked into the city or a save file.
export function jitter(amount) {
  return (Math.random() * 2 - 1) * amount;
}

// clamp pins a value into the closed interval [lo, hi].
export function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

// lerp blends from a to b by fraction t (0 returns a, 1 returns b).
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// dist is the straight-line distance between two points.
export function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// angleTo is the heading, in radians, from the first point to the second.
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// wrapAngle folds an angle into the (-PI, PI] range by whole turns, so
// heading comparisons never see a spurious near-2PI difference.
export function wrapAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// turnToward rotates a heading toward a target by at most maxStep,
// landing exactly on the target when one step would overshoot it.
export function turnToward(current, target, maxStep) {
  const diff = wrapAngle(target - current);
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}
