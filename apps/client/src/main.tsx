import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { createPageGame } from './session/game.tsx';
import './styles/tokens.css';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element');
const game = createPageGame();
createRoot(root).render(
  <StrictMode>
    <App game={game} />
  </StrictMode>,
);
void game.session.start();
