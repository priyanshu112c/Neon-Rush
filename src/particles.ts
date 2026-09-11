import { hexA, TAU, rand } from './constants';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  drag: number;
  gravity: number;
  shrink: boolean;
}

const spriteCache = new Map<string, HTMLCanvasElement>();

/** Returns (and caches) a soft radial glow sprite for a given color. */
export function glowSprite(color: string): HTMLCanvasElement {
  let c = spriteCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, hexA(color, '77'));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  spriteCache.set(color, c);
  return c;
}

export class ParticleSystem {
  private pool: Particle[] = [];

  constructor(private cap = 700) {}

  spawn(opts: {
    x: number;
    y: number;
    vx?: number;
    vy?: number;
    life?: number;
    size?: number;
    color: string;
    drag?: number;
    gravity?: number;
    shrink?: boolean;
  }) {
    if (this.pool.length >= this.cap) this.pool.shift();
    this.pool.push({
      x: opts.x,
      y: opts.y,
      vx: opts.vx ?? 0,
      vy: opts.vy ?? 0,
      life: opts.life ?? 0.6,
      maxLife: opts.life ?? 0.6,
      size: opts.size ?? 6,
      color: opts.color,
      drag: opts.drag ?? 0.9,
      gravity: opts.gravity ?? 0,
      shrink: opts.shrink ?? true,
    });
  }

  burst(
    x: number,
    y: number,
    color: string,
    count: number,
    opts: { speed?: number; life?: number; size?: number } = {},
  ) {
    const speed = opts.speed ?? 160;
    const life = opts.life ?? 0.7;
    const size = opts.size ?? 7;
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const s = rand(speed * 0.25, speed);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(life * 0.5, life),
        size: rand(size * 0.5, size * 1.4),
        color,
        drag: 0.9,
      });
    }
  }

  update(dt: number) {
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.pool) {
      const t = p.life / p.maxLife;
      const size = p.size * (p.shrink ? t : 1);
      ctx.globalAlpha = t;
      const spr = glowSprite(p.color);
      ctx.drawImage(spr, p.x - size, p.y - size, size * 2, size * 2);
      ctx.globalAlpha = t * 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, size * 0.18, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  clear() {
    this.pool.length = 0;
  }
}