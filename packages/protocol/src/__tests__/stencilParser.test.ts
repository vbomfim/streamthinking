/**
 * Tests for draw.io XML stencil → SVG converter.
 *
 * TDD: tests written before implementation per ticket #100.
 *
 * Verifies path commands, shape elements, full shape conversion,
 * and multi-shape library parsing.
 */

import { describe, it, expect } from 'vitest';
import {
  shapeToSvg,
  parseStencilLibrary,
} from '../drawio/stencilParser.js';
import type {
  DrawioShape,
  DrawioStencilLibrary,
} from '../drawio/stencilParser.js';

// ── Helper ────────────────────────────────────────────────

/**
 * Wrap a fragment in a minimal `<shapes>` library so
 * `parseStencilLibrary` can parse it as a single shape.
 */
function wrapShape(
  shapeBody: string,
  attrs = 'name="Test" w="100" h="100"',
): string {
  return `<shapes name="TestLib"><shape ${attrs}>${shapeBody}</shape></shapes>`;
}

/** Parse a single shape via library parser and return the first result. */
function parseSingleShape(
  shapeBody: string,
  attrs?: string,
): DrawioShape {
  const lib = parseStencilLibrary(wrapShape(shapeBody, attrs));
  expect(lib.shapes).toHaveLength(1);
  return lib.shapes[0]!;
}

// ── 1. Path command tests ─────────────────────────────────

