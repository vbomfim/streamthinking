/**
 * Generic IT category SVG icons for the stencil catalog.
 *
 * Seven monochrome line-art icons (64×64 viewBox): database, queue,
 * cache, api, user, browser, and prometheus.
 *
 * @module
 */

/** Database icon — cylinder with internal rings. */
export const DATABASE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <ellipse cx="32" cy="14" rx="22" ry="8" />
  <path d="M10 14v36c0 4.4 9.8 8 22 8s22-3.6 22-8V14" />
  <path d="M10 26c0 4.4 9.8 8 22 8s22-3.6 22-8" />
  <path d="M10 38c0 4.4 9.8 8 22 8s22-3.6 22-8" />
</svg>`;

/** Queue icon — sequential message boxes with arrow. */
export const QUEUE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="4" y="20" width="14" height="24" rx="2" />
  <rect x="22" y="20" width="14" height="24" rx="2" />
  <rect x="40" y="20" width="14" height="24" rx="2" />
  <line x1="54" y1="32" x2="62" y2="32" />
  <polygon points="62,32 57,28 57,36" fill="currentColor" stroke="none" />
</svg>`;

/** Cache icon — lightning bolt on storage block. */
export const CACHE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="8" y="14" width="48" height="40" rx="4" />
  <line x1="8" y1="30" x2="56" y2="30" />
  <polygon points="36,18 26,32 34,32 28,50 42,30 34,30 36,18" fill="currentColor" stroke="none" />
</svg>`;

/** API icon — angle brackets with slash. */
export const API_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <polyline points="20,16 6,32 20,48" stroke-linecap="round" stroke-linejoin="round" />
  <polyline points="44,16 58,32 44,48" stroke-linecap="round" stroke-linejoin="round" />
  <line x1="36" y1="12" x2="28" y2="52" stroke-linecap="round" />
</svg>`;

/** User icon — person silhouette (head and shoulders). */
export const USER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="32" cy="20" r="10" />
  <path d="M12 56c0-11 8.9-20 20-20s20 9 20 20" />
</svg>`;

/** Browser icon — window with address bar. */
export const BROWSER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="4" y="8" width="56" height="48" rx="4" />
  <line x1="4" y1="22" x2="60" y2="22" />
  <circle cx="12" cy="15" r="2" fill="currentColor" />
  <circle cx="20" cy="15" r="2" fill="currentColor" />
  <circle cx="28" cy="15" r="2" fill="currentColor" />
  <rect x="34" y="12" width="22" height="6" rx="2" />
</svg>`;

/** Prometheus — flame icon (monitoring). */
export const PROMETHEUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M32 6 C32 6 44 16 44 30 C44 38 40 42 40 42 C40 42 46 36 46 28 C46 28 52 36 52 44 C52 54 42 58 32 58 C22 58 12 54 12 44 C12 36 18 28 18 28 C18 36 24 42 24 42 C24 42 20 38 20 30 C20 16 32 6 32 6Z" />
  <line x1="22" y1="48" x2="42" y2="48" />
  <line x1="24" y1="52" x2="40" y2="52" />
</svg>`;
