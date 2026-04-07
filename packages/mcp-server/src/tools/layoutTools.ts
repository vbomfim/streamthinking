/**
 * Auto-layout tool for the MCP server.
 *
 * Computes new positions for canvas expressions using layout algorithms
 * (tree, force, grid) and sends position updates via the gateway.
 *
 * @module
 */

import type { IGatewayClient } from '../gatewayClient.js';
import { computeLayout } from '@infinicanvas/engine';
import type { LayoutOptions, LayoutDirection } from '@infinicanvas/engine';

// ── Tool parameter types ───────────────────────────────────

export interface AutoLayoutParams {
  /** Layout algorithm to use. */
  algorithm: 'tree' | 'force' | 'grid';
  /** Direction for tree layout (TB, BT, LR, RL). */
  direction?: LayoutDirection;
  /** Spacing between arranged elements. */
  spacing?: { horizontal: number; vertical: number };
  /** Number of columns for grid layout. */
  columns?: number;
  /** Number of iterations for force layout. */
  iterations?: number;
  /** Scope of layout — 'all' or specific expression IDs. */
  scope?: 'all';
}

// ── Tool implementation ────────────────────────────────────

/**
 * Execute auto-layout on canvas expressions.
 *
 * Gets current canvas state, filters by visibility and lock status,
 * computes new positions, and sends individual position updates.
 *
 * @param client - Gateway client for state access and updates
 * @param params - Layout algorithm and configuration
 * @returns Human-readable summary of what was rearranged
 */
export async function executeAutoLayout(
  client: IGatewayClient,
  params: AutoLayoutParams,
): Promise<string> {
  const allExpressions = client.getState();

  if (allExpressions.length === 0) {
    return 'No expressions on the canvas to layout.';
  }

  // Filter out expressions on hidden or locked layers
  const layers = client.getLayers();
  const visibleLayerIds = new Set(
    layers.filter((l) => l.visible).map((l) => l.id),
  );
  const lockedLayerIds = new Set(
    layers.filter((l) => l.locked).map((l) => l.id),
  );
  // The default layer is always considered visible if not explicitly in the list
  if (!layers.some((l) => l.id === 'default')) {
    visibleLayerIds.add('default');
  }

  const candidates = allExpressions.filter((expr) => {
    // Skip locked expressions
    if (expr.meta.locked) return false;
    // Skip expressions on hidden or locked layers
    const layerId = expr.layerId ?? 'default';
    if (!visibleLayerIds.has(layerId)) return false;
    if (lockedLayerIds.has(layerId)) return false;
    return true;
  });

  if (candidates.length === 0) {
    return 'No eligible expressions to layout (all locked or hidden).';
  }

  // Build layout options
  const options: LayoutOptions = {
    algorithm: params.algorithm,
    direction: params.direction,
    spacing: params.spacing,
    iterations: params.iterations,
    columns: params.columns,
  };

  // Compute new positions
  const positionMap = computeLayout(candidates, options);

  if (positionMap.size === 0) {
    return 'Layout computed but no positions changed.';
  }

  // Send position updates for expressions that actually moved
  let movedCount = 0;
  for (const [id, newPos] of positionMap) {
    const expr = allExpressions.find((e) => e.id === id);
    if (!expr) continue;

    // Skip if position didn't change
    if (expr.position.x === newPos.x && expr.position.y === newPos.y) continue;

    await client.sendUpdate(id, { position: newPos });
    movedCount++;
  }

  if (movedCount === 0) {
    return `Layout computed using ${params.algorithm} algorithm but all expressions were already in position.`;
  }

  return `Auto-layout complete: rearranged ${movedCount} expression(s) using ${params.algorithm} algorithm.`;
}
