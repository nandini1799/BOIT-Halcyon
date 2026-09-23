import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element: index.html is not the document being served.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
