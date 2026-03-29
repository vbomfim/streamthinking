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
import { useInlineEditor } from '../hooks/useInlineEditor.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { useTouchGestures } from '../hooks/useTouchGestures.js';
import { useMetadataTooltip, formatRelativeTime } from '../hooks/useMetadataTooltip.js';
import { useCanvasStore } from '../store/canvasStore.js';
import { worldToScreen, screenToWorld } from '../camera.js';
import { createRenderLoop } from '../renderer/renderLoop.js';
import type { RenderLoop } from '../renderer/renderLoop.js';
import type { VisualExpression } from '@infinicanvas/protocol';
import { getStencil } from '../renderer/stencils/index.js';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';
import { nanoid } from 'nanoid';

/** Minimum canvas dimensions to prevent zero-size or negative canvas. */
const MIN_WIDTH = 1;
const MIN_HEIGHT = 1;

/** Debounce delay for ResizeObserver callbacks (ms). */
const RESIZE_DEBOUNCE_MS = 100;

function CanvasInner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderLoopRef = useRef<RenderLoop | null>(null);
  const { canvasRef, cursor: canvasCursor } = useCanvasInteraction();
  const { getMarquee } = useSelectionInteraction(canvasRef);
  const { cursor: manipulationCursor } = useManipulationInteraction(canvasRef);
  const { getDrawPreview, textTool, cancelDraw } = useDrawingInteraction(canvasRef);
  const inlineEditor = useInlineEditor(canvasRef);
  useTouchGestures(canvasRef);
  const tooltip = useMetadataTooltip(canvasRef);

  // Track active tool for cursor and text overlay
  const activeTool = useCanvasStore((s) => s.activeTool);
  const camera = useCanvasStore((s) => s.camera);

  // Check text tool input position on each render
  const textInputPos = textTool.getInputPosition();

  // Inline editor: look up the expression being edited
  const editingExpr = useCanvasStore((s) =>
    inlineEditor.editingId ? s.expressions[inlineEditor.editingId] ?? null : null,
  );

  // Manipulation cursor takes priority, then drawing crosshair/text, then canvas default
  let cursor = canvasCursor;
  if (manipulationCursor !== 'default') {
    cursor = manipulationCursor;
  } else if (activeTool === 'text') {
    cursor = 'text';
  } else if (activeTool !== 'select') {
    cursor = 'crosshair';
  }

  // Register centralized keyboard shortcuts (tool switching, undo/redo,
  // delete, duplicate, select all, escape, help panel) [Issue #10]
  const { showShortcutsHelp, setShowShortcutsHelp } = useKeyboardShortcuts({ cancelDraw, startEditing: inlineEditor.startEditing });

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
    const marqueeProvider = {
      getMarquee,
    };
    const dpr = window.devicePixelRatio || 1;
    const loop = createRenderLoop(ctx, getCamera, width, height, roughCanvas, expressionProvider, selectionProvider, drawPreviewProvider, dpr, marqueeProvider);

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

  /** Handle stencil drops from the StencilPalette. */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const stencilId = e.dataTransfer.getData('application/x-infinicanvas-stencil');
    if (!stencilId) return;

    const entry = getStencil(stencilId);
    if (!entry) return;

    const { camera } = useCanvasStore.getState();
    const world = screenToWorld(e.clientX, e.clientY, camera);

    const expression: VisualExpression = {
      id: nanoid(),
      kind: 'stencil',
      position: { x: world.x - entry.defaultSize.width / 2, y: world.y - entry.defaultSize.height / 2 },
      size: { ...entry.defaultSize },
      angle: 0,
      style: { ...DEFAULT_EXPRESSION_STYLE },
      meta: {
        author: { type: 'human', id: 'local-user', name: 'User' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        locked: false,
      },
      data: { kind: 'stencil' as const, stencilId: entry.id, category: entry.category, label: entry.label },
    };

    useCanvasStore.getState().addExpression(expression);
    useCanvasStore.getState().setSelectedIds(new Set([expression.id]));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-infinicanvas-stencil')) {
      e.preventDefault();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
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
          backgroundColor: 'var(--bg-canvas, #ffffff)',
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
      {/* Inline edit overlay for double-click editing [#75, #79] */}
      {editingExpr && (
        <InlineEditOverlay
          expression={editingExpr}
          initialText={inlineEditor.getEditingText()}
          camera={camera}
          onCommit={(text) => {
            inlineEditor.commitEdit(text);
          }}
          onCancel={() => {
            inlineEditor.cancelEdit();
          }}
        />
      )}
      {/* Keyboard shortcuts help panel */}
      {showShortcutsHelp && (
        <ShortcutsHelpPanel onClose={() => setShowShortcutsHelp(false)} />
      )}
      {/* Metadata tooltip on expression hover */}
      {tooltip && (
        <div
          data-testid="metadata-tooltip"
          style={{
            position: 'fixed',
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            padding: '6px 10px',
            backgroundColor: 'var(--bg-toolbar, #ffffff)',
            border: '1px solid var(--border, #e0e0e0)',
            borderRadius: 6,
            boxShadow: '0 2px 8px var(--shadow, rgba(0,0,0,0.12))',
            fontSize: 12,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: 'var(--text-primary, #333333)',
            pointerEvents: 'none',
            zIndex: 50,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            {tooltip.data.kind}
          </div>
          <div style={{ color: 'var(--text-secondary, #666666)' }}>
            {tooltip.data.authorName} · {formatRelativeTime(tooltip.data.createdAt)}
          </div>
        </div>
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
        fontSize: `${scaledFontSize}px`,
        fontFamily: fontFamily,
        color: expression.style.strokeColor,
        background: 'white',
        resize: 'both',
        zIndex: 10,
      }}
    />
  );
}

// ── Inline Edit Overlay ────────────────────────────────────

interface InlineEditOverlayProps {
  expression: VisualExpression;
  initialText: string;
  camera: { x: number; y: number; zoom: number };
  onCommit: (text: string) => void;
  onCancel: () => void;
}

/**
 * Textarea overlay for inline editing of text, sticky-note text, and shape labels.
 *
 * Positioned at the expression's world coordinates. Sized to match the expression.
 * Enter commits, ESC cancels, blur commits. Auto-focuses and selects text on mount.
 *
 * [#75, #79]
 */
function InlineEditOverlay({ expression, initialText, camera, onCommit, onCancel }: InlineEditOverlayProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const committedRef = useRef(false);

  // Convert world position to screen position
  const screenPos = worldToScreen(
    expression.position.x,
    expression.position.y,
    camera,
  );

  // Scale expression dimensions to screen
  const screenWidth = expression.size.width * camera.zoom;
  const screenHeight = expression.size.height * camera.zoom;

  // Determine font from expression style, falling back to defaults
  const fontFamily = expression.style.fontFamily ?? 'Architects Daughter, cursive';
  const isText = expression.kind === 'text';
  const data = expression.data as Record<string, unknown>;
  const currentLabel = typeof data.label === 'string' ? data.label : (typeof data.text === 'string' ? data.text : '');

  // For text expressions, use the data fontSize. For shapes with labels, auto-scale to shape size.
  let baseFontSize: number;
  if (isText && typeof data.fontSize === 'number') {
    baseFontSize = data.fontSize;
  } else if (expression.style.fontSize) {
    baseFontSize = expression.style.fontSize;
  } else {
    // Match the renderer's auto-scale: 18% of height, capped by text width
    const { width, height } = expression.size;
    const labelLen = Math.max(currentLabel.length, 1);
    const autoSize = height * 0.2;
    baseFontSize = Math.max(8, Math.min(autoSize, 72));
  }
  const scaledFontSize = baseFontSize * camera.zoom;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      // Place cursor at end, don't select all (preserves initial char from type-to-edit)
      const len = textarea.value.length;
      textarea.setSelectionRange(len, len);
    }
  }, []);

  const doCommit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(textareaRef.current?.value ?? '');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      committedRef.current = true; // Prevent blur from also committing
      onCancel();
    }
  };

  const handleBlur = () => {
    doCommit();
  };

  // For stencils, position the edit overlay below the icon (where the label renders)
  const isStencil = expression.kind === 'stencil';
  const stencilLabelOffset = isStencil ? (expression.size.height + 4) * camera.zoom : 0;

  return (
    <textarea
      ref={textareaRef}
      data-testid="inline-edit-overlay"
      defaultValue={initialText}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      style={{
        position: 'absolute',
        left: `${isStencil ? screenPos.x - 20 : screenPos.x}px`,
        top: `${screenPos.y + stencilLabelOffset}px`,
        width: `${isStencil ? Math.max(screenWidth + 40, 120) : Math.max(screenWidth, 100)}px`,
        height: `${isStencil ? 28 : Math.max(screenHeight, 32)}px`,
        padding: isStencil ? '4px 8px' : `${Math.max((Math.max(screenHeight, 32) - scaledFontSize * 1.4) / 2, 4)}px 8px`,
        border: '2px solid #4A90D9',
        borderRadius: '4px',
        outline: 'none',
        fontSize: isStencil ? `${12 * camera.zoom}px` : `${scaledFontSize}px`,
        fontFamily: fontFamily,
        textAlign: 'center' as React.CSSProperties['textAlign'],
        background: expression.kind === 'sticky-note' && typeof data.color === 'string'
          ? data.color
          : 'transparent',
        resize: 'none',
        zIndex: 10,
        boxSizing: 'border-box',
        overflow: 'hidden',
        lineHeight: 1.4,
      }}
    />
  );
}
