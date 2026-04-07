/**
 * Stencil expression tools for the MCP server.
 *
 * These tools place pre-built stencil icons on the canvas, list
 * available stencils with search/pagination, and provide dedicated
 * stencil search for AI agents. Uses the engine's metadata API
 * for fast sync search without loading SVG data.
 *
 * Supports both eagerly loaded and lazy-loaded stencil categories
 * via the async stencil catalog API.
 *
 * @module
 */

import type { VisualExpression, StencilData } from '@infinicanvas/protocol';
import {
  getStencil,
  getAllStencilMeta,
  STENCIL_CATALOG,
} from '@infinicanvas/engine';
import type { StencilMeta } from '@infinicanvas/engine';
import { buildExpression } from '../expressionFactory.js';
import type { IGatewayClient } from '../gatewayClient.js';

// ── Tool parameter types ───────────────────────────────────

export interface PlaceStencilParams {
  /** Stencil identifier from the catalog (e.g. 'server', 'k8s-pod'). */
  stencilId: string;
  /** Canvas X position. */
  x: number;
  /** Canvas Y position. */
  y: number;
  /** Override the default label text. */
  label?: string;
  /** Label position relative to the stencil icon. */
  labelPosition?: 'below' | 'top-left' | 'top-center' | 'center';
  /** Explicit label font size in pixels. */
  fontSize?: number;
  /** Override the default width. */
  width?: number;
  /** Override the default height. */
  height?: number;
}

export interface ListStencilsParams {
  /** Optional category filter (e.g. 'network', 'kubernetes'). */
  category?: string;
  /** Filter by name substring (case-insensitive, matches id or label). */
  search?: string;
  /** Page number for pagination (default: 1). */
  page?: number;
  /** Number of results per page (default: 50). */
  pageSize?: number;
}

export interface SearchStencilsParams {
  /** Search query — matches against stencil id and label (case-insensitive). */
  query: string;
  /** Optional category filter to narrow results. */
  category?: string;
  /** Maximum number of results to return (default: 10). */
  limit?: number;
}

// ── Internal helpers ───────────────────────────────────────

/**
 * Filter stencil metadata by category and/or search substring.
 *
 * Uses `getAllStencilMeta()` (sync) — no SVG loading required.
 * Search matches against both stencil id and label (case-insensitive).
 */
function filterStencilMeta(
  category?: string,
  search?: string,
): StencilMeta[] {
  let results = getAllStencilMeta();

  if (category) {
    results = results.filter((s) => s.category === category);
  }

  if (search) {
    const query = search.toLowerCase();
    results = results.filter(
      (s) =>
        s.id.toLowerCase().includes(query) ||
        s.label.toLowerCase().includes(query),
    );
  }

  return results;
}

/**
 * Find stencils matching a name query (fuzzy substring match).
 *
 * Returns all stencils whose id or label contains the query
 * substring (case-insensitive). Used for fuzzy name resolution
 * in `executePlaceStencil`.
 */
function findStencilsByName(name: string): StencilMeta[] {
  const query = name.toLowerCase();
  return getAllStencilMeta().filter(
    (s) =>
      s.id.toLowerCase().includes(query) ||
      s.label.toLowerCase().includes(query),
  );
}

// ── Tool implementations ───────────────────────────────────

/**
 * Build a stencil VisualExpression from a catalog entry.
 *
 * Looks up the stencilId in the engine catalog (async — supports
 * lazy-loaded categories), applies optional overrides for label,
 * width, and height, and returns a fully formed VisualExpression.
 *
 * @throws Error if the stencilId is not found in the catalog
 */
export async function buildStencil(params: PlaceStencilParams): Promise<VisualExpression> {
  const entry = await getStencil(params.stencilId);

  if (!entry) {
    const validIds = [...STENCIL_CATALOG.keys()].join(', ');
    throw new Error(
      `Unknown stencil '${params.stencilId}'. Valid stencil IDs: ${validIds}`,
    );
  }

  const data: StencilData = {
    kind: 'stencil',
    stencilId: entry.id,
    category: entry.category,
    label: params.label ?? entry.label,
    labelPosition: params.labelPosition,
    labelFontSize: params.fontSize,
  };

  const width = params.width ?? entry.defaultSize.width;
  const height = params.height ?? entry.defaultSize.height;

  return buildExpression(
    'stencil',
    { x: params.x, y: params.y },
    { width, height },
    data,
  );
}

// ── Tool executors (send to gateway) ───────────────────────

/**
 * Place a stencil on the canvas.
 *
 * Looks up the stencil by exact ID first. If not found, falls back
 * to fuzzy name matching (substring on id/label). If exactly one
 * match is found, places it. If multiple matches, returns the list
 * for the agent to choose from.
 */
export async function executePlaceStencil(
  client: IGatewayClient,
  params: PlaceStencilParams,
): Promise<string> {
  // Try exact ID match first
  let expr: VisualExpression | undefined;
  try {
    expr = await buildStencil(params);
  } catch {
    // Exact match failed — try fuzzy matching
  }

  if (!expr) {
    const matches = findStencilsByName(params.stencilId);

    if (matches.length === 0) {
      const validIds = [...STENCIL_CATALOG.keys()].join(', ');
      return `Unknown stencil '${params.stencilId}'. Valid stencil IDs: ${validIds}`;
    }

    if (matches.length > 1) {
      const lines = matches.map(
        (s) => `  - ${s.id}: ${s.label} (${s.category})`,
      );
      return `Multiple stencils match '${params.stencilId}':\n${lines.join('\n')}\n\nPlease use the exact stencil ID.`;
    }

    // Single fuzzy match — use it
    const resolvedParams = { ...params, stencilId: matches[0]!.id };
    expr = await buildStencil(resolvedParams);
  }

  await client.sendCreate(expr);
  const label = (params.label ?? (expr.data as StencilData).label) || params.stencilId;
  return `Placed stencil '${label}' (${expr.size.width}×${expr.size.height}) at (${params.x}, ${params.y}) [id: ${expr.id}]`;
}

/**
 * List available stencils with optional filtering and pagination.
 *
 * Uses stencil metadata (sync — no SVG loading) for fast results.
 * Returns a JSON response with stencils array, total count, page,
 * and pageSize for structured AI agent consumption.
 */
export async function executeListStencils(params: ListStencilsParams): Promise<string> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;

  const filtered = filterStencilMeta(params.category, params.search);
  const total = filtered.length;

  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  const stencils = paged.map((s) => ({
    id: s.id,
    label: s.label,
    category: s.category,
    defaultSize: s.defaultSize,
  }));

  return JSON.stringify({ stencils, total, page, pageSize });
}

/**
 * Search for stencils by query string.
 *
 * Dedicated search tool for AI agent stencil discovery. Uses
 * metadata search (sync, fast) — no SVG loading needed. Returns
 * matching stencils with id, label, category, and defaultSize.
 */
export async function executeSearchStencils(params: SearchStencilsParams): Promise<string> {
  const limit = params.limit ?? 10;

  const filtered = filterStencilMeta(params.category, params.query);
  const total = filtered.length;
  const results = filtered.slice(0, limit).map((s) => ({
    id: s.id,
    label: s.label,
    category: s.category,
    defaultSize: s.defaultSize,
  }));

  return JSON.stringify({ results, total });
}
