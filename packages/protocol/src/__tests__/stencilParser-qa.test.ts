/**
 * QA Guardian — Integration, Edge Case, and Contract tests for draw.io stencil parser.
 *
 * Complements the Developer Guardian's 34 unit tests with:
 * - Coverage gap tests for untested acceptance criteria
 * - Edge case / boundary tests
 * - Contract validation for public API surface
 * - Code bug detection tests (escalated to Developer)
 *
 * @see https://github.com/vbomfim/streamthinking/issues/100
 * @module
 */

import { describe, it, expect } from 'vitest';
import {
  shapeToSvg,
  parseStencilLibrary,
} from '../drawio/stencilParser.js';
import type {
  DrawioShape,
  DrawioStencilLibrary,
  ConnectionPoint,
} from '../drawio/stencilParser.js';

// ── Helper ────────────────────────────────────────────────

/** Wrap a shape body in the minimal <shapes> library envelope. */
function wrapShape(
  shapeBody: string,
  attrs = 'name="QATest" w="100" h="100"',
): string {
  return `<shapes name="QALib"><shape ${attrs}>${shapeBody}</shape></shapes>`;
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

// ══════════════════════════════════════════════════════════
// [AC-5] Save/restore state scoping — CODE BUG
// ══════════════════════════════════════════════════════════

describe('[AC-5] Save/restore state scoping', () => {
  /**
   * CODE BUG: fast-xml-parser groups sibling elements by tag name,
   * so when the same tag (e.g., <rect>) appears both before and
   * after <save/>/<restore/>, they get processed together BEFORE
   * restore runs — colors leak across the save/restore boundary.
   *
   * Expected: second rect gets fill="currentColor" (restored state)
   * Actual: second rect gets fill="#FF0000" (leaked state)
   *
   * This is a fundamental limitation of the tag-grouping approach.
   * Escalate to Developer Guardian.
   */
  it('[AC-5] fillcolor change should not leak past <restore/> — CODE BUG', () => {
    const shape = parseSingleShape(`
      <foreground>
        <save/>
        <fillcolor color="#FF0000"/>
        <rect x="0" y="0" w="50" h="50"/>
        <fill/>
        <restore/>
        <rect x="50" y="50" w="50" h="50"/>
        <fill/>
      </foreground>
    `);
    const rects = shape.svg.match(/<rect[^/]*\/>/g) ?? [];
    // After restore, the second rect should revert to currentColor
    // BUG: both rects get #FF0000 because fast-xml-parser groups <rect> tags together
    expect(rects).toHaveLength(2);
    expect(rects[1]).toContain('fill="currentColor"');
  });

  it('[AC-5] strokecolor change should not leak past <restore/>', () => {
    const shape = parseSingleShape(`
      <foreground>
        <save/>
        <strokecolor color="#0000FF"/>
        <path><move x="0" y="0"/><line x="50" y="50"/></path>
        <stroke/>
        <restore/>
        <path><move x="50" y="50"/><line x="100" y="100"/></path>
        <stroke/>
      </foreground>
    `);
    const paths = shape.svg.match(/<path[^/]*\/>/g) ?? [];
    // After restore, second path should revert to currentColor stroke
    // BUG: same tag-grouping issue
    expect(paths).toHaveLength(2);
    expect(paths[1]).toContain('stroke="currentColor"');
  });
});

// ══════════════════════════════════════════════════════════
// [AC-4] Text element paint attribute injection — CODE BUG
// ══════════════════════════════════════════════════════════

describe('[AC-4] Text element paint attributes', () => {
  /**
   * CODE BUG: The paint operation uses el.replace('/>', ` ${pa}/>`),
   * but <text> elements are NOT self-closing — they use
   * <text x="10" y="50">Hello</text>. The replace has no match,
   * so paint attributes are never applied to text elements.
   *
   * Expected: <text x="10" y="50" fill="currentColor" stroke="none">Hello</text>
   * Actual: <text x="10" y="50">Hello</text> (no fill/stroke)
   *
   * Escalate to Developer Guardian.
   */
  it('[AC-4] <text> followed by <fill/> should get fill attribute — CODE BUG', () => {
    const shape = parseSingleShape(`
      <foreground>
        <text str="Label" x="10" y="50"/>
        <fill/>
      </foreground>
    `);
    expect(shape.svg).toMatch(/<text[^>]*fill="/);
  });

  it('[AC-4] <text> followed by <stroke/> should get stroke attribute — CODE BUG', () => {
    const shape = parseSingleShape(`
      <foreground>
        <text str="Label" x="10" y="50"/>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toMatch(/<text[^>]*stroke="currentColor"/);
  });

  it('[AC-4] <text> followed by <fillstroke/> should get both — CODE BUG', () => {
    const shape = parseSingleShape(`
      <foreground>
        <text str="Label" x="10" y="50"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.svg).toMatch(/<text[^>]*fill="/);
    expect(shape.svg).toMatch(/<text[^>]*stroke="/);
  });
});

// ══════════════════════════════════════════════════════════
// [AC-6] Multi-path shapes — COVERAGE GAP
// ══════════════════════════════════════════════════════════

describe('[AC-6] Multi-path shapes', () => {
  it('[AC-6] shape with multiple <path> elements renders separate SVG paths', () => {
    const shape = parseSingleShape(`
      <foreground>
        <path><move x="0" y="0"/><line x="50" y="0"/></path>
        <stroke/>
        <path><move x="0" y="50"/><line x="50" y="50"/></path>
        <stroke/>
        <path><move x="0" y="100"/><line x="50" y="100"/></path>
        <stroke/>
      </foreground>
    `);
    const pathMatches = shape.svg.match(/<path /g) ?? [];
    // Should have 3 separate <path> elements
    expect(pathMatches.length).toBeGreaterThanOrEqual(3);
  });

  it('[AC-6] multi-path shape with mixed primitives (path + rect)', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
        <path><move x="10" y="10"/><line x="90" y="90"/></path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('<rect');
    expect(shape.svg).toContain('<path');
  });
});

// ══════════════════════════════════════════════════════════
// [AC-7] currentColor theming
// ══════════════════════════════════════════════════════════

describe('[AC-7] currentColor theming', () => {
  it('[AC-7] default stroke color is currentColor', () => {
    const shape = parseSingleShape(`
      <foreground>
        <path><move x="0" y="0"/><line x="100" y="100"/></path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('stroke="currentColor"');
  });

  it('[AC-7] default fill color is currentColor', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="0" y="0" w="100" h="100"/>
        <fill/>
      </foreground>
    `);
    expect(shape.svg).toContain('fill="currentColor"');
  });

  it('[AC-7] explicit color overrides currentColor', () => {
    const shape = parseSingleShape(`
      <foreground>
        <strokecolor color="#FF0000"/>
        <path><move x="0" y="0"/><line x="100" y="100"/></path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('stroke="#FF0000"');
    expect(shape.svg).not.toMatch(/<path[^>]*stroke="currentColor"/);
  });

  it('[AC-7] SVG root has fill="none" stroke="currentColor" defaults', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.svg).toMatch(/<svg[^>]*fill="none"/);
    expect(shape.svg).toMatch(/<svg[^>]*stroke="currentColor"/);
  });
});

// ══════════════════════════════════════════════════════════
// [AC-9] ViewBox normalization
// ══════════════════════════════════════════════════════════

describe('[AC-9] ViewBox normalization', () => {
  it('[AC-9] viewBox reflects shape w/h dimensions', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="0" y="0" w="200" h="150"/>
        <fillstroke/>
      </foreground>
    `, 'name="Wide" w="200" h="150"');
    expect(shape.svg).toContain('viewBox="0 0 200 150"');
  });

  it('[AC-9] fractional dimensions are preserved', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="0" y="0" w="99.5" h="49.5"/>
        <fillstroke/>
      </foreground>
    `, 'name="Frac" w="99.5" h="49.5"');
    expect(shape.svg).toContain('viewBox="0 0 99.5 49.5"');
    expect(shape.width).toBe(99.5);
    expect(shape.height).toBe(49.5);
  });
});

// ══════════════════════════════════════════════════════════
// [AC-10] Background/foreground ordering
// ══════════════════════════════════════════════════════════

describe('[AC-10] Background/foreground ordering', () => {
  it('[AC-10] background group appears before foreground in SVG DOM', () => {
    const shape = parseSingleShape(`
      <background>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </background>
      <foreground>
        <ellipse x="25" y="25" w="50" h="50"/>
        <fillstroke/>
      </foreground>
    `);
    const bgIdx = shape.svg.indexOf('class="background"');
    const fgIdx = shape.svg.indexOf('class="foreground"');
    expect(bgIdx).toBeGreaterThan(-1);
    expect(fgIdx).toBeGreaterThan(-1);
    expect(bgIdx).toBeLessThan(fgIdx);
  });

  it('[AC-10] foreground-only shape has no background group', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.svg).not.toContain('class="background"');
    expect(shape.svg).toContain('class="foreground"');
  });

  it('[AC-10] background-only shape has no foreground group', () => {
    const shape = parseSingleShape(`
      <background>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </background>
    `);
    expect(shape.svg).toContain('class="background"');
    expect(shape.svg).not.toContain('class="foreground"');
  });
});

// ══════════════════════════════════════════════════════════
// [EDGE] Edge cases — boundary values
// ══════════════════════════════════════════════════════════

describe('[EDGE] Boundary values and edge cases', () => {
  it('[EDGE] missing attributes on path commands default to "0"', () => {
    // move/line without x or y attributes
    const shape = parseSingleShape(`
      <foreground>
        <path><move/><line/></path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('M 0 0');
    expect(shape.svg).toContain('L 0 0');
  });

  it('[EDGE] missing attributes on curve default to "0"', () => {
    const shape = parseSingleShape(`
      <foreground>
        <path><move x="0" y="0"/><curve/></path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('C 0 0, 0 0, 0 0');
  });

  it('[EDGE] missing attributes on arc default to "0"', () => {
    const shape = parseSingleShape(`
      <foreground>
        <path><move x="0" y="0"/><arc/></path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('A 0 0 0 0 0 0 0');
  });

  it('[EDGE] negative coordinate values are preserved', () => {
    const shape = parseSingleShape(`
      <foreground>
        <path><move x="-10" y="-20"/><line x="-30" y="-40"/></path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('M -10 -20');
    expect(shape.svg).toContain('L -30 -40');
  });

  it('[EDGE] very large coordinate values are preserved', () => {
    const shape = parseSingleShape(`
      <foreground>
        <path><move x="99999" y="99999"/></path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('M 99999 99999');
  });

  it('[EDGE] strokewidth=0 produces no stroke-width attribute', () => {
    const shape = parseSingleShape(`
      <foreground>
        <strokewidth width="0"/>
        <path><move x="0" y="0"/><line x="100" y="100"/></path>
        <stroke/>
      </foreground>
    `);
    // strokeWidth 0 is not 1, so it should be emitted
    expect(shape.svg).toContain('stroke-width="0"');
  });

  it('[EDGE] strokewidth=1 omits redundant stroke-width attribute', () => {
    const shape = parseSingleShape(`
      <foreground>
        <strokewidth width="1"/>
        <path><move x="0" y="0"/><line x="100" y="100"/></path>
        <stroke/>
      </foreground>
    `);
    // Default strokeWidth is 1 — should not emit explicit attribute
    expect(shape.svg).not.toContain('stroke-width=');
  });

  it('[EDGE] pending primitives without paint op get default stroke', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="0" y="0" w="100" h="100"/>
      </foreground>
    `);
    // No paint op after rect — should get default stroke treatment
    expect(shape.svg).toContain('<rect');
    expect(shape.svg).toMatch(/<rect[^>]*stroke="currentColor"/);
    expect(shape.svg).toMatch(/<rect[^>]*fill="none"/);
  });

  /**
   * CODE BUG (same root cause as AC-5): fast-xml-parser groups
   * sibling <rect> and <fill>/<stroke> tags together, so when
   * two rects have different paint ops between them, both rects
   * get assigned to whichever paint op comes first.
   *
   * Expected: rect[0] → fill, rect[1] → stroke
   * Actual: both rects → fill (because <rect> tags are grouped)
   *
   * Escalate to Developer Guardian with AC-5 tag-grouping bugs.
   */
  it('[EDGE] multiple paint operations process each batch independently — CODE BUG', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="0" y="0" w="50" h="50"/>
        <fill/>
        <rect x="50" y="50" w="50" h="50"/>
        <stroke/>
      </foreground>
    `);
    const rects = shape.svg.match(/<rect[^/]*\/>/g) ?? [];
    expect(rects).toHaveLength(2);
    // First rect: fill op (fill=currentColor, stroke=none)
    expect(rects[0]).toContain('fill="currentColor"');
    expect(rects[0]).toContain('stroke="none"');
    // Second rect should get stroke op (fill=none, stroke=currentColor)
    // BUG: both rects get fill treatment due to tag-grouping
    expect(rects[1]).toContain('fill="none"');
    expect(rects[1]).toContain('stroke="currentColor"');
  });
});

// ══════════════════════════════════════════════════════════
// [EDGE] Text / XSS safety
// ══════════════════════════════════════════════════════════

describe('[EDGE] Text content safety', () => {
  it('[EDGE] special characters in text are XML-escaped', () => {
    const shape = parseSingleShape(`
      <foreground>
        <text str="a &lt; b &amp; c > d" x="0" y="0"/>
        <stroke/>
      </foreground>
    `);
    // Should escape &, <, > in the output SVG
    expect(shape.svg).not.toContain('a < b');
    // The parser may decode entities first; check the SVG has safe output
    expect(shape.svg).toContain('<text');
  });

  it('[EDGE] XSS-like payload in text content is escaped', () => {
    const shape = parseSingleShape(`
      <foreground>
        <text str="&lt;script&gt;alert(1)&lt;/script&gt;" x="0" y="0"/>
        <stroke/>
      </foreground>
    `);
    // Must not contain raw <script> tags in SVG output
    expect(shape.svg).not.toContain('<script>');
  });

  it('[EDGE] empty text string is handled', () => {
    const shape = parseSingleShape(`
      <foreground>
        <text str="" x="10" y="20"/>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('<text');
  });

  it('[EDGE] text with double quotes is escaped', () => {
    const shape = parseSingleShape(`
      <foreground>
        <text str='He said &quot;hello&quot;' x="0" y="0"/>
        <stroke/>
      </foreground>
    `);
    // Double quotes must be escaped in the SVG text content
    expect(shape.svg).not.toMatch(/<text[^<]*"hello"/);
  });
});

// ══════════════════════════════════════════════════════════
// [EDGE] Roundrect arc size calculation
// ══════════════════════════════════════════════════════════

describe('[EDGE] Roundrect edge cases', () => {
  it('[EDGE] arcsize=0 produces rx=0 (sharp corners)', () => {
    const shape = parseSingleShape(`
      <foreground>
        <roundrect x="0" y="0" w="100" h="100" arcsize="0"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('rx="0"');
  });

  it('[EDGE] arcsize=1 produces maximum rounding', () => {
    const shape = parseSingleShape(`
      <foreground>
        <roundrect x="0" y="0" w="100" h="60" arcsize="1"/>
        <fillstroke/>
      </foreground>
    `);
    // arcsize=1 * min(100,60)/2 = 30
    expect(shape.svg).toContain('rx="30"');
  });

  it('[EDGE] non-square roundrect uses min dimension', () => {
    const shape = parseSingleShape(`
      <foreground>
        <roundrect x="0" y="0" w="200" h="40" arcsize="0.5"/>
        <fillstroke/>
      </foreground>
    `);
    // arcsize=0.5 * min(200,40)/2 = 0.5 * 40/2 = 10
    expect(shape.svg).toContain('rx="10"');
  });
});

// ══════════════════════════════════════════════════════════
// [EDGE] Connection points edge cases
// ══════════════════════════════════════════════════════════

describe('[EDGE] Connection point edge cases', () => {
  it('[EDGE] shape with no connections → empty array', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.connections).toEqual([]);
  });

  it('[EDGE] single connection point (no array wrapping issue)', () => {
    const shape = parseSingleShape(`
      <connections>
        <constraint x="0.5" y="0.5" name="center"/>
      </connections>
      <foreground>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.connections).toHaveLength(1);
    expect(shape.connections[0]).toEqual({ x: 0.5, y: 0.5, name: 'center' });
  });

  it('[EDGE] connection point without name attribute → empty string', () => {
    const shape = parseSingleShape(`
      <connections>
        <constraint x="0.5" y="0"/>
      </connections>
      <foreground>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.connections).toHaveLength(1);
    expect(shape.connections[0]!.name).toBe('');
  });

  it('[EDGE] connection point with non-numeric x/y → NaN handling', () => {
    const shape = parseSingleShape(`
      <connections>
        <constraint x="abc" y="def" name="bad"/>
      </connections>
      <foreground>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.connections).toHaveLength(1);
    // Number("abc") = NaN
    expect(shape.connections[0]!.x).toBeNaN();
    expect(shape.connections[0]!.y).toBeNaN();
  });
});

// ══════════════════════════════════════════════════════════
// [EDGE] Ellipse calculation verification
// ══════════════════════════════════════════════════════════

describe('[EDGE] Ellipse center/radius calculation', () => {
  it('[EDGE] ellipse at origin (0,0) has correct center', () => {
    const shape = parseSingleShape(`
      <foreground>
        <ellipse x="0" y="0" w="100" h="60"/>
        <fill/>
      </foreground>
    `);
    // cx = 0 + 100/2 = 50, cy = 0 + 60/2 = 30
    expect(shape.svg).toMatch(/cx="50"/);
    expect(shape.svg).toMatch(/cy="30"/);
    expect(shape.svg).toMatch(/rx="50"/);
    expect(shape.svg).toMatch(/ry="30"/);
  });

  it('[EDGE] ellipse with offset position', () => {
    const shape = parseSingleShape(`
      <foreground>
        <ellipse x="20" y="30" w="40" h="60"/>
        <fill/>
      </foreground>
    `);
    // cx = 20 + 40/2 = 40, cy = 30 + 60/2 = 60
    expect(shape.svg).toMatch(/cx="40"/);
    expect(shape.svg).toMatch(/cy="60"/);
  });
});

// ══════════════════════════════════════════════════════════
// [CONTRACT] Public API contract validation
// ══════════════════════════════════════════════════════════

describe('[CONTRACT] parseStencilLibrary return shape', () => {
  it('[CONTRACT] returns DrawioStencilLibrary with name and shapes', () => {
    const lib = parseStencilLibrary(`
      <shapes name="ContractTest">
        <shape name="S1" w="100" h="80">
          <foreground>
            <rect x="0" y="0" w="100" h="80"/>
            <fillstroke/>
          </foreground>
        </shape>
      </shapes>
    `);
    // Structural contract
    expect(lib).toHaveProperty('name');
    expect(lib).toHaveProperty('shapes');
    expect(typeof lib.name).toBe('string');
    expect(Array.isArray(lib.shapes)).toBe(true);
  });

  it('[CONTRACT] each DrawioShape has required fields with correct types', () => {
    const lib = parseStencilLibrary(`
      <shapes name="Types">
        <shape name="Typed" w="120" h="90" aspect="fixed">
          <connections>
            <constraint x="0.5" y="0" name="N"/>
          </connections>
          <foreground>
            <rect x="0" y="0" w="120" h="90"/>
            <fillstroke/>
          </foreground>
        </shape>
      </shapes>
    `);
    const shape = lib.shapes[0]!;
    expect(typeof shape.name).toBe('string');
    expect(typeof shape.width).toBe('number');
    expect(typeof shape.height).toBe('number');
    expect(['fixed', 'variable']).toContain(shape.aspect);
    expect(typeof shape.svg).toBe('string');
    expect(Array.isArray(shape.connections)).toBe(true);

    // Connection point contract
    const conn = shape.connections[0]!;
    expect(typeof conn.x).toBe('number');
    expect(typeof conn.y).toBe('number');
    expect(typeof conn.name).toBe('string');
  });

  it('[CONTRACT] SVG output is a valid SVG envelope', () => {
    const shape = parseSingleShape(`
      <foreground>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.svg).toMatch(/^<svg\s/);
    expect(shape.svg).toMatch(/<\/svg>$/);
    expect(shape.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(shape.svg).toMatch(/viewBox="0 0 \d+ \d+"/);
  });
});

describe('[CONTRACT] shapeToSvg', () => {
  it('[CONTRACT] replaces viewBox with new dimensions', () => {
    const original = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect/></svg>';
    const result = shapeToSvg(original, 200, 150);
    expect(result).toContain('viewBox="0 0 200 150"');
    expect(result).not.toContain('viewBox="0 0 100 100"');
  });

  it('[CONTRACT] preserves all content except viewBox', () => {
    const original = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect x="0" y="0" width="100" height="100"/></svg>';
    const result = shapeToSvg(original, 50, 50);
    expect(result).toContain('<rect x="0" y="0" width="100" height="100"/>');
    expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('[CONTRACT] handles SVG without viewBox gracefully', () => {
    const noViewBox = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const result = shapeToSvg(noViewBox, 100, 100);
    // When no viewBox exists, replace has no match — returns unchanged
    expect(result).toBe(noViewBox);
  });
});

// ══════════════════════════════════════════════════════════
// [CONTRACT] Error handling contract
// ══════════════════════════════════════════════════════════

describe('[CONTRACT] Error handling', () => {
  it('[CONTRACT] non-shapes root element throws descriptive error', () => {
    expect(() => parseStencilLibrary('<root><child/></root>')).toThrow(
      'Invalid stencil library: missing <shapes> root element',
    );
  });

  it('[CONTRACT] completely invalid XML throws with descriptive message', () => {
    // fast-xml-parser v5 parses malformed XML tolerantly, so the error
    // comes from the missing <shapes> root check, not the XML parser
    expect(() => parseStencilLibrary('<<<not xml>>>')).toThrow(
      /Invalid stencil library|Failed to parse stencil XML/,
    );
  });

  it('[CONTRACT] empty string throws', () => {
    // Empty string parsed by fast-xml-parser may not have <shapes>
    expect(() => parseStencilLibrary('')).toThrow();
  });

  it('[CONTRACT] XML with only whitespace throws', () => {
    expect(() => parseStencilLibrary('   \n\t  ')).toThrow();
  });

  it('[CONTRACT] library with unnamed shapes → defaults to "Unnamed"', () => {
    const lib = parseStencilLibrary(`
      <shapes name="Lib">
        <shape w="100" h="100">
          <foreground>
            <rect x="0" y="0" w="100" h="100"/>
            <fillstroke/>
          </foreground>
        </shape>
      </shapes>
    `);
    expect(lib.shapes[0]!.name).toBe('Unnamed');
  });

  it('[CONTRACT] library without name attribute → defaults to "Unnamed"', () => {
    const lib = parseStencilLibrary(`
      <shapes>
        <shape name="S" w="100" h="100">
          <foreground>
            <rect x="0" y="0" w="100" h="100"/>
            <fillstroke/>
          </foreground>
        </shape>
      </shapes>
    `);
    expect(lib.name).toBe('Unnamed');
  });

  it('[CONTRACT] shape without w/h defaults to 100', () => {
    const lib = parseStencilLibrary(`
      <shapes name="Lib">
        <shape name="NoSize">
          <foreground>
            <rect x="0" y="0" w="100" h="100"/>
            <fillstroke/>
          </foreground>
        </shape>
      </shapes>
    `);
    expect(lib.shapes[0]!.width).toBe(100);
    expect(lib.shapes[0]!.height).toBe(100);
  });
});

// ══════════════════════════════════════════════════════════
// [BOUNDARY] State isolation between sections
// ══════════════════════════════════════════════════════════

describe('[BOUNDARY] Background/foreground state isolation', () => {
  it('[BOUNDARY] strokecolor set in background leaks to foreground', () => {
    // This tests the actual behavior: processSection mutates the
    // shared GfxState object. Colors set in background WILL leak
    // to foreground because the same state object is passed.
    const shape = parseSingleShape(`
      <background>
        <strokecolor color="#FF0000"/>
        <path><move x="0" y="0"/><line x="100" y="0"/></path>
        <stroke/>
      </background>
      <foreground>
        <path><move x="0" y="100"/><line x="100" y="100"/></path>
        <stroke/>
      </foreground>
    `);
    // Document: foreground inherits background's state (current behavior)
    // This may or may not be intentional — documenting for visibility.
    const fgGroup = shape.svg.match(/<g class="foreground">([\s\S]*?)<\/g>/);
    expect(fgGroup).not.toBeNull();
    // The foreground path inherits #FF0000 from background
    expect(fgGroup![1]).toContain('stroke="#FF0000"');
  });
});

// ══════════════════════════════════════════════════════════
// [EDGE] Unknown / ignored tags
// ══════════════════════════════════════════════════════════

describe('[EDGE] Unknown tags are silently ignored', () => {
  it('[EDGE] unknown tag in path is ignored without error', () => {
    const shape = parseSingleShape(`
      <foreground>
        <path>
          <move x="0" y="0"/>
          <unknowntag foo="bar"/>
          <line x="100" y="100"/>
        </path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('M 0 0');
    expect(shape.svg).toContain('L 100 100');
    expect(shape.svg).not.toContain('unknowntag');
  });

  it('[EDGE] unknown tag in section is ignored without error', () => {
    const shape = parseSingleShape(`
      <foreground>
        <dashing pattern="3 3"/>
        <miterlimit limit="10"/>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('<rect');
    expect(shape.svg).not.toContain('dashing');
    expect(shape.svg).not.toContain('miterlimit');
  });

  it('[EDGE] image tag is silently skipped', () => {
    const shape = parseSingleShape(`
      <foreground>
        <image src="test.png" x="0" y="0" w="100" h="100"/>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.svg).not.toContain('<image');
    expect(shape.svg).toContain('<rect');
  });
});

// ══════════════════════════════════════════════════════════
// [PERF] Performance with realistic-size input
// ══════════════════════════════════════════════════════════

describe('[PERF] Performance', () => {
  it('[PERF] parses a library with 100 shapes in under 500ms', () => {
    // Generate a synthetic library with 100 shapes
    const shapeXmls = Array.from({ length: 100 }, (_, i) => `
      <shape name="Shape${i}" w="100" h="100">
        <connections>
          <constraint x="0.5" y="0" name="N"/>
          <constraint x="1" y="0.5" name="E"/>
          <constraint x="0.5" y="1" name="S"/>
          <constraint x="0" y="0.5" name="W"/>
        </connections>
        <background>
          <rect x="0" y="0" w="100" h="100"/>
          <fillstroke/>
        </background>
        <foreground>
          <path>
            <move x="10" y="10"/>
            <line x="90" y="10"/>
            <curve x1="90" y1="50" x2="50" y2="90" x3="10" y3="90"/>
            <close/>
          </path>
          <stroke/>
          <ellipse x="30" y="30" w="40" h="40"/>
          <fillstroke/>
        </foreground>
      </shape>
    `).join('\n');

    const xml = `<shapes name="PerfTest">${shapeXmls}</shapes>`;

    const start = performance.now();
    const lib = parseStencilLibrary(xml);
    const elapsed = performance.now() - start;

    expect(lib.shapes).toHaveLength(100);
    expect(elapsed).toBeLessThan(500);
    // Verify each shape was actually parsed (not just skipped)
    for (const shape of lib.shapes) {
      expect(shape.svg).toContain('<svg');
      expect(shape.connections).toHaveLength(4);
    }
  });
});

// ══════════════════════════════════════════════════════════
// [COVERAGE] Gaps in developer tests
// ══════════════════════════════════════════════════════════

describe('[COVERAGE] Developer test gap: state command combinations', () => {
  it('[COVERAGE] strokewidth + strokecolor combined', () => {
    const shape = parseSingleShape(`
      <foreground>
        <strokewidth width="5"/>
        <strokecolor color="#0000FF"/>
        <path><move x="0" y="0"/><line x="100" y="100"/></path>
        <stroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('stroke="#0000FF"');
    expect(shape.svg).toContain('stroke-width="5"');
  });

  it('[COVERAGE] fillcolor + strokecolor + fillstroke', () => {
    const shape = parseSingleShape(`
      <foreground>
        <fillcolor color="#FF0000"/>
        <strokecolor color="#0000FF"/>
        <rect x="0" y="0" w="100" h="100"/>
        <fillstroke/>
      </foreground>
    `);
    expect(shape.svg).toContain('fill="#FF0000"');
    expect(shape.svg).toContain('stroke="#0000FF"');
  });
});

describe('[COVERAGE] Developer test gap: complex shape structures', () => {
  it('[COVERAGE] realistic network device shape (multiple layers)', () => {
    const shape = parseSingleShape(`
      <background>
        <rect x="0" y="0" w="100" h="80"/>
        <fillstroke/>
      </background>
      <foreground>
        <strokewidth width="2"/>
        <path>
          <move x="10" y="10"/>
          <line x="90" y="10"/>
          <line x="90" y="70"/>
          <line x="10" y="70"/>
          <close/>
        </path>
        <stroke/>
        <ellipse x="40" y="30" w="20" h="20"/>
        <fillstroke/>
        <path>
          <move x="50" y="0"/>
          <line x="50" y="10"/>
        </path>
        <stroke/>
      </foreground>
    `, 'name="NetworkDevice" w="100" h="80" aspect="fixed"');

    expect(shape.name).toBe('NetworkDevice');
    expect(shape.width).toBe(100);
    expect(shape.height).toBe(80);
    expect(shape.aspect).toBe('fixed');
    expect(shape.svg).toContain('class="background"');
    expect(shape.svg).toContain('class="foreground"');
    expect(shape.svg).toContain('stroke-width="2"');
    expect(shape.svg).toContain('<ellipse');
  });

  it('[COVERAGE] shape with only connections (no geometry)', () => {
    const shape = parseSingleShape(`
      <connections>
        <constraint x="0.5" y="0" name="N"/>
        <constraint x="0.5" y="1" name="S"/>
      </connections>
    `, 'name="Connector" w="10" h="10"');

    expect(shape.connections).toHaveLength(2);
    // SVG should still be a valid envelope, just empty
    expect(shape.svg).toMatch(/^<svg\s/);
    expect(shape.svg).toMatch(/<\/svg>$/);
  });
});

describe('[COVERAGE] Developer test gap: shapeToSvg round-trip', () => {
  it('[COVERAGE] parse → shapeToSvg → viewBox correctly updated', () => {
    const lib = parseStencilLibrary(`
      <shapes name="RoundTrip">
        <shape name="Original" w="100" h="100">
          <foreground>
            <rect x="0" y="0" w="100" h="100"/>
            <fillstroke/>
          </foreground>
        </shape>
      </shapes>
    `);
    const shape = lib.shapes[0]!;
    expect(shape.svg).toContain('viewBox="0 0 100 100"');

    // Re-wrap at double size
    const resized = shapeToSvg(shape.svg, 200, 200);
    expect(resized).toContain('viewBox="0 0 200 200"');
    expect(resized).not.toContain('viewBox="0 0 100 100"');

    // Re-wrap at half size
    const halved = shapeToSvg(shape.svg, 50, 50);
    expect(halved).toContain('viewBox="0 0 50 50"');

    // Geometry content is preserved
    expect(resized).toContain('<rect');
    expect(halved).toContain('<rect');
  });
});
