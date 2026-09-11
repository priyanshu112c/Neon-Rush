# GAME_ANALYSIS.md

> Phase 1 analysis of the existing **Neon Rush** project, written before any code changes.

## 1. Project identity

| Item | Value |
| --- | --- |
| Name | `neon-rush` (package.json) |
| Type | Browser 2D arcade game, `<canvas>` 2D context |
| Stack | TypeScript 5.6 (strict) + Vite 5.4 |
| Entry | `index.html` -> `src/main.ts` |
| Build | `npm run dev`, `npm run build`, `npm run typecheck` (`tsc --noEmit`) |
| Deps | **Zero runtime dependencies.** Dev-only: `vite`, `typescript`. |
| Fonts | Orbitron + Rajdhani via Google Fonts (index.html) |

## 2. Current architecture

```
src/
  main.ts          bootstrap: creates Game(canvas), exposes window.__game
  game.ts          Game class - state machine, main loop, collisions, rendering
  constants.ts     PALETTE, TAU, rand/randInt/clamp/lerp/hexA/fmtTime
  player.ts        Player - accel/friction movement, clamped to viewport
  obstacles.ts     ObstacleManager - "enemies" (spike/drone) + cosmetic ring
  orbs.ts          OrbManager - collectible energy orbs
  background.ts    Background - animated grid + nebula + ambient particles
  particles.ts     ParticleSystem + cached glowSprite() helper
  input.ts         InputManager - keyboard + pointer
  progression.ts   Progression - score/combo/time/speed ramp + high score
  ui.ts            UI - DOM screen/HUD controller
  audio.ts         AudioManager - WebAudio SFX
  style.css        All styling
```

There is **no** camera, no world larger than the viewport, no level system, no
task system, no player attack, and no player health.

### Game loop

`Game.loop` (requestAnimationFrame): dt clamp -> `bg.update`, `particles.update`,
floaters, shake decay -> if `state === 'playing'` run `update(dt)` -> `render()`.

`Game.update`: `prog.update` -> `player.update` -> `obstacles.update` ->
`orbs.update` -> `orbs.ensure` -> `checkCollisions` -> HUD setters.

### State machine

`type State = 'menu' | 'playing' | 'paused' | 'gameover'` with
`start()` / `pause()` / `resume()` / `toMenu()` / `gameOver()`.
Pause via `P`/`Escape`; start via `Space`/`Enter`.

## 3. Player movement system

`Player.update(dt, w, h, ax, ay, pointerActive, px, py)`:
- Keyboard axis from `InputManager.getAxis()` (WASD / arrows).
- Pointer mode steers toward the pointer's **screen** coordinate.
- Accelerates along the unit direction, caps at `maxSpeed`, applies
  `friction^(dt*60)` when idle.
- **Clamps to `[r, w-r] x [r, h-r]`** -> hard-locked to the viewport.
- Emits a cyan particle trail.

Sizes derive from the viewport: `r = clamp(min(w,h)*0.032, 10, 18)`,
`maxSpeed = clamp(min(w,h)*0.62, 260, 620)`.

## 4. Player health / damage

**None.** A single contact with a `spike` or `drone` calls `Game.gameOver()`
immediately. No HP, no i-frames.

## 5. Enemy spawning system (the problem)

`ObstacleManager` (src/obstacles.ts):

```ts
this.spawnTimer -= dt * speed;
if (this.spawnTimer <= 0) {
  this.spawnTimer = clamp(1.15 / speed, 0.28, 1.15) * rand(0.8, 1.25);
  this.spawn(w, h, px, py, speed);
}
```

and `Progression.update`:

```ts
this.speed = 1 + this.elapsed * 0.055 + (this.score / 1200) * 0.35;
```

### Why enemies flood the screen - root causes

1. **Unbounded concurrency.** There is **no maximum-enemies-alive check
   anywhere.** The only limit is how fast they leave the screen.
2. **Interval collapses.** `1.15 / speed` hits the `0.28 s` floor after roughly
   55 s of play. At 0.28 s +/-25 % that is ~3.5 enemies/second.
3. **`speed` never plateaus.** It grows linearly with time **and** score, so
   spawn rate keeps accelerating forever.
4. **Spawns are edge-anchored but uncontrolled.** `spawn()` picks a random screen
   edge, so enemies can appear right next to a player near that edge.
5. **A second timer** (`ringTimer`) adds expanding rings on top.
6. **No wave structure.** Nothing gates difficulty to level progress.

## 6. Enemy AI (current)

- `spike`: straight line toward `(w/2, h/2)` blended with the player position
  (`(tx + px*0.35)/1.35`), speed `130 + speed*70`.
- `drone`: steers toward the player, accel `14*speed`, max speed
  `220*(0.7 + speed*0.25)`.
- `ring`: no movement, radius grows; **cosmetic only** (skipped in collisions).

## 7. Collision / detection

