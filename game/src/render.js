// Aurelia Heat — Canvas renderer: world, HUD, minimap and screens.
// Everything is drawn with plain Canvas paths — no images, no fonts to load.
// Police roadblocks need no new car art: their interceptors are ordinary
// game.cars with light bars, and the minimap marks them with flashing dots.
// Dusk Mode swaps the whole palette: the same draw calls run, but daylight
// colours are lerped toward dusk tones, lamps gain a glow, and the sea and
// sky bands deepen.

import { WORLD_SIZE, PLAYER_MAX_HEALTH, districtAt } from './config.js';
import { starsOf } from './game.js';
import { STORY_INTRO, STORY_OUTRO, MISSIONS } from './missions.js';

const DAY = {
  grass: '#5da85e', park: '#6fbf6a', sand: '#e6d29a', sea: '#2e7fb8', seaDeep: '#256a9c',
  road: '#3c4148', roadEdge: '#2f3339', lane: '#e8e4c8', sidewalk: '#b9b3a4',
  buildingShadow: 'rgba(0,0,0,0.25)', skyBand: '#f4e3b2', text: '#ffffff',
};
const DUSK = {
  grass: '#3d6b52', park: '#477a58', sand: '#c9a86a', sea: '#1d4e79', seaDeep: '#173d61',
  road: '#2c2a38', roadEdge: '#211f2c', lane: '#c9a86a', sidewalk: '#7d7468',
  buildingShadow: 'rgba(10,5,25,0.45)', skyBand: '#e88a4a', text: '#ffe9c9',
};

export function paletteFor(dusk) {
  return dusk ? DUSK : DAY;
}

