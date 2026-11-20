// The renderer: paints the world from the simulation's state and nothing else. The
// camera follows the player; only what falls inside the view is drawn (buildings,
// trees, lamps and actors are distance-culled), so the full 3600x3600 city costs no
// more than the block on screen. HUD, minimap, banners and the title / pause /
// busted / story-complete screens are all drawn here from state.

import { DISTRICTS, DUSK, FONT, PALETTE, PLAYER, WORLD } from './config.js';
import { INTRO_LINES } from './missions.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 1280;
  let viewH = 720;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function scale() {
    return Math.max(0.62, Math.min(viewW / 1060, viewH / 640));
  }

  function draw(state, screen) {
    const s = scale();
    state.viewScale = s;
    ctx.fillStyle = PALETTE.sky;
    ctx.fillRect(0, 0, viewW, viewH);
    const camX = state.camera.x;
    const camY = state.camera.y;
    ctx.save();
    ctx.translate(viewW / 2, viewH / 2);
    ctx.scale(s, s);
    ctx.translate(-camX, -camY);
    drawWorld(state, camX, camY, s);
    drawPickups(state);
    drawPeds(state);
    drawEnemies(state);
    drawVehicles(state);
    if (state.mode === 'foot') drawPlayer(state);
    drawBullets(state);
    drawParticles(state);
    if (state.marker) drawMarker(state);
    if (state.dusk) drawDusk(state, camX, camY, s);
    ctx.restore();

    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state);
    if (screen === SCREEN_TITLE) drawTitle(state);
    if (screen === SCREEN_PAUSED) drawPause(state);
    if (screen === SCREEN_OVER) drawOver(state);
    if (state.banner && screen === SCREEN_PLAY) drawBanner(state);
    if (state.toast && screen === SCREEN_PLAY && !state.banner) drawToast(state);
    if (state.player.dead > 0 && screen === SCREEN_PLAY) drawWasted(state);
    if (state.bust > 0.05 && screen === SCREEN_PLAY) drawBust(state);
  }

  function visible(state, x, y, pad = 90) {
    const s = scale();
    const hw = viewW / s / 2 + pad;
    const hh = viewH / s / 2 + pad;
    return Math.abs(x - state.camera.x) < hw && Math.abs(y - state.camera.y) < hh;
  }

  function drawWorld(state, camX, camY, s) {
    const world = state.worldRef;
    const hw = viewW / s / 2 + 60;
    const hh = viewH / s / 2 + 60;
    const x0 = camX - hw;
    const x1 = camX + hw;
    const y0 = camY - hh;
    const y1 = camY + hh;
    // Ground: grass, then beach and sea to the south.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(x0, WORLD.beachY, x1 - x0, WORLD.waterY - WORLD.beachY + 200);
    const wave = Math.sin(state.time * 1.4) * 6;
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(x0, WORLD.waterY + 26, x1 - x0, 400);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0, WORLD.waterY, x1 - x0, 30 + wave);
    // Roads: full avenues across the view.
    ctx.fillStyle = PALETTE.road;
    for (const c of world.centres) {
      if (c + WORLD.roadWidth / 2 > x0 && c - WORLD.roadWidth / 2 < x1) {
        ctx.fillRect(c - WORLD.roadWidth / 2, Math.max(y0, 0), WORLD.roadWidth, Math.min(y1, WORLD.beachY + 40) - Math.max(y0, 0));
      }
      if (c + WORLD.roadWidth / 2 > y0 && c - WORLD.roadWidth / 2 < y1) {
        ctx.fillRect(Math.max(x0, 0), c - WORLD.roadWidth / 2, Math.min(x1, world.size) - Math.max(x0, 0), WORLD.roadWidth);
      }
    }
    // Lane dashes.
    ctx.strokeStyle = PALETTE.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (const c of world.centres) {
      if (c > x0 && c < x1) { ctx.moveTo(c, Math.max(y0, 0)); ctx.lineTo(c, Math.min(y1, WORLD.beachY)); }
      if (c > y0 && c < y1) { ctx.moveTo(Math.max(x0, 0), c); ctx.lineTo(Math.min(x1, world.size), c); }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // Sidewalks: pale slabs around each block.
    ctx.fillStyle = PALETTE.sidewalk;
    for (let i = 0; i < world.centres.length - 1; i += 1) {
      for (let j = 0; j < world.centres.length - 1; j += 1) {
        const bx = world.centres[i] + WORLD.roadWidth / 2 - 10;
        const by = world.centres[j] + WORLD.roadWidth / 2 - 10;
        const bw = WORLD.block - WORLD.roadWidth + 20;
        if (bx + bw < x0 || bx > x1 || by + bw < y0 || by > y1) continue;
        ctx.fillRect(bx, by, bw, bw);
      }
    }
    // The park block reads green again over its sidewalk.
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(world.centres[3] + WORLD.roadWidth / 2 - 6, world.centres[3] + WORLD.roadWidth / 2 - 6, WORLD.block - WORLD.roadWidth + 12, WORLD.block - WORLD.roadWidth + 12);
    // Buildings with roof detail.
    for (const b of world.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
      ctx.fillStyle = b.colour;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      for (const d of b.details) ctx.fillRect(b.x + d.x, b.y + d.y, d.w, d.h);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.font = `600 11px ${FONT}`;
      ctx.textAlign = 'center';
      if (b.w > 90 && b.h > 60) ctx.fillText(`${b.floors}F`, b.x + b.w / 2, b.y + b.h / 2 + 4);
    }
    // Trees and lamps.
    for (const t of world.trees) {
      if (!visible(state, t.x, t.y)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2f5d2a';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f7a36';
      ctx.beginPath(); ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = state.dusk ? '#ffd9a0' : '#3a3f46';
    for (const l of world.lamps) {
      if (!visible(state, l.x, l.y, 30)) continue;
      ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    }
    // District names, faint on the ground at each quarter.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.font = `800 44px ${FONT}`;
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const cx = d.x + d.w / 2;
      const cy = d.y + d.h / 2;
      if (visible(state, cx, cy, 300)) ctx.fillText(d.name, cx, cy);
    }
    // Place labels.
    ctx.font = `700 15px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const place of Object.values(world.places)) {
      if (!visible(state, place.x, place.y, 160)) continue;
      ctx.fillText(place.name.toUpperCase(), place.x, place.y - 44);
    }
  }

  function drawCarShape(v, isPlayer) {
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-20, -8, 46, 24);
    ctx.fillStyle = v.kind === 'cop' ? '#e8ecf2' : v.colour;
    roundRect(-23, -11, 46, 22, 6);
    ctx.fill();
    if (v.kind === 'cop') {
      ctx.fillStyle = '#1d2735';
      ctx.fillRect(-8, -11, 16, 22);
      const flash = Math.sin(v.siren) > 0;
      ctx.fillStyle = flash ? '#e5534b' : '#3f7fe0';
      ctx.fillRect(-3, -9, 6, 6);
      ctx.fillStyle = flash ? '#3f7fe0' : '#e5534b';
      ctx.fillRect(-3, 3, 6, 6);
    }
    ctx.fillStyle = '#141a22';
    roundRect(-6, -9, 15, 18, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,210,255,0.5)';
    ctx.fillRect(2, -8, 6, 16);
    ctx.fillStyle = '#101216';
    ctx.fillRect(-20, -13, 9, 4); ctx.fillRect(11, -13, 9, 4);
    ctx.fillRect(-20, 9, 9, 4); ctx.fillRect(11, 9, 9, 4);
    if (v.targetCar) {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2.5;
      roundRect(-25, -13, 50, 26, 7);
      ctx.stroke();
    }
    if (isPlayer) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(-6, -33);
      ctx.lineTo(6, -33);
      ctx.closePath();
      ctx.fill();
    }
    // Damage smoke.
    if (v.health < 45) {
      ctx.fillStyle = `rgba(60,60,60,${0.35 + Math.sin(v.siren * 3) * 0.1})`;
      ctx.beginPath();
      ctx.arc(16, 0, 6 + (v.health < 25 ? 4 : 0), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawVehicles(state) {
    for (const v of state.vehicles) {
      if (!visible(state, v.x, v.y, 70)) continue;
      drawCarShape(v, state.car === v);
    }
  }

  function drawPerson(x, y, angle, colour, shirtless) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(2, 3, 10, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(angle);
    ctx.fillStyle = colour;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shirtless || '#2b2f36';
    ctx.fillRect(4, -6, 7, 12);
    ctx.fillStyle = '#e8b98d';
    ctx.beginPath(); ctx.arc(3, 0, 5.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    drawPerson(p.x, p.y, p.angle, '#f2c94c', false);
    // Aim line, faint, while the mouse is held.
    // (Drawn short so it reads as intent, not a laser.)
  }

  function drawPeds(state) {
    for (const ped of state.peds) {
      if (!visible(state, ped.x, ped.y, 40)) continue;
      if (ped.state === 'passenger') continue;
      if (ped.state === 'down') {
        ctx.save();
        ctx.translate(ped.x, ped.y);
        ctx.rotate(ped.angle);
        ctx.fillStyle = ped.colour;
        ctx.fillRect(-11, -5, 22, 10);
        ctx.fillStyle = '#e8b98d';
        ctx.beginPath(); ctx.arc(13, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        continue;
      }
      drawPerson(ped.x, ped.y, ped.angle, ped.colour, false);
      if (ped.state === 'fare') {
        const bob = Math.sin(state.time * 5) * 4;
        ctx.fillStyle = PALETTE.gold;
        ctx.font = `800 22px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('$', ped.x, ped.y - 20 + bob);
      }
      if (ped.state === 'flee') {
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 15px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('!', ped.x, ped.y - 18);
      }
    }
  }

  function drawEnemies(state) {
    for (const e of state.enemies) {
      if (!visible(state, e.x, e.y, 40)) continue;
      drawPerson(e.x, e.y, e.angle, '#7a1f1f', false);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - 14, e.y - 24, 28, 5);
      ctx.fillStyle = PALETTE.danger;
      ctx.fillRect(e.x - 14, e.y - 24, 28 * Math.max(0, e.health / 75), 5);
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('VANE', e.x, e.y - 30);
    }
  }

  function drawBullets(state) {
    ctx.fillStyle = '#ffe9a8';
    for (const b of state.bullets) {
      ctx.fillRect(b.x - 3, b.y - 1.5, 6, 3);
    }
  }

  function drawParticles(state) {
    for (const fxP of state.particles) {
      ctx.globalAlpha = Math.max(0, fxP.life / fxP.maxLife);
      ctx.fillStyle = fxP.colour;
      ctx.fillRect(fxP.x - fxP.size / 2, fxP.y - fxP.size / 2, fxP.size, fxP.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      if (!visible(state, pk.x, pk.y, 40)) continue;
      const bob = Math.sin(pk.bob) * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + 8, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pk.kind === 'health' ? '#e5534b' : pk.kind === 'ammo' ? '#ff8c3a' : '#7dd87d';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', pk.x, pk.y + bob + 4.5);
    }
  }

  // Dusk: a violet wash over the whole view, then a warm pool of light around
  // every street lamp in it. Each lamp's glow size and flicker phase were seeded
  // into the world at generation time, so the lit streets are the same every run.
  function drawDusk(state, camX, camY, s) {
    const hw = viewW / s / 2 + 80;
    const hh = viewH / s / 2 + 80;
    ctx.fillStyle = DUSK.tint;
    ctx.globalAlpha = DUSK.tintAlpha;
    ctx.fillRect(camX - hw, camY - hh, hw * 2, hh * 2);
    ctx.globalAlpha = 1;
    for (const l of state.worldRef.lamps) {
      if (!visible(state, l.x, l.y, DUSK.lampGlowRadius + 40)) continue;
      const flicker = 1 + Math.sin(state.time * 7 + l.phase) * 0.05;
      const r = DUSK.lampGlowRadius * l.glow * flicker;
      const glow = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
      glow.addColorStop(0, `rgba(${DUSK.lampGlowRgb}, 0.5)`);
      glow.addColorStop(1, `rgba(${DUSK.lampGlowRgb}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(l.x, l.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMarker(state) {
    const m = state.marker;
    const pulse = 1 + Math.sin(state.time * 4) * 0.12;
    ctx.strokeStyle = PALETTE.mission;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 30 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.mission;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y - 52 - Math.sin(state.time * 4) * 5);
    ctx.lineTo(m.x - 11, m.y - 74 - Math.sin(state.time * 4) * 5);
    ctx.lineTo(m.x + 11, m.y - 74 - Math.sin(state.time * 4) * 5);
    ctx.closePath();
    ctx.fill();
  }

  // ---------- HUD ----------
  function drawHud(state) {
    const p = state.player;
    // Top-left: cash + objective.
    ctx.fillStyle = 'rgba(8,10,14,0.62)';
    roundRectPath(14, 14, Math.min(560, viewW - 28), 64, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.cash;
    ctx.font = `800 24px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`$${state.cash}`, 28, 44);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 14.5px ${FONT}`;
    wrapText(state.objective, 28, 66, Math.min(530, viewW - 60), 17, 1);
    // Top-right: wanted stars + district.
    ctx.textAlign = 'right';
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.stars ? '★' : '☆';
    ctx.fillStyle = state.stars > 0 ? (Math.sin(state.time * 6) > 0 ? '#ffd34d' : '#e5534b') : 'rgba(255,255,255,0.35)';
    ctx.font = `800 26px ${FONT}`;
    ctx.fillText(stars, viewW - 22, 42);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(state.worldRef.districtAt(p.x, p.y), viewW - 22, 64);
    let rightY = 86;
    if (state.dusk) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `700 13px ${FONT}`;
      ctx.fillText(`DUSK · JOBS PAY +${Math.round((DUSK.payoutBonus - 1) * 100)}%`, viewW - 22, rightY);
      rightY += 22;
    }
    if (state.marker) {
      const anchor = state.mode === 'car' && state.car ? state.car : p;
      const d = Math.round(Math.hypot(state.marker.x - anchor.x, state.marker.y - anchor.y));
      ctx.fillStyle = PALETTE.mission;
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText(`Objective ${d}m`, viewW - 22, rightY);
    }
    // Bottom-right: health, ammo, speed.
    ctx.fillStyle = 'rgba(8,10,14,0.62)';
    roundRectPath(viewW - 264, viewH - 86, 250, 72, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(viewW - 248, viewH - 68, 218, 13);
    ctx.fillStyle = p.health > 30 ? '#7dd87d' : PALETTE.danger;
    ctx.fillRect(viewW - 248, viewH - 68, 218 * Math.max(0, p.health / PLAYER.health), 13);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 14px ${FONT}`;
    ctx.textAlign = 'left';
    const modeLine = state.mode === 'car' && state.car
      ? `${state.car.cls.toUpperCase()} · ${Math.round(Math.abs(state.car.speed) * 0.36)} km/h · hull ${Math.max(0, Math.round(state.car.health))}%`
      : `ON FOOT · Sidearm ammo ${p.ammo}`;
    ctx.fillText(modeLine, viewW - 248, viewH - 32);
    drawMinimap(state);
    // Controls hint, first seconds.
    if (state.time < 14) {
      ctx.fillStyle = 'rgba(8,10,14,0.55)';
      ctx.font = `600 13.5px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('WASD move/drive · E enter/exit car · Mouse aim, click shoot · Space punch · Shift sprint · M next job · L dusk · P pause', viewW / 2, viewH - 16);
    }
  }

  function drawMinimap(state) {
    const size = 168;
    const x = 16;
    const y = viewH - size - 16;
    const w = state.worldRef;
    const k = size / w.size;
    ctx.fillStyle = PALETTE.minimapBg;
    roundRectPath(x, y, size, size, 10);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 3, y + 3, size - 6, size - 6);
    ctx.clip();
    ctx.fillStyle = '#274d24';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x, y + WORLD.waterY * k, size, size - WORLD.waterY * k);
    ctx.strokeStyle = PALETTE.minimapRoad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const c of w.centres) {
      ctx.moveTo(x + c * k, y);
      ctx.lineTo(x + c * k, y + size);
      ctx.moveTo(x, y + c * k);
      ctx.lineTo(x + size, y + c * k);
    }
    ctx.stroke();
    if (state.marker) blip(x + state.marker.x * k, y + state.marker.y * k, PALETTE.mission, 4.5);
    for (const v of state.vehicles) {
      if (v.kind === 'cop' && state.stars > 0) blip(x + v.x * k, y + v.y * k, Math.sin(state.time * 7) > 0 ? '#e5534b' : '#3f7fe0', 3);
    }
    for (const pk of state.pickups) blip(x + pk.x * k, y + pk.y * k, '#7dd87d', 2.5);
    // Player arrow.
    const anchor = state.mode === 'car' && state.car ? state.car : state.player;
    ctx.save();
    ctx.translate(x + anchor.x * k, y + anchor.y * k);
    ctx.rotate(anchor.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -4.5);
    ctx.lineTo(-5, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    roundRectPath(x, y, size, size, 10);
    ctx.stroke();
  }

  function blip(bx, by, colour, r) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapText(text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text).split(' ');
    let line = '';
    let lines = 0;
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (ctx.measureText(trial).width > maxWidth && line) {
        ctx.fillText(line, x, y + lines * lineHeight);
        lines += 1;
        if (lines >= maxLines) return;
        line = word;
      } else line = trial;
    }
    if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
  }

  function drawBanner(state) {
    const b = state.banner;
    const alpha = Math.min(1, (b.until - state.time) / 0.8, state.time > 0 ? 1 : 1);
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = 'rgba(8,10,14,0.78)';
    const w = Math.min(720, viewW - 60);
    roundRectPath((viewW - w) / 2, 96, w, 104, 12);
    ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 25px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(b.title, viewW / 2, 132);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 15.5px ${FONT}`;
    wrapTextCentered(b.text, viewW / 2, 160, w - 48, 20, 2);
    ctx.globalAlpha = 1;
  }

  function wrapTextCentered(text, cx, y, maxWidth, lineHeight, maxLines) {
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (ctx.measureText(trial).width > maxWidth && line) { lines.push(line); line = word; }
      else line = trial;
    }
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, cx, y + i * lineHeight));
  }

  function drawToast(state) {
    ctx.fillStyle = 'rgba(8,10,14,0.72)';
    ctx.font = `700 15px ${FONT}`;
    const w = ctx.measureText(state.toast.text).width + 36;
    roundRectPath((viewW - w) / 2, viewH - 128, w, 36, 9);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'center';
    ctx.fillText(state.toast.text, viewW / 2, viewH - 104);
  }

  function drawWasted(state) {
    ctx.fillStyle = 'rgba(60,0,0,0.45)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#e5534b';
    ctx.font = `800 64px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('WASTED', viewW / 2, viewH / 2);
  }

  function drawBust(state) {
    ctx.fillStyle = 'rgba(8,10,14,0.7)';
    const w = 240;
    roundRectPath((viewW - w) / 2, viewH - 190, w, 30, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.danger;
    ctx.fillRect((viewW - w) / 2 + 6, viewH - 184, (w - 12) * Math.min(1, state.bust), 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED?', viewW / 2, viewH - 171);
  }

  function dim(alpha) {
    ctx.fillStyle = `rgba(5,7,11,${alpha})`;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  function drawTitle(state) {
    dim(0.55);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 74px ${FONT}`;
    ctx.fillText('AURELIA HEAT', viewW / 2, viewH * 0.3);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 19px ${FONT}`;
    INTRO_LINES.forEach((line, i) => ctx.fillText(line, viewW / 2, viewH * 0.3 + 44 + i * 26));
    ctx.font = `700 17px ${FONT}`;
    const hasSave = state.missionIndex > 0 || state.storyDone;
    ctx.fillStyle = '#7dd87d';
    ctx.fillText(hasSave ? 'Press ENTER to continue — or click' : 'Press ENTER to start — or click', viewW / 2, viewH * 0.62);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 14.5px ${FONT}`;
    const lines = [
      'WASD / arrows — move & drive      E — enter / exit car (steal it)',
      'Mouse — aim · click — shoot      SPACE — punch      SHIFT — sprint',
      'M — Tito\'s next job      $ fares — pick up & deliver      L — dusk (jobs pay +25%)      P / ESC — pause',
      `Story: 6 jobs for Tito · Cash $${state.cash} · Jobs done ${state.stats.missionsDone}/6 · Fares ${state.stats.faresDone}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, viewW / 2, viewH * 0.62 + 42 + i * 23));
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `600 12.5px ${FONT}`;
    ctx.fillText('An original open-world crime game. Every name, street and story in Port Aurelia is invented.', viewW / 2, viewH - 26);
  }

  function drawPause(state) {
    dim(0.6);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 44px ${FONT}`;
    ctx.fillText('PAUSED', viewW / 2, viewH * 0.38);
    ctx.font = `600 16px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('P or ESC to resume · K saves your progress', viewW / 2, viewH * 0.38 + 40);
    ctx.fillText(`Cash $${state.cash} · Jobs ${state.stats.missionsDone}/6 · Cars stolen ${state.stats.carsStolen} · Earned $${state.stats.earned}`, viewW / 2, viewH * 0.38 + 68);
  }

  function drawOver(state) {
    dim(0.62);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 52px ${FONT}`;
    ctx.fillText('AURELIA IS YOURS', viewW / 2, viewH * 0.36);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText('All six of Tito\'s jobs are done. The city keeps turning:', viewW / 2, viewH * 0.36 + 44);
    ctx.fillText('fares still pay, the police still watch, and Port Aurelia is yours to roam.', viewW / 2, viewH * 0.36 + 70);
    ctx.fillStyle = '#7dd87d';
    ctx.font = `700 17px ${FONT}`;
    ctx.fillText(`Final cash $${state.cash} · Total earned $${state.stats.earned} · Fares ${state.stats.faresDone} · Cars stolen ${state.stats.carsStolen}`, viewW / 2, viewH * 0.36 + 112);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText('Press ENTER to keep roaming', viewW / 2, viewH * 0.36 + 148);
  }

  return { draw, resize };
}
