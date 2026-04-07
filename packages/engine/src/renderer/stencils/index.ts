/**
 * Stencil module — re-exports catalog and SVG helpers.
 *
 * @module
 */

// Side-effect import: registers draw.io stencils into STENCIL_CATALOG
import './drawio/index.js';

// Re-sync metadata after draw.io side-effect registration
import { _syncMetaFromCatalog } from './stencilCatalog.js';
_syncMetaFromCatalog();

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
  _syncMetaFromCatalog,
} from './stencilCatalog.js';
