export const PALETTE = {
  bg: '#05060f',
  bg2: '#0b1026',
  cyan: '#00e5ff',
  magenta: '#ff2d78',
  green: '#39ff88',
  gold: '#ffd166',
  purple: '#8b5cff',
  red: '#ff3b5c',
  white: '#eaf6ff',
} as const;

export const TAU = Math.PI * 2;

export const rand = (min: number, max: number) => min + Math.random() * (max - min);
export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Append an 8-digit-hex alpha suffix onto a 6-digit hex color (#rrggbbAA). */
export const hexA = (hex: string, a: string) => hex + a;

export const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};