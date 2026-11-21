// Aurelia Heat — story jobs and taxi fares.
// Fixer Marlo Venn works out of a garage in Old Town. Six chained jobs tell
// one small story: a favour, a theft, a rush job, a frame-up, a crew war and
// a final payday. Each job is data plus a tiny state machine the core game
// ticks; fares are the repeatable free-roam earner layered on top.

import { payoutWithDusk } from './config.js';

export const FIXER_NAME = 'Marlo Venn';
export const CREW_NAME = 'the Saltline Crew';

export const MISSIONS = [
  {
    id: 'first-steps',
    title: 'First Steps',
    kind: 'goto',
    targetPlace: 'market',
    reward: 150,
    intro: 'Marlo: "You want work in Port Aurelia, you walk my streets first. Get to Old Town Market — on foot or wheels, I do not care. Just be seen."',
    outro: 'Marlo: "Good. The city knows your face now. Come back to the garage when you want real money."',
    objective: 'Reach Old Town Market',
  },
  {
    id: 'borrowed-coupe',
    title: 'Borrowed Coupe',
    kind: 'steal-deliver',
    vehicleClass: 'coupe',
    reward: 400,
    intro: 'Marlo: "A Vireo Coupe near Palm Court is borrowed, not bought — the owner just does not know yet. Take it and bring it to my garage. Any coupe will do."',
    outro: 'Marlo: "Clean lines, hot engine. You have a talent for other people\'s property."',
    objective: 'Steal a Vireo Coupe and deliver it to the garage',
  },
  {
    id: 'rush-order',
    title: 'Rush Order',
    kind: 'timed-deliver',
    targetPlace: 'depot',
    timeLimit: 75,
    reward: 550,
    intro: 'Marlo: "Package in the boot, clock on the dash. South Depot in seventy-five seconds or the buyer walks. Move!"',
    outro: 'Marlo: "On time, no dents in the story. The buyer sends his thanks — and his cash."',
    objective: 'Reach South Depot before the timer runs out',
  },
  {
    id: 'framed',
    title: 'Framed',
    kind: 'escape',
    forcedStars: 3,
    reward: 700,
    intro: 'Marlo: "Someone tipped the patrols with your plates and your face. Three stars, kid. Lose them — stay out of sight until the heat dies."',
    outro: 'Marlo: "Gone like harbour fog. Whoever framed you just learned you are hard to hold."',
    objective: 'Escape the wanted level — stay unseen until heat clears',
  },
  {
    id: 'saltline',
    title: 'Saltline Static',
    kind: 'clear-gunmen',
    gunmen: 5,
    nearPlace: 'harbour',
    reward: 1100,
    intro: 'Marlo: "The Saltline Crew jumped my courier at the harbour. Five of them, all armed. Clear them out — and watch your own health, hero."',
    outro: 'Marlo: "The harbour is quiet again. The Saltline will think twice before taxing my people."',
    objective: 'Clear 5 Saltline gunmen near Aurelia Harbour',
  },
  {
    id: 'three-bags',
    title: 'Three Bags',
    kind: 'collect-escape',
    bags: 3,
    reward: 2000,
    intro: 'Marlo: "Last job. Three cash bags dropped around Downtown — grab them all, then lose the law. Do that and Port Aurelia is yours."',
    outro: 'Marlo: "Three bags, no cuffs, one legend. Port Aurelia is yours now, kid. Keep it warm."',
    objective: 'Collect 3 cash bags downtown, then escape the wanted level',
  },
];

export function missionByIndex(index) {
  return MISSIONS[index] || null;
}

export function createMissionState() {
  return {
    activeIndex: -1,
    phase: 'idle', // idle | active | done
    timer: 0,
    progress: 0,
    deliveredVehicleId: null,
    banner: null,
    bannerTimer: 0,
  };
}

export function startMission(state, index) {
  const def = missionByIndex(index);
  if (!def) return null;
  state.activeIndex = index;
  state.phase = 'active';
  state.progress = 0;
  state.deliveredVehicleId = null;
  state.timer = def.timeLimit || 0;
  return def;
}

export function missionReward(def, dusk) {
  return payoutWithDusk(def.reward, dusk);
}

export function fareReward(distanceWorldUnits, dusk) {
  const base = Math.max(40, Math.round(distanceWorldUnits / 14));
  const pay = payoutWithDusk(base, dusk);
  return { base, total: pay.total, bonus: pay.bonus };
}

export function completionBanner(def, dusk) {
  const pay = missionReward(def, dusk);
  if (pay.bonus > 0) {
    return `Job complete: ${def.title} — $${pay.total} (includes $${pay.bonus} dusk bonus)`;
  }
  return `Job complete: ${def.title} — $${pay.total}`;
}

export function fareBanner(distanceWorldUnits, dusk) {
  const pay = fareReward(distanceWorldUnits, dusk);
  if (pay.bonus > 0) {
    return `Fare paid: $${pay.total} (includes $${pay.bonus} dusk bonus)`;
  }
  return `Fare paid: $${pay.total}`;
}

export const STORY_INTRO = 'Port Aurelia glitters and rots in equal measure. You arrive with empty pockets and one name in your phone: Marlo Venn, a fixer who pays cash and asks nothing twice. Six jobs stand between you and owning these streets.';
export const STORY_OUTRO = 'Six jobs done. The garage lights stay on for you now, the crews know your silhouette, and Port Aurelia — avenues, harbour and all — answers when you call. Free roam is yours: run fares, chase dusk bonuses, and keep the heat off your back.';
