import { fmtTime } from './constants';
import type { TaskState } from './tasks';
import type { LevelDef, TaskDef } from './levels';

type Screen = 'menu' | 'hud' | 'pause' | 'gameover' | 'intro' | 'complete';

/**
 * ui.ts — DOM controller for every screen and HUD element.
 *
 * All lookups happen once at construction; screens are toggled via `.hidden`.
 * The objective panel + health bar + minimap are the new open-world HUD.
 */
export class UI {
  // Screens
  hud = document.getElementById('hud') as HTMLElement;
  menu = document.getElementById('menu') as HTMLElement;
  pause = document.getElementById('pause') as HTMLElement;
  gameover = document.getElementById('gameover') as HTMLElement;
  intro = document.getElementById('level-intro') as HTMLElement;
  complete = document.getElementById('level-complete') as HTMLElement;

  // HUD
  hudScore = document.getElementById('hud-score') as HTMLElement;
  hudHigh = document.getElementById('hud-high') as HTMLElement;
  hudCombo = document.getElementById('hud-combo') as HTMLElement;
  hudComboWrap = document.getElementById('hud-combo-wrap') as HTMLElement;
  hudLevel = document.getElementById('hud-level') as HTMLElement;
  hudXp = document.getElementById('hud-xp') as HTMLElement;
  hudTime = document.getElementById('hud-time') as HTMLElement;

  // Objective panel
  objPanel = document.getElementById('objective-panel') as HTMLElement;
  objTitle = document.getElementById('obj-title') as HTMLElement;
  objDesc = document.getElementById('obj-desc') as HTMLElement;
  objProgress = document.getElementById('obj-progress') as HTMLElement;
  objBarFill = document.getElementById('obj-bar-fill') as HTMLElement;
  objQueue = document.getElementById('obj-queue') as HTMLElement;
  objFlash = document.getElementById('objective-flash') as HTMLElement;

  // Health
  healthWrap = document.getElementById('health-wrap') as HTMLElement;
  healthFill = document.getElementById('health-fill') as HTMLElement;

  // Minimap
  minimapWrap = document.getElementById('minimap-wrap') as HTMLElement;
  minimap = document.getElementById('minimap') as HTMLCanvasElement;
  minimapArrow = document.getElementById('minimap-arrow') as HTMLElement;

  // Menu info
  menuHigh = document.getElementById('menu-high') as HTMLElement;
  menuXp = document.getElementById('menu-xp') as HTMLElement;
  menuRank = document.getElementById('menu-rank') as HTMLElement;

  // Intro
  introLevel = document.getElementById('intro-level') as HTMLElement;
  introName = document.getElementById('intro-name') as HTMLElement;
  introDesc = document.getElementById('intro-desc') as HTMLElement;
  introObjectives = document.getElementById('intro-objectives') as HTMLElement;

  // Complete
  mcKills = document.getElementById('mc-kills') as HTMLElement;
  mcTime = document.getElementById('mc-time') as HTMLElement;
  mcObjectives = document.getElementById('mc-objectives') as HTMLElement;
  mcReward = document.getElementById('mc-reward') as HTMLElement;

  // Game over
  goScore = document.getElementById('go-score') as HTMLElement;
  goHigh = document.getElementById('go-high') as HTMLElement;
  goTime = document.getElementById('go-time') as HTMLElement;
  goKills = document.getElementById('go-kills') as HTMLElement;
  newHigh = document.getElementById('new-high') as HTMLElement;

  // Buttons
  btnSound = document.getElementById('btn-sound') as HTMLButtonElement;
  btnPause = document.getElementById('btn-pause') as HTMLButtonElement;
  btnStart = document.getElementById('btn-start') as HTMLButtonElement;
  btnResume = document.getElementById('btn-resume') as HTMLButtonElement;
  btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
  btnPauseMenu = document.getElementById('btn-pause-menu') as HTMLButtonElement;
  btnBegin = document.getElementById('btn-begin') as HTMLButtonElement;
  btnNext = document.getElementById('btn-next') as HTMLButtonElement;
  btnMcMenu = document.getElementById('btn-mc-menu') as HTMLButtonElement;
  btnAgain = document.getElementById('btn-again') as HTMLButtonElement;
  btnMenu = document.getElementById('btn-menu') as HTMLButtonElement;

  private current: Screen = 'menu';
  private lastScore = -1;
  private lastCombo = -1;
  private flashTimer = 0;

  show(screen: Screen) {
    this.menu.classList.toggle('hidden', screen !== 'menu');
    this.hud.classList.toggle('hidden', screen !== 'hud');
    this.pause.classList.toggle('hidden', screen !== 'pause');
    this.gameover.classList.toggle('hidden', screen !== 'gameover');
    this.intro.classList.toggle('hidden', screen !== 'intro');
    this.complete.classList.toggle('hidden', screen !== 'complete');

    const inGame = screen === 'hud' || screen === 'pause';
    this.objPanel.classList.toggle('hidden', !inGame);
    this.healthWrap.classList.toggle('hidden', !inGame);
    this.minimapWrap.classList.toggle('hidden', !inGame);

    this.current = screen;
  }

