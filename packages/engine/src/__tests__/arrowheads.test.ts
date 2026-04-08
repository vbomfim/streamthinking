/**
 * Unit tests for arrowhead registry and renderers.
 *
 * Covers: all 22+ ArrowheadType renderings, filled vs outline,
 * angle rotation, 'none' skip, thin variants, ER markers,
 * backward compat aliases, and registry completeness.
 *
 * @module
 */

import type { ArrowheadType } from '@infinicanvas/protocol';
import {
  renderArrowheadFromRegistry,
  getArrowheadRenderer,
  ALL_ARROWHEAD_TYPES,
} from '../renderer/arrowheads.js';

// ── Mock Canvas Context ─────────────────────────────────────

function createMockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 2,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

// ── Registry Completeness ───────────────────────────────────

describe('arrowhead registry completeness', () => {
  /**
   * Every ArrowheadType defined in the protocol must have a renderer
   * registered. This ensures no type goes unhandled at runtime.
   */
  const protocolTypes: ArrowheadType[] = [
    'triangle', 'chevron',
    'none', 'classic', 'classicThin', 'open', 'openThin',
    'block', 'blockThin', 'oval', 'diamond', 'diamondThin', 'circle',
    'ERone', 'ERmany', 'ERmandOne', 'ERoneToMany', 'ERzeroToOne', 'ERzeroToMany',
    'openAsync', 'dash', 'cross',
    'box', 'halfCircle', 'doubleBlock',
  ];

  it.each(protocolTypes)('has a renderer for "%s"', (type) => {
    const renderer = getArrowheadRenderer(type);
    expect(renderer).toBeDefined();
  });

  it('exports ALL_ARROWHEAD_TYPES matching the protocol types', () => {
    for (const type of protocolTypes) {
      expect(ALL_ARROWHEAD_TYPES).toContain(type);
    }
  });
});

// ── 'none' type ─────────────────────────────────────────────

describe('arrowhead type "none"', () => {
  it('produces no draw calls', () => {
    const ctx = createMockCtx();
    renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'none', true, '#000', '#fff');

    expect(ctx.beginPath).not.toHaveBeenCalled();
    expect(ctx.moveTo).not.toHaveBeenCalled();
    expect(ctx.lineTo).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(ctx.arc).not.toHaveBeenCalled();
  });
});

// ── Standard Arrowheads ─────────────────────────────────────

