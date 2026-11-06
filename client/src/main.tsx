import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/baloo-2/500.css';
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/noto-nastaliq-urdu/500.css';
import '@fontsource/noto-nastaliq-urdu/700.css';
import './styles.css';
import App from './App';
import { AuthProvider } from './auth';
import { LangProvider } from './i18n';
import { ToastProvider } from './components/ui';
import { applyTheme } from './theme';

applyTheme();
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LangProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
