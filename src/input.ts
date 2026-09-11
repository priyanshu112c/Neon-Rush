import type { VirtualJoystick } from './joystick';

/**
 * input.ts — unified input layer.
 *
 * Keyboard, mouse pointer-follow and the mobile virtual joystick all feed ONE
 * movement source (`getMove`), so the player has a single movement path
 * regardless of device. Touch/pen is owned exclusively by the joystick, so
 * tapping the screen never hijacks movement (no tap-to-move).
 */
export class InputManager {
  keys = new Set<string>();
  pointerActive = false;
  pointerX = 0;
  pointerY = 0;
  private el: HTMLElement;
  private joystick: VirtualJoystick | null = null;

  constructor(el: HTMLElement) {
    this.el = el;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('blur', this.onBlur);
  }

  /** Wire the virtual joystick (created once the DOM exists). */
  attachJoystick(j: VirtualJoystick) {
    this.joystick = j;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const c = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) e.preventDefault();
    this.keys.add(c);
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onBlur = () => {
    this.keys.clear();
    this.pointerActive = false;
  };

  // Mouse-only pointer-follow. Touch/pen belongs to the joystick.
  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    this.pointerActive = true;
    this.pointerX = e.clientX;
    this.pointerY = e.clientY;
  };
  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !this.pointerActive) return;
    this.pointerX = e.clientX;
    this.pointerY = e.clientY;
  };
  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    this.pointerActive = false;
  };

  /** Keyboard-only direction vector (may exceed unit length; caller normalizes). */
  getAxis(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    return { x, y };
  }

  /**
   * Unified movement direction for the player.
   * `mag` is 1 for keyboard (digital) and 0..1 for the analog joystick.
   */
  getMove(): { x: number; y: number; mag: number } {
    const j = this.joystick;
    if (j && j.active && j.magnitude > 0.01) {
      return { x: j.dirX, y: j.dirY, mag: j.magnitude };
    }
    const axis = this.getAxis();
    if (axis.x !== 0 || axis.y !== 0) return { x: axis.x, y: axis.y, mag: 1 };
    return { x: 0, y: 0, mag: 0 };
  }

  get isPointerDown() {
    return this.pointerActive;
  }
}