/**
 * Selection interaction hook — click, shift+click, and marquee selection.
 *
 * Integrates with the canvas pointer events when the Select tool is active:
 * - **Click select**: click on shape → setSelectedIds({id})
 * - **Click deselect**: click empty space → setSelectedIds(empty)
 * - **Shift+click**: toggle ID in selectedIds
 * - **Marquee select**: drag on empty space → dashed blue rectangle →
 *   on release, select all intersecting expressions
 *
 * Coordinates are converted from screen to world using `screenToWorld`.
 * Drag threshold: 5px diagonal to distinguish click from drag.
 *
 * @module
 */

import { useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '../store/canvasStore.js';
import { screenToWorld } from '../camera.js';
import { findExpressionAtPoint, findExpressionsInMarquee } from '../interaction/selectionManager.js';

/** Minimum drag distance (in screen pixels) to trigger marquee. */
const DRAG_THRESHOLD = 5;

/** Default hit-test tolerance in screen pixels. */
const HIT_TOLERANCE_PX = 5;

/** Marquee visual styles. */
const MARQUEE_STROKE_COLOR = '#4A90D9';
const MARQUEE_FILL_COLOR = 'rgba(74, 144, 217, 0.1)';
const MARQUEE_DASH_PATTERN = [6, 3];

export interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionInteraction {
  /** Current marquee rectangle in screen coordinates (null when not dragging). */
  marquee: MarqueeRect | null;
  /** Render the marquee overlay onto the given canvas context. */
  renderMarquee: (ctx: CanvasRenderingContext2D) => void;
}

/**
 * Hook for selection interactions on the canvas.
 *
 * Attaches pointer event handlers to the provided canvas ref.
 * Only active when the current tool is 'select'.
 */
export function useSelectionInteraction(
  canvasRef: React.RefObject<HTMLCanvasElement>,
): SelectionInteraction {
  const marqueeRef = useRef<MarqueeRect | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ sx: number; sy: number } | null>(null);

  // ── Pointer handlers ───────────────────────────────────────

  const handlePointerDown = useCallback((e: PointerEvent) => {
    const state = useCanvasStore.getState();
    if (state.activeTool !== 'select') return;

    // Only react to primary button (left click)
    if (e.button !== 0) return;

    dragStartRef.current = { sx: e.offsetX, sy: e.offsetY };
    isDraggingRef.current = false;
    marqueeRef.current = null;
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragStartRef.current) return;

    const state = useCanvasStore.getState();
    if (state.activeTool !== 'select') return;

    const dx = e.offsetX - dragStartRef.current.sx;
    const dy = e.offsetY - dragStartRef.current.sy;
    const distance = Math.hypot(dx, dy);

    if (distance >= DRAG_THRESHOLD) {
      isDraggingRef.current = true;

      // Update marquee in screen coordinates
      marqueeRef.current = {
        x: dragStartRef.current.sx,
        y: dragStartRef.current.sy,
        width: dx,
        height: dy,
      };
    }
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (!dragStartRef.current) return;

    const state = useCanvasStore.getState();
    if (state.activeTool !== 'select') {
      dragStartRef.current = null;
      marqueeRef.current = null;
      isDraggingRef.current = false;
      return;
    }

    const { camera, expressions, expressionOrder, selectedIds, setSelectedIds } = state;
    const worldTolerance = HIT_TOLERANCE_PX / camera.zoom;

    if (isDraggingRef.current && marqueeRef.current) {
      // ── Marquee selection ────────────────────────────────
      const { x, y, width, height } = marqueeRef.current;

      // Convert marquee corners to world coordinates
      const topLeft = screenToWorld(
        Math.min(x, x + width),
        Math.min(y, y + height),
        camera,
      );
      const bottomRight = screenToWorld(
        Math.max(x, x + width),
        Math.max(y, y + height),
        camera,
      );

      const worldMarquee = {
        x: topLeft.x,
        y: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
      };

      const hitIds = findExpressionsInMarquee(worldMarquee, expressions);

      if (e.shiftKey) {
        // Shift+marquee: add to current selection
        const newIds = new Set(selectedIds);
        for (const id of hitIds) {
          newIds.add(id);
        }
        setSelectedIds(newIds);
      } else {
        setSelectedIds(new Set(hitIds));
      }
    } else {
      // ── Click selection ──────────────────────────────────
      const worldPoint = screenToWorld(e.offsetX, e.offsetY, camera);
      const hitId = findExpressionAtPoint(worldPoint, expressions, expressionOrder, worldTolerance);

      if (hitId) {
        if (e.shiftKey) {
          // Shift+click: toggle in selection
          const newIds = new Set(selectedIds);
          if (newIds.has(hitId)) {
            newIds.delete(hitId);
          } else {
            newIds.add(hitId);
          }
          setSelectedIds(newIds);
        } else {
          // Click: select only this expression
          setSelectedIds(new Set([hitId]));
        }
      } else {
        // Click on empty space: deselect all
        if (!e.shiftKey) {
          setSelectedIds(new Set());
        }
      }
    }

    // Reset drag state
    dragStartRef.current = null;
    marqueeRef.current = null;
    isDraggingRef.current = false;
  }, []);

  // ── Effect: attach/detach event listeners ──────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
    };
  }, [canvasRef, handlePointerDown, handlePointerMove, handlePointerUp]);

  // ── Marquee rendering ──────────────────────────────────────

  const renderMarquee = useCallback((ctx: CanvasRenderingContext2D) => {
    const rect = marqueeRef.current;
    if (!rect) return;

    ctx.save();

    // Reset to screen coordinates for marquee overlay
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Fill
    ctx.fillStyle = MARQUEE_FILL_COLOR;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    // Dashed border
    ctx.strokeStyle = MARQUEE_STROKE_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash(MARQUEE_DASH_PATTERN);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.setLineDash([]);

    ctx.restore();
  }, []);

  return {
    marquee: marqueeRef.current,
    renderMarquee,
  };
}
