/**
 * Tests for draw.io export/import MCP tools.
 *
 * Verifies canvas-to-drawio export, drawio-to-canvas import,
 * and error handling for invalid XML input.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
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

// ── canvas_export_drawio ──────────────────────────────────

describe('executeExportDrawio', () => {
  let client: IGatewayClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('returns valid XML containing mxGraphModel', () => {
    const expressions = [
      createExpression({
        id: 'rect-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Box' },
        position: { x: 100, y: 200 },
        size: { width: 160, height: 80 },
      }),
    ];
    client = createMockClient(expressions);

    const result = executeExportDrawio(client);
    expect(result).toContain('mxGraphModel');
    expect(result).toContain('<?xml');
  });

  it('returns XML with expression data preserved', () => {
    const expressions = [
      createExpression({
        id: 'rect-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'My Box' },
        position: { x: 50, y: 75 },
        size: { width: 200, height: 100 },
      }),
    ];
    client = createMockClient(expressions);

    const result = executeExportDrawio(client);
    expect(result).toContain('My Box');
  });

  it('returns empty-canvas XML when no expressions exist', () => {
    const result = executeExportDrawio(client);
    expect(result).toContain('mxGraphModel');
    // Should still be valid XML, just with no user cells beyond root cells
  });

  it('calls getState on the gateway client', () => {
    executeExportDrawio(client);
    expect(client.getState).toHaveBeenCalledOnce();
  });

  it('handles multiple expressions', () => {
    const expressions = [
      createExpression({
        id: 'r1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'A' },
      }),
      createExpression({
        id: 'e1',
        kind: 'ellipse',
        data: { kind: 'ellipse', label: 'B' },
      }),
    ];
    client = createMockClient(expressions);

    const result = executeExportDrawio(client);
    expect(result).toContain('mxGraphModel');
    // Both expressions should be in the output
    expect(result).toContain('A');
    expect(result).toContain('B');
  });
});

// ── canvas_import_drawio ──────────────────────────────────

describe('executeImportDrawio', () => {
  let client: IGatewayClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('creates expressions from valid draw.io XML', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="cell-1" value="Hello" style="rounded=0;" vertex="1" parent="1">
      <mxGeometry x="100" y="200" width="160" height="80" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

    const result = await executeImportDrawio(client, { xml });
    expect(client.sendBatchCreate).toHaveBeenCalledOnce();

    // Verify the batch contains the parsed expression
    const batchArg = vi.mocked(client.sendBatchCreate).mock.calls[0]![0];
    expect(batchArg).toHaveLength(1);
    expect(batchArg[0]!.position).toEqual({ x: 100, y: 200 });
    expect(batchArg[0]!.size).toEqual({ width: 160, height: 80 });

    expect(result).toContain('1');
    expect(result).toContain('imported');
  });

  it('imports multiple expressions', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="cell-1" value="First" style="" vertex="1" parent="1">
      <mxGeometry x="0" y="0" width="100" height="50" as="geometry"/>
    </mxCell>
    <mxCell id="cell-2" value="Second" style="" vertex="1" parent="1">
      <mxGeometry x="200" y="0" width="100" height="50" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

    const result = await executeImportDrawio(client, { xml });
    const batchArg = vi.mocked(client.sendBatchCreate).mock.calls[0]![0];
    expect(batchArg).toHaveLength(2);
    expect(result).toContain('2');
  });

  it('returns error message for invalid XML', async () => {
    const invalidXml = '<not-valid><<<>>>';
    const result = await executeImportDrawio(client, { xml: invalidXml });
    expect(result.toLowerCase()).toMatch(/error|failed|invalid/);
    expect(client.sendBatchCreate).not.toHaveBeenCalled();
  });

  it('returns error message for empty XML', async () => {
    const result = await executeImportDrawio(client, { xml: '' });
    expect(result.toLowerCase()).toMatch(/error|failed|invalid|empty/);
    expect(client.sendBatchCreate).not.toHaveBeenCalled();
  });

  it('returns success message with expression count', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="cell-1" value="Test" style="" vertex="1" parent="1">
      <mxGeometry x="0" y="0" width="120" height="60" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

    const result = await executeImportDrawio(client, { xml });
    expect(result).toContain('1');
    expect(result).toContain('import');
  });

  it('handles XML with no drawable cells gracefully', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
  </root>
</mxGraphModel>`;

    const result = await executeImportDrawio(client, { xml });
    // Should succeed but import 0 expressions
    expect(result).toContain('0');
    // Should not call sendBatchCreate with empty array or not at all
  });
});
