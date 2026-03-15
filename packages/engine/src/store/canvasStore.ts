/**
 * Canvas state store — Zustand with immer middleware.
 *
 * Manages all canvas state: expressions, selection, tools, camera, and
 * the protocol operation log. Mutation actions that affect canvas content
 * (add, update, delete) emit ProtocolOperations for collaboration tracking
 * and push undo snapshots for history navigation.
 * UI-only actions (selection, tool, camera) do NOT emit operations or snapshots.
 *
 * @module
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { nanoid } from 'nanoid';
import {
  visualExpressionSchema,
  protocolOperationSchema,
  expressionStyleSchema,
  DEFAULT_EXPRESSION_STYLE,
} from '@infinicanvas/protocol';
import type {
  VisualExpression,
  ProtocolOperation,
  AuthorInfo,
  CreatePayload,
  UpdatePayload,
  DeletePayload,
  MovePayload,
  TransformPayload,
  StylePayload,
  ExpressionStyle,
} from '@infinicanvas/protocol';
import type { CanvasState, CanvasActions, ToolType, Camera } from '../types/index.js';
import { HistoryManager } from '../history/historyManager.js';
import type { CanvasSnapshot } from '../history/historyManager.js';
import { invalidateLayoutCache as invalidateFlowchartCache } from '../renderer/composites/flowchartRenderer.js';
import { invalidateLayoutCache as invalidateSequenceCache } from '../renderer/composites/sequenceDiagramRenderer.js';
import { invalidateLayoutCache as invalidateMindMapCache } from '../renderer/composites/mindMapRenderer.js';
import { invalidateLayoutCache as invalidateReasoningCache } from '../renderer/composites/reasoningChainRenderer.js';

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

/** Shared history manager instance (lives outside Zustand to avoid serialization). */
const historyManager = new HistoryManager();

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

/** Extract a snapshot from the current canvas state (expressions + z-order). */
function captureSnapshot(state: CanvasState): CanvasSnapshot {
  // Build a plain-object clone of expressions (immer draft → plain)
  const expressions: Record<string, VisualExpression> = {};
  for (const [id, expr] of Object.entries(state.expressions)) {
    expressions[id] = structuredClone(expr as VisualExpression);
  }
  return {
    expressions,
    expressionOrder: [...state.expressionOrder],
  };
}

