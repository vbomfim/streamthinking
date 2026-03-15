/**
 * Unit tests for JSON import — load and validate canvas state.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers valid data loading, invalid data rejection, and Zod validation.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression } from '@infinicanvas/protocol';
import { importFromJson } from '../export/fromJson.js';
import { exportToJson } from '../export/toJson.js';

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string): VisualExpression {
  const expr = builder.rectangle(100, 200, 300, 150).label('Test').build();
  return { ...expr, id };
}

describe('importFromJson', () => {
  it('returns success with valid JSON roundtrip data', () => {
    const rect = makeRectangle('rect-1');
    const expressions = { 'rect-1': rect };
    const json = exportToJson(expressions, ['rect-1']);

    const result = importFromJson(json);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expressions).toHaveLength(1);
      expect(result.data.expressions[0]!.id).toBe('rect-1');
      expect(result.data.expressionOrder).toEqual(['rect-1']);
    }
  });

  it('returns error for invalid JSON string', () => {
    const result = importFromJson('{ not valid json ');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid JSON');
    }
  });

  it('returns error when version is missing', () => {
    const json = JSON.stringify({ expressions: {}, expressionOrder: [] });
    const result = importFromJson(json);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it('returns error when expressions is not an object', () => {
    const json = JSON.stringify({
      version: '1.0',
      expressions: 'not-an-object',
      expressionOrder: [],
    });
    const result = importFromJson(json);
    expect(result.success).toBe(false);
  });

  it('returns error when expressionOrder is not an array', () => {
    const json = JSON.stringify({
      version: '1.0',
      expressions: {},
      expressionOrder: 'not-an-array',
    });
    const result = importFromJson(json);
    expect(result.success).toBe(false);
  });

  it('returns error when expression data is invalid (fails Zod validation)', () => {
    const json = JSON.stringify({
      version: '1.0',
      expressions: {
        'bad-1': { id: 'bad-1', kind: 'nonexistent-kind' },
      },
      expressionOrder: ['bad-1'],
    });
    const result = importFromJson(json);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it('returns expressions as array on success', () => {
    const r1 = makeRectangle('rect-1');
    const r2 = makeRectangle('rect-2');
    const expressions = { 'rect-1': r1, 'rect-2': r2 };
    const json = exportToJson(expressions, ['rect-1', 'rect-2']);

    const result = importFromJson(json);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expressions).toHaveLength(2);
      expect(result.data.expressionOrder).toEqual(['rect-1', 'rect-2']);
    }
  });

  it('handles empty canvas export', () => {
    const json = exportToJson({}, []);
    const result = importFromJson(json);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expressions).toHaveLength(0);
      expect(result.data.expressionOrder).toEqual([]);
    }
  });

  it('returns error for empty string input', () => {
    const result = importFromJson('');
    expect(result.success).toBe(false);
  });
});
