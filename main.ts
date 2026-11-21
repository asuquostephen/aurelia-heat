// A working gta6-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. Only the plumbing, not an open world: Block
// Dodger, a plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a
// title screen, score, lives and levels, game over and restart, flat colours and no sound. Build
// your own open-world crime game in its place (three.js or any library you vendor under game/),
// put your 3 or 4 PNG or JPEG screenshots in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

// ============================================================================
// Aurelia Heat — Port Aurelia (make.fun bounty gta6-01)
// An original top-down open-world crime game in vanilla JavaScript + Canvas:
// a seeded procedural city of four districts, stealable cars in five classes,
// traffic and pedestrian AI, a five-star heat system with intercepting patrol
// cars and a bust meter, mouse-aimed combat against the Saltline Crew, six
// chained jobs for fixer Marlo Venn, repeatable taxi fares, procedural Web
// Audio sound, localStorage saves — and Dusk Mode, which tints the city,
// lights the lamps, cools heat faster and pays a 25% dusk bonus.
// This entrypoint hands the game in: it copies game/ and screenshots/ to the
// output directory and writes dossier.json with the vendored library below.
// ============================================================================

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Aurelia Heat runtime inventory: list every game source file with its line
// count and print the total, so a hand-in log shows exactly what shipped.
const gameSrcDir = join(here, 'game', 'src');
const inventoryNames = readdirSync(gameSrcDir).filter((name) => name.endsWith('.js')).sort();
let inventoryTotal = 0;
for (const name of inventoryNames) {
  const text = readFileSync(join(gameSrcDir, name), 'utf8');
  const lines = text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  inventoryTotal += lines;
  console.log(`aurelia-heat source: game/src/${name} — ${lines} lines`);
}
const indexLines = readFileSync(join(here, 'game', 'index.html'), 'utf8').split('\n').length - 1;
inventoryTotal += indexLines;
console.log(`aurelia-heat source: game/index.html — ${indexLines} lines`);
console.log(`aurelia-heat inventory total: ${inventoryTotal} lines across ${inventoryNames.length + 1} files`);

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
