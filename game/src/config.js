// Aurelia Heat — central tuning constants.
// Every number the rest of the game leans on lives here so the feel of
// Port Aurelia can be adjusted in one place without hunting through logic.

export const WORLD_SIZE = 3600;
export const WORLD_HALF = WORLD_SIZE / 2;

export const PLAYER_RADIUS = 14;
export const PLAYER_WALK_SPEED = 150;
export const PLAYER_SPRINT_SPEED = 245;
export const PLAYER_MAX_HEALTH = 100;

export const CAR_RADIUS = 26;
export const CAR_ENTER_RANGE = 64;

export const VEHICLE_CLASSES = [
  { id: 'compact', name: 'Pigeon Compact', topSpeed: 300, accel: 210, grip: 3.4, hull: 80, color: '#d95f4b' },
  { id: 'sedan', name: 'Meridian Sedan', topSpeed: 360, accel: 240, grip: 3.1, hull: 110, color: '#4b7fd9' },
  { id: 'coupe', name: 'Vireo Coupe', topSpeed: 460, accel: 320, grip: 2.9, hull: 100, color: '#e8b93c' },
  { id: 'van', name: 'Hauler Van', topSpeed: 280, accel: 170, grip: 3.8, hull: 170, color: '#8a94a6' },
  { id: 'muscle', name: 'Brutus Muscle', topSpeed: 430, accel: 350, grip: 2.5, hull: 130, color: '#3fa66a' },
];

export const POLICE_CLASS = { id: 'patrol', name: 'Aurelia Patrol Interceptor', topSpeed: 470, accel: 330, grip: 3.0, hull: 160, color: '#eef1f5' };

export const HEAT_PER_STAR = 100;
export const HEAT_MAX = 500;
export const HEAT_DECAY_PER_SEC = 7;
export const HEAT_DECAY_DUSK_PER_SEC = 12;
export const HEAT_UNSEEN_GRACE_SEC = 4;

export const CRIME_HEAT = {
  carjack: 45,
  theft: 30,
  assault: 35,
  gunfire: 25,
  hitAndRun: 70,
  ramPatrol: 60,
  property: 15,
};

// Police roadblocks: once the chase reaches three stars, patrols throw a
// line of unmanned interceptors across the avenue ahead of a fleeing driver.
// The barrier sits ROADBLOCK_AHEAD units up the road, lives at most
// ROADBLOCK_MAX_AGE_SEC seconds, and despawns once the driver is far away
// or has clearly passed the barrier plane.
export const ROADBLOCK_MIN_STARS = 3;
export const ROADBLOCK_AHEAD = 640;
export const ROADBLOCK_COOLDOWN_SEC = 14;
export const ROADBLOCK_MAX_AGE_SEC = 50;
export const ROADBLOCK_DESPAWN_DIST = 1050;
export const ROADBLOCK_PASS_CLEAR = 240;

export const BUST_FILL_PER_SEC = 34;
export const BUST_DRAIN_PER_SEC = 22;
export const BUST_RADIUS = 120;

export const GUN_DAMAGE = 34;
export const GUN_RANGE = 520;
export const GUN_COOLDOWN = 0.22;
export const GUN_SPREAD = 0.055;
export const GUN_START_AMMO = 48;
export const ENEMY_DAMAGE = 9;
export const ENEMY_RANGE = 330;

export const DUSK_PAYOUT_MULT = 1.25;

export const SAVE_KEY = 'aurelia-heat-save-v1';

export const DISTRICTS = [
  { name: 'Old Town', x0: 0, y0: 0, x1: 1800, y1: 1600 },
  { name: 'Palm Heights', x0: 1800, y0: 0, x1: 3600, y1: 1600 },
  { name: 'Dockside', x0: 0, y0: 1600, x1: 1800, y1: 3600 },
  { name: 'Downtown Aurelia', x0: 1800, y0: 1600, x1: 3600, y1: 3600 },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Port Aurelia';
}

export function starsForHeat(heat) {
  if (heat <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil(heat / HEAT_PER_STAR)));
}

export function payoutWithDusk(base, dusk) {
  if (!dusk) return { total: base, bonus: 0 };
  const total = Math.round(base * DUSK_PAYOUT_MULT);
  return { total, bonus: total - base };
}
