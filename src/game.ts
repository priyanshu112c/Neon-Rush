import { Background } from './background';
import { AudioManager } from './audio';
import { InputManager } from './input';
import { VirtualJoystick } from './joystick';
import { Camera } from './camera';
import { World } from './world';
import { EnemyManager, type Enemy } from './enemies';
import { ParticleSystem, glowSprite } from './particles';
import { Player } from './player';
import { Progression } from './progression';
import { TaskSystem } from './tasks';
import { UI } from './ui';
import { getLevel, FIRST_LEVEL_ID, type LevelDef } from './levels';
import { PALETTE, clamp, rand, TAU } from './constants';
import { PLAYER_CONFIG, GAME_CONFIG } from './config';

interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Pickup {
  x: number;
  y: number;
  r: number;
  kind: 'health';
  phase: number;
}

type State = 'menu' | 'intro' | 'playing' | 'paused' | 'complete' | 'gameover';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ui = new UI();
  private audio = new AudioManager();
  private input: InputManager;
  private joystick: VirtualJoystick;

  private bg = new Background();
  private particles = new ParticleSystem();
  private player = new Player(this.particles);
  private prog = new Progression();
  private camera = new Camera();
  private world = new World();
  private enemies = new EnemyManager(this.world);
  private tasks = new TaskSystem();

  private state: State = 'menu';
  private w = 1;
  private h = 1;
  private dpr = 1;

  private floaters: FloatText[] = [];
  private pickups: Pickup[] = [];
  private lastTime = 0;
  private rafId = 0;
  private hitFlash = 0;

  private currentLevel: LevelDef = getLevel(FIRST_LEVEL_ID);
  private kills = 0;
  private pendingNext: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.input = new InputManager(canvas);
    this.joystick = new VirtualJoystick(
      document.getElementById('joystick-base') as HTMLElement,
      document.getElementById('joystick-knob') as HTMLElement,
    );
    this.input.attachJoystick(this.joystick);

    this.resize();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    this.bindUI();

    this.enemies.onDeath = (e) => this.onEnemyDeath(e);
    this.enemies.onPlayerHit = (dmg, x, y) => this.damagePlayer(dmg, x, y);
    this.tasks.onComplete = () => this.ui.flashObjective();

    this.camera.setWorld(this.world.width, this.world.height);
    this.ui.setMenuHigh(this.prog.high);
    this.ui.setMenuXp(this.prog.xp);
    this.ui.setMenuRank(this.prog.rank);
    this.ui.setSoundIcon(this.audio.enabled);
    this.ui.show('menu');

    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private onResize = () => this.resize();

  private resize() {
    this.dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.bg.resize(this.w, this.h);
    this.camera.setViewport(this.w, this.h);
    this.joystick?.resize();
  }

  private bindUI() {
    this.ui.btnSound.addEventListener('click', () => {
      this.audio.ensure();
      this.audio.setEnabled(!this.audio.enabled);
      this.ui.setSoundIcon(this.audio.enabled);
      this.audio.click();
    });

    this.ui.btnStart.addEventListener('click', () => this.startLevel(FIRST_LEVEL_ID));
    this.ui.btnAgain.addEventListener('click', () => this.startLevel(this.currentLevel.id));
    this.ui.btnRestart.addEventListener('click', () => this.startLevel(this.currentLevel.id));
    this.ui.btnMenu.addEventListener('click', () => this.toMenu());
    this.ui.btnMcMenu.addEventListener('click', () => this.toMenu());
    this.ui.btnPauseMenu.addEventListener('click', () => this.toMenu());
    this.ui.btnResume.addEventListener('click', () => this.resume());
    this.ui.btnBegin.addEventListener('click', () => this.beginPlay());
    this.ui.btnNext.addEventListener('click', () => {
      if (this.pendingNext !== null) this.startLevel(this.pendingNext);
      else this.toMenu();
    });

    this.ui.btnPause.addEventListener('click', () => {
      if (this.state === 'playing') this.pause();
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        if (this.state === 'intro') this.beginPlay();
        else if (this.state === 'complete') this.ui.btnNext.click();
        else if (this.state === 'menu') this.startLevel(FIRST_LEVEL_ID);
        else if (this.state === 'gameover') this.startLevel(this.currentLevel.id);
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /*  LEVEL FLOW                                                       */
  /* ---------------------------------------------------------------- */

  startLevel(id: number) {
    this.audio.ensure();
    this.currentLevel = getLevel(id);
    this.pendingNext = this.currentLevel.next;

    this.prog.reset();
    this.enemies.configure(this.currentLevel.spawn);
    this.enemies.reset();
    this.tasks.load(this.currentLevel.tasks);
    this.player.reset(this.world);
    this.particles.clear();
    this.floaters = [];
    this.pickups = [];
    this.hitFlash = 0;
    this.kills = 0;

    this.camera.centerOn(this.player.x, this.player.y);

    this.ui.setScore(0);
    this.ui.setHigh(this.prog.high);
    this.ui.setCombo(1);
    this.ui.setLevel(this.currentLevel.id);
    this.ui.setXp(this.prog.xp);
    this.ui.setTime(0);
    this.ui.setHealth(this.player.health, this.player.maxHealth);
    this.ui.setObjectives(this.tasks.tasks.map((t) => t.toState()));
    this.ui.showIntro(this.currentLevel);

    this.state = 'intro';
    this.ui.show('intro');
  }

  private beginPlay() {
    this.audio.start();
    this.state = 'playing';
    this.ui.show('hud');
    this.lastTime = performance.now();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.audio.pause();
    this.state = 'paused';
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.audio.ensure();
    this.audio.click();
    this.state = 'playing';
    this.ui.show('hud');
    this.lastTime = performance.now();
  }

  toMenu() {
    this.audio.ensure();
    this.audio.click();
    this.state = 'menu';
    this.ui.setMenuHigh(this.prog.high);
    this.ui.setMenuXp(this.prog.xp);
    this.ui.setMenuRank(this.prog.rank);
    this.ui.show('menu');
  }

  private completeLevel() {
    this.prog.addXp(this.currentLevel.reward);
    this.audio.newHigh();
    this.state = 'complete';
    const total = this.tasks.tasks.filter((t) => !t.optional).length;
    this.ui.showComplete(this.kills, this.prog.elapsed, total, total, this.currentLevel.reward);
    this.ui.setMenuXp(this.prog.xp);
    this.ui.setMenuRank(this.prog.rank);
    this.ui.show('complete');
  }

  private gameOver() {
    this.prog.finalize();
    this.audio.gameOver();
    if (this.prog.isNewHigh) this.audio.newHigh();
    this.state = 'gameover';
    this.hitFlash = 1;
    this.camera.addShake(18);
    this.ui.setHigh(this.prog.high);
    this.ui.showGameOver(
      this.prog.score,
      this.prog.high,
      this.prog.elapsed,
      this.kills,
      this.prog.isNewHigh,
    );
    this.ui.show('gameover');
  }

  /* ---------------------------------------------------------------- */
  /*  LOOP + UPDATE                                                    */
  /* ---------------------------------------------------------------- */

  private loop = (t: number) => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = clamp((t - this.lastTime) / 1000, 0, 0.05);
    this.lastTime = t;

    this.bg.update(dt, this.w, this.h);
    this.particles.update(dt);
    this.updateFloaters(dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2);
    this.ui.update(dt);
    this.camera.update(dt);

    if (this.state === 'playing') this.update(dt);

    this.render();
  };

  private update(dt: number) {
    this.prog.update(dt);
    const move = this.input.getMove();

    // Player movement (world-space).
    const shot = this.player.update(
      dt,
      this.world,
      move.x,
      move.y,
      move.mag,
      this.input.isPointerDown,
      this.camera.toWorldX(this.input.pointerX),
      this.camera.toWorldY(this.input.pointerY),
    );

    // Auto-fire at the nearest enemy in range.
    if (shot.fired) this.tryFire();

    // Enemies + their projectiles.
    this.enemies.update(dt, this.player.x, this.player.y, (e) => this.onEnemyContact(e));

    // Pickups.
    this.updatePickups(dt);

    // World discovery.
    this.world.updateDiscovery(this.player.x, this.player.y);

    // Tasks: feed position, tick and alive-count events.
    this.tasks.emit({ kind: 'position', x: this.player.x, y: this.player.y });
    this.tasks.emit({ kind: 'tick', dt });
    this.tasks.emit({ kind: 'enemyCount', value: this.enemies.alive, x: this.player.x, y: this.player.y });

    // Camera follow.
    this.camera.follow(this.player.x, this.player.y, dt);

    // HUD.
    this.ui.setScore(this.prog.score);
    this.ui.setCombo(this.prog.combo);
    this.ui.setTime(this.prog.elapsed);
    this.ui.setHealth(this.player.health, this.player.maxHealth);
    this.ui.setObjectives(this.tasks.tasks.map((t) => t.toState()));

    // Level complete?
    if (this.tasks.allRequiredDone) {
      this.completeLevel();
      return;
    }

    // Death?
    if (this.player.dead) this.gameOver();
  }

  private tryFire() {
    const target = this.enemies.nearestInRange(
      this.player.x,
      this.player.y,
      PLAYER_CONFIG.attackRange,
    );
    if (!target) return;
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const d = Math.hypot(dx, dy) || 1;
    this.enemies.addBullet({
      x: this.player.x,
      y: this.player.y,
      vx: (dx / d) * PLAYER_CONFIG.bulletSpeed,
      vy: (dy / d) * PLAYER_CONFIG.bulletSpeed,
      r: PLAYER_CONFIG.bulletRadius,
      damage: PLAYER_CONFIG.bulletDamage,
      life: PLAYER_CONFIG.bulletLife,
      color: PALETTE.cyan,
    });
    this.audio.click();
  }

  private onEnemyContact(e: Enemy) {
    this.damagePlayer(e.type.damage, e.x, e.y);
  }

  private damagePlayer(amount: number, x: number, y: number) {
    if (this.state !== 'playing') return;
    const landed = this.player.hurt(amount);
    if (!landed) return;
    this.hitFlash = 0.7;
    this.camera.addShake(10);
    this.particles.burst(x, y, PALETTE.red, 18, { speed: 260, size: 6 });
    this.audio.collide();
    if (this.player.dead) this.gameOver();
  }

  private onEnemyDeath(e: Enemy) {
    this.kills++;
    this.prog.bumpCombo();
    const pts = e.type.score * this.prog.combo;
    this.prog.score += pts;
    this.audio.collect(this.prog.combo);
    this.particles.burst(e.x, e.y, e.type.color, 26, { speed: 320, size: 7 });
    this.addFloater(e.x, e.y - 10, `+${pts}`, e.type.color, 18);

    // Random health pickup drop.
    if (Math.random() < PLAYER_CONFIG.dropChance) {
      this.pickups.push({ x: e.x, y: e.y, r: 14, kind: 'health', phase: rand(0, TAU) });
    }

    // Feed the task system.
    this.tasks.emit({ kind: 'kill', enemyType: e.type.key, x: e.x, y: e.y });
  }

  private updatePickups(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.phase += dt * 3;
      const dx = this.player.x - p.x;
      const dy = this.player.y - p.y;
      const rr = p.r + this.player.r;
      if (dx * dx + dy * dy <= rr * rr) {
        this.player.heal(PLAYER_CONFIG.healthPickupHeal);
        this.particles.burst(p.x, p.y, PALETTE.green, 20, { speed: 220, size: 5 });
        this.addFloater(p.x, p.y - 10, `+${PLAYER_CONFIG.healthPickupHeal} HP`, PALETTE.green, 16);
        this.pickups.splice(i, 1);
      }
    }
  }

  private addFloater(x: number, y: number, text: string, color: string, size: number) {
    this.floaters.push({ x, y, text, life: 0.9, maxLife: 0.9, color, size });
  }

  private updateFloaters(dt: number) {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y -= 42 * dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  RENDER                                                           */
  /* ---------------------------------------------------------------- */

  private render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const inGame =
      this.state === 'playing' ||
      this.state === 'paused' ||
      this.state === 'complete' ||
      this.state === 'gameover' ||
      this.state === 'intro';

    if (inGame) {
      // Solid background so the menu's animated bg doesn't bleed through.
      ctx.fillStyle = '#05060f';
      ctx.fillRect(0, 0, this.w, this.h);

      // World layer (applies the camera transform internally per sub-pass).
      this.world.render(ctx, this.camera);

      // World-space entities share the SAME camera transform so they stay
      // anchored to their world position as the camera scrolls.
      ctx.save();
      this.camera.apply(ctx);
      this.renderPickups(ctx);
      this.enemies.render(ctx, (x, y, pad) => this.camera.inView(x, y, pad));
      this.player.render(ctx);
      this.particles.render(ctx);
      this.renderFloaters(ctx);
      ctx.restore();
    } else {
      this.bg.render(ctx, this.w, this.h);
    }

    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,43,90,${this.hitFlash * 0.28})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    // Minimap (screen space).
    if (this.ui.minimapWrap && !this.ui.minimapWrap.classList.contains('hidden')) {
      this.world.renderMinimap(
        this.ui.minimap.getContext('2d')!,
        this.ui.minimap.width,
        this.player.x,
        this.player.y,
        this.camera,
        this.enemies.list,
      );
      this.updateMinimapArrow();
    }

    // Directional objective arrow at the screen edge.
    this.renderObjectiveArrow(ctx);

    // Vignette.
    const vg = ctx.createRadialGradient(
      this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35,
      this.w / 2, this.h / 2, Math.hypot(this.w, this.h) * 0.65,
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  private renderPickups(ctx: CanvasRenderingContext2D) {
    for (const p of this.pickups) {
      if (!this.camera.inView(p.x, p.y, 40)) continue;
      const pulse = 1 + Math.sin(p.phase) * 0.18;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.85;
      const spr = glowSprite(PALETTE.green);
      const gs = p.r * 4 * pulse;
      ctx.drawImage(spr, -gs / 2, -gs / 2, gs, gs);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderFloaters(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      const t = f.life / f.maxLife;
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.font = `700 ${f.size}px Rajdhani, sans-serif`;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  /** Point the minimap compass at the nearest objective/undiscovered POI. */
  private updateMinimapArrow() {
    const target = this.world.nearestUndiscovered(this.player.x, this.player.y);
    if (!target) {
      this.ui.minimapArrow.style.opacity = '0';
      return;
    }
    this.ui.minimapArrow.style.opacity = '1';
    const a = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    this.ui.minimapArrow.style.transform =
      `translateX(-50%) rotate(${(a * 180) / Math.PI + 90}deg)`;
  }

  /** Off-screen chevron pointing to the current objective target. */
  private renderObjectiveArrow(ctx: CanvasRenderingContext2D) {
    if (this.state !== 'playing') return;

    // Prefer a `reach` task's coordinates, else nearest undiscovered POI.
    let tx: number | null = null;
    let ty: number | null = null;
    for (const t of this.tasks.tasks) {
      if (t.done) continue;
      const st = t.toState();
      if (st.type === 'reach') {
        const raw = this.tasks.tasks[this.tasks.tasks.indexOf(t)] as unknown as { x?: number; y?: number };
        if (raw.x !== undefined && raw.y !== undefined) {
          tx = raw.x;
          ty = raw.y;
          break;
        }
      }
    }
    if (tx === null || ty === null) {
      const poi = this.world.nearestUndiscovered(this.player.x, this.player.y);
      if (poi) {
        tx = poi.x;
        ty = poi.y;
      }
    }
    if (tx === null || ty === null) return;

    const sx = this.camera.toScreenX(tx);
    const sy = this.camera.toScreenY(ty);
    const onScreen = sx > 40 && sx < this.w - 40 && sy > 40 && sy < this.h - 40;
    if (onScreen) return;

    const cx = this.w / 2;
    const cy = this.h / 2;
    const a = Math.atan2(sy - cy, sx - cx);
    const radius = Math.min(this.w, this.h) * 0.38;
    const px = cx + Math.cos(a) * radius;
    const py = cy + Math.sin(a) * radius;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.fillStyle = PALETTE.cyan;
    ctx.shadowColor = PALETTE.cyan;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-8, -10);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}