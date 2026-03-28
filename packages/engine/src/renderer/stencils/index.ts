/**
 * Stencil module — re-exports catalog and SVG helpers.
 *
 * @module
 */

export type { StencilEntry } from './stencilCatalog.js';
export {
  STENCIL_CATALOG,
  getStencil,
  getStencilsByCategory,
  getAllCategories,
  svgToDataUri,
} from './stencilCatalog.js';
