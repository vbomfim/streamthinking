/**
 * Connector Serializer Tests — Ticket #150.
 *
 * Validates draw.io round-trip for all connector properties:
 * routing modes, arrowhead types, fill flags, curved/rounded,
 * jettySize, and binding ports.
 *
 * TDD: These tests are written FIRST, then the implementation follows.
 */

import { describe, it, expect } from 'vitest';
import type { VisualExpression } from '../schema/expressions.js';
import type { ExpressionStyle } from '../schema/metadata.js';
import { DEFAULT_EXPRESSION_STYLE } from '../schema/metadata.js';
import type { ArrowData, ArrowheadType, RoutingMode } from '../schema/primitives.js';
import { expressionsToDrawio, drawioToExpressions } from '../drawio/serializer.js';

// ── Test helpers ───────────────────────────────────────────

const humanAuthor = { type: 'human' as const, id: 'user-1', name: 'Tester' };

const baseStyle: ExpressionStyle = {
  ...DEFAULT_EXPRESSION_STYLE,
  strokeColor: '#000000',
  backgroundColor: 'transparent',
  fillStyle: 'none' as const,
  strokeStyle: 'solid' as const,
  strokeWidth: 2,
  roughness: 0,
  opacity: 1,
};

/** Create a VisualExpression arrow for testing. */
function makeArrow(
  id: string,
  arrowOverrides: Partial<ArrowData> = {},
): VisualExpression {
  const now = Date.now();
  const data: ArrowData = {
    kind: 'arrow',
    points: [[0, 0], [100, 100]],
    ...arrowOverrides,
  };
  return {
    id,
    kind: 'arrow',
    position: { x: 0, y: 0 },
    size: { width: 0, height: 0 },
    angle: 0,
    style: { ...baseStyle },
    meta: {
      author: humanAuthor,
      createdAt: now,
      updatedAt: now,
      tags: [],
      locked: false,
    },
    data,
  };
}

/** Helper to extract ArrowData from an imported expression. */
function getArrowData(expr: VisualExpression): ArrowData {
  return expr.data as ArrowData;
}

// ── Export: routing → edgeStyle ────────────────────────────

describe('Export: routing → edgeStyle (#150)', () => {
  it('should export routing=orthogonal as edgeStyle=orthogonalEdgeStyle', () => {
    const arrow = makeArrow('r1', { routing: 'orthogonal' });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('edgeStyle=orthogonalEdgeStyle');
  });

  it('should export routing=curved as edgeStyle=curvedEdgeStyle', () => {
    const arrow = makeArrow('r2', { routing: 'curved' });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('edgeStyle=curvedEdgeStyle');
  });

  it('should export routing=elbow as edgeStyle=elbowEdgeStyle', () => {
    const arrow = makeArrow('r3', { routing: 'elbow' });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('edgeStyle=elbowEdgeStyle');
  });

  it('should export routing=entityRelation as edgeStyle=entityRelationEdgeStyle', () => {
    const arrow = makeArrow('r4', { routing: 'entityRelation' });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('edgeStyle=entityRelationEdgeStyle');
  });

  it('should export routing=isometric as edgeStyle=isometricEdgeStyle', () => {
    const arrow = makeArrow('r5', { routing: 'isometric' });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('edgeStyle=isometricEdgeStyle');
  });

  it('should not emit edgeStyle for routing=straight', () => {
    const arrow = makeArrow('r6', { routing: 'straight' });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).not.toContain('edgeStyle=');
  });

  it('should export routing=orthogonalCurved as edgeStyle=orthogonalEdgeStyle;curved=1', () => {
    const arrow = makeArrow('r7', { routing: 'orthogonalCurved' });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('edgeStyle=orthogonalEdgeStyle');
    expect(xml).toContain('curved=1');
  });

  it('should not emit edgeStyle when routing is undefined', () => {
    const arrow = makeArrow('r8');
    const xml = expressionsToDrawio([arrow]);
    expect(xml).not.toContain('edgeStyle=');
  });
});

// ── Export: arrowheads → startArrow/endArrow ───────────────

