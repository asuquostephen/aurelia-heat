// Aurelia Heat — core simulation.
// This module owns every moving part of Port Aurelia: the player, traffic,
// pedestrians, patrol cars, gunmen, bullets, pickups, heat and bust logic,
// missions and fares, saving, and the dusk toggle. It knows nothing about
// pixels — render.js draws what lives here — which keeps the whole sim
// testable headlessly with stub input and audio.

import {
  WORLD_SIZE, PLAYER_RADIUS, PLAYER_WALK_SPEED, PLAYER_SPRINT_SPEED,
  PLAYER_MAX_HEALTH, CAR_ENTER_RANGE, VEHICLE_CLASSES, POLICE_CLASS,
  HEAT_MAX, HEAT_DECAY_PER_SEC, HEAT_DECAY_DUSK_PER_SEC, HEAT_UNSEEN_GRACE_SEC,
  CRIME_HEAT, BUST_FILL_PER_SEC, BUST_DRAIN_PER_SEC, BUST_RADIUS,
  GUN_DAMAGE, GUN_RANGE, GUN_COOLDOWN, GUN_SPREAD, GUN_START_AMMO,
  ENEMY_DAMAGE, ENEMY_RANGE, SAVE_KEY, districtAt, starsForHeat, payoutWithDusk,
  ROADBLOCK_MIN_STARS, ROADBLOCK_AHEAD, ROADBLOCK_COOLDOWN_SEC,
  ROADBLOCK_MAX_AGE_SEC, ROADBLOCK_DESPAWN_DIST, ROADBLOCK_PASS_CLEAR,
} from './config.js';
import { createRng, clamp, dist, angleTo, turnToward, jitter } from './random.js';
import { generateWorld, isOnRoad, circleHitsBuilding, placeById, ROAD_LINES, ROAD_HALF, snapToLane, nearestRoadCoord, isJunction } from './world.js';
import { MISSIONS, createMissionState, startMission, completionBanner, fareReward, fareBanner } from './missions.js';

let NEXT_ID = 1;
function nextId() { return NEXT_ID++; }

export function serializeSave(game) {
  return {
    cash: game.player.cash,
    missionIndex: game.missionIndex,
    storyComplete: game.storyComplete,
    ammo: game.player.ammo,
    dusk: game.dusk,
    stats: { ...game.stats },
  };
}

export function applySave(game, data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.cash === 'number') game.player.cash = Math.max(0, Math.floor(data.cash));
  if (typeof data.missionIndex === 'number') game.missionIndex = clamp(Math.floor(data.missionIndex), 0, MISSIONS.length);
  if (typeof data.storyComplete === 'boolean') game.storyComplete = data.storyComplete;
  if (typeof data.ammo === 'number') game.player.ammo = Math.max(0, Math.floor(data.ammo));
  if (typeof data.dusk === 'boolean') game.dusk = data.dusk;
  if (data.stats && typeof data.stats === 'object') {
    for (const key of Object.keys(game.stats)) {
      if (typeof data.stats[key] === 'number') game.stats[key] = data.stats[key];
    }
  }
  return true;
}

export function saveToStorage(game, storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(serializeSave(game)));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadFromStorage(game, storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return false;
    return applySave(game, JSON.parse(raw));
  } catch (err) {
    return false;
  }
}

function makeCar(rng, x, y, heading, cls, opts = {}) {
  return {
    id: nextId(),
    x, y, heading,
    speed: 0,
    classId: cls.id,
    className: cls.name,
    topSpeed: cls.topSpeed,
    accel: cls.accel,
    grip: cls.grip,
    hullMax: cls.hull,
    hull: cls.hull,
    color: opts.color || cls.color,
    parked: !!opts.parked,
    isPolice: !!opts.isPolice,
    roadblock: !!opts.roadblock,
    driver: opts.driver || null, // 'traffic' | 'police' | 'player' | null
    marked: !!opts.marked,
    turnCooldown: 0,
    smoke: 0,
  };
}

function makePed(rng, x, y, opts = {}) {
  return {
    id: nextId(),
    x, y,
    heading: rng.range(0, Math.PI * 2),
    speed: 0,
    state: opts.state || 'wander', // wander | flee | hail | passenger | down
    hailer: !!opts.hailer,
    color: opts.color || `hsl(${Math.floor(rng.range(0, 360))},45%,55%)`,
    wanderTimer: rng.range(1, 4),
    health: 30,
    isDriver: !!opts.isDriver,
  };
}

function makeGunman(x, y, index) {
  return {
    id: nextId(),
    x, y,
    heading: Math.PI,
    health: 100,
    maxHealth: 100,
    cooldown: 0.6 + index * 0.17,
    alive: true,
    name: `Saltline gunman ${index + 1}`,
  };
}

export function createGame(seed = 1, opts = {}) {
  const rng = createRng(seed * 7919 + 13);
  const world = generateWorld(seed);
  const garage = placeById(world, 'garage');
  const game = {
    seed,
    world,
    time: 0,
    mode: 'title', // title | playing | paused | storycomplete | wasted | busted
    dusk: false,
    player: {
      x: garage.x + 60, y: garage.y + 90,
      heading: 0, health: PLAYER_MAX_HEALTH,
      cash: 120, ammo: GUN_START_AMMO,
      inCar: null, aimAngle: 0, gunCooldown: 0, punchCooldown: 0,
      dead: false,
    },
    cars: [],
    peds: [],
    police: [],
    gunmen: [],
    bullets: [],
    tracers: [],
    pickups: [],
    bags: [],
    heat: 0,
    bust: 0,
    unseenTime: 0,
    seenByPolice: false,
    missionIndex: 0,
    mission: createMissionState(),
    storyComplete: false,
    fare: null, // { pedId, fromX, fromY, dest, phase }
    banner: null,
    bannerTimer: 0,
    dialogue: null,
    dialogueTimer: 0,
    stats: { crimes: 0, shotsFired: 0, faresDone: 0, missionsDone: 0, busts: 0, wasted: 0, carsStolen: 0 },
    audio: opts.audio || null,
    roadblocks: [],
    roadblock: null,
    roadblockCooldown: 0,
    lastCrime: null,
    objectiveText: 'Press M for your next job from Marlo',
    objectiveDist: null,
    objectivePos: null,
    timerText: null,
    spawnTimer: 0,
  };

  seedTraffic(game, rng);
  seedParkedCars(game, rng);
  seedPeds(game, rng);
  seedPickups(game, rng);
  game._rng = rng;
  return game;
}

