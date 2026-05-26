import './styles.css';
import { Game } from './core/Game';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Element #app introuvable.');
}

const game = new Game(app);
game.start();