export const useCanvasStore = create<CanvasState & CanvasActions>()(
  immer((set, get) => ({
    // ── Initial state ────────────────────────────────────────
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select' as ToolType,
    camera: { x: 0, y: 0, zoom: 1 },
    operationLog: [],
    canUndo: false,
    canRedo: false,

    // ── Content mutations (emit ProtocolOperations + push snapshots) ──

    addExpression: (expression: VisualExpression) => {
      const result = visualExpressionSchema.safeParse(expression);
      if (!result.success) {
        console.warn(
          `[canvasStore] Invalid expression rejected:`,
          result.error.issues,
        );
        return;
      }

      // Check for duplicate before snapshotting [AC8]
      const currentState = get();
      if (currentState.expressions[expression.id]) {
        return;
      }

      // Push snapshot BEFORE mutation [AC8]
      historyManager.pushSnapshot(captureSnapshot(currentState));

      set((state) => {
        state.expressions[expression.id] = expression;
        state.expressionOrder.push(expression.id);

        const operation = createOperation('create', {
          type: 'create',
          expressionId: expression.id,
          kind: expression.kind,
          position: expression.position,
          size: expression.size,
          data: expression.data,
          style: expression.style,
          angle: expression.angle,
        });
        pushOperation(state.operationLog, operation);

        state.canUndo = historyManager.canUndo();
        state.canRedo = historyManager.canRedo();
      });
    },

    updateExpression: (id: string, partial: Partial<VisualExpression>) => {
      const currentState = get();
      const existing = currentState.expressions[id];
      if (!existing) {
        console.warn(
          `[canvasStore] Cannot update non-existent expression: ${id}`,
        );
        return;
      }

      // S5-3: Skip locked expressions
      if (existing.meta.locked) return;

      // Push snapshot BEFORE mutation [AC8]
      historyManager.pushSnapshot(captureSnapshot(currentState));

      let reverted = false;

      set((state) => {
        const expr = state.expressions[id];
        if (!expr) return;

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
          originals[key] = (expr as Record<string, unknown>)[key];
        }

        // Apply safe updates
        Object.assign(expr, safeUpdates);

        // Post-merge validation — revert if result is invalid
        const merged = visualExpressionSchema.safeParse(expr);
        if (!merged.success) {
          // Rollback draft to original values
          Object.assign(expr, originals);
          console.warn(
            `[canvasStore] Update would produce invalid expression, reverting:`,
            merged.error.issues,
          );
          reverted = true;
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

        state.canUndo = historyManager.canUndo();
        state.canRedo = historyManager.canRedo();
      });

      // If the update was reverted (validation failed), undo the snapshot push
      if (reverted) {
        historyManager.undo(captureSnapshot(get()));
        set((state) => {
          state.canUndo = historyManager.canUndo();
          state.canRedo = historyManager.canRedo();
        });
      }
    },

    deleteExpressions: (ids: string[]) => {
      if (ids.length === 0) {
        return;
      }

      const currentState = get();

      // Filter to only IDs that actually exist and are not locked [S5-3]
      const existingIds = ids.filter((id) => {
        const expr = currentState.expressions[id];
        return expr && !expr.meta.locked;
      });
      if (existingIds.length === 0) {
        return;
      }

      // Push snapshot BEFORE mutation [AC8]
      historyManager.pushSnapshot(captureSnapshot(currentState));

      set((state) => {
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

        state.canUndo = historyManager.canUndo();
        state.canRedo = historyManager.canRedo();
      });

      // Evict deleted expressions from composite renderer layout caches [S6-4]
      for (const id of existingIds) {
        invalidateFlowchartCache(id);
        invalidateSequenceCache(id);
        invalidateMindMapCache(id);
        invalidateReasoningCache(id);
      }
    },

    // ── Undo/Redo actions ────────────────────────────────────

    undo: () => {
      const currentState = get();
      const snapshot = historyManager.undo(captureSnapshot(currentState));
      if (!snapshot) return;

      set((state) => {
        // Restore expressions and z-order from snapshot
        state.expressions = snapshot.expressions;
        state.expressionOrder = snapshot.expressionOrder;
        state.canUndo = historyManager.canUndo();
        state.canRedo = historyManager.canRedo();
      });
    },

    redo: () => {
      const currentState = get();
      const snapshot = historyManager.redo(captureSnapshot(currentState));
      if (!snapshot) return;

      set((state) => {
        // Restore expressions and z-order from snapshot
        state.expressions = snapshot.expressions;
        state.expressionOrder = snapshot.expressionOrder;
        state.canUndo = historyManager.canUndo();
        state.canRedo = historyManager.canRedo();
      });
    },

    clearHistory: () => {
      historyManager.clear();
      set((state) => {
        state.canUndo = false;
        state.canRedo = false;
      });
    },

    // ── UI-only state (NO ProtocolOperations, NO snapshots) ──

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
      if (!Number.isFinite(camera.x) || !Number.isFinite(camera.y) || !Number.isFinite(camera.zoom)) {
        console.warn('[canvasStore] Invalid camera values (NaN/Infinity) rejected');
        return;
      }
      set((state) => {
        state.camera = {
          x: camera.x,
          y: camera.y,
          zoom: Math.max(MIN_ZOOM, Math.min(camera.zoom, MAX_ZOOM)),
        };
      });
    },

    // ── Remote operations (NO operationLog append) ────────────

    applyRemoteOperation: (op: ProtocolOperation) => {
      // Validate incoming remote operation against schema [R5]
      const opResult = protocolOperationSchema.safeParse(op);
      if (!opResult.success) {
        console.warn(
          '[canvasStore] Invalid remote operation rejected:',
          opResult.error.issues,
        );
        return;
      }

      set((state) => {
        switch (op.payload.type) {
          case 'create': {
            const p = op.payload as CreatePayload;
            const expr: VisualExpression = {
              id: p.expressionId,
              kind: p.kind,
              position: p.position,
              size: p.size,
              angle: p.angle ?? 0,
              style: p.style ?? { ...DEFAULT_EXPRESSION_STYLE },
              meta: {
                author: op.author,
                createdAt: op.timestamp,
                updatedAt: op.timestamp,
                tags: [],
                locked: false,
              },
              data: p.data,
            };
            // Validate reconstructed expression [R5]
            const exprResult = visualExpressionSchema.safeParse(expr);
            if (!exprResult.success) {
              console.warn(
                '[canvasStore] Invalid expression from remote create rejected:',
                exprResult.error.issues,
              );
              break;
            }
            state.expressions[p.expressionId] = expr;
            state.expressionOrder.push(p.expressionId);
            break;
          }

          case 'update': {
            const p = op.payload as UpdatePayload;
            const existing = state.expressions[p.expressionId];
            if (!existing) break;
            if (p.changes.position) existing.position = p.changes.position;
            if (p.changes.size) existing.size = p.changes.size;
            if (p.changes.angle !== undefined) existing.angle = p.changes.angle;
            if (p.changes.style) {
              Object.assign(existing.style, p.changes.style);
            }
            if (p.changes.data) existing.data = p.changes.data;
            break;
          }

          case 'delete': {
            const p = op.payload as DeletePayload;
            const idSet = new Set(p.expressionIds);
            for (const id of p.expressionIds) {
              delete state.expressions[id];
              state.selectedIds.delete(id);
            }
            state.expressionOrder = state.expressionOrder.filter(
              (id) => !idSet.has(id),
            );
            break;
          }

          case 'move': {
            const p = op.payload as MovePayload;
            const existing = state.expressions[p.expressionId];
            if (existing) {
              existing.position = p.to;
            }
            break;
          }

          case 'transform': {
            const p = op.payload as TransformPayload;
            const existing = state.expressions[p.expressionId];
            if (existing) {
              if (p.angle !== undefined) existing.angle = p.angle;
              if (p.size) existing.size = p.size;
            }
            break;
          }

          case 'style': {
            const p = op.payload as StylePayload;
            for (const id of p.expressionIds) {
              const existing = state.expressions[id];
              if (existing) {
                existing.style = {
                  ...existing.style,
                  ...p.style,
                } as ExpressionStyle;
              }
            }
            break;
          }

          default:
            // Unsupported operation types are silently ignored
            break;
        }
      });
    },

    replaceState: (expressions: VisualExpression[], expressionOrder: string[]) => {
      set((state) => {
        const exprMap: Record<string, VisualExpression> = {};
        const validIds = new Set<string>();

        for (const expr of expressions) {
          const result = visualExpressionSchema.safeParse(expr);
          if (!result.success) {
            console.warn(
              `[canvasStore] replaceState: invalid expression rejected (id=${expr?.id}):`,
              result.error.issues,
            );
            continue;
          }
          // Use Zod-stripped output to prevent prototype pollution [S7-1]
          const validated = result.data as VisualExpression;
          exprMap[validated.id] = validated;
          validIds.add(validated.id);
        }

        state.expressions = exprMap;
        // Filter expressionOrder to only include validated IDs
        state.expressionOrder = expressionOrder.filter((id) => validIds.has(id));
        state.operationLog = [];
        state.selectedIds = new Set<string>();

        // Clear undo/redo history on full state replacement
        historyManager.clear();
        state.canUndo = false;
        state.canRedo = false;
      });
    },

    // ── Shape manipulation mutations ─────────────────────────

    /**
     * Apply a validated style partial to multiple expressions. [S7-5]
     *
     * Validates the incoming style with `expressionStyleSchema.partial()`.
     * Rejects invalid styles with a console.warn and returns without mutating.
     * Emits a `style` ProtocolOperation and pushes an undo snapshot.
     */
    styleExpressions: (ids: string[], style: Partial<ExpressionStyle>) => {
      if (ids.length === 0) return;

      // Validate style partial before applying [S7-5]
      const styleResult = expressionStyleSchema.partial().safeParse(style);
      if (!styleResult.success) {
        console.warn(
          '[canvasStore] styleExpressions: invalid style rejected:',
          styleResult.error.issues,
        );
        return;
      }
      const validatedStyle = styleResult.data as Partial<ExpressionStyle>;

      const currentState = get();

      // Filter to only IDs that exist and are not locked
      const validIds = ids.filter((id) => {
        const expr = currentState.expressions[id];
        return expr && !expr.meta.locked;
      });
      if (validIds.length === 0) return;

      // Push snapshot BEFORE mutation
      historyManager.pushSnapshot(captureSnapshot(currentState));

      set((state) => {
        for (const id of validIds) {
          const expr = state.expressions[id];
          if (expr) {
            expr.style = { ...expr.style, ...validatedStyle } as ExpressionStyle;
          }
        }

        const operation = createOperation('style', {
          type: 'style',
          expressionIds: [...validIds],
          style: validatedStyle,
        });
        pushOperation(state.operationLog, operation);

        state.canUndo = historyManager.canUndo();
        state.canRedo = historyManager.canRedo();
      });
    },

    moveExpressions: (
      moves: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } }>,
    ) => {
      if (moves.length === 0) return;

      // Build a snapshot reflecting pre-drag positions (expressions may
      // already be at 'to' positions from transient drag updates).
      const currentState = get();
      const snapshot = captureSnapshot(currentState);
      for (const move of moves) {
        const expr = snapshot.expressions[move.id];
        if (expr) {
          expr.position = { ...move.from };
        }
      }
      historyManager.pushSnapshot(snapshot);

      set((state) => {
        for (const move of moves) {
          const expr = state.expressions[move.id];
          if (expr) {
            expr.position = { ...move.to };
          }
        }

        for (const move of moves) {
          const operation = createOperation('move', {
            type: 'move',
            expressionId: move.id,
            from: move.from,
            to: move.to,
          });
          pushOperation(state.operationLog, operation);
        }

        state.canUndo = historyManager.canUndo();
        state.canRedo = historyManager.canRedo();
      });
    },

    transformExpression: (
      id: string,
      original: { position: { x: number; y: number }; size: { width: number; height: number } },
      final: { position: { x: number; y: number }; size: { width: number; height: number } },
    ) => {
      const currentState = get();
      if (!currentState.expressions[id]) return;

      // Build a snapshot reflecting pre-resize state.
      const snapshot = captureSnapshot(currentState);
      const expr = snapshot.expressions[id];
      if (expr) {
        expr.position = { ...original.position };
        expr.size = { ...original.size };
      }
      historyManager.pushSnapshot(snapshot);

      set((state) => {
        const expr = state.expressions[id];
        if (!expr) return;

        expr.position = { ...final.position };
        expr.size = { ...final.size };

        const operation = createOperation('transform', {
          type: 'transform',
          expressionId: id,
          size: final.size,
        });
        pushOperation(state.operationLog, operation);

        state.canUndo = historyManager.canUndo();
        state.canRedo = historyManager.canRedo();
      });
    },
  })),
);
