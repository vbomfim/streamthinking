/**
 * Connector Schema Tests — Ticket #147.
 *
 * Validates expanded RoutingMode, ArrowheadType, ArrowData fields,
 * and ArrowBinding connection-point extensions.
 *
 * TDD: These tests are written FIRST, then the implementation follows.
 */

import { describe, it, expect } from 'vitest';
import { arrowDataSchema } from '../validation/schemas.js';

// ── Helper ────────────────────────────────────────────────

/** Minimal valid arrow data for schema validation. */
function minimalArrow(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'arrow',
    points: [[0, 0], [100, 100]],
    ...overrides,
  };
}

// ── RoutingMode expansion ─────────────────────────────────

describe('RoutingMode expansion (#147)', () => {
  it('accepts existing "straight" routing', () => {
    const result = arrowDataSchema.safeParse(minimalArrow({ routing: 'straight' }));
    expect(result.success).toBe(true);
  });

  it('accepts existing "orthogonal" routing', () => {
    const result = arrowDataSchema.safeParse(minimalArrow({ routing: 'orthogonal' }));
    expect(result.success).toBe(true);
  });

  it.each([
    'curved',
    'elbow',
    'entityRelation',
    'isometric',
    'orthogonalCurved',
  ])('accepts new routing mode "%s"', (mode) => {
    const result = arrowDataSchema.safeParse(minimalArrow({ routing: mode }));
    expect(result.success).toBe(true);
  });

  it('rejects invalid routing mode', () => {
    const result = arrowDataSchema.safeParse(minimalArrow({ routing: 'zigzag' }));
    expect(result.success).toBe(false);
  });

  it('routing remains optional', () => {
    const result = arrowDataSchema.safeParse(minimalArrow());
    expect(result.success).toBe(true);
  });
});

// ── ArrowheadType expansion ───────────────────────────────

describe('ArrowheadType expansion (#147)', () => {
  // Backward compat: existing types still work
  describe('backward compatibility', () => {
    it.each([
      'triangle',
      'chevron',
      'diamond',
      'circle',
      'none',
    ])('accepts existing arrowhead type "%s"', (type) => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ endArrowhead: type }),
      );
      expect(result.success).toBe(true);
    });

    it('accepts boolean arrowhead (true)', () => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ endArrowhead: true }),
      );
      expect(result.success).toBe(true);
    });

    it('accepts boolean arrowhead (false)', () => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ endArrowhead: false }),
      );
      expect(result.success).toBe(true);
    });
  });

  // New standard types
  describe('standard arrowhead types', () => {
    it.each([
      'classic',
      'classicThin',
      'open',
      'openThin',
      'block',
      'blockThin',
      'oval',
      'diamondThin',
    ])('accepts standard arrowhead type "%s"', (type) => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ endArrowhead: type }),
      );
      expect(result.success).toBe(true);
    });
  });

  // ER diagram types
  describe('ER diagram arrowhead types', () => {
    it.each([
      'ERone',
      'ERmany',
      'ERmandOne',
      'ERoneToMany',
      'ERzeroToOne',
      'ERzeroToMany',
    ])('accepts ER arrowhead type "%s"', (type) => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ startArrowhead: type }),
      );
      expect(result.success).toBe(true);
    });
  });

  // UML types
  describe('UML arrowhead types', () => {
    it.each([
      'openAsync',
      'dash',
      'cross',
    ])('accepts UML arrowhead type "%s"', (type) => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ endArrowhead: type }),
      );
      expect(result.success).toBe(true);
    });
  });

  // Other types
  describe('other arrowhead types', () => {
    it.each([
      'box',
      'halfCircle',
      'doubleBlock',
    ])('accepts other arrowhead type "%s"', (type) => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ endArrowhead: type }),
      );
      expect(result.success).toBe(true);
    });
  });

  it('rejects unknown arrowhead type', () => {
    const result = arrowDataSchema.safeParse(
      minimalArrow({ endArrowhead: 'unicorn' }),
    );
    expect(result.success).toBe(false);
  });

  it('arrowhead fields remain optional', () => {
    const result = arrowDataSchema.safeParse(minimalArrow());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startArrowhead).toBeUndefined();
      expect(result.data.endArrowhead).toBeUndefined();
    }
  });
});

// ── New ArrowData fields ──────────────────────────────────

