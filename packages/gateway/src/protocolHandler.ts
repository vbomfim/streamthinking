/**
 * Protocol handler for the gateway.
 *
 * Validates incoming operations against the protocol schema and
 * applies state mutations to the session. Invalid operations are
 * rejected with an error response, NOT broadcast.
 *
 * State mutations follow a last-write-wins strategy (no CRDT/OT).
 *
 * @module
 */

import type { VisualExpression, ProtocolOperation } from '@infinicanvas/protocol';
import { protocolOperationSchema, DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';
import type { Session, ErrorMessage } from './types.js';
import { log, logError } from './logger.js';

/**
 * Validate a protocol operation using the Zod schema.
 * Returns `null` if valid, or an ErrorMessage if invalid.
 */
export function validateOperation(operation: unknown): ErrorMessage | null {
  const result = protocolOperationSchema.safeParse(operation);
  if (!result.success) {
    return {
      type: 'error',
      code: 'INVALID_OPERATION',
      message: result.error.issues.map((i) => i.message).join('; '),
    };
  }
  return null;
}

/**
 * Apply a validated operation to the session state.
 * Mutates the session in place (last-write-wins).
 */
export function applyOperation(session: Session, operation: ProtocolOperation): void {
  session.lastActivity = Date.now();

  const { payload } = operation;

  switch (payload.type) {
    case 'create':
      applyCreate(session, operation);
      break;
    case 'update':
      applyUpdate(session, payload);
      break;
    case 'delete':
      applyDelete(session, payload);
      break;
    case 'move':
      applyMove(session, payload);
      break;
    case 'transform':
      applyTransform(session, payload);
      break;
    case 'style':
      applyStyle(session, payload);
      break;
    default:
      // Other operation types (group, ungroup, annotate, etc.) are
      // broadcast but do not mutate server state in V1.
      log('operation_passthrough', { sessionId: session.id, type: payload.type });
      break;
  }
}

// ── State mutation helpers ─────────────────────────────────

function applyCreate(
  session: Session,
  operation: ProtocolOperation,
): void {
  const payload = operation.payload;
  if (payload.type !== 'create') return;

  const expression: VisualExpression = {
    id: payload.expressionId,
    kind: payload.kind,
    position: payload.position,
    size: payload.size,
    angle: payload.angle ?? 0,
    style: payload.style ?? { ...DEFAULT_EXPRESSION_STYLE },
    meta: {
      author: operation.author,
      createdAt: operation.timestamp,
      updatedAt: operation.timestamp,
      tags: [],
      locked: false,
    },
    data: payload.data,
  };

  session.expressions[payload.expressionId] = expression;
  session.expressionOrder.push(payload.expressionId);
  log('expression_created', { sessionId: session.id, expressionId: payload.expressionId });
}

function applyUpdate(
  session: Session,
  payload: Extract<ProtocolOperation['payload'], { type: 'update' }>,
): void {
  const expr = session.expressions[payload.expressionId];
  if (!expr) {
    logError('update_missing_expression', new Error('Expression not found'), {
      sessionId: session.id,
    });
    return;
  }

  if (expr.meta.locked) return;

  const { changes } = payload;
  if (changes.position) expr.position = changes.position;
  if (changes.size) expr.size = changes.size;
  if (changes.angle !== undefined) expr.angle = changes.angle;
  if (changes.style) expr.style = { ...expr.style, ...changes.style };
  if (changes.data) expr.data = changes.data;
  expr.meta.updatedAt = Date.now();
}

function applyDelete(
  session: Session,
  payload: Extract<ProtocolOperation['payload'], { type: 'delete' }>,
): void {
  const deletableIds = payload.expressionIds.filter((id) => {
    const expr = session.expressions[id];
    return expr && !expr.meta.locked;
  });

  for (const id of deletableIds) {
    delete session.expressions[id];
    const idx = session.expressionOrder.indexOf(id);
    if (idx !== -1) session.expressionOrder.splice(idx, 1);
  }

  if (deletableIds.length > 0) {
    log('expressions_deleted', { sessionId: session.id, count: deletableIds.length });
  }
}

function applyMove(
  session: Session,
  payload: Extract<ProtocolOperation['payload'], { type: 'move' }>,
): void {
  const expr = session.expressions[payload.expressionId];
  if (!expr) return;
  if (expr.meta.locked) return;
  expr.position = payload.to;
  expr.meta.updatedAt = Date.now();
}

function applyTransform(
  session: Session,
  payload: Extract<ProtocolOperation['payload'], { type: 'transform' }>,
): void {
  const expr = session.expressions[payload.expressionId];
  if (!expr) return;
  if (expr.meta.locked) return;
  if (payload.angle !== undefined) expr.angle = payload.angle;
  if (payload.size) expr.size = payload.size;
  expr.meta.updatedAt = Date.now();
}

function applyStyle(
  session: Session,
  payload: Extract<ProtocolOperation['payload'], { type: 'style' }>,
): void {
  for (const id of payload.expressionIds) {
    const expr = session.expressions[id];
    if (!expr) continue;
    if (expr.meta.locked) continue;
    expr.style = { ...expr.style, ...payload.style };
    expr.meta.updatedAt = Date.now();
  }
}
