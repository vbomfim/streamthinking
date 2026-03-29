/**
 * Azure ARM (Azure Resource Manager) SVG icons for the stencil catalog.
 *
 * Ten monochrome icons representing ARM hierarchy and infrastructure:
 * Resource Group, Subscription, Management Group, Virtual Machine,
 * VNet, Subnet, NSG, Key Vault, App Service, and Container Registry.
 *
 * Container types (Resource Group, Subscription, Management Group)
 * use larger viewBox sizes.
 *
 * @module
 */

/** ARM Resource Group — folder/group icon (large container). */
export const ARM_RESOURCE_GROUP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M4 20h60l10-16h122a4 4 0 0 1 4 4v138a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V20z" />
  <line x1="0" y1="28" x2="200" y2="28" />
  <text x="10" y="22" font-family="sans-serif" font-size="11" fill="currentColor" stroke="none">Resource Group</text>
</svg>`;

/** ARM Subscription — key/billing icon (large container). */
export const ARM_SUBSCRIPTION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 200" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="4" y="4" width="242" height="192" rx="6" />
  <line x1="4" y1="36" x2="246" y2="36" />
  <circle cx="22" cy="20" r="8" />
  <line x1="30" y1="20" x2="42" y2="20" />
  <line x1="36" y1="20" x2="36" y2="28" />
  <line x1="42" y1="20" x2="42" y2="28" />
  <text x="52" y="24" font-family="sans-serif" font-size="12" fill="currentColor" stroke="none">Subscription</text>
</svg>`;

/** ARM Management Group — hierarchy/tree icon (large container). */
export const ARM_MANAGEMENT_GROUP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="4" y="4" width="292" height="192" rx="6" stroke-dasharray="6 3" />
  <line x1="4" y1="36" x2="296" y2="36" />
  <rect x="16" y="10" width="16" height="16" rx="2" fill="currentColor" stroke="none" />
  <line x1="32" y1="18" x2="40" y2="18" />
  <rect x="40" y="10" width="16" height="16" rx="2" />
  <line x1="48" y1="26" x2="48" y2="32" />
  <line x1="32" y1="32" x2="64" y2="32" />
  <text x="62" y="24" font-family="sans-serif" font-size="12" fill="currentColor" stroke="none">Management Group</text>
</svg>`;

/** ARM Virtual Machine — computer/VM icon. */
export const ARM_VIRTUAL_MACHINE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="6" y="6" width="52" height="36" rx="3" />
  <rect x="12" y="12" width="40" height="24" rx="1" />
  <line x1="26" y1="42" x2="26" y2="50" />
  <line x1="38" y1="42" x2="38" y2="50" />
  <line x1="18" y1="50" x2="46" y2="50" />
  <line x1="16" y1="54" x2="48" y2="54" />
  <polygon points="28,20 28,32 38,26" fill="currentColor" stroke="none" />
</svg>`;

/** ARM Virtual Network — network topology with subnets. */
export const ARM_VNET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="4" y="4" width="56" height="56" rx="4" />
  <rect x="10" y="14" width="20" height="16" rx="2" stroke-dasharray="3 2" />
  <rect x="34" y="14" width="20" height="16" rx="2" stroke-dasharray="3 2" />
  <rect x="10" y="36" width="20" height="16" rx="2" stroke-dasharray="3 2" />
  <rect x="34" y="36" width="20" height="16" rx="2" stroke-dasharray="3 2" />
  <line x1="30" y1="22" x2="34" y2="22" />
  <line x1="30" y1="44" x2="34" y2="44" />
  <line x1="20" y1="30" x2="20" y2="36" />
  <line x1="44" y1="30" x2="44" y2="36" />
</svg>`;

/** ARM Subnet — sub-network segment. */
export const ARM_SUBNET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="8" y="12" width="48" height="40" rx="4" stroke-dasharray="4 2" />
  <circle cx="24" cy="32" r="6" />
  <circle cx="40" cy="32" r="6" />
  <line x1="30" y1="32" x2="34" y2="32" />
  <text x="32" y="10" text-anchor="middle" font-family="sans-serif" font-size="8" fill="currentColor" stroke="none">subnet</text>
</svg>`;

/** ARM Network Security Group (NSG) — shield icon. */
export const ARM_NSG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M32 4L8 16v16c0 14.4 10.4 27.2 24 32 13.6-4.8 24-17.6 24-32V16L32 4z" />
  <line x1="22" y1="30" x2="42" y2="30" />
  <line x1="22" y1="38" x2="42" y2="38" />
  <polygon points="18,30 14,34 18,38" fill="currentColor" stroke="none" />
  <polygon points="46,30 50,34 46,38" fill="currentColor" stroke="none" />
</svg>`;

/** ARM Key Vault — vault/safe icon with lock. */
export const ARM_KEY_VAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="8" y="8" width="48" height="48" rx="6" />
  <rect x="14" y="14" width="36" height="36" rx="3" />
  <circle cx="32" cy="30" r="6" />
  <line x1="32" y1="36" x2="32" y2="44" />
  <circle cx="32" cy="30" r="2" fill="currentColor" />
  <rect x="28" y="42" width="8" height="4" rx="1" fill="currentColor" />
</svg>`;

/** ARM App Service — globe/web icon. */
export const ARM_APP_SERVICE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="32" cy="32" r="24" />
  <ellipse cx="32" cy="32" rx="10" ry="24" />
  <line x1="8" y1="32" x2="56" y2="32" />
  <path d="M12 20h40" />
  <path d="M12 44h40" />
</svg>`;

/** ARM Container Registry — container/registry icon. */
export const ARM_CONTAINER_REGISTRY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="8" y="14" width="48" height="36" rx="3" />
  <rect x="14" y="20" width="16" height="12" rx="1" />
  <rect x="34" y="20" width="16" height="12" rx="1" />
  <rect x="14" y="34" width="16" height="12" rx="1" />
  <rect x="34" y="34" width="16" height="12" rx="1" />
  <line x1="22" y1="14" x2="22" y2="10" />
  <line x1="32" y1="14" x2="32" y2="8" />
  <line x1="42" y1="14" x2="42" y2="10" />
</svg>`;