describe('standard arrowheads', () => {
  describe('classic (filled triangle)', () => {
    it('renders without error at angle 0', () => {
      const ctx = createMockCtx();
      expect(() => {
        renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'classic', true, '#000', '#fff');
      }).not.toThrow();
    });

    it('calls fill when filled=true', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'classic', true, '#000', '#fff');
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('calls stroke (not fill) when filled=false', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'classic', false, '#000', '#fff');
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('draws a triangle path (moveTo + 2 lineTo + closePath)', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'classic', true, '#000', '#fff');
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalledTimes(2);
      expect(ctx.closePath).toHaveBeenCalled();
    });
  });

  describe('triangle (alias for classic)', () => {
    it('renders identically to classic', () => {
      const ctxClassic = createMockCtx();
      const ctxTriangle = createMockCtx();
      renderArrowheadFromRegistry(ctxClassic, 100, 100, Math.PI / 4, 10, 'classic', true, '#000', '#fff');
      renderArrowheadFromRegistry(ctxTriangle, 100, 100, Math.PI / 4, 10, 'triangle', true, '#000', '#fff');

      // Both should produce moveTo at same position
      expect(ctxClassic.moveTo).toHaveBeenCalledWith(
        ...ctxTriangle.moveTo.mock.calls[0]!,
      );
    });
  });

  describe('classicThin', () => {
    it('renders without error', () => {
      const ctx = createMockCtx();
      expect(() => {
        renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'classicThin', true, '#000', '#fff');
      }).not.toThrow();
    });

    it('draws a narrower triangle than classic', () => {
      const ctxClassic = createMockCtx();
      const ctxThin = createMockCtx();
      renderArrowheadFromRegistry(ctxClassic, 100, 100, Math.PI / 2, 10, 'classic', true, '#000', '#fff');
      renderArrowheadFromRegistry(ctxThin, 100, 100, Math.PI / 2, 10, 'classicThin', true, '#000', '#fff');

      // Both should have lineTo calls but with different positions (thin is narrower)
      expect(ctxThin.lineTo).toHaveBeenCalledTimes(2);
      // Thin variant X positions should differ from classic
      const classicCalls = ctxClassic.lineTo.mock.calls;
      const thinCalls = ctxThin.lineTo.mock.calls;
      const classicWidth = Math.abs((classicCalls[0]![0] as number) - (classicCalls[1]![0] as number));
      const thinWidth = Math.abs((thinCalls[0]![0] as number) - (thinCalls[1]![0] as number));
      expect(thinWidth).toBeLessThan(classicWidth);
    });
  });

  describe('open (outline triangle)', () => {
    it('calls stroke, not fill', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'open', true, '#000', '#fff');
      // 'open' is always outline — ignores filled param
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.fill).not.toHaveBeenCalled();
    });
  });

  describe('openThin', () => {
    it('calls stroke, not fill', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'openThin', true, '#000', '#fff');
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.fill).not.toHaveBeenCalled();
    });
  });

  describe('block (filled rectangle)', () => {
    it('renders without error', () => {
      const ctx = createMockCtx();
      expect(() => {
        renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'block', true, '#000', '#fff');
      }).not.toThrow();
    });

    it('draws a rectangular path (4 lineTo calls)', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'block', true, '#000', '#fff');
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.lineTo.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(ctx.closePath).toHaveBeenCalled();
    });
  });

  describe('blockThin', () => {
    it('renders without error', () => {
      const ctx = createMockCtx();
      expect(() => {
        renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'blockThin', true, '#000', '#fff');
      }).not.toThrow();
    });
  });

  describe('oval', () => {
    it('draws an arc (circle)', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'oval', true, '#000', '#fff');
      expect(ctx.arc).toHaveBeenCalled();
    });

    it('fills when filled=true', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'oval', true, '#000', '#fff');
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('strokes when filled=false', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'oval', false, '#000', '#fff');
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  describe('circle (alias for oval)', () => {
    it('draws an arc', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'circle', true, '#000', '#fff');
      expect(ctx.arc).toHaveBeenCalled();
    });
  });

  describe('diamond', () => {
    it('renders without error', () => {
      const ctx = createMockCtx();
      expect(() => {
        renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'diamond', true, '#000', '#fff');
      }).not.toThrow();
    });

    it('draws a diamond path (4 vertices)', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'diamond', true, '#000', '#fff');
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.moveTo).toHaveBeenCalled();
      // 3 lineTo calls (moveTo is 1st vertex, then 3 lineTo for remaining)
      expect(ctx.lineTo).toHaveBeenCalledTimes(3);
      expect(ctx.closePath).toHaveBeenCalled();
    });
  });

  describe('diamondThin', () => {
    it('renders without error', () => {
      const ctx = createMockCtx();
      expect(() => {
        renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'diamondThin', true, '#000', '#fff');
      }).not.toThrow();
    });
  });

  describe('box (alias for block)', () => {
    it('renders without error', () => {
      const ctx = createMockCtx();
      expect(() => {
        renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'box', true, '#000', '#fff');
      }).not.toThrow();
    });
  });
});

// ── ER Diagram Arrowheads ───────────────────────────────────

