// The Meridian Gallery after hours: one room the thief crosses, its walls, the display cases
// and crates that block sight, the potted palms that hide a thief, the vault alcove holding the
// Sunspire Diamond, and the service exit. Also the line-of-sight test the guards and cameras
// share: a sight line is blocked when it crosses any solid rectangle.
import { FIELD, NIGHTS } from './config.js';

export const ROOM = {
  x: FIELD.wall,
  y: FIELD.hudHeight + FIELD.wall,
  width: FIELD.width - FIELD.wall * 2,
  height: FIELD.height - FIELD.hudHeight - FIELD.wall * 2,
};

/** Does the segment (x1,y1)-(x2,y2) cross the rectangle? Slab test, inclusive on the edges. */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  const axes = [
    { d: dx, p: x1, lo: rect.x, hi: rect.x + rect.width },
    { d: dy, p: y1, lo: rect.y, hi: rect.y + rect.height },
  ];
  for (const axis of axes) {
    if (axis.d === 0) {
      if (axis.p < axis.lo || axis.p > axis.hi) return false;
    } else {
      let t0 = (axis.lo - axis.p) / axis.d;
      let t1 = (axis.hi - axis.p) / axis.d;
      if (t0 > t1) {
        const swap = t0;
        t0 = t1;
        t1 = swap;
      }
      tMin = Math.max(tMin, t0);
      tMax = Math.min(tMax, t1);
      if (tMin > tMax) return false;
    }
  }
  return true;
}

/** True when nothing solid stands between the two points. */
export function lineOfSight(x1, y1, x2, y2, solids) {
  for (const solid of solids) {
    if (segmentHitsRect(x1, y1, x2, y2, solid)) return false;
  }
  return true;
}

/** Keep a point inside the room, clear of the walls. */
export function clampToRoom(x, y, radius) {
  return {
    x: Math.min(ROOM.x + ROOM.width - radius, Math.max(ROOM.x + radius, x)),
    y: Math.min(ROOM.y + ROOM.height - radius, Math.max(ROOM.y + radius, y)),
  };
}

/**
 * The gallery, laid out once: the vault alcove top-right with the diamond's pedestal, the
 * service exit bottom-left, display cases and crates as sight-blocking cover, potted palms as
 * hiding spots, three small-loot pieces on the way, and the beats the guards walk.
 *
 * `night` (1-3) raises the heat: Night 2 adds a sixth guard, two sweeping laser grids and
 * two crackable wall safes; Night 3 adds a seventh guard, a tighter timer and two more
 * pieces of small loot. The layout itself never changes, so every night is still the same
 * gallery the thief knows — only the watch gets harder.
 */
