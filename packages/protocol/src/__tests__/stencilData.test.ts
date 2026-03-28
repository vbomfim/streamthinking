/**
 * Unit tests for StencilData protocol validation.
 *
 * Covers: StencilData schema validation, rejection of invalid data,
 * integration with the expressionDataSchema discriminated union,
 * and full VisualExpression validation with stencil data.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import {
  stencilDataSchema,
  expressionDataSchema,
  visualExpressionSchema,
} from '../index.js';

// ── Test helpers ───────────────────────────────────────────

const humanAuthor = { type: 'human' as const, id: 'user-1', name: 'Alice' };

const defaultStyle = {
  strokeColor: '#000000',
  backgroundColor: 'transparent',
  fillStyle: 'none' as const,
  strokeWidth: 2,
  roughness: 0,
  opacity: 1,
};

function makeExpression(data: Record<string, unknown>) {
  return {
    id: 'expr-1',
    kind: (data as { kind: string }).kind,
    position: { x: 0, y: 0 },
    size: { width: 64, height: 64 },
    angle: 0,
    style: defaultStyle,
    meta: {
      author: humanAuthor,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data,
  };
}

// ── StencilData schema ────────────────────────────────────

describe('StencilData schema', () => {
  it('accepts valid stencil data with all fields', () => {
    const result = stencilDataSchema.safeParse({
      kind: 'stencil',
      stencilId: 'server',
      category: 'network',
      label: 'My Server',
    });
    expect(result.success).toBe(true);
  });

  it('accepts stencil data without optional label', () => {
    const result = stencilDataSchema.safeParse({
      kind: 'stencil',
      stencilId: 'database',
      category: 'generic-it',
    });
    expect(result.success).toBe(true);
  });

  it('rejects stencil data with missing stencilId', () => {
    const result = stencilDataSchema.safeParse({
      kind: 'stencil',
      category: 'network',
    });
    expect(result.success).toBe(false);
  });

  it('rejects stencil data with missing category', () => {
    const result = stencilDataSchema.safeParse({
      kind: 'stencil',
      stencilId: 'server',
    });
    expect(result.success).toBe(false);
  });

  it('rejects stencil data with empty stencilId', () => {
    const result = stencilDataSchema.safeParse({
      kind: 'stencil',
      stencilId: '',
      category: 'network',
    });
    expect(result.success).toBe(false);
  });

  it('rejects stencil data with empty category', () => {
    const result = stencilDataSchema.safeParse({
      kind: 'stencil',
      stencilId: 'server',
      category: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects stencilId exceeding max length', () => {
    const result = stencilDataSchema.safeParse({
      kind: 'stencil',
      stencilId: 'x'.repeat(101),
      category: 'network',
    });
    expect(result.success).toBe(false);
  });

  it('rejects category exceeding max length', () => {
    const result = stencilDataSchema.safeParse({
      kind: 'stencil',
      stencilId: 'server',
      category: 'x'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('rejects label exceeding max length', () => {
    const result = stencilDataSchema.safeParse({
      kind: 'stencil',
      stencilId: 'server',
      category: 'network',
      label: 'x'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('accepts label at max length boundary', () => {
    const result = stencilDataSchema.safeParse({
      kind: 'stencil',
      stencilId: 'server',
      category: 'network',
      label: 'x'.repeat(200),
    });
    expect(result.success).toBe(true);
  });
});

// ── Discriminated union integration ───────────────────────

describe('StencilData in expressionDataSchema', () => {
  it('correctly discriminates stencil kind in the union', () => {
    const result = expressionDataSchema.safeParse({
      kind: 'stencil',
      stencilId: 'k8s-pod',
      category: 'kubernetes',
    });
    expect(result.success).toBe(true);
  });

  it('rejects stencil with wrong kind value', () => {
    const result = expressionDataSchema.safeParse({
      kind: 'stencil-invalid',
      stencilId: 'server',
      category: 'network',
    });
    expect(result.success).toBe(false);
  });
});

// ── Full VisualExpression validation ──────────────────────

describe('VisualExpression with StencilData', () => {
  it('validates a complete stencil expression', () => {
    const expr = makeExpression({
      kind: 'stencil',
      stencilId: 'server',
      category: 'network',
      label: 'Web Server',
    });
    const result = visualExpressionSchema.safeParse(expr);
    expect(result.success).toBe(true);
  });

  it('rejects expression where kind does not match data.kind', () => {
    const expr = makeExpression({
      kind: 'stencil',
      stencilId: 'server',
      category: 'network',
    });
    // Overwrite kind to mismatch
    expr.kind = 'rectangle';
    const result = visualExpressionSchema.safeParse(expr);
    expect(result.success).toBe(false);
  });
});
