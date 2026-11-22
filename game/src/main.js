// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between five screens: title, play, paused, clean getaway and caught.
//
// ?seed=N fixes the patrols and sweeps. ?shot=start|play|loot|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot. window.__heist exposes the live state for play-testing.
import { ALARM, BEST_KEY, COIN, LASER, NIGHTS, SAFE, SCORE, SMOKE, STEP, TIMER_START } from './config.js';
import { createRandom } from './random.js';
import { buildLevel } from './level.js';
import { alarmFromNotice, createGuard, lureGuard, updateGuard } from './guard.js';
import { createCamera, createLaser, updateCameraSeen, updateLaserSeen } from './camera.js';
import {
  collectDiamond,
  collectLoot,
  createThief,
  moveThief,
  nearSafe,
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
const nightParam = Number.parseInt(params.get('night') ?? '', 10);
/** The night this visit plays: ?night=1..3, or 1 when the link does not say. */
let selectedNight = nightParam === 2 ? 2 : nightParam === 3 ? 3 : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);

/** A fresh run: the gallery, its guards and cameras, and Rook at the service exit. */
export function createGame(random, night) {
  const nightNumber = night === 2 ? 2 : night === 3 ? 3 : 1;
  const level = buildLevel(random, nightNumber);
  return {
    level,
    night: nightNumber,
    thief: createThief(level.spawn),
    guards: level.guardBeats.map((beat, index) => createGuard(beat, index)),
    cameras: level.cameraMounts.map((mount, index) => createCamera(mount, index)),
    lasers: level.laserMounts.map((mount, index) => createLaser(mount, index)),
    safes: level.safes,
    smokes: [],
    alarm: 0,
    score: 0,
    timeLeft: level.timerStart ?? TIMER_START,
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
    /** True on any step a laser beam is being crossed, for the red flash. */
    laserTripped: false,
    /** The win screen's score breakdown, filled as the run earns it. */
    breakdown: { loot: 0, diamond: 0, time: 0, coins: 0, safes: 0 },
  };
}

let game = createGame(createRandom(seed), selectedNight);

/** Read a held direction from the keyboard state: -1, 0 or 1 on each axis. */
function readMove(keys) {
  return {
    x: (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0),
    y: (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0),
  };
}

/**
 * One fixed step of a run. `input` is { move: {x, y}, sneak, throwAt: {x, y} | null,
 * smoke: boolean, crack: boolean }. Returns an event string for the caller to announce or sound:
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
  // Laser grids: crossing a beam trips the alarm at once, with no grace and no help
  // from smoke — the beam is a trip-wire, not a pair of eyes.
  state.laserTripped = false;
  for (const laser of state.lasers) {
    const trip = updateLaserSeen(laser, dt, state.thief);
    if (trip > 0) {
      state.laserTripped = true;
      state.lastSeenBy = `Laser ${laser.index + 1}`;
      state.alarm += LASER.risePerSecond * trip * dt;
      if (state.alarm >= 100) {
        state.alarm = 100;
        state.phase = 'over';
        state.loseReason = `Rook crossed Laser ${laser.index + 1} — the grid screamed.`;
        return 'caught';
      }
    }
  }
  // Wall safes: hold E beside one to crack it. Cracking while any eye is on Rook
  // raises the alarm faster — a thief at a safe is a thief standing still.
  if (input.crack) {
    const safe = nearSafe(state.thief, state.safes);
    if (safe !== null) {
      safe.progress += dt / SAFE.crackSeconds;
      if (notice > 0) state.alarm += 25 * dt;
      if (safe.progress >= 1) {
        safe.progress = 1;
        safe.cracked = true;
        state.score += SAFE.points;
        state.breakdown.safes += SAFE.points;
        audio.pickup();
        return 'loot';
      }
    }
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

function readBest(night) {
  try {
    return Number.parseInt(window.localStorage.getItem(`${BEST_KEY}.n${night}`) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value, night) {
  try {
    window.localStorage.setItem(`${BEST_KEY}.n${night}`, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  game = createGame(createRandom(seed), selectedNight);
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
  let best = readBest(selectedNight);
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    game = createGame(createRandom(seed), selectedNight);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing Night ${selectedNight} — ${NIGHTS[selectedNight - 1].name}. Steal the diamond, then reach the service exit.`);
  }

  function endGame(event) {
    screen = event === 'win' ? SCREEN_WIN : SCREEN_OVER;
    if (game.score > best) {
      best = game.score;
      saveBest(best, game.night);
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
    // Night select on the title screen: 1, 2 or 3 picks the night, Space starts it.
    if (screen === SCREEN_TITLE && (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3')) {
      selectedNight = event.code === 'Digit2' ? 2 : event.code === 'Digit3' ? 3 : 1;
      best = readBest(selectedNight);
      announce(`Night ${selectedNight} — ${NIGHTS[selectedNight - 1].name}. Press Space to start.`);
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
        // Beside a wall safe, E is held to crack it — the frame loop reads the held key.
        // Anywhere else, E tosses a lure coin toward the mouse.
        if (nearSafe(game.thief, game.safes) === null) {
          throwAt = mouse ?? { x: game.thief.x + 120, y: game.thief.y };
        }
        // Track the held key even though this branch returns early: the frame loop
        // reads keys.has('KeyE') to drive the safe-cracking progress.
        keys.add(event.code);
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
          for (const laser of game.lasers) updateLaserSeen(laser, STEP, game.thief);
        } else {
          const input = {
            move: readMove(keys),
            sneak: keys.has('ShiftLeft') || keys.has('ShiftRight'),
            throwAt,
            smoke,
            crack: keys.has('KeyE'),
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

  announce(`The Gilded Vault — Night ${selectedNight}, ${NIGHTS[selectedNight - 1].name}. Press 1, 2 or 3 to pick a night, Space or click to start.`);
  requestAnimationFrame(frame);
}

/** The play-test hook: live state, a fresh game, and one scripted step at a time. */
window.__heist = {
  state() {
    const stage = game.alarm < ALARM.waryAt ? 'CALM' : game.alarm < ALARM.huntedAt ? 'WARY' : 'HUNTED';
    return {
      phase: game.phase,
      night: game.night,
      alarm: Math.round(game.alarm * 10) / 10,
      alarmStage: stage,
      score: game.score,
      timeLeft: Math.round(game.timeLeft * 10) / 10,
      thief: { x: Math.round(game.thief.x), y: Math.round(game.thief.y), coins: game.thief.coins, hasDiamond: game.thief.hasDiamond },
      guards: game.guards.map((g) => ({ name: g.name, kind: g.kind, x: Math.round(g.x), y: Math.round(g.y), mode: g.mode, seen: g.seen })),
      cameras: game.cameras.map((c) => ({ angle: Math.round(c.angle * 100) / 100, seen: c.seen })),
      lasers: game.lasers.map((l) => ({ angle: Math.round(l.angle * 100) / 100, tripped: l.tripped })),
      laserTripped: game.laserTripped,
      safes: game.safes.map((s) => ({ x: s.x, y: s.y, progress: Math.round(s.progress * 100) / 100, cracked: s.cracked })),
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

