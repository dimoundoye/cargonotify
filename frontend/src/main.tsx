import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Enregistrement du Service Worker pour la PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('[PWA] Service Worker enregistré avec succès:', reg.scope))
      .catch((err) => console.error('[PWA] Échec enregistrement Service Worker:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

