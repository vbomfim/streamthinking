/**
 * Integration tests: selection manager × layer state.
 *
 * Verifies that `findExpressionAtPoint` and `findExpressionsInMarquee`
 * correctly respect layer visibility and lock state.
 *
 * [INTEGRATION] — tests the selection module's behaviour when given
 * layer arrays produced by the canvas store.  Tests survive any
 * refactor that preserves the public selection API.
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression, Layer } from '@infinicanvas/protocol';
import {
  findExpressionAtPoint,
  findExpressionsInMarquee,
} from '../interaction/selectionManager.js';

// ── Test fixtures ──────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'QA Tester' };
const builder = new ExpressionBuilder(testAuthor);

/** Rectangle at (100, 100), size 200×100 — sits inside a (0,0)→(500,500) marquee. */
function makeRect(id: string, layerId?: string): VisualExpression {
  const expr = builder
    .rectangle(100, 100, 200, 100)
    .label('Rect')
    .build();
  return { ...expr, id, layerId: layerId ?? 'default' };
}

/** Ellipse at (150, 130), size 80×40 — centre ≈ (190, 150), inside the rect's bounds. */
function makeEllipseOnTop(id: string, layerId?: string): VisualExpression {
  const expr = builder
    .ellipse(150, 130, 80, 40)
    .label('Ellipse')
    .build();
  return { ...expr, id, layerId: layerId ?? 'default' };
}

// ── Helpers ────────────────────────────────────────────────

/** Build an expressions map from an array. */
function expMap(...exprs: VisualExpression[]): Record<string, VisualExpression> {
  const map: Record<string, VisualExpression> = {};
  for (const e of exprs) map[e.id] = e;
  return map;
}

// ── findExpressionAtPoint × layers ─────────────────────────

describe('[INTEGRATION] findExpressionAtPoint with layers', () => {
  const defaultLayer: Layer = { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 };
  const bgLayer: Layer = { id: 'bg', name: 'Background', visible: true, locked: false, order: 1 };

  it('skips expressions on a hidden layer', () => {
    const rect = makeRect('rect-1', 'bg');
    const expressions = expMap(rect);
    const order = ['rect-1'];
    const hiddenBg: Layer = { ...bgLayer, visible: false };

    // Point at centre of rect (200, 150)
    const hit = findExpressionAtPoint(
      { x: 200, y: 150 },
      expressions,
      order,
      5,
      [defaultLayer, hiddenBg],
    );

    expect(hit).toBeNull();
  });

  it('skips expressions on a locked layer', () => {
    const rect = makeRect('rect-1', 'bg');
    const expressions = expMap(rect);
    const order = ['rect-1'];
    const lockedBg: Layer = { ...bgLayer, locked: true };

    const hit = findExpressionAtPoint(
      { x: 200, y: 150 },
      expressions,
      order,
      5,
      [defaultLayer, lockedBg],
    );

    expect(hit).toBeNull();
  });

  it('returns expression on visible unlocked layer', () => {
    const rect = makeRect('rect-1', 'bg');
    const expressions = expMap(rect);
    const order = ['rect-1'];

    const hit = findExpressionAtPoint(
      { x: 200, y: 150 },
      expressions,
      order,
      5,
      [defaultLayer, bgLayer],
    );

    expect(hit).toBe('rect-1');
  });

  it('falls through to lower z-order when top is on hidden layer', () => {
    const rect = makeRect('rect-bottom', 'default');
    const ellipse = makeEllipseOnTop('ellipse-top', 'bg');
    const expressions = expMap(rect, ellipse);
    const order = ['rect-bottom', 'ellipse-top']; // ellipse on top in z-order
    const hiddenBg: Layer = { ...bgLayer, visible: false };

    // Point at (190, 150) — hits both ellipse and rect, but ellipse is hidden
    const hit = findExpressionAtPoint(
      { x: 190, y: 150 },
      expressions,
      order,
      5,
      [defaultLayer, hiddenBg],
    );

    expect(hit).toBe('rect-bottom');
  });

  it('falls through to lower z-order when top is on locked layer', () => {
    const rect = makeRect('rect-bottom', 'default');
    const ellipse = makeEllipseOnTop('ellipse-top', 'bg');
    const expressions = expMap(rect, ellipse);
    const order = ['rect-bottom', 'ellipse-top'];
    const lockedBg: Layer = { ...bgLayer, locked: true };

    const hit = findExpressionAtPoint(
      { x: 190, y: 150 },
      expressions,
      order,
      5,
      [defaultLayer, lockedBg],
    );

    expect(hit).toBe('rect-bottom');
  });

  it('returns null when ALL layers are hidden', () => {
    const rect = makeRect('rect-1', 'default');
    const expressions = expMap(rect);
    const order = ['rect-1'];
    const allHidden: Layer = { ...defaultLayer, visible: false };

    const hit = findExpressionAtPoint(
      { x: 200, y: 150 },
      expressions,
      order,
      5,
      [allHidden],
    );

    expect(hit).toBeNull();
  });

  it('works with undefined layers parameter (backwards compatible)', () => {
    const rect = makeRect('rect-1', 'default');
    const expressions = expMap(rect);
    const order = ['rect-1'];

    // No layers param — should NOT filter
    const hit = findExpressionAtPoint(
      { x: 200, y: 150 },
      expressions,
      order,
      5,
    );

    expect(hit).toBe('rect-1');
  });
});

