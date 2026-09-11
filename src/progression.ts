const STORAGE_KEY = 'neon-rush-high';
const XP_KEY = 'neon-rush-xp';

/** Tracks score, combo, survival time, persistent XP and difficulty ramp. */
export class Progression {
  score = 0;
  high = 0;
  combo = 1;
  maxCombo = 1;
  comboTimer = 0;
  elapsed = 0;
  speed = 1;
  isNewHigh = false;

  /** Persistent experience across runs. */
  xp = 0;

  constructor() {
    this.high = this.load(STORAGE_KEY);
    this.xp = this.load(XP_KEY);
  }

  private load(key: string): number {
    try {
      return Number(localStorage.getItem(key)) || 0;
    } catch {
      return 0;
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, String(this.high));
    } catch {
      /* ignore */
    }
  }

  saveXp() {
    try {
      localStorage.setItem(XP_KEY, String(this.xp));
    } catch {
      /* ignore */
    }
  }

  /** Player rank derived from total XP (1 rank per 100 XP). */
  get rank(): number {
    return 1 + Math.floor(this.xp / 100);
  }

  addXp(amount: number) {
    this.xp += amount;
    this.saveXp();
  }

  reset() {
    this.score = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.comboTimer = 0;
    this.elapsed = 0;
    this.speed = 1;
    this.isNewHigh = false;
  }

  update(dt: number) {
    this.elapsed += dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }
    // Smooth difficulty ramp: time-based + score-based, never spikes.
    this.speed = 1 + this.elapsed * 0.055 + (this.score / 1200) * 0.35;
  }

  /** Awards points using the current combo (does not advance the combo). */
  addOrb(base = 10): number {
    const points = base * this.combo;
    this.score += points;
    this.comboTimer = 3.5;
    return points;
  }

  bumpCombo() {
    this.combo = this.combo >= 8 ? 8 : this.combo + 1;
    this.comboTimer = 3.5;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
  }

  resetCombo() {
    this.combo = 1;
    this.comboTimer = 0;
  }

  finalize() {
    this.isNewHigh = this.score > this.high;
    if (this.isNewHigh) {
      this.high = this.score;
      this.save();
    }
  }
}