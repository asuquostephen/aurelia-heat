// The screenshot scenes behind ?shot=start|play|end (with &seed=N). Each one stages
// the real game — the same world, vehicles and rules — so the frame is what playing
// actually looks like, and the same seed always gives the same frame. main.js paints
// the staged scene twice and sets window.__shotReady.

import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE_INPUT = {
  mouse: { x: 0, y: 0, down: false },
  moveAxis() { return { x: 0, y: 0 }; },
  sprint() { return false; },
};

let shotId = 9000;

function vehicle(x, y, angle, cls, colour, kind) {
  shotId += 1;
  return {
    id: shotId, x, y, angle, speed: 0, cls, colour, kind,
    health: 100, driver: kind === 'parked' ? null : 'ai',
    axis: 'v', centre: 2700, dir: 1, turnCd: 2, stuck: 0, siren: 1, targetCar: false,
  };
}

function settle(game, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) game.update(STEP, IDLE_INPUT, 0);
}

export function stageShot(name, game, world) {
  const state = game.state;
  if (name === 'play') {
    // Mid-chase downtown: Jules in a sport coupe, traffic around, three stars,
    // two patrol cars closing in, Tito's first job on the objective line.
    const d = world.places.downtown;
    game.startNextMission();
    const car = vehicle(d.x - 40, d.y + 10, 0.2, 'sport', '#c94f42', 'parked');
    car.driver = 'player';
    state.vehicles.push(car);
    state.car = car;
    state.mode = 'car';
    state.player.x = car.x;
    state.player.y = car.y;
    state.vehicles.push(vehicle(d.x - 260, d.y - 120, 0.5, 'cop', '#e8ecf2', 'cop'));
    state.vehicles.push(vehicle(d.x - 420, d.y + 90, -0.2, 'cop', '#e8ecf2', 'cop'));
    state.vehicles.push(vehicle(d.x + 240, d.y - 40, Math.PI, 'sedan', '#3f7fe0', 'traffic'));
    state.vehicles.push(vehicle(d.x + 90, d.y + 190, -Math.PI / 2, 'taxi', '#e0a83c', 'traffic'));
    state.heat = 76; // three stars
    state.camera.x = car.x;
    state.camera.y = car.y;
    settle(game, 1.2);
    state.camera.x = car.x;
    state.camera.y = car.y;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    // The story is done: the completion screen over the airfield gate at the coast.
    const a = world.places.airport;
    state.storyDone = true;
    state.missionIndex = 6;
    state.cash = 4870;
    state.stats = { earned: 4650, carsStolen: 7, faresDone: 5, missionsDone: 6 };
    state.player.x = a.x;
    state.player.y = a.y;
    state.camera.x = a.x;
    state.camera.y = a.y - 120;
    settle(game, 0.4);
    state.camera.x = a.x;
    state.camera.y = a.y - 120;
    return { screen: SCREEN_OVER };
  }
  // start: the title over Dockside, the garage in view.
  const g = world.places.garage;
  state.player.x = g.x + 30;
  state.player.y = g.y + 60;
  state.camera.x = g.x + 60;
  state.camera.y = g.y + 40;
  settle(game, 1.5);
  state.camera.x = g.x + 60;
  state.camera.y = g.y + 40;
  return { screen: SCREEN_TITLE };
}
