/**
 * Canvas — full-viewport HTML canvas element.
 *
 * Renders a white canvas that fills the entire viewport (100vw × 100vh).
 * Uses ResizeObserver to track window resize with debouncing (100ms). [AC3]
 * Wrapped in ErrorBoundary for crash resilience. [AC9]
 *
 * @module
 */

import { useEffect, useRef, useCallback } from 'react';
import { ErrorBoundary } from './ErrorBoundary.js';

/** Minimum canvas dimensions to prevent zero-size or negative canvas. */
const MIN_WIDTH = 1;
const MIN_HEIGHT = 1;

/** Debounce delay for ResizeObserver callbacks (ms). */
const RESIZE_DEBOUNCE_MS = 100;

function CanvasInner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = Math.max(container.clientWidth, MIN_WIDTH);
    const height = Math.max(container.clientHeight, MIN_HEIGHT);

    canvas.width = width;
    canvas.height = height;
  }, []);

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
        }}
      />
    </div>
  );
}

/** Full-viewport canvas component with error boundary. */
export function Canvas() {
  return (
    <ErrorBoundary>
      <CanvasInner />
    </ErrorBoundary>
  );
}
