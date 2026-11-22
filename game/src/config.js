// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size. The HUD
// band sits at the top of the field; the gallery room runs below it.

export const FIELD = { width: 1280, height: 720, hudHeight: 56, wall: 24 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The thief: quick on foot, half speed and half as noticeable while sneaking. */
export const THIEF = {
  radius: 13,
  walkSpeed: 205,
  sneakSpeed: 102,
  catchRadius: 26,
};

export const TIMER_START = 180;

/** The alarm meter: 0 to 100. Seen, it climbs; hidden, it falls. At 100 the thief is caught. */
export const ALARM = {
  max: 100,
  risePerSecond: 55,
  fallPerSecond: 12,
  closeBonus: 1.6,
  sneakFactor: 0.45,
};

/** Guards walk their beats; a guard that spots the thief raises the alarm, and one that
 *  touches the thief catches them outright. */
export const GUARD = {
  radius: 14,
  patrolSpeed: 88,
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
  count: 3,
  flySeconds: 0.45,
  lureRadius: 330,
  inspectSeconds: 2.2,
};

export const LIVES = 1;

/** Points: small loot on the way, the diamond itself, and what is left when you escape. */
export const SCORE = {
  smallLoot: 150,
  diamond: 1000,
  coinLeft: 25,
  timePerSecond: 5,
};

/** The room's palette: deep green marble, brass, and warm lamplight, so cover, danger and
 *  loot read at a glance even when the screenshot is shrunk to a contact sheet. */
export const PALETTE = {
  backdrop: '#0c1210',
  hud: '#101a16',
  hudEdge: '#2b3f36',
  floorA: '#1d2f27',
  floorB: '#182720',
  carpet: '#7a2e35',
  carpetEdge: '#c9a227',
  wall: '#3a2f22',
  wallTop: '#5a4630',
  glass: 'rgba(140, 200, 220, 0.20)',
  pedestal: '#4a3b28',
  crate: '#6b4e2e',
  plant: '#2f6b3a',
  plantDark: '#1e4a28',
  guard: '#2c3e55',
  guardCap: '#1a2636',
  cone: 'rgba(242, 201, 76, 0.20)',
  coneEdge: 'rgba(242, 201, 76, 0.55)',
  camCone: 'rgba(229, 83, 75, 0.16)',
  camConeEdge: 'rgba(229, 83, 75, 0.5)',
  camera: '#8a94a3',
  thief: '#12b5a5',
  thiefDark: '#0a7d72',
  loot: '#f2c94c',
  lootGlow: 'rgba(242, 201, 76, 0.35)',
  exit: '#3fae5a',
  alarmLow: '#3fae5a',
  alarmMid: '#f2c94c',
  alarmHigh: '#e5534b',
  text: '#eef1f5',
  muted: '#9aa79e',
  panel: '#17241e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gilded-vault.best';
