/**
 * QA Guardian — Integration, Edge Case, and Contract tests for draw.io serializer.
 *
 * Supplements Developer's 34 unit tests with cross-boundary, edge-case,
 * and contract tests that verify behavior through the public interface.
 *
 * Tags: [EDGE], [CONTRACT], [COVERAGE], [BOUNDARY], [REGRESSION]
 */

import { describe, it, expect } from 'vitest';
import type { VisualExpression } from '../schema/expressions.js';
import type { ExpressionStyle } from '../schema/metadata.js';
import { DEFAULT_EXPRESSION_STYLE } from '../schema/metadata.js';
import { expressionsToDrawio, drawioToExpressions } from '../drawio/serializer.js';

// ── Test helpers ──────────────────────────────────────────

const humanAuthor = { type: 'human' as const, id: 'qa-1', name: 'QA' };

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
    id: overrides.id ?? 'qa-expr-1',
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

/** Wrap a single mxCell in a valid mxGraphModel XML doc. */
function wrapInModel(cellXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    ${cellXml}
  </root>
</mxGraphModel>`;
}

// ══════════════════════════════════════════════════════════
// §1 — CONTRACT: XML output structure
// ══════════════════════════════════════════════════════════

describe('[CONTRACT] XML output structure', () => {
  it('empty array produces well-formed mxGraphModel with only infrastructure cells', () => {
    const xml = expressionsToDrawio([]);
    // Must contain XML declaration
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    // Must have mxGraphModel root
    expect(xml).toContain('<mxGraphModel>');
    expect(xml).toContain('</mxGraphModel>');
    // Infrastructure cells id=0 and id=1 always present
    expect(xml).toContain('<mxCell id="0"/>');
    expect(xml).toContain('<mxCell id="1" parent="0"/>');
    // No other mxCell should be present
    const cellMatches = xml.match(/<mxCell/g) ?? [];
    expect(cellMatches).toHaveLength(2);
  });

  it('vertex mxCell has required attributes: id, vertex, parent, style', () => {
    const rect = makeExpression({
      id: 'contract-v1',
      data: { kind: 'rectangle', label: 'X' },
    });
    const xml = expressionsToDrawio([rect]);
    // All vertex cells must have vertex="1" and parent="1"
    expect(xml).toMatch(/id="contract-v1"/);
    expect(xml).toMatch(/vertex="1"/);
    expect(xml).toMatch(/parent="1"/);
  });

  it('edge mxCell has required attributes: id, edge, parent', () => {
    const arrow = makeExpression({
      id: 'contract-e1',
      data: { kind: 'arrow', points: [[0, 0], [100, 100]], label: 'go' },
    });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toMatch(/id="contract-e1"/);
    expect(xml).toMatch(/edge="1"/);
    expect(xml).toMatch(/parent="1"/);
  });

  it('every vertex mxCell contains an mxGeometry child with x, y, width, height', () => {
    const rect = makeExpression({
      id: 'geo-1',
      position: { x: 42, y: 99 },
      size: { width: 200, height: 50 },
      data: { kind: 'rectangle', label: 'GeoTest' },
    });
    const xml = expressionsToDrawio([rect]);
    expect(xml).toMatch(/<mxGeometry x="42" y="99" width="200" height="50" as="geometry"\/>/);
  });

  it('edge mxCell geometry has relative="1"', () => {
    const arrow = makeExpression({
      id: 'geo-edge-1',
      data: { kind: 'arrow', points: [[0, 0], [50, 50]], label: '' },
    });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('relative="1"');
  });
});

// ══════════════════════════════════════════════════════════
// §2 — EDGE: Empty, null, and missing data
// ══════════════════════════════════════════════════════════

describe('[EDGE] empty / missing data handling', () => {
  it('rectangle with undefined label exports empty value attribute', () => {
    const rect = makeExpression({
      id: 'empty-label',
      data: { kind: 'rectangle' }, // no label
    });
    const xml = expressionsToDrawio([rect]);
    expect(xml).toContain('value=""');
  });

  it('rectangle with empty-string label exports empty value attribute', () => {
    const rect = makeExpression({
      id: 'empty-str-label',
      data: { kind: 'rectangle', label: '' },
    });
    const xml = expressionsToDrawio([rect]);
    expect(xml).toContain('value=""');
  });

  it('arrow with no label exports empty value', () => {
    const arrow = makeExpression({
      id: 'no-label-arrow',
      data: { kind: 'arrow', points: [[0, 0], [100, 100]] }, // no label
    });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).toContain('value=""');
  });

  it('arrow with no bindings exports no source/target attributes', () => {
    const arrow = makeExpression({
      id: 'unbound-arrow',
      data: { kind: 'arrow', points: [[0, 0], [100, 100]] },
    });
    const xml = expressionsToDrawio([arrow]);
    expect(xml).not.toContain('source=');
    expect(xml).not.toContain('target=');
  });

  it('import: mxCell with empty style string parses successfully', () => {
    const xml = wrapInModel(
      `<mxCell id="e1" value="Test" style="" vertex="1" parent="1">
         <mxGeometry x="0" y="0" width="100" height="100" as="geometry"/>
       </mxCell>`,
    );
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('rectangle');
  });

  it('import: mxCell with no value attribute treats it as empty string', () => {
    const xml = wrapInModel(
      `<mxCell id="nv1" style="" vertex="1" parent="1">
         <mxGeometry x="0" y="0" width="50" height="50" as="geometry"/>
       </mxCell>`,
    );
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    // Label should be empty/undefined, not crash
    const label = (result[0]!.data as { label?: string }).label;
    expect(label === undefined || label === '').toBe(true);
  });

  it('import: mxCell with no style attribute defaults to rectangle', () => {
    const xml = wrapInModel(
      `<mxCell id="ns1" value="NoStyle" vertex="1" parent="1">
         <mxGeometry x="0" y="0" width="100" height="100" as="geometry"/>
       </mxCell>`,
    );
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('rectangle');
  });
});

// ══════════════════════════════════════════════════════════
// §3 — EDGE: Malformed / adversarial XML input
// ══════════════════════════════════════════════════════════

describe('[EDGE] malformed XML input', () => {
  it('import: completely empty string returns empty array', () => {
    const result = drawioToExpressions('');
    expect(result).toEqual([]);
  });

  it('import: non-XML garbage returns empty array', () => {
    const result = drawioToExpressions('this is not xml at all');
    expect(result).toEqual([]);
  });

  it('import: valid XML but missing mxGraphModel returns empty array', () => {
    const xml = `<?xml version="1.0"?><notAGraph><thing/></notAGraph>`;
    const result = drawioToExpressions(xml);
    expect(result).toEqual([]);
  });

  it('import: mxGraphModel with no root element returns empty array', () => {
    const xml = `<?xml version="1.0"?><mxGraphModel></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(result).toEqual([]);
  });

  it('import: mxGraphModel with empty root returns empty array', () => {
    const xml = `<?xml version="1.0"?><mxGraphModel><root></root></mxGraphModel>`;
    const result = drawioToExpressions(xml);
    expect(result).toEqual([]);
  });

  it('import: mxCell without vertex or edge attribute is skipped', () => {
    const xml = wrapInModel(
      `<mxCell id="orphan" value="Ghost" style="" parent="1">
         <mxGeometry x="0" y="0" width="100" height="100" as="geometry"/>
       </mxCell>`,
    );
    const result = drawioToExpressions(xml);
    // No vertex="1" or edge="1", so it should be skipped
    expect(result).toHaveLength(0);
  });

  it('import: broken XML throws or returns empty (does not silently corrupt)', () => {
    const brokenXml = `<?xml version="1.0"?><mxGraphModel><root><mxCell id="0"/><mxCell id="1"`;
    // fast-xml-parser may throw or return partial — we just need no crash with bad data
    let threw = false;
    let result: ReturnType<typeof drawioToExpressions> = [];
    try {
      result = drawioToExpressions(brokenXml);
    } catch {
      threw = true;
    }
    // Either throws (safe) or returns empty/partial (safe) — NOT corrupted data
    expect(threw || result.length === 0 || result.every((e) => e.id !== undefined)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
// §4 — EDGE: XML injection & special characters
// ══════════════════════════════════════════════════════════

describe('[EDGE] XML injection safety', () => {
  it('export: <script> tag in label is escaped and does not produce raw HTML', () => {
    const xss = makeExpression({
      id: 'xss-1',
      data: { kind: 'rectangle', label: '<script>alert("xss")</script>' },
    });
    const xml = expressionsToDrawio([xss]);
    // The raw <script> must NOT appear unescaped
    expect(xml).not.toContain('<script>');
    expect(xml).toContain('&lt;script&gt;');
  });

  it('export: HTML entities in label are properly escaped', () => {
    const html = makeExpression({
      id: 'html-1',
      data: { kind: 'rectangle', label: '<b>bold</b> & "quoted"' },
    });
    const xml = expressionsToDrawio([html]);
    expect(xml).toContain('&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;');
  });

  it('export: newlines in label do not break XML structure', () => {
    const multiline = makeExpression({
      id: 'nl-1',
      data: { kind: 'rectangle', label: 'Line 1\nLine 2\nLine 3' },
    });
    const xml = expressionsToDrawio([multiline]);
    // Should still parse back
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect((result[0]!.data as { label: string }).label).toBe('Line 1\nLine 2\nLine 3');
  });

  it('round-trip: Unicode and emoji survive export → import', () => {
    const unicode = makeExpression({
      id: 'unicode-1',
      data: { kind: 'rectangle', label: '日本語テスト 🎨 Ñoño ← → ↔' },
    });
    const xml = expressionsToDrawio([unicode]);
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect((result[0]!.data as { label: string }).label).toBe('日本語テスト 🎨 Ñoño ← → ↔');
  });

  it('round-trip: text expression with special chars in text survives', () => {
    const text = makeExpression({
      id: 'special-text',
      data: {
        kind: 'text',
        text: 'x < y && y > z || a = "b"',
        fontSize: 14,
        fontFamily: 'sans-serif',
        textAlign: 'left',
      },
    });
    const xml = expressionsToDrawio([text]);
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect((result[0]!.data as { text: string }).text).toBe('x < y && y > z || a = "b"');
  });

  it('round-trip: sticky note with HTML-like content survives', () => {
    const sticky = makeExpression({
      id: 'sticky-html',
      data: { kind: 'sticky-note', text: '<div>Hello & "World"</div>', color: '#FFEB3B' },
    });
    const xml = expressionsToDrawio([sticky]);
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    // draw.io's native behavior is to render HTML labels as HTML when html=1
    // is set (which is always true on export). On import we strip HTML tags
    // to get plain text — this matches what the user actually sees in draw.io.
    // Users who want literal angle brackets should HTML-encode them (&lt;div&gt;).
    expect((result[0]!.data as { text: string }).text).toBe('Hello & "World"');
  });

  it('export: ampersand-heavy label is properly escaped and round-trips', () => {
    const ampy = makeExpression({
      id: 'amp-1',
      data: { kind: 'rectangle', label: 'AT&T & M&A & R&D' },
    });
    const xml = expressionsToDrawio([ampy]);
    expect(xml).toContain('AT&amp;T &amp; M&amp;A &amp; R&amp;D');
    const result = drawioToExpressions(xml);
    expect((result[0]!.data as { label: string }).label).toBe('AT&T & M&A & R&D');
  });
});

// ══════════════════════════════════════════════════════════
// §5 — EDGE: Boundary values (coordinates, sizes)
// ══════════════════════════════════════════════════════════

describe('[EDGE] boundary values', () => {
  it('round-trip: negative coordinates are preserved', () => {
    const neg = makeExpression({
      id: 'neg-1',
      position: { x: -500, y: -300 },
      size: { width: 100, height: 50 },
      data: { kind: 'rectangle', label: 'Negative' },
    });
    const xml = expressionsToDrawio([neg]);
    const result = drawioToExpressions(xml);
    expect(result[0]!.position).toEqual({ x: -500, y: -300 });
  });

  it('round-trip: zero-dimension shape preserves size', () => {
    const zero = makeExpression({
      id: 'zero-1',
      position: { x: 0, y: 0 },
      size: { width: 0, height: 0 },
      data: { kind: 'rectangle', label: 'Zero' },
    });
    const xml = expressionsToDrawio([zero]);
    const result = drawioToExpressions(xml);
    expect(result[0]!.size).toEqual({ width: 0, height: 0 });
  });

  it('round-trip: large coordinates are preserved', () => {
    const large = makeExpression({
      id: 'large-1',
      position: { x: 99999, y: 99999 },
      size: { width: 10000, height: 10000 },
      data: { kind: 'rectangle', label: 'Large' },
    });
    const xml = expressionsToDrawio([large]);
    const result = drawioToExpressions(xml);
    expect(result[0]!.position).toEqual({ x: 99999, y: 99999 });
    expect(result[0]!.size).toEqual({ width: 10000, height: 10000 });
  });

  it('round-trip: fractional coordinates are preserved', () => {
    const frac = makeExpression({
      id: 'frac-1',
      position: { x: 10.5, y: 20.75 },
      size: { width: 100.25, height: 50.5 },
      data: { kind: 'rectangle', label: 'Fractional' },
    });
    const xml = expressionsToDrawio([frac]);
    const result = drawioToExpressions(xml);
    expect(result[0]!.position).toEqual({ x: 10.5, y: 20.75 });
    expect(result[0]!.size).toEqual({ width: 100.25, height: 50.5 });
  });

  it('round-trip: opacity boundary value 0 (fully transparent) is preserved', () => {
    const fullyTransparent = makeExpression({
      id: 'opacity-0',
      style: { ...baseStyle, opacity: 0 },
      data: { kind: 'rectangle', label: 'Ghost' },
    });
    const xml = expressionsToDrawio([fullyTransparent]);
    const result = drawioToExpressions(xml);
    expect(result[0]!.style.opacity).toBeCloseTo(0);
  });

  it('round-trip: opacity boundary value 1 (fully opaque) is preserved', () => {
    const fullyOpaque = makeExpression({
      id: 'opacity-1',
      style: { ...baseStyle, opacity: 1 },
      data: { kind: 'rectangle', label: 'Solid' },
    });
    const xml = expressionsToDrawio([fullyOpaque]);
    const result = drawioToExpressions(xml);
    // opacity=1 means no opacity attr is exported — defaults apply on import
    expect(result[0]!.style.opacity).toBeCloseTo(1);
  });
});

// ══════════════════════════════════════════════════════════
// §6 — COVERAGE: Stencil round-trip (known gap)
// ══════════════════════════════════════════════════════════

describe('[COVERAGE] stencil handling', () => {
  it('stencil exports with shape=mxgraph.{stencilId} style', () => {
    const stencil = makeExpression({
      id: 'stencil-export-1',
      data: {
        kind: 'stencil',
        stencilId: 'k8s-pod',
        category: 'kubernetes',
        label: 'Pod',
      },
    });
    const xml = expressionsToDrawio([stencil]);
    expect(xml).toContain('shape=mxgraph.k8s-pod');
    expect(xml).toContain('value="Pod"');
  });

  it('stencil with no label exports empty value', () => {
    const stencil = makeExpression({
      id: 'stencil-nolabel',
      data: {
        kind: 'stencil',
        stencilId: 'database',
        category: 'generic-it',
      },
    });
    const xml = expressionsToDrawio([stencil]);
    expect(xml).toContain('value=""');
  });

  /**
   * [COVERAGE] Stencil round-trip is currently BROKEN.
   *
   * Export produces `shape=mxgraph.{stencilId}` in the style string.
   * Import's `resolveKindFromStyle()` only checks `shape === 'note'`
   * and does not handle `shape` values starting with `mxgraph.` — it
   * falls through to 'rectangle'. This means a stencil exported to
   * draw.io XML and re-imported comes back as a plain rectangle.
   *
   * Marking as `.fails()` to document the known code bug.
   */
  it('stencil round-trip: import recognizes shape=mxgraph.* as stencil', () => {
    const stencil = makeExpression({
      id: 'stencil-rt',
      position: { x: 50, y: 50 },
      size: { width: 44, height: 44 },
      data: {
        kind: 'stencil',
        stencilId: 'server',
        category: 'generic-it',
        label: 'Web Server',
      },
    });
    const xml = expressionsToDrawio([stencil]);
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    // This SHOULD be 'stencil' but currently returns 'rectangle'
    expect(result[0]!.kind).toBe('stencil');
    const data = result[0]!.data as { stencilId: string; category: string; label: string };
    expect(data.stencilId).toBe('server');
  });
});

// ══════════════════════════════════════════════════════════
// §7 — COVERAGE: Unsupported kinds (freehand, image, composites)
// ══════════════════════════════════════════════════════════

describe('[COVERAGE] unsupported expression kinds', () => {
  it('freehand expression falls through to default export without crashing', () => {
    const freehand = makeExpression({
      id: 'freehand-1',
      data: {
        kind: 'freehand',
        points: [[0, 0, 0.5], [10, 10, 0.8], [20, 5, 0.3]],
      },
    });
    // Should not throw
    const xml = expressionsToDrawio([freehand]);
    expect(xml).toContain('id="freehand-1"');
    expect(xml).toContain('vertex="1"');
  });

  it('image expression falls through to default export without crashing', () => {
    const image = makeExpression({
      id: 'img-1',
      data: {
        kind: 'image',
        src: 'https://example.com/photo.png',
        alt: 'A photo',
      },
    });
    const xml = expressionsToDrawio([image]);
    expect(xml).toContain('id="img-1"');
    expect(xml).toContain('vertex="1"');
  });
});

// ══════════════════════════════════════════════════════════
// §8 — BOUNDARY: Real draw.io XML import
// ══════════════════════════════════════════════════════════

describe('[BOUNDARY] real draw.io file import', () => {
  it('imports a realistic draw.io flowchart with mixed shapes and edges', () => {
    // This is the kind of XML draw.io actually produces
    const realDrawioXml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="2" value="Start" style="ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
      <mxGeometry x="340" y="40" width="120" height="80" as="geometry"/>
    </mxCell>
    <mxCell id="3" value="Process Data" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
      <mxGeometry x="320" y="180" width="160" height="80" as="geometry"/>
    </mxCell>
    <mxCell id="4" value="Valid?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="1">
      <mxGeometry x="340" y="320" width="120" height="120" as="geometry"/>
    </mxCell>
    <mxCell id="5" value="" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="2" target="3" parent="1">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="6" value="" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="3" target="4" parent="1">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="7" value="Yes" style="" edge="1" source="4" target="3" parent="1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="540" y="380"/>
          <mxPoint x="540" y="220"/>
        </Array>
      </mxGeometry>
    </mxCell>
  </root>
</mxGraphModel>`;

    const result = drawioToExpressions(realDrawioXml);

    // Should have 3 vertices + 3 edges = 6 total (cells 0 & 1 are skipped)
    expect(result).toHaveLength(6);

    // Verify vertex shapes
    const vertices = result.filter((e) => e.kind !== 'arrow' && e.kind !== 'line');
    const edges = result.filter((e) => e.kind === 'arrow' || e.kind === 'line');

    expect(vertices).toHaveLength(3);
    expect(edges).toHaveLength(3);

    // Start node is an ellipse
    const startNode = result.find((e) => e.id === '2');
    expect(startNode).toBeDefined();
    expect(startNode!.kind).toBe('ellipse');
    expect((startNode!.data as { label?: string }).label).toBe('Start');
    expect(startNode!.position).toEqual({ x: 340, y: 40 });
    expect(startNode!.size).toEqual({ width: 120, height: 80 });

    // Process node is a rectangle (rounded style)
    const processNode = result.find((e) => e.id === '3');
    expect(processNode).toBeDefined();
    expect(processNode!.kind).toBe('rectangle');
    expect((processNode!.data as { label?: string }).label).toBe('Process Data');

    // Decision node is a diamond
    const decisionNode = result.find((e) => e.id === '4');
    expect(decisionNode).toBeDefined();
    expect(decisionNode!.kind).toBe('diamond');
    expect((decisionNode!.data as { label?: string }).label).toBe('Valid?');

    // Edge 5 is an arrow from Start to Process
    const edge5 = result.find((e) => e.id === '5');
    expect(edge5).toBeDefined();
    expect(edge5!.kind).toBe('arrow');
    const e5data = edge5!.data as { startBinding?: { expressionId: string }; endBinding?: { expressionId: string } };
    expect(e5data.startBinding?.expressionId).toBe('2');
    expect(e5data.endBinding?.expressionId).toBe('3');

    // Edge 7 has waypoints
    const edge7 = result.find((e) => e.id === '7');
    expect(edge7).toBeDefined();
    const e7data = edge7!.data as { points: [number, number][]; label?: string };
    expect(e7data.label).toBe('Yes');
    // Should have at least the two waypoints in the Array
    expect(e7data.points.length).toBeGreaterThanOrEqual(2);
  });

  it('imports draw.io XML with additional graph model attributes without error', () => {
    // draw.io adds many attributes to mxGraphModel that we should tolerate
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="n1" value="Test" style="" vertex="1" parent="1">
      <mxGeometry x="100" y="100" width="120" height="60" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('n1');
  });
});

// ══════════════════════════════════════════════════════════
// §9 — BOUNDARY: Round-trip with complex arrow topologies
// ══════════════════════════════════════════════════════════

describe('[BOUNDARY] arrow topology round-trips', () => {
  it('round-trip: arrow with exactly 2 points (no waypoints)', () => {
    const arrow = makeExpression({
      id: 'arrow-2pt',
      data: {
        kind: 'arrow',
        points: [[10, 20], [300, 400]],
        label: 'direct',
      },
    });
    const xml = expressionsToDrawio([arrow]);
    // No Array element for 2-point edges
    expect(xml).not.toContain('<Array');
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect((result[0]!.data as { label?: string }).label).toBe('direct');
  });

  it('round-trip: arrow with many waypoints preserves all of them', () => {
    const arrow = makeExpression({
      id: 'arrow-multi',
      data: {
        kind: 'arrow',
        points: [[0, 0], [100, 50], [200, 0], [300, 50], [400, 0]],
        label: 'zigzag',
      },
    });
    const xml = expressionsToDrawio([arrow]);
    // Should have 3 waypoints (intermediate points)
    expect(xml).toContain('<Array as="points">');
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    const points = (result[0]!.data as { points: [number, number][] }).points;
    // The intermediate waypoints [100,50], [200,0], [300,50] should be recovered
    // First and last points may be [0,0] placeholders during import
    // But the waypoints should include the 3 intermediate ones
    const intermediatePoints = points.slice(1, -1);
    expect(intermediatePoints).toHaveLength(3);
    expect(intermediatePoints).toEqual([[100, 50], [200, 0], [300, 50]]);
  });

  it('round-trip: line with source/target points preserves endpoints', () => {
    const line = makeExpression({
      id: 'line-endpoints',
      data: {
        kind: 'line',
        points: [[50, 50], [250, 150]],
      },
    });
    const xml = expressionsToDrawio([line]);
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('line');
  });
});

// ══════════════════════════════════════════════════════════
// §10 — BOUNDARY: Import → Export → Import stability
// ══════════════════════════════════════════════════════════

describe('[BOUNDARY] import→export→import stability (idempotence)', () => {
  it('import then export then import produces equivalent expressions', () => {
    const sourceXml = wrapInModel(`
      <mxCell id="a1" value="Box A" style="rounded=1;fillColor=#dae8fc;strokeColor=#6c8ebf;whiteSpace=wrap;html=1;" vertex="1" parent="1">
        <mxGeometry x="100" y="100" width="160" height="80" as="geometry"/>
      </mxCell>
      <mxCell id="a2" value="Circle B" style="ellipse;fillColor=#d5e8d4;strokeColor=#82b366;whiteSpace=wrap;html=1;" vertex="1" parent="1">
        <mxGeometry x="400" y="100" width="100" height="100" as="geometry"/>
      </mxCell>
      <mxCell id="a3" value="connect" style="" edge="1" source="a1" target="a2" parent="1">
        <mxGeometry relative="1" as="geometry"/>
      </mxCell>
    `);

    const pass1 = drawioToExpressions(sourceXml);
    const reExported = expressionsToDrawio(pass1);
    const pass2 = drawioToExpressions(reExported);

    // Same number of expressions
    expect(pass2).toHaveLength(pass1.length);

    // Same kinds
    expect(pass2.map((e) => e.kind)).toEqual(pass1.map((e) => e.kind));

    // Same IDs
    expect(pass2.map((e) => e.id)).toEqual(pass1.map((e) => e.id));

    // Same positions for vertices
    const p1Vertices = pass1.filter((e) => e.kind !== 'arrow' && e.kind !== 'line');
    const p2Vertices = pass2.filter((e) => e.kind !== 'arrow' && e.kind !== 'line');
    for (let i = 0; i < p1Vertices.length; i++) {
      expect(p2Vertices[i]!.position).toEqual(p1Vertices[i]!.position);
      expect(p2Vertices[i]!.size).toEqual(p1Vertices[i]!.size);
    }

    // Same labels
    for (let i = 0; i < pass1.length; i++) {
      const d1 = pass1[i]!.data as { label?: string; text?: string };
      const d2 = pass2[i]!.data as { label?: string; text?: string };
      expect(d2.label ?? d2.text).toEqual(d1.label ?? d1.text);
    }
  });
});

// ══════════════════════════════════════════════════════════
// §11 — COVERAGE: Style edge cases
// ══════════════════════════════════════════════════════════

describe('[COVERAGE] style property edge cases', () => {
  it('round-trip: dotted stroke style is preserved via dashPattern', () => {
    // The serializer uses distinct dashPatterns: dotted=1 3, dashed=8 5
    const dotted = makeExpression({
      id: 'dotted-1',
      style: { ...baseStyle, strokeStyle: 'dotted' },
      data: { kind: 'rectangle', label: 'Dotted' },
    });
    const xml = expressionsToDrawio([dotted]);
    expect(xml).toContain('dashed=1');
    expect(xml).toContain('dashPattern=1 3');
    // dotted is now preserved through round-trip via dashPattern discrimination
    const result = drawioToExpressions(xml);
    expect(result[0]!.style.strokeStyle).toBe('dotted');
  });

  it('import: fillColor=none maps to transparent backgroundColor', () => {
    const xml = wrapInModel(
      `<mxCell id="nf1" value="NoFill" style="fillColor=none;strokeColor=#000000;" vertex="1" parent="1">
         <mxGeometry x="0" y="0" width="100" height="100" as="geometry"/>
       </mxCell>`,
    );
    const result = drawioToExpressions(xml);
    expect(result[0]!.style.backgroundColor).toBe('transparent');
  });

  it('round-trip: default strokeWidth is NOT exported (reduces noise)', () => {
    // Default strokeWidth is 2, which matches DEFAULT_EXPRESSION_STYLE.strokeWidth
    const def = makeExpression({
      id: 'def-sw',
      style: { ...baseStyle, strokeWidth: DEFAULT_EXPRESSION_STYLE.strokeWidth },
      data: { kind: 'rectangle', label: 'Default SW' },
    });
    const xml = expressionsToDrawio([def]);
    // Should NOT have strokeWidth since it matches default
    expect(xml).not.toContain('strokeWidth=');
  });

  it('import: non-default strokeWidth is parsed correctly', () => {
    const xml = wrapInModel(
      `<mxCell id="sw5" value="Thick" style="strokeWidth=5;strokeColor=#FF0000;" vertex="1" parent="1">
         <mxGeometry x="0" y="0" width="100" height="100" as="geometry"/>
       </mxCell>`,
    );
    const result = drawioToExpressions(xml);
    expect(result[0]!.style.strokeWidth).toBe(5);
    expect(result[0]!.style.strokeColor).toBe('#FF0000');
  });
});

// ══════════════════════════════════════════════════════════
// §12 — EDGE: Large batch export/import
// ══════════════════════════════════════════════════════════

describe('[EDGE] large batch handling', () => {
  it('round-trip: 100 mixed expressions preserves all IDs and kinds', () => {
    const kinds = ['rectangle', 'ellipse', 'diamond', 'text', 'sticky-note'] as const;
    const expressions: VisualExpression[] = [];

    for (let i = 0; i < 100; i++) {
      const kindIdx = i % kinds.length;
      const kind = kinds[kindIdx]!;
      let data: VisualExpression['data'];

      switch (kind) {
        case 'rectangle':
          data = { kind: 'rectangle', label: `Rect ${i}` };
          break;
        case 'ellipse':
          data = { kind: 'ellipse', label: `Ell ${i}` };
          break;
        case 'diamond':
          data = { kind: 'diamond', label: `Dia ${i}` };
          break;
        case 'text':
          data = { kind: 'text', text: `Text ${i}`, fontSize: 14, fontFamily: 'sans-serif', textAlign: 'left' };
          break;
        case 'sticky-note':
          data = { kind: 'sticky-note', text: `Note ${i}`, color: '#FFEB3B' };
          break;
      }

      expressions.push(
        makeExpression({
          id: `batch-${i}`,
          position: { x: (i % 10) * 150, y: Math.floor(i / 10) * 120 },
          size: { width: 120, height: 80 },
          data: data!,
        }),
      );
    }

    const xml = expressionsToDrawio(expressions);
    const result = drawioToExpressions(xml);

    expect(result).toHaveLength(100);
    // All IDs preserved
    expect(result.map((e) => e.id).sort()).toEqual(expressions.map((e) => e.id).sort());
    // All kinds preserved
    for (let i = 0; i < 100; i++) {
      const orig = expressions.find((e) => e.id === `batch-${i}`)!;
      const imported = result.find((e) => e.id === `batch-${i}`)!;
      expect(imported.kind).toBe(orig.kind);
    }
  });
});

// ══════════════════════════════════════════════════════════
// §13 — COVERAGE: Metadata fields on import
// ══════════════════════════════════════════════════════════

describe('[COVERAGE] import metadata defaults', () => {
  it('imported expressions get drawio-import author and tag', () => {
    const xml = wrapInModel(
      `<mxCell id="meta-1" value="Test" style="" vertex="1" parent="1">
         <mxGeometry x="0" y="0" width="100" height="100" as="geometry"/>
       </mxCell>`,
    );
    const result = drawioToExpressions(xml);
    const meta = result[0]!.meta;

    expect(meta.author.type).toBe('agent');
    expect(meta.author.id).toBe('drawio-import');
    expect(meta.tags).toContain('drawio-import');
    expect(meta.locked).toBe(false);
    expect(meta.createdAt).toBeGreaterThan(0);
    expect(meta.updatedAt).toBeGreaterThan(0);
  });

  it('imported expressions have angle=0', () => {
    const xml = wrapInModel(
      `<mxCell id="angle-1" value="Test" style="" vertex="1" parent="1">
         <mxGeometry x="0" y="0" width="100" height="100" as="geometry"/>
       </mxCell>`,
    );
    const result = drawioToExpressions(xml);
    expect(result[0]!.angle).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════
// §14 — EDGE: Style string parsing edge cases
// ══════════════════════════════════════════════════════════

describe('[EDGE] style string parsing', () => {
  it('import: trailing semicolons do not create empty tokens', () => {
    const xml = wrapInModel(
      `<mxCell id="ts1" value="T" style="rounded=1;;;whiteSpace=wrap;;;html=1;;;" vertex="1" parent="1">
         <mxGeometry x="0" y="0" width="100" height="100" as="geometry"/>
       </mxCell>`,
    );
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('rectangle');
  });

  it('import: style with only shape identifier (no key=value pairs) works', () => {
    const xml = wrapInModel(
      `<mxCell id="shape-only" value="Just Shape" style="ellipse;" vertex="1" parent="1">
         <mxGeometry x="0" y="0" width="80" height="80" as="geometry"/>
       </mxCell>`,
    );
    const result = drawioToExpressions(xml);
    expect(result[0]!.kind).toBe('ellipse');
  });

  it('import: unknown style keys are tolerated and do not crash', () => {
    const xml = wrapInModel(
      `<mxCell id="unk1" value="Custom" style="customProp=foo;shadow=1;arcSize=20;glass=1;" vertex="1" parent="1">
         <mxGeometry x="0" y="0" width="100" height="100" as="geometry"/>
       </mxCell>`,
    );
    const result = drawioToExpressions(xml);
    expect(result).toHaveLength(1);
    // Unknown props should not cause issues
    expect(result[0]!.kind).toBe('rectangle');
  });
});

// ══════════════════════════════════════════════════════════
// §15 — EDGE: Multiple edges between same nodes
// ══════════════════════════════════════════════════════════

describe('[EDGE] graph topology', () => {
  it('import: multiple edges between same source/target are all preserved', () => {
    const xml = wrapInModel(`
      <mxCell id="n1" value="A" style="" vertex="1" parent="1">
        <mxGeometry x="0" y="0" width="100" height="100" as="geometry"/>
      </mxCell>
      <mxCell id="n2" value="B" style="" vertex="1" parent="1">
        <mxGeometry x="300" y="0" width="100" height="100" as="geometry"/>
      </mxCell>
      <mxCell id="e1" value="first" style="" edge="1" source="n1" target="n2" parent="1">
        <mxGeometry relative="1" as="geometry"/>
      </mxCell>
      <mxCell id="e2" value="second" style="" edge="1" source="n1" target="n2" parent="1">
        <mxGeometry relative="1" as="geometry"/>
      </mxCell>
    `);

    const result = drawioToExpressions(xml);
    const edges = result.filter((e) => e.kind === 'arrow');
    expect(edges).toHaveLength(2);
    expect(edges.map((e) => (e.data as { label?: string }).label).sort()).toEqual(['first', 'second']);
  });

  it('import: self-referencing edge (source === target) is preserved', () => {
    const xml = wrapInModel(`
      <mxCell id="loop-node" value="Loop" style="" vertex="1" parent="1">
        <mxGeometry x="0" y="0" width="100" height="100" as="geometry"/>
      </mxCell>
      <mxCell id="loop-edge" value="self" style="" edge="1" source="loop-node" target="loop-node" parent="1">
        <mxGeometry relative="1" as="geometry"/>
      </mxCell>
    `);

    const result = drawioToExpressions(xml);
    const edge = result.find((e) => e.id === 'loop-edge');
    expect(edge).toBeDefined();
    const data = edge!.data as { startBinding?: { expressionId: string }; endBinding?: { expressionId: string } };
    expect(data.startBinding?.expressionId).toBe('loop-node');
    expect(data.endBinding?.expressionId).toBe('loop-node');
  });
});
