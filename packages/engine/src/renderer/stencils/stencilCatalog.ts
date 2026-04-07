/**
 * Stencil catalog — registry of SVG stencil entries for icon expressions.
 *
 * Provides a two-tier stencil system:
 * - **Eager tier**: Hand-crafted stencils loaded at module init via `STENCIL_CATALOG`.
 * - **Lazy tier**: Category loaders registered via `registerCategoryLoader()` that
 *   load SVGs on demand. Metadata (no SVGs) is always available via `STENCIL_META`.
 *
 * Lazy-loaded entries are merged into `STENCIL_CATALOG` on first access,
 * so sync consumers (renderer, Canvas) can look them up after loading.
 *
 * @module
 */

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
import {
  AZURE_APP_GATEWAY_SVG,
  AZURE_AKS_SVG,
  AZURE_STORAGE_SVG,
  AZURE_SQL_SVG,
  AZURE_FUNCTIONS_SVG,
  AZURE_VNET_SVG,
  AZURE_COSMOSDB_SVG,
  AZURE_REDIS_SVG,
  AZURE_DNS_SVG,
  AZURE_FRONTDOOR_SVG,
  AZURE_TRAFFIC_MANAGER_SVG,
  AZURE_MONITOR_SVG,
  AZURE_PRIVATE_ENDPOINT_SVG,
  AZURE_NSP_SVG,
  PROMETHEUS_SVG,
} from './svgs/azure.js';
import {
  NGFW_SVG,
  WAF_SVG,
  VPN_GATEWAY_SVG,
  SDWAN_SVG,
  SIEM_SVG,
  ENDPOINT_PROTECTION_SVG,
  SSL_INSPECTION_SVG,
} from './svgs/security.js';
import {
  K8S_POD_SVG,
  K8S_DEPLOYMENT_SVG,
  K8S_SERVICE_SVG,
  K8S_INGRESS_SVG,
  K8S_CONFIGMAP_SVG,
  K8S_SECRET_SVG,
  K8S_NAMESPACE_SVG,
  K8S_PERSISTENT_VOLUME_SVG,
  K8S_NODE_SVG,
  K8S_CLUSTER_SVG,
} from './svgs/kubernetes.js';
import {
  ARM_RESOURCE_GROUP_SVG,
  ARM_SUBSCRIPTION_SVG,
  ARM_MANAGEMENT_GROUP_SVG,
  ARM_VIRTUAL_MACHINE_SVG,
  ARM_VNET_SVG,
  ARM_SUBNET_SVG,
  ARM_NSG_SVG,
  ARM_KEY_VAULT_SVG,
  ARM_APP_SERVICE_SVG,
  ARM_CONTAINER_REGISTRY_SVG,
} from './svgs/azureArm.js';

/**
 * Lightweight stencil metadata — always available, no SVG content.
 *
 * Used for palette category listings and stencil search without
 * loading the (potentially large) SVG data.
 */
export interface StencilMeta {
  /** Unique stencil identifier (matches StencilData.stencilId). */
  id: string;
  /** Category grouping (e.g. 'network', 'kubernetes'). */
  category: string;
  /** Human-readable label for the stencil. */
  label: string;
  /** Default dimensions when placing the stencil on the canvas. */
  defaultSize: { width: number; height: number };
}

/** A full stencil entry including SVG content — loaded on demand for lazy categories. */
export interface StencilEntry extends StencilMeta {
  /** Raw SVG markup for the icon. */
  svgContent: string;
}

/** Function that asynchronously loads all entries for a category. */
export type CategoryLoader = () => Promise<Map<string, StencilEntry>>;

// ── Lazy loading state ────────────────────────────────────

/** Metadata for all stencils (eager + lazy), always available. */
const STENCIL_META: Map<string, StencilMeta> = new Map();

/** Registered lazy category loaders. */
const CATEGORY_LOADERS: Map<string, CategoryLoader> = new Map();

/** Categories that have been fully loaded (eager or lazy). */
const LOADED_CATEGORIES: Set<string> = new Set();

/** In-flight loading promises for deduplication. */
const LOADING_PROMISES: Map<string, Promise<void>> = new Map();

