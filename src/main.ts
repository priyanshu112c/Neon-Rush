import { Game } from './game';
import './style.css';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const game = new Game(canvas);

// Expose for debugging convenience.
(window as unknown as { __game: Game }).__game = game;