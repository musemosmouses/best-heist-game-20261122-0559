// Rook, the thief: walks or sneaks across the gallery, ducks behind cases, tosses lure coins
// toward the mouse, pockets the small loot, lifts the Sunspire Diamond, and slips out the
// service exit. Movement collides with the room's solid cases so the thief cannot walk through
// the furniture.
import { COIN, SCORE, THIEF } from './config.js';
import { clampToRoom } from './level.js';

export function createThief(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    radius: THIEF.radius,
    sneaking: false,
    moving: false,
    coins: COIN.count,
    coin: null,
    hasDiamond: false,
    hidden: false,
  };
}

/** Is the thief standing inside a potted palm, hidden from every eye? */
export function thiefHidden(thief, plants) {
  for (const plant of plants) {
    if (Math.hypot(thief.x - plant.x, thief.y - plant.y) < plant.radius) return true;
  }
  return false;
}

/** Push a circle out of a solid rectangle, if it overlaps it. */
function pushOutOfRect(thief, rect) {
  const nearestX = Math.max(rect.x, Math.min(thief.x, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(thief.y, rect.y + rect.height));
  const dx = thief.x - nearestX;
  const dy = thief.y - nearestY;
  const dist = Math.hypot(dx, dy);
  if (dist >= thief.radius) return;
  if (dist === 0) {
    thief.y = rect.y - thief.radius;
    return;
  }
  thief.x = nearestX + (dx / dist) * thief.radius;
  thief.y = nearestY + (dy / dist) * thief.radius;
}

/** Move the thief one step. `move` is {x, y} in -1..1; `sneak` halves the speed. */
export function moveThief(thief, move, sneak, dt, solids) {
  const speed = sneak ? THIEF.sneakSpeed : THIEF.walkSpeed;
  thief.sneaking = sneak;
  thief.moving = move.x !== 0 || move.y !== 0;
  if (!thief.moving) return;
  const length = Math.hypot(move.x, move.y);
  const nx = move.x / length;
  const ny = move.y / length;
  thief.x += nx * speed * dt;
  thief.y += ny * speed * dt;
  const clamped = clampToRoom(thief.x, thief.y, thief.radius);
  thief.x = clamped.x;
  thief.y = clamped.y;
  for (const solid of solids) pushOutOfRect(thief, solid);
}

/** Toss a lure coin toward a point in the room. It flies, lands, and clinks. */
export function throwCoin(thief, targetX, targetY) {
  if (thief.coins <= 0 || thief.coin !== null) return false;
  thief.coins -= 1;
  thief.coin = {
    fromX: thief.x,
    fromY: thief.y,
    x: thief.x,
    y: thief.y,
    toX: targetX,
    toY: targetY,
    t: 0,
    landed: false,
  };
  return true;
}

/** Fly the coin in the air; once it lands it stays where it clinked. */
export function updateCoin(thief, dt) {
  const coin = thief.coin;
  if (coin === null || coin.landed) return;
  coin.t += dt / COIN.flySeconds;
  if (coin.t >= 1) {
    coin.t = 1;
    coin.landed = true;
  }
  coin.x = coin.fromX + (coin.toX - coin.fromX) * coin.t;
  coin.y = coin.fromY + (coin.toY - coin.fromY) * coin.t;
}

/** Pocket any small loot the thief is touching; returns the points earned. */
export function collectLoot(thief, smallLoot) {
  let points = 0;
  for (const loot of smallLoot) {
    if (loot.taken) continue;
    if (Math.hypot(thief.x - loot.x, thief.y - loot.y) < thief.radius + 18) {
      loot.taken = true;
      points += SCORE.smallLoot;
    }
  }
  return points;
}

/** Lift the diamond when the thief reaches its pedestal. */
export function collectDiamond(thief, loot) {
  if (loot.taken || thief.hasDiamond) return 0;
  if (Math.hypot(thief.x - loot.x, thief.y - loot.y) < thief.radius + 22) {
    loot.taken = true;
    thief.hasDiamond = true;
    return SCORE.diamond;
  }
  return 0;
}

/** True when the thief, diamond in hand, stands in the service exit. */
export function thiefEscaped(thief, exit) {
  return (
    thief.hasDiamond &&
    thief.x > exit.x &&
    thief.x < exit.x + exit.width &&
    thief.y > exit.y &&
    thief.y < exit.y + exit.height
  );
}
