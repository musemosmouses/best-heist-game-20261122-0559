// The gallery's wall cameras: they never walk, they sweep. Each one swings its cone back and
// forth around the direction it faces, and a thief caught in the cone, in the open and in line
// of sight, is seen — the same notice scale the guards use, so the alarm climbs the same way.
// A thief inside a smoke cloud is invisible to them too.
import { CAMERA, LASER, THIEF } from './config.js';
import { lineOfSight } from './level.js';
import { thiefInSmoke } from './player.js';

export function createCamera(mount, index) {
  return {
    x: mount.x,
    y: mount.y,
    baseAngle: mount.baseAngle,
    sweep: mount.sweep,
    phase: mount.phase,
    angle: mount.baseAngle,
    time: mount.phase,
    seen: false,
    index,
  };
}

/** The cone's current aim: a sine sweep around the mount's facing direction. */
export function updateCamera(camera, dt) {
  camera.time += dt;
  camera.angle = camera.baseAngle + Math.sin(camera.time * CAMERA.sweepSpeed) * camera.sweep;
}

/** How strongly this camera notices the thief right now: 0 outside the cone, behind cover,
 *  or inside a smoke cloud. */
export function cameraNotice(camera, thief, solids, plants, smokes) {
  if (thiefInSmoke(thief, smokes)) return 0;
  const dx = thief.x - camera.x;
  const dy = thief.y - camera.y;
  const dist = Math.hypot(dx, dy);
  if (dist > CAMERA.sightRange + THIEF.radius) return 0;
  const toThief = Math.atan2(dy, dx);
  let diff = toThief - camera.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > CAMERA.sightHalfAngle) return 0;
  if (!lineOfSight(camera.x, camera.y, thief.x, thief.y, solids)) return 0;
  for (const plant of plants) {
    if (Math.hypot(thief.x - plant.x, thief.y - plant.y) < plant.radius) return 0;
  }
  const closeness = 1 - dist / (CAMERA.sightRange + THIEF.radius);
  return 0.35 + 0.65 * closeness;
}

/** One step of a camera: sweep, then report whether it sees the thief. */
export function updateCameraSeen(camera, dt, thief, solids, plants, smokes) {
  updateCamera(camera, dt);
  const notice = cameraNotice(camera, thief, solids, plants, smokes);
  camera.seen = notice > 0;
  return notice;
}

// ---------------------------------------------------------------------------
// Laser grids: wall emitters that sweep a thin red beam back and forth. Unlike a
// cone, a beam is a trip-wire — smoke does not hide a thief from it, and there is no
// grace: crossing the line trips the alarm at once. The beam is deterministic: its
// angle is a sine of the game's own clock plus the mount's phase, so ?seed=N replays
// the same sweeps every time.

export function createLaser(mount, index) {
  return {
    x: mount.x,
    y: mount.y,
    baseAngle: mount.baseAngle,
    sweep: mount.sweep,
    phase: mount.phase,
    length: mount.length,
    angle: mount.baseAngle,
    time: mount.phase,
    tripped: false,
    index,
  };
}

/** The beam's current aim: a sine sweep around the mount's facing direction. */
export function updateLaser(laser, dt) {
  laser.time += dt;
  laser.angle = laser.baseAngle + Math.sin(laser.time * LASER.sweepSpeed) * laser.sweep;
}

/** Where the beam ends right now, for drawing and for the trip test. */
export function laserEnd(laser) {
  return {
    x: laser.x + Math.cos(laser.angle) * laser.length,
    y: laser.y + Math.sin(laser.angle) * laser.length,
  };
}

/** Distance from a point to the beam segment (emitter to beam end). */
function distanceToBeam(laser, x, y) {
  const end = laserEnd(laser);
  const dx = end.x - laser.x;
  const dy = end.y - laser.y;
  const lengthSq = dx * dx + dy * dy;
  let t = 0;
  if (lengthSq > 0) {
    t = ((x - laser.x) * dx + (y - laser.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
  }
  const nearestX = laser.x + dx * t;
  const nearestY = laser.y + dy * t;
  return Math.hypot(x - nearestX, y - nearestY);
}

/** 1 when the thief is standing on the beam, 0 otherwise. Smoke never hides a thief
 *  from a trip-beam: the light still breaks. */
export function laserNotice(laser, thief) {
  if (distanceToBeam(laser, thief.x, thief.y) > LASER.triggerDist + thief.radius * 0.4) return 0;
  return 1;
}

/** One step of a laser: sweep, then report whether the thief just crossed the beam. */
export function updateLaserSeen(laser, dt, thief) {
  updateLaser(laser, dt);
  const notice = laserNotice(laser, thief);
  laser.tripped = notice > 0;
  return notice;
}
