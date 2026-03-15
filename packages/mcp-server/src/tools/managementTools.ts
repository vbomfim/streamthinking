/**
 * Canvas management tools for the MCP server.
 *
 * These tools provide state inspection and mutation capabilities:
 * get canvas state, clear all expressions, and morph expression kinds.
 *
 * @module
 */

import type { VisualExpression, ExpressionKind } from '@infinicanvas/protocol';
import type { IGatewayClient } from '../gatewayClient.js';

// ── Tool parameter types ───────────────────────────────────

export interface MorphParams {
  elementId: string;
  toKind: ExpressionKind;
}

// ── Tool implementations ───────────────────────────────────

/** Format canvas state into a readable summary. */
export function formatCanvasState(expressions: VisualExpression[]): string {
  if (expressions.length === 0) {
    return 'Canvas is empty — no expressions on the canvas.';
  }

  const lines = [`Canvas has ${expressions.length} expression(s):\n`];

  for (const expr of expressions) {
    const label = getExpressionLabel(expr);
    const labelStr = label ? ` — "${label}"` : '';
    lines.push(
      `  • [${expr.id}] ${expr.kind}${labelStr} at (${expr.position.x}, ${expr.position.y}) size ${expr.size.width}×${expr.size.height}`,
    );
  }

  return lines.join('\n');
}

/** Extract a human-readable label from an expression's data. */
function getExpressionLabel(expr: VisualExpression): string | undefined {
  const data = expr.data;

  switch (data.kind) {
    case 'rectangle':
    case 'ellipse':
    case 'diamond':
      return data.label;
    case 'text':
      return data.text.length > 50 ? data.text.slice(0, 50) + '…' : data.text;
    case 'sticky-note':
      return data.text.length > 50 ? data.text.slice(0, 50) + '…' : data.text;
    case 'flowchart':
    case 'wireframe':
    case 'roadmap':
    case 'kanban':
      return data.title;
    case 'sequence-diagram':
      return data.title;
    case 'mind-map':
      return data.centralTopic;
    case 'reasoning-chain':
      return data.question.length > 50 ? data.question.slice(0, 50) + '…' : data.question;
    case 'comment':
    case 'callout':
      return data.text.length > 50 ? data.text.slice(0, 50) + '…' : data.text;
    case 'highlight':
      return `${data.targetExpressionIds.length} elements`;
    case 'marker':
      return data.label;
    default:
      return undefined;
  }
}

// ── Tool executors ─────────────────────────────────────────

/** Get the current canvas state as a formatted summary. */
export async function executeGetState(
  client: IGatewayClient,
): Promise<string> {
  const expressions = client.getState();
  return formatCanvasState(expressions);
}

/** Clear all expressions from the canvas. */
export async function executeClear(
  client: IGatewayClient,
): Promise<string> {
  const expressions = client.getState();

  if (expressions.length === 0) {
    return 'Canvas is already empty.';
  }

  const ids = expressions.map((e) => e.id);
  await client.sendDelete(ids);
  return `Cleared canvas — removed ${ids.length} expression(s).`;
}

/** Morph an expression to a different visual kind. */
export async function executeMorph(
  client: IGatewayClient,
  params: MorphParams,
): Promise<string> {
  const expressions = client.getState();
  const target = expressions.find((e) => e.id === params.elementId);

  if (!target) {
    throw new Error(`Expression '${params.elementId}' not found on canvas`);
  }

  if (target.kind === params.toKind) {
    return `Expression '${params.elementId}' is already a ${params.toKind}.`;
  }

  // Create minimal data for the new kind
  const newData = createMinimalData(params.toKind, target);

  await client.sendMorph(
    params.elementId,
    target.kind,
    params.toKind,
    newData,
  );

  return `Morphed expression '${params.elementId}' from ${target.kind} to ${params.toKind}.`;
}

/** Create minimal valid data for a given expression kind, preserving label if possible. */
function createMinimalData(
  kind: ExpressionKind,
  source: VisualExpression,
): VisualExpression['data'] {
  // Try to preserve the label from the source
  const label = getExpressionLabel(source);

  switch (kind) {
    case 'rectangle':
      return { kind: 'rectangle', label };
    case 'ellipse':
      return { kind: 'ellipse', label };
    case 'diamond':
      return { kind: 'diamond', label };
    case 'text':
      return {
        kind: 'text',
        text: label ?? '',
        fontSize: 16,
        fontFamily: 'sans-serif',
        textAlign: 'left',
      };
    case 'sticky-note':
      return { kind: 'sticky-note', text: label ?? '', color: '#FFEB3B' };
    default:
      // For complex kinds, we can't create meaningful minimal data
      // Return a rectangle as a safe fallback
      return { kind: 'rectangle', label };
  }
}
