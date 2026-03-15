/**
 * Engine type definitions.
 *
 * @module
 */

import type { VisualExpression, ProtocolOperation, ExpressionStyle } from '@infinicanvas/protocol';

/** Tools available for canvas interaction. */
export type ToolType =
  | 'select'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'freehand'
  | 'text';

/** Camera state for viewport panning and zooming. */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Complete canvas state shape managed by Zustand. */
export interface CanvasState {
  /** All expressions on the canvas, keyed by ID. */
  expressions: Record<string, VisualExpression>;
  /** Ordered list of expression IDs representing z-order (back to front). */
  expressionOrder: string[];
  /** Currently selected expression IDs. */
  selectedIds: Set<string>;
  /** The currently active drawing/interaction tool. */
  activeTool: ToolType;
  /** Camera viewport state. */
  camera: Camera;
  /** Log of all protocol operations applied to the canvas. */
  operationLog: ProtocolOperation[];
}

/** Actions available on the canvas store. */
export interface CanvasActions {
  /** Add a new expression to the canvas. Validates with Zod schema. */
  addExpression: (expression: VisualExpression) => void;
  /** Update an existing expression with partial data. */
  updateExpression: (id: string, partial: Partial<VisualExpression>) => void;
  /** Delete one or more expressions by ID. */
  deleteExpressions: (ids: string[]) => void;
  /** Set the currently selected expression IDs. */
  setSelectedIds: (ids: Set<string>) => void;
  /** Set the active tool. */
  setActiveTool: (tool: ToolType) => void;
  /** Set the camera viewport state. */
  setCamera: (camera: Camera) => void;
  /** Undo the last content mutation, restoring previous canvas state. */
  undo: () => void;
  /** Redo the last undone action, restoring next canvas state. */
  redo: () => void;
  /** Whether there are actions to undo. */
  canUndo: boolean;
  /** Whether there are actions to redo. */
  canRedo: boolean;
  /** Reset undo/redo history stacks. */
  clearHistory: () => void;
  /**
   * Apply a remote operation from the gateway without appending to operationLog.
   * Prevents infinite send loops during collaboration.
   */
  applyRemoteOperation: (op: ProtocolOperation) => void;
  /**
   * Replace all canvas state for full state sync on session join.
   * Validates each expression with Zod schema; rejects invalid ones. [S7-1]
   * Clears operationLog and selection.
   */
  replaceState: (expressions: VisualExpression[], expressionOrder: string[]) => void;
  /**
   * Apply a validated style partial to multiple expressions. [S7-5]
   * Validates style with expressionStyleSchema.partial() before applying.
   * Skips locked expressions.
   */
  styleExpressions: (ids: string[], style: Partial<ExpressionStyle>) => void;
  /**
   * Move expressions to new positions. Emits `move` ProtocolOperations.
   * Accepts original positions so undo snapshot reflects pre-drag state.
   */
  moveExpressions: (
    moves: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } }>,
  ) => void;
  /**
   * Transform an expression (resize). Emits `transform` ProtocolOperation.
   * Accepts original values so undo snapshot reflects pre-drag state.
   */
  transformExpression: (
    id: string,
    original: { position: { x: number; y: number }; size: { width: number; height: number } },
    final: { position: { x: number; y: number }; size: { width: number; height: number } },
  ) => void;
}
