import { PALETTE, TAU, clamp, rand, hexA } from './constants';
import { glowSprite } from './particles';

export interface Orb {
  x: number;
  y: number;
  r: number;
  phase: number;
  spin: number;
}

export class OrbManager {
  list: Orb[] = [];
  private target = 4;

  reset(w: number, h: number) {
    this.list = [];
    for (let i = 0; i < this.target; i++) this.spawn(w, h);
  }

  private spawn(w: number, h: number) {
    const r = clamp(Math.min(w, h) * 0.022, 8, 15);
    const m = r * 4;
    this.list.push({
      x: rand(m, w - m),
      y: rand(m, h - m),
      r,
      phase: rand(0, TAU),
      spin: rand(-2, 2),
    });
  }

  ensure(w: number, h: number) {
    while (this.list.length < this.target) this.spawn(w, h);
  }

  update(dt: number) {
    for (const o of this.list) o.phase += dt * 3;
  }

  removeAt(i: number) {
    this.list.splice(i, 1);
  }

  render(ctx: CanvasRenderingContext2D) {
    for (const o of this.list) {
      const pulse = 1 + Math.sin(o.phase) * 0.18;
      const r = o.r * pulse;
      ctx.save();
      ctx.translate(o.x, o.y);

      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.8;
      const spr = glowSprite(PALETTE.green);
      const gs = r * 3.4;
      ctx.drawImage(spr, -gs / 2, -gs / 2, gs, gs);

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.rotate(o.spin);
      ctx.strokeStyle = 'rgba(57,255,136,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.25, 0, TAU);
      ctx.stroke();

      const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, r);
      grad.addColorStop(0, '#d8fff0');
      grad.addColorStop(0.35, PALETTE.green);
      grad.addColorStop(1, hexA(PALETTE.green, '33'));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();

      ctx.restore();
    }
  }
}