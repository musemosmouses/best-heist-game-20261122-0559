// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size. The HUD
// band sits at the top of the field; the gallery room runs below it.

export const FIELD = { width: 1280, height: 720, hudHeight: 56, wall: 24 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The thief: quick on foot, half speed and half as noticeable while sneaking. */
export const THIEF = {
  radius: 16,
  walkSpeed: 205,
  sneakSpeed: 102,
  catchRadius: 26,
};

export const TIMER_START = 180;

/** Laser grids: a sweeping beam from a wall emitter. Crossing the beam trips the alarm
 *  fast — the beam is thin, so a careful thief slips through between sweeps, but a
 *  careless one is caught in the light. */
export const LASER = {
  sweepSpeed: 0.5,
  triggerDist: 14,
  risePerSecond: 70,
};

/** Wall safes: hold E beside one to crack it. Cracking while seen raises the alarm. */
export const SAFE = {
  crackSeconds: 3,
  points: 250,
  range: 52,
};

/** Three nights, one gallery, rising heat. Night 1 is the gallery as it stands; Night 2
 *  wires the laser grid, adds a sixth guard and two crackable wall safes; Night 3 adds a
 *  seventh guard, a tighter timer and two more pieces of small loot. */
export const NIGHTS = [
  { name: 'The Gallery', guards: 5, lasers: 0, timer: 180, extraLoot: 0, safes: 0 },
  { name: 'Laser Grid', guards: 6, lasers: 2, timer: 180, extraLoot: 0, safes: 2 },
  { name: 'Seven Guards', guards: 7, lasers: 2, timer: 150, extraLoot: 2, safes: 2 },
];

/** The alarm meter: 0 to 100. Seen, it climbs; hidden, it falls. At 100 the thief is caught.
 *  Under 50 the gallery is CALM, 50 to 74 WARY, 75 and up HUNTED — each stage its own
 *  colour, label and sound cue. */
export const ALARM = {
  max: 100,
  risePerSecond: 55,
  fallPerSecond: 12,
  closeBonus: 1.6,
  sneakFactor: 0.45,
  waryAt: 50,
  huntedAt: 75,
};

/** Guards walk their beats; a guard that spots the thief raises the alarm, and one that
 *  touches the thief catches them outright. Three kinds walk the gallery: patrol guards on
 *  their rounds, a sweeper who crosses the hall fast, and a watcher who stands still and
 *  scans. */
export const GUARD = {
  radius: 16,
  patrolSpeed: 88,
  sweeperSpeed: 128,
  watcherScanSpeed: 0.9,
  watcherScan: 1.1,
  hurrySpeed: 118,
  sightRange: 250,
  sightHalfAngle: 0.56,
  turnSpeed: 5.5,
};

/** Wall cameras sweep their cones back and forth and never blink. */
export const CAMERA = {
  sightRange: 285,
  sightHalfAngle: 0.44,
  sweepSpeed: 0.55,
};

/** Lure coins: tossed with a click or E, they clink and pull the nearest guard over to look. */
export const COIN = {
  count: 4,
  flySeconds: 0.45,
  lureRadius: 330,
  inspectSeconds: 2.2,
};

/** Smoke pellets: burst with Q at the thief's feet, a grey cloud that blinds every cone and
 *  camera while the thief stands inside it. Each one costs 2 coins, so a smoke is a lure
 *  forgone — the HUD shows how many the coin purse can still afford. */
export const SMOKE = {
  costCoins: 2,
  radius: 170,
  seconds: 4,
};

export const LIVES = 1;

/** Points: small loot on the way, the diamond itself, and what is left when you escape. */
export const SCORE = {
  smallLoot: 150,
  diamond: 1000,
  safe: 250,
  coinLeft: 25,
  timePerSecond: 5,
};

/** The room's palette: warm parquet and brass under lamplight, so cover, danger and loot
 *  read at a glance even when the screenshot is shrunk to a contact sheet. Safe cover is
 *  lush green, danger is amber and red, loot is gold. */
export const PALETTE = {
  backdrop: '#0c1210',
  hud: '#14100c',
  hudEdge: '#4a3823',
  floorA: '#7b5433',
  floorB: '#6e4a2c',
  floorC: '#835c38',
  plankLine: 'rgba(0, 0, 0, 0.28)',
  carpet: '#8a2f38',
  carpetEdge: '#c9a227',
  wall: '#3a2f22',
  wallTop: '#5a4630',
  wallShadow: 'rgba(0, 0, 0, 0.35)',
  lampGlow: 'rgba(255, 190, 90, 0.10)',
  glass: 'rgba(140, 200, 220, 0.20)',
  pedestal: '#4a3b28',
  crate: '#6b4e2e',
  plant: '#2f8b46',
  plantDark: '#1e5a30',
  plantHalo: 'rgba(80, 200, 110, 0.16)',
  smoke: 'rgba(205, 205, 210, 0.38)',
  smokeEdge: 'rgba(230, 230, 235, 0.55)',
  guard: '#2c3e55',
  guardCap: '#1a2636',
  cone: 'rgba(242, 201, 76, 0.26)',
  coneEdge: 'rgba(242, 201, 76, 0.7)',
  coneSeen: 'rgba(229, 83, 75, 0.30)',
  coneSeenEdge: 'rgba(229, 83, 75, 0.85)',
  camCone: 'rgba(229, 83, 75, 0.20)',
  camConeEdge: 'rgba(229, 83, 75, 0.6)',
  camera: '#8a94a3',
  laser: '#ff3b30',
  laserBeam: 'rgba(255, 59, 48, 0.45)',
  laserCore: '#ff8a80',
  laserHot: '#ff1744',
  safe: '#c9a227',
  safeDark: '#6b5312',
  minimapBg: 'rgba(8, 12, 10, 0.82)',
  minimapEdge: '#4a3823',
  thief: '#12b5a5',
  thiefDark: '#0a7d72',
  thiefCloak: '#0d3f3a',
  loot: '#f2c94c',
  lootGlow: 'rgba(242, 201, 76, 0.35)',
  exit: '#3fae5a',
  alarmLow: '#3fae5a',
  alarmMid: '#f2c94c',
  alarmHigh: '#e5534b',
  text: '#eef1f5',
  muted: '#b9c2b4',
  panel: '#17241e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gilded-vault.best';