describe('Export: arrowheads → startArrow/endArrow (#150)', () => {
  it('should export endArrowhead=classic as endArrow=classic', () => {
    const arrow = makeArrow('ah1', { endArrowhead: 'classic' });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('endArrow=classic');
  });

  it('should export startArrowhead=open as startArrow=open', () => {
    const arrow = makeArrow('ah2', { startArrowhead: 'open' });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('startArrow=open');
  });

  it('should export startArrowhead=none as startArrow=none', () => {
    const arrow = makeArrow('ah3', { startArrowhead: 'none' });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('startArrow=none');
  });

  it('should export boolean true arrowhead as classic', () => {
    const arrow = makeArrow('ah4', { endArrowhead: true });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('endArrow=classic');
  });

  it('should export boolean false arrowhead as none', () => {
    const arrow = makeArrow('ah5', { endArrowhead: false });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('endArrow=none');
  });

  it('should export legacy triangle as classic', () => {
    const arrow = makeArrow('ah6', { endArrowhead: 'triangle' });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('endArrow=classic');
  });

  it('should export legacy circle as oval', () => {
    const arrow = makeArrow('ah7', { endArrowhead: 'circle' });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('endArrow=oval');
  });

  it('should export ER arrowheads directly', () => {
    const arrow = makeArrow('ah8', {
      startArrowhead: 'ERone',
      endArrowhead: 'ERmany',
    });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('startArrow=ERone');
    expect(xml).toContain('endArrow=ERmany');
  });

  it('should not emit startArrow/endArrow when arrowheads are undefined', () => {
    const arrow = makeArrow('ah9');
    const xml = expressionsToDrawio([arrow]);
    expect(xml).not.toContain('startArrow=');
    expect(xml).not.toContain('endArrow=');
  });
});

// ── Export: fill flags ────────────────────────────────────

describe('Export: fill flags (#150)', () => {
  it('should export startFill=false as startFill=0', () => {
    const arrow = makeArrow('f1', { startFill: false });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('startFill=0');
  });

  it('should export endFill=true as endFill=1', () => {
    const arrow = makeArrow('f2', { endFill: true });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('endFill=1');
  });

  it('should export startFill=true as startFill=1', () => {
    const arrow = makeArrow('f3', { startFill: true });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('startFill=1');
  });

  it('should not emit fill flags when undefined', () => {
    const arrow = makeArrow('f4');
    const xml = expressionsToDrawio([arrow]);
    expect(xml).not.toContain('startFill=');
    expect(xml).not.toContain('endFill=');
  });
});

// ── Export: curved / rounded / jettySize ───────────────────

describe('Export: curved/rounded/jettySize (#150)', () => {
  it('should export curved=true as curved=1', () => {
    const arrow = makeArrow('c1', { curved: true });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('curved=1');
  });

  it('should not emit curved when false', () => {
    const arrow = makeArrow('c2', { curved: false });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).not.toContain('curved=');
  });

  it('should export rounded=true as rounded=1', () => {
    const arrow = makeArrow('c3', { rounded: true });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('rounded=1');
  });

  it('should not emit rounded on arrows when false/undefined', () => {
    const arrow = makeArrow('c4');
    const xml = expressionsToDrawio([arrow]);
    // arrows should NOT get the rectangle's rounded=1
    expect(xml).not.toContain('rounded=1');
  });

  it('should export jettySize=20 as jettySize=20', () => {
    const arrow = makeArrow('c5', { jettySize: 20 });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('jettySize=20');
  });

  it('should export jettySize=auto as jettySize=auto', () => {
    const arrow = makeArrow('c6', { jettySize: 'auto' });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('jettySize=auto');
  });
});

// ── Export: binding ports → exitX/exitY/entryX/entryY ─────

