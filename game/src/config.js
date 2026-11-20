// Every tuning number and colour for Aurelia Heat in one place. The world is a fixed
// 3600x3600 city; the renderer scales a camera window of it to the screen, so no rule
// below depends on the display size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const WORLD = {
  size: 3600,
  /** Distance between avenue centrelines; blocks sit between the roads. */
  block: 450,
  roadWidth: 118,
  /** The sea strip along the south edge: sand, then water nobody can enter. */
  beachY: 3310,
  waterY: 3410,
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  sprintSpeed: 268,
  health: 100,
  punchRange: 34,
  punchDamage: 34,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 340,
  brake: 520,
  reverseMax: 130,
  drag: 0.55,
  gripTurn: 2.6,
  /** Top speeds by class, world units per second. */
  topSpeed: { sedan: 355, taxi: 345, sport: 505, truck: 285, cop: 430 },
};

export const WANTED = {
  /** Heat points per star; stars are ceil(heat / perStar), capped at maxStars. */
  perStar: 26,
  maxStars: 5,
  decayPerSecond: 2.1,
  /** Seconds unseen by any officer before decay starts. */
  hideGrace: 3.5,
  crimes: { carjack: 16, assault: 14, shotFired: 7, hitPed: 30, hitCopCar: 22, copDown: 45, theft: 12 },
};

export const WEAPON = {
  name: 'Sidearm',
  damage: 26,
  fireRate: 0.24,
  bulletSpeed: 920,
  range: 560,
  spread: 0.045,
  startAmmo: 48,
};

export const DUSK = {
  /** Overlay tint washed over the scene while dusk mode is on (L key). */
  tint: '#241a4d',
  tintAlpha: 0.36,
  /** Radius of the pool of light a standard street lamp throws at dusk; each lamp
   *  stores a seeded multiplier on this in the world. */
  lampGlowRadius: 56,
  /** Lamp light colour, as an "r, g, b" triple for rgba() strings in the renderer. */
  lampGlowRgb: '255, 190, 100',
  /** Mission rewards and taxi fares are multiplied by this while dusk is active:
   *  the city pays extra after dark. */
  payoutBonus: 1.25,
  /** Heat decays this much faster at dusk: low light, fewer witnesses. */
  heatDecayFactor: 1.5,
};

export const SAVE_KEY = 'aurelia-heat.save.v1';

export const PALETTE = {
  sky: '#0b0e14',
  grass: '#3d6b35',
  park: '#477a3c',
  sand: '#d9c08a',
  water: '#1d5f7a',
  waterDeep: '#174a61',
  road: '#33373f',
  roadEdge: '#26292f',
  lane: '#c8b25a',
  sidewalk: '#8f9296',
  crosswalk: '#d8d8d2',
  roofDark: '#5a4a52',
  minimapBg: 'rgba(10,14,20,0.78)',
  minimapRoad: '#9aa0a8',
  text: '#f2f0e9',
  muted: '#a7adb8',
  cash: '#7dd87d',
  danger: '#e5534b',
  gold: '#f2c94c',
  mission: '#ffb340',
  police: '#3f7fe0',
};

/** Roof colours cycled through the city blocks; every building is the entrant's own art. */
export const ROOF_COLOURS = [
  '#7a5c48', '#6b6f7a', '#8a6d5a', '#5f7263', '#77626e', '#94816a',
  '#68707c', '#7d6a58', '#5d6b78', '#86755f', '#71655a', '#63755e',
];

export const CAR_COLOURS = [
  '#c94f42', '#3f7fe0', '#e0a83c', '#d8d8d8', '#3a3f46', '#5da05d',
  '#8a5fb0', '#d97fb8', '#4fb3a9', '#b0653a', '#e5e0d0', '#707880',
];

export const DISTRICTS = [
  { name: 'OLD TOWN', x: 0, y: 0, w: 1800, h: 1800 },
  { name: 'PALM HEIGHTS', x: 1800, y: 0, w: 1800, h: 1800 },
  { name: 'DOCKSIDE', x: 0, y: 1800, w: 1800, h: 1510 },
  { name: 'DOWNTOWN AURELIA', x: 1800, y: 1800, w: 1800, h: 1510 },
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