function seedTraffic(game, rng) {
  for (let i = 0; i < 14; i++) {
    const horizontal = rng.chance(0.5);
    const line = rng.pick(ROAD_LINES);
    const along = rng.range(200, WORLD_SIZE - 200);
    const dir = rng.chance(0.5) ? 1 : -1;
    const heading = horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const x = horizontal ? along : line + dir * -26;
    const y = horizontal ? line + dir * 26 : along;
    const cls = rng.pick(VEHICLE_CLASSES);
    const car = makeCar(rng, x, y, heading, cls, { driver: 'traffic' });
    car.speed = cls.topSpeed * rng.range(0.35, 0.55);
    game.cars.push(car);
  }
}

function seedParkedCars(game, rng) {
  for (let i = 0; i < 16; i++) {
    const line = rng.pick(ROAD_LINES);
    const horizontal = rng.chance(0.5);
    const along = rng.range(160, WORLD_SIZE - 160);
    const x = horizontal ? along : line + (rng.chance(0.5) ? ROAD_HALF + 18 : -ROAD_HALF - 18);
    const y = horizontal ? line + (rng.chance(0.5) ? ROAD_HALF + 18 : -ROAD_HALF - 18) : along;
    if (circleHitsBuilding(game.world, x, y, 30)) continue;
    const cls = rng.pick(VEHICLE_CLASSES);
    game.cars.push(makeCar(rng, x, y, horizontal ? 0 : Math.PI / 2, cls, { parked: true }));
  }
}

function seedPeds(game, rng) {
  for (let i = 0; i < 22; i++) {
    const line = rng.pick(ROAD_LINES);
    const horizontal = rng.chance(0.5);
    const along = rng.range(120, WORLD_SIZE - 120);
    const off = (rng.chance(0.5) ? 1 : -1) * (ROAD_HALF + 16);
    const x = horizontal ? along : line + off;
    const y = horizontal ? line + off : along;
    const ped = makePed(rng, x, y, { hailer: i % 7 === 0 });
    if (ped.hailer) ped.state = 'hail';
    game.peds.push(ped);
  }
}

function seedPickups(game, rng) {
  const spots = game.world.places;
  for (let i = 0; i < spots.length; i++) {
    const p = spots[i];
    const kind = i % 3 === 0 ? 'health' : i % 3 === 1 ? 'ammo' : 'cash';
    game.pickups.push({ id: nextId(), x: p.x + 36, y: p.y + 30, kind, amount: kind === 'cash' ? 60 : kind === 'ammo' ? 18 : 40, taken: false });
  }
}

export function addHeat(game, crime) {
  const amount = CRIME_HEAT[crime] || 10;
  game.heat = clamp(game.heat + amount, 0, HEAT_MAX);
  game.stats.crimes += 1;
  game.lastCrime = crime;
  game.unseenTime = 0;
  return game.heat;
}

export function starsOf(game) {
  return starsForHeat(game.heat);
}

export function setBanner(game, text, seconds = 4) {
  game.banner = text;
  game.bannerTimer = seconds;
}

export function setDialogue(game, text, seconds = 6) {
  game.dialogue = text;
  game.dialogueTimer = seconds;
}

export function toggleDusk(game) {
  game.dusk = !game.dusk;
  if (game.audio && game.audio.setDusk) game.audio.setDusk(game.dusk);
  setBanner(game, game.dusk ? 'Dusk Mode — payouts +25%, heat fades faster' : 'Dusk Mode off', 3);
  return game.dusk;
}

// --- Police roadblocks -----------------------------------------------------
// A roadblock is three unmanned patrol interceptors parked nose-to-tail
// across the player's avenue, placed ahead of a fast fleeing driver at three
// stars or more. The cars live in game.cars so traffic braking, collisions
// and the renderer all treat them like any other vehicle; the meta record
// tracks the barrier plane so the lifecycle can tell when the driver has
// rammed through, slipped past, or simply outrun the setup.

export function clearRoadblock(game, cooldownSec) {
  if (game.roadblock) {
    const doomed = new Set(game.roadblock.cars);
    game.cars = game.cars.filter((c) => !doomed.has(c));
    game.roadblocks = game.roadblocks.filter((c) => !doomed.has(c));
    game.roadblock = null;
  }
  if (typeof cooldownSec === 'number') game.roadblockCooldown = cooldownSec;
}

