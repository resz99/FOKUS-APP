import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { registerSW } from './lib/push.js';
import './styles.css';

try {
  const theme = localStorage.getItem('fokus-theme');
  if (theme) document.documentElement.dataset.theme = theme;
} catch { /* abaikan */ }

createRoot(document.getElementById('root')).render(<App />);
registerSW();
