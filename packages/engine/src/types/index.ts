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
  | 'text'
  | 'sticky-note';

/** Camera state for viewport panning and zooming. */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** A saved camera position for presentation mode navigation. */
export interface CameraWaypoint {
  x: number;
  y: number;
  zoom: number;
  label?: string;
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
  /** Saved camera waypoints for presentation mode. */
  waypoints: CameraWaypoint[];
  /** Active waypoint index (-1 = not in presentation mode). */
  presentationIndex: number;
  /** Log of all protocol operations applied to the canvas. */
  operationLog: ProtocolOperation[];
  /** Last style used for drawing — applied to new expressions. */
  lastUsedStyle: ExpressionStyle;
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
  /**
   * Apply style changes to multiple expressions. Emits `style` ProtocolOperation.
   * Also updates `lastUsedStyle` for new expression defaults.
   */
  styleExpressions: (ids: string[], style: Partial<ExpressionStyle>) => void;
  /**
   * Set the last-used style (merged with existing lastUsedStyle).
   * UI-only — does NOT emit operations.
   */
  setLastUsedStyle: (style: Partial<ExpressionStyle>) => void;
  /**
   * Group multiple expressions under a new group ID.
   * Sets `parentId` on each expression and emits a `group` ProtocolOperation.
   * Requires at least 2 valid (existing) expression IDs.
   * Returns the generated group ID, or empty string if grouping was skipped.
   */
  groupExpressions: (ids: string[]) => string;
  /**
   * Ungroup all expressions belonging to the given group.
   * Clears `parentId` on each member and emits an `ungroup` ProtocolOperation.
   * No-op if no expressions have the given parentId.
   */
  ungroupExpressions: (groupId: string) => void;
  /**
   * Get all expression IDs that share the given parentId (group members).
   * Returns an empty array if no expressions belong to the group.
   */
  getGroupMembers: (groupId: string) => string[];
  /**
   * Expand a selection set to include all group members.
   * For each selected expression with a parentId, adds all siblings to the set.
   */
  expandSelectionToGroups: (ids: Set<string>) => Set<string>;
  /**
   * Duplicate a set of expressions, preserving group structure with new IDs.
   * Returns the IDs of the newly created expressions.
   */
  duplicateGrouped: (ids: Set<string>) => string[];
  /** Move expressions to the front of the z-order (rendered last = on top). */
  bringToFront: (ids: string[]) => void;
  /** Move expressions to the back of the z-order (rendered first = behind). */
  sendToBack: (ids: string[]) => void;
  /** Move expressions one step forward in z-order. */
  bringForward: (ids: string[]) => void;
  /** Move expressions one step backward in z-order. */
  sendBackward: (ids: string[]) => void;
  /** Add a camera waypoint. Snapshots current camera if no argument. */
  addWaypoint: (waypoint?: CameraWaypoint) => void;
  /** Remove a waypoint by index. */
  removeWaypoint: (index: number) => void;
  /** Clear all waypoints and exit presentation mode. */
  clearWaypoints: () => void;
  /** Navigate to a specific waypoint by index. */
  goToWaypoint: (index: number) => void;
  /** Advance to the next waypoint (wraps around). */
  nextWaypoint: () => void;
  /** Go to the previous waypoint (wraps around). */
  prevWaypoint: () => void;
  /** Exit presentation mode without clearing waypoints. */
  exitPresentation: () => void;
}