// ── findExpressionsInMarquee × layers ──────────────────────

describe('[INTEGRATION] findExpressionsInMarquee with layers', () => {
  const defaultLayer: Layer = { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 };
  const bgLayer: Layer = { id: 'bg', name: 'Background', visible: true, locked: false, order: 1 };

  const bigMarquee = { x: 0, y: 0, width: 500, height: 500 };

  it('excludes expressions on hidden layers', () => {
    const r1 = makeRect('visible-rect', 'default');
    const r2 = makeRect('hidden-rect', 'bg');
    const expressions = expMap(r1, r2);
    const hiddenBg: Layer = { ...bgLayer, visible: false };

    const result = findExpressionsInMarquee(
      bigMarquee,
      expressions,
      [defaultLayer, hiddenBg],
    );

    expect(result).toContain('visible-rect');
    expect(result).not.toContain('hidden-rect');
  });

  it('excludes expressions on locked layers', () => {
    const r1 = makeRect('unlocked-rect', 'default');
    const r2 = makeRect('locked-rect', 'bg');
    const expressions = expMap(r1, r2);
    const lockedBg: Layer = { ...bgLayer, locked: true };

    const result = findExpressionsInMarquee(
      bigMarquee,
      expressions,
      [defaultLayer, lockedBg],
    );

    expect(result).toContain('unlocked-rect');
    expect(result).not.toContain('locked-rect');
  });

  it('returns all when all layers visible and unlocked', () => {
    const r1 = makeRect('rect-default', 'default');
    const r2 = makeRect('rect-bg', 'bg');
    const expressions = expMap(r1, r2);

    const result = findExpressionsInMarquee(
      bigMarquee,
      expressions,
      [defaultLayer, bgLayer],
    );

    expect(result).toContain('rect-default');
    expect(result).toContain('rect-bg');
    expect(result).toHaveLength(2);
  });

  it('returns empty when all layers hidden', () => {
    const r1 = makeRect('rect-1', 'default');
    const r2 = makeRect('rect-2', 'bg');
    const expressions = expMap(r1, r2);
    const allHidden = [
      { ...defaultLayer, visible: false },
      { ...bgLayer, visible: false },
    ];

    const result = findExpressionsInMarquee(bigMarquee, expressions, allHidden);

    expect(result).toHaveLength(0);
  });

  it('works with undefined layers parameter (backwards compatible)', () => {
    const r1 = makeRect('rect-1', 'default');
    const expressions = expMap(r1);

    const result = findExpressionsInMarquee(bigMarquee, expressions);

    expect(result).toContain('rect-1');
  });

  it('handles expression with no layerId — defaults to "default" layer', () => {
    // Expression without layerId should be treated as if on 'default'
    const expr = builder
      .rectangle(100, 100, 200, 100)
      .label('No Layer')
      .build();
    const noLayerExpr: VisualExpression = { ...expr, id: 'no-layer' };
    delete (noLayerExpr as Record<string, unknown>).layerId;
    const expressions = expMap(noLayerExpr);

    // Default layer is visible → should be included
    const result = findExpressionsInMarquee(
      bigMarquee,
      expressions,
      [defaultLayer],
    );
    expect(result).toContain('no-layer');

    // Default layer is hidden → should be excluded
    const hiddenDefault = { ...defaultLayer, visible: false };
    const result2 = findExpressionsInMarquee(
      bigMarquee,
      expressions,
      [hiddenDefault],
    );
    expect(result2).not.toContain('no-layer');
  });
});
