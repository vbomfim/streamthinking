/**
 * Arrow drawing tool with connector binding support.
 *
 * Creates arrows with endArrowhead: true. When drawing starts or ends
 * near a shape edge, the arrow binds to that shape so it follows on move.
 * Minimum distance: 5px. Auto-switches to Select after creation.
 *
 * @module
 */

import { nanoid } from 'nanoid';
import type { VisualExpression, ArrowBinding } from '@infinicanvas/protocol';
import type { ToolHandler, DrawPreview } from './BaseTool.js';
import { useCanvasStore } from '../store/canvasStore.js';
import { findSnapPoint } from '../interaction/connectorHelpers.js';

/** Minimum arrow length in world units. */
const MIN_ARROW_LENGTH = 5;

/** Snap distance in world units for connector binding. */
const SNAP_DISTANCE = 20;

/** Human author for locally-drawn expressions. */
const LOCAL_AUTHOR = {
  type: 'human' as const,
  id: 'local-user',
  name: 'You',
};

/** Tool handler for drawing arrows on the canvas. */
export class ArrowTool implements ToolHandler {
  private isDrawing = false;
  private startX = 0;
  private startY = 0;
  private endX = 0;
  private endY = 0;
  private startBinding: ArrowBinding | undefined = undefined;
  private currentSnapPoint: { x: number; y: number } | undefined = undefined;
  private currentSnapTargetId: string | undefined = undefined;

  onPointerDown(worldX: number, worldY: number, _event: PointerEvent): void {
    this.isDrawing = true;
    this.startX = worldX;
    this.startY = worldY;
    this.endX = worldX;
    this.endY = worldY;

    // Check for start binding [CLEAN-CODE]
    const snap = this.findNearestSnap(worldX, worldY);
    if (snap) {
      this.startBinding = {
        expressionId: snap.targetId,
        anchor: snap.anchor as ArrowBinding['anchor'],
      };
      this.startX = snap.point.x;
      this.startY = snap.point.y;
    } else {
      this.startBinding = undefined;
    }
  }

  onPointerMove(worldX: number, worldY: number, _event: PointerEvent): void {
    if (!this.isDrawing) return;
    this.endX = worldX;
    this.endY = worldY;

    // Check for end snap indicator [CLEAN-CODE]
    const snap = this.findNearestSnap(worldX, worldY);
    if (snap) {
      this.currentSnapPoint = snap.point;
      this.currentSnapTargetId = snap.targetId;
    } else {
      this.currentSnapPoint = undefined;
      this.currentSnapTargetId = undefined;
    }
  }

  onPointerUp(worldX: number, worldY: number, _event: PointerEvent): void {
    if (!this.isDrawing) return;

    this.endX = worldX;
    this.endY = worldY;
    this.isDrawing = false;

    // Check for end binding [CLEAN-CODE]
    let endBinding: ArrowBinding | undefined;
    const snap = this.findNearestSnap(worldX, worldY);
    if (snap) {
      endBinding = {
        expressionId: snap.targetId,
        anchor: snap.anchor as ArrowBinding['anchor'],
      };
      this.endX = snap.point.x;
      this.endY = snap.point.y;
    }

    const length = Math.hypot(this.endX - this.startX, this.endY - this.startY);
    if (length < MIN_ARROW_LENGTH) {
      this.reset();
      return;
    }

    const points: [number, number][] = [
      [this.startX, this.startY],
      [this.endX, this.endY],
    ];

    const { position, size } = computeBoundingBox(points);
    const now = Date.now();
    const id = nanoid();

    const expression: VisualExpression = {
      id,
      kind: 'arrow',
      position,
      size,
      angle: 0,
      style: { ...useCanvasStore.getState().lastUsedStyle },
      meta: {
        author: LOCAL_AUTHOR,
        createdAt: now,
        updatedAt: now,
        tags: [],
        locked: false,
      },
      data: {
        kind: 'arrow',
        points,
        startArrowhead: false,
        endArrowhead: true,
        ...(this.startBinding && { startBinding: this.startBinding }),
        ...(endBinding && { endBinding }),
      },
    };

    const store = useCanvasStore.getState();
    store.addExpression(expression);
    store.setSelectedIds(new Set([id]));
    store.setActiveTool('select');

    this.reset();
  }

  onCancel(): void {
    this.isDrawing = false;
    this.reset();
  }

  getPreview(): DrawPreview | null {
    if (!this.isDrawing) return null;
    if (this.endX === this.startX && this.endY === this.startY) return null;

    const points: [number, number][] = [
      [this.startX, this.startY],
      [this.endX, this.endY],
    ];
    const { position, size } = computeBoundingBox(points);

    return {
      kind: 'arrow',
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      points,
      snapPoint: this.currentSnapPoint,
      snapTargetId: this.currentSnapTargetId,
    };
  }

  private reset(): void {
    this.startX = 0;
    this.startY = 0;
    this.endX = 0;
    this.endY = 0;
    this.startBinding = undefined;
    this.currentSnapPoint = undefined;
    this.currentSnapTargetId = undefined;
  }

  /**
   * Find the nearest snap target among all canvas expressions.
   *
   * Iterates all expressions and returns the closest snap point
   * within SNAP_DISTANCE, or null if none found. [SRP]
   */
  private findNearestSnap(
    worldX: number,
    worldY: number,
  ): { point: { x: number; y: number }; anchor: string; targetId: string } | null {
    const { expressions } = useCanvasStore.getState();
    let best: { point: { x: number; y: number }; anchor: string; targetId: string; dist: number } | null = null;

    for (const [id, expr] of Object.entries(expressions)) {
      const snap = findSnapPoint({ x: worldX, y: worldY }, expr, SNAP_DISTANCE);
      if (snap) {
        const dist = Math.hypot(worldX - snap.point.x, worldY - snap.point.y);
        if (!best || dist < best.dist) {
          best = { point: snap.point, anchor: snap.anchor, targetId: id, dist };
        }
      }
    }

    return best ? { point: best.point, anchor: best.anchor, targetId: best.targetId } : null;
  }
}

/** Compute axis-aligned bounding box from a set of points.
 * Ensures minimum size of 1 to satisfy Zod positive() constraint. */
function computeBoundingBox(points: [number, number][]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [px, py] of points) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }

  return {
    position: { x: minX, y: minY },
    size: {
      width: Math.max(maxX - minX, 1),
      height: Math.max(maxY - minY, 1),
    },
  };
}