describe('Export: binding ports (#150)', () => {
  it('should export startBinding portX/portY as exitX/exitY in style', () => {
    const arrow = makeArrow('bp1', {
      startBinding: { expressionId: 'shape-1', anchor: 'auto', portX: 1.0, portY: 0.5 },
    });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('exitX=1');
    expect(xml).toContain('exitY=0.5');
  });

  it('should export endBinding portX/portY as entryX/entryY in style', () => {
    const arrow = makeArrow('bp2', {
      endBinding: { expressionId: 'shape-2', anchor: 'auto', portX: 0, portY: 1.0 },
    });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('entryX=0');
    expect(xml).toContain('entryY=1');
  });

  it('should not emit exit/entry when ports are undefined', () => {
    const arrow = makeArrow('bp3', {
      startBinding: { expressionId: 'shape-1', anchor: 'auto' },
    });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).not.toContain('exitX=');
    expect(xml).not.toContain('exitY=');
  });
});

// ── Import: edgeStyle → routing ───────────────────────────

describe('Import: edgeStyle → routing (#150)', () => {
  it('should parse edgeStyle=orthogonalEdgeStyle as routing=orthogonal', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="e1" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).routing).toBe('orthogonal');
  });

  it('should parse edgeStyle=curvedEdgeStyle as routing=curved', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="e2" style="edgeStyle=curvedEdgeStyle;" edge="1" parent="1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).routing).toBe('curved');
  });

  it('should parse edgeStyle=elbowEdgeStyle as routing=elbow', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="e3" style="edgeStyle=elbowEdgeStyle;" edge="1" parent="1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).routing).toBe('elbow');
  });

  it('should parse edgeStyle=entityRelationEdgeStyle as routing=entityRelation', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="e4" style="edgeStyle=entityRelationEdgeStyle;" edge="1" parent="1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).routing).toBe('entityRelation');
  });

  it('should parse edgeStyle=isometricEdgeStyle as routing=isometric', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="e5" style="edgeStyle=isometricEdgeStyle;" edge="1" parent="1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).routing).toBe('isometric');
  });

  it('should parse orthogonal + curved=1 as routing=orthogonalCurved', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="e6" style="edgeStyle=orthogonalEdgeStyle;curved=1;" edge="1" parent="1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).routing).toBe('orthogonalCurved');
  });

  it('should leave routing undefined when no edgeStyle present', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="e7" style="" edge="1" parent="1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).routing).toBeUndefined();
  });
});

// ── Import: startArrow/endArrow → arrowheads ──────────────

describe('Import: startArrow/endArrow → arrowheads (#150)', () => {
  it('should parse endArrow=classic as endArrowhead=classic', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="a1" style="endArrow=classic;" edge="1" parent="1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).endArrowhead).toBe('classic');
  });

  it('should parse startArrow=ERone as startArrowhead=ERone', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="a2" style="startArrow=ERone;" edge="1" parent="1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).startArrowhead).toBe('ERone');
  });

  it('should parse endArrow=none with startArrow=classic as arrow (not line)', () => {
    // When startArrow is set, endArrow=none should not demote to 'line'
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="a3" style="startArrow=classic;endArrow=none;" edge="1" parent="1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(result[0]!.kind).toBe('arrow');
    expect(getArrowData(result[0]!).startArrowhead).toBe('classic');
    expect(getArrowData(result[0]!).endArrowhead).toBe('none');
  });
});

// ── Import: fill flags ────────────────────────────────────

describe('Import: fill flags (#150)', () => {
  it('should parse startFill=0 as startFill=false', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="f1" style="startFill=0;" edge="1" parent="1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).startFill).toBe(false);
  });

  it('should parse endFill=1 as endFill=true', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="f2" style="endFill=1;" edge="1" parent="1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).endFill).toBe(true);
  });
});

// ── Import: curved / rounded / jettySize ──────────────────

describe('Import: curved/rounded/jettySize (#150)', () => {
  it('should parse curved=1 as curved=true (non-orthogonal context)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="c1" style="edgeStyle=curvedEdgeStyle;curved=1;" edge="1" parent="1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    // When edgeStyle is curvedEdgeStyle, routing=curved; curved flag is separate
    expect(getArrowData(result[0]!).routing).toBe('curved');
  });

  it('should parse rounded=1 as rounded=true', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="c2" style="rounded=1;" edge="1" parent="1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).rounded).toBe(true);
  });

  it('should parse jettySize=20 as jettySize=20', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="c3" style="jettySize=20;" edge="1" parent="1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).jettySize).toBe(20);
  });

  it('should parse jettySize=auto as jettySize=auto', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="c4" style="jettySize=auto;" edge="1" parent="1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).jettySize).toBe('auto');
  });
});

