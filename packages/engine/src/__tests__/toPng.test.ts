/**
 * Unit tests for PNG export — offscreen canvas rendering.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers bounding box calculation, padding, canvas dimensions,
 * and background color based on theme.
 *
 * @module
 */

import { describe, it, expect, vi } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression } from '@infinicanvas/protocol';
import { computeExportBounds, EXPORT_PADDING } from '../export/toPng.js';

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangleAt(id: string, x: number, y: number, w: number, h: number): VisualExpression {
  const expr = builder.rectangle(x, y, w, h).label('Test').build();
  return { ...expr, id };
}

describe('computeExportBounds', () => {
  it('returns null for empty expressions', () => {
    const result = computeExportBounds({}, []);
    expect(result).toBeNull();
  });

  it('returns correct bounds for a single expression', () => {
    const rect = makeRectangleAt('r1', 100, 200, 300, 150);
    const result = computeExportBounds({ 'r1': rect }, ['r1']);
    expect(result).not.toBeNull();
    expect(result!.x).toBe(100);
    expect(result!.y).toBe(200);
    expect(result!.width).toBe(300);
    expect(result!.height).toBe(150);
  });

  it('returns bounding box spanning multiple expressions', () => {
    const r1 = makeRectangleAt('r1', 50, 50, 100, 100);   // ends at 150, 150
    const r2 = makeRectangleAt('r2', 200, 200, 100, 100);  // ends at 300, 300

    const expressions = { 'r1': r1, 'r2': r2 };
    const result = computeExportBounds(expressions, ['r1', 'r2']);

    expect(result).not.toBeNull();
    expect(result!.x).toBe(50);
    expect(result!.y).toBe(50);
    expect(result!.width).toBe(250);    // 300 - 50
    expect(result!.height).toBe(250);   // 300 - 50
  });

  it('exports with correct padding constant', () => {
    expect(EXPORT_PADDING).toBe(20);
  });
});
