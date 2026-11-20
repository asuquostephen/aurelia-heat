# aurelia-heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/asuquostephen/aurelia-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/asuquostephen/aurelia-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Aurelia Heat** — a complete, original open-world crime game that plays offline in a
desktop browser from static files. No build step, no libraries, no network requests:
open `game/index.html` and play. Built by an AI agent for the make.fun bounty
[gta6-01](https://make.fun/bounty/gta6-01) ("Make GTA 6"). Every name, street, story
and line of art in Port Aurelia is invented for this game — nothing here is from
Rockstar Games.

You are Jules Rook, back in the coastal city of Port Aurelia after six years away,
broke. Your old friend Tito Marchetti has work. Six jobs later, the city is yours.

## What's in the city

- **A full city, on foot and by car** — a 3600×3600 grid of avenues and blocks in
  four districts (Old Town, Palm Heights, Dockside, Downtown Aurelia), with a
  central park, named places (Tito's Garage, Pier 9, the Palm Heights Hotel, Aurelia
  General hospital, the Airfield Gate, Coral Beach), a beach and the sea.
- **Traffic and pedestrians** — AI cars follow the avenues with right-hand-traffic
  lanes, queue behind each other and turn at junctions; pedestrians stroll the
  sidewalks, hail fares, and run when things get loud.
- **Cars to steal** — walk up to any parked or driven car and press E. Carjack a
  driven car and the driver bails; take Tito's marked Comet coupe in mission 2.
  Five vehicle classes (sedan, taxi, sport, truck, patrol) with different speeds,
  hull damage and smoke.
- **A wanted system and police** — crimes (carjacking, assault, gunfire, hitting a
  pedestrian or a patrol car) raise heat across five stars. Patrol cars spawn with
  your stars, hunt you with sirens and light bars, ram you, and fill a BUST meter
  when they corner you at low speed. Break line of sight and stay hidden to cool off.
- **Missions and a story** — six chained jobs for Tito: Homecoming, Hot Wheels
  (steal and deliver the coupe), Dock Run (a timed delivery), Heat Check (lose a
  forced three-star chase), Rooftop Rivals (clear five Vane crew shooters from a
  Downtown lot) and The Aurelia Job (three cash bags, then the airfield, wanted).
  Between jobs, pedestrians hail **taxi fares** that pay by distance.
- **Combat** — mouse-aimed sidearm with limited ammo, punches, enemy gunmen who
  close in and shoot back, health/ammo/cash pickups, WASTED (hospital, 10% bill)
  and BUSTED (fines) consequences.
- **HUD and minimap** — cash, objective line with distance and timers, wanted
  stars, district name, health/ammo/hull/speed readouts, and a live minimap with
  roads, the objective marker, police blips and pickups.
- **A start and a save** — title screen with the story and controls, pause screen,
  a story-complete screen, and progress (cash, job progress, stats) saved to
  `localStorage` automatically and with the K key.
- **Procedural sound** — Web Audio synthesis only: shots, crashes, pickups, mission
  stingers, an engine note tied to your speed and a two-tone siren that swells as
  patrol cars close in. No audio files.
- **Dusk mode** — press **L** and the light drops over Port Aurelia: a violet dusk
  tint settles on the city, the street lamps throw warm pools of light, and
  crickets chirp under the engine and sirens. The city pays for the dark — jobs
  and taxi fares pay **25% more** while dusk is active (the bonus is itemised in
  the reward text) — and police heat cools off faster in the low light. Press L
  again to bring the light back.

## Controls

| Input | Action |
|---|---|
| WASD / arrow keys | Move on foot / drive |
| Mouse | Aim |
| Left click | Shoot (on foot) |
| Space | Punch |
| E | Enter / exit a car (steal it) |
| Shift | Sprint on foot |
| M | Start Tito's next job |
| L | Toggle dusk mode (+25% job and fare pay, faster heat decay) |
| K | Save progress |
| P / Esc | Pause |

## Layout

- `main.ts` — the hand-in program (Node 22, standard library only): copies `game/`
  and `screenshots/` to `/output` and writes `/output/dossier.json` with the
  vendored make.fun library, exactly as the bounty requires.
- `serve.ts` — a tiny local server: `node serve.ts`, then open
  http://localhost:8080.
- `game/index.html` — the game page; everything under `game/` is plain static files.
- `game/src/` — the game itself, in ES modules with no dependencies:
  `config.js` (tuning), `random.js` (seeded RNG — the same seed grows the same
  city), `world.js` (the city: avenues, blocks, buildings, collision, places),
  `game.js` (the simulation: player, traffic AI, police AI, pedestrians, combat,
  wanted, missions, fares, pickups, save data), `missions.js` (the six-job story,
  as data), `render.js` (canvas renderer, HUD, minimap, screens), `input.js`
  (keyboard/mouse), `audio.js` (synthesised sound), `shots.js` (the staged
  screenshot scenes behind `?shot=start|play|end|dusk`), `main.js` (boot and the loop).
- `screenshots/` — three screens of the game running (`shots.json` lists the
  `?shot=` URLs they were taken from).
- `vendor/makefun-game.ts` — make.fun's dossier library, vendored byte for byte.

## Running

```sh
node serve.ts          # then open http://localhost:8080
# or serve game/ with any static file server, or open game/index.html directly
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # the hand-in, as the grader runs it
```

MIT licensed — see `LICENSE`.
