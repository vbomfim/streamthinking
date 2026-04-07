/**
 * Tests for the draw.io XML serializer (mxGraphModel ↔ VisualExpression).
 *
 * TDD: tests written before implementation per ticket #90.
 */

import { describe, it, expect } from 'vitest';
import type { VisualExpression } from '../schema/expressions.js';
import type { ExpressionStyle } from '../schema/metadata.js';
import { DEFAULT_EXPRESSION_STYLE } from '../schema/metadata.js';
import { expressionsToDrawio, drawioToExpressions } from '../drawio/serializer.js';

// ── Test helpers ───────────────────────────────────────────

const humanAuthor = { type: 'human' as const, id: 'user-1', name: 'Alice' };

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

function makeExpression(
  overrides: Partial<VisualExpression> & { data: VisualExpression['data'] },
): VisualExpression {
  const now = Date.now();
  return {
    id: overrides.id ?? 'expr-1',
    kind: overrides.data.kind,
    position: overrides.position ?? { x: 0, y: 0 },
    size: overrides.size ?? { width: 100, height: 100 },
    angle: overrides.angle ?? 0,
    style: overrides.style ?? { ...baseStyle },
    meta: overrides.meta ?? {
      author: humanAuthor,
      createdAt: now,
      updatedAt: now,
      tags: [],
      locked: false,
    },
    parentId: overrides.parentId,
    children: overrides.children,
    data: overrides.data,
  };
}

// ── Export tests ───────────────────────────────────────────

