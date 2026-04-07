/**
 * Stencil module — re-exports catalog and SVG helpers.
 *
 * @module
 */

export type { StencilEntry, StencilMeta, CategoryLoader } from './stencilCatalog.js';
export {
  STENCIL_CATALOG,
  getStencil,
  getStencilsByCategory,
  getAllCategories,
  getCategories,
  getCategoryStencils,
  getAllStencilMeta,
  registerCategoryLoader,
  registerCategoryMeta,
  svgToDataUri,
  _resetLazyState,
} from './stencilCatalog.js';