describe('Path commands → SVG path data', () => {
  it('<move> → M x y', () => {
    const shape = parseSingleShape(`
      <foreground>
        <path><move x="10" y="20"/></path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('M 10 20');
  });

  it('<line> → L x y', () => {
    const shape = parseSingleShape(`
      <foreground>
        <path><move x="0" y="0"/><line x="50" y="60"/></path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('L 50 60');
  });

  it('<curve> → C x1 y1, x2 y2, x3 y3', () => {
    const shape = parseSingleShape(`
      <foreground>
        <path>
          <move x="0" y="0"/>
          <curve x1="10" y1="20" x2="30" y2="40" x3="50" y3="60"/>
        </path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('C 10 20, 30 40, 50 60');
  });

  it('<quad> → Q x1 y1, x2 y2', () => {
    const shape = parseSingleShape(`
      <foreground>
        <path>
          <move x="0" y="0"/>
          <quad x1="25" y1="50" x2="50" y2="0"/>
        </path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('Q 25 50, 50 0');
  });

  it('<arc> → A rx ry x-rotation large-arc-flag sweep-flag x y', () => {
    const shape = parseSingleShape(`
      <foreground>
        <path>
          <move x="0" y="0"/>
          <arc rx="25" ry="25" x-rotation="0" large-arc-flag="1" sweep-flag="0" x="50" y="50"/>
        </path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('A 25 25 0 1 0 50 50');
  });

  it('<close> → Z', () => {
    const shape = parseSingleShape(`
      <foreground>
        <path>
          <move x="0" y="0"/>
          <line x="100" y="0"/>
          <line x="100" y="100"/>
          <close/>
        </path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('Z');
  });

  it('combined path produces correct SVG d attribute', () => {
    const shape = parseSingleShape(`
      <foreground>
        <path>
          <move x="0" y="0"/>
          <line x="100" y="0"/>
          <line x="100" y="100"/>
          <line x="0" y="100"/>
          <close/>
        </path>
        <stroke/>
      </foreground>
    `);
    // The SVG <path> element should contain the combined path data
    expect(shape.svg).toMatch(/d="M 0 0 L 100 0 L 100 100 L 0 100 Z"/);
  });
});

// ── 2. Shape element tests ────────────────────────────────

describe('Shape elements → SVG elements', () => {
  it('<rect> → SVG <rect>', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="10" y="20" w="30" h="40"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.svg).toMatch(/<rect\s[^>]*x="10"/);
    expect(shape.svg).toMatch(/<rect\s[^>]*y="20"/);
    expect(shape.svg).toMatch(/<rect\s[^>]*width="30"/);
    expect(shape.svg).toMatch(/<rect\s[^>]*height="40"/);
  });

  it('<roundrect> → SVG <rect> with rx', () => {
    const shape = parseSingleShape(`
      <foreground>
        <roundrect x="5" y="5" w="90" h="90" arcsize="0.2"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('<rect');
    // arcsize 0.2 * min(90,90)/2 = 9 — rx should be derived from arcsize
    expect(shape.svg).toMatch(/rx="[0-9.]+"/);
  });

  it('<ellipse> → SVG <ellipse>', () => {
    const shape = parseSingleShape(`
      <foreground>
        <ellipse x="10" y="10" w="40" h="20"/>
        <fill/>
      </foreground>
    `);
    // cx = x + w/2 = 30, cy = y + h/2 = 20, rx = w/2 = 20, ry = h/2 = 10
    expect(shape.svg).toMatch(/<ellipse\s[^>]*cx="30"/);
    expect(shape.svg).toMatch(/<ellipse\s[^>]*cy="20"/);
    expect(shape.svg).toMatch(/<ellipse\s[^>]*rx="20"/);
    expect(shape.svg).toMatch(/<ellipse\s[^>]*ry="10"/);
  });

  it('<text> → SVG <text>', () => {
    const shape = parseSingleShape(`
      <foreground>
        <text str="Hello" x="10" y="50" align="center" valign="middle"/>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('<text');
    expect(shape.svg).toContain('Hello');
  });
});

// ── 3. Paint operation tests ──────────────────────────────

describe('Paint operations (fill, stroke, fillstroke)', () => {
  it('<fill/> applies fill only to preceding shape', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="0" y="0" w="100" h="100"/>
        <fill/>
      </foreground>
    `);
    // Should have fill but no stroke on the rect
    expect(shape.svg).toMatch(/<rect[^>]*fill="currentColor"/);
    expect(shape.svg).toMatch(/<rect[^>]*stroke="none"/);
  });

  it('<stroke/> applies stroke only to preceding shape', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="0" y="0" w="100" h="100"/>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toMatch(/<rect[^>]*stroke="currentColor"/);
    expect(shape.svg).toMatch(/<rect[^>]*fill="none"/);
  });

  it('<fillstroke/> applies both', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.svg).toMatch(/<rect[^>]*fill="currentColor"/);
    expect(shape.svg).toMatch(/<rect[^>]*stroke="currentColor"/);
  });
});

// ── 4. Full shape tests ───────────────────────────────────

describe('Full shape conversion', () => {
  it('simple rectangle shape → valid SVG with viewBox', () => {
    const shape = parseSingleShape(`
      <background>
        <path>
          <move x="0" y="0"/>
          <line x="100" y="0"/>
          <line x="100" y="100"/>
          <line x="0" y="100"/>
          <close/>
        </path>
        <fillstroke/>
      </background>
    `, 'name="Box" w="100" h="100"');

    expect(shape.name).toBe('Box');
    expect(shape.width).toBe(100);
    expect(shape.height).toBe(100);
    expect(shape.svg).toContain('viewBox="0 0 100 100"');
    expect(shape.svg).toContain('<svg');
    expect(shape.svg).toContain('</svg>');
  });

  it('shape with background + foreground → two SVG groups', () => {
    const shape = parseSingleShape(`
      <background>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </background>
      <foreground>
        <path>
          <move x="20" y="50"/>
          <line x="80" y="50"/>
        </path>
        <stroke/>
      </foreground>
    `, 'name="Divided" w="100" h="100"');

    // Should have g.background and g.foreground groups
    expect(shape.svg).toMatch(/<g[^>]*class="background"/);
    expect(shape.svg).toMatch(/<g[^>]*class="foreground"/);
  });

  it('shape with connections → ConnectionPoint array', () => {
    const shape = parseSingleShape(`
      <connections>
        <constraint x="0.5" y="0" perimeter="1" name="N"/>
        <constraint x="1" y="0.5" perimeter="1" name="E"/>
        <constraint x="0.5" y="1" perimeter="1" name="S"/>
        <constraint x="0" y="0.5" perimeter="1" name="W"/>
      </connections>
      <background>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </background>
    `, 'name="ConnBox" w="100" h="100"');

    expect(shape.connections).toHaveLength(4);
    expect(shape.connections[0]).toEqual({ x: 0.5, y: 0, name: 'N' });
    expect(shape.connections[1]).toEqual({ x: 1, y: 0.5, name: 'E' });
    expect(shape.connections[2]).toEqual({ x: 0.5, y: 1, name: 'S' });
    expect(shape.connections[3]).toEqual({ x: 0, y: 0.5, name: 'W' });
  });

  it('shape with aspect="fixed" preserves aspect ratio', () => {
    const shape = parseSingleShape(`
      <background>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </background>
    `, 'name="Fixed" w="100" h="100" aspect="fixed"');

    expect(shape.aspect).toBe('fixed');
  });

  it('shape defaults to aspect="variable"', () => {
    const shape = parseSingleShape(`
      <background>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </background>
    `, 'name="Var" w="100" h="100"');

    expect(shape.aspect).toBe('variable');
  });
});

// ── 5. State command tests ────────────────────────────────

describe('State commands', () => {
  it('<strokewidth> changes stroke width for subsequent elements', () => {
    const shape = parseSingleShape(`
      <foreground>
        <strokewidth width="3"/>
        <path>
          <move x="0" y="0"/>
          <line x="100" y="100"/>
        </path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toMatch(/stroke-width="3"/);
  });

  it('<strokecolor> changes stroke color', () => {
    const shape = parseSingleShape(`
      <foreground>
        <strokecolor color="#FF0000"/>
        <path>
          <move x="0" y="0"/>
          <line x="100" y="100"/>
        </path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('stroke="#FF0000"');
  });

  it('<fillcolor> changes fill color', () => {
    const shape = parseSingleShape(`
      <foreground>
        <fillcolor color="#00FF00"/>
        <rect x="0" y="0" w="50" h="50"/>
        <fill/>
      </foreground>
    `);
    expect(shape.svg).toContain('fill="#00FF00"');
  });
});

// ── 6. Library parsing tests ──────────────────────────────

describe('parseStencilLibrary', () => {
  it('parses multi-shape library → array of DrawioShapes', () => {
    const xml = `
      <shapes name="MyLib">
        <shape name="Circle" w="50" h="50">
          <foreground>
            <ellipse x="0" y="0" w="50" h="50"/>
            <fillstroke/>
          </foreground>
        </shape>
        <shape name="Square" w="80" h="80">
          <foreground>
            <rect x="0" y="0" w="80" h="80"/>
            <fillstroke/>
          </foreground>
        </shape>
      </shapes>
    `;
    const lib = parseStencilLibrary(xml);

    expect(lib.name).toBe('MyLib');
    expect(lib.shapes).toHaveLength(2);
    expect(lib.shapes[0]!.name).toBe('Circle');
    expect(lib.shapes[1]!.name).toBe('Square');
  });

  it('each shape has valid SVG and metadata', () => {
    const xml = `
      <shapes name="TestLib">
        <shape name="Shape1" w="100" h="80" aspect="fixed">
          <foreground>
            <rect x="0" y="0" w="100" h="80"/>
            <fillstroke/>
          </foreground>
        </shape>
      </shapes>
    `;
    const lib = parseStencilLibrary(xml);
    const shape = lib.shapes[0]!;

    expect(shape.name).toBe('Shape1');
    expect(shape.width).toBe(100);
    expect(shape.height).toBe(80);
    expect(shape.aspect).toBe('fixed');
    expect(shape.svg).toContain('<svg');
    expect(shape.svg).toContain('viewBox="0 0 100 80"');
  });

  it('handles single-shape library (no array wrapping issue)', () => {
    const xml = `
      <shapes name="Single">
        <shape name="Only" w="100" h="100">
          <foreground>
            <rect x="0" y="0" w="100" h="100"/>
            <fillstroke/>
          </foreground>
        </shape>
      </shapes>
    `;
    const lib = parseStencilLibrary(xml);
    expect(lib.shapes).toHaveLength(1);
    expect(lib.shapes[0]!.name).toBe('Only');
  });

  it('empty library → empty shapes array', () => {
    const xml = `<shapes name="Empty"></shapes>`;
    const lib = parseStencilLibrary(xml);
    expect(lib.name).toBe('Empty');
    expect(lib.shapes).toHaveLength(0);
  });

  it('invalid XML throws descriptive error', () => {
    expect(() => parseStencilLibrary('<not-shapes/>')).toThrow();
  });
});

// ── 7. Round-trip / SVG validity tests ────────────────────

describe('SVG output quality', () => {
  it('uses currentColor by default for fills and strokes', () => {
    const shape = parseSingleShape(`
      <background>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </background>
    `);
    expect(shape.svg).toContain('currentColor');
  });

  it('generates well-formed XML (no unclosed tags)', () => {
    const shape = parseSingleShape(`
      <background>
        <path>
          <move x="0" y="0"/>
          <line x="50" y="50"/>
          <line x="100" y="0"/>
          <close/>
        </path>
        <fillstroke/>
      </background>
      <foreground>
        <ellipse x="30" y="30" w="40" h="40"/>
        <stroke/>
      </foreground>
    `);

    // Count open/close tags — every open should have a close (or be self-closing)
    const svgStr = shape.svg;
    // Minimal well-formedness: starts with <svg, ends with </svg>
    expect(svgStr.trim()).toMatch(/^<svg\s/);
    expect(svgStr.trim()).toMatch(/<\/svg>$/);
  });

  it('sets xmlns attribute on root svg element', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });
});

// ── 8. shapeToSvg standalone test ─────────────────────────

describe('shapeToSvg', () => {
  it('converts a parsed shape element to SVG string', () => {
    const xml = `
      <shapes name="Lib">
        <shape name="Test" w="80" h="60">
          <foreground>
            <path>
              <move x="0" y="0"/>
              <line x="80" y="60"/>
            </path>
            <stroke/>
          </foreground>
        </shape>
      </shapes>
    `;

    // Parse the XML to get the shape element, then use shapeToSvg
    // This verifies shapeToSvg works with width/height overrides
    const lib = parseStencilLibrary(xml);
    const shape = lib.shapes[0]!;

    // Use shapeToSvg with different dimensions
    const svg = shapeToSvg(shape.svg, 160, 120);
    // Overridden SVG should have new viewBox but still contain the path
    expect(svg).toContain('viewBox="0 0 160 120"');
  });
});

// ── 9. Edge cases ─────────────────────────────────────────

describe('Edge cases', () => {
  it('shape with no foreground or background → empty SVG body', () => {
    const shape = parseSingleShape(`
      <connections>
        <constraint x="0.5" y="0" perimeter="1" name="N"/>
      </connections>
    `, 'name="Empty" w="50" h="50"');

    expect(shape.svg).toContain('<svg');
    expect(shape.svg).toContain('</svg>');
    expect(shape.connections).toHaveLength(1);
  });

  it('path with no commands → empty path element', () => {
    const shape = parseSingleShape(`
      <foreground>
        <path></path>
        <stroke/>
      </foreground>
    `);
    // Should not crash; may produce an empty or absent path
    expect(shape.svg).toContain('<svg');
  });

  it('shape with w/h="0" uses clamped viewBox dimensions', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </foreground>
    `, 'name="Zero" w="0" h="0"');

    // Raw dimensions preserved on the shape metadata
    expect(shape.width).toBe(0);
    expect(shape.height).toBe(0);
    // But viewBox must use clamped values (min 1) to avoid degenerate SVG
    expect(shape.svg).toContain('viewBox="0 0 1 1"');
  });

  it('shape with negative dimensions uses clamped viewBox', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="0" y="0" w="50" h="50"/>
        <fillstroke/>
      </foreground>
    `, 'name="Neg" w="-10" h="-20"');

    expect(shape.svg).toContain('viewBox="0 0 1 1"');
  });
});

// ── 10. Security tests ────────────────────────────────────

describe('Security: SVG attribute injection prevention', () => {
  it('escapes malicious color attributes (onload injection)', () => {
    const shape = parseSingleShape(`
      <foreground>
        <strokecolor color='red" onload="alert(1)'/>
        <path>
          <move x="0" y="0"/>
          <line x="100" y="100"/>
        </path>
        <stroke/>
      </foreground>
    `);
    // The double-quote in the malicious input must be escaped to &quot;
    // so it cannot break out of the attribute value boundary.
    // Unescaped: stroke="red" onload="alert(1)" → attribute breakout!
    // Escaped:   stroke="red&quot; onload=&quot;alert(1)" → safe, one attribute value
    expect(shape.svg).toContain('&quot;');
    // Verify there is no unescaped attribute breakout:
    // An unescaped injection would produce a standalone onload="..." attribute.
    // The regex checks that onload= only appears inside an already-quoted value,
    // not as a top-level attribute (which would be preceded by a space and no &quot;).
    expect(shape.svg).not.toMatch(/"\s+onload="/);
  });

  it('escapes malicious fillcolor attributes', () => {
    const shape = parseSingleShape(`
      <foreground>
        <fillcolor color='green" onclick="evil()'/>
        <rect x="0" y="0" w="50" h="50"/>
        <fill/>
      </foreground>
    `);
    // Quotes escaped — onclick trapped inside the attribute value
    expect(shape.svg).toContain('&quot;');
    expect(shape.svg).not.toMatch(/"\s+onclick="/);
  });

  it('escapes path attribute values with injection payloads', () => {
    const shape = parseSingleShape(`
      <foreground>
        <path>
          <move x='10" onmouseover="hack()' y="20"/>
        </path>
        <stroke/>
      </foreground>
    `);
    // Quotes escaped — onmouseover trapped inside the d="" value
    expect(shape.svg).toContain('&quot;');
    expect(shape.svg).not.toMatch(/"\s+onmouseover="/);
  });

  it('escapes text content with HTML tags', () => {
    const shape = parseSingleShape(`
      <foreground>
        <text str="&lt;script&gt;alert(1)&lt;/script&gt;" x="10" y="10"/>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).not.toContain('<script>');
  });

  it('escapes apostrophes in attribute values', () => {
    const shape = parseSingleShape(`
      <foreground>
        <strokecolor color="it's"/>
        <rect x="0" y="0" w="50" h="50"/>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('&apos;');
    expect(shape.svg).not.toMatch(/stroke="it's"/);
  });
});

// ── 11. Input limits tests ────────────────────────────────

describe('Input size and shape count limits', () => {
  it('rejects XML exceeding 10MB size limit', () => {
    // Create a string just over 10MB
    const hugeXml = '<shapes name="Big">' + 'x'.repeat(10_000_001) + '</shapes>';
    expect(() => parseStencilLibrary(hugeXml)).toThrow(/too large/);
  });

  it('rejects library with more than 2000 shapes', () => {
    const shapeEntries = Array.from({ length: 2001 }, (_, i) =>
      `<shape name="S${i}" w="10" h="10"><foreground><rect x="0" y="0" w="10" h="10"/><fill/></foreground></shape>`,
    ).join('');
    const xml = `<shapes name="Huge">${shapeEntries}</shapes>`;
    expect(() => parseStencilLibrary(xml)).toThrow(/exceeding the limit/);
  });
});

// ── 12. Text element paint attribute tests ────────────────

describe('Text element paint attributes (Finding #2)', () => {
  it('<text> element receives fill paint attributes', () => {
    const shape = parseSingleShape(`
      <foreground>
        <text str="Label" x="10" y="50"/>
        <fill/>
      </foreground>
    `);
    // The text element should have fill="currentColor" injected
    expect(shape.svg).toMatch(/<text[^>]*fill="currentColor"/);
  });

  it('<text> element receives stroke paint attributes', () => {
    const shape = parseSingleShape(`
      <foreground>
        <text str="Stroked" x="10" y="50"/>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toMatch(/<text[^>]*stroke="currentColor"/);
  });

  it('<text> element receives fillstroke paint attributes', () => {
    const shape = parseSingleShape(`
      <foreground>
        <text str="Both" x="10" y="50"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.svg).toMatch(/<text[^>]*fill="currentColor"/);
    expect(shape.svg).toMatch(/<text[^>]*stroke="currentColor"/);
  });

  it('text content is preserved after paint attribute injection', () => {
    const shape = parseSingleShape(`
      <foreground>
        <text str="Keep Me" x="10" y="50"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('Keep Me');
    expect(shape.svg).toContain('</text>');
  });
});
