import { PALETTE, TAU, clamp, hexA } from './constants';
import { WORLD_CONFIG } from './config';
import { glowSprite } from './particles';
import type { Camera } from './camera';

/**
 * world.ts — the open-world layer.
 *
 * Generates (from a fixed seed, so it is deterministic) a large map made of
 * ground, roads, buildings, rocks, trees, crates and points of interest.
 * Solid objects (buildings, rocks, crates) block movement via circle-vs-rect
 * resolution; everything is frustum-culled at render time.
 */

export type SolidKind = 'building' | 'rock' | 'crate';

export interface Solid {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: SolidKind;
  color: string;
  seed: number;
}

export interface Decor {
  x: number;
  y: number;
  r: number;
  kind: 'tree' | 'bush';
  color: string;
  seed: number;
}

export type PoiKind = 'camp' | 'loot' | 'safe' | 'objective' | 'hidden';

export interface Poi {
  x: number;
  y: number;
  r: number;
  kind: PoiKind;
  label: string;
  discovered: boolean;
}

/** Deterministic 32-bit hash -> [0,1) RNG. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class World {
  readonly width = WORLD_CONFIG.width;
  readonly height = WORLD_CONFIG.height;

  solids: Solid[] = [];
  decor: Decor[] = [];
  pois: Poi[] = [];
  /** Roads as axis-aligned bands, used only for rendering. */
  roads: { x: number; y: number; w: number; h: number }[] = [];

  private seed: number;

  constructor(seed = 1337) {
    this.seed = seed;
    this.generate();
  }

  /** Player safe spawn point (world centre, guaranteed clear). */
  get spawnX() {
    return this.width / 2;
  }
  get spawnY() {
    return this.height / 2;
  }

  private generate() {
    const rng = makeRng(this.seed);
    const { buildingCount, rockCount, treeCount, crateCount, poiCount, spawnClearance } = WORLD_CONFIG;
    const cx = this.width / 2;
    const cy = this.height / 2;

    // -- Roads: a cross plus a band, purely visual --
    this.roads.push({ x: 0, y: cy - 90, w: this.width, h: 180 });
    this.roads.push({ x: cx - 90, y: 0, w: 180, h: this.height });
    this.roads.push({ x: this.width * 0.2, y: this.height * 0.72, w: this.width * 0.6, h: 140 });

    const clearOfSpawn = (x: number, y: number, r: number) =>
      Math.hypot(x - cx, y - cy) > spawnClearance + r;

    // -- Buildings --
    for (let i = 0; i < buildingCount; i++) {
      let x = 0, y = 0, w = 0, h = 0, tries = 0;
      do {
        w = 160 + rng() * 260;
        h = 140 + rng() * 220;
        x = 160 + rng() * (this.width - w - 320);
        y = 160 + rng() * (this.height - h - 320);
        tries++;
      } while ((!clearOfSpawn(x + w / 2, y + h / 2, Math.max(w, h) / 2) || this.overlaps(x, y, w, h, 60)) && tries < 40);

      const tone = 0.5 + rng() * 0.5;
      this.solids.push({
        x, y, w, h,
        kind: 'building',
        color: `rgba(${Math.round(18 + tone * 22)},${Math.round(26 + tone * 30)},${Math.round(58 + tone * 40)},0.95)`,
        seed: rng(),
      });
    }

    // -- Rocks --
    for (let i = 0; i < rockCount; i++) {
      const r = 26 + rng() * 40;
      let x = 0, y = 0, tries = 0;
      do {
        x = 120 + rng() * (this.width - 240);
        y = 120 + rng() * (this.height - 240);
        tries++;
      } while ((!clearOfSpawn(x, y, r) || this.overlaps(x - r, y - r, r * 2, r * 2, 20)) && tries < 30);
      this.solids.push({ x: x - r, y: y - r, w: r * 2, h: r * 2, kind: 'rock', color: PALETTE.purple, seed: rng() });
    }

    // -- Crates (cover) --
    for (let i = 0; i < crateCount; i++) {
      const s = 40 + rng() * 26;
      let x = 0, y = 0, tries = 0;
      do {
        x = 120 + rng() * (this.width - 240);
        y = 120 + rng() * (this.height - 240);
        tries++;
      } while ((!clearOfSpawn(x, y, s) || this.overlaps(x - s / 2, y - s / 2, s, s, 16)) && tries < 30);
      this.solids.push({ x: x - s / 2, y: y - s / 2, w: s, h: s, kind: 'crate', color: PALETTE.gold, seed: rng() });
    }

    // -- Trees / bushes (non-colliding decor) --
    for (let i = 0; i < treeCount; i++) {
      const r = 22 + rng() * 26;
      const x = 60 + rng() * (this.width - 120);
      const y = 60 + rng() * (this.height - 120);
      if (!clearOfSpawn(x, y, r + 40)) continue;
      this.decor.push({ x, y, r, kind: 'tree', color: PALETTE.green, seed: rng() });
    }
    for (let i = 0; i < treeCount; i++) {
      const r = 12 + rng() * 14;
      const x = 60 + rng() * (this.width - 120);
      const y = 60 + rng() * (this.height - 120);
      this.decor.push({ x, y, r, kind: 'bush', color: PALETTE.green, seed: rng() });
    }

    // -- Points of interest --
    const kinds: PoiKind[] = ['camp', 'loot', 'safe', 'objective', 'hidden', 'camp'];
    const labels = ['Enemy Camp', 'Loot Cache', 'Safe Zone', 'Objective', 'Hidden Area', 'Outpost'];
    for (let i = 0; i < poiCount; i++) {
      const a = (i / poiCount) * TAU + rng() * 0.6;
      const dist = Math.min(this.width, this.height) * (0.24 + rng() * 0.2);
      const x = clamp(cx + Math.cos(a) * dist * 1.4, 200, this.width - 200);
      const y = clamp(cy + Math.sin(a) * dist, 200, this.height - 200);
      this.pois.push({
        x, y,
        r: 90 + rng() * 60,
        kind: kinds[i % kinds.length],
        label: labels[i % labels.length],
        discovered: false,
      });
    }
  }

  private overlaps(x: number, y: number, w: number, h: number, pad: number): boolean {
    for (const s of this.solids) {
      if (s.kind !== 'building') continue;
      if (x < s.x + s.w + pad && x + w + pad > s.x && y < s.y + s.h + pad && y + h + pad > s.y) {
        return true;
      }
    }
    return false;
  }

  /** True when the world position lies inside a solid. */
  isBlocked(x: number, y: number): boolean {
    for (const s of this.solids) {
      if (x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h) return true;
    }
    return false;
  }

  /**
   * Resolve a moving circle against the world: push it out of every solid it
   * overlaps, then clamp to the world bounds. Returns the corrected position.
   */
  resolveCircle(x: number, y: number, r: number): { x: number; y: number } {
    for (const s of this.solids) {
      const nx = clamp(x, s.x, s.x + s.w);
      const ny = clamp(y, s.y, s.y + s.h);
      const dx = x - nx;
      const dy = y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;

      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      } else {
        const left = x - s.x;
        const right = s.x + s.w - x;
        const top = y - s.y;
        const bottom = s.y + s.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = s.x - r;
        else if (m === right) x = s.x + s.w + r;
        else if (m === top) y = s.y - r;
        else y = s.y + s.h + r;
      }
    }

    const pad = WORLD_CONFIG.boundaryPadding;
    x = clamp(x, pad + r, this.width - pad - r);
    y = clamp(y, pad + r, this.height - pad - r);
    return { x, y };
  }

  /** Mark nearby POIs discovered (called with the player position). */
  updateDiscovery(px: number, py: number) {
    for (const p of this.pois) {
      if (p.discovered) continue;
      const dx = px - p.x;
      const dy = py - p.y;
      if (dx * dx + dy * dy < 420 * 420) p.discovered = true;
    }
  }

  /** Nearest undiscovered POI to a point (used for the objective arrow). */
  nearestUndiscovered(px: number, py: number): Poi | null {
    let best: Poi | null = null;
    let bestD = Infinity;
    for (const p of this.pois) {
      if (p.discovered) continue;
      const d = (px - p.x) ** 2 + (py - p.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  render(ctx: CanvasRenderingContext2D, cam: Camera) {
    this.renderGround(ctx, cam);
    this.renderRoads(ctx, cam);
    this.renderPois(ctx, cam);
    this.renderDecor(ctx, cam);
    this.renderSolids(ctx, cam);
  }

  private renderGround(ctx: CanvasRenderingContext2D, cam: Camera) {
    ctx.save();
    cam.apply(ctx);
    ctx.fillStyle = '#070a1c';
    ctx.fillRect(0, 0, this.width, this.height);

    // Grid, aligned to world space.
    const step = 96;
    const x0 = Math.floor(cam.offsetX / step) * step;
    const y0 = Math.floor(cam.offsetY / step) * step;
    ctx.strokeStyle = 'rgba(0,229,255,0.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x < cam.offsetX + cam.w + step; x += step) {
      ctx.moveTo(x + 0.5, cam.offsetY);
      ctx.lineTo(x + 0.5, cam.offsetY + cam.h);
    }
    for (let y = y0; y < cam.offsetY + cam.h + step; y += step) {
      ctx.moveTo(cam.offsetX, y + 0.5);
      ctx.lineTo(cam.offsetX + cam.w, y + 0.5);
    }
    ctx.stroke();

    // World boundary glow.
    ctx.strokeStyle = hexA(PALETTE.cyan, '55');
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  private renderRoads(ctx: CanvasRenderingContext2D, cam: Camera) {
    ctx.save();
    cam.apply(ctx);
    for (const r of this.roads) {
      if (r.x > cam.offsetX + cam.w || r.x + r.w < cam.offsetX) continue;
      if (r.y > cam.offsetY + cam.h || r.y + r.h < cam.offsetY) continue;
      ctx.fillStyle = 'rgba(20,28,60,0.85)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = 'rgba(0,229,255,0.12)';
      ctx.lineWidth = 2;
      ctx.setLineDash([22, 26]);
      ctx.beginPath();
      if (r.w > r.h) {
        ctx.moveTo(r.x, r.y + r.h / 2);
        ctx.lineTo(r.x + r.w, r.y + r.h / 2);
      } else {
        ctx.moveTo(r.x + r.w / 2, r.y);
        ctx.lineTo(r.x + r.w / 2, r.y + r.h);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  private renderPois(ctx: CanvasRenderingContext2D, cam: Camera) {
    ctx.save();
    cam.apply(ctx);
    for (const p of this.pois) {
      if (!cam.inView(p.x, p.y, p.r + 120)) continue;
      const color =
        p.kind === 'safe' ? PALETTE.green :
        p.kind === 'camp' ? PALETTE.red :
        p.kind === 'loot' ? PALETTE.gold :
        p.kind === 'objective' ? PALETTE.cyan : PALETTE.purple;

      ctx.globalAlpha = 0.16;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.globalAlpha = 0.75;
      ctx.globalCompositeOperation = 'lighter';
      const spr = glowSprite(color);
      const gs = p.r * 0.8;
      ctx.drawImage(spr, p.x - gs / 2, p.y - gs / 2, gs, gs);
      ctx.globalCompositeOperation = 'source-over';

      ctx.globalAlpha = 0.85;
      ctx.fillStyle = color;
      ctx.font = '700 15px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.label, p.x, p.y - p.r - 12);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private renderDecor(ctx: CanvasRenderingContext2D, cam: Camera) {
    ctx.save();
    cam.apply(ctx);
    const t = performance.now() * 0.001;
    for (const d of this.decor) {
      if (!cam.inView(d.x, d.y, d.r + 40)) continue;
      const sway = Math.sin(t + d.seed * 10) * 2;
      ctx.globalAlpha = d.kind === 'tree' ? 0.85 : 0.6;
      ctx.fillStyle = hexA(d.color, d.kind === 'tree' ? '55' : '44');
      ctx.beginPath();
      ctx.arc(d.x + sway, d.y, d.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = hexA(d.color, 'aa');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(d.x + sway, d.y, d.r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private renderSolids(ctx: CanvasRenderingContext2D, cam: Camera) {
    ctx.save();
    cam.apply(ctx);
    for (const s of this.solids) {
      if (!cam.inView(s.x + s.w / 2, s.y + s.h / 2, Math.max(s.w, s.h))) continue;

      if (s.kind === 'building') {
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.strokeStyle = hexA(PALETTE.cyan, '44');
        ctx.lineWidth = 2;
        ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);

        const lit = s.seed > 0.5;
        ctx.fillStyle = lit ? hexA(PALETTE.cyan, '33') : hexA(PALETTE.purple, '33');
        const cols = Math.max(2, Math.floor(s.w / 46));
        const rows = Math.max(2, Math.floor(s.h / 46));
        const seedInt = Math.floor(s.seed * 100);
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            if (((i * 7 + j * 13 + seedInt) % 4) === 0) continue;
            ctx.fillRect(
              s.x + 12 + (i * (s.w - 24)) / cols,
              s.y + 12 + (j * (s.h - 24)) / rows,
              12, 12,
            );
          }
        }
      } else if (s.kind === 'rock') {
        ctx.globalCompositeOperation = 'lighter';
        const spr = glowSprite(PALETTE.purple);
        const gs = Math.max(s.w, s.h) * 1.5;
        ctx.globalAlpha = 0.35;
        ctx.drawImage(spr, s.x + s.w / 2 - gs / 2, s.y + s.h / 2 - gs / 2, gs, gs);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(60,48,110,0.95)';
        ctx.beginPath();
        ctx.arc(s.x + s.w / 2, s.y + s.h / 2, Math.min(s.w, s.h) / 2, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = hexA(PALETTE.purple, 'cc');
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = hexA(PALETTE.gold, '22');
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.strokeStyle = hexA(PALETTE.gold, 'bb');
        ctx.lineWidth = 2;
        ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
      }
    }
    ctx.restore();
  }

  /** Draw a tiny top-down representation into a minimap canvas. */
  renderMinimap(
    ctx: CanvasRenderingContext2D,
    size: number,
    px: number,
    py: number,
    cam: Camera,
    enemies: { x: number; y: number }[],
  ) {
    const s = Math.min(size / this.width, size / this.height);
    const offX = (size - this.width * s) / 2;
    const offY = (size - this.height * s) / 2;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(6,9,22,0.82)';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(offX, offY);
    ctx.scale(s, s);

    ctx.fillStyle = 'rgba(20,28,60,0.9)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = 'rgba(90,110,160,0.55)';
    for (const so of this.solids) {
      if (so.kind === 'building') ctx.fillRect(so.x, so.y, so.w, so.h);
    }

    for (const p of this.pois) {
      ctx.fillStyle =
        p.kind === 'safe' ? PALETTE.green :
        p.kind === 'camp' ? PALETTE.red :
        p.kind === 'objective' ? PALETTE.cyan : PALETTE.purple;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = PALETTE.magenta;
    for (const e of enemies) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, 20, 0, TAU);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(0,229,255,0.5)';
    ctx.lineWidth = 8;
    ctx.strokeRect(cam.x, cam.y, cam.w, cam.h);

    ctx.fillStyle = PALETTE.white;
    ctx.beginPath();
    ctx.arc(px, py, 34, 0, TAU);
    ctx.fill();

    ctx.restore();
  }
}