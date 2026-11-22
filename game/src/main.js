// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between five screens: title, play, paused, clean getaway and caught.
//
// ?seed=N fixes the patrols and sweeps. ?shot=start|play|loot|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot. window.__heist exposes the live state for play-testing.
import { ALARM, BEST_KEY, COIN, SCORE, SMOKE, STEP, TIMER_START } from './config.js';
import { createRandom } from './random.js';
import { buildLevel } from './level.js';
import { alarmFromNotice, createGuard, lureGuard, updateGuard } from './guard.js';
import { createCamera, updateCameraSeen } from './camera.js';
import {
  collectDiamond,
  collectLoot,
  createThief,
  moveThief,
  smokesAffordable,
  thiefEscaped,
  thiefHidden,
  thiefInSmoke,
  throwCoin,
  updateCoin,
  updateSmokeClouds,
  useSmokePellet,
} from './player.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);

/** A fresh run: the gallery, its guards and cameras, and Rook at the service exit. */
export function createGame(random) {
  const level = buildLevel(random);
  return {
    level,
    thief: createThief(level.spawn),
    guards: level.guardBeats.map((beat, index) => createGuard(beat, index)),
    cameras: level.cameraMounts.map((mount, index) => createCamera(mount, index)),
    smokes: [],
    alarm: 0,
    score: 0,
    timeLeft: TIMER_START,
    elapsed: 0,
    phase: 'play',
    loseReason: '',
    lastTickSecond: -1,
    alarmSoundAt: 0,
    /** The SPOTTED! grace: seconds left of the fair warning after a first close sighting. */
    graceLeft: 0,
    spottedBy: '',
    /** Who last raised the alarm — named on the caught screen. */
    lastSeenBy: '',
    /** The win screen's score breakdown, filled as the run earns it. */
    breakdown: { loot: 0, diamond: 0, time: 0, coins: 0 },
  };
}

let game = createGame(createRandom(seed));

/** Read a held direction from the keyboard state: -1, 0 or 1 on each axis. */
function readMove(keys) {
  return {
    x: (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0),
    y: (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0),
  };
}

/**
 * One fixed step of a run. `input` is { move: {x, y}, sneak, throwAt: {x, y} | null,
 * smoke: boolean }. Returns an event string for the caller to announce or sound:
 * 'coin', 'loot', 'diamond', 'win', 'caught' or ''.
 */
