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
  PROMETHEUS_SVG,
} from './svgs/genericIt.js';
import {
  BOUNDARY_ZONE_SVG,
  MICROSERVICE_SVG,
  CONTAINER_SVG,
} from './svgs/architecture.js';
import {
  AZURE_PRO_VIRTUAL_MACHINES_SVG,
  AZURE_PRO_APP_SERVICE_SVG,
  AZURE_PRO_FUNCTIONS_SVG,
  AZURE_PRO_AKS_SVG,
  AZURE_PRO_CONTAINER_INSTANCES_SVG,
  AZURE_PRO_VMSS_SVG,
  AZURE_PRO_BLOB_STORAGE_SVG,
  AZURE_PRO_FILE_STORAGE_SVG,
  AZURE_PRO_DISK_STORAGE_SVG,
  AZURE_PRO_DATA_LAKE_SVG,
  AZURE_PRO_SQL_DATABASE_SVG,
  AZURE_PRO_COSMOS_DB_SVG,
  AZURE_PRO_MYSQL_SVG,
  AZURE_PRO_POSTGRESQL_SVG,
  AZURE_PRO_REDIS_CACHE_SVG,
  AZURE_PRO_VIRTUAL_NETWORK_SVG,
  AZURE_PRO_LOAD_BALANCER_SVG,
  AZURE_PRO_APPLICATION_GATEWAY_SVG,
  AZURE_PRO_FRONT_DOOR_SVG,
  AZURE_PRO_DNS_ZONE_SVG,
  AZURE_PRO_EXPRESSROUTE_SVG,
  AZURE_PRO_KEY_VAULT_SVG,
  AZURE_PRO_ACTIVE_DIRECTORY_SVG,
  AZURE_PRO_SENTINEL_SVG,
  AZURE_PRO_DDOS_PROTECTION_SVG,
  AZURE_PRO_MONITOR_SVG,
  AZURE_PRO_LOG_ANALYTICS_SVG,
  AZURE_PRO_DEVOPS_SVG,
  AZURE_PRO_RESOURCE_GROUP_SVG,
  AZURE_PRO_COGNITIVE_SERVICES_SVG,
  AZURE_PRO_OPENAI_SERVICE_SVG,
} from './svgs/azure-pro.js';
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
// (azure-arm imports removed — replaced by azure-pro)
import {
  FORTI_GATE_SVG,
  FORTI_SWITCH_SVG,
  FORTI_AP_SVG,
  FORTI_MANAGER_SVG,
  FORTI_ANALYZER_SVG,
  FORTI_WEB_SVG,
  FORTI_MAIL_SVG,
  FORTI_CLIENT_SVG,
  FORTI_SANDBOX_SVG,
  FORTI_SIEM_SVG,
  FORTI_NAC_SVG,
  FORTI_EDR_SVG,
  FORTI_PROXY_SVG,
  FORTI_DDOS_SVG,
  FORTI_ADC_SVG,
  FORTI_AUTHENTICATOR_SVG,
  FORTI_TOKEN_SVG,
  FORTI_EXTENDER_SVG,
  FORTI_DECEPTOR_SVG,
  FORTI_SOAR_SVG,
} from './svgs/fortinet.js';
import {
  CISCO_PRO_ROUTER_SVG,
  CISCO_PRO_SWITCH_SVG,
  CISCO_PRO_L3_SWITCH_SVG,
  CISCO_PRO_FIREWALL_SVG,
  CISCO_PRO_WIRELESS_AP_SVG,
  CISCO_PRO_WLC_SVG,
  CISCO_PRO_ASA_SVG,
  CISCO_PRO_ISE_SVG,
  CISCO_PRO_UMBRELLA_SVG,
  CISCO_PRO_AMP_SVG,
  CISCO_PRO_STEALTHWATCH_SVG,
  CISCO_PRO_IP_PHONE_SVG,
  CISCO_PRO_VIDEO_ENDPOINT_SVG,
  CISCO_PRO_WEBEX_SVG,
  CISCO_PRO_CALL_MANAGER_SVG,
  CISCO_PRO_UCS_SVG,
  CISCO_PRO_NEXUS_SVG,
  CISCO_PRO_ACI_SVG,
  CISCO_PRO_HYPERFLEX_SVG,
  CISCO_PRO_MERAKI_SVG,
  CISCO_PRO_SD_WAN_SVG,
  CISCO_PRO_VIPTELA_SVG,
  CISCO_PRO_CLOUD_SVG,
  CISCO_PRO_INTERNET_SVG,
  CISCO_PRO_STACK_SVG,
  CISCO_PRO_SERVER_SVG,
  CISCO_PRO_WORKSTATION_SVG,
  CISCO_PRO_LAPTOP_SVG,
  CISCO_PRO_PRINTER_SVG,
  CISCO_PRO_CAMERA_SVG,
} from './svgs/cisco-pro.js';
import {
  AWS_PRO_EC2_SVG,
  AWS_PRO_LAMBDA_SVG,
  AWS_PRO_ECS_SVG,
  AWS_PRO_EKS_SVG,
  AWS_PRO_FARGATE_SVG,
  AWS_PRO_LIGHTSAIL_SVG,
  AWS_PRO_S3_SVG,
  AWS_PRO_EBS_SVG,
  AWS_PRO_EFS_SVG,
  AWS_PRO_GLACIER_SVG,
  AWS_PRO_RDS_SVG,
  AWS_PRO_DYNAMODB_SVG,
  AWS_PRO_AURORA_SVG,
  AWS_PRO_ELASTICACHE_SVG,
  AWS_PRO_REDSHIFT_SVG,
  AWS_PRO_VPC_SVG,
  AWS_PRO_CLOUDFRONT_SVG,
  AWS_PRO_ROUTE53_SVG,
  AWS_PRO_ELB_SVG,
  AWS_PRO_API_GATEWAY_SVG,
  AWS_PRO_DIRECT_CONNECT_SVG,
  AWS_PRO_IAM_SVG,
  AWS_PRO_WAF_SVG,
  AWS_PRO_SHIELD_SVG,
  AWS_PRO_KMS_SVG,
  AWS_PRO_COGNITO_SVG,
  AWS_PRO_CLOUDWATCH_SVG,
  AWS_PRO_CLOUDFORMATION_SVG,
  AWS_PRO_CLOUDTRAIL_SVG,
  AWS_PRO_SQS_SVG,
  AWS_PRO_SNS_SVG,
  AWS_PRO_EVENTBRIDGE_SVG,
} from './svgs/aws-pro.js';
import {
  GCP_PRO_COMPUTE_ENGINE_SVG,
  GCP_PRO_APP_ENGINE_SVG,
  GCP_PRO_CLOUD_FUNCTIONS_SVG,
  GCP_PRO_GKE_SVG,
  GCP_PRO_CLOUD_RUN_SVG,
  GCP_PRO_CLOUD_STORAGE_SVG,
  GCP_PRO_PERSISTENT_DISK_SVG,
  GCP_PRO_FILESTORE_SVG,
  GCP_PRO_CLOUD_SQL_SVG,
  GCP_PRO_FIRESTORE_SVG,
  GCP_PRO_BIGTABLE_SVG,
  GCP_PRO_SPANNER_SVG,
  GCP_PRO_BIGQUERY_SVG,
  GCP_PRO_VPC_SVG,
  GCP_PRO_CLOUD_CDN_SVG,
  GCP_PRO_CLOUD_DNS_SVG,
  GCP_PRO_CLOUD_LOAD_BALANCING_SVG,
  GCP_PRO_CLOUD_ARMOR_SVG,
  GCP_PRO_VERTEX_AI_SVG,
  GCP_PRO_CLOUD_VISION_SVG,
  GCP_PRO_CLOUD_SPEECH_SVG,
  GCP_PRO_CLOUD_MONITORING_SVG,
  GCP_PRO_CLOUD_LOGGING_SVG,
  GCP_PRO_CLOUD_BUILD_SVG,
  GCP_PRO_PUB_SUB_SVG,
} from './svgs/gcp-pro.js';

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

  // ── Azure Pro (hand-crafted) ─────────────────────────────
  // Compute
  ['azure-pro-virtual-machines', { id: 'azure-pro-virtual-machines', category: 'azure-pro', label: 'Virtual Machines', svgContent: AZURE_PRO_VIRTUAL_MACHINES_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-app-service', { id: 'azure-pro-app-service', category: 'azure-pro', label: 'App Service', svgContent: AZURE_PRO_APP_SERVICE_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-functions', { id: 'azure-pro-functions', category: 'azure-pro', label: 'Azure Functions', svgContent: AZURE_PRO_FUNCTIONS_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-aks', { id: 'azure-pro-aks', category: 'azure-pro', label: 'AKS', svgContent: AZURE_PRO_AKS_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-container-instances', { id: 'azure-pro-container-instances', category: 'azure-pro', label: 'Container Instances', svgContent: AZURE_PRO_CONTAINER_INSTANCES_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-vmss', { id: 'azure-pro-vmss', category: 'azure-pro', label: 'VM Scale Sets', svgContent: AZURE_PRO_VMSS_SVG, defaultSize: ICON_SIZE }],
  // Storage
  ['azure-pro-blob-storage', { id: 'azure-pro-blob-storage', category: 'azure-pro', label: 'Blob Storage', svgContent: AZURE_PRO_BLOB_STORAGE_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-file-storage', { id: 'azure-pro-file-storage', category: 'azure-pro', label: 'File Storage', svgContent: AZURE_PRO_FILE_STORAGE_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-disk-storage', { id: 'azure-pro-disk-storage', category: 'azure-pro', label: 'Disk Storage', svgContent: AZURE_PRO_DISK_STORAGE_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-data-lake', { id: 'azure-pro-data-lake', category: 'azure-pro', label: 'Data Lake', svgContent: AZURE_PRO_DATA_LAKE_SVG, defaultSize: ICON_SIZE }],
  // Database
  ['azure-pro-sql-database', { id: 'azure-pro-sql-database', category: 'azure-pro', label: 'SQL Database', svgContent: AZURE_PRO_SQL_DATABASE_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-cosmos-db', { id: 'azure-pro-cosmos-db', category: 'azure-pro', label: 'Cosmos DB', svgContent: AZURE_PRO_COSMOS_DB_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-mysql', { id: 'azure-pro-mysql', category: 'azure-pro', label: 'MySQL', svgContent: AZURE_PRO_MYSQL_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-postgresql', { id: 'azure-pro-postgresql', category: 'azure-pro', label: 'PostgreSQL', svgContent: AZURE_PRO_POSTGRESQL_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-redis-cache', { id: 'azure-pro-redis-cache', category: 'azure-pro', label: 'Redis Cache', svgContent: AZURE_PRO_REDIS_CACHE_SVG, defaultSize: ICON_SIZE }],
  // Networking
  ['azure-pro-virtual-network', { id: 'azure-pro-virtual-network', category: 'azure-pro', label: 'Virtual Network', svgContent: AZURE_PRO_VIRTUAL_NETWORK_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-load-balancer', { id: 'azure-pro-load-balancer', category: 'azure-pro', label: 'Load Balancer', svgContent: AZURE_PRO_LOAD_BALANCER_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-application-gateway', { id: 'azure-pro-application-gateway', category: 'azure-pro', label: 'Application Gateway', svgContent: AZURE_PRO_APPLICATION_GATEWAY_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-front-door', { id: 'azure-pro-front-door', category: 'azure-pro', label: 'Front Door', svgContent: AZURE_PRO_FRONT_DOOR_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-dns-zone', { id: 'azure-pro-dns-zone', category: 'azure-pro', label: 'DNS Zone', svgContent: AZURE_PRO_DNS_ZONE_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-expressroute', { id: 'azure-pro-expressroute', category: 'azure-pro', label: 'ExpressRoute', svgContent: AZURE_PRO_EXPRESSROUTE_SVG, defaultSize: ICON_SIZE }],
  // Security
  ['azure-pro-key-vault', { id: 'azure-pro-key-vault', category: 'azure-pro', label: 'Key Vault', svgContent: AZURE_PRO_KEY_VAULT_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-active-directory', { id: 'azure-pro-active-directory', category: 'azure-pro', label: 'Active Directory', svgContent: AZURE_PRO_ACTIVE_DIRECTORY_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-sentinel', { id: 'azure-pro-sentinel', category: 'azure-pro', label: 'Sentinel', svgContent: AZURE_PRO_SENTINEL_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-ddos-protection', { id: 'azure-pro-ddos-protection', category: 'azure-pro', label: 'DDoS Protection', svgContent: AZURE_PRO_DDOS_PROTECTION_SVG, defaultSize: ICON_SIZE }],
  // Management
  ['azure-pro-monitor', { id: 'azure-pro-monitor', category: 'azure-pro', label: 'Monitor', svgContent: AZURE_PRO_MONITOR_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-log-analytics', { id: 'azure-pro-log-analytics', category: 'azure-pro', label: 'Log Analytics', svgContent: AZURE_PRO_LOG_ANALYTICS_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-devops', { id: 'azure-pro-devops', category: 'azure-pro', label: 'DevOps', svgContent: AZURE_PRO_DEVOPS_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-resource-group', { id: 'azure-pro-resource-group', category: 'azure-pro', label: 'Resource Group', svgContent: AZURE_PRO_RESOURCE_GROUP_SVG, defaultSize: ICON_SIZE }],
  // AI
  ['azure-pro-cognitive-services', { id: 'azure-pro-cognitive-services', category: 'azure-pro', label: 'Cognitive Services', svgContent: AZURE_PRO_COGNITIVE_SERVICES_SVG, defaultSize: ICON_SIZE }],
  ['azure-pro-openai-service', { id: 'azure-pro-openai-service', category: 'azure-pro', label: 'OpenAI Service', svgContent: AZURE_PRO_OPENAI_SERVICE_SVG, defaultSize: ICON_SIZE }],

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

  // ── Fortinet ──────────────────────────────────────────────
  ['forti-gate', { id: 'forti-gate', category: 'fortinet', label: 'FortiGate', svgContent: FORTI_GATE_SVG, defaultSize: ICON_SIZE }],
  ['forti-switch', { id: 'forti-switch', category: 'fortinet', label: 'FortiSwitch', svgContent: FORTI_SWITCH_SVG, defaultSize: ICON_SIZE }],
  ['forti-ap', { id: 'forti-ap', category: 'fortinet', label: 'FortiAP', svgContent: FORTI_AP_SVG, defaultSize: ICON_SIZE }],
  ['forti-manager', { id: 'forti-manager', category: 'fortinet', label: 'FortiManager', svgContent: FORTI_MANAGER_SVG, defaultSize: ICON_SIZE }],
  ['forti-analyzer', { id: 'forti-analyzer', category: 'fortinet', label: 'FortiAnalyzer', svgContent: FORTI_ANALYZER_SVG, defaultSize: ICON_SIZE }],
  ['forti-web', { id: 'forti-web', category: 'fortinet', label: 'FortiWeb', svgContent: FORTI_WEB_SVG, defaultSize: ICON_SIZE }],
  ['forti-mail', { id: 'forti-mail', category: 'fortinet', label: 'FortiMail', svgContent: FORTI_MAIL_SVG, defaultSize: ICON_SIZE }],
  ['forti-client', { id: 'forti-client', category: 'fortinet', label: 'FortiClient', svgContent: FORTI_CLIENT_SVG, defaultSize: ICON_SIZE }],
  ['forti-sandbox', { id: 'forti-sandbox', category: 'fortinet', label: 'FortiSandbox', svgContent: FORTI_SANDBOX_SVG, defaultSize: ICON_SIZE }],
  ['forti-siem', { id: 'forti-siem', category: 'fortinet', label: 'FortiSIEM', svgContent: FORTI_SIEM_SVG, defaultSize: ICON_SIZE }],
  ['forti-nac', { id: 'forti-nac', category: 'fortinet', label: 'FortiNAC', svgContent: FORTI_NAC_SVG, defaultSize: ICON_SIZE }],
  ['forti-edr', { id: 'forti-edr', category: 'fortinet', label: 'FortiEDR', svgContent: FORTI_EDR_SVG, defaultSize: ICON_SIZE }],
  ['forti-proxy', { id: 'forti-proxy', category: 'fortinet', label: 'FortiProxy', svgContent: FORTI_PROXY_SVG, defaultSize: ICON_SIZE }],
  ['forti-ddos', { id: 'forti-ddos', category: 'fortinet', label: 'FortiDDoS', svgContent: FORTI_DDOS_SVG, defaultSize: ICON_SIZE }],
  ['forti-adc', { id: 'forti-adc', category: 'fortinet', label: 'FortiADC', svgContent: FORTI_ADC_SVG, defaultSize: ICON_SIZE }],
  ['forti-authenticator', { id: 'forti-authenticator', category: 'fortinet', label: 'FortiAuthenticator', svgContent: FORTI_AUTHENTICATOR_SVG, defaultSize: ICON_SIZE }],
  ['forti-token', { id: 'forti-token', category: 'fortinet', label: 'FortiToken', svgContent: FORTI_TOKEN_SVG, defaultSize: ICON_SIZE }],
  ['forti-extender', { id: 'forti-extender', category: 'fortinet', label: 'FortiExtender', svgContent: FORTI_EXTENDER_SVG, defaultSize: ICON_SIZE }],
  ['forti-deceptor', { id: 'forti-deceptor', category: 'fortinet', label: 'FortiDeceptor', svgContent: FORTI_DECEPTOR_SVG, defaultSize: ICON_SIZE }],
  ['forti-soar', { id: 'forti-soar', category: 'fortinet', label: 'FortiSOAR', svgContent: FORTI_SOAR_SVG, defaultSize: ICON_SIZE }],

  // ── Cisco Pro (hand-crafted) ──────────────────────────────
  // Networking
  ['cisco-pro-router', { id: 'cisco-pro-router', category: 'cisco-pro', label: 'Router', svgContent: CISCO_PRO_ROUTER_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-switch', { id: 'cisco-pro-switch', category: 'cisco-pro', label: 'Switch', svgContent: CISCO_PRO_SWITCH_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-l3-switch', { id: 'cisco-pro-l3-switch', category: 'cisco-pro', label: 'L3 Switch', svgContent: CISCO_PRO_L3_SWITCH_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-firewall', { id: 'cisco-pro-firewall', category: 'cisco-pro', label: 'Firewall', svgContent: CISCO_PRO_FIREWALL_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-wireless-ap', { id: 'cisco-pro-wireless-ap', category: 'cisco-pro', label: 'Wireless AP', svgContent: CISCO_PRO_WIRELESS_AP_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-wlc', { id: 'cisco-pro-wlc', category: 'cisco-pro', label: 'Wireless Controller', svgContent: CISCO_PRO_WLC_SVG, defaultSize: ICON_SIZE }],
  // Security
  ['cisco-pro-asa', { id: 'cisco-pro-asa', category: 'cisco-pro', label: 'ASA', svgContent: CISCO_PRO_ASA_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-ise', { id: 'cisco-pro-ise', category: 'cisco-pro', label: 'ISE', svgContent: CISCO_PRO_ISE_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-umbrella', { id: 'cisco-pro-umbrella', category: 'cisco-pro', label: 'Umbrella', svgContent: CISCO_PRO_UMBRELLA_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-amp', { id: 'cisco-pro-amp', category: 'cisco-pro', label: 'AMP', svgContent: CISCO_PRO_AMP_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-stealthwatch', { id: 'cisco-pro-stealthwatch', category: 'cisco-pro', label: 'Stealthwatch', svgContent: CISCO_PRO_STEALTHWATCH_SVG, defaultSize: ICON_SIZE }],
  // Collaboration
  ['cisco-pro-ip-phone', { id: 'cisco-pro-ip-phone', category: 'cisco-pro', label: 'IP Phone', svgContent: CISCO_PRO_IP_PHONE_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-video-endpoint', { id: 'cisco-pro-video-endpoint', category: 'cisco-pro', label: 'Video Endpoint', svgContent: CISCO_PRO_VIDEO_ENDPOINT_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-webex', { id: 'cisco-pro-webex', category: 'cisco-pro', label: 'Webex', svgContent: CISCO_PRO_WEBEX_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-call-manager', { id: 'cisco-pro-call-manager', category: 'cisco-pro', label: 'Call Manager', svgContent: CISCO_PRO_CALL_MANAGER_SVG, defaultSize: ICON_SIZE }],
  // Data Center
  ['cisco-pro-ucs', { id: 'cisco-pro-ucs', category: 'cisco-pro', label: 'UCS Server', svgContent: CISCO_PRO_UCS_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-nexus', { id: 'cisco-pro-nexus', category: 'cisco-pro', label: 'Nexus Switch', svgContent: CISCO_PRO_NEXUS_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-aci', { id: 'cisco-pro-aci', category: 'cisco-pro', label: 'ACI Fabric', svgContent: CISCO_PRO_ACI_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-hyperflex', { id: 'cisco-pro-hyperflex', category: 'cisco-pro', label: 'HyperFlex', svgContent: CISCO_PRO_HYPERFLEX_SVG, defaultSize: ICON_SIZE }],
  // Cloud & SD-WAN
  ['cisco-pro-meraki', { id: 'cisco-pro-meraki', category: 'cisco-pro', label: 'Meraki', svgContent: CISCO_PRO_MERAKI_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-sd-wan', { id: 'cisco-pro-sd-wan', category: 'cisco-pro', label: 'SD-WAN', svgContent: CISCO_PRO_SD_WAN_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-viptela', { id: 'cisco-pro-viptela', category: 'cisco-pro', label: 'Viptela', svgContent: CISCO_PRO_VIPTELA_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-cloud', { id: 'cisco-pro-cloud', category: 'cisco-pro', label: 'Cloud', svgContent: CISCO_PRO_CLOUD_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-internet', { id: 'cisco-pro-internet', category: 'cisco-pro', label: 'Internet', svgContent: CISCO_PRO_INTERNET_SVG, defaultSize: ICON_SIZE }],
  // Infrastructure
  ['cisco-pro-stack', { id: 'cisco-pro-stack', category: 'cisco-pro', label: 'Stack', svgContent: CISCO_PRO_STACK_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-server', { id: 'cisco-pro-server', category: 'cisco-pro', label: 'Server', svgContent: CISCO_PRO_SERVER_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-workstation', { id: 'cisco-pro-workstation', category: 'cisco-pro', label: 'Workstation', svgContent: CISCO_PRO_WORKSTATION_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-laptop', { id: 'cisco-pro-laptop', category: 'cisco-pro', label: 'Laptop', svgContent: CISCO_PRO_LAPTOP_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-printer', { id: 'cisco-pro-printer', category: 'cisco-pro', label: 'Printer', svgContent: CISCO_PRO_PRINTER_SVG, defaultSize: ICON_SIZE }],
  ['cisco-pro-camera', { id: 'cisco-pro-camera', category: 'cisco-pro', label: 'IP Camera', svgContent: CISCO_PRO_CAMERA_SVG, defaultSize: ICON_SIZE }],

  // ── AWS Pro (hand-crafted) ────────────────────────────────
  // Compute
  ['aws-pro-ec2', { id: 'aws-pro-ec2', category: 'aws-pro', label: 'EC2', svgContent: AWS_PRO_EC2_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-lambda', { id: 'aws-pro-lambda', category: 'aws-pro', label: 'Lambda', svgContent: AWS_PRO_LAMBDA_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-ecs', { id: 'aws-pro-ecs', category: 'aws-pro', label: 'ECS', svgContent: AWS_PRO_ECS_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-eks', { id: 'aws-pro-eks', category: 'aws-pro', label: 'EKS', svgContent: AWS_PRO_EKS_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-fargate', { id: 'aws-pro-fargate', category: 'aws-pro', label: 'Fargate', svgContent: AWS_PRO_FARGATE_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-lightsail', { id: 'aws-pro-lightsail', category: 'aws-pro', label: 'Lightsail', svgContent: AWS_PRO_LIGHTSAIL_SVG, defaultSize: ICON_SIZE }],
  // Storage
  ['aws-pro-s3', { id: 'aws-pro-s3', category: 'aws-pro', label: 'S3', svgContent: AWS_PRO_S3_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-ebs', { id: 'aws-pro-ebs', category: 'aws-pro', label: 'EBS', svgContent: AWS_PRO_EBS_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-efs', { id: 'aws-pro-efs', category: 'aws-pro', label: 'EFS', svgContent: AWS_PRO_EFS_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-glacier', { id: 'aws-pro-glacier', category: 'aws-pro', label: 'Glacier', svgContent: AWS_PRO_GLACIER_SVG, defaultSize: ICON_SIZE }],
  // Database
  ['aws-pro-rds', { id: 'aws-pro-rds', category: 'aws-pro', label: 'RDS', svgContent: AWS_PRO_RDS_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-dynamodb', { id: 'aws-pro-dynamodb', category: 'aws-pro', label: 'DynamoDB', svgContent: AWS_PRO_DYNAMODB_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-aurora', { id: 'aws-pro-aurora', category: 'aws-pro', label: 'Aurora', svgContent: AWS_PRO_AURORA_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-elasticache', { id: 'aws-pro-elasticache', category: 'aws-pro', label: 'ElastiCache', svgContent: AWS_PRO_ELASTICACHE_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-redshift', { id: 'aws-pro-redshift', category: 'aws-pro', label: 'Redshift', svgContent: AWS_PRO_REDSHIFT_SVG, defaultSize: ICON_SIZE }],
  // Networking
  ['aws-pro-vpc', { id: 'aws-pro-vpc', category: 'aws-pro', label: 'VPC', svgContent: AWS_PRO_VPC_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-cloudfront', { id: 'aws-pro-cloudfront', category: 'aws-pro', label: 'CloudFront', svgContent: AWS_PRO_CLOUDFRONT_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-route53', { id: 'aws-pro-route53', category: 'aws-pro', label: 'Route 53', svgContent: AWS_PRO_ROUTE53_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-elb', { id: 'aws-pro-elb', category: 'aws-pro', label: 'ELB/ALB', svgContent: AWS_PRO_ELB_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-api-gateway', { id: 'aws-pro-api-gateway', category: 'aws-pro', label: 'API Gateway', svgContent: AWS_PRO_API_GATEWAY_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-direct-connect', { id: 'aws-pro-direct-connect', category: 'aws-pro', label: 'Direct Connect', svgContent: AWS_PRO_DIRECT_CONNECT_SVG, defaultSize: ICON_SIZE }],
  // Security
  ['aws-pro-iam', { id: 'aws-pro-iam', category: 'aws-pro', label: 'IAM', svgContent: AWS_PRO_IAM_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-waf', { id: 'aws-pro-waf', category: 'aws-pro', label: 'WAF', svgContent: AWS_PRO_WAF_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-shield', { id: 'aws-pro-shield', category: 'aws-pro', label: 'Shield', svgContent: AWS_PRO_SHIELD_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-kms', { id: 'aws-pro-kms', category: 'aws-pro', label: 'KMS', svgContent: AWS_PRO_KMS_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-cognito', { id: 'aws-pro-cognito', category: 'aws-pro', label: 'Cognito', svgContent: AWS_PRO_COGNITO_SVG, defaultSize: ICON_SIZE }],
  // Management
  ['aws-pro-cloudwatch', { id: 'aws-pro-cloudwatch', category: 'aws-pro', label: 'CloudWatch', svgContent: AWS_PRO_CLOUDWATCH_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-cloudformation', { id: 'aws-pro-cloudformation', category: 'aws-pro', label: 'CloudFormation', svgContent: AWS_PRO_CLOUDFORMATION_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-cloudtrail', { id: 'aws-pro-cloudtrail', category: 'aws-pro', label: 'CloudTrail', svgContent: AWS_PRO_CLOUDTRAIL_SVG, defaultSize: ICON_SIZE }],
  // Messaging
  ['aws-pro-sqs', { id: 'aws-pro-sqs', category: 'aws-pro', label: 'SQS', svgContent: AWS_PRO_SQS_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-sns', { id: 'aws-pro-sns', category: 'aws-pro', label: 'SNS', svgContent: AWS_PRO_SNS_SVG, defaultSize: ICON_SIZE }],
  ['aws-pro-eventbridge', { id: 'aws-pro-eventbridge', category: 'aws-pro', label: 'EventBridge', svgContent: AWS_PRO_EVENTBRIDGE_SVG, defaultSize: ICON_SIZE }],

  // ── GCP Pro (hand-crafted) ─────────────────────────────────
  // Compute
  ['gcp-pro-compute-engine', { id: 'gcp-pro-compute-engine', category: 'gcp-pro', label: 'Compute Engine', svgContent: GCP_PRO_COMPUTE_ENGINE_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-app-engine', { id: 'gcp-pro-app-engine', category: 'gcp-pro', label: 'App Engine', svgContent: GCP_PRO_APP_ENGINE_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-cloud-functions', { id: 'gcp-pro-cloud-functions', category: 'gcp-pro', label: 'Cloud Functions', svgContent: GCP_PRO_CLOUD_FUNCTIONS_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-gke', { id: 'gcp-pro-gke', category: 'gcp-pro', label: 'GKE', svgContent: GCP_PRO_GKE_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-cloud-run', { id: 'gcp-pro-cloud-run', category: 'gcp-pro', label: 'Cloud Run', svgContent: GCP_PRO_CLOUD_RUN_SVG, defaultSize: ICON_SIZE }],
  // Storage
  ['gcp-pro-cloud-storage', { id: 'gcp-pro-cloud-storage', category: 'gcp-pro', label: 'Cloud Storage', svgContent: GCP_PRO_CLOUD_STORAGE_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-persistent-disk', { id: 'gcp-pro-persistent-disk', category: 'gcp-pro', label: 'Persistent Disk', svgContent: GCP_PRO_PERSISTENT_DISK_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-filestore', { id: 'gcp-pro-filestore', category: 'gcp-pro', label: 'Filestore', svgContent: GCP_PRO_FILESTORE_SVG, defaultSize: ICON_SIZE }],
  // Database
  ['gcp-pro-cloud-sql', { id: 'gcp-pro-cloud-sql', category: 'gcp-pro', label: 'Cloud SQL', svgContent: GCP_PRO_CLOUD_SQL_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-firestore', { id: 'gcp-pro-firestore', category: 'gcp-pro', label: 'Firestore', svgContent: GCP_PRO_FIRESTORE_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-bigtable', { id: 'gcp-pro-bigtable', category: 'gcp-pro', label: 'Bigtable', svgContent: GCP_PRO_BIGTABLE_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-spanner', { id: 'gcp-pro-spanner', category: 'gcp-pro', label: 'Spanner', svgContent: GCP_PRO_SPANNER_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-bigquery', { id: 'gcp-pro-bigquery', category: 'gcp-pro', label: 'BigQuery', svgContent: GCP_PRO_BIGQUERY_SVG, defaultSize: ICON_SIZE }],
  // Networking
  ['gcp-pro-vpc', { id: 'gcp-pro-vpc', category: 'gcp-pro', label: 'VPC', svgContent: GCP_PRO_VPC_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-cloud-cdn', { id: 'gcp-pro-cloud-cdn', category: 'gcp-pro', label: 'Cloud CDN', svgContent: GCP_PRO_CLOUD_CDN_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-cloud-dns', { id: 'gcp-pro-cloud-dns', category: 'gcp-pro', label: 'Cloud DNS', svgContent: GCP_PRO_CLOUD_DNS_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-cloud-load-balancing', { id: 'gcp-pro-cloud-load-balancing', category: 'gcp-pro', label: 'Cloud Load Balancing', svgContent: GCP_PRO_CLOUD_LOAD_BALANCING_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-cloud-armor', { id: 'gcp-pro-cloud-armor', category: 'gcp-pro', label: 'Cloud Armor', svgContent: GCP_PRO_CLOUD_ARMOR_SVG, defaultSize: ICON_SIZE }],
  // AI/ML
  ['gcp-pro-vertex-ai', { id: 'gcp-pro-vertex-ai', category: 'gcp-pro', label: 'Vertex AI', svgContent: GCP_PRO_VERTEX_AI_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-cloud-vision', { id: 'gcp-pro-cloud-vision', category: 'gcp-pro', label: 'Cloud Vision', svgContent: GCP_PRO_CLOUD_VISION_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-cloud-speech', { id: 'gcp-pro-cloud-speech', category: 'gcp-pro', label: 'Cloud Speech', svgContent: GCP_PRO_CLOUD_SPEECH_SVG, defaultSize: ICON_SIZE }],
  // Management
  ['gcp-pro-cloud-monitoring', { id: 'gcp-pro-cloud-monitoring', category: 'gcp-pro', label: 'Cloud Monitoring', svgContent: GCP_PRO_CLOUD_MONITORING_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-cloud-logging', { id: 'gcp-pro-cloud-logging', category: 'gcp-pro', label: 'Cloud Logging', svgContent: GCP_PRO_CLOUD_LOGGING_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-cloud-build', { id: 'gcp-pro-cloud-build', category: 'gcp-pro', label: 'Cloud Build', svgContent: GCP_PRO_CLOUD_BUILD_SVG, defaultSize: ICON_SIZE }],
  ['gcp-pro-pub-sub', { id: 'gcp-pro-pub-sub', category: 'gcp-pro', label: 'Pub/Sub', svgContent: GCP_PRO_PUB_SUB_SVG, defaultSize: ICON_SIZE }],
]);

// ── Initialize metadata from eager catalog ────────────────

function syncMetaFromCatalog(): void {
  for (const [_id, entry] of STENCIL_CATALOG) {
    if (!STENCIL_META.has(entry.id)) {
      STENCIL_META.set(entry.id, {
        id: entry.id,
        label: entry.label,
        category: entry.category,
        defaultSize: { width: entry.defaultSize.width, height: entry.defaultSize.height },
      });
      LOADED_CATEGORIES.add(entry.category);
    }
  }
}

// Run once for hand-crafted stencils registered above
syncMetaFromCatalog();

/** Re-sync metadata after late registrations (e.g., draw.io side-effect imports). */
export { syncMetaFromCatalog as _syncMetaFromCatalog };

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