describe('ArrowData new fields (#147)', () => {
  describe('startFill / endFill', () => {
    it('accepts startFill: true', () => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ startFill: true }),
      );
      expect(result.success).toBe(true);
    });

    it('accepts endFill: false', () => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ endFill: false }),
      );
      expect(result.success).toBe(true);
    });

    it('rejects non-boolean startFill', () => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ startFill: 'yes' }),
      );
      expect(result.success).toBe(false);
    });

    it('startFill and endFill are optional', () => {
      const result = arrowDataSchema.safeParse(minimalArrow());
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startFill).toBeUndefined();
        expect(result.data.endFill).toBeUndefined();
      }
    });
  });

  describe('curved', () => {
    it('accepts curved: true', () => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ curved: true }),
      );
      expect(result.success).toBe(true);
    });

    it('accepts curved: false', () => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ curved: false }),
      );
      expect(result.success).toBe(true);
    });

    it('rejects non-boolean curved', () => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ curved: 1 }),
      );
      expect(result.success).toBe(false);
    });
  });

  describe('rounded', () => {
    it('accepts rounded: true', () => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ rounded: true }),
      );
      expect(result.success).toBe(true);
    });

    it('accepts rounded: false', () => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ rounded: false }),
      );
      expect(result.success).toBe(true);
    });

    it('rejects non-boolean rounded', () => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ rounded: 'yes' }),
      );
      expect(result.success).toBe(false);
    });
  });

  describe('jettySize', () => {
    it('accepts jettySize as number', () => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ jettySize: 20 }),
      );
      expect(result.success).toBe(true);
    });

    it('accepts jettySize as "auto"', () => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ jettySize: 'auto' }),
      );
      expect(result.success).toBe(true);
    });

    it('rejects negative jettySize', () => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ jettySize: -5 }),
      );
      expect(result.success).toBe(false);
    });

    it('rejects invalid jettySize string', () => {
      const result = arrowDataSchema.safeParse(
        minimalArrow({ jettySize: 'big' }),
      );
      expect(result.success).toBe(false);
    });

    it('jettySize is optional', () => {
      const result = arrowDataSchema.safeParse(minimalArrow());
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.jettySize).toBeUndefined();
      }
    });
  });
});

// ── ArrowBinding extensions ───────────────────────────────

describe('ArrowBinding portX/portY (#147)', () => {
  it('accepts binding with portX and portY', () => {
    const result = arrowDataSchema.safeParse(
      minimalArrow({
        startBinding: {
          expressionId: 'shape-1',
          anchor: 'auto',
          portX: 0.5,
          portY: 0.0,
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it('accepts binding with only portX', () => {
    const result = arrowDataSchema.safeParse(
      minimalArrow({
        endBinding: {
          expressionId: 'shape-2',
          anchor: 'right',
          portX: 1.0,
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it('accepts binding with only portY', () => {
    const result = arrowDataSchema.safeParse(
      minimalArrow({
        endBinding: {
          expressionId: 'shape-3',
          anchor: 'bottom',
          portY: 1.0,
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects portX outside 0-1 range (> 1)', () => {
    const result = arrowDataSchema.safeParse(
      minimalArrow({
        startBinding: {
          expressionId: 'shape-1',
          anchor: 'auto',
          portX: 1.5,
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects portY outside 0-1 range (< 0)', () => {
    const result = arrowDataSchema.safeParse(
      minimalArrow({
        endBinding: {
          expressionId: 'shape-1',
          anchor: 'auto',
          portY: -0.1,
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it('binding without portX/portY still works (backward compat)', () => {
    const result = arrowDataSchema.safeParse(
      minimalArrow({
        startBinding: {
          expressionId: 'shape-1',
          anchor: 'top',
          ratio: 0.5,
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it('accepts portX/portY at boundary values (0 and 1)', () => {
    const result = arrowDataSchema.safeParse(
      minimalArrow({
        startBinding: {
          expressionId: 'shape-1',
          anchor: 'auto',
          portX: 0,
          portY: 1,
        },
      }),
    );
    expect(result.success).toBe(true);
  });
});

// ── Full integration: all new fields combined ─────────────

describe('Full arrow with all new fields (#147)', () => {
  it('accepts arrow with all new fields set', () => {
    const result = arrowDataSchema.safeParse({
      kind: 'arrow',
      points: [[0, 0], [50, 50], [100, 0]],
      routing: 'orthogonalCurved',
      startArrowhead: 'ERone',
      endArrowhead: 'ERmany',
      startFill: true,
      endFill: false,
      curved: true,
      rounded: false,
      jettySize: 15,
      label: 'has many',
      startBinding: {
        expressionId: 'entity-a',
        anchor: 'right',
        ratio: 0.5,
        portX: 1.0,
        portY: 0.5,
      },
      endBinding: {
        expressionId: 'entity-b',
        anchor: 'left',
        portX: 0.0,
        portY: 0.5,
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts arrow with jettySize "auto" and curved routing', () => {
    const result = arrowDataSchema.safeParse({
      kind: 'arrow',
      points: [[0, 0], [100, 100]],
      routing: 'curved',
      endArrowhead: 'classic',
      jettySize: 'auto',
    });
    expect(result.success).toBe(true);
  });

  it('preserves backward compat — minimal arrow still validates', () => {
    const result = arrowDataSchema.safeParse({
      kind: 'arrow',
      points: [[0, 0], [100, 100]],
    });
    expect(result.success).toBe(true);
  });

  it('preserves backward compat — arrow with old fields still validates', () => {
    const result = arrowDataSchema.safeParse({
      kind: 'arrow',
      points: [[10, 20], [300, 400]],
      startArrowhead: false,
      endArrowhead: 'triangle',
      routing: 'orthogonal',
      label: 'old-style arrow',
      startBinding: { expressionId: 'a', anchor: 'auto' },
      endBinding: { expressionId: 'b', anchor: 'center', ratio: 0.3 },
    });
    expect(result.success).toBe(true);
  });
});
