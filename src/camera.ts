import { clamp } from './constants';
import { GAME_CONFIG } from './config';

/**
 * Camera — keeps the player centred while never showing anything outside the
 * world bounds. All rendering is done in world space after `apply(ctx)`.
 */
export class Camera {
  /** Top-left corner of the view, in world coordinates. */
  x = 0;
  y = 0;
  w = 1;
  h = 1;

  private worldW = 1;
  private worldH = 1;

  private shakeMag = 0;
  private shakeX = 0;
  private shakeY = 0;

  setViewport(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.clampToWorld();
  }

  setWorld(w: number, h: number) {
    this.worldW = w;
    this.worldH = h;
    this.clampToWorld();
  }

  /** Jump immediately so `(x, y)` is centred. */
  centerOn(x: number, y: number) {
    this.x = x - this.w / 2;
    this.y = y - this.h / 2;
    this.clampToWorld();
  }

  /** Frame-rate independent smooth follow. */
  follow(tx: number, ty: number, dt: number, speed = GAME_CONFIG.cameraLerp) {
    const targetX = tx - this.w / 2;
    const targetY = ty - this.h / 2;
    const t = 1 - Math.exp(-speed * dt);
    this.x += (targetX - this.x) * t;
    this.y += (targetY - this.y) * t;
    this.clampToWorld();
  }

  private clampToWorld() {
    if (this.worldW <= this.w) this.x = (this.worldW - this.w) / 2;
    else this.x = clamp(this.x, 0, this.worldW - this.w);

    if (this.worldH <= this.h) this.y = (this.worldH - this.h) / 2;
    else this.y = clamp(this.y, 0, this.worldH - this.h);
  }

  addShake(mag: number) {
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  update(dt: number) {
    if (this.shakeMag > 0) {
      this.shakeMag = Math.max(0, this.shakeMag - dt * 46);
      const a = Math.random() * Math.PI * 2;
      this.shakeX = Math.cos(a) * this.shakeMag;
      this.shakeY = Math.sin(a) * this.shakeMag;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  get offsetX() {
    return this.x + this.shakeX;
  }

  get offsetY() {
    return this.y + this.shakeY;
  }

  /** Apply the world→screen transform. Must be paired with ctx.restore(). */
  apply(ctx: CanvasRenderingContext2D) {
    ctx.translate(-Math.round(this.offsetX), -Math.round(this.offsetY));
  }

  toWorldX(screenX: number) {
    return screenX + this.offsetX;
  }

  toWorldY(screenY: number) {
    return screenY + this.offsetY;
  }

  toScreenX(worldX: number) {
    return worldX - this.offsetX;
  }

  toScreenY(worldY: number) {
    return worldY - this.offsetY;
  }

  /** Cheap frustum test used to skip rendering off-screen objects. */
  inView(x: number, y: number, pad = 80) {
    const sx = x - this.offsetX;
    const sy = y - this.offsetY;
    return sx > -pad && sx < this.w + pad && sy > -pad && sy < this.h + pad;
  }
}