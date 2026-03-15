/**
 * Text drawing tool.
 *
 * Click → position textarea overlay → Enter commits text, ESC cancels →
 * creates text expression. Auto-switches to Select after creation.
 *
 * The tool itself manages the input position; the actual textarea
 * rendering is handled by the Canvas component which reads getInputPosition().
 *
 * @module
 */

import { nanoid } from 'nanoid';
import type { VisualExpression } from '@infinicanvas/protocol';
import type { ToolHandler, DrawPreview } from './BaseTool.js';
import { useCanvasStore } from '../store/canvasStore.js';

/** Default text properties. */
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_FONT_FAMILY = 'sans-serif';
const DEFAULT_TEXT_ALIGN = 'left' as const;

/** Default text expression size. */
const TEXT_WIDTH = 200;
const TEXT_HEIGHT = 50;

/** Human author for locally-drawn expressions. */
const LOCAL_AUTHOR = {
  type: 'human' as const,
  id: 'local-user',
  name: 'You',
};

/** Tool handler for creating text expressions on the canvas. */
export class TextTool implements ToolHandler {
  private inputPosition: { x: number; y: number } | null = null;

  onPointerDown(_worldX: number, _worldY: number, _event: PointerEvent): void {
    // If already waiting for input, commit/cancel first
    if (this.inputPosition) {
      this.onCancel();
    }
  }

  onPointerMove(_worldX: number, _worldY: number, _event: PointerEvent): void {
    // Text tool has no drag preview
  }

  onPointerUp(worldX: number, worldY: number, _event: PointerEvent): void {
    // Set position for the text input overlay
    this.inputPosition = { x: worldX, y: worldY };
  }

  onCancel(): void {
    this.inputPosition = null;
  }

  getPreview(): DrawPreview | null {
    // Text tool has no drag preview
    return null;
  }

  /** Get the world position where text input should appear. */
  getInputPosition(): { x: number; y: number } | null {
    return this.inputPosition;
  }

  /**
   * Commit the text content and create the expression.
   *
   * Called by the text input overlay when the user presses Enter.
   */
  commitText(text: string): void {
    if (!this.inputPosition || !text.trim()) {
      this.inputPosition = null;
      return;
    }

    const now = Date.now();
    const id = nanoid();

    const expression: VisualExpression = {
      id,
      kind: 'text',
      position: { x: this.inputPosition.x, y: this.inputPosition.y },
      size: { width: TEXT_WIDTH, height: TEXT_HEIGHT },
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
        kind: 'text',
        text,
        fontSize: DEFAULT_FONT_SIZE,
        fontFamily: DEFAULT_FONT_FAMILY,
        textAlign: DEFAULT_TEXT_ALIGN,
      },
    };

    const store = useCanvasStore.getState();
    store.addExpression(expression);
    store.setSelectedIds(new Set([id]));
    store.setActiveTool('select');

    this.inputPosition = null;
  }
}
