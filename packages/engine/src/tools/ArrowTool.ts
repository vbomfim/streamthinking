/**
 * Arrow drawing tool.
 *
 * Same as LineTool but creates arrows with endArrowhead: true.
 * Minimum distance: 5px. Auto-switches to Select after creation.
 *
 * @module
 */

import { nanoid } from 'nanoid';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';
import type { VisualExpression } from '@infinicanvas/protocol';
import type { ToolHandler, DrawPreview } from './BaseTool.js';
import { useCanvasStore } from '../store/canvasStore.js';

/** Minimum arrow length in world units. */
const MIN_ARROW_LENGTH = 5;

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

  onPointerDown(worldX: number, worldY: number, _event: PointerEvent): void {
    this.isDrawing = true;
    this.startX = worldX;
    this.startY = worldY;
    this.endX = worldX;
    this.endY = worldY;
  }

  onPointerMove(worldX: number, worldY: number, _event: PointerEvent): void {
    if (!this.isDrawing) return;
    this.endX = worldX;
    this.endY = worldY;
  }

  onPointerUp(worldX: number, worldY: number, _event: PointerEvent): void {
    if (!this.isDrawing) return;

    this.endX = worldX;
    this.endY = worldY;
    this.isDrawing = false;

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
      style: { ...DEFAULT_EXPRESSION_STYLE },
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
    };
  }

  private reset(): void {
    this.startX = 0;
    this.startY = 0;
    this.endX = 0;
    this.endY = 0;
  }
}

/** Compute axis-aligned bounding box from a set of points. */
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
    size: { width: maxX - minX, height: maxY - minY },
  };
}