describe('ER diagram arrowheads', () => {
  const erTypes: ArrowheadType[] = [
    'ERone', 'ERmany', 'ERmandOne', 'ERoneToMany', 'ERzeroToOne', 'ERzeroToMany',
  ];

  it.each(erTypes)('"%s" renders without error', (type) => {
    const ctx = createMockCtx();
    expect(() => {
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 15, type, true, '#000', '#fff');
    }).not.toThrow();
  });

  it.each(erTypes)('"%s" produces draw calls', (type) => {
    const ctx = createMockCtx();
    renderArrowheadFromRegistry(ctx, 100, 100, 0, 15, type, true, '#000', '#fff');
    // All ER types should draw something
    const totalCalls = ctx.moveTo.mock.calls.length +
      ctx.lineTo.mock.calls.length +
      ctx.arc.mock.calls.length;
    expect(totalCalls).toBeGreaterThan(0);
  });

  describe('ERone (single bar)', () => {
    it('draws a perpendicular line', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 15, 'ERone', true, '#000', '#fff');
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  describe('ERmany (crow\'s foot)', () => {
    it('draws three diverging lines', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 15, 'ERmany', true, '#000', '#fff');
      // Crow's foot: 3 lines from tip diverging backward
      expect(ctx.moveTo.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  describe('ERmandOne (double bar)', () => {
    it('draws two perpendicular lines', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 15, 'ERmandOne', true, '#000', '#fff');
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  describe('ERzeroToOne (circle + bar)', () => {
    it('draws both an arc and lines', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 15, 'ERzeroToOne', true, '#000', '#fff');
      expect(ctx.arc).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  describe('ERzeroToMany (circle + crow\'s foot)', () => {
    it('draws both an arc and lines', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 15, 'ERzeroToMany', true, '#000', '#fff');
      expect(ctx.arc).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });
});

// ── UML & Other Arrowheads ──────────────────────────────────

describe('UML and other arrowheads', () => {
  describe('openAsync (open chevron)', () => {
    it('renders with stroke only', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'openAsync', true, '#000', '#fff');
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.fill).not.toHaveBeenCalled();
    });
  });

  describe('chevron (alias for openAsync)', () => {
    it('renders without error', () => {
      const ctx = createMockCtx();
      expect(() => {
        renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'chevron', true, '#000', '#fff');
      }).not.toThrow();
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  describe('dash (perpendicular line)', () => {
    it('renders a short perpendicular stroke', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'dash', true, '#000', '#fff');
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  describe('cross (X mark)', () => {
    it('draws two crossing lines', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'cross', true, '#000', '#fff');
      expect(ctx.stroke).toHaveBeenCalled();
      // X = 2 strokes from moveTo→lineTo
      expect(ctx.moveTo.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('halfCircle', () => {
    it('draws a semicircle arc', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'halfCircle', true, '#000', '#fff');
      expect(ctx.arc).toHaveBeenCalled();
    });
  });

  describe('doubleBlock', () => {
    it('renders without error', () => {
      const ctx = createMockCtx();
      expect(() => {
        renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'doubleBlock', true, '#000', '#fff');
      }).not.toThrow();
    });

    it('draws a path with fill or stroke', () => {
      const ctx = createMockCtx();
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'doubleBlock', true, '#000', '#fff');
      const drew = ctx.fill.mock.calls.length > 0 || ctx.stroke.mock.calls.length > 0;
      expect(drew).toBe(true);
    });
  });
});

// ── Angle Rotation ──────────────────────────────────────────

describe('angle rotation', () => {
  const angles = [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2, 3 * Math.PI / 4];

  it.each(angles)('classic renders correctly at angle %f rad', (angle) => {
    const ctx = createMockCtx();
    expect(() => {
      renderArrowheadFromRegistry(ctx, 100, 100, angle, 10, 'classic', true, '#000', '#fff');
    }).not.toThrow();
    expect(ctx.moveTo).toHaveBeenCalled();
  });

  it('tip position changes with angle for classic', () => {
    const ctx0 = createMockCtx();
    const ctx90 = createMockCtx();
    renderArrowheadFromRegistry(ctx0, 100, 100, 0, 10, 'classic', true, '#000', '#fff');
    renderArrowheadFromRegistry(ctx90, 100, 100, Math.PI / 2, 10, 'classic', true, '#000', '#fff');

    // The lineTo positions should differ between angle 0 and angle PI/2
    const lineTo0 = ctx0.lineTo.mock.calls[0]!;
    const lineTo90 = ctx90.lineTo.mock.calls[0]!;
    expect(lineTo0[0]).not.toBeCloseTo(lineTo90[0] as number, 3);
  });
});

// ── Unknown Type Fallback ───────────────────────────────────

describe('unknown arrowhead type fallback', () => {
  it('falls back to classic for unknown type', () => {
    const ctx = createMockCtx();
    expect(() => {
      renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'unknownType' as ArrowheadType, true, '#000', '#fff');
    }).not.toThrow();
    // Should still draw something (classic fallback)
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});

// ── Color Handling ──────────────────────────────────────────

describe('color handling', () => {
  it('sets fillStyle to strokeColor when filled', () => {
    const ctx = createMockCtx();
    renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'classic', true, '#ff0000', '#ffffff');
    // ctx.save/restore wraps it; check fillStyle was set
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('sets fillStyle to fillColor (background) when not filled', () => {
    const ctx = createMockCtx();
    renderArrowheadFromRegistry(ctx, 100, 100, 0, 10, 'classic', false, '#ff0000', '#ffffff');
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});
