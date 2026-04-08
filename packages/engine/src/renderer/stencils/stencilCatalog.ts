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
  ROUTER_SVG,
  SWITCH_SVG,
  HUB_SVG,
  BRIDGE_SVG,
  GATEWAY_SVG,
  FIREWALL_SVG as NETWORK_FIREWALL_SVG,
  LOAD_BALANCER_SVG as NETWORK_LB_SVG,
  PROXY_SVG,
  WIRELESS_AP_SVG,
  ANTENNA_SVG,
  SATELLITE_SVG,
  MODEM_SVG,
  PATCH_PANEL_SVG,
  RACK_SVG,
  INTERNET_CLOUD_SVG,
  SERVER_SVG,
} from './svgs/network.js';
import {
  DESKTOP_COMPUTER_SVG,
  LAPTOP_SVG,
  TABLET_SVG,
  SMARTPHONE_SVG,
  SERVER_SVG as GENERIC_SERVER_SVG,
  DATABASE_SVG,
  STORAGE_ARRAY_SVG,
  PRINTER_SVG,
  SCANNER_SVG,
  MONITOR_SVG,
  USB_DRIVE_SVG,
  HARD_DRIVE_SVG,
  SSD_SVG,
  HEADSET_SVG,
  WEBCAM_SVG,
} from './svgs/genericIt.js';
import {
  MICROSERVICE_SVG,
  API_GATEWAY_SVG as ARCH_API_GATEWAY_SVG,
  MESSAGE_QUEUE_SVG,
  DATABASE_SVG as ARCH_DATABASE_SVG,
  CACHE_SVG,
  CDN_SVG,
  LOAD_BALANCER_SVG as ARCH_LB_SVG,
  CONTAINER_SVG,
  SERVERLESS_SVG,
  CLIENT_BROWSER_SVG,
  MOBILE_APP_SVG,
  DESKTOP_SVG,
  CLOUD_SVG,
  ON_PREMISE_SVG,
  HYBRID_CLOUD_SVG,
} from './svgs/architecture.js';
import {
  SHIELD_SVG,
  LOCK_SVG,
  KEY_SVG,
  PADLOCK_SVG,
  FIREWALL_SVG as SEC_FIREWALL_SVG,
  VPN_SVG,
  ENCRYPTION_SVG,
  CERTIFICATE_SVG,
  TOKEN_SVG,
  FINGERPRINT_SVG,
  ALERT_SVG,
  BUG_SVG,
  PATCH_SVG,
  AUDIT_LOG_SVG,
  COMPLIANCE_SVG,
  ZERO_TRUST_SVG,
} from './svgs/security.js';
import {
  K8S_POD_SVG,
  K8S_DEPLOYMENT_SVG,
  K8S_REPLICASET_SVG,
  K8S_STATEFULSET_SVG,
  K8S_DAEMONSET_SVG,
  K8S_JOB_SVG,
  K8S_CRONJOB_SVG,
  K8S_SERVICE_SVG,
  K8S_INGRESS_SVG,
  K8S_CONFIGMAP_SVG,
  K8S_SECRET_SVG,
  K8S_PERSISTENT_VOLUME_SVG,
  K8S_NAMESPACE_SVG,
  K8S_NODE_SVG,
  K8S_CLUSTER_SVG,
} from './svgs/kubernetes.js';
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
  ['router', { id: 'router', category: 'network', label: 'Router', svgContent: ROUTER_SVG, defaultSize: ICON_SIZE }],
  ['switch', { id: 'switch', category: 'network', label: 'Switch', svgContent: SWITCH_SVG, defaultSize: ICON_SIZE }],
  ['hub', { id: 'hub', category: 'network', label: 'Hub', svgContent: HUB_SVG, defaultSize: ICON_SIZE }],
  ['bridge', { id: 'bridge', category: 'network', label: 'Bridge', svgContent: BRIDGE_SVG, defaultSize: ICON_SIZE }],
  ['gateway', { id: 'gateway', category: 'network', label: 'Gateway', svgContent: GATEWAY_SVG, defaultSize: ICON_SIZE }],
  ['firewall', { id: 'firewall', category: 'network', label: 'Firewall', svgContent: NETWORK_FIREWALL_SVG, defaultSize: ICON_SIZE }],
  ['load-balancer', { id: 'load-balancer', category: 'network', label: 'Load Balancer', svgContent: NETWORK_LB_SVG, defaultSize: ICON_SIZE }],
  ['proxy', { id: 'proxy', category: 'network', label: 'Proxy', svgContent: PROXY_SVG, defaultSize: ICON_SIZE }],
  ['wireless-ap', { id: 'wireless-ap', category: 'network', label: 'Wireless AP', svgContent: WIRELESS_AP_SVG, defaultSize: ICON_SIZE }],
  ['antenna', { id: 'antenna', category: 'network', label: 'Antenna', svgContent: ANTENNA_SVG, defaultSize: ICON_SIZE }],
  ['satellite', { id: 'satellite', category: 'network', label: 'Satellite', svgContent: SATELLITE_SVG, defaultSize: ICON_SIZE }],
  ['modem', { id: 'modem', category: 'network', label: 'Modem', svgContent: MODEM_SVG, defaultSize: ICON_SIZE }],
  ['patch-panel', { id: 'patch-panel', category: 'network', label: 'Patch Panel', svgContent: PATCH_PANEL_SVG, defaultSize: ICON_SIZE }],
  ['rack', { id: 'rack', category: 'network', label: 'Rack', svgContent: RACK_SVG, defaultSize: ICON_SIZE }],
  ['internet-cloud', { id: 'internet-cloud', category: 'network', label: 'Internet Cloud', svgContent: INTERNET_CLOUD_SVG, defaultSize: ICON_SIZE }],
  ['server', { id: 'server', category: 'network', label: 'Server', svgContent: SERVER_SVG, defaultSize: ICON_SIZE }],

  // ── Generic IT ────────────────────────────────────────────
  ['desktop-computer', { id: 'desktop-computer', category: 'generic-it', label: 'Desktop Computer', svgContent: DESKTOP_COMPUTER_SVG, defaultSize: ICON_SIZE }],
  ['laptop', { id: 'laptop', category: 'generic-it', label: 'Laptop', svgContent: LAPTOP_SVG, defaultSize: ICON_SIZE }],
  ['tablet', { id: 'tablet', category: 'generic-it', label: 'Tablet', svgContent: TABLET_SVG, defaultSize: ICON_SIZE }],
  ['smartphone', { id: 'smartphone', category: 'generic-it', label: 'Smartphone', svgContent: SMARTPHONE_SVG, defaultSize: ICON_SIZE }],
  ['generic-server', { id: 'generic-server', category: 'generic-it', label: 'Server', svgContent: GENERIC_SERVER_SVG, defaultSize: ICON_SIZE }],
  ['database', { id: 'database', category: 'generic-it', label: 'Database', svgContent: DATABASE_SVG, defaultSize: ICON_SIZE }],
  ['storage-array', { id: 'storage-array', category: 'generic-it', label: 'Storage Array', svgContent: STORAGE_ARRAY_SVG, defaultSize: ICON_SIZE }],
  ['printer', { id: 'printer', category: 'generic-it', label: 'Printer', svgContent: PRINTER_SVG, defaultSize: ICON_SIZE }],
  ['scanner', { id: 'scanner', category: 'generic-it', label: 'Scanner', svgContent: SCANNER_SVG, defaultSize: ICON_SIZE }],
  ['monitor', { id: 'monitor', category: 'generic-it', label: 'Monitor', svgContent: MONITOR_SVG, defaultSize: ICON_SIZE }],
  ['usb-drive', { id: 'usb-drive', category: 'generic-it', label: 'USB Drive', svgContent: USB_DRIVE_SVG, defaultSize: ICON_SIZE }],
  ['hard-drive', { id: 'hard-drive', category: 'generic-it', label: 'Hard Drive', svgContent: HARD_DRIVE_SVG, defaultSize: ICON_SIZE }],
  ['ssd', { id: 'ssd', category: 'generic-it', label: 'SSD', svgContent: SSD_SVG, defaultSize: ICON_SIZE }],
  ['headset', { id: 'headset', category: 'generic-it', label: 'Headset', svgContent: HEADSET_SVG, defaultSize: ICON_SIZE }],
  ['webcam', { id: 'webcam', category: 'generic-it', label: 'Webcam', svgContent: WEBCAM_SVG, defaultSize: ICON_SIZE }],

  // ── Azure (Sub-ticket C) ────────────────────────────────
  [
    {
      label: 'App Gateway',
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    {
      label: 'Azure Kubernetes Service',
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    {
      label: 'Azure Storage',
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    {
      label: 'Azure SQL Database',
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    {
      label: 'Azure Functions',
      defaultSize: { width: 64, height: 64 },
    },
  ],
  [
    {
      label: 'Azure Virtual Network',
      defaultSize: { width: 64, height: 64 },
    },
  ],
  ['prometheus', { id: 'prometheus', category: 'generic-it', label: 'Prometheus', svgContent: PROMETHEUS_SVG, defaultSize: ICON_SIZE }],

  // ── Security ────────────────────────────────────────────
  ['shield', { id: 'shield', category: 'security', label: 'Shield', svgContent: SHIELD_SVG, defaultSize: ICON_SIZE }],
  ['lock', { id: 'lock', category: 'security', label: 'Lock', svgContent: LOCK_SVG, defaultSize: ICON_SIZE }],
  ['key', { id: 'key', category: 'security', label: 'Key', svgContent: KEY_SVG, defaultSize: ICON_SIZE }],
  ['padlock', { id: 'padlock', category: 'security', label: 'Padlock', svgContent: PADLOCK_SVG, defaultSize: ICON_SIZE }],
  ['sec-firewall', { id: 'sec-firewall', category: 'security', label: 'Firewall', svgContent: SEC_FIREWALL_SVG, defaultSize: ICON_SIZE }],
  ['vpn', { id: 'vpn', category: 'security', label: 'VPN', svgContent: VPN_SVG, defaultSize: ICON_SIZE }],
  ['encryption', { id: 'encryption', category: 'security', label: 'Encryption', svgContent: ENCRYPTION_SVG, defaultSize: ICON_SIZE }],
  ['certificate', { id: 'certificate', category: 'security', label: 'Certificate', svgContent: CERTIFICATE_SVG, defaultSize: ICON_SIZE }],
  ['token', { id: 'token', category: 'security', label: 'Token', svgContent: TOKEN_SVG, defaultSize: ICON_SIZE }],
  ['fingerprint', { id: 'fingerprint', category: 'security', label: 'Fingerprint', svgContent: FINGERPRINT_SVG, defaultSize: ICON_SIZE }],
  ['alert', { id: 'alert', category: 'security', label: 'Alert', svgContent: ALERT_SVG, defaultSize: ICON_SIZE }],
  ['bug', { id: 'bug', category: 'security', label: 'Bug', svgContent: BUG_SVG, defaultSize: ICON_SIZE }],
  ['patch', { id: 'patch', category: 'security', label: 'Patch', svgContent: PATCH_SVG, defaultSize: ICON_SIZE }],
  ['audit-log', { id: 'audit-log', category: 'security', label: 'Audit Log', svgContent: AUDIT_LOG_SVG, defaultSize: ICON_SIZE }],
  ['compliance', { id: 'compliance', category: 'security', label: 'Compliance', svgContent: COMPLIANCE_SVG, defaultSize: ICON_SIZE }],
  ['zero-trust', { id: 'zero-trust', category: 'security', label: 'Zero Trust', svgContent: ZERO_TRUST_SVG, defaultSize: ICON_SIZE }],

  // ── Architecture ──────────────────────────────────────────
  ['microservice', { id: 'microservice', category: 'architecture', label: 'Microservice', svgContent: MICROSERVICE_SVG, defaultSize: ICON_SIZE }],
  ['api-gateway', { id: 'api-gateway', category: 'architecture', label: 'API Gateway', svgContent: ARCH_API_GATEWAY_SVG, defaultSize: ICON_SIZE }],
  ['message-queue', { id: 'message-queue', category: 'architecture', label: 'Message Queue', svgContent: MESSAGE_QUEUE_SVG, defaultSize: ICON_SIZE }],
  ['arch-database', { id: 'arch-database', category: 'architecture', label: 'Database', svgContent: ARCH_DATABASE_SVG, defaultSize: ICON_SIZE }],
  ['cache', { id: 'cache', category: 'architecture', label: 'Cache', svgContent: CACHE_SVG, defaultSize: ICON_SIZE }],
  ['cdn', { id: 'cdn', category: 'architecture', label: 'CDN', svgContent: CDN_SVG, defaultSize: ICON_SIZE }],
  ['arch-load-balancer', { id: 'arch-load-balancer', category: 'architecture', label: 'Load Balancer', svgContent: ARCH_LB_SVG, defaultSize: ICON_SIZE }],
  ['container', { id: 'container', category: 'architecture', label: 'Container', svgContent: CONTAINER_SVG, defaultSize: ICON_SIZE }],
  ['serverless', { id: 'serverless', category: 'architecture', label: 'Serverless', svgContent: SERVERLESS_SVG, defaultSize: ICON_SIZE }],
  ['client-browser', { id: 'client-browser', category: 'architecture', label: 'Client/Browser', svgContent: CLIENT_BROWSER_SVG, defaultSize: ICON_SIZE }],
  ['mobile-app', { id: 'mobile-app', category: 'architecture', label: 'Mobile App', svgContent: MOBILE_APP_SVG, defaultSize: ICON_SIZE }],
  ['desktop', { id: 'desktop', category: 'architecture', label: 'Desktop', svgContent: DESKTOP_SVG, defaultSize: ICON_SIZE }],
  ['cloud', { id: 'cloud', category: 'architecture', label: 'Cloud', svgContent: CLOUD_SVG, defaultSize: ICON_SIZE }],
  ['on-premise', { id: 'on-premise', category: 'architecture', label: 'On-Premise Server', svgContent: ON_PREMISE_SVG, defaultSize: ICON_SIZE }],
  ['hybrid-cloud', { id: 'hybrid-cloud', category: 'architecture', label: 'Hybrid Cloud', svgContent: HYBRID_CLOUD_SVG, defaultSize: ICON_SIZE }],

  // ── Kubernetes ───────────────────────────────────────────
  ['k8s-pod', { id: 'k8s-pod', category: 'kubernetes', label: 'Pod', svgContent: K8S_POD_SVG, defaultSize: ICON_SIZE }],
  ['k8s-deployment', { id: 'k8s-deployment', category: 'kubernetes', label: 'Deployment', svgContent: K8S_DEPLOYMENT_SVG, defaultSize: ICON_SIZE }],
  ['k8s-replicaset', { id: 'k8s-replicaset', category: 'kubernetes', label: 'ReplicaSet', svgContent: K8S_REPLICASET_SVG, defaultSize: ICON_SIZE }],
  ['k8s-statefulset', { id: 'k8s-statefulset', category: 'kubernetes', label: 'StatefulSet', svgContent: K8S_STATEFULSET_SVG, defaultSize: ICON_SIZE }],
  ['k8s-daemonset', { id: 'k8s-daemonset', category: 'kubernetes', label: 'DaemonSet', svgContent: K8S_DAEMONSET_SVG, defaultSize: ICON_SIZE }],
  ['k8s-job', { id: 'k8s-job', category: 'kubernetes', label: 'Job', svgContent: K8S_JOB_SVG, defaultSize: ICON_SIZE }],
  ['k8s-cronjob', { id: 'k8s-cronjob', category: 'kubernetes', label: 'CronJob', svgContent: K8S_CRONJOB_SVG, defaultSize: ICON_SIZE }],
  ['k8s-service', { id: 'k8s-service', category: 'kubernetes', label: 'Service', svgContent: K8S_SERVICE_SVG, defaultSize: ICON_SIZE }],
  ['k8s-ingress', { id: 'k8s-ingress', category: 'kubernetes', label: 'Ingress', svgContent: K8S_INGRESS_SVG, defaultSize: ICON_SIZE }],
  ['k8s-configmap', { id: 'k8s-configmap', category: 'kubernetes', label: 'ConfigMap', svgContent: K8S_CONFIGMAP_SVG, defaultSize: ICON_SIZE }],
  ['k8s-secret', { id: 'k8s-secret', category: 'kubernetes', label: 'Secret', svgContent: K8S_SECRET_SVG, defaultSize: ICON_SIZE }],
  ['k8s-persistent-volume', { id: 'k8s-persistent-volume', category: 'kubernetes', label: 'PersistentVolume', svgContent: K8S_PERSISTENT_VOLUME_SVG, defaultSize: ICON_SIZE }],
  ['k8s-namespace', { id: 'k8s-namespace', category: 'kubernetes', label: 'Namespace', svgContent: K8S_NAMESPACE_SVG, defaultSize: { width: 200, height: 150 } }],
  ['k8s-node', { id: 'k8s-node', category: 'kubernetes', label: 'Node', svgContent: K8S_NODE_SVG, defaultSize: ICON_SIZE }],
  ['k8s-cluster', { id: 'k8s-cluster', category: 'kubernetes', label: 'Cluster', svgContent: K8S_CLUSTER_SVG, defaultSize: { width: 250, height: 200 } }],

  // ── Azure ARM (Sub-ticket C) ────────────────────────────
  [
    {
      label: 'Resource Group',
