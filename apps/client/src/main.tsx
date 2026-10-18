import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { supportsWebGL2 } from './ui/webgl.ts';
import { createPageGame } from './session/game.tsx';
import './styles/tokens.css';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element');
const webgl2 = supportsWebGL2();
const game = createPageGame();
createRoot(root).render(
  <StrictMode>
    <App game={game} webgl2={webgl2} />
  </StrictMode>,
);
if (webgl2) void game.session.start();
