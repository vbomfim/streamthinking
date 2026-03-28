/**
 * Stencil catalog — registry of SVG stencil entries for icon expressions.
 *
 * Provides a typed catalog of stencil entries keyed by unique ID, with
 * helpers for lookup, category filtering, and listing available categories.
 *
 * @module
 */

import { SERVER_SVG, DATABASE_SVG, K8S_POD_SVG } from './svgs/placeholders.js';

/** A single entry in the stencil catalog. */
export interface StencilEntry {
  /** Unique stencil identifier (matches StencilData.stencilId). */
  id: string;
  /** Category grouping (e.g. 'network', 'kubernetes'). */
  category: string;
  /** Human-readable label for the stencil. */
  label: string;
  /** Raw SVG markup for the icon. */
  svgContent: string;
  /** Default dimensions when placing the stencil on the canvas. */
  defaultSize: { width: number; height: number };
}

/** Global stencil catalog keyed by stencil ID. */
export const STENCIL_CATALOG: Map<string, StencilEntry> = new Map([
  [
    'server',
    {
      id: 'server',
      category: 'network',
      label: 'Server',
      svgContent: SERVER_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'database',
    {
      id: 'database',
      category: 'generic-it',
      label: 'Database',
      svgContent: DATABASE_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'k8s-pod',
    {
      id: 'k8s-pod',
      category: 'kubernetes',
      label: 'Kubernetes Pod',
      svgContent: K8S_POD_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
]);

/**
 * Look up a stencil entry by ID.
 *
 * Returns undefined if the stencil is not found.
 */
export function getStencil(id: string): StencilEntry | undefined {
  return STENCIL_CATALOG.get(id);
}

/**
 * Get all stencil entries in a given category.
 *
 * Returns an empty array if no stencils match.
 */
export function getStencilsByCategory(category: string): StencilEntry[] {
  const results: StencilEntry[] = [];
  for (const entry of STENCIL_CATALOG.values()) {
    if (entry.category === category) {
      results.push(entry);
    }
  }
  return results;
}

/**
 * Get all unique category names from the catalog.
 *
 * Returns a sorted array of category strings.
 */
export function getAllCategories(): string[] {
  const categories = new Set<string>();
  for (const entry of STENCIL_CATALOG.values()) {
    categories.add(entry.category);
  }
  return [...categories].sort();
}

/**
 * Convert raw SVG content to a data URI suitable for Image.src.
 *
 * Uses `encodeURIComponent` to safely embed SVG markup in a data URI.
 */
export function svgToDataUri(svgContent: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
}