// ── Import: exit/entry points → binding ports ─────────────

describe('Import: exit/entry → binding ports (#150)', () => {
  it('should parse exitX/exitY to startBinding portX/portY', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="p1" style="exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" parent="1" source="s1" target="s2">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    const data = getArrowData(result[0]!);
    expect(data.startBinding).toBeDefined();
    expect(data.startBinding!.portX).toBe(1);
    expect(data.startBinding!.portY).toBe(0.5);
    expect(data.endBinding).toBeDefined();
    expect(data.endBinding!.portX).toBe(0);
    expect(data.endBinding!.portY).toBe(0.5);
  });

  it('should create bindings from exit/entry even without source/target attrs if source/target present', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="p2" style="exitX=0.5;exitY=1;" edge="1" parent="1" source="src1">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    const data = getArrowData(result[0]!);
    expect(data.startBinding).toBeDefined();
    expect(data.startBinding!.portX).toBe(0.5);
    expect(data.startBinding!.portY).toBe(1);
  });
});

// ── Round-trip: routing modes ─────────────────────────────

describe('Round-trip: routing modes (#150)', () => {
  const routingModes: RoutingMode[] = [
    'orthogonal',
    'curved',
    'elbow',
    'entityRelation',
    'isometric',
    'orthogonalCurved',
  ];

  it.each(routingModes)('should round-trip routing=%s', (mode) => {
    const arrow = makeArrow(`rt-${mode}`, { routing: mode });
    const xml = expressionsToDrawio([arrow]);
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect(getArrowData(result[0]!).routing).toBe(mode);
  });

  it('should round-trip routing=straight (undefined on import since it is the default)', () => {
    const arrow = makeArrow('rt-straight', { routing: 'straight' });
    const xml = expressionsToDrawio([arrow]);
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    // straight is the default — no edgeStyle emitted, so import leaves it undefined
    expect(getArrowData(result[0]!).routing).toBeUndefined();
  });
});

// ── Round-trip: arrowhead types ───────────────────────────

describe('Round-trip: arrowhead types (#150)', () => {
  // All draw.io-native arrowhead types that should round-trip exactly
  const directArrowheads: ArrowheadType[] = [
    // 'none' excluded — when endArrowhead='none' is the only arrow property,
    // it's indistinguishable from a line on import (expected behavior)
    'classic',
    'classicThin',
    'open',
    'openThin',
    'block',
    'blockThin',
    'oval',
    'diamond',
    'diamondThin',
    'ERone',
    'ERmany',
    'ERmandOne',
    'ERoneToMany',
    'ERzeroToOne',
    'ERzeroToMany',
    'openAsync',
    'dash',
    'cross',
    'box',
    'halfCircle',
    'doubleBlock',
  ];

  it.each(directArrowheads)('should round-trip endArrowhead=%s', (type) => {
    const arrow = makeArrow(`rt-ah-${type}`, { endArrowhead: type });
    const xml = expressionsToDrawio([arrow]);
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect(getArrowData(result[0]!).endArrowhead).toBe(type);
  });

  it('should round-trip endArrowhead=none when paired with startArrow', () => {
    // 'none' by itself is ambiguous with line, but paired with startArrow it round-trips
    const arrow = makeArrow('rt-ah-none', {
      startArrowhead: 'classic',
      endArrowhead: 'none',
    });
    const xml = expressionsToDrawio([arrow]);
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('arrow');
    expect(getArrowData(result[0]!).endArrowhead).toBe('none');
    expect(getArrowData(result[0]!).startArrowhead).toBe('classic');
  });

  it.each(directArrowheads)('should round-trip startArrowhead=%s', (type) => {
    const arrow = makeArrow(`rt-sah-${type}`, { startArrowhead: type });
    const xml = expressionsToDrawio([arrow]);
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect(getArrowData(result[0]!).startArrowhead).toBe(type);
  });
});

// ── Round-trip: ER arrowheads with fill flags ─────────────

