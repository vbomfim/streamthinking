/**
 * Annotation tools for the MCP server.
 *
 * These tools add supplementary information to existing canvas expressions:
 * comments, callouts, and highlights.
 *
 * @module
 */

import type {
  VisualExpression,
  CommentData,
  CalloutData,
  HighlightData,
} from '@infinicanvas/protocol';
import { buildExpression } from '../expressionFactory.js';
import type { IGatewayClient } from '../gatewayClient.js';

// ── Tool parameter types ───────────────────────────────────

export interface AnnotateParams {
  targetId: string;
  text: string;
  position?: CalloutData['position'];
}

export interface HighlightParams {
  elementIds: string[];
  color?: string;
}

export interface AddCommentParams {
  targetId: string;
  text: string;
}

// ── Build functions ────────────────────────────────────────

/** Build a callout annotation expression. */
export function buildAnnotation(params: AnnotateParams): VisualExpression {
  const data: CalloutData = {
    kind: 'callout',
    text: params.text,
    targetExpressionId: params.targetId,
    position: params.position ?? 'right',
  };

  // Position near the target — offset based on position direction
  return buildExpression(
    'callout',
    { x: 0, y: 0 }, // Actual position depends on target — gateway resolves
    { width: 200, height: 80 },
    data,
  );
}

/** Build a highlight annotation expression. */
export function buildHighlight(params: HighlightParams): VisualExpression {
  if (params.elementIds.length === 0) {
    throw new Error('Highlight requires at least one element ID');
  }

  const data: HighlightData = {
    kind: 'highlight',
    targetExpressionIds: params.elementIds,
    color: params.color ?? '#FFEB3B',
  };

  return buildExpression(
    'highlight',
    { x: 0, y: 0 },
    { width: 100, height: 100 },
    data,
  );
}

/** Build a comment annotation expression. */
export function buildComment(params: AddCommentParams): VisualExpression {
  const data: CommentData = {
    kind: 'comment',
    text: params.text,
    targetExpressionId: params.targetId,
    resolved: false,
  };

  return buildExpression(
    'comment',
    { x: 0, y: 0 },
    { width: 250, height: 100 },
    data,
  );
}

// ── Tool executors (send to gateway) ───────────────────────

export async function executeAnnotate(
  client: IGatewayClient,
  params: AnnotateParams,
): Promise<string> {
  const expr = buildAnnotation(params);
  await client.sendCreate(expr);
  const preview = params.text.length > 40 ? params.text.slice(0, 40) + '…' : params.text;
  return `Created annotation '${preview}' on element ${params.targetId} [id: ${expr.id}]`;
}

export async function executeHighlight(
  client: IGatewayClient,
  params: HighlightParams,
): Promise<string> {
  const expr = buildHighlight(params);
  await client.sendCreate(expr);
  return `Highlighted ${params.elementIds.length} elements with color ${params.color ?? '#FFEB3B'} [id: ${expr.id}]`;
}

export async function executeAddComment(
  client: IGatewayClient,
  params: AddCommentParams,
): Promise<string> {
  const expr = buildComment(params);
  await client.sendCreate(expr);
  const preview = params.text.length > 40 ? params.text.slice(0, 40) + '…' : params.text;
  return `Added comment '${preview}' on element ${params.targetId} [id: ${expr.id}]`;
}
