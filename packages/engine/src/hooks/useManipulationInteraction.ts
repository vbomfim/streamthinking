/**
 * Manipulation interaction hook — move and resize.
 *
 * Integrates with canvas pointer events when the Select tool is active:
 * - **Move** (AC1, AC2): Drag selected shape body → move all selected
 *   shapes maintaining relative positions. Emit `move` ProtocolOperation
 *   on pointerup.
 * - **Resize corner** (AC3): Drag corner handle → free resize.
 *   Shift = constrain aspect ratio. Emit `transform` operation.
 * - **Resize edge** (AC4): Drag edge midpoint → one-dimension resize.
 * - **Resize minimum** (AC5): Cannot resize below 10×10 world units.
 * - **Locked guard** (AC8): Locked shapes are no-ops for move/resize.
 * - **Move preview** (AC9): Real-time drag via transient state; commit on
 *   pointerup only.
 * - **Cursor feedback** (AC10): `move` on body, resize arrows on handles.
 *
 * Keyboard shortcuts (delete, duplicate) are handled centrally by
 * useKeyboardShortcuts.
 *
 * @module
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import type { VisualExpression, ArrowBinding } from '@infinicanvas/protocol';
import { useCanvasStore } from '../store/canvasStore.js';
import { screenToWorld } from '../camera.js';
import { findSnapPoint } from '../interaction/connectorHelpers.js';
import {
  detectPointerTarget,
  computeResize,
  computePointDrag,
  getCursorForTarget,
  isPointBasedKind,
} from '../interaction/manipulationHelpers.js';
import type { HandleHit, PointHandleHit } from '../interaction/manipulationHelpers.js';

export interface ManipulationInteraction {
  /** Current cursor style based on pointer target. */
  cursor: string;
}

/** Drag mode for the current manipulation. */
type DragMode =
  | { kind: 'none' }
  | {
      kind: 'move';
      /** Original positions of all selected expressions before drag started. */
      originalPositions: Map<string, { x: number; y: number }>;
      /** World position where drag started. */
      startWorld: { x: number; y: number };
    }
  | {
      kind: 'resize';
      /** Handle being dragged. */
      handle: HandleHit;
      /** Original expression bounds before resize. */
      originalPosition: { x: number; y: number };
      originalSize: { width: number; height: number };
      /** World position where drag started. */
      startWorld: { x: number; y: number };
    }
  | {
      kind: 'point-drag';
      /** Point handle being dragged. */
      handle: PointHandleHit;
      /** Original points array before drag started. */
      originalPoints: [number, number][];
      /** Original expression bounds before drag. */
      originalPosition: { x: number; y: number };
      originalSize: { width: number; height: number };
      /** World position where drag started. */
      startWorld: { x: number; y: number };
    };

/**
 * Hook for shape manipulation interactions on the canvas.
 *
 * Attaches pointer and keyboard event handlers.
 * Only active when the current tool is 'select'.
 */
