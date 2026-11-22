// Drawing only: the game's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with the backdrop colour. The HUD
// band sits across the top of the field; the gallery room runs below it, so the alarm meter,
// timer, score, loot and coins are always on screen with the room itself.
import { ALARM, CAMERA, COIN, FIELD, FONT, GUARD, LASER, NIGHTS, PALETTE, SAFE, SCORE, SMOKE, THIEF } from './config.js';
import { ROOM } from './level.js';
import { laserEnd } from './camera.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const PLANK_HEIGHT = 32;
const PLANK_WIDTH = 128;
const LIFE_SIZE = 20;

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const timeLabel = cachedLabel('');
  const alarmLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  /** A vision cone: a wedge fading from its source, with a bright edge. */
  function drawCone(x, y, angle, halfAngle, range, fill, edge) {
    const gradient = context.createRadialGradient(x, y, 8, x, y, range);
    gradient.addColorStop(0, fill);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, angle - halfAngle, angle + halfAngle);
    context.closePath();
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle - halfAngle) * range, y + Math.sin(angle - halfAngle) * range);
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle + halfAngle) * range, y + Math.sin(angle + halfAngle) * range);
    context.stroke();
  }

  function drawFloor(state) {
    // Warm parquet: staggered planks in three wood tones, seams drawn, never a flat tile.
    const rows = Math.ceil(ROOM.height / PLANK_HEIGHT);
    for (let row = 0; row < rows; row += 1) {
      const y = ROOM.y + row * PLANK_HEIGHT;
      const height = Math.min(PLANK_HEIGHT, ROOM.y + ROOM.height - y);
      const offset = row % 2 === 0 ? 0 : PLANK_WIDTH / 2;
      for (let x = ROOM.x - PLANK_WIDTH; x < ROOM.x + ROOM.width; x += PLANK_WIDTH) {
        const plank = x + offset;
        const tone = (row + Math.round(plank / PLANK_WIDTH)) % 3;
        context.fillStyle = tone === 0 ? PALETTE.floorA : tone === 1 ? PALETTE.floorB : PALETTE.floorC;
        context.fillRect(plank, y, PLANK_WIDTH, height);
        context.strokeStyle = PALETTE.plankLine;
        context.lineWidth = 1;
        context.strokeRect(plank + 0.5, y + 0.5, PLANK_WIDTH, height);
      }
      context.fillStyle = PALETTE.plankLine;
      context.fillRect(ROOM.x, y, ROOM.width, 1);
    }
    // Warm lamp pools: soft gold light spilled across the parquet.
    const lamps = [
      { x: 220, y: 160, radius: 200 },
      { x: 660, y: 150, radius: 220 },
      { x: 1080, y: 520, radius: 210 },
      { x: 300, y: 600, radius: 190 },
    ];
    for (const lamp of lamps) {
      const glow = context.createRadialGradient(lamp.x, lamp.y, 10, lamp.x, lamp.y, lamp.radius);
      glow.addColorStop(0, PALETTE.lampGlow);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(lamp.x, lamp.y, lamp.radius, 0, Math.PI * 2);
      context.fill();
    }
    // The red carpet runner from the service exit to the vault, gold-edged.
    context.fillStyle = PALETTE.carpet;
    context.fillRect(ROOM.x + 96, ROOM.y + ROOM.height - 160, 880, 64);
    context.fillStyle = PALETTE.carpetEdge;
    context.fillRect(ROOM.x + 96, ROOM.y + ROOM.height - 160, 880, 4);
    context.fillRect(ROOM.x + 96, ROOM.y + ROOM.height - 100, 880, 4);
    context.fillStyle = PALETTE.carpet;
    context.fillRect(ROOM.x + 940, ROOM.y + 96, 64, ROOM.height - 256);
    context.fillStyle = PALETTE.carpetEdge;
    context.fillRect(ROOM.x + 940, ROOM.y + 96, 4, ROOM.height - 256);
    context.fillRect(ROOM.x + 1000, ROOM.y + 96, 4, ROOM.height - 256);
    // The side passage's mouth, labelled on the floor so the second route reads.
    text('SIDE PASSAGE', 905, 252, 13, PALETTE.loot, 'center');
    // Wall shadow: the top wall throws shade down over the parquet.
    const shade = context.createLinearGradient(0, ROOM.y, 0, ROOM.y + 40);
    shade.addColorStop(0, PALETTE.wallShadow);
    shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = shade;
    context.fillRect(ROOM.x, ROOM.y, ROOM.width, 40);
  }

  function drawWalls(state) {
    const w = FIELD.wall;
    context.fillStyle = PALETTE.wall;
    context.fillRect(0, FIELD.hudHeight, FIELD.width, w);
    context.fillRect(0, FIELD.height - w, FIELD.width, w);
    context.fillRect(0, FIELD.hudHeight, w, FIELD.height - FIELD.hudHeight);
    context.fillRect(FIELD.width - w, FIELD.hudHeight, w, FIELD.height - FIELD.hudHeight);
    context.fillStyle = PALETTE.wallTop;
    context.fillRect(0, FIELD.hudHeight, FIELD.width, 5);
    // The vault alcove's glass case: a pale sheen over the diamond's corner.
    context.fillStyle = PALETTE.glass;
    context.fillRect(1028, ROOM.y + 18, 204, 234);
    // Alcove walls, drawn over the floor.
    for (const solid of state.level.solids.slice(0, 4)) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(solid.x, solid.y, solid.width, solid.height);
      context.fillStyle = PALETTE.wallTop;
      context.fillRect(solid.x, solid.y, solid.width, 4);
    }
    // A gold frame around the vault alcove: the loot corner glows before you see it.
    context.strokeStyle = PALETTE.loot;
    context.lineWidth = 2;
    context.strokeRect(1010, ROOM.y + 18, 222, 234);
  }

  function drawCover(state) {
    for (const solid of state.level.solids.slice(4)) {
      const isCase = solid.width >= 110 && solid.height <= 60;
      context.fillStyle = isCase ? PALETTE.pedestal : PALETTE.crate;
      context.fillRect(solid.x, solid.y, solid.width, solid.height);
      context.fillStyle = PALETTE.loot;
      context.fillRect(solid.x, solid.y, solid.width, 3);
      if (isCase) {
        // A glass case: pale sheen across the top, gold trim at the base.
        context.fillStyle = PALETTE.glass;
        context.fillRect(solid.x + 4, solid.y + 6, solid.width - 8, solid.height / 2);
      } else {
        context.strokeStyle = 'rgba(0,0,0,0.35)';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(solid.x, solid.y + solid.height / 2);
        context.lineTo(solid.x + solid.width, solid.y + solid.height / 2);
        context.stroke();
      }
    }
    for (const plant of state.level.plants) {
      // Safe cover reads green at a glance: a soft halo marks the hiding ring.
      context.fillStyle = PALETTE.plantHalo;
      context.beginPath();
      context.arc(plant.x, plant.y, plant.radius + 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.plantDark;
      context.beginPath();
      context.arc(plant.x, plant.y, plant.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.plant;
      context.beginPath();
      context.arc(plant.x - 8, plant.y - 6, plant.radius * 0.62, 0, Math.PI * 2);
      context.arc(plant.x + 10, plant.y + 8, plant.radius * 0.55, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(180, 255, 200, 0.5)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(plant.x, plant.y, plant.radius, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawLoot(state, time) {
    for (const loot of state.level.smallLoot) {
      if (loot.taken) continue;
      if (loot.kind === 'bar') {
        context.fillStyle = PALETTE.loot;
        context.fillRect(loot.x - 12, loot.y - 6, 24, 12);
        context.fillStyle = 'rgba(255,255,255,0.5)';
        context.fillRect(loot.x - 12, loot.y - 6, 24, 3);
      } else {
        context.fillStyle = PALETTE.loot;
        context.beginPath();
        context.arc(loot.x, loot.y, 10, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#fff7d6';
        context.beginPath();
        context.arc(loot.x - 3, loot.y - 3, 3, 0, Math.PI * 2);
        context.fill();
      }
    }
    const diamond = state.level.loot;
    if (!diamond.taken) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 3);
      context.fillStyle = PALETTE.lootGlow;
      context.beginPath();
      context.arc(diamond.x, diamond.y - 26, 48 + pulse * 12, 0, Math.PI * 2);
      context.fill();
      // Sparkles around the stone, twinkling on the game's clock.
      context.fillStyle = '#fff7d6';
      const sparkles = [
        { x: -34, y: -52, phase: 0 },
        { x: 30, y: -58, phase: 1.6 },
        { x: 38, y: -14, phase: 3.1 },
        { x: -38, y: -10, phase: 4.4 },
      ];
      for (const sparkle of sparkles) {
        const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(time * 2 + sparkle.phase));
        context.globalAlpha = twinkle;
        context.beginPath();
        context.arc(diamond.x + sparkle.x, diamond.y + sparkle.y, 3, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      context.fillStyle = PALETTE.loot;
      context.beginPath();
      context.moveTo(diamond.x, diamond.y - 44);
      context.lineTo(diamond.x + 14, diamond.y - 26);
      context.lineTo(diamond.x, diamond.y - 8);
      context.lineTo(diamond.x - 14, diamond.y - 26);
      context.closePath();
      context.fill();
      context.fillStyle = '#fff7d6';
      context.beginPath();
      context.moveTo(diamond.x, diamond.y - 44);
      context.lineTo(diamond.x + 6, diamond.y - 26);
      context.lineTo(diamond.x, diamond.y - 20);
      context.lineTo(diamond.x - 6, diamond.y - 26);
      context.closePath();
      context.fill();
      text('SUNSPIRE DIAMOND', diamond.x, diamond.y + 58, 15, PALETTE.loot, 'center');
    }
    // The pedestal the diamond sits on.
    context.fillStyle = PALETTE.pedestal;
    context.fillRect(diamond.x - 20, diamond.y, 40, 26);
    context.fillStyle = PALETTE.loot;
    context.fillRect(diamond.x - 20, diamond.y, 40, 3);
  }

  function drawExit(state) {
    const exit = state.level.exit;
    context.fillStyle = PALETTE.exit;
    context.fillRect(exit.x, exit.y, exit.width, exit.height);
    context.fillStyle = 'rgba(0,0,0,0.4)';
    context.fillRect(exit.x, exit.y, exit.width, 6);
    text('SERVICE EXIT', exit.x + exit.width / 2, exit.y + 36, 15, '#ffffff', 'center');
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      // A guard that sees Rook paints its cone red: danger you can read at a glance.
      const fill = guard.seen ? PALETTE.coneSeen : PALETTE.cone;
      const edge = guard.seen ? PALETTE.coneSeenEdge : PALETTE.coneEdge;
      drawCone(guard.x, guard.y, guard.angle, GUARD.sightHalfAngle, GUARD.sightRange, fill, edge);
    }
    for (const guard of state.guards) {
      context.fillStyle = guard.color;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guardCap;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius, Math.PI, 0);
      context.fill();
      // A brass belt and a facing tick, so the guard reads as a person, not a dot.
      context.strokeStyle = PALETTE.loot;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(guard.x - GUARD.radius + 3, guard.y + 3);
      context.lineTo(guard.x + GUARD.radius - 3, guard.y + 3);
      context.stroke();
      context.strokeStyle = PALETTE.text;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.angle) * (GUARD.radius + 10), guard.y + Math.sin(guard.angle) * (GUARD.radius + 10));
      context.stroke();
      text(guard.name, guard.x, guard.y - GUARD.radius - 8, 14, PALETTE.text, 'center');
      const role = guard.kind === 'sweeper' ? 'SWEEPER' : guard.kind === 'watcher' ? 'WATCHER' : '';
      if (role !== '') text(role, guard.x, guard.y + GUARD.radius + 18, 11, PALETTE.loot, 'center');
      if (guard.seen) text('!', guard.x, guard.y - GUARD.radius - 26, 24, PALETTE.alarmHigh, 'center');
    }
  }

  function drawCameras(state, time) {
    for (const camera of state.cameras) {
      drawCone(camera.x, camera.y, camera.angle, CAMERA.sightHalfAngle, CAMERA.sightRange, PALETTE.camCone, PALETTE.camConeEdge);
      // The sweep's full arc, dashed on the floor: the whole patrol the camera covers.
      context.strokeStyle = PALETTE.camConeEdge;
      context.lineWidth = 1.5;
      context.setLineDash([6, 8]);
      context.beginPath();
      context.arc(camera.x, camera.y, CAMERA.sightRange, camera.baseAngle - camera.sweep, camera.baseAngle + camera.sweep);
      context.stroke();
      context.setLineDash([]);
    }
    for (const camera of state.cameras) {
      context.fillStyle = PALETTE.camera;
      context.fillRect(camera.x - 11, camera.y - 8, 22, 16);
      // The lens barrel, pointing where the camera looks.
      context.fillStyle = '#5a636f';
      context.beginPath();
      context.arc(camera.x + Math.cos(camera.angle) * 12, camera.y + Math.sin(camera.angle) * 12, 6, 0, Math.PI * 2);
      context.fill();
      // A blinking red eye: on when it watches, bright red when it has Rook.
      const blinkOn = Math.sin(time * 6) > 0;
      context.fillStyle = camera.seen ? PALETTE.alarmHigh : blinkOn ? PALETTE.alarmHigh : '#7a2e28';
      context.beginPath();
      context.arc(camera.x - Math.cos(camera.angle) * 6, camera.y - Math.sin(camera.angle) * 6, 4, 0, Math.PI * 2);
      context.fill();
      if (camera.seen) text('!', camera.x, camera.y - 18, 20, PALETTE.alarmHigh, 'center');
    }
  }

  function drawThief(state, time) {
    const thief = state.thief;
    const blink = thief.hidden ? 0.55 : 1;
    const facing = thief.facing;
    const back = facing + Math.PI;
    context.globalAlpha = blink;
    // The cloak: a dark wedge trailing behind the direction Rook faces.
    context.fillStyle = PALETTE.thiefCloak;
    context.beginPath();
    context.moveTo(thief.x, thief.y);
    context.arc(thief.x, thief.y, thief.radius + 5, back - 0.7, back + 0.7);
    context.closePath();
    context.fill();
    // The body: a full circle walking, a low crouch sneaking.
    context.fillStyle = thief.sneaking ? PALETTE.thiefDark : PALETTE.thief;
    context.beginPath();
    if (thief.sneaking) context.ellipse(thief.x, thief.y, thief.radius, thief.radius * 0.68, 0, 0, Math.PI * 2);
    else context.arc(thief.x, thief.y, thief.radius, 0, Math.PI * 2);
    context.fill();
    // The hood: a dark arc over the top, and a facing tick so the thief reads at a glance.
    context.fillStyle = PALETTE.thiefCloak;
    context.beginPath();
    context.arc(thief.x, thief.y, thief.radius * 0.72, Math.PI, 0);
    context.fill();
    context.strokeStyle = PALETTE.text;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(thief.x, thief.y);
    context.lineTo(thief.x + Math.cos(facing) * (thief.radius + 7), thief.y + Math.sin(facing) * (thief.radius + 7));
    context.stroke();
    context.globalAlpha = 1;
    text('ROOK', thief.x, thief.y - thief.radius - 10, 14, PALETTE.text, 'center');
    if (thief.hasDiamond) {
      context.fillStyle = PALETTE.loot;
      context.beginPath();
      context.moveTo(thief.x + 10, thief.y - 16);
      context.lineTo(thief.x + 16, thief.y - 10);
      context.lineTo(thief.x + 10, thief.y - 4);
      context.lineTo(thief.x + 4, thief.y - 10);
      context.closePath();
      context.fill();
    }
    const coin = thief.coin;
    if (coin !== null) {
      const arcHeight = 26 * Math.sin(Math.min(coin.t, 1) * Math.PI);
      context.fillStyle = PALETTE.loot;
      context.beginPath();
      context.arc(coin.x, coin.y - arcHeight, 6, 0, Math.PI * 2);
      context.fill();
    }
  }

  /** Smoke clouds: grey puffs that blind every cone while Rook stands inside one. */
  /** Laser grids: a glowing red trip-beam from each wall emitter, bright red and
   *  pulsing while a thief is standing on it. */
  function drawLasers(state, time) {
    for (const laser of state.lasers) {
      const end = laserEnd(laser);
      const hot = laser.tripped;
      const pulse = hot ? 0.75 + 0.25 * Math.sin(time * 18) : 1;
      context.globalAlpha = pulse;
      // The beam's halo, then its bright core: a trip-wire you can read at a glance.
      context.strokeStyle = PALETTE.laserBeam;
      context.lineWidth = hot ? 14 : 9;
      context.beginPath();
      context.moveTo(laser.x, laser.y);
      context.lineTo(end.x, end.y);
      context.stroke();
      context.strokeStyle = hot ? PALETTE.laserHot : PALETTE.laserCore;
      context.lineWidth = hot ? 3.5 : 2.5;
      context.beginPath();
      context.moveTo(laser.x, laser.y);
      context.lineTo(end.x, end.y);
      context.stroke();
      // A bright dot where the beam lands on the far wall or case.
      context.fillStyle = hot ? PALETTE.laserHot : PALETTE.laserCore;
      context.beginPath();
      context.arc(end.x, end.y, hot ? 6 : 4, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      // The emitter: a dark box on the wall with a red lens.
      context.fillStyle = '#1a1d22';
      context.fillRect(laser.x - 10, laser.y - 8, 20, 16);
      context.fillStyle = PALETTE.laser;
      context.beginPath();
      context.arc(laser.x, laser.y, 4, 0, Math.PI * 2);
      context.fill();
      text('LASER', laser.x, laser.y - 16, 11, PALETTE.laserCore, 'center');
    }
  }

  /** Wall safes: a brass-fronted box set into the wall, its dial turning gold as the
   *  crack progresses, its door open once the combination gives. */
  function drawSafes(state) {
    for (const safe of state.safes) {
      const width = 46;
      const height = 32;
      const x = safe.x - width / 2;
      const y = safe.y - height / 2;
      context.fillStyle = PALETTE.safeDark;
      context.fillRect(x, y, width, height);
      context.fillStyle = safe.cracked ? PALETTE.loot : PALETTE.safe;
      context.fillRect(x, y, width, 4);
      context.strokeStyle = PALETTE.safe;
      context.lineWidth = 2;
      context.strokeRect(x + 0.5, y + 0.5, width, height);
      if (safe.cracked) {
        // The door hangs open on its hinge: gold inside, the safe is spent.
        context.fillStyle = PALETTE.loot;
        context.fillRect(x + 6, y + 8, width - 12, height - 14);
        text('OPEN', safe.x, y + height + 14, 11, PALETTE.loot, 'center');
      } else {
        // The dial, and a progress ring that fills as Rook works the combination.
        context.fillStyle = '#e8e4d8';
        context.beginPath();
        context.arc(safe.x, safe.y, 8, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = PALETTE.safeDark;
        context.beginPath();
        context.arc(safe.x, safe.y, 3, 0, Math.PI * 2);
        context.fill();
        if (safe.progress > 0) {
          context.strokeStyle = PALETTE.loot;
          context.lineWidth = 4;
          context.beginPath();
          context.arc(safe.x, safe.y, 14, -Math.PI / 2, -Math.PI / 2 + safe.progress * Math.PI * 2);
          context.stroke();
        }
        text('SAFE', safe.x, y + height + 14, 11, PALETTE.safe, 'center');
      }
    }
  }

  function drawSmoke(state) {
    for (const cloud of state.smokes) {
      const fade = Math.min(1, cloud.left / 1);
      context.globalAlpha = fade;
      context.fillStyle = PALETTE.smoke;
      context.beginPath();
      context.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.smoke;
      context.beginPath();
      context.arc(cloud.x - cloud.radius * 0.45, cloud.y - cloud.radius * 0.2, cloud.radius * 0.55, 0, Math.PI * 2);
      context.arc(cloud.x + cloud.radius * 0.4, cloud.y + cloud.radius * 0.25, cloud.radius * 0.5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.smokeEdge;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
    }
  }

  /** The HUD minimap: the whole gallery shrunk to a corner — walls, cases, palms,
   *  guards with their cones, cameras, lasers, loot, the diamond, the exit and Rook —
   *  so the room is readable at a glance instead of only what the frame shows. */
  function drawMinimap(state) {
    const mapX = 1052;
    const mapY = 598;
    const mapWidth = 204;
    const mapHeight = 102;
    const scaleX = mapWidth / ROOM.width;
    const scaleY = mapHeight / ROOM.height;
    const toMapX = (x) => mapX + (x - ROOM.x) * scaleX;
    const toMapY = (y) => mapY + (y - ROOM.y) * scaleY;
    text(`NIGHT ${state.night} — ${NIGHTS[state.night - 1].name}`, mapX + mapWidth, mapY - 10, 13, PALETTE.muted, 'right');
    context.fillStyle = PALETTE.minimapBg;
    context.fillRect(mapX - 4, mapY - 4, mapWidth + 8, mapHeight + 8);
    context.strokeStyle = PALETTE.minimapEdge;
    context.lineWidth = 2;
    context.strokeRect(mapX - 4, mapY - 4, mapWidth + 8, mapHeight + 8);
    context.fillStyle = 'rgba(123, 84, 51, 0.9)';
    context.fillRect(mapX, mapY, mapWidth, mapHeight);
    for (const solid of state.level.solids) {
      context.fillStyle = '#3a2f22';
      context.fillRect(toMapX(solid.x), toMapY(solid.y), Math.max(2, solid.width * scaleX), Math.max(2, solid.height * scaleY));
    }
    for (const plant of state.level.plants) {
      context.fillStyle = PALETTE.plant;
      context.beginPath();
      context.arc(toMapX(plant.x), toMapY(plant.y), Math.max(2, plant.radius * scaleX), 0, Math.PI * 2);
      context.fill();
    }
    for (const laser of state.lasers) {
      const end = laserEnd(laser);
      context.strokeStyle = laser.tripped ? PALETTE.laserHot : PALETTE.laser;
      context.lineWidth = laser.tripped ? 2.5 : 1.5;
      context.beginPath();
      context.moveTo(toMapX(laser.x), toMapY(laser.y));
      context.lineTo(toMapX(end.x), toMapY(end.y));
      context.stroke();
    }
    for (const camera of state.cameras) {
      context.strokeStyle = PALETTE.camConeEdge;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(toMapX(camera.x), toMapY(camera.y));
      context.lineTo(toMapX(camera.x + Math.cos(camera.angle) * CAMERA.sightRange), toMapY(camera.y + Math.sin(camera.angle) * CAMERA.sightRange));
      context.stroke();
      context.fillStyle = PALETTE.camera;
      context.beginPath();
      context.arc(toMapX(camera.x), toMapY(camera.y), 2.5, 0, Math.PI * 2);
      context.fill();
    }
    for (const loot of state.level.smallLoot) {
      if (loot.taken) continue;
      context.fillStyle = PALETTE.loot;
      context.fillRect(toMapX(loot.x) - 2, toMapY(loot.y) - 2, 4, 4);
    }
    const diamond = state.level.loot;
    if (!diamond.taken) {
      context.fillStyle = PALETTE.loot;
      context.beginPath();
      context.moveTo(toMapX(diamond.x), toMapY(diamond.y) - 4);
      context.lineTo(toMapX(diamond.x) + 4, toMapY(diamond.y));
      context.lineTo(toMapX(diamond.x), toMapY(diamond.y) + 4);
      context.lineTo(toMapX(diamond.x) - 4, toMapY(diamond.y));
      context.closePath();
      context.fill();
    }
    for (const safe of state.safes) {
      if (safe.cracked) continue;
      context.fillStyle = PALETTE.safe;
      context.fillRect(toMapX(safe.x) - 2, toMapY(safe.y) - 2, 4, 4);
    }
    const exit = state.level.exit;
    context.fillStyle = PALETTE.exit;
    context.fillRect(toMapX(exit.x), toMapY(exit.y), Math.max(3, exit.width * scaleX), Math.max(3, exit.height * scaleY));
    for (const guard of state.guards) {
      context.strokeStyle = guard.seen ? PALETTE.coneSeenEdge : PALETTE.coneEdge;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(toMapX(guard.x), toMapY(guard.y));
      context.lineTo(toMapX(guard.x + Math.cos(guard.angle) * GUARD.sightRange), toMapY(guard.y + Math.sin(guard.angle) * GUARD.sightRange));
      context.stroke();
      context.fillStyle = guard.color;
      context.beginPath();
      context.arc(toMapX(guard.x), toMapY(guard.y), 3.5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.text;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(toMapX(guard.x), toMapY(guard.y), 3.5, 0, Math.PI * 2);
      context.stroke();
    }
    // Rook, ringed white so the thief is never lost on the map.
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    context.arc(toMapX(state.thief.x), toMapY(state.thief.y), 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.text;
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(toMapX(state.thief.x), toMapY(state.thief.y), 4, 0, Math.PI * 2);
    context.stroke();
  }

  function drawHud(state) {
    context.fillStyle = PALETTE.hud;
    context.fillRect(0, 0, FIELD.width, FIELD.hudHeight);
    context.fillStyle = PALETTE.hudEdge;
    context.fillRect(0, FIELD.hudHeight - 2, FIELD.width, 2);
    // Alarm meter: label, a bigger segmented bar, the number, and the stage word —
    // CALM, WARY or HUNTED — so the tension reads when the frame is shrunk.
    const barX = 110;
    const barY = 14;
    const barWidth = 320;
    const barHeight = 28;
    text('ALARM', 24, barY + 21, 20, PALETTE.text, 'left');
    const level = state.alarm / 100;
    const stage = state.alarm < ALARM.waryAt ? 'CALM' : state.alarm < ALARM.huntedAt ? 'WARY' : 'HUNTED';
    const color = level < 0.5 ? PALETTE.alarmLow : level < 0.8 ? PALETTE.alarmMid : PALETTE.alarmHigh;
    context.fillStyle = '#0a0f0d';
    context.fillRect(barX, barY, barWidth, barHeight);
    context.fillStyle = color;
    context.fillRect(barX, barY, Math.round(barWidth * level), barHeight);
    context.strokeStyle = PALETTE.hudEdge;
    context.lineWidth = 2;
    for (let segment = 1; segment < 10; segment += 1) {
      context.beginPath();
      context.moveTo(barX + (barWidth / 10) * segment, barY);
      context.lineTo(barX + (barWidth / 10) * segment, barY + barHeight);
      context.stroke();
    }
    text(alarmLabel(`${Math.round(state.alarm)}%`), barX + barWidth + 10, barY + 21, 22, color, 'left');
    text(stage, barX + barWidth + 84, barY + 21, 18, color, 'left');
    // Timer in the middle, score on the right.
    const minutes = Math.floor(Math.max(0, state.timeLeft) / 60);
    const seconds = Math.floor(Math.max(0, state.timeLeft) % 60);
    const timerText = `${minutes}:${String(seconds).padStart(2, '0')}`;
    text(timeLabel(timerText), FIELD.width / 2, 38, 28, state.timeLeft < 30 ? PALETTE.alarmHigh : PALETTE.text, 'center');
    text(scoreLabel(state.score), FIELD.width - 300, 38, 28, PALETTE.text, 'right');
    // Loot and coins: a diamond outline that fills, coin pips, and the smoke count —
    // grey puffs, one per smoke the purse can afford at 2 coins each, with its Q key.
    const diamondX = FIELD.width - 270;
    context.strokeStyle = state.thief.hasDiamond ? PALETTE.loot : PALETTE.muted;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(diamondX, 14);
    context.lineTo(diamondX + 9, 26);
    context.lineTo(diamondX, 38);
    context.lineTo(diamondX - 9, 26);
    context.closePath();
    if (state.thief.hasDiamond) {
      context.fillStyle = PALETTE.loot;
      context.fill();
    }
    context.stroke();
    for (let index = 0; index < COIN.count; index += 1) {
      context.fillStyle = index < state.thief.coins ? PALETTE.loot : PALETTE.hudEdge;
      context.beginPath();
      context.arc(diamondX + 30 + index * 20, 26, 7, 0, Math.PI * 2);
      context.fill();
    }
    const smokeX = diamondX + 30 + COIN.count * 20 + 16;
    context.fillStyle = PALETTE.hudEdge;
    context.fillRect(smokeX, 14, 22, 24);
    text('Q', smokeX + 11, 32, 15, PALETTE.text, 'center');
    context.fillStyle = state.thief.coins >= SMOKE.costCoins ? PALETTE.smoke : PALETTE.hudEdge;
    context.beginPath();
    context.arc(smokeX + 38, 26, 8, 0, Math.PI * 2);
    context.arc(smokeX + 44, 29, 6, 0, Math.PI * 2);
    context.fill();
    text(`x${Math.floor(state.thief.coins / SMOKE.costCoins)}`, smokeX + 54, 32, 16, PALETTE.text, 'left');
    // Sneaking shows in the empty stretch between the timer and the score, clear of
    // the loot diamond and the coin pips.
    text(state.thief.sneaking ? 'SNEAKING' : '', 790, 38, 16, PALETTE.thief, 'center');
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const lineHeight = 32;
    const height = 150 + lines.length * lineHeight + 64;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(8, 12, 10, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.fillStyle = accent;
    context.fillRect(x, y, width, 5);
    text(title, FIELD.width / 2, y + 72, 44, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + 118 + index * lineHeight, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 34, 22, PALETTE.loot, 'center');
  }

  /** The title strip: a slim band across the top of the room, so the title screen names
   *  the game, its feature checklist and its controls without hiding the room behind a
   *  panel — the cover shot has to show the whole heist in one frame. */
  function drawTitleStrip(state, best) {
    const night = NIGHTS[state.night - 1];
    context.fillStyle = 'rgba(10, 14, 12, 0.85)';
    context.fillRect(ROOM.x, ROOM.y, ROOM.width, 52);
    context.fillStyle = PALETTE.loot;
    context.fillRect(ROOM.x, ROOM.y + 52, ROOM.width, 2);
    text('THE GILDED VAULT', ROOM.x + 16, ROOM.y + 36, 30, PALETTE.loot, 'left');
    text('3 nights · laser grids · crackable safes · 7 guards · live minimap', FIELD.width - 24, ROOM.y + 22, 15, PALETTE.text, 'right');
    text(`Night ${state.night} — ${night.name} · 1/2/3 select night · WASD move · Shift sneak · Click/E coin · Q smoke · hold E crack safe · Space to start · Best ${best}`, FIELD.width - 24, ROOM.y + 42, 14, PALETTE.muted, 'right');
  }

  /** A soft vignette: the gallery's edges fall into shadow, the middle stays lit. */
  function drawVignette() {
    const glow = context.createRadialGradient(640, 380, 220, 640, 380, 720);
    glow.addColorStop(0, 'rgba(0, 0, 0, 0)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0.32)');
    context.fillStyle = glow;
    context.fillRect(0, FIELD.hudHeight, FIELD.width, FIELD.height - FIELD.hudHeight);
  }

  /** Paint one frame: the room, its people and machines, then the HUD or a panel. */
  function draw(state, screen, best, time) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state);
    drawCover(state);
    drawExit(state);
    drawLoot(state, time);
    drawLasers(state, time);
    drawSmoke(state);
    drawGuards(state);
    drawCameras(state, time);
    drawThief(state, time);
    drawWalls(state);
    drawSafes(state);
    drawVignette();
    drawHud(state);
    drawMinimap(state);
    context.textBaseline = 'alphabetic';
    text('GOAL: Lift the Sunspire Diamond, then reach the SERVICE EXIT — two routes: the carpet hall or the side passage.', FIELD.width / 2, FIELD.height - 30, 15, PALETTE.muted, 'center');
    // The SPOTTED! flash: a red banner and a red edge while the grace runs.
    if (state.graceLeft > 0) {
      const pulse = 0.65 + 0.35 * Math.sin(time * 20);
      context.globalAlpha = pulse;
      context.strokeStyle = PALETTE.alarmHigh;
      context.lineWidth = 6;
      context.strokeRect(3, FIELD.hudHeight + 3, FIELD.width - 6, FIELD.height - FIELD.hudHeight - 6);
      text(`SPOTTED! ${state.spottedBy} saw Rook — break away!`, FIELD.width / 2, FIELD.hudHeight + 52, 30, PALETTE.alarmHigh, 'center');
      context.globalAlpha = 1;
    }
    // The laser-trip flash: a red warning while Rook is standing on a beam.
    if (state.laserTripped) {
      const pulse = 0.65 + 0.35 * Math.sin(time * 18);
      context.globalAlpha = pulse;
      text('LASER TRIP! Get off the beam!', FIELD.width / 2, FIELD.hudHeight + 52, 26, PALETTE.laserHot, 'center');
      context.globalAlpha = 1;
    }
    if (screen === SCREEN_TITLE) {
      drawTitleStrip(state, best);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait. The diamond will not.'], 'Press P to keep stealing', PALETTE.muted);
    } else if (screen === SCREEN_WIN) {
      const breakdown = state.breakdown;
      const lines = [
        `Loot ${breakdown.loot} · Diamond ${breakdown.diamond}`,
        `Time bonus ${breakdown.time} · Coins left ${breakdown.coins}`,
      ];
      if (breakdown.safes > 0) lines.push(`Safes cracked ${breakdown.safes}`);
      lines.push(`TOTAL ${state.score}`, `Best ${best}`);
      drawPanel('CLEAN GETAWAY', lines, 'Press Space to steal again', PALETTE.exit);
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'CAUGHT',
        [state.loseReason, `Score ${state.score}`, `Best ${best}`],
        'Press Space to try again',
        PALETTE.alarmHigh,
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
