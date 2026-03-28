/**
 * Canvas query tools for the MCP server.
 *
 * Provides structured query capabilities: filter expressions by kind,
 * bounding box, tags, and label text. Also supports fetching full
 * expression details by ID.
 *
 * All queries resolve locally against cached state — no gateway
 * round-trip needed.
 *
 * @module
 */

import type { VisualExpression } from '@infinicanvas/protocol';
import type { IGatewayClient } from '../gatewayClient.js';
import { getExpressionLabel } from './managementTools.js';

// ── Constants ──────────────────────────────────────────────

/** Maximum number of expressions returned in a single query. */
const MAX_RESULTS = 100;

// ── Tool parameter types ───────────────────────────────────

export interface CanvasQueryParams {
  kind?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  tags?: string[];
  labelContains?: string;
}

export interface GetExpressionParams {
  expressionId: string;
}

// ── Geometry helpers ───────────────────────────────────────

/**
 * Check whether an expression's bounding box overlaps a query region.
 *
 * Uses axis-aligned bounding-box (AABB) overlap test.
 * Edge-touching (zero overlap) is NOT considered an intersection.
 */
export function intersects(
  expr: VisualExpression,
  bounds: { x: number; y: number; width: number; height: number },
): boolean {
  const exprRight = expr.position.x + expr.size.width;
  const exprBottom = expr.position.y + expr.size.height;
  const boundsRight = bounds.x + bounds.width;
  const boundsBottom = bounds.y + bounds.height;

  // No overlap if one rectangle is completely to the left/right/above/below the other
  if (exprRight <= bounds.x) return false;
  if (expr.position.x >= boundsRight) return false;
  if (exprBottom <= bounds.y) return false;
  if (expr.position.y >= boundsBottom) return false;

  return true;
}

// ── Query result type ──────────────────────────────────────

interface ExpressionSummary {
  id: string;
  kind: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  label: string | undefined;
  tags: string[];
  author: VisualExpression['meta']['author'];
}

interface QueryResult {
  count: number;
  truncated: boolean;
  total: number;
  expressions: ExpressionSummary[];
}

// ── Tool executors ─────────────────────────────────────────

/**
 * Query the canvas for expressions matching optional filters.
 *
 * All filters combine with AND logic. No filters returns all expressions.
 * Results are capped at 100; excess results set `truncated: true`.
 */
export async function executeCanvasQuery(
  client: IGatewayClient,
  params: CanvasQueryParams,
): Promise<string> {
  const expressions = client.getState();

  const filtered = expressions.filter((expr) => {
    // Kind filter
    if (params.kind !== undefined && expr.kind !== params.kind) {
      return false;
    }

    // Bounds filter (overlap, not containment)
    if (params.bounds !== undefined && !intersects(expr, params.bounds)) {
      return false;
    }

    // Tags filter (expression must have ALL specified tags)
    if (params.tags !== undefined && params.tags.length > 0) {
      const exprTags = expr.meta.tags;
      if (!params.tags.every((tag) => exprTags.includes(tag))) {
        return false;
      }
    }

    // Label filter (case-insensitive substring match)
    if (params.labelContains !== undefined) {
      const label = getExpressionLabel(expr);
      if (label === undefined) return false;
      if (!label.toLowerCase().includes(params.labelContains.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  const total = filtered.length;
  const truncated = total > MAX_RESULTS;
  const capped = truncated ? filtered.slice(0, MAX_RESULTS) : filtered;

  const result: QueryResult = {
    count: capped.length,
    truncated,
    total,
    expressions: capped.map((expr) => ({
      id: expr.id,
      kind: expr.kind,
      position: expr.position,
      size: expr.size,
      label: getExpressionLabel(expr),
      tags: expr.meta.tags,
      author: expr.meta.author,
    })),
  };

  return JSON.stringify(result);
}

/**
 * Get the full details of a single expression by ID.
 *
 * Returns the complete VisualExpression as JSON.
 * Throws if the expression is not found.
 */
export async function executeGetExpression(
  client: IGatewayClient,
  params: GetExpressionParams,
): Promise<string> {
  const expressions = client.getState();
  const target = expressions.find((e) => e.id === params.expressionId);

  if (!target) {
    throw new Error(`Expression '${params.expressionId}' not found on canvas`);
  }

  return JSON.stringify(target);
}
