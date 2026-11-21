// Aurelia Heat — keyboard and mouse input.
// A single Input tracker owns every listener so the game loop can poll plain
// state (held keys, mouse position, click edges) instead of handling events
// in a dozen places. Edge-triggered actions (pause, dusk, interact) are
// exposed through consume(), which reports each physical press exactly once.

const TRACKED_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'Space',
  'KeyE', 'KeyM', 'KeyK', 'KeyL', 'KeyP', 'Escape', 'Enter',
]);

export class Input {
  constructor(target) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.clicked = false;
    this.enabled = true;
    this.target = target || null;
    this._onKeyDown = (ev) => this.handleKeyDown(ev);
    this._onKeyUp = (ev) => this.handleKeyUp(ev);
    this._onMouseMove = (ev) => this.handleMouseMove(ev);
    this._onMouseDown = (ev) => this.handleMouseDown(ev);
    this._onMouseUp = () => { this.mouseDown = false; };
    this._onBlur = () => { this.keys.clear(); this.mouseDown = false; };
  }

  attach(canvas) {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    const el = canvas || window;
    el.addEventListener('mousemove', this._onMouseMove);
    el.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    this.target = el;
  }

  detach() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
  }

  handleKeyDown(ev) {
    if (!this.enabled) return;
    if (TRACKED_CODES.has(ev.code)) {
      if (ev.code.startsWith('Arrow') || ev.code === 'Space') ev.preventDefault?.();
      if (!this.keys.has(ev.code)) this.pressed.add(ev.code);
      this.keys.add(ev.code);
    }
  }

  handleKeyUp(ev) {
    this.keys.delete(ev.code);
  }

  handleMouseMove(ev) {
    const rect = this.target && this.target.getBoundingClientRect ? this.target.getBoundingClientRect() : null;
    if (rect) {
      this.mouseX = ev.clientX - rect.left;
      this.mouseY = ev.clientY - rect.top;
    } else {
      this.mouseX = ev.clientX || 0;
      this.mouseY = ev.clientY || 0;
    }
  }

  handleMouseDown(ev) {
    if (!this.enabled) return;
    this.mouseDown = true;
    this.clicked = true;
    this.handleMouseMove(ev);
  }

  down(code) {
    return this.keys.has(code);
  }

  consume(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  axisX() {
    let x = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    return x;
  }

  axisY() {
    let y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    return y;
  }

  sprintHeld() {
    return this.down('ShiftLeft') || this.down('ShiftRight');
  }

  endFrame() {
    this.pressed.clear();
    this.clicked = false;
  }
}

export function createStubInput() {
  const input = new Input(null);
  input.enabled = true;
  return input;
}
