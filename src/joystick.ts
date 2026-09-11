/**
 * joystick.ts — virtual on-screen thumbstick for touch devices.
 *
 * The outer base stays fixed; the knob follows the finger. Output is a
 * normalized direction plus a 0..1 magnitude, so the player moves at partial
 * speed when the finger is near the centre and full speed at the rim.
 *
 * Multi-touch safe: only the pointer that started on the base drives the
 * stick, so other fingers (action buttons) never interfere. Movement is
 * continuous while the finger is held — no repeated tapping.
 */
const KNOB_MAX_FRACTION = 0.62; // knob travel as a fraction of base radius

export class VirtualJoystick {
  /** Normalized direction (-1..1) — zero when idle. */
  dirX = 0;
  dirY = 0;
  /** 0..1 how far the finger is from the centre. */
  magnitude = 0;
  active = false;

  private pointerId: number | null = null;
  private centerX = 0;
  private centerY = 0;
  private radius = 60;

  constructor(
    private base: HTMLElement,
    private knob: HTMLElement,
  ) {
    this.base.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('blur', () => this.reset());
  }

  /** Recompute the base centre/radius — call on resize/orientation change. */
  resize() {
    const r = this.base.getBoundingClientRect();
    if (r.width <= 0) return;
    this.centerX = r.left + r.width / 2;
    this.centerY = r.top + r.height / 2;
    this.radius = Math.max(1, r.width / 2);
  }

  private onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    if (this.pointerId !== null) return; // already steering with another finger
    this.pointerId = e.pointerId;
    this.active = true;
    this.resize(); // refresh centre in case layout moved (rotation, resize)
    try {
      this.base.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    e.preventDefault();
    this.track(e.clientX, e.clientY);
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.track(e.clientX, e.clientY);
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.reset();
  };

  private track(cx: number, cy: number) {
    const dx = cx - this.centerX;
    const dy = cy - this.centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > 0.0001) {
      this.dirX = dx / dist;
      this.dirY = dy / dist;
    } else {
      this.dirX = 0;
      this.dirY = 0;
    }
    this.magnitude = Math.min(1, dist / this.radius);

    // Clamp the knob to the maximum travel radius.
    const travel = this.radius * KNOB_MAX_FRACTION;
    const k = dist > travel ? travel / dist : 1;
    this.applyKnob(dx * k, dy * k);
  }

  private applyKnob(x: number, y: number) {
    this.knob.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
  }

  /** Return to neutral (finger released / lost focus). */
  reset() {
    this.pointerId = null;
    this.active = false;
    this.dirX = 0;
    this.dirY = 0;
    this.magnitude = 0;
    this.applyKnob(0, 0);
  }
}