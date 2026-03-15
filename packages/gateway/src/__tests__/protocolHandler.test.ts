/**
 * Protocol handler unit tests.
 *
 * Tests for operation validation, state mutations, and style/angle
 * handling in CreatePayload (I2-3).
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { validateOperation, applyOperation } from '../protocolHandler.js';
import type { Session } from '../types.js';
import type { ProtocolOperation, ExpressionStyle } from '@infinicanvas/protocol';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';

// ── Helpers ─────────────────────────────────────────────────

function createSession(): Session {
  return {
    id: 'sess-1',
    expressions: {},
    expressionOrder: [],
    clients: new Set(),
    agents: new Map(),
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
}

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Alice' };

function makeCreateOp(overrides: {
  style?: ExpressionStyle;
  angle?: number;
  expressionId?: string;
} = {}): ProtocolOperation {
  return {
    id: 'op-1',
    type: 'create',
    author: testAuthor,
    timestamp: Date.now(),
    payload: {
      type: 'create',
      expressionId: overrides.expressionId ?? 'expr-1',
      kind: 'rectangle',
      position: { x: 10, y: 20 },
      size: { width: 100, height: 50 },
      data: { kind: 'rectangle', label: 'Test' },
      ...(overrides.style !== undefined ? { style: overrides.style } : {}),
      ...(overrides.angle !== undefined ? { angle: overrides.angle } : {}),
    },
  };
}

// ── Tests ───────────────────────────────────────────────────

describe('protocolHandler', () => {
  describe('validateOperation', () => {
    it('accepts a valid operation', () => {
      const error = validateOperation(makeCreateOp());
      expect(error).toBeNull();
    });

    it('rejects an invalid operation', () => {
      const error = validateOperation({ id: '', type: 'create' });
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_OPERATION');
    });
  });

  describe('applyCreate with style/angle from payload (I2-3)', () => {
    it('uses style from payload when present', () => {
      const session = createSession();
      const customStyle: ExpressionStyle = {
        strokeColor: '#ff0000',
        backgroundColor: '#00ff00',
        fillStyle: 'solid',
        strokeWidth: 5,
        roughness: 2,
        opacity: 0.7,
      };

      applyOperation(session, makeCreateOp({ style: customStyle, angle: 45 }));

      const expr = session.expressions['expr-1'];
      expect(expr).toBeDefined();
      expect(expr!.style).toEqual(customStyle);
      expect(expr!.angle).toBe(45);
    });

    it('falls back to DEFAULT_EXPRESSION_STYLE when style absent', () => {
      const session = createSession();

      applyOperation(session, makeCreateOp());

      const expr = session.expressions['expr-1'];
      expect(expr).toBeDefined();
      expect(expr!.style.strokeColor).toBe(DEFAULT_EXPRESSION_STYLE.strokeColor);
      expect(expr!.style.fillStyle).toBe(DEFAULT_EXPRESSION_STYLE.fillStyle);
      expect(expr!.style.roughness).toBe(DEFAULT_EXPRESSION_STYLE.roughness);
      expect(expr!.style.backgroundColor).toBe(DEFAULT_EXPRESSION_STYLE.backgroundColor);
      expect(expr!.style.strokeWidth).toBe(DEFAULT_EXPRESSION_STYLE.strokeWidth);
      expect(expr!.style.opacity).toBe(DEFAULT_EXPRESSION_STYLE.opacity);
    });

    it('falls back to angle=0 when angle absent', () => {
      const session = createSession();

      applyOperation(session, makeCreateOp());

      expect(session.expressions['expr-1']!.angle).toBe(0);
    });

    it('uses angle from payload when present', () => {
      const session = createSession();

      applyOperation(session, makeCreateOp({ angle: 90 }));

      expect(session.expressions['expr-1']!.angle).toBe(90);
    });

    it('late joiner gets correct style via state-sync', () => {
      const session = createSession();
      const customStyle: ExpressionStyle = {
        strokeColor: '#aabbcc',
        backgroundColor: '#ddeeff',
        fillStyle: 'cross-hatch',
        strokeWidth: 3,
        roughness: 0.5,
        opacity: 0.9,
      };

      applyOperation(session, makeCreateOp({ style: customStyle, angle: 30 }));

      // Simulate what state-sync sends: session.expressions values
      const expressions = Object.values(session.expressions);
      expect(expressions).toHaveLength(1);
      expect(expressions[0]!.style).toEqual(customStyle);
      expect(expressions[0]!.angle).toBe(30);
    });
  });

  describe('applyCreate default style consistency (I2-2)', () => {
    it('uses canonical DEFAULT_EXPRESSION_STYLE values', () => {
      const session = createSession();

      applyOperation(session, makeCreateOp());

      const expr = session.expressions['expr-1']!;
      // Verify canonical values from the task spec
      expect(expr.style.strokeColor).toBe('#1e1e1e');
      expect(expr.style.backgroundColor).toBe('transparent');
      expect(expr.style.fillStyle).toBe('hachure');
      expect(expr.style.strokeWidth).toBe(2);
      expect(expr.style.roughness).toBe(1);
      expect(expr.style.opacity).toBe(1);
    });
  });
});
