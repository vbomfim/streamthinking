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
export function getExpressionLabel(expr: VisualExpression): string | undefined {
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
    case 'container':
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

/** Format canvas state as structured JSON for machine consumption. */
export function formatStructuredState(expressions: VisualExpression[]): string {
  const summaries = expressions.map((expr) => ({
    id: expr.id,
    kind: expr.kind,
    position: expr.position,
    size: expr.size,
    label: getExpressionLabel(expr),
    tags: expr.meta.tags,
  }));

  return JSON.stringify({ count: expressions.length, expressions: summaries });
}

// ── Tool executors ─────────────────────────────────────────

/** Get the current canvas state as a formatted summary. */
export async function executeGetState(
  client: IGatewayClient,
): Promise<string> {
  const expressions = client.getState();
  return formatCanvasState(expressions);
}

/** Delete specific expressions from the canvas by ID. */
export async function executeDeleteExpression(
  client: IGatewayClient,
  expressionIds: string[],
): Promise<string> {
  const existing = client.getState();
  const existingIds = new Set(existing.map((e) => e.id));

  const found = expressionIds.filter((id) => existingIds.has(id));
  const notFound = expressionIds.filter((id) => !existingIds.has(id));

  if (found.length === 0) {
    return `No matching expressions found. IDs not on canvas: ${notFound.join(', ')}`;
  }

  await client.sendDelete(found);

  let msg = `Deleted ${found.length} expression(s).`;
  if (notFound.length > 0) {
    msg += ` ${notFound.length} ID(s) not found: ${notFound.join(', ')}`;
  }
  return msg;
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
    case 'container':
      return {
        kind: 'container',
        title: label ?? 'Container',
        headerHeight: 40,
        padding: 20,
        collapsed: false,
      };
    default:
      // For complex kinds, we can't create meaningful minimal data
      // Return a rectangle as a safe fallback
      return { kind: 'rectangle', label };
  }
}
