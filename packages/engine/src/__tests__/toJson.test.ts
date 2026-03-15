/**
 * Unit tests for JSON export — serialize canvas state to JSON.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers serialization format, version stamp, and data integrity.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression } from '@infinicanvas/protocol';
import { exportToJson } from '../export/toJson.js';
import type { ExportedCanvasState } from '../export/toJson.js';

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string): VisualExpression {
  const expr = builder.rectangle(100, 200, 300, 150).label('Test').build();
  return { ...expr, id };
}

describe('exportToJson', () => {
  it('returns a valid JSON string', () => {
    const expressions: Record<string, VisualExpression> = {};
    const json = exportToJson(expressions, []);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('includes version "1.0" in output', () => {
    const json = exportToJson({}, []);
    const parsed = JSON.parse(json) as ExportedCanvasState;
    expect(parsed.version).toBe('1.0');
  });

  it('includes expressions in output', () => {
    const rect = makeRectangle('rect-1');
    const expressions = { 'rect-1': rect };
    const json = exportToJson(expressions, ['rect-1']);
    const parsed = JSON.parse(json) as ExportedCanvasState;
    expect(parsed.expressions['rect-1']).toBeDefined();
    expect(parsed.expressions['rect-1']!.id).toBe('rect-1');
  });

  it('includes expressionOrder in output', () => {
    const rect = makeRectangle('rect-1');
    const expressions = { 'rect-1': rect };
    const json = exportToJson(expressions, ['rect-1']);
    const parsed = JSON.parse(json) as ExportedCanvasState;
    expect(parsed.expressionOrder).toEqual(['rect-1']);
  });

  it('preserves expression data in roundtrip', () => {
    const rect = makeRectangle('rect-1');
    const expressions = { 'rect-1': rect };
    const json = exportToJson(expressions, ['rect-1']);
    const parsed = JSON.parse(json) as ExportedCanvasState;
    expect(parsed.expressions['rect-1']!.kind).toBe('rectangle');
    expect(parsed.expressions['rect-1']!.position).toEqual(rect.position);
    expect(parsed.expressions['rect-1']!.size).toEqual(rect.size);
  });

  it('handles empty canvas', () => {
    const json = exportToJson({}, []);
    const parsed = JSON.parse(json) as ExportedCanvasState;
    expect(parsed.expressions).toEqual({});
    expect(parsed.expressionOrder).toEqual([]);
    expect(parsed.version).toBe('1.0');
  });

  it('handles multiple expressions', () => {
    const r1 = makeRectangle('rect-1');
    const r2 = makeRectangle('rect-2');
    const expressions = { 'rect-1': r1, 'rect-2': r2 };
    const json = exportToJson(expressions, ['rect-1', 'rect-2']);
    const parsed = JSON.parse(json) as ExportedCanvasState;
    expect(Object.keys(parsed.expressions)).toHaveLength(2);
    expect(parsed.expressionOrder).toEqual(['rect-1', 'rect-2']);
  });
});
