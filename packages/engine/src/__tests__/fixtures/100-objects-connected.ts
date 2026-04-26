/**
 * 100-object connected canvas fixture for URL codec testing.
 *
 * Generates an ExportedCanvasState with:
 * - 40 rectangles in a grid (8 columns × 5 rows)
 * - 20 ellipses scattered
 * - 10 diamonds (decision nodes)
 * - 20 arrows connecting shapes
 * - 10 text annotations
 *
 * Total: 100 expressions with varied styles. [TDD]
 *
 * @module
 */

import type { VisualExpression } from '@infinicanvas/protocol';
import type { ExportedCanvasState } from '../../export/toJson.js';
import type { ExpressionStyle } from '@infinicanvas/protocol';

const AUTHOR = { type: 'human' as const, id: 'fixture-user', name: 'Fixture' };

const STROKE_COLORS = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#7048e8'];
const FILL_COLORS = ['transparent', '#ffe8cc', '#d3f9d8', '#d0ebff', '#fff3bf', '#e5dbff'];
const FILL_STYLES: ExpressionStyle['fillStyle'][] = ['solid', 'hachure', 'cross-hatch', 'none'];

function makeStyle(index: number): ExpressionStyle {
  return {
    strokeColor: STROKE_COLORS[index % STROKE_COLORS.length]!,
    backgroundColor: FILL_COLORS[index % FILL_COLORS.length]!,
    fillStyle: FILL_STYLES[index % FILL_STYLES.length]!,
    strokeStyle: index % 3 === 0 ? 'dashed' : 'solid',
    strokeWidth: (index % 3) + 1,
    roughness: index % 4 === 0 ? 1 : 0,
    opacity: 1,
  };
}

function makeMeta(index: number) {
  const ts = 1700000000000 + index * 1000;
  return {
    author: AUTHOR,
    createdAt: ts,
    updatedAt: ts,
    tags: [`batch-${Math.floor(index / 10)}`],
    locked: false,
  };
}

/** Generate a 100-object canvas fixture. */
export function generate100ObjectFixture(): ExportedCanvasState {
  const expressions: Record<string, VisualExpression> = {};
  const expressionOrder: string[] = [];
  let idx = 0;

  // ── 40 Rectangles (8 columns × 5 rows) ────────────────────
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 8; col++) {
      const id = `rect-${idx + 1}`;
      expressions[id] = {
        id,
        kind: 'rectangle',
        position: { x: col * 200, y: row * 160 },
        size: { width: 150, height: 80 },
        angle: 0,
        style: makeStyle(idx),
        meta: makeMeta(idx),
        data: { kind: 'rectangle', label: `Rect ${idx + 1}` },
      };
      expressionOrder.push(id);
      idx++;
    }
  }

  // ── 20 Ellipses ────────────────────────────────────────────
  for (let i = 0; i < 20; i++) {
    const id = `ellipse-${i + 1}`;
    expressions[id] = {
      id,
      kind: 'ellipse',
      position: { x: 1700 + (i % 5) * 180, y: (Math.floor(i / 5)) * 160 },
      size: { width: 120, height: 80 },
      angle: 0,
      style: makeStyle(idx),
      meta: makeMeta(idx),
      data: { kind: 'ellipse', label: `Ellipse ${i + 1}` },
    };
    expressionOrder.push(id);
    idx++;
  }

  // ── 10 Diamonds ────────────────────────────────────────────
  for (let i = 0; i < 10; i++) {
    const id = `diamond-${i + 1}`;
    expressions[id] = {
      id,
      kind: 'diamond',
      position: { x: 2700 + (i % 5) * 180, y: (Math.floor(i / 5)) * 200 },
      size: { width: 100, height: 100 },
      angle: 0,
      style: makeStyle(idx),
      meta: makeMeta(idx),
      data: { kind: 'diamond', label: `Decision ${i + 1}` },
    };
    expressionOrder.push(id);
    idx++;
  }

  // ── 20 Arrows connecting shapes ────────────────────────────
  for (let i = 0; i < 20; i++) {
    const id = `arrow-${i + 1}`;
    // Connect sequential rectangles or shapes
    const srcIdx = i;
    const tgtIdx = i + 1;
    const srcExpr = expressionOrder[srcIdx]!;
    const tgtExpr = expressionOrder[tgtIdx]!;
    const src = expressions[srcExpr]!;
    const tgt = expressions[tgtExpr]!;

    const srcCx = src.position.x + src.size.width;
    const srcCy = src.position.y + src.size.height / 2;
    const tgtCx = tgt.position.x;
    const tgtCy = tgt.position.y + tgt.size.height / 2;

    const routing = i % 2 === 0 ? 'straight' as const : 'orthogonal' as const;

    expressions[id] = {
      id,
      kind: 'arrow',
      position: { x: Math.min(srcCx, tgtCx), y: Math.min(srcCy, tgtCy) },
      size: { width: Math.abs(tgtCx - srcCx) || 1, height: Math.abs(tgtCy - srcCy) || 1 },
      angle: 0,
      style: makeStyle(idx),
      meta: makeMeta(idx),
      data: {
        kind: 'arrow',
        points: [[srcCx, srcCy], [tgtCx, tgtCy]],
        startArrowhead: 'none',
        endArrowhead: 'triangle',
        routing,
        label: i % 3 === 0 ? `Flow ${i + 1}` : undefined,
      },
    };
    expressionOrder.push(id);
    idx++;
  }

  // ── 10 Text annotations ────────────────────────────────────
  for (let i = 0; i < 10; i++) {
    const id = `text-${i + 1}`;
    expressions[id] = {
      id,
      kind: 'text',
      position: { x: i * 200, y: 900 },
      size: { width: 160, height: 30 },
      angle: 0,
      style: makeStyle(idx),
      meta: makeMeta(idx),
      data: {
        kind: 'text',
        text: `Annotation ${i + 1}`,
        fontSize: 14,
        fontFamily: 'sans-serif',
        textAlign: 'left',
      },
    };
    expressionOrder.push(id);
    idx++;
  }

  return {
    version: '1.0',
    expressions,
    expressionOrder,
  };
}