`Game.checkCollisions` is a naive O(n) loop:
- orbs: circle-circle vs player -> remove, `bumpCombo()`, `addOrb()`, particles.
- obstacles (skipping `ring`): circle-circle -> `gameOver()`.

No spatial partitioning (fine at current counts).

## 8. Weapons / attacks

**None.** The player cannot damage anything; the only interaction is collecting
orbs and avoiding enemies.

## 9. Map / background rendering

`Background` draws a **screen-fixed** gradient, two additive nebula sprites, a
pre-rendered grid canvas sized to the viewport, and ambient particles. No world
position.

## 10. Camera

**None.** Everything is drawn in screen coordinates.

## 11. Score / progression

`Progression`: `score` (`addOrb`), `combo` (1-8, 3.5 s decay), `maxCombo`,
`elapsed`, `speed` (difficulty ramp), `high` persisted in
`localStorage['neon-rush-high']`. Sound pref in `localStorage['neon-rush-sound']`.

## 12. UI / HUD

`index.html` holds all markup; `UI` toggles `.hidden` on `#menu`, `#hud`,
`#pause`, `#gameover`. HUD = SCORE / BEST / COMBO / SPEED / TIME + sound & pause
buttons. Styling in `style.css` (CSS custom properties for the neon palette).

## 13. Assets

**No external image/audio assets.** Everything is procedural: canvas gradients,
cached `glowSprite` radial gradients, WebAudio oscillators/noise.

## 14. Summary of problems found

| # | Problem | Severity |
| --- | --- | --- |
| P1 | No cap on concurrent enemies | Critical |
| P2 | Spawn interval collapses to a 0.28 s floor | Critical |
| P3 | Difficulty scales with score *and* time, forever | High |
| P4 | Spawns can land on/near the player | High |
| P5 | No wave/level structure | High |
| P6 | No player health -> one touch = instant death | High |
| P7 | No player attack -> "kill enemies" objectives impossible | High |
| P8 | World = one screen; no camera | High |
| P9 | No objectives/levels, only endless survival | High |
| P10 | `ring` obstacles are invisible non-threats | Low |

## 15. Recommended architecture for the upgrade

Keep the class-per-system style and the existing palette/particle/audio code.
**Extend rather than rewrite.**

New modules:

| File | Responsibility |
| --- | --- |
| `src/config.ts` | Central tuning: `WORLD_CONFIG`, `PLAYER_CONFIG`, `ENEMY_TYPES`, `SPAWN_CONFIG`, `GAME_CONFIG` + easy top-level constants |
| `src/camera.ts` | Smooth follow camera, world-bounds clamping, world<->screen conversion |
| `src/world.ts` | Large open world: seeded ground/roads/buildings/decor/POIs, circle-vs-rect collision, culled rendering |
| `src/enemies.ts` | `EnemyManager` - configurable waves, hard alive cap, min-distance spawning, 6 behaviours, projectiles, culling |
| `src/tasks.ts` | Reusable task system (kill/collect/reach/survive/protect/clear/boss) |
| `src/levels.ts` | Data-driven `LEVELS[]` + level metadata |

Rewritten:

| File | Change |
| --- | --- |
| `src/game.ts` | States `intro`/`complete`, camera + world + enemies + tasks + combat/pickups wiring |
| `src/player.ts` | Health, i-frames, auto-fire, world bounds + building resolution (visuals preserved) |
| `src/ui.ts` | Objective panel, health bar, minimap, intro / complete screens |
| `index.html` | New HUD elements + `#level-intro` / `#level-complete` overlays + `#minimap` |
| `src/style.css` | Styles appended for new UI (existing styles untouched) |

Deprecated (kept in repo, no longer driven by the loop):

- `src/obstacles.ts` - `spike`/`drone` superseded by `EnemyManager`.
- `src/background.ts` - still used **behind the main menu**, replaced by `World`
  during gameplay.

Untouched: `src/constants.ts`, `src/particles.ts`, `src/input.ts`,
`src/orbs.ts`, `src/progression.ts`, `src/audio.ts`, `vite.config.ts`,
`tsconfig.json`.

## 16. Target gameplay flow

```
MENU -> LEVEL INTRO -> PLAYING (objective panel + minimap)
     -> MISSION COMPLETE (stats + reward + NEXT LEVEL) -> next LEVEL INTRO
     -> ... or GAME OVER on player death
```

| Level | Enemies/wave | Max alive | Enemy types |
| --- | --- | --- | --- |
| 1 | 5 | 6 | normal |
| 2 | 7 | 8 | normal, fast |
| 3 | 10 | 10 | normal, fast, ranged |
| 4 | 9 | 10 | normal, fast, tank |
| 5 | 8 | 10 | normal, fast, ranged, elite (+boss) |
| 6 | 12 | 12 | all |
| 7 | 14 | 12 | all + elite weighting |