export function deployRoadblock(game) {
  if (game.roadblock) return false;
  const car = game.player.inCar;
  if (!car) return false;
  const pos = playerPos(game);
  if (!isOnRoad(pos.x, pos.y)) return false;
  const horizontal = Math.abs(Math.cos(car.heading)) >= Math.abs(Math.sin(car.heading));
  const rng = game._rng;
  const cars = [];
  if (horizontal) {
    const dirSign = Math.cos(car.heading) >= 0 ? 1 : -1;
    // Snap the barrier to the avenue the player is actually driving on.
    // nearestRoadCoord gives the closest centre-line; if the player is
    // not inside that avenue's band there is no road to block, so bail
    // exactly as the old hand-rolled scan did when it found no line.
    const roadY = nearestRoadCoord(pos.y);
    if (Math.abs(pos.y - roadY) > ROAD_HALF) return false;
    let bx = pos.x + dirSign * ROADBLOCK_AHEAD;
    // Keep the barrier clear of the next junction: if the drop point
    // lands within a junction's apron, push it one block further along
    // the direction of travel so cross traffic keeps a way through.
    if (isJunction(bx, pos.y, 46)) bx += dirSign * 180;
    bx = clamp(bx, 140, WORLD_SIZE - 140);
    if (Math.abs(bx - pos.x) < 380) return false;
    for (const off of [-40, 0, 40]) {
      const rc = makeCar(rng, bx, roadY + off, Math.PI / 2 + jitter(0.12), POLICE_CLASS, { parked: true, isPolice: true, roadblock: true, driver: null });
      cars.push(rc);
    }
    game.roadblock = { x: bx, y: roadY, horizontal: true, dirSign, age: 0, cars };
  } else {
    const dirSign = Math.sin(car.heading) >= 0 ? 1 : -1;
    // Same snap-and-guard as the horizontal case, axes swapped: the
    // barrier spans the vertical avenue the player is travelling on.
    const roadX = nearestRoadCoord(pos.x);
    if (Math.abs(pos.x - roadX) > ROAD_HALF) return false;
    let by = pos.y + dirSign * ROADBLOCK_AHEAD;
    // Junction clearance, mirroring the horizontal branch.
    if (isJunction(pos.x, by, 46)) by += dirSign * 180;
    by = clamp(by, 140, WORLD_SIZE - 140);
    if (Math.abs(by - pos.y) < 380) return false;
    for (const off of [-40, 0, 40]) {
      const rc = makeCar(rng, roadX + off, by, jitter(0.12), POLICE_CLASS, { parked: true, isPolice: true, roadblock: true, driver: null });
      cars.push(rc);
    }
    game.roadblock = { x: roadX, y: by, horizontal: false, dirSign, age: 0, cars };
  }
  for (const rc of cars) {
    game.cars.push(rc);
    game.roadblocks.push(rc);
  }
  setBanner(game, 'Police roadblock ahead — ram through, swerve off-road, or turn back', 4);
  if (game.audio && game.audio.radioChirp) game.audio.radioChirp();
  return true;
}

export function updateRoadblocks(game, dt) {
  game.roadblockCooldown = Math.max(0, game.roadblockCooldown - dt);
  const pos = playerPos(game);
  if (!game.roadblock) {
    const car = game.player.inCar;
    if (starsOf(game) >= ROADBLOCK_MIN_STARS && car && Math.abs(car.speed) > 60 && game.roadblockCooldown <= 0) {
      if (!deployRoadblock(game)) game.roadblockCooldown = 3;
    }
    return;
  }
  const meta = game.roadblock;
  meta.age += dt;
  const d = dist(pos.x, pos.y, meta.x, meta.y);
  let passed = false;
  if (meta.horizontal) passed = (pos.x - meta.x) * meta.dirSign > ROADBLOCK_PASS_CLEAR;
  else passed = (pos.y - meta.y) * meta.dirSign > ROADBLOCK_PASS_CLEAR;
  if (starsOf(game) < ROADBLOCK_MIN_STARS || d > ROADBLOCK_DESPAWN_DIST || meta.age > ROADBLOCK_MAX_AGE_SEC || passed) {
    clearRoadblock(game, ROADBLOCK_COOLDOWN_SEC);
  }
}

