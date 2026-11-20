// The simulation: every rule of Aurelia Heat with no drawing in it. The player walks
// and drives; traffic follows the avenues; pedestrians stroll and flee; police spawn
// with the wanted level and hunt; the Vane crew shoots back; missions advance stage
// by stage; fares pay; and the whole state can be saved to and restored from a plain
// object (main.js keeps it in localStorage). update() advances one fixed step and
// reports nothing — main.js reads state for sound cues from the event queue.

import { CAR, DUSK, PALETTE, PLAYER, WANTED, WEAPON, WORLD } from './config.js';
import { ACTION_DUSK, ACTION_INTERACT, ACTION_MISSION, ACTION_PUNCH } from './input.js';
import { FARE_PAY, MISSIONS, SIDE_TEXT, payWithDusk } from './missions.js';
import { pick, range, rangeInt } from './random.js';
import { CAR_COLOURS } from './config.js';

let nextId = 1;

/** The dusk payout premium as a whole percent, for player-facing text. */
const DUSK_BONUS_PCT = Math.round((DUSK.payoutBonus - 1) * 100);

export function createGame(random, world, audio) {
  const state = {
    time: 0,
    mode: 'foot',
    player: { x: 450, y: 2320, angle: -Math.PI / 2, health: PLAYER.health, fireCd: 0, punchCd: 0, ammo: WEAPON.startAmmo, dead: 0 },
    car: null,
    vehicles: [],
    peds: [],
    enemies: [],
    bullets: [],
    particles: [],
    pickups: [],
    cash: 120,
    dusk: false,
    respect: 0,
    heat: 0,
    stars: 0,
    unseenFor: 99,
    bust: 0,
    missionIndex: 0,
    mission: null,
    storyDone: false,
    fare: null,
    fareTimer: 14,
    pickupTimer: 6,
    crimeVoiceCd: 0,
    banner: null,
    toast: null,
    objective: SIDE_TEXT.missionPrompt,
    marker: null,
    camera: { x: 450, y: 2320 },
    viewScale: 1,
    mouseWorld: { x: 450, y: 2200 },
    events: [],
    stats: { earned: 0, carsStolen: 0, faresDone: 0, missionsDone: 0 },
    saveDirty: false,
    ended: null,
  };

  function toast(text, seconds = 3.4) {
    state.toast = { text, until: state.time + seconds };
  }
  function banner(title, text, seconds = 5.5) {
    state.banner = { title, text, until: state.time + seconds };
  }
  function fx(x, y, colour, count, speed = 130) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * Math.PI * 2;
      const s = range(random, speed * 0.3, speed);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: range(random, 0.25, 0.6), maxLife: 0.6, colour, size: range(random, 2, 4.5) });
    }
  }

  // ---------- dusk mode ----------
  // The L key flips the city into dusk: the renderer tints the scene and lights the
  // lamps, jobs and fares pay the dusk premium, and heat cools faster in low light.
  function toggleDusk() {
    state.dusk = !state.dusk;
    audio.setDusk(state.dusk);
    state.events.push(state.dusk ? 'dusk-on' : 'dusk-off');
    toast(state.dusk
      ? `Dusk settles over Port Aurelia — jobs and fares pay +${DUSK_BONUS_PCT}%, and heat cools faster.`
      : 'The light comes back — standard pay, standard heat.', 3.6);
  }

  function addCrime(kind) {
    state.heat = Math.min(WANTED.perStar * WANTED.maxStars, state.heat + (WANTED.crimes[kind] || 8));
  }

  // ---------- vehicles ----------
  function makeVehicle(x, y, cls, colour, kind) {
    const v = {
      id: nextId++, x, y, angle: 0, speed: 0, cls, colour, kind,
      health: 100, driver: kind === 'traffic' || kind === 'cop' ? 'ai' : null,
      axis: 'v', centre: 0, dir: 1, turnCd: 0, stuck: 0, siren: random() * 6,
      targetCar: false,
    };
    // Snap to the nearest road's lane and heading.
    let bestC = world.centres[0];
    let bestD = Infinity;
    for (const c of world.centres) {
      const dv = Math.abs(x - c);
      const dh = Math.abs(y - c);
      if (dv < bestD) { bestD = dv; bestC = c; v.axis = 'v'; }
      if (dh < bestD) { bestD = dh; bestC = c; v.axis = 'h'; }
    }
    v.centre = bestC;
    v.dir = random() < 0.5 ? 1 : -1;
    if (v.axis === 'v') { v.x = bestC + laneOffset(v); v.angle = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { v.y = bestC + laneOffset(v); v.angle = v.dir > 0 ? 0 : Math.PI; }
    return v;
  }
  function laneOffset(v) {
    // Right-hand traffic: offset to the driver's right of the centreline.
    if (v.axis === 'v') return v.dir > 0 ? -29 : 29;
    return v.dir > 0 ? 29 : -29;
  }

  function spawnTraffic() {
    const p = state.player;
    const pt = world.roadPointNear(random, p.x, p.y, 480, 900);
    const cls = pick(random, ['sedan', 'sedan', 'taxi', 'sport', 'truck']);
    state.vehicles.push(makeVehicle(pt.x, pt.y, cls, pick(random, CAR_COLOURS), 'traffic'));
  }
  function spawnParked() {
    const p = state.player;
    const pt = world.roadPointNear(random, p.x, p.y, 260, 800);
    const cls = pick(random, ['sedan', 'sedan', 'sport', 'taxi']);
    const v = makeVehicle(pt.x, pt.y, cls, pick(random, CAR_COLOURS), 'parked');
    v.driver = null;
    v.speed = 0;
    // Park tight to the kerb.
    if (v.axis === 'v') v.x = v.centre + (v.dir > 0 ? -46 : 46);
    else v.y = v.centre + (v.dir > 0 ? 46 : -46);
    state.vehicles.push(v);
  }
  function spawnCop() {
    const p = state.player;
    const pt = world.roadPointNear(random, p.x, p.y, 640, 980);
    const v = makeVehicle(pt.x, pt.y, 'cop', '#e8ecf2', 'cop');
    state.vehicles.push(v);
  }

  function spawnPed(x, y, farePed = false) {
    const pt = (x !== undefined) ? { x, y } : world.sidewalkPointNear(random, state.player.x, state.player.y, 700);
    const ped = {
      id: nextId++, x: pt.x, y: pt.y, angle: random() * Math.PI * 2,
      state: farePed ? 'fare' : 'walk', target: null, timer: range(random, 1, 4),
      colour: pick(random, ['#d97f4f', '#4f83d9', '#d9c44f', '#7dd87d', '#d97fb8', '#e8e8e8', '#8a5fb0']),
      speed: range(random, 42, 66),
    };
    state.peds.push(ped);
    return ped;
  }

  // ---------- missions ----------
  function currentStage() {
    if (!state.mission) return null;
    return state.mission.def.stages[state.mission.stageIndex] || null;
  }
  function stageTarget(stage) {
    if (!stage) return null;
    if (stage.kind === 'stealCar' && state.mission.targetCar) {
      return { x: state.mission.targetCar.x, y: state.mission.targetCar.y };
    }
    if (stage.place) {
      const p = world.places[stage.place];
      return { x: p.x, y: p.y };
    }
    return null;
  }
  function setupStage() {
    const stage = currentStage();
    if (!stage) return;
    if (stage.forcedStars) {
      state.heat = Math.max(state.heat, WANTED.perStar * stage.forcedStars - 2);
      toast('The police are on you — shake them!', 4);
    }
    if (stage.wantedOnStart) state.heat = Math.max(state.heat, WANTED.perStar * stage.wantedOnStart - 2);
    if (stage.timer) state.mission.timer = stage.timer;
    if (stage.kind === 'clear') {
      state.mission.toClear = stage.count;
      for (let i = 0; i < stage.count; i += 1) {
        const c = world.places[stage.place];
        const a = (i / stage.count) * Math.PI * 2;
        state.enemies.push({
          id: nextId++, x: c.x + Math.cos(a) * range(random, 60, 130), y: c.y + Math.sin(a) * range(random, 60, 130),
          health: 75, angle: random() * Math.PI * 2, fireCd: range(random, 0.6, 1.6), anchor: { x: c.x, y: c.y },
        });
      }
      toast('The Vane crew is here — clear the lot!', 4);
    }
  }
  function startNextMission() {
    if (state.mission || state.storyDone) return false;
    const def = MISSIONS[state.missionIndex];
    if (!def) { state.storyDone = true; return false; }
    state.mission = { def, stageIndex: 0, timer: null, targetCar: null, toClear: 0 };
    banner(def.title.toUpperCase(), def.intro, 6.5);
    audio.mission();
    // The steal-car stage needs its car in the world from the start of the mission.
    if (def.id === 'hot-wheels') {
      const h = world.places.heights;
      const v = makeVehicle(h.x + 60, h.y + 30, 'sport', '#c0272d', 'parked');
      v.targetCar = true;
      v.driver = null;
      state.vehicles.push(v);
      state.mission.targetCar = v;
    }
    setupStage();
    return true;
  }
  function completeMission() {
    const def = state.mission.def;
    const pay = payWithDusk(def.reward, state.dusk);
    state.cash += pay.amount;
    state.stats.earned += pay.amount;
    state.stats.missionsDone += 1;
    state.respect += 1;
    state.missionIndex += 1;
    state.mission = null;
    banner('MISSION COMPLETE', `${def.outro}  (+$${pay.amount}${pay.bonus > 0 ? `, incl. $${pay.bonus} dusk bonus` : ''})`, 7);
    audio.cash();
    if (state.missionIndex >= MISSIONS.length) {
      state.storyDone = true;
      state.ended = 'story';
    }
    state.saveDirty = true;
  }
  function advanceStage() {
    state.mission.stageIndex += 1;
    state.mission.timer = null;
    if (state.mission.stageIndex >= state.mission.def.stages.length) completeMission();
    else {
      audio.pickup();
      setupStage();
    }
  }
  function failMission(reason) {
    toast(`Job failed: ${reason}. Press M to try again.`, 5);
    // Restart the same mission from stage one, cleaning up its actors.
    if (state.mission.targetCar) removeVehicle(state.mission.targetCar);
    state.enemies.length = 0;
    state.mission = null;
    state.heat = 0;
  }
  function removeVehicle(v) {
    const i = state.vehicles.indexOf(v);
    if (i >= 0) state.vehicles.splice(i, 1);
    if (state.car === v) { state.car = null; state.mode = 'foot'; }
  }

  // ---------- save ----------
  function saveData() {
    return {
      cash: state.cash, respect: state.respect, missionIndex: state.missionIndex,
      storyDone: state.storyDone, ammo: state.player.ammo, stats: state.stats,
    };
  }
  function applySave(data) {
    if (!data) return;
    state.cash = data.cash ?? state.cash;
    state.respect = data.respect ?? 0;
    state.missionIndex = Math.min(data.missionIndex ?? 0, MISSIONS.length);
    state.storyDone = !!data.storyDone || state.missionIndex >= MISSIONS.length;
    state.player.ammo = data.ammo ?? state.player.ammo;
    if (data.stats) state.stats = data.stats;
  }
  function respawnAtHospital() {
    const h = world.places.hospital;
    if (state.car) { state.car.driver = null; }
    state.car = null;
    state.mode = 'foot';
    state.player.x = h.x + 40;
    state.player.y = h.y + 30;
    state.player.health = PLAYER.health;
    state.heat = 0;
    state.bust = 0;
  }

  // ---------- combat helpers ----------
  function shoot(from, x, y, angle, damage) {
    const spread = (random() - 0.5) * WEAPON.spread * 2;
    const a = angle + spread;
    state.bullets.push({
      x, y, vx: Math.cos(a) * WEAPON.bulletSpeed, vy: Math.sin(a) * WEAPON.bulletSpeed,
      life: WEAPON.range / WEAPON.bulletSpeed, from, damage,
    });
  }
  function hurtPlayer(amount) {
    if (state.mode === 'car' && state.car) {
      state.car.health -= amount * 0.7;
      state.player.health -= amount * 0.3;
      if (state.car.health <= 0) {
        fx(state.car.x, state.car.y, '#e5534b', 22, 220);
        audio.crash(1);
        removeVehicle(state.car);
        state.player.health -= 12;
        toast('Your ride is wrecked!', 3);
      }
    } else {
      state.player.health -= amount;
    }
    state.events.push('hit');
    if (state.player.health <= 0 && state.player.dead <= 0) {
      state.player.dead = 2.6;
      state.events.push('wasted');
      audio.wasted();
    }
  }

  return {
    state, toast, banner, startNextMission, saveData, applySave, toggleDusk,
    get objective() { return state.objective; },
    update,
  };

  // ---------- the step ----------
  function update(dt, input, actions) {
    const p = state.player;
    state.time += dt;
    state.events.length = 0;
    if (state.crimeVoiceCd > 0) state.crimeVoiceCd -= dt;

    if (p.dead > 0) {
      p.dead -= dt;
      if (p.dead <= 0) {
        const fine = Math.floor(state.cash * 0.1);
        state.cash -= fine;
        if (state.mission) failMission('you were wasted');
        respawnAtHospital();
        toast(`Aurelia General patched you up. Bill: $${fine}.`, 4.5);
      }
      updateFx(dt);
      return;
    }

    if (actions & ACTION_DUSK) toggleDusk();

    handlePlayer(dt, input, actions);
    handleTraffic(dt);
    handleCops(dt);
    handlePeds(dt);
    handleEnemies(dt);
    handleBullets(dt);
    handlePickups(dt);
    handleWanted(dt);
    handleMissions(dt, actions);
    handleFares(dt);
    updateFx(dt);

    // Camera follows the player (or the car), gently.
    const focus = state.mode === 'car' && state.car ? state.car : p;
    state.camera.x += (focus.x - state.camera.x) * Math.min(1, dt * 6);
    state.camera.y += (focus.y - state.camera.y) * Math.min(1, dt * 6);

    // Ambient population control.
    const trafficCount = state.vehicles.filter((v) => v.kind === 'traffic').length;
    if (trafficCount < 16 && random() < dt * 2.2) spawnTraffic();
    const parkedCount = state.vehicles.filter((v) => v.kind === 'parked').length;
    if (parkedCount < 7 && random() < dt * 1.4) spawnParked();
    if (state.peds.length < 15 && random() < dt * 2.4) spawnPed();
    // Cull far-away ambient actors.
    for (let i = state.vehicles.length - 1; i >= 0; i -= 1) {
      const v = state.vehicles[i];
      if (v === state.car || v.targetCar) continue;
      if (Math.hypot(v.x - p.x, v.y - p.y) > 1250 && v.kind !== 'cop') removeVehicle(v);
    }
    for (let i = state.peds.length - 1; i >= 0; i -= 1) {
      const ped = state.peds[i];
      if (state.fare && state.fare.ped === ped) continue;
      if (Math.hypot(ped.x - p.x, ped.y - p.y) > 1150) state.peds.splice(i, 1);
    }

    // Objective line + marker.
    updateObjective();

    // Sound bed.
    const engine01 = state.mode === 'car' && state.car ? Math.abs(state.car.speed) / CAR.topSpeed[state.car.cls] : 0;
    let siren01 = 0;
    if (state.stars > 0) {
      let nearest = Infinity;
      for (const v of state.vehicles) if (v.kind === 'cop') nearest = Math.min(nearest, Math.hypot(v.x - p.x, v.y - p.y));
      if (nearest < 620) siren01 = 1 - nearest / 620;
    }
    audio.update(dt, engine01, siren01);
  }

  function updateObjective() {
    const stage = currentStage();
    if (stage) {
      let text = stage.text;
      if (state.mission.timer !== null && state.mission.timer !== undefined) {
        text += ` — ${Math.max(0, Math.ceil(state.mission.timer))}s`;
      }
      if (stage.kind === 'clear') text += ` (${state.mission.toClear} left)`;
      if (stage.kind === 'escape') text = `${stage.text} — now: ${state.stars} star${state.stars === 1 ? '' : 's'}`;
      state.objective = text;
      state.marker = stageTarget(stage);
      if (stage.kind === 'stealCar' && !state.mission.targetCar) state.marker = null;
      return;
    }
    if (state.fare) {
      state.objective = state.fare.phase === 'pickup' ? 'Pick up the fare ($)' : `Take the fare to ${state.fare.destName} ($)`;
      state.marker = state.fare.phase === 'pickup' && state.fare.ped
        ? { x: state.fare.ped.x, y: state.fare.ped.y } : state.fare.dest;
      return;
    }
    state.marker = null;
    state.objective = state.storyDone ? SIDE_TEXT.storyDone : SIDE_TEXT.missionPrompt;
    if (!state.storyDone && state.missionIndex < MISSIONS.length) {
      const first = MISSIONS[state.missionIndex].stages[0];
      if (first.place) {
        const pl = world.places[first.place];
        state.marker = { x: pl.x, y: pl.y };
      }
    }
  }

  function handlePlayer(dt, input, actions) {
    const p = state.player;
    if (p.fireCd > 0) p.fireCd -= dt;
    if (p.punchCd > 0) p.punchCd -= dt;

    if (actions & ACTION_INTERACT) {
      if (state.mode === 'car' && state.car) {
        const v = state.car;
        p.x = v.x + Math.cos(v.angle + Math.PI / 2) * 26;
        p.y = v.y + Math.sin(v.angle + Math.PI / 2) * 26;
        v.driver = null;
        v.speed = 0;
        state.car = null;
        state.mode = 'foot';
        audio.door();
      } else {
        let best = null;
        let bestD = 64;
        for (const v of state.vehicles) {
          if (v.kind === 'cop') continue;
          const d = Math.hypot(v.x - p.x, v.y - p.y);
          if (d < bestD) { bestD = d; best = v; }
        }
        if (best) {
          if (best.driver === 'ai') {
            // Carjack: the driver bails out and runs.
            const driver = spawnPed(best.x + 20, best.y + 10);
            driver.state = 'flee';
            driver.timer = 3;
            addCrime('carjack');
            state.stats.carsStolen += 1;
            toast('Carjacked! The police may have seen that…', 3);
          } else if (best.kind === 'parked') {
            state.stats.carsStolen += best.targetCar ? 0 : 0; // taking a parked car is quiet until seen
            if (random() < 0.4 || best.targetCar) addCrime('theft');
          }
          best.driver = 'player';
          best.kind = best.kind === 'traffic' ? 'parked' : best.kind;
          state.car = best;
          state.mode = 'car';
          audio.door();
          if (state.mission && state.mission.targetCar === best) state.events.push('stole-target');
        }
      }
    }

    if (state.mode === 'car' && state.car) {
      const v = state.car;
      const axis = input.moveAxis();
      const top = CAR.topSpeed[v.cls];
      if (axis.y < 0) v.speed += CAR.accel * dt;
      else if (axis.y > 0) {
        if (v.speed > 12) v.speed -= CAR.brake * dt;
        else v.speed = Math.max(-CAR.reverseMax, v.speed - CAR.accel * 0.6 * dt);
      }
      v.speed -= v.speed * CAR.drag * dt;
      if (axis.y === 0 && Math.abs(v.speed) < 4) v.speed = 0;
      v.speed = Math.max(-CAR.reverseMax, Math.min(top, v.speed));
      const steer = axis.x * CAR.gripTurn * Math.min(1, Math.abs(v.speed) / 120) * (v.speed < 0 ? -1 : 1);
      v.angle += steer * dt;
      const nx = v.x + Math.cos(v.angle) * v.speed * dt;
      const ny = v.y + Math.sin(v.angle) * v.speed * dt;
      const before = Math.abs(v.speed);
      v.x = nx; v.y = ny;
      const pos = { x: v.x, y: v.y };
      const impact = world.collideCircle(pos, 24);
      v.x = pos.x; v.y = pos.y;
      if (impact > 0.25 && before > 150) {
        audio.crash(impact);
        fx(v.x, v.y, '#f2c94c', 8, 160);
        v.health -= impact * 16;
        hurtPlayer(impact * 5);
        if (state.stars > 0 || impact > 0.6) addCrime('hitCopCar');
      }
      if (impact > 0.1) v.speed *= 0.35;
      // Hitting other vehicles.
      for (const o of state.vehicles) {
        if (o === v) continue;
        const d = Math.hypot(o.x - v.x, o.y - v.y);
        if (d < 44 && d > 0.01) {
          const push = (44 - d) / 2;
          const ux = (o.x - v.x) / d;
          const uy = (o.y - v.y) / d;
          o.x += ux * push; o.y += uy * push;
          v.x -= ux * push; v.y -= uy * push;
          if (Math.abs(v.speed) > 130) {
            audio.crash(0.5);
            o.health -= 14;
            if (o.kind === 'cop') addCrime('hitCopCar');
            v.speed *= 0.55;
          }
        }
      }
      // Running over a pedestrian is the city's worst look.
      if (Math.abs(v.speed) > 90) {
        for (const ped of state.peds) {
          if (ped.state === 'down' || ped.state === 'passenger') continue;
          if (Math.hypot(ped.x - v.x, ped.y - v.y) < 30) {
            ped.state = 'down';
            ped.timer = 6;
            addCrime('hitPed');
            fx(ped.x, ped.y, PALETTE.danger, 10, 120);
            toast('You hit a pedestrian!', 2.6);
          }
        }
      }
      p.x = v.x; p.y = v.y; p.angle = v.angle;
      return;
    }

    // On foot.
    const axis = input.moveAxis();
    const speed = input.sprint() ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    if (axis.x !== 0 || axis.y !== 0) {
      const len = Math.hypot(axis.x, axis.y);
      const vx = (axis.x / len) * speed;
      const vy = (axis.y / len) * speed;
      p.x += vx * dt;
      p.y += vy * dt;
      const pos = { x: p.x, y: p.y };
      world.collideCircle(pos, PLAYER.radius);
      p.x = pos.x; p.y = pos.y;
      if (!input.mouse.down) p.angle = Math.atan2(vy, vx);
    }
    // Aim with the mouse whenever it is held or moved for firing.
    p.angle = Math.atan2(state.mouseWorld.y - p.y, state.mouseWorld.x - p.x);

    if (input.mouse.down && p.fireCd <= 0) {
      if (p.ammo > 0) {
        p.ammo -= 1;
        p.fireCd = WEAPON.fireRate;
        shoot('player', p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18, p.angle, WEAPON.damage);
        audio.shot();
        state.events.push('shot');
        if (state.crimeVoiceCd <= 0) { addCrime('shotFired'); state.crimeVoiceCd = 1.6; }
        for (const ped of state.peds) {
          if (Math.hypot(ped.x - p.x, ped.y - p.y) < 260 && ped.state === 'walk') { ped.state = 'flee'; ped.timer = range(random, 2, 4); }
        }
      } else if (p.fireCd <= 0) {
        p.fireCd = 0.3;
        toast('Out of ammo — find an ammo pickup (orange).', 2.4);
      }
    }
    if ((actions & ACTION_PUNCH) && p.punchCd <= 0) {
      p.punchCd = 0.38;
      audio.punch();
      let hitSomething = false;
      for (const ped of state.peds) {
        if (ped.state !== 'down' && Math.hypot(ped.x - p.x, ped.y - p.y) < PLAYER.punchRange + 8) {
          ped.state = 'down'; ped.timer = 5; hitSomething = true;
          fx(ped.x, ped.y, '#ffffff', 5, 90);
        }
      }
      for (const e of state.enemies) {
        if (Math.hypot(e.x - p.x, e.y - p.y) < PLAYER.punchRange + 10) {
          e.health -= PLAYER.punchDamage; hitSomething = true;
          fx(e.x, e.y, '#ffffff', 6, 100);
          if (e.health <= 0) killEnemy(e);
        }
      }
      if (hitSomething) addCrime('assault');
    }
  }

  function handleTraffic(dt) {
    for (const v of state.vehicles) {
      if (v.kind !== 'traffic' || v.driver !== 'ai') continue;
      const top = CAR.topSpeed[v.cls] * 0.52;
      // Slow for the car ahead on the same lane.
      let desired = top;
      for (const o of state.vehicles) {
        if (o === v) continue;
        const ahead = (o.x - v.x) * Math.cos(v.angle) + (o.y - v.y) * Math.sin(v.angle);
        const side = Math.abs((o.x - v.x) * -Math.sin(v.angle) + (o.y - v.y) * Math.cos(v.angle));
        if (ahead > 0 && ahead < 74 && side < 20) desired = Math.min(desired, Math.max(0, (ahead - 52) * 2));
      }
      const playerAhead = state.mode === 'car' && state.car
        ? (state.car.x - v.x) * Math.cos(v.angle) + (state.car.y - v.y) * Math.sin(v.angle) : -1;
      if (playerAhead > 0 && playerAhead < 70) desired = 0;
      v.speed += Math.max(-260 * dt, Math.min(150 * dt, desired - v.speed));
      v.turnCd -= dt;
      // At an intersection, sometimes turn onto the crossing avenue.
      if (v.turnCd <= 0) {
        for (const c of world.centres) {
          const along = v.axis === 'v' ? v.y : v.x;
          if (Math.abs(along - c) < 26) {
            if (random() < 0.38) {
              const crossPos = v.axis === 'v' ? v.x : v.y;
              v.axis = v.axis === 'v' ? 'h' : 'v';
              v.centre = c;
              v.dir = random() < 0.5 ? 1 : -1;
              if (v.axis === 'v') v.x = c + laneOffset(v);
              else v.y = c + laneOffset(v);
              void crossPos;
            }
            v.turnCd = 1.2;
            break;
          }
        }
      }
      // Steer back to the lane centreline, then advance.
      if (v.axis === 'v') {
        const laneX = v.centre + laneOffset(v);
        v.x += (laneX - v.x) * Math.min(1, dt * 3);
        v.y += v.dir * v.speed * dt;
        v.angle = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        const laneY = v.centre + laneOffset(v);
        v.y += (laneY - v.y) * Math.min(1, dt * 3);
        v.x += v.dir * v.speed * dt;
        v.angle = v.dir > 0 ? 0 : Math.PI;
      }
      if (v.x < 20 || v.x > world.size - 20 || v.y < 20 || v.y > WORLD.beachY + 60) {
        v.dir *= -1;
      }
      const pos = { x: v.x, y: v.y };
      if (world.collideCircle(pos, 22) > 0.3) { v.x = pos.x; v.y = pos.y; v.speed = 0; }
    }
  }

  function handleCops(dt) {
    const p = state.player;
    const want = state.stars === 0 ? 0 : Math.min(6, state.stars + 1);
    const cops = state.vehicles.filter((v) => v.kind === 'cop');
    if (cops.length < want && random() < dt * 1.6) spawnCop();
    if (cops.length > want + 2) {
      const far = cops[cops.length - 1];
      if (Math.hypot(far.x - p.x, far.y - p.y) > 500) removeVehicle(far);
    }
    let anyNear = false;
    for (const v of cops) {
      v.siren += dt * 9;
      const tx = state.mode === 'car' && state.car ? state.car.x + Math.cos(state.car.angle) * state.car.speed * 0.35 : p.x;
      const ty = state.mode === 'car' && state.car ? state.car.y + Math.sin(state.car.angle) * state.car.speed * 0.35 : p.y;
      const dx = tx - v.x;
      const dy = ty - v.y;
      const dist = Math.hypot(dx, dy);
      const desiredAngle = Math.atan2(dy, dx);
      let diff = desiredAngle - v.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      v.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const top = CAR.topSpeed.cop * (state.stars >= 4 ? 1.04 : 0.94);
      const targetSpeed = dist > 60 ? top : top * 0.25;
      v.speed += Math.max(-300 * dt, Math.min(210 * dt, targetSpeed - v.speed));
      v.x += Math.cos(v.angle) * v.speed * dt;
      v.y += Math.sin(v.angle) * v.speed * dt;
      const pos = { x: v.x, y: v.y };
      const impact = world.collideCircle(pos, 24);
      v.x = pos.x; v.y = pos.y;
      if (impact > 0.2) v.speed *= 0.4;
      // Shoving the player's car.
      if (state.car && Math.hypot(v.x - state.car.x, v.y - state.car.y) < 46 && Math.abs(v.speed) > 120) {
        state.car.speed *= 0.82;
        hurtPlayer(2.2);
        audio.crash(0.35);
      }
      if (dist < 560) anyNear = true;
      // Bust pressure: a close officer + a slow player fills the meter.
      const playerSpeed = state.mode === 'car' && state.car ? Math.abs(state.car.speed) : (0);
      if (dist < 74 && state.stars > 0 && (state.mode === 'foot' || playerSpeed < 26)) {
        state.bust += dt * (state.mode === 'foot' ? 0.55 : 0.4);
      }
    }
    if (!anyNear || state.stars === 0) state.bust = Math.max(0, state.bust - dt * 0.5);
    if (state.bust >= 1) {
      const fine = 200 + state.stars * 120;
      state.cash = Math.max(0, state.cash - fine);
      state.events.push('busted');
      audio.busted();
      if (state.mission) failMission('you were busted');
      banner('BUSTED', `Aurelia PD took $${fine} in fines. Walk it off.`, 5);
      respawnAtHospital();
    }
  }

  function handlePeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      ped.timer -= dt;
      if (ped.state === 'passenger') {
        ped.x = p.x; ped.y = p.y;
        continue;
      }
      if (ped.state === 'down') {
        if (ped.timer <= 0) { ped.state = 'flee'; ped.timer = 2; }
        continue;
      }
      if (ped.state === 'fare') continue; // stands and waves
      if (ped.state === 'flee') {
        const dx = ped.x - p.x;
        const dy = ped.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        ped.x += (dx / d) * 175 * dt;
        ped.y += (dy / d) * 175 * dt;
        ped.angle = Math.atan2(dy, dx);
        if (ped.timer <= 0) ped.state = 'walk';
        const pos = { x: ped.x, y: ped.y };
        world.collideCircle(pos, 10);
        ped.x = pos.x; ped.y = pos.y;
        continue;
      }
      // Walk: stroll to a target, then pick another.
      if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 14) {
        if (ped.timer <= 0) {
          ped.target = world.sidewalkPointNear(random, ped.x, ped.y, 320);
          ped.timer = range(random, 2, 5);
        }
      } else {
        const dx = ped.target.x - ped.x;
        const dy = ped.target.y - ped.y;
        const d = Math.hypot(dx, dy) || 1;
        ped.x += (dx / d) * ped.speed * dt;
        ped.y += (dy / d) * ped.speed * dt;
        ped.angle = Math.atan2(dy, dx);
      }
      // Dodge traffic: flee briefly from fast cars bearing down.
      if (state.mode === 'car' && state.car && Math.abs(state.car.speed) > 200
        && Math.hypot(ped.x - state.car.x, ped.y - state.car.y) < 110) {
        ped.state = 'flee';
        ped.timer = 1.6;
      }
    }
  }

  function killEnemy(e) {
    fx(e.x, e.y, '#e5534b', 14, 150);
    state.pickups.push({ x: e.x, y: e.y, kind: 'cash', amount: rangeInt(random, 30, 90), bob: random() * 6 });
    const i = state.enemies.indexOf(e);
    if (i >= 0) state.enemies.splice(i, 1);
    if (state.mission && currentStage() && currentStage().kind === 'clear') {
      state.mission.toClear = Math.max(0, state.mission.toClear - 1);
      addCrime('copDown'); // witnesses talk; the heat is real either way
      state.heat -= WANTED.crimes.copDown; // but clearing Tito's lot is not a police matter
      addCrime('assault');
    }
    audio.hit();
  }

  function handleEnemies(dt) {
    const p = state.player;
    for (const e of [...state.enemies]) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy);
      e.angle = Math.atan2(dy, dx);
      if (dist < 430 && dist > 190) {
        e.x += Math.cos(e.angle) * 74 * dt;
        e.y += Math.sin(e.angle) * 74 * dt;
        const pos = { x: e.x, y: e.y };
        world.collideCircle(pos, 12);
        e.x = pos.x; e.y = pos.y;
      }
      e.fireCd -= dt;
      if (dist < 380 && e.fireCd <= 0) {
        e.fireCd = range(random, 0.85, 1.6);
        shoot('enemy', e.x, e.y, e.angle + (random() - 0.5) * 0.3, 7);
        audio.shot();
      }
    }
  }

  function handleBullets(dt) {
    const p = state.player;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || world.isBlocked(b.x, b.y);
      if (!dead && b.from === 'player') {
        for (const e of [...state.enemies]) {
          if (Math.hypot(e.x - b.x, e.y - b.y) < 15) {
            e.health -= b.damage;
            fx(e.x, e.y, '#e5534b', 5, 110);
            dead = true;
            if (e.health <= 0) killEnemy(e);
            break;
          }
        }
        if (!dead) {
          for (const ped of state.peds) {
            if (ped.state !== 'down' && ped.state !== 'passenger' && Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
              ped.state = 'down'; ped.timer = 6;
              addCrime('hitPed');
              fx(ped.x, ped.y, PALETTE.danger, 8, 110);
              dead = true;
              break;
            }
          }
        }
        if (!dead) {
          for (const v of state.vehicles) {
            if (Math.hypot(v.x - b.x, v.y - b.y) < 26) {
              v.health -= b.damage * 0.5;
              fx(b.x, b.y, '#f2c94c', 4, 120);
              if (v.kind === 'cop') addCrime('hitCopCar');
              dead = true;
              break;
            }
          }
        }
      }
      if (!dead && b.from === 'enemy') {
        const target = state.mode === 'car' && state.car ? state.car : p;
        const rr = state.mode === 'car' ? 26 : 14;
        if (Math.hypot(target.x - b.x, target.y - b.y) < rr) {
          hurtPlayer(b.damage);
          dead = true;
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
  }

  function handlePickups(dt) {
    const p = state.player;
    state.pickupTimer -= dt;
    if (state.pickupTimer <= 0 && state.pickups.length < 5) {
      state.pickupTimer = range(random, 9, 16);
      const pt = world.roadPointNear(random, p.x, p.y, 200, 620);
      state.pickups.push({ x: pt.x, y: pt.y, kind: pick(random, ['health', 'ammo', 'health', 'ammo', 'cash']), amount: rangeInt(random, 20, 60), bob: random() * 6 });
    }
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      pk.bob += dt * 3;
      const anchor = state.mode === 'car' && state.car ? state.car : p;
      if (Math.hypot(pk.x - anchor.x, pk.y - anchor.y) < 34) {
        if (pk.kind === 'health') { p.health = Math.min(PLAYER.health, p.health + 35); toast('+35 health', 1.6); }
        if (pk.kind === 'ammo') { p.ammo += 18; toast('+18 sidearm ammo', 1.6); }
        if (pk.kind === 'cash') { state.cash += pk.amount; state.stats.earned += pk.amount; toast(`+$${pk.amount}`, 1.6); }
        audio.pickup();
        fx(pk.x, pk.y, '#7dd87d', 7, 90);
        state.pickups.splice(i, 1);
      }
    }
  }

  function handleWanted(dt) {
    let seen = false;
    for (const v of state.vehicles) {
      if (v.kind === 'cop' && Math.hypot(v.x - state.player.x, v.y - state.player.y) < 540) { seen = true; break; }
    }
    if (seen) state.unseenFor = 0;
    else state.unseenFor += dt;
    if (state.unseenFor > WANTED.hideGrace && state.heat > 0) {
      // At dusk the low light works for the player: heat cools off faster.
      const duskFactor = state.dusk ? DUSK.heatDecayFactor : 1;
      state.heat = Math.max(0, state.heat - WANTED.decayPerSecond * dt * (state.unseenFor > 9 ? 2.2 : 1) * duskFactor);
    }
    state.stars = Math.min(WANTED.maxStars, Math.ceil(state.heat / WANTED.perStar));
    if (state.heat <= 0) state.stars = 0;
  }

  function handleMissions(dt, actions) {
    if ((actions & ACTION_MISSION) && !state.mission) startNextMission();
    const stage = currentStage();
    if (!stage) return;
    if (state.mission.timer !== null && state.mission.timer !== undefined) {
      state.mission.timer -= dt;
      if (state.mission.timer <= 0) { failMission('the clock ran out'); return; }
    }
    const target = stageTarget(stage);
    const anchor = state.mode === 'car' && state.car ? state.car : state.player;
    const dist = target ? Math.hypot(target.x - anchor.x, target.y - anchor.y) : Infinity;
    switch (stage.kind) {
      case 'reach':
      case 'collect':
        if (dist < (stage.radius || 70)) advanceStage();
        break;
      case 'stealCar': {
        const car = state.mission.targetCar;
        if (!car) { failMission('the target car is gone'); break; }
        if (state.car === car) advanceStage();
        else if (car.health <= 0) failMission('the Comet was wrecked');
        break;
      }
      case 'deliverCar': {
        const car = state.mission.targetCar;
        if (state.car !== car) {
          if (!car || car.health <= 0) { failMission('the Comet was wrecked'); break; }
          if (state.events.includes('wasted')) break;
          // Walking away from the car mid-delivery is allowed; the marker follows it.
          break;
        }
        if (dist < (stage.radius || 76)) advanceStage();
        break;
      }
      case 'escape':
        if (state.stars === 0 && state.heat <= 0) advanceStage();
        break;
      case 'clear':
        if (state.mission.toClear <= 0) advanceStage();
        break;
      default:
        break;
    }
  }

  function handleFares(dt) {
    if (state.mission) return; // fares wait while Tito's jobs run
    if (!state.fare) {
      state.fareTimer -= dt;
      if (state.fareTimer <= 0) {
        state.fareTimer = range(random, 16, 30);
        const ped = spawnPed(undefined, undefined, true);
        if (Math.hypot(ped.x - state.player.x, ped.y - state.player.y) > 90) {
          const destPlace = pick(random, Object.values(world.places));
          state.fare = { phase: 'pickup', ped, dest: { x: destPlace.x, y: destPlace.y }, destName: destPlace.name, paid: 0 };
          toast(SIDE_TEXT.farePrompt, 3.4);
        } else {
          state.peds.splice(state.peds.indexOf(ped), 1);
        }
      }
      return;
    }
    const fare = state.fare;
    if (fare.phase === 'pickup') {
      if (!fare.ped || !state.peds.includes(fare.ped)) { state.fare = null; return; }
      if (state.mode === 'car' && state.car && Math.abs(state.car.speed) < 24
        && Math.hypot(fare.ped.x - state.car.x, fare.ped.y - state.car.y) < 56) {
        fare.ped.state = 'passenger';
        fare.phase = 'dropoff';
        fare.startDist = Math.hypot(fare.dest.x - state.car.x, fare.dest.y - state.car.y);
        audio.door();
        toast(`Fare aboard — take them to ${fare.destName}.`, 3.4);
      }
      return;
    }
    // Dropoff.
    if (state.mode !== 'car') { // passenger steps out with you; fare waits
      return;
    }
    if (Math.hypot(fare.dest.x - state.car.x, fare.dest.y - state.car.y) < 74 && Math.abs(state.car.speed) < 30) {
      const pay = payWithDusk(FARE_PAY.base + fare.startDist * FARE_PAY.perUnit, state.dusk);
      state.cash += pay.amount;
      state.stats.earned += pay.amount;
      state.stats.faresDone += 1;
      if (fare.ped) {
        fare.ped.state = 'walk';
        fare.ped.x = state.car.x + 30;
        fare.ped.y = state.car.y + 16;
      }
      toast(pay.bonus > 0 ? `Fare paid $${pay.amount} (incl. $${pay.bonus} dusk bonus).` : `Fare paid $${pay.amount}.`, 3);
      audio.cash();
      state.fare = null;
      state.fareTimer = range(random, 14, 26);
      state.saveDirty = true;
    }
  }

  function updateFx(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const fxP = state.particles[i];
      fxP.x += fxP.vx * dt;
      fxP.y += fxP.vy * dt;
      fxP.vx *= 0.92;
      fxP.vy *= 0.92;
      fxP.life -= dt;
      if (fxP.life <= 0) state.particles.splice(i, 1);
    }
    if (state.banner && state.time > state.banner.until) state.banner = null;
    if (state.toast && state.time > state.toast.until) state.toast = null;
  }
}
