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
import rough from 'roughjs';
import { ErrorBoundary } from './ErrorBoundary.js';
import { ShortcutsHelpPanel } from './ShortcutsHelpPanel.js';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction.js';
import { useSelectionInteraction } from '../hooks/useSelectionInteraction.js';
import { useManipulationInteraction } from '../hooks/useManipulationInteraction.js';
import { useDrawingInteraction } from '../hooks/useDrawingInteraction.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { useCanvasStore } from '../store/canvasStore.js';
import { worldToScreen } from '../camera.js';
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
  const { canvasRef, cursor: canvasCursor } = useCanvasInteraction();
  useSelectionInteraction(canvasRef);
  const { cursor: manipulationCursor } = useManipulationInteraction(canvasRef);
  const { getDrawPreview, textTool, cancelDraw } = useDrawingInteraction(canvasRef);

  // Track active tool for cursor and text overlay
  const activeTool = useCanvasStore((s) => s.activeTool);
  const camera = useCanvasStore((s) => s.camera);

  // Check text tool input position on each render
  const textInputPos = textTool.getInputPosition();

  // Manipulation cursor takes priority, then drawing crosshair, then canvas default
  let cursor = canvasCursor;
  if (manipulationCursor !== 'default') {
    cursor = manipulationCursor;
  } else if (activeTool !== 'select') {
    cursor = 'crosshair';
  }

  // Register centralized keyboard shortcuts (tool switching, undo/redo,
  // delete, duplicate, select all, escape, help panel) [Issue #10]
  const { showShortcutsHelp, setShowShortcutsHelp } = useKeyboardShortcuts({ cancelDraw });

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
    const roughCanvas = rough.canvas(canvas);
    const expressionProvider = {
      getExpressions: () => useCanvasStore.getState().expressions,
      getExpressionOrder: () => useCanvasStore.getState().expressionOrder,
    };
    const selectionProvider = {
      getSelectedIds: () => useCanvasStore.getState().selectedIds,
    };
    const drawPreviewProvider = {
      getDrawPreview,
    };
    const loop = createRenderLoop(ctx, getCamera, width, height, roughCanvas, expressionProvider, selectionProvider, drawPreviewProvider);

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
        position: 'relative',
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
      {/* Text input overlay for text tool */}
      {textInputPos && (
        <TextInputOverlay
          worldX={textInputPos.x}
          worldY={textInputPos.y}
          camera={camera}
          onCommit={(text) => {
            textTool.commitText(text);
          }}
          onCancel={() => {
            textTool.onCancel();
          }}
        />
      )}
      {/* Keyboard shortcuts help panel */}
      {showShortcutsHelp && (
        <ShortcutsHelpPanel onClose={() => setShowShortcutsHelp(false)} />
      )}
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

// ── Text Input Overlay ─────────────────────────────────────

interface TextInputOverlayProps {
  worldX: number;
  worldY: number;
  camera: { x: number; y: number; zoom: number };
  onCommit: (text: string) => void;
  onCancel: () => void;
}

/**
 * Textarea overlay positioned at a world coordinate for the text tool.
 *
 * Enter commits the text, ESC cancels. Auto-focuses on mount.
 */
function TextInputOverlay({ worldX, worldY, camera, onCommit, onCancel }: TextInputOverlayProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Convert world position to screen position
  const screenPos = worldToScreen(worldX, worldY, camera);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onCommit(textareaRef.current?.value ?? '');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <textarea
      ref={textareaRef}
      onKeyDown={handleKeyDown}
      style={{
        position: 'absolute',
        left: `${screenPos.x}px`,
        top: `${screenPos.y}px`,
        minWidth: '200px',
        minHeight: '40px',
        padding: '4px 8px',
        border: '2px solid #4A90D9',
        borderRadius: '4px',
        outline: 'none',
        fontSize: '16px',
        fontFamily: 'sans-serif',
        background: 'white',
        resize: 'both',
        zIndex: 10,
      }}
    />
  );
}