describe('expressionsToDrawio', () => {
  it('should produce a valid mxGraphModel XML wrapper', () => {
    const xml = expressionsToDrawio([]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<mxGraphModel>');
    expect(xml).toContain('</mxGraphModel>');
    expect(xml).toContain('<root>');
    // root cells 0 and 1 must always be present
    expect(xml).toContain('<mxCell id="0"/>');
    expect(xml).toContain('<mxCell id="1" parent="0"/>');
  });

  it('should export a rectangle as a vertex mxCell with geometry', () => {
    const rect = makeExpression({
      id: 'rect-1',
      position: { x: 100, y: 200 },
      size: { width: 120, height: 60 },
      data: { kind: 'rectangle', label: 'Hello' },
    });
    const xml = expressionsToDrawio([rect]);

    expect(xml).toContain('id="rect-1"');
    expect(xml).toContain('value="Hello"');
    expect(xml).toContain('vertex="1"');
    expect(xml).toContain('parent="1"');
    expect(xml).toContain('x="100"');
    expect(xml).toContain('y="200"');
    expect(xml).toContain('width="120"');
    expect(xml).toContain('height="60"');
  });

  it('should export an ellipse with ellipse style', () => {
    const ellipse = makeExpression({
      id: 'ell-1',
      data: { kind: 'ellipse', label: 'Circle' },
    });
    const xml = expressionsToDrawio([ellipse]);

    expect(xml).toContain('id="ell-1"');
    expect(xml).toContain('ellipse');
    expect(xml).toContain('vertex="1"');
  });

  it('should export a diamond with rhombus style', () => {
    const diamond = makeExpression({
      id: 'dia-1',
      data: { kind: 'diamond', label: 'Decision' },
    });
    const xml = expressionsToDrawio([diamond]);

    expect(xml).toContain('id="dia-1"');
    expect(xml).toContain('rhombus');
    expect(xml).toContain('vertex="1"');
  });

  it('should export a text expression with text style and value', () => {
    const text = makeExpression({
      id: 'txt-1',
      position: { x: 50, y: 75 },
      size: { width: 200, height: 50 },
      data: {
        kind: 'text',
        text: 'Hello World',
        fontSize: 16,
        fontFamily: 'Arial',
        textAlign: 'center',
      },
    });
    const xml = expressionsToDrawio([text]);

    expect(xml).toContain('id="txt-1"');
    expect(xml).toContain('value="Hello World"');
    expect(xml).toContain('text;');
    expect(xml).toContain('fontSize=16');
    expect(xml).toContain('fontFamily=Arial');
    expect(xml).toContain('align=center');
  });

  it('should export a sticky note with shape=note style', () => {
    const sticky = makeExpression({
      id: 'sticky-1',
      data: { kind: 'sticky-note', text: 'Remember this', color: '#FFEB3B' },
    });
    const xml = expressionsToDrawio([sticky]);

    expect(xml).toContain('id="sticky-1"');
    expect(xml).toContain('value="Remember this"');
    expect(xml).toContain('shape=note');
    expect(xml).toContain('fillColor=#FFEB3B');
  });

  it('should export an arrow as an edge mxCell with waypoints', () => {
    const arrow = makeExpression({
      id: 'arrow-1',
      data: {
        kind: 'arrow',
        points: [[0, 0], [100, 50], [200, 100]],
        label: 'flow',
      },
    });
    const xml = expressionsToDrawio([arrow]);

    expect(xml).toContain('id="arrow-1"');
    expect(xml).toContain('edge="1"');
    expect(xml).toContain('value="flow"');
    // Waypoints (intermediate points) should be in an Array element
    expect(xml).toContain('<Array as="points">');
    expect(xml).toContain('<mxPoint x="100" y="50"/>');
  });

  it('should export an arrow with source/target bindings', () => {
    const arrow = makeExpression({
      id: 'arrow-bound',
      data: {
        kind: 'arrow',
        points: [[0, 0], [100, 100]],
        startBinding: { expressionId: 'rect-1', anchor: 'right' },
        endBinding: { expressionId: 'rect-2', anchor: 'left' },
      },
    });
    const xml = expressionsToDrawio([arrow]);

    expect(xml).toContain('source="rect-1"');
    expect(xml).toContain('target="rect-2"');
  });

  it('should export a line as an edge mxCell without arrowheads', () => {
    const line = makeExpression({
      id: 'line-1',
      data: {
        kind: 'line',
        points: [[0, 0], [150, 75]],
      },
    });
    const xml = expressionsToDrawio([line]);

    expect(xml).toContain('id="line-1"');
    expect(xml).toContain('edge="1"');
    expect(xml).toContain('endArrow=none');
  });

  it('should export a stencil with appropriate style', () => {
    const stencil = makeExpression({
      id: 'stencil-1',
      data: {
        kind: 'stencil',
        stencilId: 'server',
        category: 'generic-it',
        label: 'Web Server',
      },
    });
    const xml = expressionsToDrawio([stencil]);

    expect(xml).toContain('id="stencil-1"');
    expect(xml).toContain('value="Web Server"');
    expect(xml).toContain('vertex="1"');
    expect(xml).toContain('shape=mxgraph.server');
  });

  it('should map style properties correctly', () => {
    const styled = makeExpression({
      id: 'styled-1',
      style: {
        ...baseStyle,
        backgroundColor: '#dae8fc',
        strokeColor: '#6c8ebf',
        strokeWidth: 3,
        opacity: 0.8,
        strokeStyle: 'dashed',
        fontSize: 14,
        fontFamily: 'Arial',
      },
      data: { kind: 'rectangle', label: 'Styled' },
    });
    const xml = expressionsToDrawio([styled]);

    expect(xml).toContain('fillColor=#dae8fc');
    expect(xml).toContain('strokeColor=#6c8ebf');
    expect(xml).toContain('strokeWidth=3');
    expect(xml).toContain('opacity=80'); // 0.8 * 100
    expect(xml).toContain('dashed=1');
    expect(xml).toContain('fontSize=14');
    expect(xml).toContain('fontFamily=Arial');
  });

  it('should handle transparent background as no fillColor', () => {
    const noFill = makeExpression({
      id: 'nofill-1',
      style: { ...baseStyle, backgroundColor: 'transparent', fillStyle: 'none' },
      data: { kind: 'rectangle' },
    });
    const xml = expressionsToDrawio([noFill]);

    expect(xml).toContain('fillColor=none');
  });

  it('should export multiple expressions as multiple mxCells', () => {
    const rect = makeExpression({
      id: 'r1',
      data: { kind: 'rectangle', label: 'A' },
    });
    const ellipse = makeExpression({
      id: 'e1',
      data: { kind: 'ellipse', label: 'B' },
    });
    const xml = expressionsToDrawio([rect, ellipse]);

    expect(xml).toContain('id="r1"');
    expect(xml).toContain('id="e1"');
    expect(xml).toContain('value="A"');
    expect(xml).toContain('value="B"');
  });

  it('should escape XML special characters in labels', () => {
    const expr = makeExpression({
      id: 'esc-1',
      data: { kind: 'rectangle', label: 'A & B <"test">' },
    });
    const xml = expressionsToDrawio([expr]);

    expect(xml).toContain('A &amp; B &lt;&quot;test&quot;&gt;');
    // Must be valid XML — no raw <, >, &, or " in attribute values
    expect(xml).not.toContain('value="A & B');
  });
});

// ── Import tests ───────────────────────────────────────────

describe('drawioToExpressions', () => {
  it('should parse a vertex mxCell as a rectangle by default', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="r1" value="Hello" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="100" y="200" width="120" height="60" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);

    const expr = result[0]!;
    expect(expr.kind).toBe('rectangle');
    expect(expr.id).toBe('r1');
    expect(expr.position).toEqual({ x: 100, y: 200 });
    expect(expr.size).toEqual({ width: 120, height: 60 });
    expect((expr.data as { label?: string }).label).toBe('Hello');
  });

  it('should parse an ellipse vertex from style', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="e1" value="Circle" style="ellipse;whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="50" y="50" width="80" height="80" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('ellipse');
    expect((result[0]!.data as { label?: string }).label).toBe('Circle');
  });

  it('should parse a rhombus vertex as a diamond', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="d1" value="Decision?" style="rhombus;whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="0" y="0" width="100" height="100" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('diamond');
  });

  it('should parse a text vertex from style', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="t1" value="Some text" style="text;html=1;fontSize=18;fontFamily=Arial;align=center;" vertex="1" parent="1">
      <mxGeometry x="10" y="20" width="200" height="40" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);

    const expr = result[0]!;
    expect(expr.kind).toBe('text');
    expect((expr.data as { text: string }).text).toBe('Some text');
    expect((expr.data as { fontSize: number }).fontSize).toBe(18);
    expect((expr.data as { fontFamily: string }).fontFamily).toBe('Arial');
    expect((expr.data as { textAlign: string }).textAlign).toBe('center');
  });

  it('should parse a note vertex as a sticky-note', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="s1" value="Todo" style="shape=note;fillColor=#FFEB3B;" vertex="1" parent="1">
      <mxGeometry x="0" y="0" width="200" height="200" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);

    const expr = result[0]!;
    expect(expr.kind).toBe('sticky-note');
    expect((expr.data as { text: string }).text).toBe('Todo');
    expect((expr.data as { color: string }).color).toBe('#FFEB3B');
  });

  it('should parse an edge mxCell as an arrow', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="a1" value="flow" style="" edge="1" parent="1" source="r1" target="r2">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="150" y="100"/>
        </Array>
      </mxGeometry>
    </mxCell>
  </root>
</mxGraphModel>`;

    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);

    const expr = result[0]!;
    expect(expr.kind).toBe('arrow');
    expect((expr.data as { label?: string }).label).toBe('flow');
    expect((expr.data as { startBinding?: object }).startBinding).toEqual({
      expressionId: 'r1',
      anchor: 'auto',
    });
    expect((expr.data as { endBinding?: object }).endBinding).toEqual({
      expressionId: 'r2',
      anchor: 'auto',
    });
  });

  it('should parse an edge with endArrow=none as a line', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="l1" style="endArrow=none;" edge="1" parent="1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="0" y="0" as="sourcePoint"/>
        <mxPoint x="100" y="100" as="targetPoint"/>
      </mxGeometry>
    </mxCell>
  </root>
</mxGraphModel>`;

    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('line');
  });

  it('should parse style string properties into ExpressionStyle', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="s1" value="Styled" style="fillColor=#dae8fc;strokeColor=#6c8ebf;strokeWidth=3;opacity=80;dashed=1;fontSize=14;fontFamily=Arial;" vertex="1" parent="1">
      <mxGeometry x="0" y="0" width="100" height="100" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

    const result = drawioToExpressions(xml);
    const style = result[0]!.style;

    expect(style.backgroundColor).toBe('#dae8fc');
    expect(style.strokeColor).toBe('#6c8ebf');
    expect(style.strokeWidth).toBe(3);
    expect(style.opacity).toBeCloseTo(0.8); // 80/100
    expect(style.strokeStyle).toBe('dashed');
    expect(style.fontSize).toBe(14);
    expect(style.fontFamily).toBe('Arial');
  });

  it('should handle mxCells without geometry gracefully', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="x1" value="NoGeo" style="" vertex="1" parent="1"/>
  </root>
</mxGraphModel>`;

    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect(result[0]!.position).toEqual({ x: 0, y: 0 });
    expect(result[0]!.size).toEqual({ width: 100, height: 100 });
  });

  it('should skip root infrastructure cells (id 0 and 1)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
  </root>
</mxGraphModel>`;

    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(0);
  });

  it('should parse multiple mxCells into multiple expressions', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="a" value="A" style="" vertex="1" parent="1">
      <mxGeometry x="0" y="0" width="100" height="100" as="geometry"/>
    </mxCell>
    <mxCell id="b" value="B" style="ellipse;" vertex="1" parent="1">
      <mxGeometry x="200" y="0" width="100" height="100" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('a');
    expect(result[1]!.id).toBe('b');
  });

  it('should unescape XML entities in values', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="u1" value="A &amp; B &lt;&quot;test&quot;&gt;" style="" vertex="1" parent="1">
      <mxGeometry x="0" y="0" width="100" height="100" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

    const result = drawioToExpressions(xml);
    expect((result[0]!.data as { label?: string }).label).toBe('A & B <"test">');
  });
});