export function nearestCar(game, maxDist = CAR_ENTER_RANGE) {
  let best = null;
  let bestD = maxDist;
  for (const car of game.cars) {
    if (car.driver === 'player') continue;
    const d = dist(game.player.x, game.player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  for (const car of game.police) {
    const d = dist(game.player.x, game.player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterNearestCar(game) {
  if (game.player.inCar) return exitCar(game);
  const car = nearestCar(game);
  if (!car) return false;
  const wasDriven = car.driver === 'traffic';
  if (wasDriven) {
    // Carjacking: the driver bails out and flees on foot.
    const ped = makePed(game._rng, car.x + 30, car.y + 10, { state: 'flee', isDriver: true });
    game.peds.push(ped);
    addHeat(game, 'carjack');
    game.stats.carsStolen += 1;
  } else if (car.parked) {
    addHeat(game, 'theft');
    game.stats.carsStolen += 1;
  }
  // Stealing a roadblock interceptor pulls it out of the barrier: taking
  // the middle car opens a gap the driver can slip through afterwards.
  if (car.roadblock) {
    car.roadblock = false;
    game.roadblocks = game.roadblocks.filter((c) => c !== car);
    if (game.roadblock) {
      game.roadblock.cars = game.roadblock.cars.filter((c) => c !== car);
      if (game.roadblock.cars.length === 0) {
        game.roadblock = null;
        game.roadblockCooldown = ROADBLOCK_COOLDOWN_SEC;
      }
    }
  }
  car.driver = 'player';
  car.parked = false;
  game.player.inCar = car;
  if (game.audio && game.audio.doorSlam) game.audio.doorSlam();
  return true;
}

export function exitCar(game) {
  const car = game.player.inCar;
  if (!car) return false;
  car.driver = null;
  if (Math.abs(car.speed) < 5) car.parked = true;
  game.player.x = car.x + Math.cos(car.heading + Math.PI / 2) * 34;
  game.player.y = car.y + Math.sin(car.heading + Math.PI / 2) * 34;
  game.player.inCar = null;
  if (game.audio && game.audio.doorSlam) game.audio.doorSlam();
  return true;
}

export function playerPos(game) {
  if (game.player.inCar) return { x: game.player.inCar.x, y: game.player.inCar.y };
  return { x: game.player.x, y: game.player.y };
}

export function shoot(game, aimAngle) {
  const p = game.player;
  if (p.inCar || p.gunCooldown > 0 || p.ammo <= 0 || p.dead) return false;
  p.ammo -= 1;
  p.gunCooldown = GUN_COOLDOWN;
  p.aimAngle = aimAngle;
  game.stats.shotsFired += 1;
  const angle = aimAngle + jitter(GUN_SPREAD);
  const bullet = {
    id: nextId(),
    x: p.x, y: p.y,
    vx: Math.cos(angle) * 900,
    vy: Math.sin(angle) * 900,
    life: GUN_RANGE / 900,
    fromPlayer: true,
  };
  game.bullets.push(bullet);
  game.tracers.push({ x1: p.x, y1: p.y, x2: p.x + Math.cos(angle) * 60, y2: p.y + Math.sin(angle) * 60, life: 0.07 });
  addHeat(game, 'gunfire');
  scarePeds(game, p.x, p.y, 260);
  if (game.audio && game.audio.gunshot) game.audio.gunshot();
  return true;
}

export function punch(game) {
  const p = game.player;
  if (p.inCar || p.punchCooldown > 0 || p.dead) return false;
  p.punchCooldown = 0.35;
  if (game.audio && game.audio.punch) game.audio.punch();
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    if (dist(p.x, p.y, ped.x, ped.y) < 36) {
      ped.health -= 20;
      ped.state = ped.health <= 0 ? 'down' : 'flee';
      addHeat(game, 'assault');
      return true;
    }
  }
  for (const g of game.gunmen) {
    if (g.alive && dist(p.x, p.y, g.x, g.y) < 38) {
      g.health -= 25;
      if (g.health <= 0) killGunman(game, g);
      return true;
    }
  }
  return true;
}

function killGunman(game, g) {
  g.alive = false;
  game.pickups.push({ id: nextId(), x: g.x, y: g.y, kind: 'cash', amount: 45, taken: false });
  if (game.mission.phase === 'active') {
    const def = MISSIONS[game.mission.activeIndex];
    if (def && def.kind === 'clear-gunmen') game.mission.progress += 1;
  }
}

export function scarePeds(game, x, y, radius) {
  for (const ped of game.peds) {
    if (ped.state === 'wander' && dist(x, y, ped.x, ped.y) < radius) ped.state = 'flee';
  }
}

function damageCar(game, car, amount) {
  car.hull = Math.max(0, car.hull - amount);
  car.smoke = clamp(car.hullMax > 0 ? 1 - car.hull / car.hullMax : 0, 0, 1);
}

export function startNextMission(game) {
  if (game.mission.phase === 'active') return null;
  if (game.missionIndex >= MISSIONS.length) return null;
  const def = startMission(game.mission, game.missionIndex);
  if (!def) return null;
  setDialogue(game, def.intro, 8);
  // Mission-specific staging.
  if (def.kind === 'escape' && def.forcedStars) {
    game.heat = Math.max(game.heat, def.forcedStars * 100 - 50);
  }
  if (def.kind === 'clear-gunmen') {
    const anchor = placeById(game.world, def.nearPlace);
    game.gunmen = [];
    for (let i = 0; i < def.gunmen; i++) {
      game.gunmen.push(makeGunman(anchor.x + 60 + i * 46, anchor.y + 40 + (i % 2) * 60, i));
    }
  }
  if (def.kind === 'collect-escape') {
    const downtown = game.world.places.filter((pl) => ['tower', 'depot', 'courthouse'].includes(pl.id));
    game.bags = downtown.map((pl, i) => ({ id: nextId(), x: pl.x + 20, y: pl.y + 50, taken: false, index: i }));
    game.mission.progress = 0;
  }
  if (game.audio && game.audio.missionSting) game.audio.missionSting(true);
  refreshObjective(game);
  return def;
}

export function completeMission(game) {
  const def = MISSIONS[game.mission.activeIndex];
  if (!def) return 0;
  const pay = payoutWithDusk(def.reward, game.dusk);
  game.player.cash += pay.total;
  game.stats.missionsDone += 1;
  game.mission.phase = 'idle';
  game.mission.activeIndex = -1;
  game.missionIndex += 1;
  setDialogue(game, def.outro, 7);
  setBanner(game, completionBanner(def, game.dusk), 5);
  if (game.audio && game.audio.cashRegister) game.audio.cashRegister();
  if (game.missionIndex >= MISSIONS.length) {
    game.storyComplete = true;
    game.mode = 'storycomplete';
  }
  saveToStorage(game);
  refreshObjective(game);
  return pay.total;
}

export function failMission(game, reason) {
  const def = MISSIONS[game.mission.activeIndex];
  game.mission.phase = 'idle';
  game.mission.activeIndex = -1;
  game.gunmen = game.gunmen.filter(() => false);
  game.bags = [];
  setBanner(game, `Job failed${def ? `: ${def.title}` : ''}${reason ? ` — ${reason}` : ''}. Press M to retry.`, 5);
  if (game.audio && game.audio.missionSting) game.audio.missionSting(false);
  refreshObjective(game);
}

export function refreshObjective(game) {
  const pos = playerPos(game);
  game.timerText = null;
  if (game.fare) {
    const target = game.fare.phase === 'pickup' ? game.fare : game.fare.dest;
    game.objectiveText = game.fare.phase === 'pickup' ? 'Pick up your fare' : `Drop off at ${game.fare.dest.name}`;
    game.objectivePos = { x: target.x, y: target.y };
    game.objectiveDist = Math.round(dist(pos.x, pos.y, target.x, target.y));
    return;
  }
  if (game.mission.phase !== 'active') {
    game.objectiveText = game.storyComplete ? 'Story complete — free roam Port Aurelia' : 'Press M for your next job from Marlo';
    game.objectivePos = placeById(game.world, 'garage');
    game.objectiveDist = null;
    return;
  }
  const def = MISSIONS[game.mission.activeIndex];
  game.objectiveText = def.objective;
  let target = null;
  if (def.kind === 'goto' || def.kind === 'timed-deliver') target = placeById(game.world, def.targetPlace);
  else if (def.kind === 'steal-deliver') target = game.player.inCar && game.player.inCar.classId === def.vehicleClass ? placeById(game.world, 'garage') : null;
  else if (def.kind === 'clear-gunmen') target = placeById(game.world, def.nearPlace);
  else if (def.kind === 'collect-escape') {
    const remaining = game.bags.find((b) => !b.taken);
    target = remaining || null;
    if (!remaining) game.objectiveText = 'All bags collected — escape the wanted level';
  } else if (def.kind === 'escape') {
    game.objectiveText = `Escape: stay unseen (${Math.max(0, Math.ceil(HEAT_UNSEEN_GRACE_SEC - game.unseenTime))}s to go dark)`;
  }
  game.objectivePos = target;
  game.objectiveDist = target ? Math.round(dist(pos.x, pos.y, target.x, target.y)) : null;
  if (def.kind === 'timed-deliver') game.timerText = `${Math.max(0, Math.ceil(game.mission.timer))}s`;
}

function checkMissionProgress(game) {
  if (game.mission.phase !== 'active') return;
  const def = MISSIONS[game.mission.activeIndex];
  const pos = playerPos(game);
  if (def.kind === 'goto') {
    const t = placeById(game.world, def.targetPlace);
    if (dist(pos.x, pos.y, t.x, t.y) < 90) completeMission(game);
  } else if (def.kind === 'timed-deliver') {
    const t = placeById(game.world, def.targetPlace);
    if (dist(pos.x, pos.y, t.x, t.y) < 90) completeMission(game);
  } else if (def.kind === 'steal-deliver') {
    const garage = placeById(game.world, 'garage');
    if (game.player.inCar && game.player.inCar.classId === def.vehicleClass && dist(pos.x, pos.y, garage.x, garage.y) < 110) {
      const car = game.player.inCar;
      exitCar(game);
      game.cars = game.cars.filter((c) => c !== car);
      completeMission(game);
    }
  } else if (def.kind === 'escape') {
    if (game.heat <= 0) completeMission(game);
  } else if (def.kind === 'clear-gunmen') {
    if (game.mission.progress >= def.gunmen) completeMission(game);
  } else if (def.kind === 'collect-escape') {
    for (const bag of game.bags) {
      if (!bag.taken && dist(pos.x, pos.y, bag.x, bag.y) < 44) {
        bag.taken = true;
        game.mission.progress += 1;
        game.heat = clamp(game.heat + 80, 0, HEAT_MAX);
        setBanner(game, `Bag ${game.mission.progress} of ${def.bags} collected`, 3);
        if (game.audio && game.audio.pickup) game.audio.pickup();
      }
    }
    if (game.mission.progress >= def.bags && game.heat <= 0) completeMission(game);
  }
}

export function tryStartFare(game) {
  if (game.fare || !game.player.inCar) return false;
  for (const ped of game.peds) {
    if (ped.state !== 'hail') continue;
    if (dist(game.player.inCar.x, game.player.inCar.y, ped.x, ped.y) < 70) {
      const dests = game.world.places.filter((pl) => dist(pl.x, pl.y, ped.x, ped.y) > 700);
      const dest = game._rng.pick(dests) || game.world.places[0];
      game.fare = { pedId: ped.id, fromX: ped.x, fromY: ped.y, dest, phase: 'dropoff', distance: dist(ped.x, ped.y, dest.x, dest.y) };
      ped.state = 'passenger';
      setBanner(game, `Fare on board — drop off at ${dest.name}`, 4);
      refreshObjective(game);
      return true;
    }
  }
  return false;
}

function checkFareProgress(game) {
  if (!game.fare) return;
  const pos = playerPos(game);
  if (game.fare.phase === 'dropoff' && dist(pos.x, pos.y, game.fare.dest.x, game.fare.dest.y) < 100) {
    const pay = fareReward(game.fare.distance, game.dusk);
    game.player.cash += pay.total;
    game.stats.faresDone += 1;
    const ped = game.peds.find((p) => p.id === game.fare.pedId);
    if (ped) { ped.state = 'wander'; ped.x = pos.x + 40; ped.y = pos.y + 20; ped.hailer = false; }
    setBanner(game, fareBanner(game.fare.distance, game.dusk), 5);
    if (game.audio && game.audio.cashRegister) game.audio.cashRegister();
    game.fare = null;
    saveToStorage(game);
    refreshObjective(game);
  }
}

export function hospitalRespawn(game, reason) {
  const clinic = placeById(game.world, 'clinic');
  if (game.player.inCar) {
    game.player.inCar.driver = null;
    game.player.inCar = null;
  }
  game.player.x = clinic.x + 40;
  game.player.y = clinic.y + 60;
  game.player.health = PLAYER_MAX_HEALTH;
  game.player.dead = false;
  game.heat = 0;
  game.bust = 0;
  game.police = [];
  // A bust or a hospital trip ends the roadblock: its cars leave the world.
  if (game.roadblocks && game.roadblocks.length) {
    const doomed = new Set(game.roadblocks);
    game.cars = game.cars.filter((c) => !doomed.has(c));
  }
  game.roadblocks = [];
  game.roadblock = null;
  game.bullets = [];
  game.fare = null;
  if (reason === 'wasted') {
    const bill = Math.floor(game.player.cash * 0.10);
    game.player.cash -= bill;
    game.stats.wasted += 1;
    setBanner(game, `WASTED — Aurelia Clinic bill $${bill} (10% of cash)`, 5);
    if (game.audio && game.audio.wastedFall) game.audio.wastedFall();
  } else {
    const fine = Math.min(game.player.cash, 150 + starsOf(game) * 40);
    game.player.cash -= fine;
    game.stats.busts += 1;
    setBanner(game, `BUSTED — fined $${fine}, released from Aurelia Clinic`, 5);
    if (game.audio && game.audio.bustedFall) game.audio.bustedFall();
    if (game.mission.phase === 'active') failMission(game, 'busted');
  }
  game.mode = 'playing';
  refreshObjective(game);
}

function updatePlayer(game, input, dt) {
  const p = game.player;
  p.gunCooldown = Math.max(0, p.gunCooldown - dt);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  if (p.inCar) return;
  const ax = input ? input.axisX() : 0;
  const ay = input ? input.axisY() : 0;
  if (ax === 0 && ay === 0) return;
  const len = Math.sqrt(ax * ax + ay * ay) || 1;
  const speed = input && input.sprintHeld() ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;
  const nx = clamp(p.x + (ax / len) * speed * dt, 20, WORLD_SIZE - 20);
  const ny = clamp(p.y + (ay / len) * speed * dt, 20, WORLD_SIZE - 20);
  if (!circleHitsBuilding(game.world, nx, p.y, PLAYER_RADIUS)) p.x = nx;
  if (!circleHitsBuilding(game.world, p.x, ny, PLAYER_RADIUS)) p.y = ny;
  p.heading = Math.atan2(ay, ax);
}

function driveCar(game, car, throttle, steer, dt) {
  const clsTop = car.topSpeed;
  if (throttle > 0) car.speed += car.accel * dt;
  else if (throttle < 0) car.speed -= car.accel * 0.7 * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 90 * dt);
  car.speed = clamp(car.speed, -clsTop * 0.35, clsTop);
  if (Math.abs(car.speed) > 4 && steer !== 0) {
    car.heading += steer * (car.grip * 0.55) * dt * Math.sign(car.speed);
  }
  const nx = car.x + Math.cos(car.heading) * car.speed * dt;
  const ny = car.y + Math.sin(car.heading) * car.speed * dt;
  const hit = circleHitsBuilding(game.world, nx, ny, 24);
  if (hit) {
    if (Math.abs(car.speed) > 120) {
      damageCar(game, car, Math.abs(car.speed) * 0.06);
      if (car.driver === 'player' && game.audio && game.audio.crash) game.audio.crash(0.8);
      if (car.driver === 'player') addHeat(game, 'property');
    }
    car.speed *= -0.25;
    return;
  }
  car.x = clamp(nx, 24, WORLD_SIZE - 24);
  car.y = clamp(ny, 24, WORLD_SIZE - 24);
}

function updatePlayerCar(game, input, dt) {
  const car = game.player.inCar;
  if (!car) return;
  let throttle = 0;
  let steer = 0;
  if (input) {
    if (input.down('KeyW') || input.down('ArrowUp')) throttle = 1;
    if (input.down('KeyS') || input.down('ArrowDown')) throttle = -1;
    if (input.down('KeyA') || input.down('ArrowLeft')) steer = -1;
    if (input.down('KeyD') || input.down('ArrowRight')) steer = 1;
  }
  driveCar(game, car, throttle, steer, dt);
  game.player.x = car.x;
  game.player.y = car.y;
  // Car versus car. Roadblock interceptors are unmanned and light enough
  // to shove aside at speed: a fast ram knocks the barrier car sideways and
  // costs the driver less momentum than a head-on stop, while a slow grind
  // just crumples both hulls without fresh heat.
  for (const other of [...game.cars, ...game.police]) {
    if (other === car) continue;
    if (dist(car.x, car.y, other.x, other.y) < 46) {
      damageCar(game, car, 4);
      damageCar(game, other, 4);
      if (game.audio && game.audio.crash) game.audio.crash(0.5);
      if (other.roadblock) {
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const speedAbs = Math.abs(car.speed);
        const shove = clamp((speedAbs - 50) * 0.09, 0, 26);
        other.x += (dx / len) * shove;
        other.y += (dy / len) * shove;
        other.heading += shove * 0.012 * (Math.random() < 0.5 ? -1 : 1);
        if (speedAbs > 90) addHeat(game, 'ramPatrol');
        car.speed *= speedAbs > 200 ? 0.8 : 0.45;
      } else {
        if (other.isPolice) addHeat(game, 'ramPatrol');
        car.speed *= 0.55;
        other.speed *= 0.4;
      }
    }
  }
  // Running down pedestrians is a serious crime.
  for (const ped of game.peds) {
    if (ped.state === 'down' || ped.state === 'passenger') continue;
    if (Math.abs(car.speed) > 60 && dist(car.x, car.y, ped.x, ped.y) < 30) {
      ped.state = 'down';
      ped.health = 0;
      addHeat(game, 'hitAndRun');
    } else if (Math.abs(car.speed) > 140 && dist(car.x, car.y, ped.x, ped.y) < 90) {
      ped.state = 'flee';
    }
  }
}

function updateTraffic(game, dt) {
  const pos = playerPos(game);
  for (const car of game.cars) {
    if (car.driver !== 'traffic') continue;
    const d = dist(pos.x, pos.y, car.x, car.y);
    if (d > 1500) {
      // Respawn far traffic near the player so the city always feels alive.
      const line = game._rng.pick(ROAD_LINES);
      car.x = clamp(pos.x + game._rng.range(-700, 700), 80, WORLD_SIZE - 80);
      car.y = line + 26;
      car.heading = 0;
      const snapped = snapToLane(car.x, car.y, car.heading);
      car.y = snapped.y;
    }
    // Brake for the car ahead.
    let targetSpeed = car.topSpeed * 0.45;
    for (const other of game.cars) {
      if (other === car) continue;
      const aheadX = car.x + Math.cos(car.heading) * 80;
      const aheadY = car.y + Math.sin(car.heading) * 80;
      if (dist(aheadX, aheadY, other.x, other.y) < 55) targetSpeed = 0;
    }
    if (game.player.inCar) {
      const aheadX = car.x + Math.cos(car.heading) * 80;
      const aheadY = car.y + Math.sin(car.heading) * 80;
      if (dist(aheadX, aheadY, game.player.inCar.x, game.player.inCar.y) < 55) targetSpeed = 0;
    }
    car.speed += clamp(targetSpeed - car.speed, -car.accel * dt, car.accel * dt);
    car.turnCooldown -= dt;
    // Random turns at junctions: when close to a cross avenue, maybe turn.
    if (car.turnCooldown <= 0) {
      for (const line of ROAD_LINES) {
        const horizontal = Math.abs(Math.cos(car.heading)) > 0.5;
        const near = horizontal ? Math.abs(car.x - line) < 30 : Math.abs(car.y - line) < 30;
        if (near && game._rng.chance(0.012)) {
          car.heading += game._rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
          const snapped = snapToLane(car.x, car.y, car.heading);
          car.x = snapped.x;
          car.y = snapped.y;
          car.turnCooldown = 3;
          break;
        }
      }
    }
    const nx = car.x + Math.cos(car.heading) * car.speed * dt;
    const ny = car.y + Math.sin(car.heading) * car.speed * dt;
    if (!circleHitsBuilding(game.world, nx, ny, 24)) {
      car.x = clamp(nx, 24, WORLD_SIZE - 24);
      car.y = clamp(ny, 24, WORLD_SIZE - 24);
    } else {
      car.heading += Math.PI;
      car.speed = Math.abs(car.speed) * 0.3;
    }
    if (!isOnRoad(car.x, car.y)) {
      const snapped = snapToLane(car.x, car.y, car.heading);
      car.x += (snapped.x - car.x) * Math.min(1, dt * 2);
      car.y += (snapped.y - car.y) * Math.min(1, dt * 2);
    }
  }
}

function updatePeds(game, dt) {
  const pos = playerPos(game);
  for (const ped of game.peds) {
    if (ped.state === 'down' || ped.state === 'passenger') continue;
    ped.wanderTimer -= dt;
    if (ped.state === 'hail') {
      if (game.player.inCar && dist(pos.x, pos.y, ped.x, ped.y) < 70) tryStartFare(game);
      continue;
    }
    if (ped.state === 'flee') {
      ped.heading = angleTo(pos.x, pos.y, ped.x, ped.y);
      ped.speed = 190;
      if (dist(pos.x, pos.y, ped.x, ped.y) > 420) ped.state = ped.hailer ? 'hail' : 'wander';
    } else {
      ped.speed = 55;
      if (ped.wanderTimer <= 0) {
        ped.heading = game._rng.range(0, Math.PI * 2);
        ped.wanderTimer = game._rng.range(1.5, 4);
      }
    }
    const nx = ped.x + Math.cos(ped.heading) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.heading) * ped.speed * dt;
    if (!circleHitsBuilding(game.world, nx, ny, 10)) {
      ped.x = clamp(nx, 16, WORLD_SIZE - 16);
      ped.y = clamp(ny, 16, WORLD_SIZE - 16);
    } else {
      ped.heading += Math.PI / 2;
    }
  }
}

export function desiredPoliceCount(game) {
  const stars = starsOf(game);
  if (stars === 0) return 0;
  return Math.min(2 + stars * 2, 10);
}

function spawnPolice(game) {
  const pos = playerPos(game);
  const angle = game._rng.range(0, Math.PI * 2);
  const x = clamp(pos.x + Math.cos(angle) * 620, 60, WORLD_SIZE - 60);
  const y = clamp(pos.y + Math.sin(angle) * 620, 60, WORLD_SIZE - 60);
  const snapped = snapToLane(x, y, angleTo(x, y, pos.x, pos.y));
  const car = makeCar(game._rng, snapped.x, snapped.y, angleTo(x, y, pos.x, pos.y), POLICE_CLASS, { driver: 'police', isPolice: true, color: '#eef1f5' });
  game.police.push(car);
  return car;
}

function updatePolice(game, dt) {
  const pos = playerPos(game);
  const want = desiredPoliceCount(game);
  game.spawnTimer -= dt;
  if (game.police.length < want && game.spawnTimer <= 0) {
    spawnPolice(game);
    game.spawnTimer = 1.2;
  }
  if (game.police.length > want) {
    game.police = game.police.filter((car) => dist(pos.x, pos.y, car.x, car.y) < 1100);
    while (game.police.length > want) game.police.pop();
  }
  let anySee = false;
  let nearest = null;
  if (!game.lastSeen) game.lastSeen = { x: pos.x, y: pos.y };
  for (const car of game.police) {
    const d = dist(pos.x, pos.y, car.x, car.y);
    if (nearest === null || d < nearest) nearest = d;
    const seesPlayer = d < 480;
    if (seesPlayer) {
      anySee = true;
      game.lastSeen.x = pos.x;
      game.lastSeen.y = pos.y;
    }
    // Predicted intercept while the player is in sight: aim where the target
    // is heading, not where it is. Once contact is lost the patrol falls back
    // to the last seen position and searches there — which is what makes
    // breaking line of sight, and heat decay while hidden, actually work.
    const targetSpeed = seesPlayer && game.player.inCar ? game.player.inCar.speed : 0;
    const targetHeading = game.player.inCar ? game.player.inCar.heading : game.player.heading;
    const lead = seesPlayer ? clamp(d / 500, 0, 1.1) : 0;
    const baseX = seesPlayer ? pos.x : game.lastSeen.x;
    const baseY = seesPlayer ? pos.y : game.lastSeen.y;
    const tx = baseX + Math.cos(targetHeading) * targetSpeed * 0.55 * lead;
    const ty = baseY + Math.sin(targetHeading) * targetSpeed * 0.55 * lead;
    const desired = angleTo(car.x, car.y, tx, ty);
    const steer = clamp((turnToward(car.heading, desired, 10) - car.heading), -1, 1);
    car.heading = turnToward(car.heading, desired, car.grip * 0.6 * dt);
    void steer;
    const distToTarget = dist(car.x, car.y, tx, ty);
    const throttle = distToTarget > 55 ? 1 : 0.2;
    driveCar(game, car, throttle, 0, dt);
    if (d < 48 && game.player.inCar) {
      damageCar(game, game.player.inCar, 3);
      car.speed *= 0.6;
    }
  }
  // Roadblock crews keep eyes on the barrier even though their cars are
  // unmanned: being watched by a roadblock counts as being seen, so heat
  // stops cooling and a cornered driver can still be busted at the barrier.
  for (const rc of game.roadblocks || []) {
    const d = dist(pos.x, pos.y, rc.x, rc.y);
    if (nearest === null || d < nearest) nearest = d;
    if (d < 380) {
      anySee = true;
      game.lastSeen.x = pos.x;
      game.lastSeen.y = pos.y;
    }
  }
  game.seenByPolice = anySee;
  if (game.audio && game.audio.setSiren) game.audio.setSiren(game.police.length ? nearest : null);
  // Heat decay: only while unseen, after a grace period, faster the longer
  // the player stays hidden — and faster again under Dusk Mode.
  if (game.heat > 0) {
    if (anySee) {
      game.unseenTime = 0;
    } else {
      game.unseenTime += dt;
      if (game.unseenTime > HEAT_UNSEEN_GRACE_SEC) {
        const hiddenBonus = clamp((game.unseenTime - HEAT_UNSEEN_GRACE_SEC) * 0.35, 0, 6);
        const rate = (game.dusk ? HEAT_DECAY_DUSK_PER_SEC : HEAT_DECAY_PER_SEC) + hiddenBonus;
        game.heat = Math.max(0, game.heat - rate * dt);
      }
    }
  }
  // Bust meter: cornered + slow (or on foot) near patrol cars fills it.
  const playerSpeed = game.player.inCar ? Math.abs(game.player.inCar.speed) : 0;
  const cornered = nearest !== null && nearest < BUST_RADIUS && (!game.player.inCar || playerSpeed < 45);
  if (cornered && starsOf(game) > 0) {
    game.bust = clamp(game.bust + BUST_FILL_PER_SEC * dt, 0, 100);
  } else {
    game.bust = clamp(game.bust - BUST_DRAIN_PER_SEC * dt, 0, 100);
  }
  if (game.bust >= 100) hospitalRespawn(game, 'busted');
}

function updateGunmen(game, dt) {
  const pos = playerPos(game);
  for (const g of game.gunmen) {
    if (!g.alive) continue;
    const d = dist(pos.x, pos.y, g.x, g.y);
    g.heading = angleTo(g.x, g.y, pos.x, pos.y);
    if (d > 150) {
      const nx = g.x + Math.cos(g.heading) * 95 * dt;
      const ny = g.y + Math.sin(g.heading) * 95 * dt;
      if (!circleHitsBuilding(game.world, nx, ny, 12)) { g.x = nx; g.y = ny; }
    }
    g.cooldown -= dt;
    if (d < ENEMY_RANGE && g.cooldown <= 0 && !game.player.inCar) {
      g.cooldown = 1.05;
      game.bullets.push({ id: nextId(), x: g.x, y: g.y, vx: Math.cos(g.heading + jitter(0.09)) * 620, vy: Math.sin(g.heading + jitter(0.09)) * 620, life: ENEMY_RANGE / 620, fromPlayer: false });
      if (game.audio && game.audio.gunshot) game.audio.gunshot();
    }
  }
}

function updateBullets(game, dt) {
  const alive = [];
  for (const b of game.bullets) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0) continue;
    if (circleHitsBuilding(game.world, b.x, b.y, 4)) continue;
    let consumed = false;
    if (b.fromPlayer) {
      for (const g of game.gunmen) {
        if (g.alive && dist(b.x, b.y, g.x, g.y) < 16) {
          g.health -= GUN_DAMAGE;
          if (g.health <= 0) killGunman(game, g);
          consumed = true;
          break;
        }
      }
      if (!consumed) {
        for (const ped of game.peds) {
          if (ped.state !== 'down' && dist(b.x, b.y, ped.x, ped.y) < 13) {
            ped.health -= GUN_DAMAGE;
            ped.state = ped.health <= 0 ? 'down' : 'flee';
            if (ped.health <= 0) addHeat(game, 'hitAndRun');
            else addHeat(game, 'assault');
            consumed = true;
            break;
          }
        }
      }
    } else if (!game.player.inCar && dist(b.x, b.y, game.player.x, game.player.y) < 15) {
      game.player.health -= ENEMY_DAMAGE;
      consumed = true;
      if (game.player.health <= 0) {
        game.player.dead = true;
        hospitalRespawn(game, 'wasted');
        return;
      }
    }
    if (!consumed) alive.push(b);
  }
  game.bullets = alive;
  for (const t of game.tracers) t.life -= dt;
  game.tracers = game.tracers.filter((t) => t.life > 0);
}

