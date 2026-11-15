// Self-hosted font with the Vietnamese subset (no font CDN), so every diacritic draws in the same face.
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/800.css';
import './ui/tokens.css';
// The shared shell's rules (shell-* classes only, e.g. the language pill); app.css dresses them in the sunset look.
import '@achoo254/app-shell/app-shell.css';
import './ui/app.css';
import './ui/game-screens.css';
import './ui/game-modes.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { I18nProvider } from './i18n/i18n';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');
createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
