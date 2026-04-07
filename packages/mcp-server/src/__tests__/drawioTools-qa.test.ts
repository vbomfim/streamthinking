/**
 * QA Guardian — Integration, contract, and edge-case tests for draw.io tools.
 *
 * Tests the MCP tool layer (drawioTools.ts) at integration boundaries:
 * round-trip fidelity, error handling, gateway interaction, and edge cases
 * not covered by Developer unit tests.
 *
 * Does NOT duplicate protocol-level serializer tests (drawio.test.ts, drawio-qa.test.ts).
 * Tests BEHAVIOR through the public interface, not implementation details.
 *
 * Ticket #91 — draw.io Export/Import
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
import { drawioToExpressions } from '@infinicanvas/protocol';
import type { IGatewayClient } from '../gatewayClient.js';
import {
  executeExportDrawio,
  executeImportDrawio,
} from '../tools/drawioTools.js';
import { DEFAULT_STYLE, MCP_AUTHOR } from '../defaults.js';

// ── Test helpers ───────────────────────────────────────────

function createExpression(
  overrides: Partial<VisualExpression> & { id: string; kind: VisualExpression['kind'] },
): VisualExpression {
  const now = Date.now();
  return {
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    angle: 0,
    style: { ...DEFAULT_STYLE },
    meta: {
      author: MCP_AUTHOR,
      createdAt: now,
      updatedAt: now,
      tags: [],
      locked: false,
    },
    data: { kind: 'rectangle' as const, label: undefined },
    ...overrides,
  };
}

function createMockClient(expressions: VisualExpression[] = []): IGatewayClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    getSessionId: vi.fn().mockReturnValue('test-session'),
    sendCreate: vi.fn().mockResolvedValue(undefined),
    sendBatchCreate: vi.fn().mockResolvedValue(undefined),
    sendDelete: vi.fn().mockResolvedValue(undefined),
    sendMorph: vi.fn().mockResolvedValue(undefined),
    sendStyle: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockReturnValue(expressions),
  };
}

// Valid draw.io XML for reuse across tests
const VALID_DRAWIO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="cell-1" value="Hello" style="rounded=1;fillColor=#ffffff;strokeColor=#000000;whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="100" y="200" width="160" height="80" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

// ── [AC-3][AC-4] Round-trip fidelity ─────────────────────

describe('[AC-3][AC-4] Export → Import round-trip fidelity', () => {
  it('[AC-3][AC-4] rectangle survives export → import round-trip', () => {
    const expressions = [
      createExpression({
        id: 'rect-rt',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Round Trip' },
        position: { x: 100, y: 200 },
        size: { width: 160, height: 80 },
      }),
    ];
    const client = createMockClient(expressions);

    // Export
    const xml = executeExportDrawio(client);

    // Import the exported XML via the protocol deserializer
    const imported = drawioToExpressions(xml);
    expect(imported).toHaveLength(1);
    expect(imported[0]!.position).toEqual({ x: 100, y: 200 });
    expect(imported[0]!.size).toEqual({ width: 160, height: 80 });
    // Label should survive (data is kind-specific)
    expect((imported[0]!.data as { label?: string }).label).toBe('Round Trip');
  });

  it('[AC-3][AC-4] multiple expression types survive round-trip', () => {
    const expressions = [
      createExpression({
        id: 'rect-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Box' },
        position: { x: 0, y: 0 },
        size: { width: 120, height: 60 },
      }),
      createExpression({
        id: 'ellipse-1',
        kind: 'ellipse',
        data: { kind: 'ellipse', label: 'Circle' },
        position: { x: 200, y: 0 },
        size: { width: 100, height: 100 },
      }),
      createExpression({
        id: 'text-1',
        kind: 'text',
        data: { kind: 'text', text: 'Label', fontSize: 14, fontFamily: 'sans-serif', textAlign: 'left' as const },
        position: { x: 0, y: 200 },
        size: { width: 80, height: 30 },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    const imported = drawioToExpressions(xml);

    expect(imported).toHaveLength(3);

    // Verify each kind survived
    const kinds = imported.map((e) => e.kind);
    expect(kinds).toContain('rectangle');
    expect(kinds).toContain('ellipse');
    expect(kinds).toContain('text');
  });

  it('[AC-3][AC-4] arrow with bindings survives round-trip', () => {
    const expressions = [
      createExpression({
        id: 'arrow-1',
        kind: 'arrow',
        data: {
          kind: 'arrow',
          points: [[0, 0], [100, 100]] as [number, number][],
          label: 'connects',
          startBinding: { expressionId: 'src', anchor: 'auto' },
          endBinding: { expressionId: 'tgt', anchor: 'auto' },
        },
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    const imported = drawioToExpressions(xml);

    expect(imported).toHaveLength(1);
    expect(imported[0]!.kind).toBe('arrow');

    const arrowData = imported[0]!.data as { kind: string; label?: string; startBinding?: unknown; endBinding?: unknown };
    expect(arrowData.label).toBe('connects');
  });

  it('[AC-3][AC-4] diamond expression survives round-trip', () => {
    const expressions = [
      createExpression({
        id: 'diamond-1',
        kind: 'diamond',
        data: { kind: 'diamond', label: 'Decision' },
        position: { x: 50, y: 50 },
        size: { width: 120, height: 120 },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    const imported = drawioToExpressions(xml);

    expect(imported).toHaveLength(1);
    expect(imported[0]!.kind).toBe('diamond');
    expect((imported[0]!.data as { label?: string }).label).toBe('Decision');
  });

  it('[AC-3][AC-4] sticky note survives round-trip with color', () => {
    const expressions = [
      createExpression({
        id: 'note-1',
        kind: 'sticky-note',
        data: { kind: 'sticky-note', text: 'Remember this', color: '#FF9800' },
        position: { x: 300, y: 300 },
        size: { width: 200, height: 200 },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    const imported = drawioToExpressions(xml);

    expect(imported).toHaveLength(1);
    expect(imported[0]!.kind).toBe('sticky-note');
    const noteData = imported[0]!.data as { text: string; color: string };
    expect(noteData.text).toBe('Remember this');
    expect(noteData.color).toBe('#FF9800');
  });
});

// ── [AC-4] Import gateway interaction ────────────────────

describe('[AC-4] Import creates expressions via gateway', () => {
  let client: IGatewayClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('[AC-4] sendBatchCreate receives correctly structured expressions', async () => {
    const result = await executeImportDrawio(client, { xml: VALID_DRAWIO_XML });

    expect(client.sendBatchCreate).toHaveBeenCalledOnce();
    const batch = vi.mocked(client.sendBatchCreate).mock.calls[0]![0];

    // Verify the expression structure
    expect(batch).toHaveLength(1);
    const expr = batch[0]!;
    expect(expr.id).toBe('cell-1');
    expect(expr.kind).toBe('rectangle');
    expect(expr.position).toEqual({ x: 100, y: 200 });
    expect(expr.size).toEqual({ width: 160, height: 80 });
    expect(result).toContain('1');
  });

  it('[AC-4] import result message includes accurate count', async () => {
    const multiXml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="c1" value="A" style="" vertex="1" parent="1">
      <mxGeometry x="0" y="0" width="100" height="50" as="geometry"/>
    </mxCell>
    <mxCell id="c2" value="B" style="" vertex="1" parent="1">
      <mxGeometry x="200" y="0" width="100" height="50" as="geometry"/>
    </mxCell>
    <mxCell id="c3" value="C" style="" vertex="1" parent="1">
      <mxGeometry x="400" y="0" width="100" height="50" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

    const result = await executeImportDrawio(client, { xml: multiXml });
    expect(result).toContain('3');
    expect(result.toLowerCase()).toContain('import');
  });

  it('[EDGE] sendBatchCreate rejection is not caught — error propagates', async () => {
    const failingClient = createMockClient();
    vi.mocked(failingClient.sendBatchCreate).mockRejectedValue(
      new Error('Gateway connection lost'),
    );

    // The tool does NOT wrap sendBatchCreate in try/catch, so the error propagates.
    // This is correct behavior — the MCP framework handles tool exceptions.
    await expect(
      executeImportDrawio(failingClient, { xml: VALID_DRAWIO_XML }),
    ).rejects.toThrow('Gateway connection lost');
  });

  it('[EDGE] empty drawable cells — sendBatchCreate is not called', async () => {
    const emptyCanvasXml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
  </root>
</mxGraphModel>`;

    const result = await executeImportDrawio(client, { xml: emptyCanvasXml });
    expect(client.sendBatchCreate).not.toHaveBeenCalled();
    expect(result).toContain('0');
  });
});

// ── [AC-3] Export output validation ──────────────────────

describe('[AC-3] Export produces valid draw.io XML', () => {
  it('[AC-3] exported XML is parseable by the draw.io deserializer', () => {
    const expressions = [
      createExpression({
        id: 'verify-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Parseable' },
        position: { x: 10, y: 20 },
        size: { width: 150, height: 75 },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);

    // Should not throw when parsed by the protocol deserializer
    const parsed = drawioToExpressions(xml);
    expect(parsed).toHaveLength(1);
  });

  it('[AC-3] exported XML contains XML declaration', () => {
    const client = createMockClient([]);
    const xml = executeExportDrawio(client);
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  });

  it('[AC-3] exported XML contains infrastructure cells', () => {
    const client = createMockClient([]);
    const xml = executeExportDrawio(client);
    expect(xml).toContain('<mxCell id="0"/>');
    expect(xml).toContain('<mxCell id="1" parent="0"/>');
  });

  it('[AC-3] exported XML contains mxGeometry with position and size', () => {
    const expressions = [
      createExpression({
        id: 'geo-test',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Geo' },
        position: { x: 42, y: 84 },
        size: { width: 200, height: 100 },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    expect(xml).toContain('x="42"');
    expect(xml).toContain('y="84"');
    expect(xml).toContain('width="200"');
    expect(xml).toContain('height="100"');
  });
});

// ── [EDGE] Import error handling ─────────────────────────

describe('[EDGE] Import error handling', () => {
  let client: IGatewayClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('[EDGE] whitespace-only XML returns error', async () => {
    const result = await executeImportDrawio(client, { xml: '   \n\t  ' });
    expect(result.toLowerCase()).toMatch(/empty|failed/);
    expect(client.sendBatchCreate).not.toHaveBeenCalled();
  });

  it('[EDGE] non-drawio XML (valid XML, wrong format) returns error', async () => {
    const htmlXml = '<html><body><p>Not a diagram</p></body></html>';
    const result = await executeImportDrawio(client, { xml: htmlXml });
    expect(result.toLowerCase()).toMatch(/failed|invalid|error|mxgraphmodel/);
    expect(client.sendBatchCreate).not.toHaveBeenCalled();
  });

  it('[EDGE] XML with mxGraphModel text in a non-structural position', async () => {
    // The text "mxGraphModel" appears in a value attribute, not as element
    const trickXml = '<root><item value="mxGraphModel reference"/></root>';
    const result = await executeImportDrawio(client, { xml: trickXml });
    // Even though the string "mxGraphModel" appears, there are no drawable cells
    // The serializer won't find mxGraphModel element structure
    // Should either succeed with 0 expressions or return a descriptive message
    expect(client.sendBatchCreate).not.toHaveBeenCalled();
  });

  it('[EDGE] XML with only infrastructure cells (id 0, 1) returns zero imports', async () => {
    const infraOnlyXml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
  </root>
</mxGraphModel>`;

    const result = await executeImportDrawio(client, { xml: infraOnlyXml });
    expect(result).toContain('0');
    expect(client.sendBatchCreate).not.toHaveBeenCalled();
  });

  it('[EDGE] import does not modify canvas state on parse failure', async () => {
    await executeImportDrawio(client, { xml: '' });
    await executeImportDrawio(client, { xml: '<broken>>>>' });
    await executeImportDrawio(client, { xml: '<xml>valid but wrong</xml>' });

    // None of the above should have called sendBatchCreate
    expect(client.sendBatchCreate).not.toHaveBeenCalled();
  });
});

// ── [EDGE] Special characters and encoding ───────────────

describe('[EDGE] Special characters in export/import', () => {
  it('[EDGE] expression with HTML entities in label exports safely', () => {
    const expressions = [
      createExpression({
        id: 'entities-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'A < B & C > D' },
        position: { x: 0, y: 0 },
        size: { width: 200, height: 100 },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    // Raw unescaped label should NOT appear in the XML
    expect(xml).not.toContain('A < B');
    expect(xml).not.toContain('C > D');
    // Escaped versions should be present
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&gt;');
  });

  it('[EDGE] expression with Unicode characters exports and round-trips', () => {
    const expressions = [
      createExpression({
        id: 'unicode-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: '日本語テスト 🎨 Ñoño' },
        position: { x: 0, y: 0 },
        size: { width: 200, height: 100 },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    const imported = drawioToExpressions(xml);

    expect(imported).toHaveLength(1);
    expect((imported[0]!.data as { label?: string }).label).toBe('日本語テスト 🎨 Ñoño');
  });

  it('[EDGE] expression with quotes in label exports safely', () => {
    const expressions = [
      createExpression({
        id: 'quotes-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'He said "hello" & she said \'hi\'' },
        position: { x: 0, y: 0 },
        size: { width: 250, height: 100 },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    // Should produce valid XML (parseable)
    const imported = drawioToExpressions(xml);
    expect(imported).toHaveLength(1);
  });
});

// ── [EDGE] Boundary values ───────────────────────────────

describe('[EDGE] Boundary values for export/import', () => {
  it('[EDGE] expression at negative coordinates exports and round-trips', () => {
    const expressions = [
      createExpression({
        id: 'neg-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Negative' },
        position: { x: -500, y: -300 },
        size: { width: 100, height: 50 },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    const imported = drawioToExpressions(xml);
    expect(imported[0]!.position).toEqual({ x: -500, y: -300 });
  });

  it('[EDGE] expression with zero dimensions exports correctly', () => {
    const expressions = [
      createExpression({
        id: 'zero-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Zero' },
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    expect(xml).toContain('mxGraphModel');
    // Should not crash
  });

  it('[EDGE] expression with very large coordinates exports correctly', () => {
    const expressions = [
      createExpression({
        id: 'large-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Far Away' },
        position: { x: 999999, y: 999999 },
        size: { width: 100, height: 100 },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    const imported = drawioToExpressions(xml);
    expect(imported[0]!.position).toEqual({ x: 999999, y: 999999 });
  });

  it('[EDGE] empty canvas exports valid XML with zero user cells', () => {
    const client = createMockClient([]);

    const xml = executeExportDrawio(client);
    const imported = drawioToExpressions(xml);
    expect(imported).toHaveLength(0);
    expect(xml).toContain('mxGraphModel');
  });

  it('[EDGE] rotation angle is preserved through export', () => {
    const expressions = [
      createExpression({
        id: 'rotated-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Rotated' },
        position: { x: 100, y: 100 },
        size: { width: 120, height: 60 },
        angle: 45,
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    expect(xml).toContain('rotation=45');

    const imported = drawioToExpressions(xml);
    expect(imported[0]!.angle).toBe(45);
  });
});

// ── [CONTRACT] MCP tool contract ─────────────────────────

describe('[CONTRACT] MCP tool interface contract', () => {
  it('[CONTRACT] export tool returns string (not object, not array)', () => {
    const client = createMockClient([]);
    const result = executeExportDrawio(client);
    expect(typeof result).toBe('string');
  });

  it('[CONTRACT] import tool returns a promise of string', async () => {
    const client = createMockClient();
    const result = executeImportDrawio(client, { xml: VALID_DRAWIO_XML });
    expect(result).toBeInstanceOf(Promise);
    const resolved = await result;
    expect(typeof resolved).toBe('string');
  });

  it('[CONTRACT] import success message mentions count and "import"', async () => {
    const client = createMockClient();
    const result = await executeImportDrawio(client, { xml: VALID_DRAWIO_XML });
    // Must contain the word "import" (case-insensitive) and the count
    expect(result.toLowerCase()).toContain('import');
    expect(result).toMatch(/\d+/);
  });

  it('[CONTRACT] import error messages start with "Import failed:"', async () => {
    const client = createMockClient();

    const emptyResult = await executeImportDrawio(client, { xml: '' });
    expect(emptyResult).toMatch(/^Import failed:/);

    const invalidResult = await executeImportDrawio(client, { xml: '<not>drawio</not>' });
    expect(invalidResult).toMatch(/^Import failed:/);
  });

  it('[CONTRACT] export always returns XML starting with declaration', () => {
    const client = createMockClient([]);
    const xml = executeExportDrawio(client);
    expect(xml.startsWith('<?xml')).toBe(true);
  });
});

// ── [COVERAGE] Scale test ────────────────────────────────

describe('[COVERAGE] Scale and performance', () => {
  it('[COVERAGE] export handles 100 expressions without error', () => {
    const expressions: VisualExpression[] = [];
    for (let i = 0; i < 100; i++) {
      expressions.push(
        createExpression({
          id: `bulk-${i}`,
          kind: 'rectangle',
          data: { kind: 'rectangle', label: `Shape ${i}` },
          position: { x: (i % 10) * 200, y: Math.floor(i / 10) * 150 },
          size: { width: 160, height: 80 },
        }),
      );
    }
    const client = createMockClient(expressions);

    const start = performance.now();
    const xml = executeExportDrawio(client);
    const duration = performance.now() - start;

    // Verify all 100 exported
    const imported = drawioToExpressions(xml);
    expect(imported).toHaveLength(100);

    // Performance: should complete well under 200ms (AC from PO ticket)
    expect(duration).toBeLessThan(200);
  });

  it('[COVERAGE] import handles 100 cells via gateway batch', async () => {
    // Build XML with 100 cells
    const cells = Array.from({ length: 100 }, (_, i) =>
      `    <mxCell id="c${i}" value="Cell ${i}" style="" vertex="1" parent="1">
      <mxGeometry x="${(i % 10) * 200}" y="${Math.floor(i / 10) * 150}" width="160" height="80" as="geometry"/>
    </mxCell>`,
    ).join('\n');

    const bulkXml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
${cells}
  </root>
</mxGraphModel>`;

    const client = createMockClient();

    const start = performance.now();
    const result = await executeImportDrawio(client, { xml: bulkXml });
    const duration = performance.now() - start;

    expect(result).toContain('100');
    expect(client.sendBatchCreate).toHaveBeenCalledOnce();
    const batch = vi.mocked(client.sendBatchCreate).mock.calls[0]![0];
    expect(batch).toHaveLength(100);

    // Performance: should complete well under 200ms
    expect(duration).toBeLessThan(200);
  });
});

// ── [COVERAGE] Style preservation ────────────────────────

describe('[COVERAGE] Visual style preservation through export', () => {
  it('[COVERAGE] dashed stroke exports correctly', () => {
    const expressions = [
      createExpression({
        id: 'dashed-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Dashed' },
        style: { ...DEFAULT_STYLE, strokeStyle: 'dashed' as const },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    expect(xml).toContain('dashed=1');
    expect(xml).toContain('dashPattern=8 5');
  });

  it('[COVERAGE] dotted stroke exports with distinct pattern', () => {
    const expressions = [
      createExpression({
        id: 'dotted-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Dotted' },
        style: { ...DEFAULT_STYLE, strokeStyle: 'dotted' as const },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    expect(xml).toContain('dashed=1');
    expect(xml).toContain('dashPattern=1 3');
  });

  it('[COVERAGE] semi-transparent opacity exports as draw.io percentage', () => {
    const expressions = [
      createExpression({
        id: 'opacity-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Semi' },
        style: { ...DEFAULT_STYLE, opacity: 0.5 },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    expect(xml).toContain('opacity=50');
  });

  it('[COVERAGE] fully opaque does not export redundant opacity', () => {
    const expressions = [
      createExpression({
        id: 'opaque-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Opaque' },
        style: { ...DEFAULT_STYLE, opacity: 1 },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    expect(xml).not.toContain('opacity=');
  });

  it('[COVERAGE] transparent fill exports as fillColor=none', () => {
    const expressions = [
      createExpression({
        id: 'nofill-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'No Fill' },
        style: { ...DEFAULT_STYLE, backgroundColor: 'transparent' },
      }),
    ];
    const client = createMockClient(expressions);

    const xml = executeExportDrawio(client);
    expect(xml).toContain('fillColor=none');
  });
});
