// The story of Aurelia Heat, in six missions. Jules Rook comes home to Port Aurelia
// broke; his old friend Tito Marchetti runs a garage in Dockside and has work. Each
// mission is data: an intro line, a reward, and a list of stages. A stage is one
// objective with a map marker, an optional timer, an optional wanted twist and a
// completion test the simulation runs ('reach', 'deliverCar', 'escape', 'clear',
// 'collect'). The simulation in game.js interprets the stages; this file is only
// the writing and the numbers, so the story can be read top to bottom.

export const CONTACT = 'TITO';

export const INTRO_LINES = [
  'Port Aurelia. Jules Rook has been gone six years.',
  'He came back with one bag, no money, and a phone number.',
  'Tito still owes him. Time to collect — in work, not cash.',
];

export const MISSIONS = [
  {
    id: 'homecoming',
    title: 'Homecoming',
    reward: 150,
    intro: 'TITO: "Jules? That really you? Get over to my garage in Dockside. We need to talk."',
    stages: [
      { kind: 'reach', place: 'garage', text: "Get to Tito's Garage in Dockside", radius: 70 },
    ],
    outro: 'TITO: "Look at you. Six years and the city still fits. I got work, if your hands remember how."',
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    reward: 400,
    intro: 'TITO: "A collector in Palm Heights parks a red Comet coupe outside the hotel. Bring it to me. Unmarked, ideally."',
    stages: [
      { kind: 'reach', place: 'heights', text: 'Go to the Palm Heights Hotel', radius: 80 },
      { kind: 'stealCar', text: 'Steal the red Comet coupe', radius: 90 },
      { kind: 'deliverCar', place: 'garage', text: 'Deliver the Comet to the garage — keep it rolling', radius: 76 },
    ],
    outro: 'TITO: "Beautiful. She purrs. The collector cries, we eat. Aurelia provides, Jules."',
  },
  {
    id: 'dock-run',
    title: 'Dock Run',
    reward: 550,
    intro: 'TITO: "Package waiting at Pier 9. Hotel wants it before the kitchen closes. Clock is real on this one."',
    stages: [
      { kind: 'reach', place: 'docks', text: 'Pick up the package at Pier 9', radius: 70 },
      { kind: 'reach', place: 'heights', text: 'Deliver to the Palm Heights Hotel — fast', radius: 80, timer: 150 },
    ],
    outro: 'TITO: "On time. The chef sends his love and something greener. You are getting your touch back."',
  },
  {
    id: 'heat-check',
    title: 'Heat Check',
    reward: 650,
    intro: 'TITO: "You clipped a patrol car on that run and half the force knows your face. Shake them. All of them."',
    stages: [
      { kind: 'escape', text: 'Lose the police completely (0 stars)', forcedStars: 3 },
    ],
    outro: 'TITO: "Gone like a rumour. Lay low a minute... then come see me. Something bigger is moving."',
  },
  {
    id: 'rooftop-rivals',
    title: 'Rooftop Rivals',
    reward: 900,
    intro: 'TITO: "The Vane crew is squatting my Downtown lot and taxing my drivers. Five of them. Move them on, Jules."',
    stages: [
      { kind: 'reach', place: 'downtown', text: 'Go to the Downtown Plaza lot', radius: 90 },
      { kind: 'clear', place: 'downtown', text: 'Clear the Vane crew from the lot', count: 5, radius: 190 },
    ],
    outro: 'TITO: "Lot is ours again. One more job, the big one, and we are both out of the rain for good."',
  },
  {
    id: 'the-aurelia-job',
    title: 'The Aurelia Job',
    reward: 2000,
    intro: 'TITO: "Three cash bags, three drops the Vane crew left guarded by nothing but distance. Grab all three, then the airfield gate. Do not stop."',
    stages: [
      { kind: 'collect', place: 'beach', text: 'Grab the cash bag at Coral Beach (1 of 3)', radius: 64 },
      { kind: 'collect', place: 'park', text: 'Grab the cash bag in Aurelia Park (2 of 3)', radius: 64 },
      { kind: 'collect', place: 'hideout', text: 'Grab the cash bag at the Old Town Safehouse (3 of 3)', radius: 64 },
      { kind: 'reach', place: 'airport', text: 'Reach the Airfield Gate with the money', radius: 84, wantedOnStart: 3 },
    ],
    outro: 'TITO: "That is the city, Jules. That is the whole beautiful city, and tonight it paid rent. Aurelia is yours now."',
  },
];

export const FARE_PAY = { base: 60, perUnit: 0.09 };

export const SIDE_TEXT = {
  farePrompt: 'A pedestrian is waving for a ride.',
  missionPrompt: 'Press M to start the next job for Tito.',
  freeroam: 'Free roam — fares ($) pay cash, or press M for Tito\'s next job.',
  storyDone: 'Story complete. Port Aurelia is yours — fares and free roam continue.',
};
