# Aurelia Heat — Port Aurelia

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/asuquostephen/aurelia-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/asuquostephen/aurelia-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Aurelia Heat is an original top-down open-world crime game for desktop
browsers, written in vanilla JavaScript and rendered on a single Canvas.
There is no build step, no library, no external asset and no network request:
every street, sound and screenshot comes from the code in `game/`.

Competition: [make.fun — gta6-01](https://make.fun/bounty/gta6-01)

## The city

Port Aurelia is a seeded procedural city, 3600 by 3600 world units, identical
for a given seed on every machine. An avenue grid divides it into four named
districts — Old Town, Palm Heights, Dockside and Downtown Aurelia — with
around ninety buildings (roof units, water tanks, the odd helipad), a central
park called Aurelia Green, street lamps at every junction, nine named places,
and a beach that runs down into open sea along the southern edge.

## What you can do

- **Explore on foot and by car.** Walk, sprint, and press E beside any car to
  get in. Steal a driven car and the driver bails out and flees — that is a
  carjacking, and the law notices. Five vehicle classes (compact, sedan,
  coupe, van, muscle) drive at genuinely different speeds, take hull damage,
  smoke as they break, and collide with buildings and each other.
- **Live traffic and pedestrians.** Traffic keeps to the right-hand lane,
  brakes for the car ahead, turns at junctions, and respawns near you so the
  city never empties. Pedestrians wander the sidewalks, flee gunfire and fast
  cars, can be knocked down, and occasionally hail you with a $ marker: pick
  them up in any car and the drop-off fare pays by distance.
- **Wanted system and police.** Crimes — carjacking, theft, assault, gunfire,
  hit-and-run, ramming a patrol car — feed a heat meter shown as one to five
  stars. Patrol cars spawn to match your stars, chase with predicted
  intercept, flash their light bars, wail procedurally, and ram. If they
  corner you while you are slow or on foot, the BUST meter fills: a bust means
  fines and a wake-up at Aurelia Clinic. Heat only decays while no patrol can
  see you, after a grace period, and faster the longer you stay hidden. At
  three stars and up, patrols also throw a roadblock of unmanned interceptors
  across the avenue ahead of a fleeing driver — ram through at speed and the
  cars shove aside (and it counts as ramming a patrol car), squeeze off-road
  around it, turn back, or steal the middle car to open the barrier. The
  roadblock crews keep eyes on you, so a roadblock also stops your heat
  cooling and can bust a cornered driver.
- **Combat.** Aim with the mouse and click to fire a sidearm with limited
  ammo, spread and tracer lines; Space punches. The Saltline Crew's gunmen
  advance and shoot back under their own health bars. Health, ammo and cash
  pickups are scattered at the city's named places. Getting wasted costs a
  hospital bill of ten percent of your cash.
- **Six chained jobs.** Fixer Marlo Venn, working out of an Old Town garage,
  sends you to reach the market, steal and deliver a coupe, beat a timed
  delivery, escape a framed three-star wanted level, clear five Saltline
  gunmen at the harbour, and finally collect three cash bags downtown and
  lose the law. Intro and outro dialogue, cash rewards, a story-complete
  screen — then free roam.
- **Dusk Mode.** Press L and Port Aurelia falls into dusk: the palette shifts,
  street lamps glow, heat decays faster, the engine note and ambience change,
  and every mission and fare payout gains a 25 percent dusk bonus, itemised
  in the completion banner.
- **HUD and minimap.** Cash, wanted stars, current district, objective text
  with distance (and countdown timers where a job is timed), a health bar,
  ammo, and — while driving — speed and hull readouts. The live minimap shows
  roads, water, your objective, police blips, pickups and your heading arrow.
- **Sound with no audio files.** Gunshots, punches, crashes, pickups, mission
  stingers, busted and wasted falls, a speed-tied engine note and a two-tone
  siren that swells as patrols close in — all synthesised with Web Audio, and
  all starting only after your first key press or click.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move on foot, drive |
| Mouse | Aim |
| Click | Shoot |
| Space | Punch |
| E | Enter / exit car (steal it) |
| Shift | Sprint |
| M | Start the next job from Marlo |
| K | Save progress |
| L | Toggle Dusk Mode |
| P / Esc | Pause |
| Enter / click | Start from the title screen |

Progress — cash, mission index, ammo, Dusk Mode and your stats — is stored in
`localStorage`, autosaved whenever a job or fare completes, and saved manually
with K.

## Run it locally

```sh
node serve.ts
```

Then open the local address it prints (http://localhost:8080) in a desktop
browser. Any static file server pointed at `game/` works just as well.

Deterministic screenshot scenes are built in for captures:

- `?shot=start&seed=1` — the title screen
- `?shot=play&seed=1` — a three-star chase in Downtown Aurelia
- `?shot=end&seed=1` — the story-complete screen
- `?shot=roadblock&seed=1` — a four-star roadblock across a Downtown avenue

Each staged scene sets `window.__shotReady` once it is drawn.

## Handing the entry in

```sh
node main.ts
```

The entrypoint copies `game/` and `screenshots/` to the output directory
(`/output`, or `$MAKEFUN_OUTPUT_DIR` outside the grader), prints a line-count
inventory of the game sources, and writes `dossier.json` using the vendored
`buildDossier` from `vendor/makefun-game.ts`.

## Layout

- `game/index.html` — the page; its only script is `./src/main.js`
- `game/src/config.js` — tuning constants, districts, heat and payout maths
- `game/src/random.js` — seeded generator and geometry helpers
- `game/src/world.js` — procedural generation of Port Aurelia
- `game/src/game.js` — the whole simulation: player, traffic, police, combat, missions, saves
- `game/src/missions.js` — Marlo's six jobs, fare maths, story text
- `game/src/render.js` — world, actors, HUD, minimap and screens
- `game/src/input.js` — keyboard and mouse tracking
- `game/src/audio.js` — procedural Web Audio engine
- `game/src/shots.js` — deterministic screenshot staging
- `game/src/main.js` — browser bootstrap and the frame loop
