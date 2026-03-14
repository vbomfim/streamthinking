/**
 * Engine type definitions.
 *
 * @module
 */

import type { VisualExpression, ProtocolOperation } from '@infinicanvas/protocol';

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
}
