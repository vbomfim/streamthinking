/**
 * Router registry — maps RoutingMode to router functions.
 *
 * Central dispatch for all routing algorithms. The renderer calls
 * `getRouter(mode)` to get the appropriate routing function, then
 * invokes it to get PathSegments.
 *
 * Returns `null` for 'straight' and undefined modes (the renderer
 * uses default point-to-point rendering for these).
 *
 * [CLEAN-CODE] [SRP] — single responsibility: router dispatch.
 * [SOLID/OCP] — adding a new router only requires adding an entry here.
 *
 * @module
 */

import type { RoutingMode } from '@infinicanvas/protocol';
import type { PathSegment, RouterFunction, RouterOptions } from './routerTypes.js';
import { computeCurvedRoute } from './curvedRouter.js';
import { computeElbowRoute } from './elbowRouter.js';
import { computeEntityRelationRoute } from './entityRelationRouter.js';
import { computeIsometricRoute } from './isometricRouter.js';
import { computeOrthogonalRoute } from './orthogonalRouter.js';
import {
  computeOrthogonalCurvedRoute,
} from './orthogonalEnhancements.js';

/**
 * Adapter that converts the existing orthogonal router's [x,y][] output
 * to PathSegment[].
 */
function orthogonalAdapter(
  start: { x: number; y: number },
  end: { x: number; y: number },
  startAnchor?: string,
  endAnchor?: string,
  options?: RouterOptions,
): PathSegment[] {
  const points = computeOrthogonalRoute(
    start,
    end,
    startAnchor,
    endAnchor,
    options?.startBounds,
    options?.endBounds,
    options?.jettySize,
    options?.midpointOffset,
  );

  // Convert [x,y][] to PathSegment[] — skip the first point (moveTo)
  return points.slice(1).map(([x, y]) => ({ type: 'line' as const, x, y }));
}

/** Router dispatch table. */
const ROUTER_MAP: Record<string, RouterFunction> = {
  orthogonal: orthogonalAdapter,
  curved: computeCurvedRoute,
  elbow: computeElbowRoute,
  entityRelation: computeEntityRelationRoute,
  isometric: computeIsometricRoute,
  orthogonalCurved: computeOrthogonalCurvedRoute,
};

/**
 * Get the router function for a routing mode.
 *
 * Returns `null` for 'straight' and undefined modes — the renderer
 * should use default straight-line rendering for these.
 */
export function getRouter(mode: RoutingMode | undefined): RouterFunction | null {
  if (!mode || mode === 'straight') return null;
  return ROUTER_MAP[mode] ?? null;
}

// Re-export types for convenience
export type { PathSegment, RouterFunction, RouterOptions };
