/**
 * Layout module — automatic diagram arrangement algorithms.
 *
 * Re-exports the public API for layout computation.
 *
 * @module
 */

export { computeLayout } from './computeLayout.js';
export { computeTreeLayout } from './treeLayout.js';
export { computeForceLayout } from './forceLayout.js';
export { computeGridLayout } from './gridLayout.js';
export { extractEdges } from './edges.js';
export type {
  LayoutAlgorithm,
  LayoutDirection,
  LayoutSpacing,
  LayoutOptions,
  TreeLayoutOptions,
  ForceLayoutOptions,
  GridLayoutOptions,
  LayoutEdge,
} from './types.js';
export {
  DEFAULT_SPACING,
  DEFAULT_FORCE_ITERATIONS,
  DEFAULT_GRID_COLUMNS,
} from './types.js';
