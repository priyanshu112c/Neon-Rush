import type { TaskDef, TaskType } from './levels';

/**
 * tasks.ts — reusable objective/task system.
 *
 * A Task wraps a TaskDef and exposes a uniform progress/completion interface so
 * the HUD, the level system and gameplay events never need to know task details.
 *
 * Events feed tasks via `TaskSystem.emit(...)`:
 *   { kind: 'kill',    enemyType, x, y }
 *   { kind: 'collect' }
 *   { kind: 'position', x, y }   // every frame from the player
 *   { kind: 'tick',    dt }      // every frame
 *   { kind: 'enemyCount', value }// alive enemies (for `clear`)
 */

export interface TaskEvent {
  kind: 'kill' | 'collect' | 'position' | 'tick' | 'enemyCount';
  enemyType?: string;
  x?: number;
  y?: number;
  dt?: number;
  value?: number;
}

export interface TaskState {
  type: TaskType;
  label: string;
  description?: string;
  amount: number;
  progress: number;
  done: boolean;
  optional: boolean;
}

export class Task {
  readonly type: TaskType;
  readonly label: string;
  readonly description?: string;
  readonly amount: number;
  readonly optional: boolean;
  private readonly enemyTypes?: string[];
  private readonly x?: number;
  private readonly y?: number;

  progress = 0;
  done = false;
  /** `clear` only completes when the player has entered and emptied the area. */
  private entered = false;

  constructor(def: TaskDef) {
    this.type = def.type;
    this.label = def.label;
    this.description = def.description;
    this.amount = def.amount;
    this.optional = !!def.optional;
    this.enemyTypes = def.enemyTypes;
    this.x = def.x;
    this.y = def.y;
  }

  get ratio(): number {
    return this.amount <= 0 ? 1 : Math.min(1, this.progress / this.amount);
  }

  /** Returns true the frame this task flips to done. */
  handle(ev: TaskEvent): boolean {
    if (this.done) return false;
    const before = this.done;

    switch (this.type) {
      case 'kill':
      case 'boss':
        if (ev.kind === 'kill' && this.matches(ev.enemyType)) this.progress += 1;
        break;

      case 'collect':
        if (ev.kind === 'collect') this.progress += 1;
        break;

      case 'reach':
        if (ev.kind === 'position' && this.x !== undefined && this.y !== undefined) {
          const r = this.amount;
          const dx = (ev.x ?? 0) - this.x;
          const dy = (ev.y ?? 0) - this.y;
          if (dx * dx + dy * dy <= r * r) this.progress = this.amount;
        }
        break;

      case 'protect': {
        // Counts down while the player stays near the protected point.
        if (ev.kind === 'position' && this.x !== undefined && this.y !== undefined) {
          const r = this.amount > 0 ? 220 : 0;
          const dx = (ev.x ?? 0) - this.x;
          const dy = (ev.y ?? 0) - this.y;
          if (dx * dx + dy * dy <= r * r) this.progress += ev.dt ?? 0;
        }
        break;
      }

      case 'survive':
        if (ev.kind === 'tick') this.progress += ev.dt ?? 0;
        break;

      case 'clear':
        if (ev.kind === 'enemyCount') {
          if (!this.entered && this.x !== undefined && this.y !== undefined && ev.x !== undefined && ev.y !== undefined) {
            // Fallback: player proximity marks entry.
            const dx = ev.x - this.x;
            const dy = ev.y - this.y;
            if (dx * dx + dy * dy < 400 * 400) this.entered = true;
          }
          if (this.entered && (ev.value ?? 0) <= 0) this.progress = this.amount;
        } else if (ev.kind === 'position') {
          // Mark entered when the player is within the objective area.
          if (this.x !== undefined && this.y !== undefined) {
            const dx = (ev.x ?? 0) - this.x;
            const dy = (ev.y ?? 0) - this.y;
            if (dx * dx + dy * dy < 700 * 700) this.entered = true;
          } else {
            this.entered = true; // area-agnostic clear
          }
        }
        break;
    }

    if (this.progress >= this.amount) this.done = true;
    return !before && this.done;
  }

  private matches(enemyType?: string): boolean {
    if (!this.enemyTypes || this.enemyTypes.length === 0) return true;
    return enemyType !== undefined && this.enemyTypes.includes(enemyType);
  }

  toState(): TaskState {
    return {
      type: this.type,
      label: this.label,
      description: this.description,
      amount: this.amount,
      progress: Math.min(this.progress, this.amount),
      done: this.done,
      optional: this.optional,
    };
  }
}

export class TaskSystem {
  tasks: Task[] = [];
  /** Fires whenever a task completes (used to flash the HUD). */
  onComplete: ((task: Task) => void) | null = null;
  private completedQueue: Task[] = [];

  load(defs: TaskDef[]) {
    this.tasks = defs.map((d) => new Task(d));
    this.completedQueue = [];
  }

  get current(): Task | null {
    return this.tasks.find((t) => !t.done && !t.optional) ?? null;
  }

  get allRequiredDone(): boolean {
    return this.tasks.filter((t) => !t.optional).every((t) => t.done);
  }

  get completedCount(): number {
    return this.tasks.filter((t) => t.done).length;
  }

  emit(ev: TaskEvent) {
    for (const t of this.tasks) {
      const flipped = t.handle(ev);
      if (flipped) {
        this.completedQueue.push(t);
        this.onComplete?.(t);
      }
    }
  }

  /** Drain tasks that completed since the last call (for one-shot UI flashes). */
  drainCompleted(): Task[] {
    const q = this.completedQueue;
    this.completedQueue = [];
    return q;
  }

  reset() {
    this.tasks = [];
    this.completedQueue = [];
  }
}