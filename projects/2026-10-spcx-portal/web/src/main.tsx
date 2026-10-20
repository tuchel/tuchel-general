import { createRoot } from 'react-dom/client';

import '../../../../shared/charts/charts.css';
import '../../../../shared/charts/fonts/inter.css';
import './style.css';
import { setChartFace } from '../../../../shared/charts/src/index.ts';
import { INTER } from '../../../../shared/charts/src/fonts/inter.generated.ts';
import { App } from './App.tsx';

setChartFace(INTER);

// The kit's dark tokens apply under data-theme="dark". A host that sets the theme wins;
// otherwise follow the reader's OS setting.
const root = document.documentElement;
if (!root.hasAttribute('data-theme')) {
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  const theme = () => root.setAttribute('data-theme', dark.matches ? 'dark' : 'light');
  theme();
  dark.addEventListener('change', theme);
}

createRoot(document.getElementById('root')!).render(<App />);
