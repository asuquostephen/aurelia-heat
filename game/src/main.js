// Boot and the one loop for Aurelia Heat: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast one), and
// the renderer paints what is there. Screens: title, play, paused, and the
// story-complete screen; busted and wasted are overlays inside play. Progress is
// kept in localStorage between visits.
//
// ?seed=N fixes the city. ?shot=start|play|end|dusk (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady.

import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createGame } from './game.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_SAVE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261117;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const world = createWorld(random);
const audio = createAudio();
const game = createGame(random, world, audio);
game.state.worldRef = world;
const renderer = createRenderer(canvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(game.saveData()));
    game.state.saveDirty = false;
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, game, world);
  let painted = 0;
  function paint() {
    renderer.draw(game.state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;
  let announcedStory = false;

  const saved = readSave();
  if (saved) game.applySave(saved);

  function announce(message) {
    status.textContent = message;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions) audio.unlock();
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) {
      screen = SCREEN_PLAY;
      announce('Playing. Press M for Tito\'s next job.');
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_OVER) {
      screen = SCREEN_PLAY;
      game.state.ended = null;
      announce('Free roam.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (actions & ACTION_SAVE) {
      writeSave();
      game.toast('Progress saved.', 2);
    }
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    // The mouse aims in world coordinates: convert with the last frame's camera.
    const s = game.state.viewScale || 1;
    game.state.mouseWorld.x = game.state.camera.x + (input.mouse.x - window.innerWidth / 2) / s;
    game.state.mouseWorld.y = game.state.camera.y + (input.mouse.y - window.innerHeight / 2) / s;
    if (screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP) {
        game.update(STEP, input, first ? actions : 0);
        first = false;
        accumulator -= STEP;
        if (game.state.ended === 'story' && !announcedStory) {
          announcedStory = true;
          screen = SCREEN_OVER;
          writeSave();
          announce('Story complete. Aurelia is yours.');
          break;
        }
      }
      saveTimer += Math.min((now - (frame.lastSave || now)) / 1000, 1);
      frame.lastSave = now;
      if (game.state.saveDirty || saveTimer > 8) {
        saveTimer = 0;
        if (game.state.saveDirty) writeSave();
      }
      for (const ev of game.state.events) {
        if (ev === 'wasted') announce('Wasted. You wake up at Aurelia General.');
        if (ev === 'busted') announce('Busted. Fines paid.');
        if (ev === 'hit') announce('Hit.');
        if (ev === 'dusk-on') announce('Dusk mode on. Jobs and fares pay a bonus; heat cools faster.');
        if (ev === 'dusk-off') announce('Dusk mode off.');
      }
    } else {
      accumulator = 0;
      // The title screen still breathes: traffic rolls past behind it.
      if (screen === SCREEN_TITLE) game.update(STEP, input, 0);
    }
    renderer.draw(game.state, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Aurelia Heat. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
