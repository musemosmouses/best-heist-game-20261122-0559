// The gallery guards: they walk their beats, turn toward where they are going, and watch a
// cone ahead of them. A thief inside the cone, in the open and in line of sight, is seen —
// closer and faster-moving thieves are noticed sooner. A lure coin pulls the nearest guard off
// its beat to inspect the spot where it clinked. Three kinds walk the gallery: patrol guards
// on their rounds, a sweeper who crosses the hall fast, and a watcher who stands still and
// scans. A thief inside a smoke cloud is invisible to every one of them.
import { ALARM, GUARD, THIEF } from './config.js';
import { lineOfSight } from './level.js';
import { thiefInSmoke } from './player.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_INSPECT = 'inspect';
export const GUARD_WATCHER = 'watcher';
export const GUARD_SWEEPER = 'sweeper';

/** Smallest turn from `from` toward `to`, clamped to `maxTurn` radians. */
export function turnToward(from, to, maxTurn) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + Math.max(-maxTurn, Math.min(maxTurn, diff));
}

export function createGuard(beat, index) {
  const first = beat.points[0];
  const kind = beat.kind ?? GUARD_PATROL;
  return {
    name: beat.name,
    kind,
    color: beat.color ?? '#2c3e55',
    points: beat.points,
    target: 1,
    x: first.x,
    y: first.y,
    angle: beat.baseAngle ?? 0,
    baseAngle: beat.baseAngle ?? 0,
    speed: kind === GUARD_SWEEPER ? GUARD.sweeperSpeed : GUARD.patrolSpeed,
    scanTime: 0,
    mode: kind === GUARD_WATCHER ? GUARD_WATCHER : GUARD_PATROL,
    inspectX: 0,
    inspectY: 0,
    inspectLeft: 0,
    seen: false,
    /** Set once this guard has spent its SPOTTED! grace for the current sighting. */
    closeSpotted: false,
    index,
  };
}

/** How strongly this guard notices the thief right now: 0 when the thief is out of the cone,
// behind cover, hidden in a palm, or inside a smoke cloud; up to 1 point-blank in the open. */
export function guardNotice(guard, thief, solids, plants, smokes) {
  if (thiefInSmoke(thief, smokes)) return 0;
  const dx = thief.x - guard.x;
  const dy = thief.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.sightRange + THIEF.radius) return 0;
  const toThief = Math.atan2(dy, dx);
  let diff = toThief - guard.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > GUARD.sightHalfAngle) return 0;
  if (!lineOfSight(guard.x, guard.y, thief.x, thief.y, solids)) return 0;
  for (const plant of plants) {
    if (Math.hypot(thief.x - plant.x, thief.y - plant.y) < plant.radius) return 0;
  }
  const closeness = 1 - dist / (GUARD.sightRange + THIEF.radius);
  return 0.35 + 0.65 * closeness;
}

/** One step of a guard: walk the beat, stand and scan for a watcher, or walk to a lure and
 *  look around, then back to the beat. Returns true while the guard currently sees the thief. */
export function updateGuard(guard, dt, thief, solids, plants, smokes) {
  if (guard.kind === GUARD_WATCHER) {
    // A watcher never walks: it stands at its post and sweeps its gaze back and forth.
    guard.scanTime += dt;
    guard.angle = guard.baseAngle + Math.sin(guard.scanTime * GUARD.watcherScanSpeed) * GUARD.watcherScan;
    const notice = guardNotice(guard, thief, solids, plants, smokes);
    guard.seen = notice > 0;
    return notice;
  }
  let speed = guard.speed;
  let dest = guard.points[guard.target];
  if (guard.mode === GUARD_INSPECT) {
    dest = { x: guard.inspectX, y: guard.inspectY };
    speed = GUARD.hurrySpeed;
  }
  const dx = dest.x - guard.x;
  const dy = dest.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) {
    if (guard.mode === GUARD_INSPECT) {
      guard.inspectLeft -= dt;
      guard.angle = turnToward(guard.angle, guard.angle + 1.6 * dt, GUARD.turnSpeed * dt);
      if (guard.inspectLeft <= 0) {
        guard.mode = GUARD_PATROL;
        guard.target = nearestBeatPoint(guard);
      }
    } else {
      guard.target = (guard.target + 1) % guard.points.length;
    }
  } else {
    const step = Math.min(dist, speed * dt);
    guard.x += (dx / dist) * step;
    guard.y += (dy / dist) * step;
    guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), GUARD.turnSpeed * dt);
  }
  const notice = guardNotice(guard, thief, solids, plants, smokes);
  guard.seen = notice > 0;
  return notice;
}

/** The beat point nearest the guard, so it resumes its round from where it left off. */
export function nearestBeatPoint(guard) {
  let best = 0;
  let bestDist = Infinity;
  for (let index = 0; index < guard.points.length; index += 1) {
    const d = Math.hypot(guard.points[index].x - guard.x, guard.points[index].y - guard.y);
    if (d < bestDist) {
      bestDist = d;
      best = index;
    }
  }
  return best;
}

/** Send this guard to look at a lure coin's landing spot. */
export function lureGuard(guard, x, y, seconds) {
  guard.mode = GUARD_INSPECT;
  guard.inspectX = x;
  guard.inspectY = y;
  guard.inspectLeft = seconds;
}

/** The alarm's climb for one step while this guard sees the thief. */
export function alarmFromNotice(notice, sneaking, dt) {
  const factor = sneaking ? ALARM.sneakFactor : 1;
  return ALARM.risePerSecond * notice * factor * dt;
}
