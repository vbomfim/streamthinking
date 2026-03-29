/**
 * Stencil expression tools for the MCP server.
 *
 * These tools place pre-built stencil icons on the canvas and list
 * available stencils from the engine catalog. Used for architecture
 * diagrams with servers, databases, Kubernetes resources, etc.
 *
 * @module
 */

import type { VisualExpression, StencilData } from '@infinicanvas/protocol';
import {
  getStencil,
  getStencilsByCategory,
  getAllCategories,
  STENCIL_CATALOG,
} from '@infinicanvas/engine';
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
  /** Override the default width. */
  width?: number;
  /** Override the default height. */
  height?: number;
}

export interface ListStencilsParams {
  /** Optional category filter (e.g. 'network', 'kubernetes'). */
  category?: string;
}

// ── Tool implementations ───────────────────────────────────

/**
 * Build a stencil VisualExpression from a catalog entry.
 *
 * Looks up the stencilId in the engine catalog, applies optional
 * overrides for label, width, and height, and returns a fully
 * formed VisualExpression with kind 'stencil'.
 *
 * @throws Error if the stencilId is not found in the catalog
 */
export function buildStencil(params: PlaceStencilParams): VisualExpression {
  const entry = getStencil(params.stencilId);

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
 * Looks up the stencil by ID, builds the expression, and sends it
 * to the gateway. Returns an error message (not a thrown error)
 * if the stencil ID is not found, so the MCP tool can gracefully
 * report the issue to the calling AI model.
 */
export async function executePlaceStencil(
  client: IGatewayClient,
  params: PlaceStencilParams,
): Promise<string> {
  let expr: VisualExpression;
  try {
    expr = buildStencil(params);
  } catch (err) {
    const validIds = [...STENCIL_CATALOG.keys()].join(', ');
    return `Unknown stencil '${params.stencilId}'. Valid stencil IDs: ${validIds}`;
  }

  await client.sendCreate(expr);
  const label = (params.label ?? (expr.data as StencilData).label) || params.stencilId;
  return `Placed stencil '${label}' (${expr.size.width}×${expr.size.height}) at (${params.x}, ${params.y}) [id: ${expr.id}]`;
}

/**
 * List available stencils, optionally filtered by category.
 *
 * When no category is provided, returns all stencils grouped by
 * category. When a category is provided, returns only stencils
 * in that category. Returns a formatted text response.
 */
export function executeListStencils(params: ListStencilsParams): string {
  if (params.category) {
    const stencils = getStencilsByCategory(params.category);
    if (stencils.length === 0) {
      const categories = getAllCategories().join(', ');
      return `No stencils found in category '${params.category}'. Available categories: ${categories}`;
    }

    const lines = stencils.map(
      (s) => `  - ${s.id}: ${s.label} (${s.defaultSize.width}×${s.defaultSize.height})`,
    );
    return `Stencils in '${params.category}':\n${lines.join('\n')}`;
  }

  // No category filter — return all grouped by category
  const categories = getAllCategories();
  const sections = categories.map((cat) => {
    const stencils = getStencilsByCategory(cat);
    const lines = stencils.map(
      (s) => `  - ${s.id}: ${s.label} (${s.defaultSize.width}×${s.defaultSize.height})`,
    );
    return `${cat}:\n${lines.join('\n')}`;
  });

  return sections.join('\n\n');
}
