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

// Enable immer support for Set/Map (used by selectedIds: Set<string>)
enableMapSet();
import {
  visualExpressionSchema,
} from '@infinicanvas/protocol';
import type {
  VisualExpression,
  ProtocolOperation,
  AuthorInfo,
} from '@infinicanvas/protocol';
import type { CanvasState, CanvasActions, ToolType, Camera } from '../types/index.js';

/** System author used for store-generated operations. */
const SYSTEM_AUTHOR: AuthorInfo = {
  type: 'agent',
  id: 'canvas-engine',
  name: 'Canvas Engine',
  provider: 'infinicanvas',
};

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
        // Prevent duplicate IDs
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
        state.operationLog.push(operation);
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

        // Shallow merge of partial into existing expression
        Object.assign(existing, partial);

        const operation = createOperation('update', {
          type: 'update',
          expressionId: id,
          data: partial.data ?? existing.data,
        });
        state.operationLog.push(operation);
      });
    },

    deleteExpressions: (ids: string[]) => {
      if (ids.length === 0) {
        return;
      }

      set((state) => {
        const idSet = new Set(ids);

        for (const id of ids) {
          delete state.expressions[id];
          state.selectedIds.delete(id);
        }

        state.expressionOrder = state.expressionOrder.filter(
          (orderId) => !idSet.has(orderId),
        );

        const operation = createOperation('delete', {
          type: 'delete',
          expressionIds: [...ids],
        });
        state.operationLog.push(operation);
      });
    },

    // ── UI-only state (NO ProtocolOperations) ────────────────

    setSelectedIds: (ids: Set<string>) => {
      set((state) => {
        state.selectedIds = ids;
      });
    },

    setActiveTool: (tool: ToolType) => {
      set((state) => {
        state.activeTool = tool;
      });
    },

    setCamera: (camera: Camera) => {
      set((state) => {
        state.camera = camera;
      });
    },
  })),
);
