# The Gilded Vault — a heist game

[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/musemosmouses/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/musemosmouses/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

Rook slips into the Meridian Gallery after hours. Guards walk their beats, cameras sweep
the floor, and the Sunspire Diamond waits in the vault alcove. Dodge the vision cones,
hide in the potted palms, toss a lure coin to pull a guard away — lift the diamond and
reach the service exit before the alarm hits 100.

- **Move:** WASD or arrow keys · **Sneak:** Shift (slower, half as noticeable)
- **Toss a lure coin:** click or E (3 coins) · **Pause:** P
- **Win:** grab the diamond, then reach the service exit · **Lose:** alarm hits 100,
  a guard grabs you, or dawn breaks (3:00 on the clock)

A complete original top-down canvas heist game: one room, three patrolling guards with
vision cones, two sweeping security cameras, cover and hiding spots, distraction
throwables, an alarm meter, a timer and a score. Pure static files — open `game/index.html`
in a desktop browser, no network, no build step. Sound is synthesized WebAudio only.

Run the hand-in: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`