export function useManipulationInteraction(
  canvasRef: React.RefObject<HTMLCanvasElement>,
): ManipulationInteraction {
  const [cursor, setCursor] = useState('default');
  const dragModeRef = useRef<DragMode>({ kind: 'none' });

  // ── Pointer handlers ───────────────────────────────────────

  const handlePointerDown = useCallback((e: PointerEvent) => {
    const state = useCanvasStore.getState();
    if (state.activeTool !== 'select') return;
    if (e.button !== 0) return;

    const { camera, expressions, selectedIds } = state;
    const worldPoint = screenToWorld(e.offsetX, e.offsetY, camera);

    // Detect target: handle or body of a selected expression
    const target = detectPointerTarget(worldPoint, expressions, selectedIds, camera);

    if (target.kind === 'point-handle') {
      const expr = expressions[target.handle.expressionId];
      if (!expr || expr.meta.locked) return; // AC8: locked guard

      // Extract points from the expression data
      const data = expr.data as { points: [number, number][] | [number, number, number][] };
      const originalPoints: [number, number][] = data.points.map(
        (p) => [p[0], p[1]] as [number, number],
      );

      dragModeRef.current = {
        kind: 'point-drag',
        handle: target.handle,
        originalPoints,
        originalPosition: { ...expr.position },
        originalSize: { ...expr.size },
        startWorld: worldPoint,
      };

      // Track arrow endpoint drag state for renderer
      if (expr.data.kind === 'arrow') {
        isDraggingArrowEndpoint = true;
        currentDragSnapPoint = null;
      }
    } else if (target.kind === 'handle') {
      const expr = expressions[target.handle.expressionId];
      if (!expr || expr.meta.locked) return; // AC8: locked guard

      dragModeRef.current = {
        kind: 'resize',
        handle: target.handle,
        originalPosition: { ...expr.position },
        originalSize: { ...expr.size },
        startWorld: worldPoint,
      };
    } else if (target.kind === 'body') {
      // Expand selection to include all group members
      const expandedIds = useCanvasStore.getState().expandSelectionToGroups(selectedIds);

      // Check if ALL expanded expressions are locked
      const allLocked = Array.from(expandedIds).every(
        (id) => expressions[id]?.meta.locked,
      );
      if (allLocked) return; // AC8: locked guard

      // Capture original positions of all expanded (unlocked) expressions
      const originalPositions = new Map<string, { x: number; y: number }>();
      for (const id of expandedIds) {
        const expr = expressions[id];
        if (expr && !expr.meta.locked) {
          originalPositions.set(id, { ...expr.position });
        }
      }

      dragModeRef.current = {
        kind: 'move',
        originalPositions,
        startWorld: worldPoint,
      };
    }
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const state = useCanvasStore.getState();
    if (state.activeTool !== 'select') return;

    const { camera, expressions, selectedIds } = state;
    const worldPoint = screenToWorld(e.offsetX, e.offsetY, camera);
    const drag = dragModeRef.current;

    if (drag.kind === 'move') {
      // ── Transient move preview (AC9) ────────────────────
      const dx = worldPoint.x - drag.startWorld.x;
      const dy = worldPoint.y - drag.startWorld.y;

      useCanvasStore.setState((draft) => {
        for (const [id, orig] of drag.originalPositions) {
          const expr = draft.expressions[id];
          if (expr) {
            expr.position = { x: orig.x + dx, y: orig.y + dy };
          }
        }
      });
    } else if (drag.kind === 'resize') {
      // ── Transient resize preview ────────────────────────
      const dx = worldPoint.x - drag.startWorld.x;
      const dy = worldPoint.y - drag.startWorld.y;

      const resized = computeResize({
        handleType: drag.handle.type,
        deltaX: dx,
        deltaY: dy,
        originalPosition: drag.originalPosition,
        originalSize: drag.originalSize,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey || e.metaKey,
      });

      useCanvasStore.setState((draft) => {
        const expr = draft.expressions[drag.handle.expressionId];
        if (expr) {
          expr.position = resized.position;
          expr.size = resized.size;
        }
      });
    } else if (drag.kind === 'point-drag') {
      // ── Transient point-drag preview ────────────────────

      // Check for snap during arrow endpoint drag
      let snapTarget = worldPoint;
      if (isDraggingArrowEndpoint) {
        const snap = findSnapPointForDrag(worldPoint, useCanvasStore.getState().expressions, drag.handle.expressionId);
        if (snap) {
          snapTarget = snap.point;
          currentDragSnapPoint = snap.point;
        } else {
          currentDragSnapPoint = null;
        }
      }

      const result = computePointDrag({
        pointIndex: drag.handle.pointIndex,
        originalPoints: drag.originalPoints,
        newPointPosition: snapTarget,
      });

      useCanvasStore.setState((draft) => {
        const expr = draft.expressions[drag.handle.expressionId];
        if (expr && isPointBasedKind(expr.data.kind)) {
          const data = expr.data as { points: [number, number][] | [number, number, number][]; startBinding?: unknown; endBinding?: unknown };
          if (expr.data.kind === 'freehand') {
            const freehandPoints = data.points as [number, number, number][];
            const pressure = freehandPoints[drag.handle.pointIndex]?.[2] ?? 0.5;
            (data.points as [number, number, number][])[drag.handle.pointIndex] =
              [snapTarget.x, snapTarget.y, pressure];
          } else {
            (data.points as [number, number][])[drag.handle.pointIndex] =
              [snapTarget.x, snapTarget.y];
          }

          // Clear binding immediately so arrow detaches visually during drag
          if (expr.data.kind === 'arrow') {
            const isStart = drag.handle.pointIndex === 0;
            const isEnd = drag.handle.pointIndex === (drag.originalPoints.length - 1);
            if (isStart) data.startBinding = undefined;
            if (isEnd) data.endBinding = undefined;
          }

          expr.position = result.position;
          expr.size = result.size;
        }
      });
    } else {
      // ── Hover cursor feedback (AC10) ────────────────────
      const target = detectPointerTarget(worldPoint, expressions, selectedIds, camera);
      setCursor(getCursorForTarget(target));
    }
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    const drag = dragModeRef.current;
    if (drag.kind === 'none') return;

    const state = useCanvasStore.getState();
    const { camera } = state;
    const worldPoint = screenToWorld(e.offsetX, e.offsetY, camera);

    if (drag.kind === 'move') {
      const dx = worldPoint.x - drag.startWorld.x;
      const dy = worldPoint.y - drag.startWorld.y;

      // Only commit if there was actual movement
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        const moves = Array.from(drag.originalPositions).map(([id, from]) => ({
          id,
          from,
          to: { x: from.x + dx, y: from.y + dy },
        }));

        state.moveExpressions(moves);
      }
    } else if (drag.kind === 'resize') {
      const dx = worldPoint.x - drag.startWorld.x;
      const dy = worldPoint.y - drag.startWorld.y;

      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        const resized = computeResize({
          handleType: drag.handle.type,
          deltaX: dx,
          deltaY: dy,
          originalPosition: drag.originalPosition,
          originalSize: drag.originalSize,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey || e.metaKey,
        });

        state.transformExpression(
          drag.handle.expressionId,
          { position: drag.originalPosition, size: drag.originalSize },
          { position: resized.position, size: resized.size },
        );
      }
    } else if (drag.kind === 'point-drag') {
      const dx = worldPoint.x - drag.startWorld.x;
      const dy = worldPoint.y - drag.startWorld.y;

      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        // Check for snap when dragging arrow endpoints
        let snapTarget = worldPoint;
        let newBinding: ArrowBinding | undefined;
        const expr = state.expressions[drag.handle.expressionId];

        if (expr && (expr.data.kind === 'arrow' || expr.data.kind === 'line')) {
          const snap = findSnapPointForDrag(worldPoint, state.expressions, drag.handle.expressionId);
          if (snap) {
            snapTarget = snap.point;
            newBinding = { expressionId: snap.targetId, anchor: snap.anchor as ArrowBinding['anchor'], ratio: snap.ratio };
            currentDragSnapPoint = snap.point;
          } else {
            currentDragSnapPoint = null;
          }
        }

        const result = computePointDrag({
          pointIndex: drag.handle.pointIndex,
          originalPoints: drag.originalPoints,
          newPointPosition: snapTarget,
        });

        if (expr) {
          let updatedData: Record<string, unknown>;

          if (expr.data.kind === 'freehand') {
            const freehandData = expr.data as { kind: 'freehand'; points: [number, number, number][] };
            const newPoints: [number, number, number][] = freehandData.points.map(
              (p) => [p[0], p[1], p[2]] as [number, number, number],
            );
            const pressure = newPoints[drag.handle.pointIndex]?.[2] ?? 0.5;
            newPoints[drag.handle.pointIndex] = [snapTarget.x, snapTarget.y, pressure];
            updatedData = { ...expr.data, points: newPoints };
          } else {
            updatedData = { ...expr.data, points: result.points };
          }

          // Update bindings for arrow endpoints
          if (expr.data.kind === 'arrow') {
            const isStart = drag.handle.pointIndex === 0;
            const isEnd = drag.handle.pointIndex === (drag.originalPoints.length - 1);
            if (isStart) {
              (updatedData as Record<string, unknown>).startBinding = newBinding ?? undefined;
            }
            if (isEnd) {
              (updatedData as Record<string, unknown>).endBinding = newBinding ?? undefined;
            }
          }

          state.updateExpression(drag.handle.expressionId, {
            data: updatedData as unknown as VisualExpression['data'],
            position: result.position,
            size: result.size,
          });
        }
      }
    }

    dragModeRef.current = { kind: 'none' };
    isDraggingArrowEndpoint = false;
    currentDragSnapPoint = null;
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

  return { cursor };
}

