// The Meridian Gallery after hours: one room the thief crosses, its walls, the display cases
// and crates that block sight, the potted palms that hide a thief, the vault alcove holding the
// Sunspire Diamond, and the service exit. Also the line-of-sight test the guards and cameras
// share: a sight line is blocked when it crosses any solid rectangle.
import { FIELD } from './config.js';

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
 */
export function buildLevel() {
  const solids = [
    // The vault alcove: three solid walls, open on the left where the thief slips in.
    { x: 1010, y: ROOM.y, width: 18, height: 190 },
    { x: 1010, y: ROOM.y, width: 222, height: 18 },
    { x: 1010, y: ROOM.y + 172, width: 130, height: 18 },
    // Display cases and crates: solid cover the thief ducks behind.
    { x: 380, y: 210, width: 120, height: 58 },
    { x: 760, y: 180, width: 120, height: 58 },
    { x: 560, y: 330, width: 112, height: 68 },
    { x: 980, y: 330, width: 118, height: 68 },
    { x: 430, y: 470, width: 220, height: 52 },
  ];
  const plants = [
    { x: 300, y: 520, radius: 40 },
    { x: 900, y: 520, radius: 40 },
    { x: 640, y: 560, radius: 34 },
    { x: 180, y: 300, radius: 34 },
  ];
  const smallLoot = [
    { x: 440, y: 360, taken: false, kind: 'bar' },
    { x: 850, y: 590, taken: false, kind: 'case' },
    { x: 250, y: 170, taken: false, kind: 'bar' },
  ];
  const guardBeats = [
    {
      name: 'Ash',
      points: [
        { x: 300, y: 280 },
        { x: 950, y: 280 },
      ],
    },
    {
      name: 'Brine',
      points: [
        { x: 1030, y: 300 },
        { x: 1030, y: 560 },
      ],
    },
    {
      name: 'Moss',
      points: [
        { x: 880, y: 130 },
        { x: 980, y: 250 },
        { x: 820, y: 250 },
      ],
    },
  ];
  const cameraMounts = [
    { x: 640, y: ROOM.y + 2, baseAngle: Math.PI / 2, sweep: 0.85, phase: 0 },
    { x: ROOM.x + ROOM.width - 2, y: 380, baseAngle: Math.PI, sweep: 0.7, phase: 1.4 },
  ];
  return {
    solids,
    plants,
    smallLoot,
    guardBeats,
    cameraMounts,
    loot: { x: 1130, y: 150, taken: false },
    exit: { x: 80, y: ROOM.y + ROOM.height - 58, width: 120, height: 58 },
    spawn: { x: 140, y: ROOM.y + ROOM.height - 90 },
  };
}
