// The gallery's wall cameras: they never walk, they sweep. Each one swings its cone back and
// forth around the direction it faces, and a thief caught in the cone, in the open and in line
// of sight, is seen — the same notice scale the guards use, so the alarm climbs the same way.
// A thief inside a smoke cloud is invisible to them too.
import { CAMERA, THIEF } from './config.js';
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
