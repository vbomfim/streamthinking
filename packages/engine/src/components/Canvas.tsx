/**
 * Canvas — full-viewport HTML canvas element with camera system.
 *
 * Renders a white canvas that fills the entire viewport (100vw × 100vh).
 * Uses ResizeObserver to track window resize with debouncing (100ms). [AC3]
 * Integrates render loop for grid + camera transforms. [AC8]
 * Integrates pan/zoom interactions via useCanvasInteraction hook. [AC1, AC2]
 * Wrapped in ErrorBoundary for crash resilience. [AC9]
 *
 * @module
 */

import { useEffect, useRef, useCallback } from 'react';
import { ErrorBoundary } from './ErrorBoundary.js';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction.js';
import { useSelectionInteraction } from '../hooks/useSelectionInteraction.js';
import { useUndoRedoShortcuts } from '../hooks/useUndoRedoShortcuts.js';
import { useCanvasStore } from '../store/canvasStore.js';
import { createRenderLoop } from '../renderer/renderLoop.js';
import type { RenderLoop } from '../renderer/renderLoop.js';

/** Minimum canvas dimensions to prevent zero-size or negative canvas. */
const MIN_WIDTH = 1;
const MIN_HEIGHT = 1;

/** Debounce delay for ResizeObserver callbacks (ms). */
const RESIZE_DEBOUNCE_MS = 100;

function CanvasInner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderLoopRef = useRef<RenderLoop | null>(null);
  const { canvasRef, cursor } = useCanvasInteraction();
  const { renderMarquee } = useSelectionInteraction(canvasRef);

  // Register global undo/redo keyboard shortcuts [AC1, AC2]
  useUndoRedoShortcuts();

  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(container.clientWidth, MIN_WIDTH);
    const height = Math.max(container.clientHeight, MIN_HEIGHT);

    // Set canvas backing store to physical pixels for crisp rendering
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    // Set CSS display size to logical pixels
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Scale context so drawing uses logical coordinates
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Update render loop viewport size
    if (renderLoopRef.current) {
      renderLoopRef.current.updateSize(width, height);
    }
  }, [canvasRef]);

  // ── Render loop lifecycle ──────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    const width = Math.max(container?.clientWidth ?? MIN_WIDTH, MIN_WIDTH);
    const height = Math.max(container?.clientHeight ?? MIN_HEIGHT, MIN_HEIGHT);

    const getCamera = () => useCanvasStore.getState().camera;
    const selectionProvider = {
      getSelectedIds: () => useCanvasStore.getState().selectedIds,
    };
    const loop = createRenderLoop(ctx, getCamera, width, height, undefined, undefined, selectionProvider);

    renderLoopRef.current = loop;
    loop.start();

    return () => {
      loop.stop();
      renderLoopRef.current = null;
    };
  }, [canvasRef]);

  // ── Resize observer ────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Set initial size
    updateCanvasSize();

    // Debounced resize handler
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const observer = new ResizeObserver(() => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(updateCanvasSize, RESIZE_DEBOUNCE_MS);
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [updateCanvasSize]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        margin: 0,
        padding: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          backgroundColor: '#ffffff',
          cursor,
        }}
      />
    </div>
  );
}

/** Full-viewport canvas component with camera system and error boundary. */
export function Canvas() {
  return (
    <ErrorBoundary>
      <CanvasInner />
    </ErrorBoundary>
  );
}
