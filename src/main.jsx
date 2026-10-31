import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Clickjacking protection: the app refuses to run inside another site's frame
if (window.top !== window.self) {
  window.top.location.replace(window.self.location.href);
}

// Actively purge obsolete caches from previous builds on every visit
if (typeof window !== 'undefined' && 'caches' in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      if (key !== 'cadastre-oliveira-pwa-v5' && key !== 'cadastre-tiles-v1') {
        caches.delete(key);
      }
    });
  }).catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Register PWA Service Worker with auto-update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        // Check for updates immediately
        reg.update();
        console.log('PWA Service Worker actif avec succès:', reg.scope);
      })
      .catch((err) => {
        console.warn('Erreur enregistrement PWA Service Worker:', err);
      });
  });
}
