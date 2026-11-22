// Drawing only: the game's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with the backdrop colour. The HUD
// band sits across the top of the field; the gallery room runs below it, so the alarm meter,
// timer, score, loot and coins are always on screen with the room itself.
import { CAMERA, FIELD, FONT, GUARD, PALETTE, SCORE, THIEF } from './config.js';
import { ROOM } from './level.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const TILE = 64;
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
    for (let ty = 0; ty < Math.ceil(ROOM.height / TILE); ty += 1) {
      for (let tx = 0; tx < Math.ceil(ROOM.width / TILE); tx += 1) {
        context.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(ROOM.x + tx * TILE, ROOM.y + ty * TILE, TILE, TILE);
      }
    }
    // The red carpet runner from the service exit to the vault.
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
    for (const solid of state.level.solids.slice(0, 3)) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(solid.x, solid.y, solid.width, solid.height);
      context.fillStyle = PALETTE.wallTop;
      context.fillRect(solid.x, solid.y, solid.width, 4);
    }
  }

  function drawCover(state) {
    for (const solid of state.level.solids.slice(3)) {
      const isCase = solid.width >= 110 && solid.height <= 60;
      context.fillStyle = isCase ? PALETTE.pedestal : PALETTE.crate;
      context.fillRect(solid.x, solid.y, solid.width, solid.height);
      context.fillStyle = PALETTE.loot;
      context.fillRect(solid.x, solid.y, solid.width, 3);
      if (!isCase) {
        context.strokeStyle = 'rgba(0,0,0,0.35)';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(solid.x, solid.y + solid.height / 2);
        context.lineTo(solid.x + solid.width, solid.y + solid.height / 2);
        context.stroke();
      }
    }
    for (const plant of state.level.plants) {
      context.fillStyle = PALETTE.plantDark;
      context.beginPath();
      context.arc(plant.x, plant.y, plant.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.plant;
      context.beginPath();
      context.arc(plant.x - 8, plant.y - 6, plant.radius * 0.62, 0, Math.PI * 2);
      context.arc(plant.x + 10, plant.y + 8, plant.radius * 0.55, 0, Math.PI * 2);
      context.fill();
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
      context.arc(diamond.x, diamond.y - 26, 30 + pulse * 8, 0, Math.PI * 2);
      context.fill();
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
      drawCone(guard.x, guard.y, guard.angle, GUARD.sightHalfAngle, GUARD.sightRange, PALETTE.cone, PALETTE.coneEdge);
    }
    for (const guard of state.guards) {
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guardCap;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius, Math.PI, 0);
      context.fill();
      context.strokeStyle = PALETTE.text;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.angle) * (GUARD.radius + 8), guard.y + Math.sin(guard.angle) * (GUARD.radius + 8));
      context.stroke();
      text(guard.name, guard.x, guard.y - GUARD.radius - 8, 13, PALETTE.muted, 'center');
      if (guard.seen) text('!', guard.x, guard.y - GUARD.radius - 24, 22, PALETTE.alarmHigh, 'center');
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      drawCone(camera.x, camera.y, camera.angle, CAMERA.sightHalfAngle, CAMERA.sightRange, PALETTE.camCone, PALETTE.camConeEdge);
    }
    for (const camera of state.cameras) {
      context.fillStyle = PALETTE.camera;
      context.fillRect(camera.x - 9, camera.y - 7, 18, 14);
      context.fillStyle = camera.seen ? PALETTE.alarmHigh : PALETTE.loot;
      context.beginPath();
      context.arc(camera.x + Math.cos(camera.angle) * 8, camera.y + Math.sin(camera.angle) * 8, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawThief(state, time) {
    const thief = state.thief;
    const blink = thief.hidden ? 0.55 : 1;
    context.globalAlpha = blink;
    context.fillStyle = THIEF.sneaking ? PALETTE.thiefDark : PALETTE.thief;
    context.beginPath();
    context.arc(thief.x, thief.y, thief.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#0c1210';
    context.fillRect(thief.x - 8, thief.y - 4, 16, 5);
    context.globalAlpha = 1;
    text('ROOK', thief.x, thief.y - thief.radius - 8, 13, PALETTE.text, 'center');
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

  function drawHud(state) {
    context.fillStyle = PALETTE.hud;
    context.fillRect(0, 0, FIELD.width, FIELD.hudHeight);
    context.fillStyle = PALETTE.hudEdge;
    context.fillRect(0, FIELD.hudHeight - 2, FIELD.width, 2);
    // Alarm meter: label, segmented bar, and the number — the game's heartbeat.
    const barX = 92;
    const barY = 16;
    const barWidth = 300;
    const barHeight = 24;
    text('ALARM', 24, barY + 19, 20, PALETTE.text, 'left');
    const level = state.alarm / 100;
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
    text(alarmLabel(`${Math.round(state.alarm)}%`), barX + barWidth + 10, barY + 19, 20, color, 'left');
    // Timer in the middle, score on the right.
    const minutes = Math.floor(Math.max(0, state.timeLeft) / 60);
    const seconds = Math.floor(Math.max(0, state.timeLeft) % 60);
    const timerText = `${minutes}:${String(seconds).padStart(2, '0')}`;
    text(timeLabel(timerText), FIELD.width / 2, 36, 26, state.timeLeft < 30 ? PALETTE.alarmHigh : PALETTE.text, 'center');
    text(scoreLabel(state.score), FIELD.width - 300, 36, 26, PALETTE.text, 'right');
    // Loot and coins: a diamond outline that fills, and coin pips.
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
    for (let index = 0; index < 3; index += 1) {
      context.fillStyle = index < state.thief.coins ? PALETTE.loot : PALETTE.hudEdge;
      context.beginPath();
      context.arc(diamondX + 30 + index * 20, 26, 7, 0, Math.PI * 2);
      context.fill();
    }
    // Sneaking shows in the empty stretch between the timer and the score, clear of
    // the loot diamond and the coin pips.
    text(state.thief.sneaking ? 'SNEAKING' : '', 790, 36, 16, PALETTE.thief, 'center');
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
    drawGuards(state);
    drawCameras(state);
    drawThief(state, time);
    drawWalls(state);
    drawHud(state);
    context.textBaseline = 'alphabetic';
    text('Steal the Sunspire Diamond, then reach the service exit.', FIELD.width / 2, FIELD.height - 30, 15, PALETTE.muted, 'center');
    if (screen === SCREEN_TITLE) {
      drawPanel(
        'THE GILDED VAULT',
        [
          'Rook slips into the Meridian Gallery after hours.',
          'Guards walk their beats. Cameras sweep the floor.',
          'Dodge the cones, hide in the palms, toss a coin to pull a guard away.',
          `Best score ${best}`,
        ],
        'WASD / arrows to move · Shift to sneak · Click or E to toss a coin · Space to start',
        PALETTE.loot,
      );
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait. The diamond will not.'], 'Press P to keep stealing', PALETTE.muted);
    } else if (screen === SCREEN_WIN) {
      drawPanel(
        'CLEAN GETAWAY',
        [`Score ${state.score}`, `Time left ${Math.ceil(state.timeLeft)}s · Coins left ${state.thief.coins}`, `Best ${best}`],
        'Press Space to steal again',
        PALETTE.exit,
      );
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