/** Standard 64×64 default size for regular icons. */
const ICON_SIZE = { width: 44, height: 44 } as const;

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

  // ── Azure (Sub-ticket C) ────────────────────────────────
  [
    'azure-app-gateway',
    {
      id: 'azure-app-gateway',
      category: 'azure',
      label: 'App Gateway',
      svgContent: AZURE_APP_GATEWAY_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'azure-aks',
    {
      id: 'azure-aks',
      category: 'azure',
      label: 'Azure Kubernetes Service',
      svgContent: AZURE_AKS_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'azure-storage',
    {
      id: 'azure-storage',
      category: 'azure',
      label: 'Azure Storage',
      svgContent: AZURE_STORAGE_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'azure-sql',
    {
      id: 'azure-sql',
      category: 'azure',
      label: 'Azure SQL Database',
      svgContent: AZURE_SQL_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'azure-functions',
    {
      id: 'azure-functions',
      category: 'azure',
      label: 'Azure Functions',
      svgContent: AZURE_FUNCTIONS_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'azure-vnet',
    {
      id: 'azure-vnet',
      category: 'azure',
      label: 'Azure Virtual Network',
      svgContent: AZURE_VNET_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  ['azure-cosmosdb', { id: 'azure-cosmosdb', category: 'azure', label: 'Cosmos DB', svgContent: AZURE_COSMOSDB_SVG, defaultSize: ICON_SIZE }],
  ['azure-redis', { id: 'azure-redis', category: 'azure', label: 'Redis Cache', svgContent: AZURE_REDIS_SVG, defaultSize: ICON_SIZE }],
  ['azure-dns', { id: 'azure-dns', category: 'azure', label: 'DNS', svgContent: AZURE_DNS_SVG, defaultSize: ICON_SIZE }],
  ['azure-frontdoor', { id: 'azure-frontdoor', category: 'azure', label: 'Front Door', svgContent: AZURE_FRONTDOOR_SVG, defaultSize: ICON_SIZE }],
  ['azure-traffic-manager', { id: 'azure-traffic-manager', category: 'azure', label: 'Traffic Manager', svgContent: AZURE_TRAFFIC_MANAGER_SVG, defaultSize: ICON_SIZE }],
  ['azure-monitor', { id: 'azure-monitor', category: 'azure', label: 'Monitor', svgContent: AZURE_MONITOR_SVG, defaultSize: ICON_SIZE }],
  ['private-endpoint', { id: 'private-endpoint', category: 'azure', label: 'Private Endpoint', svgContent: AZURE_PRIVATE_ENDPOINT_SVG, defaultSize: ICON_SIZE }],
  ['nsp', { id: 'nsp', category: 'azure', label: 'Network Security Perimeter', svgContent: AZURE_NSP_SVG, defaultSize: { width: 200, height: 150 } }],
  ['prometheus', { id: 'prometheus', category: 'generic-it', label: 'Prometheus', svgContent: PROMETHEUS_SVG, defaultSize: ICON_SIZE }],

  // ── Security ────────────────────────────────────────────
  ['ngfw', { id: 'ngfw', category: 'security', label: 'Next-Gen Firewall', svgContent: NGFW_SVG, defaultSize: ICON_SIZE }],
  ['waf', { id: 'waf', category: 'security', label: 'WAF', svgContent: WAF_SVG, defaultSize: ICON_SIZE }],
  ['vpn-gateway', { id: 'vpn-gateway', category: 'security', label: 'VPN Gateway', svgContent: VPN_GATEWAY_SVG, defaultSize: ICON_SIZE }],
  ['sdwan', { id: 'sdwan', category: 'security', label: 'SD-WAN', svgContent: SDWAN_SVG, defaultSize: ICON_SIZE }],
  ['siem', { id: 'siem', category: 'security', label: 'SIEM', svgContent: SIEM_SVG, defaultSize: ICON_SIZE }],
  ['endpoint-protection', { id: 'endpoint-protection', category: 'security', label: 'Endpoint Protection', svgContent: ENDPOINT_PROTECTION_SVG, defaultSize: ICON_SIZE }],
  ['ssl-inspection', { id: 'ssl-inspection', category: 'security', label: 'SSL Inspection', svgContent: SSL_INSPECTION_SVG, defaultSize: ICON_SIZE }],

  // ── Kubernetes (Sub-ticket C) ───────────────────────────
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
  [
    'k8s-deployment',
    {
      id: 'k8s-deployment',
      category: 'kubernetes',
      label: 'Deployment',
      svgContent: K8S_DEPLOYMENT_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'k8s-service',
    {
      id: 'k8s-service',
      category: 'kubernetes',
      label: 'Service',
      svgContent: K8S_SERVICE_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'k8s-ingress',
    {
      id: 'k8s-ingress',
      category: 'kubernetes',
      label: 'Ingress',
      svgContent: K8S_INGRESS_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'k8s-configmap',
    {
      id: 'k8s-configmap',
      category: 'kubernetes',
      label: 'ConfigMap',
      svgContent: K8S_CONFIGMAP_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'k8s-secret',
    {
      id: 'k8s-secret',
      category: 'kubernetes',
      label: 'Secret',
      svgContent: K8S_SECRET_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'k8s-namespace',
    {
      id: 'k8s-namespace',
      category: 'kubernetes',
      label: 'Namespace',
      svgContent: K8S_NAMESPACE_SVG,
      defaultSize: { width: 200, height: 150 },
    },
  ],
  [
    'k8s-persistent-volume',
    {
      id: 'k8s-persistent-volume',
      category: 'kubernetes',
      label: 'Persistent Volume',
      svgContent: K8S_PERSISTENT_VOLUME_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'k8s-node',
    {
      id: 'k8s-node',
      category: 'kubernetes',
      label: 'Node',
      svgContent: K8S_NODE_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'k8s-cluster',
    {
      id: 'k8s-cluster',
      category: 'kubernetes',
      label: 'Cluster',
      svgContent: K8S_CLUSTER_SVG,
      defaultSize: { width: 250, height: 200 },
    },
  ],

  // ── Azure ARM (Sub-ticket C) ────────────────────────────
  [
    'arm-resource-group',
    {
      id: 'arm-resource-group',
      category: 'azure-arm',
      label: 'Resource Group',
      svgContent: ARM_RESOURCE_GROUP_SVG,
      defaultSize: { width: 200, height: 150 },
    },
  ],
  [
    'arm-subscription',
    {
      id: 'arm-subscription',
      category: 'azure-arm',
      label: 'Subscription',
      svgContent: ARM_SUBSCRIPTION_SVG,
      defaultSize: { width: 250, height: 200 },
    },
  ],
  [
    'arm-management-group',
    {
      id: 'arm-management-group',
      category: 'azure-arm',
      label: 'Management Group',
      svgContent: ARM_MANAGEMENT_GROUP_SVG,
      defaultSize: { width: 300, height: 200 },
    },
  ],
  [
    'arm-virtual-machine',
    {
      id: 'arm-virtual-machine',
      category: 'azure-arm',
      label: 'Virtual Machine',
      svgContent: ARM_VIRTUAL_MACHINE_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'arm-vnet',
    {
      id: 'arm-vnet',
      category: 'azure-arm',
      label: 'Virtual Network',
      svgContent: ARM_VNET_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'arm-subnet',
    {
      id: 'arm-subnet',
      category: 'azure-arm',
      label: 'Subnet',
      svgContent: ARM_SUBNET_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'arm-nsg',
    {
      id: 'arm-nsg',
      category: 'azure-arm',
      label: 'Network Security Group',
      svgContent: ARM_NSG_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'arm-key-vault',
    {
      id: 'arm-key-vault',
      category: 'azure-arm',
      label: 'Key Vault',
      svgContent: ARM_KEY_VAULT_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'arm-app-service',
    {
      id: 'arm-app-service',
      category: 'azure-arm',
      label: 'App Service',
      svgContent: ARM_APP_SERVICE_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    'arm-container-registry',
    {
      id: 'arm-container-registry',
      category: 'azure-arm',
      label: 'Container Registry',
      svgContent: ARM_CONTAINER_REGISTRY_SVG,
      defaultSize: { width: 64, height: 64 },
    },
  ],
]);

// ── Initialize metadata from eager catalog ────────────────

for (const [_id, entry] of STENCIL_CATALOG) {
  STENCIL_META.set(entry.id, {
    id: entry.id,
    label: entry.label,
    category: entry.category,
    defaultSize: { width: entry.defaultSize.width, height: entry.defaultSize.height },
  });
  LOADED_CATEGORIES.add(entry.category);
}

// ── Internal: lazy loading engine ─────────────────────────

/**
 * Ensure a category's stencils are loaded.
 *
 * If the category is already loaded (eager or previously lazy-loaded),
 * resolves immediately. Otherwise, invokes the registered loader and
 * merges entries into `STENCIL_CATALOG`.
 *
 * Concurrent calls for the same category share a single loading promise.
 */
async function ensureCategoryLoaded(category: string): Promise<void> {
  if (LOADED_CATEGORIES.has(category)) return;

  // Deduplicate concurrent loads of the same category
  const existing = LOADING_PROMISES.get(category);
  if (existing) return existing;

  const loader = CATEGORY_LOADERS.get(category);
  if (!loader) return;

  const promise = (async () => {
    try {
      const entries = await loader();
      for (const [id, entry] of entries) {
        STENCIL_CATALOG.set(id, entry);
      }
      LOADED_CATEGORIES.add(category);
    } finally {
      LOADING_PROMISES.delete(category);
    }
  })();

  LOADING_PROMISES.set(category, promise);
  return promise;
}

// ── Public API: sync (lightweight, always available) ──────

/**
 * Look up a stencil entry by ID (async — triggers lazy load if needed).
 *
 * For eagerly loaded stencils, resolves immediately. For lazy stencils,
 * loads the containing category first, then returns the entry.
 *
 * Returns undefined if the stencil ID is not found in any category.
 */
export async function getStencil(id: string): Promise<StencilEntry | undefined> {
  // Fast path: already loaded (eager or previously lazy-loaded)
  const existing = STENCIL_CATALOG.get(id);
  if (existing) return existing;

  // Check metadata to find the stencil's category
  const meta = STENCIL_META.get(id);
  if (!meta) return undefined;

  // Load the category and look up again
  await ensureCategoryLoaded(meta.category);
  return STENCIL_CATALOG.get(id);
}

/**
 * Get all stencil entries in a given category (sync).
 *
 * Returns entries from `STENCIL_CATALOG` — only eagerly loaded and
 * already-loaded lazy categories. Does NOT trigger lazy loading.
 *
 * @see getCategoryStencils for the async version that triggers loading.
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
 * Get all unique category names from the catalog (sync).
 *
 * Returns categories from both eagerly loaded stencils and registered
 * lazy category metadata. Sorted alphabetically.
 */
export function getAllCategories(): string[] {
  return getCategories();
}

/**
 * Get all unique category names (sync — from metadata).
 *
 * Includes both eagerly loaded categories and lazy categories
 * whose metadata has been registered. Does NOT require SVGs to be loaded.
 *
 * Returns a sorted array of category strings.
 */
export function getCategories(): string[] {
  const categories = new Set<string>();
  for (const meta of STENCIL_META.values()) {
    categories.add(meta.category);
  }
  return [...categories].sort();
}

/**
 * Get all stencil metadata (sync — no SVG content).
 *
 * Returns lightweight metadata for all known stencils (both eager
 * and lazy). Useful for palette category counts and search without
 * loading SVG data.
 */
export function getAllStencilMeta(): StencilMeta[] {
  return [...STENCIL_META.values()];
}

// ── Public API: async (triggers lazy loading) ─────────────

/**
 * Get stencils for a category (async — triggers lazy load).
 *
 * For eagerly loaded categories, resolves immediately.
 * For lazy categories, invokes the registered loader, caches the
 * result, and returns the full entries.
 *
 * Returns an empty array if the category is unknown.
 */
export async function getCategoryStencils(category: string): Promise<StencilEntry[]> {
  await ensureCategoryLoaded(category);

  const results: StencilEntry[] = [];
  for (const entry of STENCIL_CATALOG.values()) {
    if (entry.category === category) {
      results.push(entry);
    }
  }
  return results;
}

// ── Public API: registration ──────────────────────────────

/**
 * Register a lazy loader for a category.
 *
 * The loader is invoked on the first call to `getCategoryStencils(category)`
 * or `getStencil(id)` for a stencil in the category.
 *
 * @param category - Category identifier (e.g. 'drawio-aws')
 * @param loader - Async function returning a Map of stencil entries
 */
export function registerCategoryLoader(category: string, loader: CategoryLoader): void {
  CATEGORY_LOADERS.set(category, loader);
}

/**
 * Register lightweight metadata for stencils in a lazy category.
 *
 * Call this alongside `registerCategoryLoader` to make the stencils'
 * metadata available synchronously (for palette counts, category lists)
 * before the SVGs are loaded.
 *
 * @param metas - Array of StencilMeta entries to register
 */
export function registerCategoryMeta(metas: readonly StencilMeta[]): void {
  for (const meta of metas) {
    STENCIL_META.set(meta.id, meta);
  }
}

/**
 * Convert raw SVG content to a data URI suitable for Image.src.
 *
 * Uses `encodeURIComponent` to safely embed SVG markup in a data URI.
 */
export function svgToDataUri(svgContent: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
}

// ── Test helpers (not part of public API) ──────────────────

/**
 * Reset lazy loading state for test isolation.
 *
 * Clears registered loaders, loaded categories, and metadata
 * for dynamically registered (non-eager) categories.
 * Re-initializes metadata from the eager catalog.
 *
 * @internal — Only exported for use in test files.
 */
export function _resetLazyState(): void {
  CATEGORY_LOADERS.clear();
  LOADING_PROMISES.clear();

  // Rebuild from scratch: remove dynamic entries
  const toRemove: string[] = [];
  for (const [id] of STENCIL_CATALOG) {
    if (!_EAGER_IDS.has(id)) {
      toRemove.push(id);
    }
  }
  for (const id of toRemove) {
    STENCIL_CATALOG.delete(id);
  }

  // Reset metadata to eager only
  STENCIL_META.clear();
  LOADED_CATEGORIES.clear();
  for (const [_id, entry] of STENCIL_CATALOG) {
    STENCIL_META.set(entry.id, {
      id: entry.id,
      label: entry.label,
      category: entry.category,
      defaultSize: { width: entry.defaultSize.width, height: entry.defaultSize.height },
    });
    LOADED_CATEGORIES.add(entry.category);
  }
}

/** Set of stencil IDs from the eager catalog (for reset isolation). */
const _EAGER_IDS: ReadonlySet<string> = new Set(STENCIL_CATALOG.keys());
