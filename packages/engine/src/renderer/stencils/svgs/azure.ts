/**
 * Azure cloud service SVG icons for the stencil catalog.
 *
 * Six monochrome icons (64×64 viewBox) representing core Azure services:
 * App Gateway, AKS, Storage, SQL, Functions, and VNet.
 *
 * @module
 */

/** Azure Application Gateway — gateway box with routing arrows. */
export const AZURE_APP_GATEWAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="6" y="14" width="52" height="36" rx="4" />
  <line x1="6" y1="32" x2="20" y2="32" />
  <circle cx="24" cy="32" r="4" />
  <line x1="28" y1="32" x2="36" y2="20" />
  <line x1="28" y1="32" x2="36" y2="32" />
  <line x1="28" y1="32" x2="36" y2="44" />
  <polygon points="42,20 36,17 36,23" fill="currentColor" stroke="none" />
  <polygon points="42,32 36,29 36,35" fill="currentColor" stroke="none" />
  <polygon points="42,44 36,41 36,47" fill="currentColor" stroke="none" />
  <rect x="42" y="16" width="10" height="8" rx="1" />
  <rect x="42" y="28" width="10" height="8" rx="1" />
  <rect x="42" y="40" width="10" height="8" rx="1" />
</svg>`;

/** Azure Kubernetes Service (AKS) — Kubernetes wheel in Azure style. */
export const AZURE_AKS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="32" cy="32" r="24" />
  <circle cx="32" cy="32" r="8" />
  <line x1="32" y1="8" x2="32" y2="24" />
  <line x1="32" y1="40" x2="32" y2="56" />
  <line x1="11.2" y1="20" x2="25.6" y2="28" />
  <line x1="38.4" y1="36" x2="52.8" y2="44" />
  <line x1="11.2" y1="44" x2="25.6" y2="36" />
  <line x1="38.4" y1="28" x2="52.8" y2="20" />
  <circle cx="32" cy="8" r="3" fill="currentColor" />
  <circle cx="32" cy="56" r="3" fill="currentColor" />
  <circle cx="11.2" cy="20" r="3" fill="currentColor" />
  <circle cx="52.8" cy="44" r="3" fill="currentColor" />
  <circle cx="11.2" cy="44" r="3" fill="currentColor" />
  <circle cx="52.8" cy="20" r="3" fill="currentColor" />
</svg>`;

/** Azure Storage — stacked disks and tables. */
export const AZURE_STORAGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <ellipse cx="32" cy="14" rx="20" ry="6" />
  <path d="M12 14v12c0 3.3 9 6 20 6s20-2.7 20-6V14" />
  <path d="M12 26v12c0 3.3 9 6 20 6s20-2.7 20-6V26" />
  <path d="M12 38v12c0 3.3 9 6 20 6s20-2.7 20-6V38" />
  <path d="M12 26c0 3.3 9 6 20 6s20-2.7 20-6" />
  <path d="M12 38c0 3.3 9 6 20 6s20-2.7 20-6" />
</svg>`;

/** Azure SQL Database — database cylinder with Azure diamond mark. */
export const AZURE_SQL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <ellipse cx="32" cy="16" rx="20" ry="8" />
  <path d="M12 16v32c0 4.4 9 8 20 8s20-3.6 20-8V16" />
  <path d="M12 30c0 4.4 9 8 20 8s20-3.6 20-8" />
  <polygon points="32,36 38,42 32,48 26,42" fill="currentColor" stroke="currentColor" stroke-width="1" />
</svg>`;

/** Azure Functions — lightning bolt (serverless). */
export const AZURE_FUNCTIONS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="8" y="4" width="48" height="56" rx="6" />
  <polygon points="34,12 20,34 30,34 26,52 44,28 32,28" fill="currentColor" stroke="currentColor" stroke-linejoin="round" />
</svg>`;

/** Azure Virtual Network (VNet) — network with connected nodes. */
export const AZURE_VNET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="4" y="4" width="56" height="56" rx="4" stroke-dasharray="4 2" />
  <circle cx="20" cy="20" r="6" />
  <circle cx="44" cy="20" r="6" />
  <circle cx="20" cy="44" r="6" />
  <circle cx="44" cy="44" r="6" />
  <line x1="26" y1="20" x2="38" y2="20" />
  <line x1="20" y1="26" x2="20" y2="38" />
  <line x1="44" y1="26" x2="44" y2="38" />
  <line x1="26" y1="44" x2="38" y2="44" />
  <line x1="25" y1="25" x2="39" y2="39" />
  <line x1="39" y1="25" x2="25" y2="39" />
</svg>`;
