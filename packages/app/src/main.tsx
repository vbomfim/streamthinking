/**
 * Application entry point.
 *
 * Renders the React application into the DOM root element.
 * Imports theme CSS and applies persisted theme on startup.
 *
 * @module
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useUiStore, applyThemeToDocument } from '@infinicanvas/engine';
import { App } from './App.js';
import './styles/theme.css';

// Apply persisted theme before first render to avoid flash [CLEAN-CODE]
const uiStore = useUiStore.getState();
uiStore.loadPersistedTheme();
applyThemeToDocument(useUiStore.getState().theme);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in the DOM.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
