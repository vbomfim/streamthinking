/**
 * Stencil catalog — registry of SVG stencil entries for icon expressions.
 *
 * Provides a typed catalog of stencil entries keyed by unique ID, with
 * helpers for lookup, category filtering, and listing available categories.
 *
 * @module
 */

import { K8S_POD_SVG } from './svgs/placeholders.js';
import {
  SERVER_SVG,
  LOAD_BALANCER_SVG,
  FIREWALL_SVG,
  ROUTER_SVG,
  SWITCH_SVG,
} from './svgs/network.js';
import {
  DATABASE_SVG,
  QUEUE_SVG,
  CACHE_SVG,
  API_SVG,
  USER_SVG,
  BROWSER_SVG,
} from './svgs/genericIt.js';
import {
  BOUNDARY_ZONE_SVG,
  MICROSERVICE_SVG,
  CONTAINER_SVG,
} from './svgs/architecture.js';

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

/** Standard 64×64 default size for regular icons. */
const ICON_SIZE = { width: 64, height: 64 } as const;

/** Global stencil catalog keyed by stencil ID. */
export const STENCIL_CATALOG: Map<string, StencilEntry> = new Map([
  // ── Network ───────────────────────────────────────────────
  [
    'server',
    {
      id: 'server',
      category: 'network',
      label: 'Server',
      svgContent: SERVER_SVG,
      defaultSize: ICON_SIZE,
    },
  ],
  [
    'load-balancer',
    {
      id: 'load-balancer',
      category: 'network',
      label: 'Load Balancer',
      svgContent: LOAD_BALANCER_SVG,
      defaultSize: ICON_SIZE,
    },
  ],
  [
    'firewall',
    {
      id: 'firewall',
      category: 'network',
      label: 'Firewall',
      svgContent: FIREWALL_SVG,
      defaultSize: ICON_SIZE,
    },
  ],
  [
    'router',
    {
      id: 'router',
      category: 'network',
      label: 'Router',
      svgContent: ROUTER_SVG,
      defaultSize: ICON_SIZE,
    },
  ],
  [
    'switch',
    {
      id: 'switch',
      category: 'network',
      label: 'Switch',
      svgContent: SWITCH_SVG,
      defaultSize: ICON_SIZE,
    },
  ],

  // ── Generic IT ────────────────────────────────────────────
  [
    'database',
    {
      id: 'database',
      category: 'generic-it',
      label: 'Database',
      svgContent: DATABASE_SVG,
      defaultSize: ICON_SIZE,
    },
  ],
  [
    'queue',
    {
      id: 'queue',
      category: 'generic-it',
      label: 'Queue',
      svgContent: QUEUE_SVG,
      defaultSize: ICON_SIZE,
    },
  ],
  [
    'cache',
    {
      id: 'cache',
      category: 'generic-it',
      label: 'Cache',
      svgContent: CACHE_SVG,
      defaultSize: ICON_SIZE,
    },
  ],
  [
    'api',
    {
      id: 'api',
      category: 'generic-it',
      label: 'API',
      svgContent: API_SVG,
      defaultSize: ICON_SIZE,
    },
  ],
  [
    'user',
    {
      id: 'user',
      category: 'generic-it',
      label: 'User',
      svgContent: USER_SVG,
      defaultSize: ICON_SIZE,
    },
  ],
  [
    'browser',
    {
      id: 'browser',
      category: 'generic-it',
      label: 'Browser',
      svgContent: BROWSER_SVG,
      defaultSize: ICON_SIZE,
    },
  ],

  // ── Architecture ──────────────────────────────────────────
  [
    'boundary-zone',
    {
      id: 'boundary-zone',
      category: 'architecture',
      label: 'Boundary Zone',
      svgContent: BOUNDARY_ZONE_SVG,
      defaultSize: { width: 200, height: 150 },
    },
  ],
  [
    'microservice',
    {
      id: 'microservice',
      category: 'architecture',
      label: 'Microservice',
      svgContent: MICROSERVICE_SVG,
      defaultSize: ICON_SIZE,
    },
  ],
  [
    'container',
    {
      id: 'container',
      category: 'architecture',
      label: 'Container',
      svgContent: CONTAINER_SVG,
      defaultSize: ICON_SIZE,
    },
  ],

  // ── Kubernetes (placeholder — sub-ticket C) ───────────────
  [
    'k8s-pod',
    {
      id: 'k8s-pod',
      category: 'kubernetes',
      label: 'Kubernetes Pod',
      svgContent: K8S_POD_SVG,
      defaultSize: ICON_SIZE,
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
