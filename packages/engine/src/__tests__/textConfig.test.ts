/**
 * Unit tests for resolveTextConfig — the unified text configuration utility.
 *
 * Covers all editable expression kinds: text, sticky-note, rectangle,
 * ellipse, diamond, and stencil. Verifies that resolveTextConfig produces
 * the exact same font/position/alignment values used by the renderers.
 *
 * [TDD] Red phase: these tests are written before the implementation.
 */

import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import { resolveTextConfig } from '../text/textConfig.js';
import type { TextConfig } from '../text/textConfig.js';

// ── Test helpers ─────────────────────────────────────────────

function makeStyle(overrides: Partial<ExpressionStyle> = {}): ExpressionStyle {
  return {
    strokeColor: '#000000',
    backgroundColor: '#ffffff',
    fillStyle: 'solid',
    strokeWidth: 2,
    roughness: 1,
    opacity: 1,
    ...overrides,
  };
}

function makeExpression(
  kind: string,
  data: Record<string, unknown>,
  overrides: Partial<VisualExpression> = {},
): VisualExpression {
  return {
    id: 'test-1',
    kind: kind as VisualExpression['kind'],
    position: { x: 100, y: 200 },
    size: { width: 300, height: 150 },
    angle: 0,
    style: makeStyle(),
    meta: {
      author: { type: 'human', id: 'user-1', name: 'Test' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data: { kind, ...data } as VisualExpression['data'],
    ...overrides,
  };
}

// ── Text expressions ─────────────────────────────────────────

describe('resolveTextConfig — text kind', () => {
  it('uses data.text as content and "text" as field name', () => {
    const expr = makeExpression('text', {
      text: 'Hello world',
      fontSize: 24,
      fontFamily: 'sans-serif',
      textAlign: 'left',
    });
    const config = resolveTextConfig(expr);
    expect(config.text).toBe('Hello world');
    expect(config.field).toBe('text');
  });

  it('uses fontSize and fontFamily from data', () => {
    const expr = makeExpression('text', {
      text: 'ABC',
      fontSize: 32,
      fontFamily: 'monospace',
      textAlign: 'center',
    });
    const config = resolveTextConfig(expr);
    expect(config.fontSize).toBe(32);
    expect(config.fontFamily).toBe('monospace');
  });

  it('uses textAlign from data', () => {
    const expr = makeExpression('text', {
      text: 'ABC',
      fontSize: 16,
      fontFamily: 'sans-serif',
      textAlign: 'center',
    });
    const config = resolveTextConfig(expr);
    expect(config.textAlign).toBe('center');
  });

  it('positions at expression origin', () => {
    const expr = makeExpression('text', {
      text: 'ABC',
      fontSize: 16,
      fontFamily: 'sans-serif',
      textAlign: 'left',
    });
    const config = resolveTextConfig(expr);
    expect(config.worldX).toBe(100);
    expect(config.worldY).toBe(200);
    expect(config.worldWidth).toBe(300);
    expect(config.worldHeight).toBe(150);
  });

  it('uses strokeColor as text color', () => {
    const expr = makeExpression('text', {
      text: 'ABC',
      fontSize: 16,
      fontFamily: 'sans-serif',
      textAlign: 'left',
    }, { style: makeStyle({ strokeColor: '#ff0000' }) });
    const config = resolveTextConfig(expr);
    expect(config.color).toBe('#ff0000');
  });

  it('sets verticalAlign to "top"', () => {
    const expr = makeExpression('text', {
      text: 'ABC',
      fontSize: 16,
      fontFamily: 'sans-serif',
      textAlign: 'left',
    });
    const config = resolveTextConfig(expr);
    expect(config.verticalAlign).toBe('top');
  });

  it('sets deleteOnEmpty to true', () => {
    const expr = makeExpression('text', {
      text: 'ABC',
      fontSize: 16,
      fontFamily: 'sans-serif',
      textAlign: 'left',
    });
    const config = resolveTextConfig(expr);
    expect(config.deleteOnEmpty).toBe(true);
  });

  it('sets background to "white"', () => {
    const expr = makeExpression('text', {
      text: 'ABC',
      fontSize: 16,
      fontFamily: 'sans-serif',
      textAlign: 'left',
    });
    const config = resolveTextConfig(expr);
    expect(config.background).toBe('white');
  });
});

// ── Sticky-note expressions ─────────────────────────────────

describe('resolveTextConfig — sticky-note kind', () => {
  it('uses data.text as content and "text" as field name', () => {
    const expr = makeExpression('sticky-note', {
      text: 'Remember this',
      color: '#FFEB3B',
    });
    const config = resolveTextConfig(expr);
    expect(config.text).toBe('Remember this');
    expect(config.field).toBe('text');
  });

  it('uses style.fontSize or defaults to 16', () => {
    const expr = makeExpression('sticky-note', {
      text: 'Note',
      color: '#FFEB3B',
    });
    const config = resolveTextConfig(expr);
    expect(config.fontSize).toBe(16); // DEFAULT_FONT_SIZE

    const expr2 = makeExpression('sticky-note', {
      text: 'Note',
      color: '#FFEB3B',
    }, { style: makeStyle({ fontSize: 20 }) });
    const config2 = resolveTextConfig(expr2);
    expect(config2.fontSize).toBe(20);
  });

  it('uses style.fontFamily or defaults to "Architects Daughter, cursive"', () => {
    const expr = makeExpression('sticky-note', {
      text: 'Note',
      color: '#FFEB3B',
    });
    const config = resolveTextConfig(expr);
    expect(config.fontFamily).toBe('Architects Daughter, cursive');
  });

  it('sets left-aligned, top vertical', () => {
    const expr = makeExpression('sticky-note', {
      text: 'Note',
      color: '#FFEB3B',
    });
    const config = resolveTextConfig(expr);
    expect(config.textAlign).toBe('left');
    expect(config.verticalAlign).toBe('top');
  });

  it('positions text with sticky note padding (12px)', () => {
    const expr = makeExpression('sticky-note', {
      text: 'Note',
      color: '#FFEB3B',
    });
    const config = resolveTextConfig(expr);
    // Text area inside note = note position + padding
    expect(config.worldX).toBe(100 + 12); // x + STICKY_NOTE_PADDING
    expect(config.worldY).toBe(200 + 12); // y + STICKY_NOTE_PADDING
    expect(config.worldWidth).toBe(300 - 24); // width - 2*padding
    expect(config.worldHeight).toBe(150 - 24); // height - 2*padding
  });

  it('sets text color to black (#000000)', () => {
    const expr = makeExpression('sticky-note', {
      text: 'Note',
      color: '#FFEB3B',
    });
    const config = resolveTextConfig(expr);
    expect(config.color).toBe('#000000');
  });

  it('sets deleteOnEmpty to true', () => {
    const expr = makeExpression('sticky-note', {
      text: 'Note',
      color: '#FFEB3B',
    });
    const config = resolveTextConfig(expr);
    expect(config.deleteOnEmpty).toBe(true);
  });

  it('uses data.color as background', () => {
    const expr = makeExpression('sticky-note', {
      text: 'Note',
      color: '#E8F5E9',
    });
    const config = resolveTextConfig(expr);
    expect(config.background).toBe('#E8F5E9');
  });
});

// ── Shape labels (rectangle, ellipse, diamond) ───────────────

describe('resolveTextConfig — shape labels', () => {
  const shapeKinds = ['rectangle', 'ellipse', 'diamond'] as const;

  for (const kind of shapeKinds) {
    describe(`${kind}`, () => {
      it('uses data.label as content and "label" as field name', () => {
        const expr = makeExpression(kind, { label: 'My Shape' });
        const config = resolveTextConfig(expr);
        expect(config.text).toBe('My Shape');
        expect(config.field).toBe('label');
      });

      it('returns empty string for text when label is undefined', () => {
        const expr = makeExpression(kind, {});
        const config = resolveTextConfig(expr);
        expect(config.text).toBe('');
      });

      it('auto-scales fontSize to 20% of height, clamped 8-72', () => {
        // height=150 → autoSize=30 → clamped to 30
        const expr = makeExpression(kind, { label: 'Test' });
        const config = resolveTextConfig(expr);
        expect(config.fontSize).toBe(30); // 150 * 0.2 = 30

        // Small shape: height=20 → autoSize=4 → clamped to 8
        const smallExpr = makeExpression(kind, { label: 'Tiny' }, {
          size: { width: 40, height: 20 },
        });
        const smallConfig = resolveTextConfig(smallExpr);
        expect(smallConfig.fontSize).toBe(8);

        // Large shape: height=500 → autoSize=100 → clamped to 72
        const largeExpr = makeExpression(kind, { label: 'Big' }, {
          size: { width: 600, height: 500 },
        });
        const largeConfig = resolveTextConfig(largeExpr);
        expect(largeConfig.fontSize).toBe(72);
      });

      it('uses style.fontSize if set (overrides auto-scale)', () => {
        const expr = makeExpression(kind, { label: 'Test' }, {
          style: makeStyle({ fontSize: 48 }),
        });
        const config = resolveTextConfig(expr);
        expect(config.fontSize).toBe(48);
      });

      it('uses default font family', () => {
        const expr = makeExpression(kind, { label: 'Test' });
        const config = resolveTextConfig(expr);
        expect(config.fontFamily).toBe('Architects Daughter, cursive');
      });

      it('uses style.fontFamily if set', () => {
        const expr = makeExpression(kind, { label: 'Test' }, {
          style: makeStyle({ fontFamily: 'monospace' }),
        });
        const config = resolveTextConfig(expr);
        expect(config.fontFamily).toBe('monospace');
      });

      it('sets center alignment and middle vertical', () => {
        const expr = makeExpression(kind, { label: 'Test' });
        const config = resolveTextConfig(expr);
        expect(config.textAlign).toBe('center');
        expect(config.verticalAlign).toBe('middle');
      });

      it('positions at expression bounding box', () => {
        const expr = makeExpression(kind, { label: 'Test' });
        const config = resolveTextConfig(expr);
        expect(config.worldX).toBe(100);
        expect(config.worldY).toBe(200);
        expect(config.worldWidth).toBe(300);
        expect(config.worldHeight).toBe(150);
      });

      it('uses strokeColor as text color', () => {
        const expr = makeExpression(kind, { label: 'Test' }, {
          style: makeStyle({ strokeColor: '#0000ff' }),
        });
        const config = resolveTextConfig(expr);
        expect(config.color).toBe('#0000ff');
      });

      it('sets deleteOnEmpty to false', () => {
        const expr = makeExpression(kind, { label: 'Test' });
        const config = resolveTextConfig(expr);
        expect(config.deleteOnEmpty).toBe(false);
      });

      it('sets transparent background', () => {
        const expr = makeExpression(kind, { label: 'Test' });
        const config = resolveTextConfig(expr);
        expect(config.background).toBe('transparent');
      });
    });
  }
});

// ── Stencil labels ──────────────────────────────────────────

describe('resolveTextConfig — stencil kind', () => {
  it('uses data.label as content and "label" as field name', () => {
    const expr = makeExpression('stencil', {
      stencilId: 'server',
      category: 'generic-it',
      label: 'Web Server',
    });
    const config = resolveTextConfig(expr);
    expect(config.text).toBe('Web Server');
    expect(config.field).toBe('label');
  });

  it('returns empty string for text when label is undefined', () => {
    const expr = makeExpression('stencil', {
      stencilId: 'server',
      category: 'generic-it',
    });
    const config = resolveTextConfig(expr);
    expect(config.text).toBe('');
  });

  it('uses style.fontSize or defaults to 12 (STENCIL_LABEL_FONT_SIZE)', () => {
    const expr = makeExpression('stencil', {
      stencilId: 'server',
      category: 'generic-it',
      label: 'Server',
    });
    const config = resolveTextConfig(expr);
    expect(config.fontSize).toBe(12);

    const expr2 = makeExpression('stencil', {
      stencilId: 'server',
      category: 'generic-it',
      label: 'Server',
    }, { style: makeStyle({ fontSize: 18 }) });
    const config2 = resolveTextConfig(expr2);
    expect(config2.fontSize).toBe(18);
  });

  it('uses default font family', () => {
    const expr = makeExpression('stencil', {
      stencilId: 'server',
      category: 'generic-it',
      label: 'Server',
    });
    const config = resolveTextConfig(expr);
    expect(config.fontFamily).toBe('Architects Daughter, cursive');
  });

  it('sets center alignment and top vertical', () => {
    const expr = makeExpression('stencil', {
      stencilId: 'server',
      category: 'generic-it',
      label: 'Server',
    });
    const config = resolveTextConfig(expr);
    expect(config.textAlign).toBe('center');
    expect(config.verticalAlign).toBe('top');
  });

  it('positions label BELOW the icon with 4px gap', () => {
    // Stencil at (100, 200) with size (300, 150)
    // Label should be centered below: x = 100, y = 200 + 150 + 4 = 354
    // Width for label area: 300 (same as icon)
    const expr = makeExpression('stencil', {
      stencilId: 'server',
      category: 'generic-it',
      label: 'Server',
    });
    const config = resolveTextConfig(expr);
    expect(config.worldX).toBe(100);
    expect(config.worldY).toBe(200 + 150 + 4); // y + height + STENCIL_LABEL_GAP
    expect(config.worldWidth).toBe(300);
  });

  it('uses strokeColor as text color', () => {
    const expr = makeExpression('stencil', {
      stencilId: 'server',
      category: 'generic-it',
      label: 'Server',
    }, { style: makeStyle({ strokeColor: '#333333' }) });
    const config = resolveTextConfig(expr);
    expect(config.color).toBe('#333333');
  });

  it('sets deleteOnEmpty to false', () => {
    const expr = makeExpression('stencil', {
      stencilId: 'server',
      category: 'generic-it',
      label: 'Server',
    });
    const config = resolveTextConfig(expr);
    expect(config.deleteOnEmpty).toBe(false);
  });

  it('sets transparent background for stencil labels', () => {
    const expr = makeExpression('stencil', {
      stencilId: 'server',
      category: 'generic-it',
      label: 'Server',
    });
    const config = resolveTextConfig(expr);
    expect(config.background).toBe('transparent');
  });
});

// ── Edge cases ──────────────────────────────────────────────

describe('resolveTextConfig — edge cases', () => {
  it('returns null for non-editable kinds (line, arrow, freehand, image)', () => {
    const line = makeExpression('line', { points: [[0, 0], [100, 100]] });
    expect(resolveTextConfig(line)).toBeNull();

    const arrow = makeExpression('arrow', { points: [[0, 0], [100, 100]] });
    expect(resolveTextConfig(arrow)).toBeNull();

    const freehand = makeExpression('freehand', { points: [[0, 0, 1]] });
    expect(resolveTextConfig(freehand)).toBeNull();

    const image = makeExpression('image', { src: 'test.png' });
    expect(resolveTextConfig(image)).toBeNull();
  });
});
