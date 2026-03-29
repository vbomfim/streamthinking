/**
 * Placeholder SVG icons for the stencil catalog.
 *
 * Minimal monochrome icons (64×64 viewBox) to prove the
 * stencil pipeline end-to-end: server and database.
 *
 * Note: k8s-pod moved to svgs/kubernetes.ts in Sub-ticket C.
 *
 * @module
 */

/** Server icon — rectangle with horizontal lines (network category). */
export const SERVER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="8" y="8" width="48" height="48" rx="4" />
  <line x1="8" y1="24" x2="56" y2="24" />
  <line x1="8" y1="40" x2="56" y2="40" />
  <circle cx="16" cy="16" r="2" fill="currentColor" />
  <circle cx="16" cy="32" r="2" fill="currentColor" />
  <circle cx="16" cy="48" r="2" fill="currentColor" />
</svg>`;

/** Database icon — cylinder shape (generic-it category). */
export const DATABASE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <ellipse cx="32" cy="14" rx="22" ry="8" />
  <path d="M10 14v36c0 4.4 9.8 8 22 8s22-3.6 22-8V14" />
  <path d="M10 30c0 4.4 9.8 8 22 8s22-3.6 22-8" />
</svg>`;
