import { PALETTE, TAU, clamp, rand } from './constants';
import { ENEMY_TYPES, SPAWN_CONFIG, type EnemyTypeConfig, type SpawnConfig } from './config';
import { glowSprite } from './particles';
import type { World } from './world';

/**
 * enemies.ts — configurable enemy manager.
 *
 * Replaces the old unbounded `ObstacleManager` timer with:
 *   - a hard cap on concurrent enemies (`maxEnemiesAlive`)
 *   - wave-based spawning (`enemiesPerWave`, `waveDelay`)
 *   - a minimum spawn distance from the player (never on top of them)
 *   - weighted enemy-type selection per level
 *   - culling of enemies far outside the action
 *
 * Six behaviours are driven purely by `ENEMY_TYPES` config:
 * normal / fast / tank / ranged / elite / boss.
 */

export interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  health: number;
  maxHealth: number;
  type: EnemyTypeConfig;
  seed: number;
  rot: number;
  vrot: number;
  age: number;
  /** ranged only */
  shootTimer: number;
  hitFlash: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  damage: number;
  life: number;
  color: string;
}

export class EnemyManager {
  list: Enemy[] = [];
  projectiles: Projectile[] = [];

  private cfg: SpawnConfig = { ...SPAWN_CONFIG };
  private playerBullets: Projectile[] = [];
  private waveActive = false;
  private waveRemaining = 0;
  private spawnTimer = 0;
  private waveTimer = 0;
  private difficulty = 1;
  private world: World;

  onDeath: ((e: Enemy) => void) | null = null;

  constructor(world: World) {
    this.world = world;
  }

  /** Apply a level's spawn configuration. */
  configure(partial: Partial<SpawnConfig>) {
    this.cfg = { ...SPAWN_CONFIG, ...partial };
    this.difficulty = this.cfg.difficultyMultiplier;
  }

  get alive() {
    return this.list.length;
  }

  get maxAlive() {
    return this.cfg.maxEnemiesAlive;
  }

  get waveInfo() {
    return { active: this.waveActive, remaining: this.waveRemaining };
  }

  get bullets(): Projectile[] {
    return this.playerBullets;
  }

  reset() {
    this.list = [];
    this.projectiles = [];
    this.playerBullets = [];
    this.waveActive = false;
    this.waveRemaining = 0;
    this.spawnTimer = 0;
    this.waveTimer = this.cfg.waveDelay;
  }

  /** Called when the player fires a shot. */
  addBullet(b: Projectile) {
    this.playerBullets.push(b);
  }

  /* ---------------------------------------------------------------- */
  /*  SPAWNING                                                         */
  /* ---------------------------------------------------------------- */

  private pickType(): EnemyTypeConfig {
    const pool = this.cfg.enemyTypes
      .map((k) => ENEMY_TYPES[k])
      .filter((t): t is EnemyTypeConfig => !!t);
    if (pool.length === 0) return ENEMY_TYPES.normal;

    let total = 0;
    for (const t of pool) total += t.weight;
    let roll = Math.random() * total;
    for (const t of pool) {
      roll -= t.weight;
      if (roll <= 0) return t;
    }
    return pool[pool.length - 1];
  }

  /**
   * Find a spawn point that is:
   *  - inside world bounds and not inside a solid
   *  - at least `minimumSpawnDistanceFromPlayer` from the player
   *  - at most `maximumSpawnDistanceFromPlayer` (so action stays local)
   */
  private findSpawnPoint(px: number, py: number): { x: number; y: number } | null {
    const minD = this.cfg.minimumSpawnDistanceFromPlayer;
    const maxD = this.cfg.maximumSpawnDistanceFromPlayer;
    const pad = 80;

    for (let attempt = 0; attempt < 30; attempt++) {
      const a = Math.random() * TAU;
      const d = rand(minD, maxD);
      const x = clamp(px + Math.cos(a) * d, pad, this.world.width - pad);
      const y = clamp(py + Math.sin(a) * d, pad, this.world.height - pad);

      const dist = Math.hypot(x - px, y - py);
      if (dist < minD) continue;
      if (this.world.isBlocked(x, y)) continue;
      return { x, y };
    }
    return null;
  }

