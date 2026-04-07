/**
 * draw.io export/import tools — serialize canvas to/from mxGraphModel XML.
 *
 * Export: reads current canvas state and converts to draw.io XML.
 * Import: parses draw.io XML and creates expressions on the canvas.
 *
 * Uses the draw.io serializer from @infinicanvas/protocol.
 *
 * @module
 */

import { expressionsToDrawio, drawioToExpressions } from '@infinicanvas/protocol';
import type { IGatewayClient } from '../gatewayClient.js';

/**
 * Export the current canvas state as draw.io XML.
 *
 * Reads all expressions from the gateway client and serializes them
 * into mxGraphModel XML format compatible with draw.io/diagrams.net.
 */
export function executeExportDrawio(client: IGatewayClient): string {
  const expressions = client.getState();
  return expressionsToDrawio(expressions);
}

/**
 * Import draw.io XML and create expressions on the canvas.
 *
 * Parses the provided mxGraphModel XML, converts cells to
 * VisualExpressions, and batch-creates them via the gateway client.
 *
 * @returns Human-readable result message with count of imported expressions.
 */
export async function executeImportDrawio(
  client: IGatewayClient,
  params: { xml: string },
): Promise<string> {
  if (!params.xml || params.xml.trim().length === 0) {
    return 'Import failed: empty XML input.';
  }

  // Pre-flight: reject input that isn't draw.io XML before parsing
  if (!params.xml.includes('<mxGraphModel')) {
    return 'Import failed: XML does not contain a <mxGraphModel> element.';
  }

  let expressions;
  try {
    expressions = drawioToExpressions(params.xml);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Import failed: invalid draw.io XML — ${message}`;
  }

  if (expressions.length === 0) {
    return 'Imported 0 expressions — the draw.io file contained no drawable cells.';
  }

  await client.sendBatchCreate(expressions);
  return `Successfully imported ${expressions.length} expression(s) from draw.io XML.`;
}
