import type { SpawnConfig } from './config';

/**
 * levels.ts — data-driven level definitions.
 *
 * To create or edit a level, add/modify an entry in `LEVELS` below.
 * Each level declares its spawn configuration, its task list and its reward.
 */

export type TaskType =
  | 'kill'
  | 'collect'
  | 'reach'
  | 'survive'
  | 'protect'
  | 'clear'
  | 'boss';

export interface TaskDef {
  type: TaskType;
  label: string;
  description?: string;
  amount: number;
  x?: number;
  y?: number;
  enemyTypes?: string[];
  optional?: boolean;
}

export interface LevelDef {
  id: number;
  name: string;
  description: string;
  area: { x: number; y: number; w: number; h: number };
  spawn: Partial<SpawnConfig>;
  tasks: TaskDef[];
  difficulty: number;
  reward: number;
  next: number | null;
}

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: 'FIRST CONTACT',
    description: 'Hostiles have breached the perimeter. Clear them out.',
    area: { x: 900, y: 500, w: 1800, h: 1500 },
    difficulty: 1,
    reward: 50,
    next: 2,
    spawn: {
      enemiesPerWave: 5,
      maxEnemiesAlive: 6,
      spawnInterval: 3.2,
      waveDelay: 5,
      difficultyMultiplier: 1,
      enemyTypes: ['normal'],
    },
    tasks: [
      { type: 'kill', label: 'Eliminate enemies', description: 'Clear the abandoned area.', amount: 5 },
      { type: 'reach', label: 'Reach the extraction point', amount: 90, x: 2600, y: 1900 },
    ],
  },
  {
    id: 2,
    name: 'SCAVENGER RUN',
    description: 'Collect energy cores while hostiles close in.',
    area: { x: 700, y: 400, w: 2200, h: 1800 },
    difficulty: 2,
    reward: 70,
    next: 3,
    spawn: {
      enemiesPerWave: 7,
      maxEnemiesAlive: 8,
      spawnInterval: 3.0,
      waveDelay: 5,
      difficultyMultiplier: 1.15,
      enemyTypes: ['normal', 'fast'],
    },
    tasks: [
      { type: 'collect', label: 'Collect energy cores', amount: 6 },
      { type: 'kill', label: 'Eliminate enemies', amount: 6 },
    ],
  },
  {
    id: 3,
    name: 'THE ABANDONED DISTRICT',
    description: 'Investigate the area and eliminate hostile enemies.',
    area: { x: 600, y: 300, w: 2600, h: 2100 },
    difficulty: 3,
    reward: 100,
    next: 4,
    spawn: {
      enemiesPerWave: 10,
      maxEnemiesAlive: 10,
      spawnInterval: 2.6,
      waveDelay: 5,
      difficultyMultiplier: 1.32,
      enemyTypes: ['normal', 'fast', 'ranged'],
    },
    tasks: [
      { type: 'kill', label: 'Eliminate enemies', amount: 10 },
      { type: 'clear', label: 'Clear the district', amount: 1 },
      { type: 'reach', label: 'Reach the extraction point', amount: 90, x: 3200, y: 500 },
    ],
  },
  {
    id: 4,
    name: 'HOLD THE LINE',
    description: 'Fortify the zone and survive the assault.',
    area: { x: 900, y: 500, w: 1900, h: 1700 },
    difficulty: 4,
    reward: 140,
    next: 5,
    spawn: {
      enemiesPerWave: 9,
      maxEnemiesAlive: 10,
      spawnInterval: 2.3,
      waveDelay: 4,
      difficultyMultiplier: 1.48,
      enemyTypes: ['normal', 'fast', 'tank'],
    },
    tasks: [
      { type: 'survive', label: 'Survive the assault', amount: 45 },
      { type: 'kill', label: 'Eliminate enemies', amount: 12 },
    ],
  },
  {
    id: 5,
    name: 'OVERLORD',
    description: 'A command unit has been located. Destroy it.',
    area: { x: 700, y: 400, w: 2300, h: 1900 },
    difficulty: 5,
    reward: 200,
    next: 6,
    spawn: {
      enemiesPerWave: 8,
      maxEnemiesAlive: 10,
      spawnInterval: 2.6,
      waveDelay: 4,
      difficultyMultiplier: 1.64,
      enemyTypes: ['normal', 'fast', 'ranged', 'elite'],
    },
    tasks: [
      { type: 'boss', label: 'Destroy the Overlord', amount: 1, enemyTypes: ['boss'] },
      { type: 'kill', label: 'Eliminate guards', amount: 8 },
    ],
  },
  {
    id: 6,
    name: 'MULTI-OBJECTIVE',
    description: 'Multiple hostiles across several sectors. Secure them all.',
    area: { x: 500, y: 300, w: 2800, h: 2200 },
    difficulty: 6,
    reward: 260,
    next: 7,
    spawn: {
      enemiesPerWave: 12,
      maxEnemiesAlive: 12,
      spawnInterval: 2.1,
      waveDelay: 4,
      difficultyMultiplier: 1.8,
      enemyTypes: ['normal', 'fast', 'tank', 'ranged', 'elite'],
    },
    tasks: [
      { type: 'kill', label: 'Eliminate enemies', amount: 14 },
      { type: 'collect', label: 'Recover data cores', amount: 5 },
      { type: 'reach', label: 'Reach the extraction point', amount: 90, x: 3400, y: 2300 },
    ],
  },
  {
    id: 7,
    name: 'ENDLESS WATCH',
    description: 'Reinforcements keep coming. Hold as long as you can.',
    area: { x: 400, y: 200, w: 3000, h: 2300 },
    difficulty: 7,
    reward: 320,
    next: 8,
    spawn: {
      enemiesPerWave: 14,
      maxEnemiesAlive: 12,
      spawnInterval: 2.0,
      waveDelay: 3.5,
      difficultyMultiplier: 1.96,
      progressiveDifficulty: true,
      enemyTypes: ['normal', 'fast', 'tank', 'ranged', 'elite'],
    },
    tasks: [
      { type: 'survive', label: 'Survive the waves', amount: 60 },
      { type: 'kill', label: 'Eliminate enemies', amount: 18 },
    ],
  },
];

export function getLevel(id: number): LevelDef {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[LEVELS.length - 1];
}

export const FIRST_LEVEL_ID = LEVELS[0].id;