export function buildLevel(random, night) {
  const nightIndex = night === 2 ? 1 : night === 3 ? 2 : 0;
  const spec = NIGHTS[nightIndex];
  const solids = [
    // The vault alcove: three solid walls, open at the bottom where the thief slips in —
    // and a side passage cut through its west wall, a second way into the vault that
    // skips Brine's beat along the south side.
    { x: 1010, y: ROOM.y, width: 18, height: 90 },
    { x: 1010, y: ROOM.y + 150, width: 18, height: 40 },
    { x: 1010, y: ROOM.y, width: 222, height: 18 },
    { x: 1010, y: ROOM.y + 172, width: 130, height: 18 },
    // Display cases and crates: solid cover the thief ducks behind.
    { x: 380, y: 210, width: 120, height: 58 },
    { x: 760, y: 180, width: 120, height: 58 },
    { x: 560, y: 330, width: 112, height: 68 },
    { x: 980, y: 330, width: 118, height: 68 },
    { x: 430, y: 470, width: 220, height: 52 },
    // A crate guarding the side passage's mouth, cover for the second route in.
    { x: 860, y: 180, width: 90, height: 44 },
  ];
  const plants = [
    { x: 300, y: 520, radius: 40 },
    { x: 900, y: 520, radius: 40 },
    { x: 640, y: 560, radius: 34 },
    { x: 180, y: 300, radius: 34 },
    { x: 950, y: 300, radius: 30 },
  ];
  const smallLoot = [
    { x: 440, y: 360, taken: false, kind: 'bar' },
    { x: 850, y: 590, taken: false, kind: 'case' },
    { x: 250, y: 170, taken: false, kind: 'bar' },
    // A gold bar stashed just outside the side passage: the second route pays.
    { x: 955, y: 200, taken: false, kind: 'bar' },
  ];
  if (spec.extraLoot > 0) {
    // Night 3 stashes two more pieces on the far side of the hall.
    smallLoot.push({ x: 130, y: 200, taken: false, kind: 'bar' });
    smallLoot.push({ x: 700, y: 620, taken: false, kind: 'case' });
  }
  const guardBeats = [
    {
      name: 'Ash',
      kind: 'patrol',
      color: '#2c3e55',
      points: [
        { x: 300, y: 280 },
        { x: 950, y: 280 },
      ],
    },
    {
      name: 'Brine',
      kind: 'patrol',
      color: '#1f4d3a',
      points: [
        { x: 1030, y: 300 },
        { x: 1030, y: 560 },
      ],
    },
    {
      name: 'Moss',
      kind: 'patrol',
      color: '#5a4a1f',
      points: [
        { x: 880, y: 130 },
        { x: 980, y: 250 },
        { x: 820, y: 250 },
      ],
    },
    {
      name: 'Sable',
      kind: 'sweeper',
      color: '#6e2b2b',
      points: [
        { x: 250, y: 640 },
        { x: 1050, y: 640 },
      ],
    },
    {
      name: 'Wren',
      kind: 'watcher',
      color: '#4a4a52',
      baseAngle: Math.PI / 2,
      points: [{ x: 520, y: 200 }],
    },
  ];
  if (spec.guards >= 6) {
    // Night 2: Onyx walks the west wall, watching the palms by the service exit.
    guardBeats.push({
      name: 'Onyx',
      kind: 'patrol',
      color: '#3a2b4d',
      points: [
        { x: 180, y: 180 },
        { x: 180, y: 520 },
      ],
    });
  }
  if (spec.guards >= 7) {
    // Night 3: Fern stands mid-hall and scans the carpet, so the straight run is watched.
    guardBeats.push({
      name: 'Fern',
      kind: 'watcher',
      color: '#2b4d3a',
      baseAngle: Math.PI / 2,
      points: [{ x: 700, y: 200 }],
    });
  }
  const cameraMounts = [
    { x: ROOM.x + 2, y: 300, baseAngle: 0, sweep: 0.7, phase: 0 },
    { x: ROOM.x + ROOM.width - 2, y: 380, baseAngle: Math.PI, sweep: 0.7, phase: 1.4 },
  ];
  // Laser grids (Night 2+): one sweeping the north hall from the top wall, one guarding
  // the vault approach from the east wall. Each beam swings on its own phase, so the two
  // grids never line up the same way twice in a row.
  const laserMounts = [];
  if (spec.lasers >= 2) {
    laserMounts.push(
      { x: 640, y: ROOM.y + 16, baseAngle: Math.PI / 2, sweep: 0.45, phase: 0, length: 240 },
      { x: ROOM.x + ROOM.width - 2, y: 300, baseAngle: Math.PI, sweep: 0.4, phase: 2.1, length: 230 },
    );
  }
  // Wall safes (Night 2+): one set into the north wall, one into the south wall.
  const safes = [];
  if (spec.safes >= 2) {
    safes.push(
      { x: 400, y: ROOM.y + 16, progress: 0, cracked: false },
      { x: 1050, y: ROOM.y + ROOM.height - 12, progress: 0, cracked: false },
    );
  }
  return {
    solids,
    plants,
    smallLoot,
    guardBeats,
    cameraMounts,
    laserMounts,
    safes,
    timerStart: spec.timer,
    loot: { x: 1130, y: 150, taken: false },
    exit: { x: 80, y: ROOM.y + ROOM.height - 58, width: 120, height: 58 },
    spawn: { x: 140, y: ROOM.y + ROOM.height - 90 },
  };
}
