// Keyboard and mouse input. Held keys are a set the simulation reads every step;
// one-shot actions (interact, pause, confirm, punch, mission) are latched as bits and
// handed over once with takeActions(), so a press is never read twice or lost between
// frames. The mouse position is kept in screen pixels; the game converts it to world
// coordinates for aiming.

export const ACTION_INTERACT = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MISSION = 16;
export const ACTION_SAVE = 32;

const ACTION_KEYS = {
  KeyE: ACTION_INTERACT,
  Enter: ACTION_CONFIRM,
  Space: ACTION_PUNCH,
  KeyM: ACTION_MISSION,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyS: 0, // S is a held movement key too; saving is Ctrl/Cmd+S-free: KeyK below.
  KeyK: ACTION_SAVE,
};

export function createInput(canvas) {
  const held = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let latched = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    const action = ACTION_KEYS[event.code];
    if (action) {
      latched |= action;
      event.preventDefault();
    }
    if (event.code.startsWith('Arrow')) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      latched |= ACTION_CONFIRM;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });

  return {
    mouse,
    isDown(code) { return held.has(code); },
    /** Movement axes: x is -1 left / +1 right, y is -1 up / +1 down (screen sense). */
    moveAxis() {
      let x = 0;
      let y = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
      return { x, y };
    },
    sprint() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    takeActions() {
      const actions = latched;
      latched = 0;
      return actions;
    },
  };
}
