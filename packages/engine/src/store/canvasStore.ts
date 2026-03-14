/**
 * Canvas state store — Zustand with immer middleware.
 *
 * Manages all canvas state: expressions, selection, tools, camera, and
 * the protocol operation log. Mutation actions that affect canvas content
 * (add, update, delete) emit ProtocolOperations for collaboration tracking.
 * UI-only actions (selection, tool, camera) do NOT emit operations.
 *
 * @module
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { nanoid } from 'nanoid';
import {
  visualExpressionSchema,
} from '@infinicanvas/protocol';
import type {
  VisualExpression,
  ProtocolOperation,
  AuthorInfo,
} from '@infinicanvas/protocol';
import type { CanvasState, CanvasActions, ToolType, Camera } from '../types/index.js';

// Enable immer support for Set/Map (used by selectedIds: Set<string>)
enableMapSet();

/** System author used for store-generated operations. */
const SYSTEM_AUTHOR: AuthorInfo = {
  type: 'agent',
  id: 'canvas-engine',
  name: 'Canvas Engine',
  provider: 'infinicanvas',
};

/** Maximum operations kept in the log before oldest are evicted. */
const MAX_OPERATION_LOG = 10_000;

/** Min/max camera zoom bounds. */
const MIN_ZOOM = 0.01;
const MAX_ZOOM = 100;

/** Fields that cannot be changed via updateExpression. */
const IMMUTABLE_FIELDS = new Set(['id', 'kind', 'meta']);

/** Creates a ProtocolOperation with unique ID and current timestamp. */
function createOperation(
  type: ProtocolOperation['type'],
  payload: ProtocolOperation['payload'],
): ProtocolOperation {
  return {
    id: nanoid(),
    type,
    author: SYSTEM_AUTHOR,
    timestamp: Date.now(),
    payload,
  };
}

/** Append an operation to the log, evicting oldest entries if over cap. */
function pushOperation(log: ProtocolOperation[], op: ProtocolOperation): void {
  log.push(op);
  if (log.length > MAX_OPERATION_LOG) {
    log.splice(0, log.length - MAX_OPERATION_LOG);
  }
}

export const useCanvasStore = create<CanvasState & CanvasActions>()(
  immer((set) => ({
    // ── Initial state ────────────────────────────────────────
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select' as ToolType,
    camera: { x: 0, y: 0, zoom: 1 },
    operationLog: [],

    // ── Content mutations (emit ProtocolOperations) ──────────

    addExpression: (expression: VisualExpression) => {
      const result = visualExpressionSchema.safeParse(expression);
      if (!result.success) {
        console.warn(
          `[canvasStore] Invalid expression rejected:`,
          result.error.issues,
        );
        return;
      }

      set((state) => {
        if (state.expressions[expression.id]) {
          return;
        }

        state.expressions[expression.id] = expression;
        state.expressionOrder.push(expression.id);

        const operation = createOperation('create', {
          type: 'create',
          expressionId: expression.id,
          kind: expression.kind,
          position: expression.position,
          size: expression.size,
          data: expression.data,
        });
        pushOperation(state.operationLog, operation);
      });
    },

    updateExpression: (id: string, partial: Partial<VisualExpression>) => {
      set((state) => {
        const existing = state.expressions[id];
        if (!existing) {
          console.warn(
            `[canvasStore] Cannot update non-existent expression: ${id}`,
          );
          return;
        }

        // Strip immutable fields to protect invariants
        const safeUpdates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(partial)) {
          if (!IMMUTABLE_FIELDS.has(key)) {
            safeUpdates[key] = value;
          }
        }

        // Snapshot original values for rollback
        const originals: Record<string, unknown> = {};
        for (const key of Object.keys(safeUpdates)) {
          originals[key] = (existing as Record<string, unknown>)[key];
        }

        // Apply safe updates
        Object.assign(existing, safeUpdates);

        // Post-merge validation — revert if result is invalid
        const merged = visualExpressionSchema.safeParse(existing);
        if (!merged.success) {
          // Rollback draft to original values
          Object.assign(existing, originals);
          console.warn(
            `[canvasStore] Update would produce invalid expression, reverting:`,
            merged.error.issues,
          );
          return;
        }

        // Build changes payload with only the fields that actually changed
        const changes: Record<string, unknown> = {};
        if (safeUpdates.position) changes.position = safeUpdates.position;
        if (safeUpdates.size) changes.size = safeUpdates.size;
        if (safeUpdates.angle !== undefined) changes.angle = safeUpdates.angle;
        if (safeUpdates.style) changes.style = safeUpdates.style;
        if (safeUpdates.data) changes.data = safeUpdates.data;

        const operation = createOperation('update', {
          type: 'update',
          expressionId: id,
          changes,
        });
        pushOperation(state.operationLog, operation);
      });
    },

    deleteExpressions: (ids: string[]) => {
      if (ids.length === 0) {
        return;
      }

      set((state) => {
        // Filter to only IDs that actually exist
        const existingIds = ids.filter((id) => id in state.expressions);
        if (existingIds.length === 0) {
          return;
        }

        const idSet = new Set(existingIds);

        for (const id of existingIds) {
          delete state.expressions[id];
          state.selectedIds.delete(id);
        }

        state.expressionOrder = state.expressionOrder.filter(
          (orderId) => !idSet.has(orderId),
        );

        const operation = createOperation('delete', {
          type: 'delete',
          expressionIds: [...existingIds],
        });
        pushOperation(state.operationLog, operation);
      });
    },

    // ── UI-only state (NO ProtocolOperations) ────────────────

    setSelectedIds: (ids: Set<string>) => {
      set((state) => {
        state.selectedIds = new Set(ids);
      });
    },

    setActiveTool: (tool: ToolType) => {
      set((state) => {
        state.activeTool = tool;
      });
    },

    setCamera: (camera: Camera) => {
      set((state) => {
        state.camera = {
          x: camera.x,
          y: camera.y,
          zoom: Math.max(MIN_ZOOM, Math.min(camera.zoom, MAX_ZOOM)),
        };
      });
    },
  })),
);