  get screen() {
    return this.current;
  }

  setMenuHigh(v: number) {
    this.menuHigh.textContent = String(v);
  }

  setMenuXp(v: number) {
    this.menuXp.textContent = String(v);
  }

  setMenuRank(v: number) {
    this.menuRank.textContent = 'LV ' + v;
  }

  setScore(v: number) {
    if (v === this.lastScore) return;
    this.lastScore = v;
    this.hudScore.textContent = String(v);
    this.hudScore.classList.remove('bump');
    void this.hudScore.offsetWidth;
    this.hudScore.classList.add('bump');
  }

  setHigh(v: number) {
    this.hudHigh.textContent = String(v);
  }

  setLevel(v: number) {
    this.hudLevel.textContent = String(v);
  }

  setXp(v: number) {
    this.hudXp.textContent = String(v);
  }

  setTime(s: number) {
    this.hudTime.textContent = fmtTime(s);
  }

  setCombo(v: number) {
    if (v === this.lastCombo) return;
    this.lastCombo = v;
    this.hudCombo.textContent = v + 'x';
    if (v > 1) {
      this.hudComboWrap.classList.add('active');
      this.hudCombo.classList.remove('pop');
      void this.hudCombo.offsetWidth;
      this.hudCombo.classList.add('pop');
    } else {
      this.hudComboWrap.classList.remove('active');
    }
  }

  setSoundIcon(on: boolean) {
    this.btnSound.textContent = on ? '🔊' : '🔇';
  }

  setHealth(current: number, max: number) {
    const pct = Math.max(0, Math.min(1, current / max)) * 100;
    this.healthFill.style.width = pct + '%';
    this.healthFill.style.background =
      pct > 50 ? 'linear-gradient(90deg,#39ff88,#00e5ff)' :
      pct > 25 ? 'linear-gradient(90deg,#ffd166,#ff8c42)' :
      'linear-gradient(90deg,#ff3b5c,#ff2d78)';
  }

  /** Render the current + queued objectives. */
  setObjectives(tasks: TaskState[]) {
    const required = tasks.filter((t) => !t.optional);
    const current = required.find((t) => !t.done);
    if (current) {
      this.objTitle.textContent = current.label;
      this.objDesc.textContent = current.description ?? '';
      const amt = current.amount;
      const prog = Math.floor(current.progress);
      this.objProgress.textContent = amt > 1 ? `${prog} / ${amt}` : (prog >= amt ? 'DONE' : 'IN PROGRESS');
      const ratio = amt > 0 ? Math.min(1, current.progress / amt) : 0;
      this.objBarFill.style.width = ratio * 100 + '%';
    } else {
      this.objTitle.textContent = 'ALL OBJECTIVES COMPLETE';
      this.objDesc.textContent = '';
      this.objProgress.textContent = '';
      this.objBarFill.style.width = '100%';
    }

    // Queue: remaining required tasks.
    const rest = required.filter((t) => t !== current);
    this.objQueue.innerHTML = rest
      .map((t) => {
        const mark = t.done ? '✓' : '•';
        const cls = t.done ? 'done' : '';
        const amt = t.amount > 1 ? ` (${Math.floor(t.progress)}/${t.amount})` : '';
        return `<div class="obj-queue-item ${cls}">${mark} ${t.label}${amt}</div>`;
      })
      .join('');
  }

  flashObjective() {
    this.objFlash.classList.remove('hidden');
    this.objFlash.classList.remove('pop');
    void this.objFlash.offsetWidth;
    this.objFlash.classList.add('pop');
    this.flashTimer = 1.6;
  }

  update(dt: number) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.objFlash.classList.add('hidden');
    }
  }

  /* ---------------- Level intro / complete / game over ---------------- */

  showIntro(level: LevelDef) {
    this.introLevel.textContent = 'LEVEL ' + String(level.id).padStart(2, '0');
    this.introName.textContent = level.name;
    this.introDesc.textContent = level.description;
    this.introObjectives.innerHTML = level.tasks
      .map((t: TaskDef) => `<li>${t.label}${t.amount > 1 ? ` <em>(${t.amount})</em>` : ''}</li>`)
      .join('');
  }

  showComplete(kills: number, time: number, objectivesDone: number, objectivesTotal: number, reward: number) {
    this.mcKills.textContent = String(kills);
    this.mcTime.textContent = fmtTime(time);
    this.mcObjectives.textContent = `${objectivesDone} / ${objectivesTotal}`;
    this.mcReward.textContent = '+' + reward;
  }

  showGameOver(score: number, high: number, time: number, kills: number, isNew: boolean) {
    this.goScore.textContent = String(score);
    this.goHigh.textContent = String(high);
    this.goTime.textContent = fmtTime(time);
    this.goKills.textContent = String(kills);
    this.newHigh.classList.toggle('hidden', !isNew);
  }
}