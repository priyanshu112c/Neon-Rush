import { PALETTE, rand, clamp } from './constants';
import { ParticleSystem, glowSprite } from './particles';

export class Background {
  private grid: HTMLCanvasElement | null = null;
  private ambient = new ParticleSystem(140);
  private spawnTimer = 0;
  private time = 0;

  resize(w: number, h: number) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,229,255,0.055)';
    g.lineWidth = 1;
    const step = clamp(w / 18, 36, 72);
    for (let x = step; x < w; x += step) {
      g.beginPath();
      g.moveTo(x + 0.5, 0);
      g.lineTo(x + 0.5, h);
      g.stroke();
    }
    for (let y = step; y < h; y += step) {
      g.beginPath();
      g.moveTo(0, y + 0.5);
      g.lineTo(w, y + 0.5);
      g.stroke();
    }
    this.grid = c;
  }

  update(dt: number, w: number, h: number) {
    this.time += dt;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.22;
      const color = Math.random() < 0.5 ? PALETTE.cyan : PALETTE.purple;
      this.ambient.spawn({
        x: rand(0, w),
        y: h + 10,
        vx: rand(-8, 8),
        vy: rand(-20, -9),
        life: rand(4, 8),
        size: rand(2, 5),
        color,
        drag: 1,
        shrink: false,
      });
    }
    this.ambient.update(dt);
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#070a1c');
    g.addColorStop(1, '#05060f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.nebula(ctx, w * 0.24 + Math.sin(this.time * 0.2) * w * 0.08, h * 0.28 + Math.cos(this.time * 0.15) * h * 0.08, w * 0.5, PALETTE.purple, 0.045);
    this.nebula(ctx, w * 0.78 + Math.cos(this.time * 0.13) * w * 0.1, h * 0.66 + Math.sin(this.time * 0.18) * h * 0.1, w * 0.55, PALETTE.cyan, 0.045);
    ctx.restore();

    if (this.grid) ctx.drawImage(this.grid, 0, 0);

    this.ambient.render(ctx);
  }

  private nebula(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number) {
    const spr = glowSprite(color);
    ctx.globalAlpha = a;
    ctx.drawImage(spr, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }
}