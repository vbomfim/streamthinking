/**
 * ContainerData schema validation tests.
 *
 * TDD tests for the container expression kind (#112):
 * - Valid container data passes validation
 * - Invalid/missing fields are rejected
 * - Integration with visualExpressionSchema
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import {
  containerDataSchema,
  expressionDataSchema,
  visualExpressionSchema,
  DEFAULT_EXPRESSION_STYLE,
} from '../index.js';

// ── Fixtures ─────────────────────────────────────────────────

function makeContainerData() {
  return {
    kind: 'container' as const,
    title: 'Development',
    headerHeight: 40,
    padding: 20,
    collapsed: false,
  };
}

function makeContainerExpression() {
  return {
    id: 'container-1',
    kind: 'container',
    position: { x: 100, y: 200 },
    size: { width: 400, height: 300 },
    angle: 0,
    style: { ...DEFAULT_EXPRESSION_STYLE },
    meta: {
      author: { type: 'human' as const, id: 'user-1', name: 'Tester' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data: makeContainerData(),
  };
}

// ── containerDataSchema ──────────────────────────────────────

describe('containerDataSchema', () => {
  it('validates a well-formed container data object', () => {
    const result = containerDataSchema.safeParse(makeContainerData());
    expect(result.success).toBe(true);
  });

  it('rejects container data without title', () => {
    const data = { ...makeContainerData(), title: undefined };
    const result = containerDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects container data with non-positive headerHeight', () => {
    const data = { ...makeContainerData(), headerHeight: 0 };
    const result = containerDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects container data with negative padding', () => {
    const data = { ...makeContainerData(), padding: -5 };
    const result = containerDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('accepts container data with zero padding', () => {
    const data = { ...makeContainerData(), padding: 0 };
    const result = containerDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects container data with missing collapsed', () => {
    const data = { ...makeContainerData(), collapsed: undefined };
    const result = containerDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects container data with wrong kind', () => {
    const data = { ...makeContainerData(), kind: 'rectangle' };
    const result = containerDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects title exceeding max length', () => {
    const data = { ...makeContainerData(), title: 'x'.repeat(501) };
    const result = containerDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('accepts empty title', () => {
    const data = { ...makeContainerData(), title: '' };
    const result = containerDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

// ── expressionDataSchema (discriminated union) ───────────────

describe('expressionDataSchema with container', () => {
  it('validates container data as part of the expression data union', () => {
    const result = expressionDataSchema.safeParse(makeContainerData());
    expect(result.success).toBe(true);
  });

  it('discriminates container from other kinds', () => {
    const result = expressionDataSchema.safeParse(makeContainerData());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe('container');
    }
  });
});

// ── visualExpressionSchema ───────────────────────────────────

describe('visualExpressionSchema with container', () => {
  it('validates a full container VisualExpression', () => {
    const result = visualExpressionSchema.safeParse(makeContainerExpression());
    expect(result.success).toBe(true);
  });

  it('validates container expression with parentId and children', () => {
    const expr = {
      ...makeContainerExpression(),
      parentId: 'parent-container',
      children: ['child-1', 'child-2'],
    };
    const result = visualExpressionSchema.safeParse(expr);
    expect(result.success).toBe(true);
  });

  it('validates container expression with layerId', () => {
    const expr = {
      ...makeContainerExpression(),
      layerId: 'layer-1',
    };
    const result = visualExpressionSchema.safeParse(expr);
    expect(result.success).toBe(true);
  });

  it('rejects container expression with mismatched kind and data.kind', () => {
    const expr = {
      ...makeContainerExpression(),
      kind: 'rectangle',  // mismatch
    };
    const result = visualExpressionSchema.safeParse(expr);
    expect(result.success).toBe(false);
  });
});
