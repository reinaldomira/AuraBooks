import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Suprime a notificação benigna de ResizeObserver dos motores Chromium/Safari (Foliate.js layout)
window.addEventListener('error', (e) => {
  if (
    e.message &&
    (e.message.includes('ResizeObserver loop completed with undelivered notifications') ||
     e.message.includes('ResizeObserver loop limit exceeded'))
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

// Ativa o Service Worker imediatamente para garantir suporte a instalação de PWA no celular
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(<App />);
