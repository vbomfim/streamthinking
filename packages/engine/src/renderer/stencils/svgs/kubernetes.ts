/**
 * Kubernetes SVG icons for the stencil catalog.
 *
 * Ten monochrome icons representing core Kubernetes resources:
 * Pod, Deployment, Service, Ingress, ConfigMap, Secret,
 * Namespace, PersistentVolume, Node, and Cluster.
 *
 * Container types (Namespace, Cluster) use 200×150 viewBox.
 *
 * @module
 */

/** Kubernetes Pod — hexagon with inner circle. */
export const K8S_POD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" />
  <circle cx="32" cy="32" r="8" />
</svg>`;

/** Kubernetes Deployment — hexagon with circular arrow for rolling update. */
export const K8S_DEPLOYMENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" />
  <path d="M22 32a10 10 0 0 1 17-7" />
  <polygon points="41,23 39,29 35,25" fill="currentColor" stroke="none" />
  <path d="M42 32a10 10 0 0 1-17 7" />
  <polygon points="23,41 25,35 29,39" fill="currentColor" stroke="none" />
</svg>`;

/** Kubernetes Service — triangle/arrow shape (load balancer). */
export const K8S_SERVICE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" />
  <polygon points="24,22 42,32 24,42" />
  <line x1="42" y1="24" x2="42" y2="40" />
</svg>`;

/** Kubernetes Ingress — arrow entering a box. */
export const K8S_INGRESS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="20" y="12" width="36" height="40" rx="3" />
  <line x1="4" y1="32" x2="28" y2="32" />
  <polygon points="26,26 36,32 26,38" fill="currentColor" stroke="none" />
  <line x1="38" y1="24" x2="38" y2="40" />
  <line x1="38" y1="24" x2="48" y2="24" />
  <line x1="38" y1="32" x2="48" y2="32" />
  <line x1="38" y1="40" x2="48" y2="40" />
</svg>`;

/** Kubernetes ConfigMap — document with key-value lines. */
export const K8S_CONFIGMAP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M14 8h26l10 10v38a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" />
  <path d="M40 8v10h10" />
  <line x1="20" y1="26" x2="26" y2="26" />
  <line x1="30" y1="26" x2="44" y2="26" />
  <line x1="20" y1="34" x2="26" y2="34" />
  <line x1="30" y1="34" x2="44" y2="34" />
  <line x1="20" y1="42" x2="26" y2="42" />
  <line x1="30" y1="42" x2="44" y2="42" />
</svg>`;

/** Kubernetes Secret — lock icon. */
export const K8S_SECRET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="14" y="28" width="36" height="28" rx="3" />
  <path d="M22 28V20a10 10 0 0 1 20 0v8" />
  <circle cx="32" cy="42" r="4" fill="currentColor" />
  <line x1="32" y1="46" x2="32" y2="50" />
</svg>`;

/** Kubernetes Namespace — dashed boundary (large container). */
export const K8S_NAMESPACE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="4" y="4" width="192" height="142" rx="6" stroke-dasharray="8 4" />
  <text x="14" y="22" font-family="sans-serif" font-size="14" fill="currentColor" stroke="none">NS</text>
  <line x1="4" y1="30" x2="50" y2="30" stroke-dasharray="8 4" />
</svg>`;

/** Kubernetes PersistentVolume — disk/storage cylinder. */
export const K8S_PERSISTENT_VOLUME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <ellipse cx="32" cy="16" rx="18" ry="8" />
  <path d="M14 16v32c0 4.4 8 8 18 8s18-3.6 18-8V16" />
  <line x1="22" y1="38" x2="32" y2="34" />
  <line x1="32" y1="34" x2="42" y2="38" />
  <line x1="32" y1="34" x2="32" y2="46" />
</svg>`;

/** Kubernetes Node — server box with K8s wheel mark. */
export const K8S_NODE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="6" y="8" width="52" height="48" rx="4" />
  <line x1="6" y1="20" x2="58" y2="20" />
  <circle cx="14" cy="14" r="2" fill="currentColor" />
  <circle cx="20" cy="14" r="2" fill="currentColor" />
  <circle cx="32" cy="38" r="8" />
  <line x1="32" y1="30" x2="32" y2="26" />
  <line x1="32" y1="46" x2="32" y2="50" />
  <line x1="24" y1="34" x2="21" y2="31" />
  <line x1="40" y1="42" x2="43" y2="45" />
  <line x1="24" y1="42" x2="21" y2="45" />
  <line x1="40" y1="34" x2="43" y2="31" />
</svg>`;

/** Kubernetes Cluster — grouped nodes (large container). */
export const K8S_CLUSTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 200" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="4" y="4" width="242" height="192" rx="8" />
  <text x="14" y="26" font-family="sans-serif" font-size="14" fill="currentColor" stroke="none">Cluster</text>
  <line x1="4" y1="34" x2="80" y2="34" />
  <rect x="20" y="50" width="80" height="56" rx="4" stroke-dasharray="4 2" />
  <circle cx="60" cy="78" r="10" />
  <line x1="60" y1="68" x2="60" y2="64" />
  <line x1="60" y1="88" x2="60" y2="92" />
  <rect x="140" y="50" width="80" height="56" rx="4" stroke-dasharray="4 2" />
  <circle cx="180" cy="78" r="10" />
  <line x1="180" y1="68" x2="180" y2="64" />
  <line x1="180" y1="88" x2="180" y2="92" />
  <rect x="80" y="126" width="80" height="56" rx="4" stroke-dasharray="4 2" />
  <circle cx="120" cy="154" r="10" />
  <line x1="120" y1="144" x2="120" y2="140" />
  <line x1="120" y1="164" x2="120" y2="168" />
</svg>`;