export function stepGame(state, input, dt) {
  if (state.phase !== 'play') return '';
  state.elapsed += dt;
  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    state.phase = 'over';
    state.loseReason = 'Dawn broke over the gallery — the night ran out.';
    return 'caught';
  }
  const wholeSecond = Math.ceil(state.timeLeft);
  if (wholeSecond <= 10 && wholeSecond !== state.lastTickSecond) {
    state.lastTickSecond = wholeSecond;
    audio.tick();
  }

  moveThief(state.thief, input.move, input.sneak, dt, state.level.solids);
  state.thief.hidden = thiefHidden(state.thief, state.level.plants);
  if (input.throwAt !== null) {
    if (throwCoin(state.thief, input.throwAt.x, input.throwAt.y)) {
      audio.clink();
    }
  }
  if (input.smoke) {
    const cloud = useSmokePellet(state.thief);
    if (cloud !== null) {
      state.smokes.push(cloud);
      audio.smoke();
    }
  }
  updateCoin(state.thief, dt);
  updateSmokeClouds(state.smokes, dt);

  const coin = state.thief.coin;
  if (coin !== null && coin.landed) {
    for (const guard of state.guards) {
      const dist = Math.hypot(guard.x - coin.x, guard.y - coin.y);
      if (dist < COIN.lureRadius && guard.mode === 'patrol') {
        lureGuard(guard, coin.x, coin.y, COIN.inspectSeconds);
      }
    }
    state.thief.coin = null;
  }

  let notice = 0;
  for (const guard of state.guards) {
    const guardNotice = updateGuard(guard, dt, state.thief, state.level.solids, state.level.plants, state.smokes);
    notice = Math.max(notice, guardNotice);
    if (guardNotice > 0) state.lastSeenBy = guard.name;
    // A fair caught moment: the first time a guard spots Rook at close range, flash
    // SPOTTED! and give 0.6 s of grace before a grab can land — time to break away.
    const dist = Math.hypot(guard.x - state.thief.x, guard.y - state.thief.y);
    // A fair caught moment: the first time this guard spots Rook at close range in one
    // sighting, flash SPOTTED! and give 0.6 s of grace before a grab can land — time to
    // break away. (A sighting starts far off, so the trigger is the close range itself,
    // not the first frame the guard sees anything.)
    if (!guard.seen) guard.closeSpotted = false;
    else if (dist < 120 && !guard.closeSpotted && state.graceLeft <= 0) {
      guard.closeSpotted = true;
      state.graceLeft = 0.6;
      state.spottedBy = guard.name;
      audio.spotted();
    }
    // A guard cannot grab a thief it cannot see inside a smoke cloud: the cloud hides
    // Rook from hands as well as from eyes, so a smoke pellet is a real escape.
    if (state.graceLeft <= 0 && dist < 26 && !thiefInSmoke(state.thief, state.smokes)) {
      state.phase = 'over';
      state.loseReason = `${guard.name} grabbed Rook by the collar.`;
      return 'caught';
    }
  }
  for (const camera of state.cameras) {
    const cameraNotice = updateCameraSeen(camera, dt, state.thief, state.level.solids, state.level.plants, state.smokes);
    notice = Math.max(notice, cameraNotice);
    if (cameraNotice > 0) state.lastSeenBy = `Camera ${camera.index + 1}`;
  }
  if (state.graceLeft > 0) {
    state.graceLeft -= dt;
    if (notice <= 0) state.graceLeft = 0;
  }
  if (notice > 0) {
    const climb = alarmFromNotice(notice, state.thief.sneaking, dt);
    const before = state.alarm;
    state.alarm += climb;
    if (before < ALARM.waryAt && state.alarm >= ALARM.waryAt) audio.alarm();
    if (before < ALARM.huntedAt && state.alarm >= ALARM.huntedAt) audio.wary();
    if (state.alarm >= 100) {
      state.alarm = 100;
      state.phase = 'over';
      state.loseReason = `The alarm hit 100 — ${state.lastSeenBy} raised it.`;
      return 'caught';
    }
  } else {
    state.alarm = Math.max(0, state.alarm - 12 * dt);
  }

  const gained = collectLoot(state.thief, state.level.smallLoot);
  if (gained > 0) {
    state.score += gained;
    state.breakdown.loot += gained;
    audio.pickup();
    return 'loot';
  }
  const diamond = collectDiamond(state.thief, state.level.loot);
  if (diamond > 0) {
    state.score += diamond;
    state.breakdown.diamond += diamond;
    audio.diamond();
    return 'diamond';
  }
  if (thiefEscaped(state.thief, state.level.exit)) {
    state.phase = 'win';
    state.breakdown.coins = state.thief.coins * SCORE.coinLeft;
    state.breakdown.time = Math.ceil(state.timeLeft) * SCORE.timePerSecond;
    state.score += state.breakdown.coins + state.breakdown.time;
    return 'win';
  }
  return '';
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  game = createGame(createRandom(seed));
  const scene = stageShot(name, game, stepGame);
  let painted = 0;
  function paint() {
    renderer.draw(game, scene.screen, scene.best, game.elapsed);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const keys = new Set();
  let throwAt = null;
  let smoke = false;
  let mouse = null;
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    game = createGame(createRandom(seed));
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal the diamond, then reach the service exit.');
  }

  function endGame(event) {
    screen = event === 'win' ? SCREEN_WIN : SCREEN_OVER;
    if (game.score > best) {
      best = game.score;
      saveBest(best);
    }
    if (event === 'win') audio.win();
    else audio.lose();
    announce(event === 'win' ? `Clean getaway. Score ${game.score}.` : `${game.loseReason} Score ${game.score}.`);
  }

  window.addEventListener('keydown', (event) => {
    audio.unlock();
    if (event.code === 'Space' || event.code === 'Enter') {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
        event.preventDefault();
        startGame();
      }
      return;
    }
    if (event.code === 'KeyP' || event.code === 'Escape') {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (event.code === 'KeyE') {
      if (screen === SCREEN_PLAY) {
        throwAt = mouse ?? { x: game.thief.x + 120, y: game.thief.y };
      }
      return;
    }
    if (event.code === 'KeyQ') {
      if (screen === SCREEN_PLAY) smoke = true;
      return;
    }
    keys.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse = { x: (event.clientX - rect.left) * (1280 / rect.width), y: (event.clientY - rect.top) * (720 / rect.height) };
  });
  canvas.addEventListener('pointerdown', (event) => {
    audio.unlock();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      startGame();
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    throwAt = { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
  });

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        if (screen === SCREEN_TITLE) {
          game.elapsed += STEP;
          for (const guard of game.guards) updateGuard(guard, STEP, game.thief, game.level.solids, game.level.plants, game.smokes);
          for (const camera of game.cameras) updateCameraSeen(camera, STEP, game.thief, game.level.solids, game.level.plants, game.smokes);
        } else {
          const input = {
            move: readMove(keys),
            sneak: keys.has('ShiftLeft') || keys.has('ShiftRight'),
            throwAt,
            smoke,
          };
          throwAt = null;
          smoke = false;
          const event = stepGame(game, input, STEP);
          if (event === 'win' || event === 'caught') endGame(event);
        }
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game, screen, best, game.elapsed);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Gilded Vault. Press Space or click to start.');
  requestAnimationFrame(frame);
}

/** The play-test hook: live state, a fresh game, and one scripted step at a time. */
window.__heist = {
  state() {
    const stage = game.alarm < ALARM.waryAt ? 'CALM' : game.alarm < ALARM.huntedAt ? 'WARY' : 'HUNTED';
    return {
      phase: game.phase,
      alarm: Math.round(game.alarm * 10) / 10,
      alarmStage: stage,
      score: game.score,
      timeLeft: Math.round(game.timeLeft * 10) / 10,
      thief: { x: Math.round(game.thief.x), y: Math.round(game.thief.y), coins: game.thief.coins, hasDiamond: game.thief.hasDiamond },
      guards: game.guards.map((g) => ({ name: g.name, kind: g.kind, x: Math.round(g.x), y: Math.round(g.y), mode: g.mode, seen: g.seen })),
      cameras: game.cameras.map((c) => ({ angle: Math.round(c.angle * 100) / 100, seen: c.seen })),
      lootTaken: game.level.smallLoot.filter((l) => l.taken).length,
      diamondTaken: game.level.loot.taken,
      smokes: game.smokes.length,
      smokeReady: smokesAffordable(game.thief),
      spotted: game.graceLeft > 0,
      spottedBy: game.spottedBy,
      lastSeenBy: game.lastSeenBy,
      breakdown: { ...game.breakdown },
      loseReason: game.loseReason,
    };
  },
};

if (shot) runShot(shot);
else runGame();