function drawWorld(ctx, game, cam, viewW, viewH) {
  const pal = paletteFor(game.dusk);
  const world = game.world;
  ctx.fillStyle = pal.grass;
  ctx.fillRect(0, 0, viewW, viewH);
  const x0 = cam.x - 40, y0 = cam.y - 40, x1 = cam.x + viewW + 40, y1 = cam.y + viewH + 40;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  // Park lawn.
  ctx.fillStyle = pal.park;
  ctx.fillRect(world.park.x, world.park.y, world.park.w, world.park.h);
  // Beach and sea.
  ctx.fillStyle = pal.sand;
  ctx.fillRect(0, world.beachY, WORLD_SIZE, world.seaY - world.beachY);
  ctx.fillStyle = pal.sea;
  ctx.fillRect(0, world.seaY, WORLD_SIZE, WORLD_SIZE - world.seaY);
  ctx.fillStyle = pal.seaDeep;
  for (let x = 0; x < WORLD_SIZE; x += 220) {
    ctx.fillRect(x, world.seaY + 60 + ((x * 7) % 90), 90, 8);
  }
  // Roads: asphalt bands along every avenue, both directions.
  ctx.fillStyle = pal.road;
  for (const line of world.roadLines) {
    ctx.fillRect(0, line - world.roadHalf, WORLD_SIZE, world.roadHalf * 2);
    ctx.fillRect(line - world.roadHalf, 0, world.roadHalf * 2, WORLD_SIZE);
  }
  // Sidewalk rims.
  ctx.strokeStyle = pal.sidewalk;
  ctx.lineWidth = 6;
  for (const line of world.roadLines) {
    ctx.beginPath();
    ctx.moveTo(0, line - world.roadHalf); ctx.lineTo(WORLD_SIZE, line - world.roadHalf);
    ctx.moveTo(0, line + world.roadHalf); ctx.lineTo(WORLD_SIZE, line + world.roadHalf);
    ctx.moveTo(line - world.roadHalf, 0); ctx.lineTo(line - world.roadHalf, WORLD_SIZE);
    ctx.moveTo(line + world.roadHalf, 0); ctx.lineTo(line + world.roadHalf, WORLD_SIZE);
    ctx.stroke();
  }
  // Lane dashes.
  ctx.strokeStyle = pal.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const line of world.roadLines) {
    ctx.beginPath();
    ctx.moveTo(0, line); ctx.lineTo(WORLD_SIZE, line);
    ctx.moveTo(line, 0); ctx.lineTo(line, WORLD_SIZE);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Buildings with shadows and roof detail.
  for (const b of world.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = pal.buildingShadow;
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    const inset = 8 + b.height;
    ctx.fillRect(b.x + inset * 0.4, b.y + inset * 0.4, b.w - inset * 0.8, b.h - inset * 0.8);
    if (b.roofUnit) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + b.w * 0.55, b.y + b.h * 0.2, 22, 16);
    }
    if (b.waterTank) {
      ctx.fillStyle = '#7a5c3e';
      ctx.beginPath();
      ctx.arc(b.x + b.w * 0.3, b.y + b.h * 0.3, 11, 0, Math.PI * 2);
      ctx.fill();
    }
    if (b.helipad) {
      ctx.strokeStyle = '#f2f2f2';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (b.sign) {
      ctx.fillStyle = game.dusk ? '#ffb84d' : '#fff6d8';
      ctx.fillRect(b.x + 6, b.y + 6, 26, 8);
    }
  }
  // Trees.
  for (const t of world.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = game.dusk ? '#2e6b3e' : '#3f9e4d';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.45, 0, Math.PI * 2); ctx.fill();
  }
  // Lamps — small posts by day, glowing pools of light at dusk.
  for (const lamp of world.lamps) {
    if (lamp.x < x0 || lamp.x > x1 || lamp.y < y0 || lamp.y > y1) continue;
    if (game.dusk) {
      const glow = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 52);
      glow.addColorStop(0, 'rgba(255,190,90,0.55)');
      glow.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 52, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = game.dusk ? '#ffd27a' : '#5a5f66';
    ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Place markers.
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const place of world.places) {
    if (place.x < x0 || place.x > x1 || place.y < y0 || place.y > y1) continue;
    ctx.fillStyle = game.dusk ? '#ffcf7a' : '#fff2b0';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(place.name, place.x, place.y - 14);
    ctx.fillText(place.name, place.x, place.y - 14);
    ctx.fillStyle = '#ffcf3f';
    ctx.beginPath(); ctx.arc(place.x, place.y, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawCarShape(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.heading);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-24, -11, 52, 26);
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-26, -14, 52, 28, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,24,32,0.9)';
  ctx.fillRect(-6, -11, 18, 22);
  ctx.fillStyle = 'rgba(160,210,255,0.85)';
  ctx.fillRect(14, -10, 6, 20);
  ctx.fillStyle = '#222';
  ctx.fillRect(-24, -16, 10, 4); ctx.fillRect(-24, 12, 10, 4);
  ctx.fillRect(14, -16, 10, 4); ctx.fillRect(14, 12, 10, 4);
  if (car.isPolice) {
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(-26, -5, 52, 10);
    const flash = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#ffd7d4';
    ctx.fillRect(-4, -12, 8, 7);
    ctx.fillStyle = flash ? '#cfe6ff' : '#2f7bff';
    ctx.fillRect(5, -12, 8, 7);
  }
  if (car.marked) {
    ctx.strokeStyle = '#ffcf3f';
    ctx.lineWidth = 3;
    ctx.strokeRect(-30, -18, 60, 36);
  }
  ctx.restore();
  if (car.smoke > 0.25) {
    ctx.fillStyle = `rgba(90,90,90,${0.25 + car.smoke * 0.4})`;
    const puff = 6 + car.smoke * 12 + Math.sin(time * 9 + car.id) * 3;
    ctx.beginPath();
    ctx.arc(car.x + Math.cos(car.heading) * 26, car.y + Math.sin(car.heading) * 26 - 8, puff, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawActors(ctx, game) {
  for (const pk of game.pickups) {
    if (pk.taken) continue;
    const colors = { health: '#ff5f6d', ammo: '#ffb84d', cash: '#59d977' };
    ctx.fillStyle = colors[pk.kind] || '#fff';
    ctx.beginPath(); ctx.arc(pk.x, pk.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#14202c';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', pk.x, pk.y + 4);
  }
  for (const bag of game.bags) {
    if (bag.taken) continue;
    ctx.fillStyle = '#59d977';
    ctx.fillRect(bag.x - 11, bag.y - 9, 22, 18);
    ctx.fillStyle = '#14202c';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', bag.x, bag.y + 5);
  }
  for (const car of game.cars) drawCarShape(ctx, car, game.time);
  for (const car of game.police) drawCarShape(ctx, car, game.time);
  for (const ped of game.peds) {
    if (ped.state === 'passenger') continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(ped.x + 2, ped.y + 3, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.state === 'down' ? '#6b6b6b' : ped.color;
    ctx.beginPath(); ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2); ctx.fill();
    if (ped.state === 'hail') {
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const bob = Math.sin(game.time * 5 + ped.id) * 3;
      ctx.fillText('$', ped.x, ped.y - 16 + bob);
    }
    if (ped.state === 'flee') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', ped.x, ped.y - 14);
    }
  }
  for (const g of game.gunmen) {
    if (!g.alive) continue;
    ctx.fillStyle = '#8c2f39';
    ctx.beginPath(); ctx.arc(g.x, g.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(g.x - 14, g.y - 24, 28, 6);
    ctx.fillStyle = '#59d977';
    ctx.fillRect(g.x - 14, g.y - 24, 28 * Math.max(0, g.health / g.maxHealth), 6);
  }
  // Tracers and bullets.
  ctx.strokeStyle = 'rgba(255,230,150,0.9)';
  ctx.lineWidth = 2;
  for (const t of game.tracers) {
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
  ctx.fillStyle = '#ffe27a';
  for (const b of game.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Player.
  const p = game.player;
  if (!p.inCar) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aimAngle || p.heading);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(8, -2, 16, 4);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(p.x + 2, p.y + 4, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = game.dusk ? '#f2a65a' : '#2f7bff';
    ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe0bd';
    ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2); ctx.fill();
  }
  // Objective arrow at the screen edge is handled in HUD; world marker here:
  if (game.objectivePos) {
    const o = game.objectivePos;
    const bob = Math.sin(game.time * 4) * 5;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(o.x, o.y - 34 + bob);
    ctx.lineTo(o.x - 10, o.y - 52 + bob);
    ctx.lineTo(o.x + 10, o.y - 52 + bob);
    ctx.closePath();
    ctx.fill();
  }
}

function drawMinimap(ctx, game, x, y, size) {
  const scale = size / WORLD_SIZE;
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,24,0.82)';
  ctx.fillRect(x - 6, y - 6, size + 12, size + 12);
  ctx.fillStyle = game.dusk ? '#1d4e79' : '#2e7fb8';
  ctx.fillRect(x, y + game.world.seaY * scale, size, (WORLD_SIZE - game.world.seaY) * scale);
  ctx.fillStyle = game.dusk ? '#3d6b52' : '#5da85e';
  ctx.fillRect(x, y, size, game.world.seaY * scale);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  for (const line of game.world.roadLines) {
    ctx.beginPath(); ctx.moveTo(x, y + line * scale); ctx.lineTo(x + size, y + line * scale); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + line * scale, y); ctx.lineTo(x + line * scale, y + size); ctx.stroke();
  }
  ctx.fillStyle = '#ffd23f';
  for (const pk of game.pickups) {
    if (!pk.taken) ctx.fillRect(x + pk.x * scale - 1.5, y + pk.y * scale - 1.5, 3, 3);
  }
  ctx.fillStyle = '#2f7bff';
  for (const car of game.police) {
    ctx.beginPath(); ctx.arc(x + car.x * scale, y + car.y * scale, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Roadblock interceptors flash on the minimap so a fleeing driver can
  // spot the barrier line before it fills the windscreen.
  if (game.roadblocks) {
    ctx.fillStyle = Math.floor(game.time * 4) % 2 === 0 ? '#ff3b30' : '#ffd7d4';
    for (const car of game.roadblocks) {
      ctx.beginPath(); ctx.arc(x + car.x * scale, y + car.y * scale, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (game.objectivePos) {
    ctx.fillStyle = '#ffcf3f';
    ctx.beginPath(); ctx.arc(x + game.objectivePos.x * scale, y + game.objectivePos.y * scale, 4.5, 0, Math.PI * 2); ctx.fill();
  }
  const pos = game.player.inCar ? game.player.inCar : game.player;
  const heading = game.player.inCar ? game.player.inCar.heading : game.player.heading;
  ctx.save();
  ctx.translate(x + pos.x * scale, y + pos.y * scale);
  ctx.rotate(heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -4.5); ctx.lineTo(-5, 4.5); ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function drawHUD(ctx, game, viewW, viewH) {
  const pos = game.player.inCar ? game.player.inCar : game.player;
  ctx.fillStyle = 'rgba(8,12,18,0.72)';
  ctx.fillRect(14, 14, 330, 118);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${game.player.cash}`, 26, 44);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#ffd23f';
  const stars = starsOf(game);
  ctx.fillText(stars > 0 ? '★'.repeat(stars) + '☆'.repeat(5 - stars) : 'No heat', 130, 44);
  ctx.fillStyle = '#fff';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(districtAt(pos.x, pos.y) + (game.dusk ? ' · DUSK' : ''), 26, 68);
  // Wanted status: heat only cools while unseen, so tell the player plainly
  // whether patrols currently have eyes on them or they are hidden.
  if (stars > 0) {
    ctx.fillStyle = game.seenByPolice ? '#ff8a7a' : '#8ae6a0';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(game.seenByPolice ? 'SPOTTED — break line of sight!' : 'HIDDEN — heat is cooling', 196, 68);
    ctx.fillStyle = '#fff';
    ctx.font = '14px system-ui, sans-serif';
  }
  const obj = game.objectiveText + (game.objectiveDist !== null && game.objectiveDist !== undefined ? ` — ${game.objectiveDist}m` : '') + (game.timerText ? ` · ${game.timerText}` : '');
  ctx.fillText(obj.slice(0, 52), 26, 90);
  // Health bar.
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(26, 100, 180, 12);
  ctx.fillStyle = game.player.health > 30 ? '#59d977' : '#ff5f6d';
  ctx.fillRect(26, 100, 180 * Math.max(0, game.player.health / PLAYER_MAX_HEALTH), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`Ammo ${game.player.ammo}`, 216, 111);
  if (game.player.inCar) {
    const car = game.player.inCar;
    ctx.fillStyle = 'rgba(8,12,18,0.72)';
    ctx.fillRect(14, 140, 330, 52);
    ctx.fillStyle = '#fff';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`${car.className} · ${Math.round(Math.abs(car.speed) * 0.36)} km/h`, 26, 162);
    ctx.fillText(`Hull ${Math.ceil(car.hull)}/${car.hullMax}`, 26, 182);
  }
  if (game.bust > 1) {
    ctx.fillStyle = 'rgba(8,12,18,0.8)';
    ctx.fillRect(viewW / 2 - 130, 66, 260, 30);
    ctx.fillStyle = '#3a3f47';
    ctx.fillRect(viewW / 2 - 120, 76, 240, 10);
    ctx.fillStyle = '#ff5f6d';
    ctx.fillRect(viewW / 2 - 120, 76, 240 * (game.bust / 100), 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED?', viewW / 2, 62);
    ctx.textAlign = 'left';
  }
  if (game.dialogue) {
    ctx.fillStyle = 'rgba(8,12,18,0.85)';
    ctx.fillRect(60, viewH - 108, viewW - 120, 62);
    ctx.fillStyle = '#ffe9c9';
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, game.dialogue, 76, viewH - 82, viewW - 152, 20);
  } else if (game.banner) {
    ctx.fillStyle = 'rgba(8,12,18,0.85)';
    ctx.fillRect(60, viewH - 84, viewW - 120, 42);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.banner, viewW / 2, viewH - 57);
    ctx.textAlign = 'left';
  }
  drawMinimap(ctx, game, viewW - 176, 14, 160);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

export function cameraFor(game, viewW, viewH) {
  const pos = game.player.inCar ? game.player.inCar : game.player;
  return {
    x: Math.max(0, Math.min(WORLD_SIZE - viewW, pos.x - viewW / 2)),
    y: Math.max(0, Math.min(WORLD_SIZE - viewH, pos.y - viewH / 2)),
  };
}

export function renderFrame(ctx, game, viewW, viewH) {
  const cam = cameraFor(game, viewW, viewH);
  drawWorld(ctx, game, cam, viewW, viewH);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawActors(ctx, game);
  ctx.restore();
  if (game.dusk) {
    ctx.fillStyle = 'rgba(38,20,70,0.16)';
    ctx.fillRect(0, 0, viewW, viewH);
  }
  drawHUD(ctx, game, viewW, viewH);
}

export function renderTitle(ctx, game, viewW, viewH) {
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, game.dusk ? '#2b1a4a' : '#123a5e');
  grad.addColorStop(0.62, game.dusk ? '#7a3a2e' : '#2e7fb8');
  grad.addColorStop(0.63, '#e6d29a');
  grad.addColorStop(1, '#1d4e79');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
  // Animated skyline silhouettes drifting with game time.
  ctx.fillStyle = 'rgba(8,14,22,0.85)';
  const offset = (game.time * 12) % 90;
  for (let x = -90; x < viewW + 90; x += 90) {
    const h = 90 + ((x * 37) % 130 + 130) % 130;
    ctx.fillRect(x - offset, viewH * 0.63 - h, 64, h);
  }
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AURELIA HEAT', viewW / 2, 130);
  ctx.fillStyle = '#ffffff';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('An original open-world crime game in Port Aurelia', viewW / 2, 164);
  ctx.font = '15px system-ui, sans-serif';
  const lines = STORY_INTRO.split('. ');
  let yy = 205;
  for (const line of lines) {
    wrapTextCentered(ctx, line.endsWith('.') ? line : `${line}.`, viewW / 2, yy, viewW - 320);
    yy += 42;
  }
  ctx.fillStyle = 'rgba(8,12,18,0.78)';
  ctx.fillRect(viewW / 2 - 330, 330, 660, 168);
  ctx.fillStyle = '#ffe9c9';
  ctx.font = '15px system-ui, sans-serif';
  const controls = [
    'WASD / arrows — move & drive · Mouse — aim · Click — shoot',
    'Space — punch · E — enter / exit (steal) car · Shift — sprint',
    'M — next job · K — save · L — Dusk Mode · P / Esc — pause',
    'Enter or click to start',
  ];
  let cy = 362;
  for (const line of controls) {
    ctx.fillText(line, viewW / 2, cy);
    cy += 30;
  }
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(`Saved: $${game.player.cash} · Jobs done ${game.stats.missionsDone}/${MISSIONS.length} · Fares ${game.stats.faresDone}`, viewW / 2, 478);
  ctx.textAlign = 'left';
}

function wrapTextCentered(ctx, text, cx, y, maxWidth) {
  const words = String(text).split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, yy);
      line = word;
      yy += 20;
    } else line = test;
  }
  if (line) ctx.fillText(line, cx, yy);
}

export function renderPause(ctx, game, viewW, viewH) {
  renderFrame(ctx, game, viewW, viewH);
  ctx.fillStyle = 'rgba(5,8,12,0.66)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', viewW / 2, viewH / 2 - 30);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('P or Esc to resume · K to save · L for Dusk Mode', viewW / 2, viewH / 2 + 12);
  ctx.fillText(`Cash $${game.player.cash} · District ${districtAt(game.player.x, game.player.y)}`, viewW / 2, viewH / 2 + 44);
  ctx.textAlign = 'left';
}

export function renderStoryComplete(ctx, game, viewW, viewH) {
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, '#2b1a4a');
  grad.addColorStop(1, '#7a3a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PORT AURELIA IS YOURS', viewW / 2, 150);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  wrapTextCentered(ctx, STORY_OUTRO, viewW / 2, 210, viewW - 300);
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText(`Final cash $${game.player.cash} · Jobs ${game.stats.missionsDone} · Fares ${game.stats.faresDone} · Cars stolen ${game.stats.carsStolen}`, viewW / 2, 330);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Press Enter to keep roaming Port Aurelia in free roam', viewW / 2, 380);
  ctx.textAlign = 'left';
}
