/**
 * Network category SVG icons for the stencil catalog.
 *
 * Five monochrome line-art icons (64×64 viewBox): server, load-balancer,
 * firewall, router, and switch.
 *
 * @module
 */

/** Server icon — rack server with drive bays and status indicators. */
export const SERVER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="10" y="6" width="44" height="52" rx="3" />
  <line x1="10" y1="23" x2="54" y2="23" />
  <line x1="10" y1="40" x2="54" y2="40" />
  <circle cx="18" cy="14" r="2" fill="currentColor" />
  <circle cx="18" cy="31" r="2" fill="currentColor" />
  <circle cx="18" cy="48" r="2" fill="currentColor" />
  <line x1="26" y1="14" x2="46" y2="14" />
  <line x1="26" y1="31" x2="46" y2="31" />
  <line x1="26" y1="48" x2="46" y2="48" />
</svg>`;

/** Load balancer icon — split arrows distributing traffic. */
export const LOAD_BALANCER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="32" cy="14" r="8" />
  <line x1="32" y1="22" x2="32" y2="30" />
  <line x1="32" y1="30" x2="14" y2="44" />
  <line x1="32" y1="30" x2="32" y2="44" />
  <line x1="32" y1="30" x2="50" y2="44" />
  <rect x="6" y="44" width="16" height="12" rx="2" />
  <rect x="24" y="44" width="16" height="12" rx="2" />
  <rect x="42" y="44" width="16" height="12" rx="2" />
</svg>`;

/** Firewall icon — shield with brick pattern. */
export const FIREWALL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M32 4L8 16v16c0 14 10 22 24 26 14-4 24-12 24-26V16L32 4z" />
  <line x1="16" y1="24" x2="48" y2="24" />
  <line x1="16" y1="34" x2="48" y2="34" />
  <line x1="16" y1="44" x2="48" y2="44" />
  <line x1="32" y1="16" x2="32" y2="24" />
  <line x1="24" y1="24" x2="24" y2="34" />
  <line x1="40" y1="24" x2="40" y2="34" />
  <line x1="32" y1="34" x2="32" y2="44" />
</svg>`;

/** Router icon — box with four directional arrows. */
export const ROUTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="14" y="14" width="36" height="36" rx="4" />
  <line x1="32" y1="4" x2="32" y2="14" />
  <polygon points="32,2 28,10 36,10" fill="currentColor" stroke="none" />
  <line x1="32" y1="50" x2="32" y2="60" />
  <polygon points="32,62 28,54 36,54" fill="currentColor" stroke="none" />
  <line x1="4" y1="32" x2="14" y2="32" />
  <polygon points="2,32 10,28 10,36" fill="currentColor" stroke="none" />
  <line x1="50" y1="32" x2="60" y2="32" />
  <polygon points="62,32 54,28 54,36" fill="currentColor" stroke="none" />
  <circle cx="32" cy="32" r="4" fill="currentColor" />
</svg>`;

/** Switch icon — box with multiple port indicators. */
export const SWITCH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="4" y="18" width="56" height="28" rx="3" />
  <rect x="10" y="24" width="6" height="8" rx="1" />
  <rect x="20" y="24" width="6" height="8" rx="1" />
  <rect x="30" y="24" width="6" height="8" rx="1" />
  <rect x="40" y="24" width="6" height="8" rx="1" />
  <rect x="50" y="24" width="6" height="8" rx="1" />
  <circle cx="13" cy="38" r="2" fill="currentColor" />
  <circle cx="23" cy="38" r="2" fill="currentColor" />
  <circle cx="33" cy="38" r="2" fill="currentColor" />
  <circle cx="43" cy="38" r="2" fill="currentColor" />
  <circle cx="53" cy="38" r="2" fill="currentColor" />
</svg>`;
