// The screenshot scenes behind ?shot=start|play|loot|end. Each one plays the real rules forward
// from a fresh game for a fixed stretch, steered by a simple autopilot that follows waypoints
// across the gallery and waits out a sweeping cone rather than walking through it, so the frame
// is what a short game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { guardNotice, updateGuard } from './guard.js';
import { cameraNotice, updateCameraSeen } from './camera.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_LIMIT_SECONDS = 60;
const LOOT_LIMIT_SECONDS = 150;
const END_LIMIT_SECONDS = 600;
const SAMPLE = STEP;

/** The route Rook takes: spawn, palm to palm, past the cases, up the carpet to the vault. */
const ROUTE_TO_LOOT = [
  { x: 300, y: 520 },
  { x: 430, y: 430 },
  { x: 700, y: 430 },
  { x: 640, y: 560 },
  { x: 850, y: 590 },
  { x: 900, y: 520 },
  { x: 1120, y: 450 },
  { x: 1180, y: 330 },
  { x: 1180, y: 280 },
  { x: 1130, y: 150 },
];
/** The play scene's route: pocket a gold bar, then cut straight across Ash's beat — spotted
 *  once, alarm up, score on the board — before ducking back to cover. */
const ROUTE_PLAY = [
  { x: 300, y: 520 },
  { x: 430, y: 430 },
  { x: 440, y: 360 },
  { x: 640, y: 280 },
  { x: 700, y: 430 },
];
const ROUTE_TO_EXIT = [
  { x: 1180, y: 280 },
  { x: 1180, y: 330 },
  { x: 1120, y: 450 },
  { x: 900, y: 520 },
  { x: 640, y: 560 },
  { x: 700, y: 430 },
  { x: 430, y: 430 },
  { x: 300, y: 520 },
  { x: 140, y: 660 },
];

/** The strongest notice any guard or camera has of a thief standing at (x, y). */
function probeNotice(game, x, y) {
  const probe = { x, y, radius: 13 };
  let notice = 0;
  for (const guard of game.guards) notice = Math.max(notice, guardNotice(guard, probe, game.level.solids, game.level.plants));
  for (const camera of game.cameras) notice = Math.max(notice, cameraNotice(camera, probe, game.level.solids, game.level.plants));
  return notice;
}

/** The guard nearest (x, y), or null when every guard is farther than `radius` away. */
function nearestGuard(game, x, y, radius) {
  let best = null;
  let bestDist = radius;
  for (const guard of game.guards) {
    const dist = Math.hypot(guard.x - x, guard.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = guard;
    }
  }
  return best;
}

/** Follow `waypoints`, sneaking, waiting out a cone when `careful`; returns the next input. */
function makePilot(game, waypoints, careful) {
  let index = 0;
  let waitTime = 0;
  let boldTime = 0;
  return function pilot() {
    const thief = game.thief;
    if (index >= waypoints.length) return { move: { x: 0, y: 0 }, sneak: true, throwAt: null };
    const target = waypoints[index];
    const dx = target.x - thief.x;
    const dy = target.y - thief.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 14) {
      index += 1;
      return { move: { x: 0, y: 0 }, sneak: true, throwAt: null };
    }
    const speed = 102;
    const nextX = thief.x + (dx / dist) * speed * SAMPLE;
    const nextY = thief.y + (dy / dist) * speed * SAMPLE;
    // A guard closing in is backed away from, never waited out: a waiting thief is
    // exactly what a patrolling guard walks into. Only a cone ahead, seen from cover,
    // is worth standing still for.
    const close = careful ? nearestGuard(game, thief.x, thief.y, 70) : null;
    if (close !== null) {
      const awayX = thief.x - close.x;
      const awayY = thief.y - close.y;
      const awayDist = Math.hypot(awayX, awayY) || 1;
      waitTime = 0;
      return { move: { x: awayX / awayDist, y: awayY / awayDist }, sneak: true, throwAt: null };
    }
    // Wait out a cone only from cover: standing still while already seen just lets the
    // alarm climb, so a thief in the open pushes through instead of freezing.
    const hereNotice = probeNotice(game, thief.x, thief.y);
    if (boldTime > 0) {
      boldTime -= SAMPLE;
    } else if (careful && hereNotice <= 0.1 && probeNotice(game, nextX, nextY) > 0.25) {
      waitTime += SAMPLE;
      if (waitTime > 8) {
        waitTime = 0;
        boldTime = 4;
      } else {
        return { move: { x: 0, y: 0 }, sneak: true, throwAt: null };
      }
    } else {
      waitTime = 0;
    }
    return { move: { x: dx / dist, y: dy / dist }, sneak: true, throwAt: null };
  };
}

/** Run the game forward with a pilot until `stop` says the scene is ready. */
function simulate(game, step, pilot, limitSeconds, stop) {
  for (let index = 0; index < limitSeconds / SAMPLE; index += 1) {
    step(game, pilot(), SAMPLE);
    if (stop(game)) break;
    if (game.phase !== 'play') break;
  }
}

/**
 * Set `game` to the named scene (start, play, loot or end; any other name is start) and return
 * the screen to draw over it and the best score to show.
 */
export function stageShot(name, game, step) {
  if (name !== 'play' && name !== 'loot' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / SAMPLE; index += 1) {
      for (const guard of game.guards) updateGuard(guard, SAMPLE, game.thief, game.level.solids, game.level.plants);
      for (const camera of game.cameras) updateCameraSeen(camera, SAMPLE, game.thief, game.level.solids, game.level.plants);
      game.elapsed += SAMPLE;
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Bold through the cones until the alarm is up and a little loot is pocketed, then stop:
    // a thief mid-heist, spotted once, score on the board.
    const pilot = makePilot(game, ROUTE_PLAY, false);
    simulate(game, step, pilot, PLAY_LIMIT_SECONDS, (state) => state.alarm >= 25 && state.score > 0);
    return { screen: SCREEN_PLAY, best: game.score };
  }
  if (name === 'loot') {
    const pilot = makePilot(game, ROUTE_TO_LOOT, true);
    simulate(game, step, pilot, LOOT_LIMIT_SECONDS, (state) => state.thief.hasDiamond);
    return { screen: SCREEN_PLAY, best: game.score };
  }
  const toLoot = makePilot(game, ROUTE_TO_LOOT, true);
  simulate(game, step, toLoot, LOOT_LIMIT_SECONDS, (state) => state.thief.hasDiamond);
  if (game.phase === 'play' && game.thief.hasDiamond) {
    const toExit = makePilot(game, ROUTE_TO_EXIT, true);
    simulate(game, step, toExit, END_LIMIT_SECONDS, (state) => state.phase !== 'play');
  }
  const won = game.phase === 'win';
  return { screen: won ? SCREEN_WIN : game.phase === 'over' ? SCREEN_OVER : SCREEN_PLAY, best: game.score };
}
