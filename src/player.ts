import { PALETTE, TAU, hexA } from './constants';
import { PLAYER_CONFIG } from './config';
import { ParticleSystem, glowSprite } from './particles';
import type { World } from './world';

/**
 * player.ts — the player ship.
 *
 * Movement/visuals are preserved from the original arcade build; the open-world
 * upgrade adds health, invulnerability frames and a small auto-fire weapon so
 * objective types like "eliminate enemies" are actually achievable.
 */
export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  r = PLAYER_CONFIG.radius;
  accel = PLAYER_CONFIG.accel;
  maxSpeed = PLAYER_CONFIG.maxSpeed;
  friction = PLAYER_CONFIG.friction;

  health: number = PLAYER_CONFIG.maxHealth;
  maxHealth: number = PLAYER_CONFIG.maxHealth;
  /** Remaining invulnerability, in seconds. */
  invuln = 0;
  private fireTimer = 0;
  private trailTimer = 0;

  constructor(private particles: ParticleSystem) {}

  reset(world: World) {
    this.x = world.spawnX;
    this.y = world.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.health = this.maxHealth;
    this.invuln = 0;
    this.fireTimer = 0;
  }

  get isInvulnerable() {
    return this.invuln > 0;
  }

  get dead() {
    return this.health <= 0;
  }

  /**
   * Advance movement and timers.
   * @returns `fired` is true when the caller should spawn a bullet this frame.
   */
  update(
    dt: number,
    world: World,
    ax: number,
    ay: number,
    moveMag: number,
    pointerActive: boolean,
    px: number,
    py: number,
  ): { fired: boolean } {
    let dirX = 0;
    let dirY = 0;
    let scale = 1;
    let moving = false;

    if (pointerActive) {
      // Desktop mouse: steer toward the pointer at full speed.
      const dx = px - this.x;
      const dy = py - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        dirX = dx / d;
        dirY = dy / d;
        moving = true;
      }
    } else if (ax !== 0 || ay !== 0) {
      // Keyboard (mag 1) or analog joystick (mag 0..1).
      const len = Math.hypot(ax, ay) || 1;
      dirX = ax / len;
      dirY = ay / len;
      scale = moveMag > 0 ? moveMag : 1;
      moving = true;
    }

    if (moving) {
      this.vx += dirX * this.accel * scale * dt;
      this.vy += dirY * this.accel * scale * dt;
      const sp = Math.hypot(this.vx, this.vy);
      const cap = this.maxSpeed * scale;
      if (sp > cap) {
        this.vx = (this.vx / sp) * cap;
        this.vy = (this.vy / sp) * cap;
      }
    } else {
      const f = Math.pow(this.friction, dt * 60);
      this.vx *= f;
      this.vy *= f;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Open-world collision + boundary clamp.
    const res = world.resolveCircle(this.x, this.y, this.r);
    this.x = res.x;
    this.y = res.y;

    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);

    // Auto-fire timer.
    this.fireTimer -= dt;
    let fired = false;
    if (this.fireTimer <= 0) {
      this.fireTimer = PLAYER_CONFIG.fireInterval;
      fired = true;
    }

    this.trailTimer -= dt;
    if (this.trailTimer <= 0 && (moving || Math.hypot(this.vx, this.vy) > 20)) {
      this.trailTimer = 0.016;
      this.particles.spawn({
        x: this.x + (Math.random() - 0.5) * 6,
        y: this.y + (Math.random() - 0.5) * 6,
        vx: -this.vx * 0.08,
        vy: -this.vy * 0.08,
        life: 0.35,
        size: this.r * 0.9,
        color: PALETTE.cyan,
        drag: 0.92,
      });
    }

    return { fired };
  }

  /** Apply damage unless invulnerable. Returns true if the hit landed. */
  hurt(amount: number): boolean {
    if (this.invuln > 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.invuln = PLAYER_CONFIG.invulnTime;
    this.particles.burst(this.x, this.y, PALETTE.red, 24, { speed: 260, size: 6 });
    return true;
  }

  heal(amount: number) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Flicker while invulnerable.
    if (this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0) ctx.globalAlpha = 0.45;

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= 0.85;
    const glow = glowSprite(PALETTE.cyan);
    const gs = this.r * 3.2;
    ctx.drawImage(glow, -gs / 2, -gs / 2, gs, gs);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0 ? 0.5 : 1;
    ctx.rotate(Math.atan2(this.vy, this.vx));

    const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, this.r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, PALETTE.cyan);
    grad.addColorStop(1, hexA(PALETTE.cyan, '22'));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.r * 0.62, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(this.r * 1.25, 0);
    ctx.lineTo(-this.r * 0.55, -this.r * 0.7);
    ctx.lineTo(-this.r * 0.2, 0);
    ctx.lineTo(-this.r * 0.55, this.r * 0.7);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}