  private spawnOne(px: number, py: number) {
    if (this.list.length >= this.cfg.maxEnemiesAlive) return;
    const point = this.findSpawnPoint(px, py);
    if (!point) return;

    const base = this.pickType();
    const hpScale = this.cfg.progressiveDifficulty ? this.difficulty : 1;
    const health = Math.round(base.health * hpScale);

    this.list.push({
      x: point.x,
      y: point.y,
      vx: 0,
      vy: 0,
      r: base.radius,
      health,
      maxHealth: health,
      type: base,
      seed: Math.random(),
      rot: rand(0, TAU),
      vrot: rand(-2, 2),
      age: 0,
      shootTimer: rand(0.4, base.ranged?.cooldown ?? 2),
      hitFlash: 0,
    });
  }

  /* ---------------------------------------------------------------- */
  /*  UPDATE                                                           */
  /* ---------------------------------------------------------------- */

  update(dt: number, px: number, py: number, onContact: (e: Enemy) => void) {
    if (this.cfg.enabled) this.updateWaves(dt, px, py);
    this.updateEnemies(dt, px, py, onContact);
    this.updateProjectiles(dt, px, py);
    this.updatePlayerBullets(dt);
  }

  private updateWaves(dt: number, px: number, py: number) {
    if (!this.waveActive) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.waveActive = true;
        this.waveRemaining = Math.round(this.cfg.enemiesPerWave * this.difficulty);
        this.spawnTimer = 0;
      }
      return;
    }

    this.spawnTimer -= dt * this.cfg.spawnRate;
    if (this.waveRemaining > 0 && this.spawnTimer <= 0) {
      if (this.list.length < this.cfg.maxEnemiesAlive) {
        this.spawnOne(px, py);
        this.waveRemaining--;
      }
      this.spawnTimer = this.cfg.spawnInterval;
    }

    if (this.waveRemaining <= 0 && this.list.length === 0) {
      this.waveActive = false;
      this.waveTimer = this.cfg.waveDelay;
    }
  }

  private updateEnemies(dt: number, px: number, py: number, onContact: (e: Enemy) => void) {
    const cullD = this.cfg.cullDistance;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.age += dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt * 4);

      const dx = px - e.x;
      const dy = py - e.y;
      const dist = Math.hypot(dx, dy) || 1;

      // Cull enemies that wander far outside the action.
      if (dist > cullD) {
        this.list.splice(i, 1);
        continue;
      }

      const ranged = e.type.ranged;
      if (ranged) {
        // Keep distance and shoot.
        const want = ranged.range * 0.7;
        const dir = dist > want ? 1 : -1;
        const accel = e.type.speed * 4;
        e.vx += (dx / dist) * accel * dir * dt;
        e.vy += (dy / dist) * accel * dir * dt;
        const sp = Math.hypot(e.vx, e.vy);
        const max = e.type.speed;
        if (sp > max) {
          e.vx = (e.vx / sp) * max;
          e.vy = (e.vy / sp) * max;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && dist < ranged.range) {
          e.shootTimer = ranged.cooldown;
          this.projectiles.push({
            x: e.x,
            y: e.y,
            vx: (dx / dist) * ranged.projectileSpeed,
            vy: (dy / dist) * ranged.projectileSpeed,
            r: 7,
            damage: ranged.damage,
            life: 2.2,
            color: ranged.color,
          });
        }
      } else {
        // Melee chasers accelerate toward the player.
        const accel = e.type.speed * 5;
        e.vx += (dx / dist) * accel * dt;
        e.vy += (dy / dist) * accel * dt;
        const sp = Math.hypot(e.vx, e.vy);
        const max = e.type.speed;
        if (sp > max) {
          e.vx = (e.vx / sp) * max;
          e.vy = (e.vy / sp) * max;
        }
      }

      e.rot += e.vrot * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;

      // Keep enemies out of solid geometry (cheap resolution).
      const res = this.world.resolveCircle(e.x, e.y, e.r);
      e.x = res.x;
      e.y = res.y;

      // Contact with the player.
      const rr = e.r * 0.8 + 14;
      if (dx * dx + dy * dy <= rr * rr) onContact(e);
    }
  }

  private updateProjectiles(dt: number, px: number, py: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0 || this.world.isBlocked(p.x, p.y)) {
        this.projectiles.splice(i, 1);
        continue;
      }
      const dx = px - p.x;
      const dy = py - p.y;
      const rr = p.r + 14;
      if (dx * dx + dy * dy <= rr * rr) {
        this.projectiles.splice(i, 1);
        this.onPlayerHit?.(p.damage, p.x, p.y);
      }
    }
  }

  onPlayerHit: ((damage: number, x: number, y: number) => void) | null = null;

  private updatePlayerBullets(dt: number) {
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const b = this.playerBullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.life <= 0 || this.world.isBlocked(b.x, b.y)) {
        this.playerBullets.splice(i, 1);
        continue;
      }

      let hit = false;
      for (let j = this.list.length - 1; j >= 0; j--) {
        const e = this.list[j];
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        const rr = b.r + e.r;
        if (dx * dx + dy * dy <= rr * rr) {
          hit = true;
          this.damageEnemy(j, b.damage);
          break;
        }
      }
      if (hit) this.playerBullets.splice(i, 1);
    }
  }

  /** Apply damage to the enemy at `index`; kills it if health drops to zero. */
  damageEnemy(index: number, amount: number) {
    const e = this.list[index];
    if (!e) return;
    e.health -= amount;
    e.hitFlash = 1;
    if (e.health <= 0) {
      this.list.splice(index, 1);
      this.onDeath?.(e);
    }
  }

  /**
   * Find the nearest enemy within `range` of (x,y). Used by the player's
   * auto-fire so combat stays simple (no manual aiming needed).
   */
  nearestInRange(x: number, y: number, range: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = range * range;
    for (const e of this.list) {
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /* ---------------------------------------------------------------- */
  /*  RENDER                                                           */
  /* ---------------------------------------------------------------- */

  render(ctx: CanvasRenderingContext2D, camInView: (x: number, y: number, pad: number) => boolean) {
    // Enemy projectiles.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.projectiles) {
      const spr = glowSprite(p.color);
      const gs = p.r * 4;
      ctx.drawImage(spr, p.x - gs / 2, p.y - gs / 2, gs, gs);
    }
    ctx.restore();

    // Player bullets.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.playerBullets) {
      const spr = glowSprite(PALETTE.cyan);
      const gs = b.r * 4;
      ctx.drawImage(spr, b.x - gs / 2, b.y - gs / 2, gs, gs);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Enemies (frustum-culled).
    for (const e of this.list) {
      if (!camInView(e.x, e.y, e.r + 60)) continue;
      ctx.save();
      ctx.translate(e.x, e.y);

      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6;
      const spr = glowSprite(e.type.color);
      const gs = e.r * 4;
      ctx.drawImage(spr, -gs / 2, -gs / 2, gs, gs);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      ctx.rotate(e.rot);
      const flash = e.hitFlash;
      ctx.fillStyle = flash > 0 ? '#ffffff' : e.type.color;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;

      const sides = e.type.sides;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * TAU;
        const vx = Math.cos(a) * e.r;
        const vy = Math.sin(a) * e.r;
        if (i === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Eye / core.
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(e.r * 0.28, 0, e.r * 0.22, 0, TAU);
      ctx.fill();

      // Boss: extra ring.
      if (e.type.key === 'boss') {
        ctx.strokeStyle = 'rgba(255,209,102,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, e.r * 1.35, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();

      // Health bar (only when damaged or elite/boss).
      if (e.health < e.maxHealth) {
        const w = e.r * 2.2;
        const hp = Math.max(0, e.health / e.maxHealth);
        ctx.save();
        ctx.translate(e.x, e.y - e.r - 10);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(-w / 2, -3, w, 5);
        ctx.fillStyle = hp > 0.5 ? PALETTE.green : hp > 0.25 ? PALETTE.gold : PALETTE.red;
        ctx.fillRect(-w / 2, -3, w * hp, 5);
        ctx.restore();
      }
    }
  }

  /** Simple world-space collision query used by player bullets/tasks. */
  countInRadius(x: number, y: number, r: number): number {
    let n = 0;
    const r2 = r * r;
    for (const e of this.list) {
      if ((e.x - x) ** 2 + (e.y - y) ** 2 <= r2) n++;
    }
    return n;
  }
}