describe('Round-trip: ER arrowheads with fill flags (#150)', () => {
  it('should round-trip ER connector with fill flags', () => {
    const arrow = makeArrow('rt-er', {
      startArrowhead: 'ERone',
      endArrowhead: 'ERmany',
      startFill: false,
      endFill: true,
    });
    const xml = expressionsToDrawio([arrow]);
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    const data = getArrowData(result[0]!);
    expect(data.startArrowhead).toBe('ERone');
    expect(data.endArrowhead).toBe('ERmany');
    expect(data.startFill).toBe(false);
    expect(data.endFill).toBe(true);
  });
});

// ── Round-trip: curved/rounded/jettySize ──────────────────

describe('Round-trip: curved/rounded/jettySize (#150)', () => {
  it('should round-trip curved=true', () => {
    const arrow = makeArrow('rt-curved', { curved: true });
    const xml = expressionsToDrawio([arrow]);
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).curved).toBe(true);
  });

  it('should round-trip rounded=true', () => {
    const arrow = makeArrow('rt-rounded', { rounded: true });
    const xml = expressionsToDrawio([arrow]);
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).rounded).toBe(true);
  });

  it('should round-trip jettySize=20', () => {
    const arrow = makeArrow('rt-jetty', { jettySize: 20 });
    const xml = expressionsToDrawio([arrow]);
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).jettySize).toBe(20);
  });

  it('should round-trip jettySize=auto', () => {
    const arrow = makeArrow('rt-jetty-auto', { jettySize: 'auto' });
    const xml = expressionsToDrawio([arrow]);
    const result = drawioToExpressions(xml);
    expect(getArrowData(result[0]!).jettySize).toBe('auto');
  });
});

// ── Round-trip: binding ports ─────────────────────────────

describe('Round-trip: binding ports (#150)', () => {
  it('should round-trip binding ports through exitX/exitY/entryX/entryY', () => {
    const arrow = makeArrow('rt-ports', {
      startBinding: { expressionId: 'box-a', anchor: 'auto', portX: 1.0, portY: 0.5 },
      endBinding: { expressionId: 'box-b', anchor: 'auto', portX: 0, portY: 0.5 },
    });
    const xml = expressionsToDrawio([arrow]);
    const result = drawioToExpressions(xml);
    const data = getArrowData(result[0]!);
    expect(data.startBinding?.expressionId).toBe('box-a');
    expect(data.startBinding?.portX).toBe(1);
    expect(data.startBinding?.portY).toBe(0.5);
    expect(data.endBinding?.expressionId).toBe('box-b');
    expect(data.endBinding?.portX).toBe(0);
    expect(data.endBinding?.portY).toBe(0.5);
  });
});

// ── Round-trip: full complex connector ────────────────────

describe('Round-trip: full complex connector (#150)', () => {
  it('should round-trip a fully-configured ER connector', () => {
    const arrow = makeArrow('rt-full', {
      routing: 'orthogonal',
      startArrowhead: 'ERmandOne',
      endArrowhead: 'ERzeroToMany',
      startFill: false,
      endFill: false,
      rounded: true,
      jettySize: 15,
      label: 'has many',
      startBinding: { expressionId: 'entity-a', anchor: 'right', portX: 1.0, portY: 0.5 },
      endBinding: { expressionId: 'entity-b', anchor: 'left', portX: 0, portY: 0.5 },
    });
    const xml = expressionsToDrawio([arrow]);
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    const data = getArrowData(result[0]!);
    expect(data.routing).toBe('orthogonal');
    expect(data.startArrowhead).toBe('ERmandOne');
    expect(data.endArrowhead).toBe('ERzeroToMany');
    expect(data.startFill).toBe(false);
    expect(data.endFill).toBe(false);
    expect(data.rounded).toBe(true);
    expect(data.jettySize).toBe(15);
    expect(data.label).toBe('has many');
    expect(data.startBinding?.expressionId).toBe('entity-a');
    expect(data.startBinding?.portX).toBe(1);
    expect(data.endBinding?.expressionId).toBe('entity-b');
    expect(data.endBinding?.portX).toBe(0);
  });
});
