/**
 * Unit tests for SVG export — build SVG from expressions.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers SVG element creation, expression mapping, and viewBox.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression } from '@infinicanvas/protocol';
import { buildSvgString } from '../export/toSvg.js';

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangleAt(id: string, x: number, y: number, w: number, h: number): VisualExpression {
  const expr = builder.rectangle(x, y, w, h).label('Test').build();
  return { ...expr, id };
}

function makeEllipseAt(id: string, x: number, y: number, w: number, h: number): VisualExpression {
  const expr = builder.ellipse(x, y, w, h).label('Oval').build();
  return { ...expr, id };
}

describe('buildSvgString', () => {
  it('returns a valid SVG string', () => {
    const rect = makeRectangleAt('r1', 10, 20, 100, 50);
    const result = buildSvgString({ 'r1': rect }, ['r1'], 'light');
    expect(result).toContain('<svg');
    expect(result).toContain('</svg>');
    expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('includes viewBox attribute', () => {
    const rect = makeRectangleAt('r1', 10, 20, 100, 50);
    const result = buildSvgString({ 'r1': rect }, ['r1'], 'light');
    expect(result).toContain('viewBox=');
  });

  it('renders rectangle elements', () => {
    const rect = makeRectangleAt('r1', 10, 20, 100, 50);
    const result = buildSvgString({ 'r1': rect }, ['r1'], 'light');
    expect(result).toContain('<rect');
  });

  it('renders ellipse elements', () => {
    const ellipse = makeEllipseAt('e1', 10, 20, 100, 50);
    const result = buildSvgString({ 'e1': ellipse }, ['e1'], 'light');
    expect(result).toContain('<ellipse');
  });

  it('uses white background for light theme', () => {
    const rect = makeRectangleAt('r1', 10, 20, 100, 50);
    const result = buildSvgString({ 'r1': rect }, ['r1'], 'light');
    expect(result).toContain('#ffffff');
  });

  it('uses dark background for dark theme', () => {
    const rect = makeRectangleAt('r1', 10, 20, 100, 50);
    const result = buildSvgString({ 'r1': rect }, ['r1'], 'dark');
    expect(result).toContain('#1e1e1e');
  });

  it('handles empty canvas', () => {
    const result = buildSvgString({}, [], 'light');
    expect(result).toContain('<svg');
    expect(result).toContain('</svg>');
  });

  it('renders multiple expressions', () => {
    const r1 = makeRectangleAt('r1', 10, 20, 100, 50);
    const r2 = makeRectangleAt('r2', 200, 300, 80, 60);
    const result = buildSvgString({ 'r1': r1, 'r2': r2 }, ['r1', 'r2'], 'light');
    // Should contain at least 2 rect elements (background + shapes)
    const rectMatches = result.match(/<rect[^/]*\/>/g) ?? [];
    expect(rectMatches.length).toBeGreaterThanOrEqual(2);
  });
});
