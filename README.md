# 🎮 Neon Rush — Open World

> **A fast, futuristic top-down arcade survival game set in a large procedurally-generated open world.**
> Explore a 3600 × 2600 neon wasteland, fight hostile machines with auto-aiming weapons,
> complete mission objectives, level up your rank and extract before your hull is destroyed.

DEMO ----------- [https://neon-rush-io.netlify.app/]

Built from scratch with **TypeScript** and the **Canvas 2D API** — **zero runtime dependencies**, **100% procedural art & audio**.

---

## 📖 Table of Contents

- [About the Game](#-about-the-game)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Controls](#-controls)
- [Gameplay](#-gameplay)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Gameplay Tuning](#-gameplay-tuning)
- [Scripts](#-scripts)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🚀 About the Game

**Neon Rush** began as a single-screen endless arcade survival game and was upgraded into a
full **open-world, objective-driven** experience. Instead of dodging obstacles on one static
screen, you now pilot a ship through a sprawling world of buildings, roads, rocks and points
of interest — fighting waves of enemies, chasing mission goals and extracting from each level.

The design philosophy is **data-driven**: level layouts, enemy balance, world generation and
player tuning are all controlled from a single central config, so designers can rebalance the
game without touching engine code.

---

## ✨ Features

- 🌍 **Large open world** — a deterministic 3600 × 2600 map with buildings, roads, rocks, trees, crates and discoverable points of interest.
- 🎥 **Smooth follow camera** — exponential, frame-rate-independent lerp with world-bounds clamping and screen shake.
- 🤖 **6 enemy behaviours** — Drifter, Zipper, Bulwark, Sentry, Elite Drifter and the Overlord boss.
- 🌊 **Configurable wave spawning** — hard concurrency cap, minimum/maximum spawn distance, per-level enemy pools and off-screen spawning.
- 🎯 **Reusable task system** — `kill`, `collect`, `reach`, `survive`, `protect`, `clear` and `boss` objectives.
- 🗺️ **7 hand-authored levels** — from a simple first contact to a boss fight and an endless watch.
- ⚔️ **Auto-fire combat** — your weapon locks onto the nearest enemy in range; focus on movement, not aiming.
- ❤️ **Health, i-frames & pickups** — survive contact damage and grab health drops from fallen enemies.
- 🧭 **Open-world HUD** — objective panel, health bar, live minimap with compass and an off-screen objective chevron.
- ⭐ **Persistent progression** — high score, XP and rank saved to `localStorage`.
- 🔊 **Procedural audio** — all sound effects synthesised with the WebAudio API; no audio files.
- 🎨 **Fully procedural visuals** — gradients, cached glow sprites and particle systems; no image assets.
- 📱 **Keyboard, mouse and touch** input support.
- 📦 **Zero runtime dependencies** — only `typescript` and `vite` as dev tools.

---

## 🛠 Tech Stack

| Layer | Technology |
| --- | --- |
| Language | **TypeScript 5.6** (strict mode) |
| Bundler / Dev Server | **Vite 5.4** |
| Rendering | **HTML5 Canvas 2D** |
| Audio | **WebAudio API** (oscillators + noise buffers) |
| Persistence | **localStorage** |
| Fonts | Orbitron & Rajdhani (Google Fonts) |
| Runtime deps | **None** |

---

## 🏁 Getting Started

### Prerequisites

- [**Node.js**](https://nodejs.org/) **18+** (includes `npm`)

### Installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd <your-repo-folder>

# 2. Install dev dependencies
npm install
```

### Run in development

```bash
npm run dev
```

Opens a Vite dev server at **http://localhost:5173** with hot module replacement.

### Build for production

```bash
npm run build     # outputs a static bundle to dist/
npm run preview   # serve the production build at http://localhost:4173
```

### Type-check

```bash
npm run typecheck   # tsc --noEmit
```

---

## 🎮 Controls

| Action | Keys / Input |
| --- | --- |
| Move | `W` `A` `S` `D` or `↑` `↓` `←` `→` |
| Move (pointer) | Click / drag or touch — the ship steers toward the pointer |
| Pause / Resume | `P` or `Esc` |
| Confirm / Start | `Space` or `Enter` |
| Fire weapon | **Automatic** — no input required |

> The weapon auto-acquires the **nearest enemy within attack range** and fires on a fixed
> cooldown, so movement and positioning are the core skill.

---

## 🕹 Gameplay

### The Open World

The world is generated deterministically from a fixed seed, so the map is identical every run.

| Property | Value |
| --- | --- |
| World size | **3600 × 2600** px |
| Buildings | 26 (solid) |
| Rocks | 38 (solid) |
| Crates | 22 (solid) |
| Trees / decor | 44 |
| Points of interest | 6 |
| Spawn clearance | 300 px around world centre |

Solid objects (buildings, rocks, crates) block movement through **circle-vs-rectangle collision
resolution**, and everything is **frustum-culled** at render time for performance.
Points of interest are *discovered* as you approach them and are marked on the minimap.

### Combat

- Your ship **auto-fires** at the nearest enemy within **520 px**.
- Bullets travel at **780 px/s** and deal **22 damage**.
- Taking a hit triggers **0.9 s of invulnerability** with a visual flicker.
- Killing enemies builds a **combo multiplier** (up to **8×**) that multiplies score.
- Enemies have a **28% chance** to drop a health pickup worth **+25 HP**.

### Enemies

Six enemy archetypes, all driven purely by config:

| Key | Name | HP | Speed | Damage | Score | Behaviour |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `normal` | Drifter | 42 | 108 | 16 | 10 | Balanced melee chaser |
| `fast` | Zipper | 24 | 212 | 10 | 14 | Fragile but very fast |
| `tank` | Bulwark | 150 | 68 | 28 | 26 | Slow, heavily armoured |
| `ranged` | Sentry | 52 | 84 | 8 | 20 | Fires projectiles from 440 px |
| `elite` | Elite Drifter | 118 | 138 | 22 | 40 | Tough, aggressive elite |
| `boss` | Overlord | 950 | 92 | 34 | 400 | Level 5 boss, extra armour ring |

Enemies **cull** themselves if they wander more than **2400 px** from the player, keeping the
action local.

### Objectives & Levels

Seven hand-authored levels, each with its own spawn configuration, task list and XP reward:

| # | Name | Objective Highlights |
| --- | --- | --- |
| 1 | **First Contact** | Eliminate 5 enemies, reach the extraction point |
| 2 | **Scavenger Run** | Collect 6 energy cores, kill 6 enemies |
| 3 | **The Abandoned District** | Kill 10, clear the district, reach extraction |
| 4 | **Hold the Line** | Survive 45 s, kill 12 |
| 5 | **Overlord** | Destroy the boss, kill 8 guards |
| 6 | **Multi-Objective** | Kill 14, collect 5 cores, reach extraction |
| 7 | **Endless Watch** | Survive 60 s, kill 18 |

The task system supports seven objective types out of the box:
`kill`, `collect`, `reach`, `survive`, `protect`, `clear`, `boss`.

### Progression

- **Score** — earned from kills, multiplied by your current combo.
- **Combo** — increases per kill (max 8×), resets after 3.5 s without a kill.
- **XP & Rank** — each level grants XP; **Rank = 1 + floor(XP / 100)**.
- **High score** — persisted in `localStorage['neon-rush-high']`.
- **Sound preference** — persisted in `localStorage['neon-rush-sound']`.

---

## 🏗 Architecture

The codebase follows a **class-per-system** design with a central `Game` orchestrator and no
runtime dependencies.

### Game Loop

A single `requestAnimationFrame` loop in `Game`:

```
loop(t):
  dt = clamp((t - lastTime) / 1000, 0, 0.05)   // frame-time clamp
  bg.update · particles.update · floaters · shake decay · ui.update · camera.update
  if state === 'playing': update(dt)
  render()
```

`update(dt)` order:

```
progression → read input → player movement (world space + collision) → auto-fire
→ enemies (waves + AI + projectiles) → pickups → world discovery
→ task events → camera follow → HUD → level complete? / death?
```

### Coordinate System & Camera

The player lives **entirely in world space** — `player.x` / `player.y` are the single source of
truth. Screen position is *derived* at render time and never stored:

```
screenX = worldX - camera.offsetX
screenY = worldY - camera.offsetY
```

Every world-space layer (world, pickups, enemies, bullets, player, particles, floaters) is drawn
inside a shared `camera.apply(ctx)` transform, so **all entities stay anchored to their world
position** as the camera scrolls. The minimap and the off-screen objective chevron deliberately
render in screen space.

**Camera follow** uses a frame-rate-independent exponential lerp:

```ts
t = 1 - Math.exp(-speed * dt)   // speed = GAME_CONFIG.cameraLerp (6)
x += (targetX - x) * t
```

The camera target is the player's **post-movement** position, so there is never a stale-frame
lag. `clampToWorld()` guarantees the view never shows anything outside the world bounds:

```
x ∈ [0, worldWidth  - viewportWidth ]
y ∈ [0, worldHeight - viewportHeight]
```

### Module Reference

| Module | Responsibility |
| --- | --- |
| `main.ts` | Bootstrap — creates `Game(canvas)`, exposes `window.__game` for debugging |
| `game.ts` | Core orchestrator — state machine, main loop, collisions, rendering |
| `config.ts` | **Central tuning layer** — all balance numbers live here |
| `constants.ts` | Palette, `TAU`, math helpers, time formatting |
| `camera.ts` | Smooth follow, world clamping, world↔screen conversion, screen shake |
| `world.ts` | Seeded open-world generation, collision queries, culled rendering, minimap |
| `player.ts` | Movement, health, i-frames, auto-fire, trail particles |
| `enemies.ts` | Wave spawning, 6 AI behaviours, projectiles, culling |
| `tasks.ts` | Reusable objective/task system |
| `levels.ts` | Data-driven `LEVELS[]` definitions |
| `particles.ts` | Particle system + cached `glowSprite()` helper |
| `background.ts` | Animated menu background (grid, nebula, ambient particles) |
| `input.ts` | Keyboard + pointer input manager |
| `progression.ts` | Score, combo, XP, rank, difficulty ramp, persistence |
| `ui.ts` | DOM controller for all screens and HUD elements |
| `audio.ts` | Procedural WebAudio sound effects |
| `style.css` | All styling (CSS custom properties, neon theme) |

> **Legacy modules:** `obstacles.ts` and `orbs.ts` are superseded by `enemies.ts` and the
> task/pickup systems. They remain in the repo but are **no longer wired into the loop**.

---

## 📁 Project Structure

```
.
├── index.html            # App shell — canvas + all HUD/screen markup
├── package.json          # Scripts + dev dependencies
├── tsconfig.json         # Strict TypeScript config
├── vite.config.ts        # Vite dev server / build config
├── GAME_ANALYSIS.md      # Phase-1 design analysis (pre-upgrade)
├── README.md
└── src/
    ├── main.ts           # Entry point
    ├── game.ts           # Game orchestrator
    ├── config.ts         # ⭐ Central tuning
    ├── constants.ts
    ├── camera.ts
    ├── world.ts
    ├── player.ts
    ├── enemies.ts
    ├── tasks.ts
    ├── levels.ts
    ├── particles.ts
    ├── background.ts
    ├── input.ts
    ├── progression.ts
    ├── ui.ts
    ├── audio.ts
    ├── style.css
    ├── obstacles.ts      # (legacy)
    └── orbs.ts           # (legacy)
```

---

## 🎚 Gameplay Tuning

Almost everything a designer wants to tweak lives in **`src/config.ts`**:

| Constant | Purpose |
| --- | --- |
| `ENEMY_TYPES` | Per-enemy health, speed, radius, damage, score, weight, shape |
| `PLAYER_CONFIG` | Health, speed, fire rate, bullet damage, attack range, drop chance |
| `WORLD_CONFIG` | World size, object counts, spawn clearance |
| `SPAWN_CONFIG` | Wave size, alive cap, spawn interval, spawn distance, cull distance |
| `GAME_CONFIG` | Camera smoothing, difficulty ramp, minimap settings |

**Quick difficulty knobs** (top of `config.ts`):

```ts
export const ENEMIES_PER_WAVE = 5;    // enemies per wave at level 1
export const MAX_ENEMIES_ALIVE = 8;   // hard concurrency ceiling
export const SPAWN_INTERVAL  = 2.6;   // seconds between spawns
export const WAVE_DELAY      = 5;     // breather after a wave is cleared
```

**Adding a level** — append an entry to `LEVELS` in `src/levels.ts`:

```ts
{
  id: 8,
  name: 'NEW MISSION',
  description: 'Briefing text shown on the intro screen.',
  area: { x: 0, y: 0, w: 3600, h: 2600 },
  difficulty: 8,
  reward: 400,
  next: null,                     // null ends the campaign
  spawn: { enemiesPerWave: 16, enemyTypes: ['normal', 'fast', 'elite'] },
  tasks: [
    { type: 'kill', label: 'Eliminate enemies', amount: 20 },
    { type: 'reach', label: 'Reach extraction', amount: 90, x: 3400, y: 2400 },
  ],
}
```

---

## 📜 Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR (port 5173) |
| `npm run build` | Type-check & bundle for production into `dist/` |
| `npm run preview` | Preview the production build (port 4173) |
| `npm run typecheck` | Run `tsc --noEmit` |

---

## 🗺 Roadmap

- [ ] Additional biomes and world seeds
- [ ] Weapon variety and upgrades
- [ ] Minimap fog-of-war & fast travel
- [ ] Controller / gamepad support
- [ ] Settings menu (volume, difficulty, rebinding)
- [ ] High-score leaderboard

---

## 📄 License

This project is provided for educational and personal use.
Add a `LICENSE` file (e.g. MIT) if you intend to distribute it.

---

<p align="center"><strong>NEON RUSH</strong> — Explore. Fight. Survive.</p>
