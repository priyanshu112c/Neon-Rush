import { PALETTE, TAU, clamp, rand } from './constants';
import { glowSprite } from './particles';

export type ObstacleKind = 'spike' | 'drone' | 'ring';

export interface Obstacle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vrot: number;
  kind: ObstacleKind;
  seed: number;
  passed: boolean;
  age: number;
}

export class ObstacleManager {
  list: Obstacle[] = [];
  private spawnTimer = 0;
  private ringTimer = 0;

  reset() {
    this.list = [];
    this.spawnTimer = 1.0;
    this.ringTimer = 4.5;
  }

  update(dt: number, w: number, h: number, speed: number, px: number, py: number) {
    this.spawnTimer -= dt * speed;
    this.ringTimer -= dt;

    if (this.spawnTimer <= 0) {
      this.spawnTimer = clamp(1.15 / speed, 0.28, 1.15) * rand(0.8, 1.25);
      this.spawn(w, h, px, py, speed);
    }

    if (this.ringTimer <= 0) {
      this.ringTimer = rand(5.5, 8.5) / Math.min(speed, 2.5);
      this.spawnRing(w, h);
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      o.age += dt;

      if (o.kind === 'drone') {
        const dx = px - o.x;
        const dy = py - o.y;
        const d = Math.hypot(dx, dy) || 1;
        o.vx += (dx / d) * 14 * speed * dt;
        o.vy += (dy / d) * 14 * speed * dt;
        const sp = Math.hypot(o.vx, o.vy);
        const max = 220 * (0.7 + speed * 0.25);
        if (sp > max) {
          o.vx = (o.vx / sp) * max;
          o.vy = (o.vy / sp) * max;
        }
      } else if (o.kind === 'ring') {
        o.r += (180 + speed * 40) * dt;
      }

      o.rot += o.vrot * dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;

      const margin = o.r + 60;
      if (o.kind !== 'ring') {
        if (o.x < -margin || o.x > w + margin || o.y < -margin || o.y > h + margin) {
          this.list.splice(i, 1);
          continue;
        }
      } else if (o.r > Math.hypot(w, h) * 0.75) {
        this.list.splice(i, 1);
      }
    }
  }

  private spawn(w: number, h: number, px: number, py: number, speed: number) {
    const r = clamp(Math.min(w, h) * 0.035, 12, 24) * rand(0.8, 1.25);
    const edge = Math.floor(rand(0, 4));
    let x = 0;
    let y = 0;
    if (edge === 0) {
      x = -r - 10;
      y = rand(0, h);
    } else if (edge === 1) {
      x = w + r + 10;
      y = rand(0, h);
    } else if (edge === 2) {
      x = rand(0, w);
      y = -r - 10;
    } else {
      x = rand(0, w);
      y = h + r + 10;
    }

    const kind: ObstacleKind = Math.random() < 0.3 ? 'drone' : 'spike';

    if (kind === 'drone') {
      const a = rand(0, TAU);
      this.list.push({
        x, y,
        vx: Math.cos(a) * 90,
        vy: Math.sin(a) * 90,
        r: r * 0.95,
        rot: rand(0, TAU),
        vrot: rand(-2, 2),
        kind,
        seed: Math.random(),
        passed: false,
        age: 0,
      });
      return;
    }

    let tx = w / 2;
    let ty = h / 2;
    if (edge === 0) tx = w + 40;
    else if (edge === 1) tx = -40;
    else if (edge === 2) ty = h + 40;
    else ty = -40;
    tx = (tx + px * 0.35) / 1.35;
    ty = (ty + py * 0.35) / 1.35;

    const dx = tx - x;
    const dy = ty - y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = 130 + speed * 70;

    this.list.push({
      x, y,
      vx: (dx / d) * sp,
      vy: (dy / d) * sp,
      r,
      rot: rand(0, TAU),
      vrot: rand(-3, 3),
      kind,
      seed: Math.random(),
      passed: false,
      age: 0,
    });
  }

  private spawnRing(w: number, h: number) {
    this.list.push({
      x: rand(w * 0.15, w * 0.85),
      y: rand(h * 0.15, h * 0.85),
      vx: 0,
      vy: 0,
      r: 20,
      rot: 0,
      vrot: 0,
      kind: 'ring',
      seed: Math.random(),
      passed: false,
      age: 0,
    });
  }

  render(ctx: CanvasRenderingContext2D) {
    for (const o of this.list) {
      ctx.save();
      ctx.translate(o.x, o.y);
      if (o.kind === 'spike') this.drawSpike(ctx, o);
      else if (o.kind === 'drone') this.drawDrone(ctx, o);
      else this.drawRing(ctx, o);
      ctx.restore();
    }
  }

  private drawGlow(ctx: CanvasRenderingContext2D, o: Obstacle, color: string, mult: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7;
    const spr = glowSprite(color);
    const gs = o.r * mult;
    ctx.drawImage(spr, -gs / 2, -gs / 2, gs, gs);
    ctx.restore();
  }

  private drawSpike(ctx: CanvasRenderingContext2D, o: Obstacle) {
    this.drawGlow(ctx, o, PALETTE.red, 4);
    ctx.rotate(o.rot);
    const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, o.r);
    grad.addColorStop(0, '#ff7d9c');
    grad.addColorStop(0.4, PALETTE.red);
    grad.addColorStop(1, '#5a0a1e');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#ff9ab5';
    ctx.lineWidth = 1.5;
    const spikes = 8;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const rad = i % 2 === 0 ? o.r : o.r * 0.55;
      const a = (i / (spikes * 2)) * TAU;
      const vx = Math.cos(a) * rad;
      const vy = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawDrone(ctx: CanvasRenderingContext2D, o: Obstacle) {
    this.drawGlow(ctx, o, PALETTE.magenta, 4.5);
    ctx.rotate(o.rot);
    const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, o.r);
    grad.addColorStop(0, '#ff9ad5');
    grad.addColorStop(0.4, PALETTE.magenta);
    grad.addColorStop(1, '#5a0a3a');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#ffb3e0';
    ctx.lineWidth = 1.5;
    const sides = 6;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU;
      const vx = Math.cos(a) * o.r;
      const vy = Math.sin(a) * o.r;
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(o.r * 0.25, 0, o.r * 0.22, 0, TAU);
    ctx.fill();
  }

  private drawRing(ctx: CanvasRenderingContext2D, o: Obstacle) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = PALETTE.purple;
    ctx.lineWidth = 6;
    ctx.globalAlpha = clamp(1 - o.r / 900, 0.1, 0.9);
    ctx.shadowColor = PALETTE.purple;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, o.r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}