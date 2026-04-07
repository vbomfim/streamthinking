/**
 * Unit tests for theme presets and applyTheme function.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers: preset validation, color mapping by expression kind,
 * scope filtering, edge cases.
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpressionBuilder, DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';
import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import {
  THEME_PRESETS,
  getThemeById,
  applyThemeToExpressions,
} from '../themes/presets.js';
import type { ThemePreset } from '../themes/presets.js';
import { useCanvasStore } from '../store/canvasStore.js';

// ── Test helpers ───────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string): VisualExpression {
  const expr = builder.rectangle(0, 0, 100, 50).label('Box').build();
  return { ...expr, id };
}

function makeEllipse(id: string): VisualExpression {
  const expr = builder.ellipse(0, 0, 100, 100).label('Circle').build();
  return { ...expr, id };
}

function makeText(id: string): VisualExpression {
  const expr = builder.text(0, 0, 'Hello World').build();
  return { ...expr, id };
}

function makeStickyNote(id: string): VisualExpression {
  const expr = builder.stickyNote(0, 0, 'Note').build();
  return { ...expr, id };
}

function makeDiamond(id: string): VisualExpression {
  // Diamonds use the ExpressionBuilder — build manually
  return {
    id,
    kind: 'diamond',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    angle: 0,
    style: { ...DEFAULT_EXPRESSION_STYLE },
    meta: {
      author: testAuthor,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data: { kind: 'diamond' as const, label: 'Decision' },
  };
}

function resetStore() {
  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
    operationLog: [],
    canUndo: false,
    canRedo: false,
    lastUsedStyle: { ...DEFAULT_EXPRESSION_STYLE },
  });
  useCanvasStore.getState().clearHistory();
}

// ── Theme preset validation ───────────────────────────────

describe('THEME_PRESETS', () => {
  it('contains at least 5 presets', () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  it('each preset has a unique id', () => {
    const ids = THEME_PRESETS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each preset has required fields', () => {
    for (const preset of THEME_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.colors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(preset.colors.secondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(preset.colors.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(preset.colors.stroke).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(preset.colors.text).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(preset.colors.background).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(preset.fontFamily).toBeTruthy();
    }
  });

  it('contains corporate, technical, colorful, dark, and blueprint presets', () => {
    const ids = THEME_PRESETS.map((t) => t.id);
    expect(ids).toContain('corporate');
    expect(ids).toContain('technical');
    expect(ids).toContain('colorful');
    expect(ids).toContain('dark');
    expect(ids).toContain('blueprint');
  });
});

// ── getThemeById ──────────────────────────────────────────

describe('getThemeById', () => {
  it('returns the correct preset for a valid id', () => {
    const corporate = getThemeById('corporate');
    expect(corporate).toBeDefined();
    expect(corporate!.name).toBe('Corporate');
  });

  it('returns undefined for an unknown id', () => {
    const result = getThemeById('nonexistent');
    expect(result).toBeUndefined();
  });
});

// ── applyThemeToExpressions ──────────────────────────────

describe('applyThemeToExpressions', () => {
  const theme = THEME_PRESETS.find((t) => t.id === 'corporate')!;

  it('applies primary fill to rectangles', () => {
    const rect = makeRectangle('r1');
    const result = applyThemeToExpressions([rect], theme);

    expect(result).toHaveLength(1);
    expect(result[0]!.style.backgroundColor).toBe(theme.colors.primary);
    expect(result[0]!.style.strokeColor).toBe(theme.colors.stroke);
    expect(result[0]!.style.fillStyle).toBe('solid');
  });

  it('applies primary fill to ellipses', () => {
    const ellipse = makeEllipse('e1');
    const result = applyThemeToExpressions([ellipse], theme);

    expect(result[0]!.style.backgroundColor).toBe(theme.colors.primary);
    expect(result[0]!.style.strokeColor).toBe(theme.colors.stroke);
  });

  it('applies primary fill to diamonds', () => {
    const diamond = makeDiamond('d1');
    const result = applyThemeToExpressions([diamond], theme);

    expect(result[0]!.style.backgroundColor).toBe(theme.colors.primary);
    expect(result[0]!.style.strokeColor).toBe(theme.colors.stroke);
  });

  it('applies accent fill to sticky notes', () => {
    const sticky = makeStickyNote('s1');
    const result = applyThemeToExpressions([sticky], theme);

    expect(result[0]!.style.backgroundColor).toBe(theme.colors.accent);
    expect(result[0]!.style.strokeColor).toBe(theme.colors.stroke);
  });

  it('applies text color and fontFamily to text expressions', () => {
    const text = makeText('t1');
    const result = applyThemeToExpressions([text], theme);

    expect(result[0]!.style.strokeColor).toBe(theme.colors.text);
    expect(result[0]!.style.fontFamily).toBe(theme.fontFamily);
  });

  it('applies fontFamily from theme to all expressions', () => {
    const rect = makeRectangle('r1');
    const result = applyThemeToExpressions([rect], theme);

    expect(result[0]!.style.fontFamily).toBe(theme.fontFamily);
  });

  it('applies stroke color to all expression types', () => {
    const expressions = [
      makeRectangle('r1'),
      makeEllipse('e1'),
      makeDiamond('d1'),
      makeStickyNote('s1'),
    ];
    const result = applyThemeToExpressions(expressions, theme);

    for (const expr of result) {
      expect(expr.style.strokeColor).toBe(theme.colors.stroke);
    }
  });

  it('returns empty array for empty input', () => {
    const result = applyThemeToExpressions([], theme);
    expect(result).toEqual([]);
  });

  it('does not modify the original expression objects', () => {
    const rect = makeRectangle('r1');
    const originalStroke = rect.style.strokeColor;

    applyThemeToExpressions([rect], theme);

    expect(rect.style.strokeColor).toBe(originalStroke);
  });

  it('applies different themes producing different results', () => {
    const rect = makeRectangle('r1');
    const corporate = THEME_PRESETS.find((t) => t.id === 'corporate')!;
    const dark = THEME_PRESETS.find((t) => t.id === 'dark')!;

    const resultCorporate = applyThemeToExpressions([rect], corporate);
    const resultDark = applyThemeToExpressions([rect], dark);

    expect(resultCorporate[0]!.style.backgroundColor).not.toBe(
      resultDark[0]!.style.backgroundColor,
    );
  });

  it('handles mixed expression types in a single call', () => {
    const expressions = [
      makeRectangle('r1'),
      makeText('t1'),
      makeStickyNote('s1'),
      makeDiamond('d1'),
    ];
    const result = applyThemeToExpressions(expressions, theme);

    expect(result).toHaveLength(4);
    // Rectangle gets primary
    expect(result[0]!.style.backgroundColor).toBe(theme.colors.primary);
    // Text gets text color
    expect(result[1]!.style.strokeColor).toBe(theme.colors.text);
    // Sticky note gets accent
    expect(result[2]!.style.backgroundColor).toBe(theme.colors.accent);
    // Diamond gets primary
    expect(result[3]!.style.backgroundColor).toBe(theme.colors.primary);
  });
});

// ── Store integration: applyTheme action ──────────────────

describe('canvasStore.applyTheme', () => {
  beforeEach(() => resetStore());

  it('applies theme to all expressions when scope is "all"', () => {
    const store = useCanvasStore.getState();
    store.addExpression(makeRectangle('r1'));
    store.addExpression(makeEllipse('e1'));

    useCanvasStore.getState().applyTheme('corporate', 'all');

    const state = useCanvasStore.getState();
    const theme = getThemeById('corporate')!;
    expect(state.expressions['r1']!.style.backgroundColor).toBe(theme.colors.primary);
    expect(state.expressions['e1']!.style.backgroundColor).toBe(theme.colors.primary);
  });

  it('applies theme only to selected expressions when scope is "selected"', () => {
    const store = useCanvasStore.getState();
    store.addExpression(makeRectangle('r1'));
    store.addExpression(makeRectangle('r2'));
    store.setSelectedIds(new Set(['r1']));

    useCanvasStore.getState().applyTheme('corporate', 'selected');

    const state = useCanvasStore.getState();
    const theme = getThemeById('corporate')!;
    expect(state.expressions['r1']!.style.backgroundColor).toBe(theme.colors.primary);
    // r2 should NOT be changed
    expect(state.expressions['r2']!.style.backgroundColor).not.toBe(theme.colors.primary);
  });

  it('creates an undo snapshot', () => {
    useCanvasStore.getState().addExpression(makeRectangle('r1'));
    const originalBg = useCanvasStore.getState().expressions['r1']!.style.backgroundColor;

    useCanvasStore.getState().applyTheme('corporate', 'all');

    const theme = getThemeById('corporate')!;
    expect(useCanvasStore.getState().expressions['r1']!.style.backgroundColor).toBe(theme.colors.primary);
    expect(useCanvasStore.getState().canUndo).toBe(true);

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().expressions['r1']!.style.backgroundColor).toBe(originalBg);
  });

  it('emits style operations for themed expressions', () => {
    const store = useCanvasStore.getState();
    store.addExpression(makeRectangle('r1'));
    const logBefore = store.operationLog.length;

    useCanvasStore.getState().applyTheme('corporate', 'all');

    const logAfter = useCanvasStore.getState().operationLog.length;
    expect(logAfter).toBeGreaterThan(logBefore);
  });

  it('does nothing for an unknown theme ID', () => {
    useCanvasStore.getState().addExpression(makeRectangle('r1'));
    const originalBg = useCanvasStore.getState().expressions['r1']!.style.backgroundColor;

    useCanvasStore.getState().applyTheme('nonexistent', 'all');

    expect(useCanvasStore.getState().expressions['r1']!.style.backgroundColor).toBe(originalBg);
  });

  it('does nothing when scope is "selected" but nothing is selected', () => {
    useCanvasStore.getState().addExpression(makeRectangle('r1'));
    const logBefore = useCanvasStore.getState().operationLog.length;

    useCanvasStore.getState().applyTheme('corporate', 'selected');

    expect(useCanvasStore.getState().operationLog.length).toBe(logBefore);
  });

  it('skips locked expressions', () => {
    useCanvasStore.getState().addExpression(makeRectangle('r1'));

    // Lock the expression
    useCanvasStore.setState((state) => {
      const e = state.expressions['r1'];
      if (e) e.meta.locked = true;
    });

    const originalBg = useCanvasStore.getState().expressions['r1']!.style.backgroundColor;

    useCanvasStore.getState().applyTheme('corporate', 'all');

    expect(useCanvasStore.getState().expressions['r1']!.style.backgroundColor).toBe(originalBg);
  });
});
