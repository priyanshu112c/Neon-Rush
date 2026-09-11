/**
 * config.ts — central gameplay tuning layer.
 *
 * Everything a designer wants to tweak lives here. Nothing else in the codebase
 * should hard-code balance numbers.
 */

/* ------------------------------------------------------------------ */
/*  ENEMY TYPES                                                        */
/* ------------------------------------------------------------------ */

export interface RangedConfig {
  range: number;
  cooldown: number;
  projectileSpeed: number;
  damage: number;
  color: string;
}

export interface EnemyTypeConfig {
  key: string;
  name: string;
  health: number;
  speed: number;
  radius: number;
  /** Contact damage dealt to the player. */
  damage: number;
  color: string;
  score: number;
  /** Relative spawn weight inside a level's enemyTypes pool. */
  weight: number;
  sides: number;
  ranged?: RangedConfig;
}

export const ENEMY_TYPES: Record<string, EnemyTypeConfig> = {
  normal: {
    key: 'normal', name: 'Drifter',
    health: 42, speed: 108, radius: 16, damage: 16,
    color: '#ff3b5c', score: 10, weight: 5, sides: 3,
  },
  fast: {
    key: 'fast', name: 'Zipper',
    health: 24, speed: 212, radius: 12, damage: 10,
    color: '#ff2d78', score: 14, weight: 3, sides: 4,
  },
  tank: {
    key: 'tank', name: 'Bulwark',
    health: 150, speed: 68, radius: 26, damage: 28,
    color: '#8b5cff', score: 26, weight: 2, sides: 6,
  },
  ranged: {
    key: 'ranged', name: 'Sentry',
    health: 52, speed: 84, radius: 15, damage: 8,
    color: '#00e5ff', score: 20, weight: 2, sides: 4,
    ranged: { range: 440, cooldown: 1.7, projectileSpeed: 310, damage: 12, color: '#00e5ff' },
  },
  elite: {
    key: 'elite', name: 'Elite Drifter',
    health: 118, speed: 138, radius: 20, damage: 22,
    color: '#ffd166', score: 40, weight: 1, sides: 5,
  },
  boss: {
    key: 'boss', name: 'Overlord',
    health: 950, speed: 92, radius: 44, damage: 34,
    color: '#ff2d78', score: 400, weight: 0, sides: 8,
  },
};

/* ------------------------------------------------------------------ */
/*  EASY-TO-EDIT SPAWN VALUES                                          */
/*  Change these two numbers to make the game easier or harder.        */
/* ------------------------------------------------------------------ */

/** How many enemies a wave contains at level 1 (before per-level overrides). */
export const ENEMIES_PER_WAVE = 5;

/** Hard ceiling on how many enemies can exist at once. */
export const MAX_ENEMIES_ALIVE = 8;

/** Seconds between individual spawns inside a wave. */
export const SPAWN_INTERVAL = 2.6;

/** Seconds of breathing room after a wave is cleared. */
export const WAVE_DELAY = 5;

/** Enemies never appear closer than this to the player. */
export const MIN_SPAWN_DIST = 560;

/** Enemies never appear further than this (keeps action local). */
export const MAX_SPAWN_DIST = 1300;

/* ------------------------------------------------------------------ */
/*  SPAWN CONFIG                                                       */
/* ------------------------------------------------------------------ */

export interface SpawnConfig {
  enabled: boolean;
  enemiesPerWave: number;
  maxEnemiesAlive: number;
  spawnInterval: number;
  minimumSpawnDistanceFromPlayer: number;
  maximumSpawnDistanceFromPlayer: number;
  waveDelay: number;
  difficultyMultiplier: number;
  spawnRate: number;
  progressiveDifficulty: boolean;
  /** Keys into ENEMY_TYPES that this level may roll. */
  enemyTypes: string[];
  /** Prefer spawn points outside the camera view. */
  spawnOffscreen: boolean;
  /** Enemies further than this from the player are recycled. */
  cullDistance: number;
}

export const SPAWN_CONFIG: SpawnConfig = {
  enabled: true,
  enemiesPerWave: ENEMIES_PER_WAVE,
  maxEnemiesAlive: MAX_ENEMIES_ALIVE,
  spawnInterval: SPAWN_INTERVAL,
  minimumSpawnDistanceFromPlayer: MIN_SPAWN_DIST,
  maximumSpawnDistanceFromPlayer: MAX_SPAWN_DIST,
  waveDelay: WAVE_DELAY,
  difficultyMultiplier: 1,
  spawnRate: 1,
  progressiveDifficulty: true,
  enemyTypes: ['normal'],
  spawnOffscreen: true,
  cullDistance: 2400,
};

/* ------------------------------------------------------------------ */
/*  PLAYER CONFIG                                                      */
/* ------------------------------------------------------------------ */

export const PLAYER_CONFIG = {
  maxHealth: 100,
  radius: 15,
  maxSpeed: 430,
  accel: 2300,
  friction: 0.86,
  /** Seconds between auto-fire shots. */
  fireInterval: 0.3,
  bulletSpeed: 780,
  bulletDamage: 22,
  bulletRadius: 5,
  bulletLife: 1.05,
  /** Auto-fire only acquires targets within this range. */
  attackRange: 520,
  /** Invulnerability window after taking a hit, in seconds. */
  invulnTime: 0.9,
  /** Chance an enemy drops a pickup on death. */
  dropChance: 0.28,
  healthPickupHeal: 25,
} as const;

/* ------------------------------------------------------------------ */
/*  WORLD CONFIG                                                       */
/* ------------------------------------------------------------------ */

export const WORLD_CONFIG = {
  width: 3600,
  height: 2600,
  boundaryPadding: 48,
  buildingCount: 26,
  rockCount: 38,
  treeCount: 44,
  crateCount: 22,
  poiCount: 6,
  /** Keep buildings clear of the world centre (level spawn point). */
  spawnClearance: 300,
} as const;

/* ------------------------------------------------------------------ */
/*  GAME CONFIG                                                        */
/* ------------------------------------------------------------------ */

export const GAME_CONFIG = {
  /** Camera follow smoothing (higher = snappier). */
  cameraLerp: 6,
  /** Difficulty multiplier applied per level index. */
  difficultyPerLevel: 0.16,
  maxDifficulty: 2.4,
  showMinimap: true,
  minimapSize: 168,
} as const;