import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AppProvider } from './lib/AppContext.tsx';
import { ThemeColorProvider } from './components/ThemeColorProvider.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <ThemeColorProvider>
        <App />
      </ThemeColorProvider>
    </AppProvider>
  </StrictMode>
);