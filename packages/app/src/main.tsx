/**
 * Application entry point.
 *
 * Renders the React application into the DOM root element.
 *
 * @module
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in the DOM.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
