// Aurelia Heat — deterministic screenshot staging.
// The screenshot harness loads the game with ?shot=start|play|end&seed=N.
// Each scene is built from the same seed with fixed positions, so a capture
// is reproducible: title screen, a mid-chase downtown moment at three stars
// with HUD, minimap and banner visible, and the story-complete screen.
// When staging finishes, window.__shotReady is set so the harness can wait
// for a fully drawn frame instead of guessing with sleeps alone.

import { createGame, startNextMission, setBanner, playerPos, deployRoadblock } from './game.js';
import { placeById, ROAD_LINES } from './world.js';

export function parseShotRequest(search) {
  const params = new URLSearchParams(search || '');
  const shot = params.get('shot');
  const seedRaw = params.get('seed');
  const seed = seedRaw === null ? 1 : Number(seedRaw);
  return {
    shot: shot === 'start' || shot === 'play' || shot === 'end' || shot === 'roadblock' ? shot : null,
    seed: Number.isFinite(seed) ? seed : 1,
  };
}

export function stageShot(game, shot) {
  if (shot === 'start') {
    game.mode = 'title';
    game.time = 3.2;
    return game;
  }
  if (shot === 'end') {
    game.storyComplete = true;
    game.mode = 'storycomplete';
    game.player.cash = 5120;
    game.stats.missionsDone = 6;
    game.stats.faresDone = 4;
    game.stats.carsStolen = 7;
    game.time = 2;
    return game;
  }
  if (shot === 'play') {
    game.mode = 'playing';
    const tower = placeById(game.world, 'tower');
    // Put the player in a stolen coupe in Downtown Aurelia, mid-chase.
    const coupe = game.cars.find((c) => c.classId === 'coupe') || game.cars[0];
    coupe.x = tower.x + 130;
    coupe.y = tower.y + 190;
    coupe.heading = 0.35;
    coupe.speed = 240;
    coupe.parked = false;
    coupe.driver = 'player';
    coupe.hull = coupe.hullMax * 0.62;
    coupe.smoke = 0.38;
    game.player.inCar = coupe;
    game.player.x = coupe.x;
    game.player.y = coupe.y;
    game.player.cash = 1840;
    game.player.ammo = 31;
    game.player.health = 72;
    game.heat = 260; // three stars
    game.dusk = false;
    // Two patrol cars closing in behind, one crossing ahead.
    game.police = [];
    // Build patrol cars from the traffic pool shape via direct objects that
    // match the car record the renderer and sim already understand.
    const offsets = [[-190, 90, 0.2], [-260, -70, 0.5], [210, -120, 2.8]];
    let pid = 9000;
    for (const [ox, oy, heading] of offsets) {
      game.police.push({
        id: pid++, x: coupe.x + ox, y: coupe.y + oy, heading,
        speed: 210, classId: 'patrol', className: 'Aurelia Patrol Interceptor',
        topSpeed: 470, accel: 330, grip: 3.0, hullMax: 160, hull: 160,
        color: '#eef1f5', parked: false, isPolice: true, driver: 'police',
        marked: false, turnCooldown: 0, smoke: 0,
      });
    }
    startNextMission(game);
    setBanner(game, 'Marlo: "Three stars, kid — lose them!"', 30);
    game.dialogue = null;
    game.banner = 'WANTED — patrols closing in on Downtown Aurelia';
    game.bannerTimer = 30;
    game.time = 5;
    void playerPos(game);
    return game;
  }
  if (shot === 'roadblock') {
    game.mode = 'playing';
    const tower = placeById(game.world, 'tower');
    // Stage the fleeing coupe squarely on the avenue band through Downtown
    // near the tower, heading east along the road, so the roadblock deploy
    // finds a clean road line ahead of the driver.
    const roadY = ROAD_LINES.reduce((best, line) => (Math.abs(line - tower.y) < Math.abs(best - tower.y) ? line : best), ROAD_LINES[0]);
    const coupe = game.cars.find((c) => c.classId === 'coupe') || game.cars[0];
    coupe.x = tower.x - 260;
    coupe.y = roadY;
    coupe.heading = 0;
    coupe.speed = 300;
    coupe.parked = false;
    coupe.driver = 'player';
    coupe.hull = coupe.hullMax * 0.8;
    coupe.smoke = 0.2;
    game.player.inCar = coupe;
    game.player.x = coupe.x;
    game.player.y = coupe.y;
    game.player.cash = 2140;
    game.player.ammo = 26;
    game.player.health = 84;
    game.heat = 340; // four stars
    game.dusk = false;
    game.police = [];
    deployRoadblock(game);
    game.banner = 'ROADBLOCK — Downtown Aurelia';
    game.bannerTimer = 30;
    game.time = 5;
    void playerPos(game);
    return game;
  }
  return game;
}

export function buildShotGame(search, opts = {}) {
  const { shot, seed } = parseShotRequest(search);
  if (!shot) return null;
  const game = createGame(seed, opts);
  stageShot(game, shot);
  return { game, shot, seed };
}

export function markShotReady(win) {
  if (win) win.__shotReady = true;
}
