/**
 * Architecture category SVG icons for the stencil catalog.
 *
 * Three icons for architectural diagrams: boundary-zone (200×150 viewBox,
 * dashed container), microservice (hexagon, 64×64), and container
 * (box-in-box, 64×64).
 *
 * @module
 */

/** Boundary zone icon — dashed rectangle border (container concept, 200×150). */
export const BOUNDARY_ZONE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="4" y="4" width="192" height="142" rx="8" stroke-dasharray="8 4" />
  <text x="14" y="22" font-family="sans-serif" font-size="14" fill="currentColor" stroke="none">Zone</text>
</svg>`;

/** Microservice icon — hexagon shape. */
export const MICROSERVICE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" />
  <line x1="20" y1="26" x2="44" y2="26" />
  <line x1="20" y1="34" x2="44" y2="34" />
  <line x1="20" y1="42" x2="36" y2="42" />
</svg>`;

/** Container icon — box-in-box (Docker-style). */
export const CONTAINER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="6" y="6" width="52" height="52" rx="4" />
  <rect x="16" y="16" width="32" height="32" rx="2" />
  <line x1="16" y1="26" x2="48" y2="26" />
  <line x1="16" y1="36" x2="48" y2="36" />
  <line x1="28" y1="16" x2="28" y2="26" />
  <line x1="38" y1="16" x2="38" y2="26" />
</svg>`;