const DRAG_SNAP_DISTANCE = 50;

/** Find snap point during endpoint drag, excluding the arrow itself. */
function findSnapPointForDrag(
  worldPoint: { x: number; y: number },
  expressions: Record<string, VisualExpression>,
  excludeId: string,
): { point: { x: number; y: number }; anchor: string; targetId: string; ratio: number } | null {
  let best: { point: { x: number; y: number }; anchor: string; targetId: string; dist: number; ratio: number } | null = null;

  for (const [id, expr] of Object.entries(expressions)) {
    if (id === excludeId) continue;
    const snap = findSnapPoint(worldPoint, expr, DRAG_SNAP_DISTANCE);
    if (snap) {
      const dist = Math.hypot(worldPoint.x - snap.point.x, worldPoint.y - snap.point.y);
      if (!best || dist < best.dist) {
        best = { point: snap.point, anchor: snap.anchor, targetId: id, dist, ratio: snap.ratio };
      }
    }
  }

  return best ? { point: best.point, anchor: best.anchor, targetId: best.targetId, ratio: best.ratio } : null;
}

// ── Shared snap state for renderer ──────────────────────────
// Module-level so the render loop can read it without store subscription

/** Current snap point during arrow endpoint drag (null = no snap). */
export let currentDragSnapPoint: { x: number; y: number } | null = null;

/** Whether an arrow endpoint drag is in progress. */
export let isDraggingArrowEndpoint: boolean = false;