// ── Round-trip tests ───────────────────────────────────────

describe('round-trip fidelity', () => {
  it('should preserve rectangle data through export → import', () => {
    const original = makeExpression({
      id: 'rt-rect',
      position: { x: 100, y: 200 },
      size: { width: 120, height: 60 },
      style: {
        ...baseStyle,
        backgroundColor: '#dae8fc',
        strokeColor: '#6c8ebf',
      },
      data: { kind: 'rectangle', label: 'Round Trip' },
    });

    const xml = expressionsToDrawio([original]);
    const result = drawioToExpressions(xml);

    expect(result).toHaveLength(1);
    const imported = result[0]!;

    expect(imported.kind).toBe('rectangle');
    expect(imported.position).toEqual({ x: 100, y: 200 });
    expect(imported.size).toEqual({ width: 120, height: 60 });
    expect((imported.data as { label?: string }).label).toBe('Round Trip');
    expect(imported.style.backgroundColor).toBe('#dae8fc');
    expect(imported.style.strokeColor).toBe('#6c8ebf');
  });

  it('should preserve ellipse data through export → import', () => {
    const original = makeExpression({
      id: 'rt-ell',
      position: { x: 50, y: 50 },
      size: { width: 80, height: 80 },
      data: { kind: 'ellipse', label: 'Ellipse RT' },
    });

    const xml = expressionsToDrawio([original]);
    const result = drawioToExpressions(xml);

    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('ellipse');
    expect((result[0]!.data as { label?: string }).label).toBe('Ellipse RT');
  });

  it('should preserve diamond data through export → import', () => {
    const original = makeExpression({
      id: 'rt-dia',
      data: { kind: 'diamond', label: 'Diamond RT' },
    });

    const xml = expressionsToDrawio([original]);
    const result = drawioToExpressions(xml);

    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('diamond');
  });

  it('should preserve text data through export → import', () => {
    const original = makeExpression({
      id: 'rt-txt',
      data: {
        kind: 'text',
        text: 'Hello World',
        fontSize: 18,
        fontFamily: 'Helvetica',
        textAlign: 'center',
      },
    });

    const xml = expressionsToDrawio([original]);
    const result = drawioToExpressions(xml);

    expect(result).toHaveLength(1);
    const data = result[0]!.data as { text: string; fontSize: number; fontFamily: string; textAlign: string };
    expect(data.text).toBe('Hello World');
    expect(data.fontSize).toBe(18);
    expect(data.fontFamily).toBe('Helvetica');
    expect(data.textAlign).toBe('center');
  });

  it('should preserve sticky-note data through export → import', () => {
    const original = makeExpression({
      id: 'rt-sticky',
      data: { kind: 'sticky-note', text: 'Note content', color: '#FF9800' },
    });

    const xml = expressionsToDrawio([original]);
    const result = drawioToExpressions(xml);

    expect(result).toHaveLength(1);
    const data = result[0]!.data as { text: string; color: string };
    expect(data.text).toBe('Note content');
    expect(data.color).toBe('#FF9800');
  });

  it('should preserve style properties through export → import', () => {
    const original = makeExpression({
      id: 'rt-style',
      style: {
        ...baseStyle,
        backgroundColor: '#d5e8d4',
        strokeColor: '#82b366',
        strokeWidth: 3,
        opacity: 0.7,
        strokeStyle: 'dashed',
        fontSize: 16,
        fontFamily: 'Courier New',
      },
      data: { kind: 'rectangle', label: 'Styled' },
    });

    const xml = expressionsToDrawio([original]);
    const result = drawioToExpressions(xml);

    const style = result[0]!.style;
    expect(style.backgroundColor).toBe('#d5e8d4');
    expect(style.strokeColor).toBe('#82b366');
    expect(style.strokeWidth).toBe(3);
    expect(style.opacity).toBeCloseTo(0.7);
    expect(style.strokeStyle).toBe('dashed');
    expect(style.fontSize).toBe(16);
    expect(style.fontFamily).toBe('Courier New');
  });

  it('should preserve multiple expressions through export → import', () => {
    const expressions = [
      makeExpression({
        id: 'rt-a',
        position: { x: 0, y: 0 },
        data: { kind: 'rectangle', label: 'A' },
      }),
      makeExpression({
        id: 'rt-b',
        position: { x: 200, y: 0 },
        data: { kind: 'ellipse', label: 'B' },
      }),
      makeExpression({
        id: 'rt-c',
        position: { x: 100, y: 150 },
        data: { kind: 'diamond', label: 'C' },
      }),
    ];

    const xml = expressionsToDrawio(expressions);
    const result = drawioToExpressions(xml);

    expect(result).toHaveLength(3);
    expect(result.map((e) => e.kind)).toEqual(['rectangle', 'ellipse', 'diamond']);
    expect(result.map((e) => (e.data as { label?: string }).label)).toEqual(['A', 'B', 'C']);
  });

  it('should handle an arrow round-trip with bindings', () => {
    const arrow = makeExpression({
      id: 'rt-arrow',
      data: {
        kind: 'arrow',
        points: [[0, 0], [100, 100]],
        label: 'connects',
        startBinding: { expressionId: 'src', anchor: 'right' },
        endBinding: { expressionId: 'tgt', anchor: 'left' },
      },
    });

    const xml = expressionsToDrawio([arrow]);
    const result = drawioToExpressions(xml);

    expect(result).toHaveLength(1);
    const data = result[0]!.data as {
      label?: string;
      startBinding?: { expressionId: string };
      endBinding?: { expressionId: string };
    };
    expect(data.label).toBe('connects');
    expect(data.startBinding?.expressionId).toBe('src');
    expect(data.endBinding?.expressionId).toBe('tgt');
  });
});
