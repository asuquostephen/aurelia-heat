// Aurelia Heat — browser entry point.
// Wires the simulation to a real canvas: keyboard and mouse in, frames out,
// procedural audio unlocked on the first gesture, autosave on job and fare
// completion (handled inside the sim) plus a manual K save. Screenshot
// requests (?shot=...) are staged deterministically and flagged ready.
// Hiding the tab mid-run auto-pauses (see the visibilitychange wiring
// below), so an interrupted chase waits for the player instead of ending.

import { createGame, update, enterNearestCar, shoot, punch, startNextMission, toggleDusk, saveToStorage, loadFromStorage } from './game.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { renderFrame, renderTitle, renderPause, renderStoryComplete } from './render.js';
import { buildShotGame, markShotReady } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  canvas.width = Math.min(window.innerWidth, 1600);
  canvas.height = Math.min(window.innerHeight, 900);
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const audio = new AudioEngine();
const input = new Input();
input.attach(canvas);

const shotBuild = buildShotGame(window.location.search, { audio });
let game;
if (shotBuild) {
  game = shotBuild.game;
} else {
  const seedParam = new URLSearchParams(window.location.search).get('seed');
  game = createGame(seedParam ? Number(seedParam) || 1 : 1, { audio });
  loadFromStorage(game);
  game.mode = 'title';
}
if (game.dusk && audio.setDusk) audio.setDusk(true);

// Auto-pause when the tab is hidden. A player who switches tabs mid-chase
// — to answer a message, check a map, anything — should come back to the
// moment they left, not to a busted screen and a hospital bill earned
// while nobody was watching. The frame loop stops on its own in a hidden
// tab, but the moment the page hides we also move a live run into the
// same 'paused' mode the P key toggles, so the pause screen is what
// greets the player on return and one keypress resumes. Only a run in
// progress is touched: the title and story-complete screens have nothing
// to lose by sitting hidden, and an already-paused game stays exactly
// as the player left it.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.mode === 'playing') {
    game.mode = 'paused';
  }
});

let lastTime = performance.now();
let shotFrames = 0;

function aimAngleFromMouse() {
  const centreX = canvas.width / 2;
  const centreY = canvas.height / 2;
  return Math.atan2(input.mouseY - centreY, input.mouseX - centreX);
}

function handleGlobalKeys() {
  const starting = game.mode === 'title' || game.mode === 'storycomplete';
  if (starting && (input.consume('Enter') || input.clicked)) {
    audio.unlock();
    game.mode = 'playing';
    return;
  }
  if (input.consume('KeyP') || input.consume('Escape')) {
    if (game.mode === 'playing') game.mode = 'paused';
    else if (game.mode === 'paused') game.mode = 'playing';
    return;
  }
  if (game.mode !== 'playing') return;
  if (input.consume('KeyE')) enterNearestCar(game);
  if (input.consume('KeyM')) startNextMission(game);
  if (input.consume('KeyK')) {
    if (saveToStorage(game)) {
      game.banner = 'Progress saved';
      game.bannerTimer = 2;
    }
  }
  if (input.consume('KeyL')) toggleDusk(game);
  if (input.consume('Space')) punch(game);
  if (input.mouseDown || input.clicked) {
    audio.unlock();
    shoot(game, aimAngleFromMouse());
  }
  if (!game.player.inCar) {
    game.player.aimAngle = aimAngleFromMouse();
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
  lastTime = now;
  handleGlobalKeys();
  if (game.mode === 'title' || game.mode === 'storycomplete') game.time += dt;
  if (game.mode === 'playing') update(game, input, dt);
  if (game.mode === 'title') renderTitle(ctx, game, canvas.width, canvas.height);
  else if (game.mode === 'storycomplete') renderStoryComplete(ctx, game, canvas.width, canvas.height);
  else if (game.mode === 'paused') renderPause(ctx, game, canvas.width, canvas.height);
  else renderFrame(ctx, game, canvas.width, canvas.height);
  input.endFrame();
  if (shotBuild) {
    shotFrames += 1;
    if (shotFrames >= 4) markShotReady(window);
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