function updatePickups(game) {
  const pos = playerPos(game);
  for (const pk of game.pickups) {
    if (pk.taken) continue;
    if (dist(pos.x, pos.y, pk.x, pk.y) < 36) {
      pk.taken = true;
      if (pk.kind === 'health') game.player.health = clamp(game.player.health + pk.amount, 0, PLAYER_MAX_HEALTH);
      if (pk.kind === 'ammo') game.player.ammo += pk.amount;
      if (pk.kind === 'cash') game.player.cash += pk.amount;
      if (game.audio && game.audio.pickup) game.audio.pickup();
      setBanner(game, `Picked up ${pk.kind} (+${pk.amount})`, 2);
    }
  }
}

export function update(game, input, dt) {
  if (game.mode !== 'playing') return;
  const step = Math.min(dt, 0.05);
  game.time += step;
  if (game.bannerTimer > 0) { game.bannerTimer -= step; if (game.bannerTimer <= 0) game.banner = null; }
  if (game.dialogueTimer > 0) { game.dialogueTimer -= step; if (game.dialogueTimer <= 0) game.dialogue = null; }
  if (game.mission.phase === 'active') {
    const def = MISSIONS[game.mission.activeIndex];
    if (def && def.kind === 'timed-deliver') {
      game.mission.timer -= step;
      if (game.mission.timer <= 0) { failMission(game, 'out of time'); }
    }
  }
  updatePlayer(game, input, step);
  updatePlayerCar(game, input, step);
  updateTraffic(game, step);
  updatePeds(game, step);
  updatePolice(game, step);
  updateRoadblocks(game, step);
  updateGunmen(game, step);
  updateBullets(game, step);
  updatePickups(game);
  checkMissionProgress(game);
  checkFareProgress(game);
  if (game.player.inCar && game.audio && game.audio.setEngine) {
    game.audio.setEngine(game.player.inCar.speed / game.player.inCar.topSpeed, true);
  } else if (game.audio && game.audio.setEngine) {
    game.audio.setEngine(0, false);
  }
  refreshObjective(game);
}

export function currentDistrict(game) {
  const pos = playerPos(game);
  return districtAt(pos.x, pos.y);
}

export { districtAt, starsForHeat, payoutWithDusk };
