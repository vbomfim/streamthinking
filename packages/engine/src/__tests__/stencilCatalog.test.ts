/**
 * Unit tests for the stencil catalog.
 *
 * Covers: lookup by ID (async), unknown ID handling, category filtering,
 * getAllCategories listing, SVG to data URI conversion, and
 * STENCIL_CATALOG integrity.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import {
  STENCIL_CATALOG,
  getStencil,
  getStencilsByCategory,
  getAllCategories,
  svgToDataUri,
} from '../renderer/stencils/index.js';

// ── getStencil — Network category ─────────────────────────

describe('getStencil — network stencils', () => {
  const networkStencils: Array<{ id: string; label: string }> = [
    { id: 'router', label: 'Router' },
    { id: 'switch', label: 'Switch' },
    { id: 'hub', label: 'Hub' },
    { id: 'bridge', label: 'Bridge' },
    { id: 'gateway', label: 'Gateway' },
    { id: 'firewall', label: 'Firewall' },
    { id: 'load-balancer', label: 'Load Balancer' },
    { id: 'proxy', label: 'Proxy' },
    { id: 'wireless-ap', label: 'Wireless AP' },
    { id: 'antenna', label: 'Antenna' },
    { id: 'satellite', label: 'Satellite' },
    { id: 'modem', label: 'Modem' },
    { id: 'patch-panel', label: 'Patch Panel' },
    { id: 'rack', label: 'Rack' },
    { id: 'internet-cloud', label: 'Internet Cloud' },
    { id: 'server', label: 'Server' },
  ];

  for (const { id, label } of networkStencils) {
    it(`returns the ${id} stencil entry`, async () => {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.id).toBe(id);
      expect(entry!.category).toBe('network');
      expect(entry!.label).toBe(label);
      expect(entry!.svgContent).toContain('<svg');
      expect(entry!.svgContent).toContain('</svg>');
      expect(entry!.svgContent).toContain('currentColor');
      expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
    });
  }

  it('all network SVGs use viewBox="0 0 64 64"', async () => {
    for (const { id } of networkStencils) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.svgContent).toContain('viewBox="0 0 64 64"');
    }
  });

  it('all network SVGs contain xmlns attribute', async () => {
    for (const { id } of networkStencils) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.svgContent).toContain('xmlns="http://www.w3.org/2000/svg"');
    }
  });
});

// ── getStencil — Generic IT category ──────────────────────

describe('getStencil — generic-it stencils', () => {
  const genericItStencils: Array<{ id: string; label: string }> = [
    { id: 'desktop-computer', label: 'Desktop Computer' },
    { id: 'laptop', label: 'Laptop' },
    { id: 'tablet', label: 'Tablet' },
    { id: 'smartphone', label: 'Smartphone' },
    { id: 'generic-server', label: 'Server' },
    { id: 'database', label: 'Database' },
    { id: 'storage-array', label: 'Storage Array' },
    { id: 'printer', label: 'Printer' },
    { id: 'scanner', label: 'Scanner' },
    { id: 'monitor', label: 'Monitor' },
    { id: 'usb-drive', label: 'USB Drive' },
    { id: 'hard-drive', label: 'Hard Drive' },
    { id: 'ssd', label: 'SSD' },
    { id: 'headset', label: 'Headset' },
    { id: 'webcam', label: 'Webcam' },
  ];

  for (const { id, label } of genericItStencils) {
    it(`returns the ${id} stencil entry`, async () => {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.id).toBe(id);
      expect(entry!.category).toBe('generic-it');
      expect(entry!.label).toBe(label);
      expect(entry!.svgContent).toContain('<svg');
      expect(entry!.svgContent).toContain('</svg>');
      expect(entry!.svgContent).toContain('currentColor');
      expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
    });
  }

  it('all generic-it SVGs use viewBox="0 0 64 64"', async () => {
    for (const { id } of genericItStencils) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.svgContent).toContain('viewBox="0 0 64 64"');
    }
  });
});

// ── getStencil — Architecture category ────────────────────

describe('getStencil — architecture stencils', () => {
  const architectureStencils: Array<{ id: string; label: string }> = [
    { id: 'microservice', label: 'Microservice' },
    { id: 'api-gateway', label: 'API Gateway' },
    { id: 'message-queue', label: 'Message Queue' },
    { id: 'arch-database', label: 'Database' },
    { id: 'cache', label: 'Cache' },
    { id: 'cdn', label: 'CDN' },
    { id: 'arch-load-balancer', label: 'Load Balancer' },
    { id: 'container', label: 'Container' },
    { id: 'serverless', label: 'Serverless' },
    { id: 'client-browser', label: 'Client/Browser' },
    { id: 'mobile-app', label: 'Mobile App' },
    { id: 'desktop', label: 'Desktop' },
    { id: 'cloud', label: 'Cloud' },
    { id: 'on-premise', label: 'On-Premise Server' },
    { id: 'hybrid-cloud', label: 'Hybrid Cloud' },
  ];

  for (const { id, label } of architectureStencils) {
    it(`returns the ${id} stencil entry`, async () => {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.id).toBe(id);
      expect(entry!.category).toBe('architecture');
      expect(entry!.label).toBe(label);
      expect(entry!.svgContent).toContain('<svg');
      expect(entry!.svgContent).toContain('</svg>');
      expect(entry!.svgContent).toContain('currentColor');
      expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
    });
  }

  it('all architecture SVGs use viewBox="0 0 64 64"', async () => {
    for (const { id } of architectureStencils) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.svgContent).toContain('viewBox="0 0 64 64"');
    }
  });
});

// ── getStencil — Kubernetes category ──────────────────────

describe('getStencil — kubernetes stencils', () => {
  const k8sStencils: Array<{ id: string; label: string }> = [
    { id: 'k8s-pod', label: 'Pod' },
    { id: 'k8s-deployment', label: 'Deployment' },
    { id: 'k8s-replicaset', label: 'ReplicaSet' },
    { id: 'k8s-statefulset', label: 'StatefulSet' },
    { id: 'k8s-daemonset', label: 'DaemonSet' },
    { id: 'k8s-job', label: 'Job' },
    { id: 'k8s-cronjob', label: 'CronJob' },
    { id: 'k8s-service', label: 'Service' },
    { id: 'k8s-ingress', label: 'Ingress' },
    { id: 'k8s-configmap', label: 'ConfigMap' },
    { id: 'k8s-secret', label: 'Secret' },
    { id: 'k8s-persistent-volume', label: 'PersistentVolume' },
    { id: 'k8s-namespace', label: 'Namespace' },
    { id: 'k8s-node', label: 'Node' },
    { id: 'k8s-cluster', label: 'Cluster' },
  ];

  for (const { id, label } of k8sStencils) {
    it(`returns the ${id} stencil entry`, async () => {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.id).toBe(id);
      expect(entry!.category).toBe('kubernetes');
      expect(entry!.label).toBe(label);
      expect(entry!.svgContent).toContain('<svg');
      expect(entry!.svgContent).toContain('</svg>');
      expect(entry!.svgContent).toContain('currentColor');
    });
  }

  it('k8s-namespace has container size', async () => {
    const entry = await getStencil('k8s-namespace');
    expect(entry).toBeDefined();
    expect(entry!.defaultSize).toEqual({ width: 200, height: 150 });
    expect(entry!.svgContent).toContain('viewBox="0 0 200 150"');
  });

  it('k8s-cluster has large container size', async () => {
    const entry = await getStencil('k8s-cluster');
    expect(entry).toBeDefined();
    expect(entry!.defaultSize).toEqual({ width: 250, height: 200 });
    expect(entry!.svgContent).toContain('viewBox="0 0 250 200"');
  });

  it('standard k8s icons use 44×44 default size', async () => {
    const standardIds = k8sStencils
      .filter(s => s.id !== 'k8s-namespace' && s.id !== 'k8s-cluster')
      .map(s => s.id);
    for (const id of standardIds) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
    }
  });
});

// ── getStencil — Security category ────────────────────────

describe('getStencil — security stencils', () => {
  const securityStencils: Array<{ id: string; label: string }> = [
    { id: 'shield', label: 'Shield' },
    { id: 'lock', label: 'Lock' },
    { id: 'key', label: 'Key' },
    { id: 'padlock', label: 'Padlock' },
    { id: 'sec-firewall', label: 'Firewall' },
    { id: 'vpn', label: 'VPN' },
    { id: 'encryption', label: 'Encryption' },
    { id: 'certificate', label: 'Certificate' },
    { id: 'token', label: 'Token' },
    { id: 'fingerprint', label: 'Fingerprint' },
    { id: 'alert', label: 'Alert' },
    { id: 'bug', label: 'Bug' },
    { id: 'patch', label: 'Patch' },
    { id: 'audit-log', label: 'Audit Log' },
    { id: 'compliance', label: 'Compliance' },
    { id: 'zero-trust', label: 'Zero Trust' },
  ];

  for (const { id, label } of securityStencils) {
    it(`returns the ${id} stencil entry`, async () => {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.id).toBe(id);
      expect(entry!.category).toBe('security');
      expect(entry!.label).toBe(label);
      expect(entry!.svgContent).toContain('<svg');
      expect(entry!.svgContent).toContain('</svg>');
      expect(entry!.svgContent).toContain('currentColor');
      expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
    });
  }

  it('all security SVGs use viewBox="0 0 64 64"', async () => {
    for (const { id } of securityStencils) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.svgContent).toContain('viewBox="0 0 64 64"');
    }
  });

  it('all security SVGs contain xmlns attribute', async () => {
    for (const { id } of securityStencils) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.svgContent).toContain('xmlns="http://www.w3.org/2000/svg"');
    }
  });
});

// ── getStencil — Fortinet category ────────────────────────

describe('getStencil — fortinet stencils', () => {
  const fortinetStencils: Array<{ id: string; label: string }> = [
    { id: 'forti-gate', label: 'FortiGate' },
    { id: 'forti-switch', label: 'FortiSwitch' },
    { id: 'forti-ap', label: 'FortiAP' },
    { id: 'forti-manager', label: 'FortiManager' },
    { id: 'forti-analyzer', label: 'FortiAnalyzer' },
    { id: 'forti-web', label: 'FortiWeb' },
    { id: 'forti-mail', label: 'FortiMail' },
    { id: 'forti-client', label: 'FortiClient' },
    { id: 'forti-sandbox', label: 'FortiSandbox' },
    { id: 'forti-siem', label: 'FortiSIEM' },
    { id: 'forti-nac', label: 'FortiNAC' },
    { id: 'forti-edr', label: 'FortiEDR' },
    { id: 'forti-proxy', label: 'FortiProxy' },
    { id: 'forti-ddos', label: 'FortiDDoS' },
    { id: 'forti-adc', label: 'FortiADC' },
    { id: 'forti-authenticator', label: 'FortiAuthenticator' },
    { id: 'forti-token', label: 'FortiToken' },
    { id: 'forti-extender', label: 'FortiExtender' },
    { id: 'forti-deceptor', label: 'FortiDeceptor' },
    { id: 'forti-soar', label: 'FortiSOAR' },
  ];

  for (const { id, label } of fortinetStencils) {
    it(`returns the ${id} stencil entry`, async () => {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.id).toBe(id);
      expect(entry!.category).toBe('fortinet');
      expect(entry!.label).toBe(label);
      expect(entry!.svgContent).toContain('<svg');
      expect(entry!.svgContent).toContain('</svg>');
      expect(entry!.svgContent).toContain('currentColor');
      expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
    });
  }

  it('all fortinet SVGs use viewBox="0 0 64 64"', async () => {
    for (const { id } of fortinetStencils) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.svgContent).toContain('viewBox="0 0 64 64"');
    }
  });

  it('all fortinet SVGs contain xmlns attribute', async () => {
    for (const { id } of fortinetStencils) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.svgContent).toContain('xmlns="http://www.w3.org/2000/svg"');
    }
  });
});

// ── getStencil — Cisco Pro category ───────────────────────

describe('getStencil — cisco-pro stencils', () => {
  const ciscoProStencils: Array<{ id: string; label: string }> = [
    // Networking
    { id: 'cisco-pro-router', label: 'Router' },
    { id: 'cisco-pro-switch', label: 'Switch' },
    { id: 'cisco-pro-l3-switch', label: 'L3 Switch' },
    { id: 'cisco-pro-firewall', label: 'Firewall' },
    { id: 'cisco-pro-wireless-ap', label: 'Wireless AP' },
    { id: 'cisco-pro-wlc', label: 'Wireless Controller' },
    // Security
    { id: 'cisco-pro-asa', label: 'ASA' },
    { id: 'cisco-pro-ise', label: 'ISE' },
    { id: 'cisco-pro-umbrella', label: 'Umbrella' },
    { id: 'cisco-pro-amp', label: 'AMP' },
    { id: 'cisco-pro-stealthwatch', label: 'Stealthwatch' },
    // Collaboration
    { id: 'cisco-pro-ip-phone', label: 'IP Phone' },
    { id: 'cisco-pro-video-endpoint', label: 'Video Endpoint' },
    { id: 'cisco-pro-webex', label: 'Webex' },
    { id: 'cisco-pro-call-manager', label: 'Call Manager' },
    // Data Center
    { id: 'cisco-pro-ucs', label: 'UCS Server' },
    { id: 'cisco-pro-nexus', label: 'Nexus Switch' },
    { id: 'cisco-pro-aci', label: 'ACI Fabric' },
    { id: 'cisco-pro-hyperflex', label: 'HyperFlex' },
    // Cloud & SD-WAN
    { id: 'cisco-pro-meraki', label: 'Meraki' },
    { id: 'cisco-pro-sd-wan', label: 'SD-WAN' },
    { id: 'cisco-pro-viptela', label: 'Viptela' },
    { id: 'cisco-pro-cloud', label: 'Cloud' },
    { id: 'cisco-pro-internet', label: 'Internet' },
    // Infrastructure
    { id: 'cisco-pro-stack', label: 'Stack' },
    { id: 'cisco-pro-server', label: 'Server' },
    { id: 'cisco-pro-workstation', label: 'Workstation' },
    { id: 'cisco-pro-laptop', label: 'Laptop' },
    { id: 'cisco-pro-printer', label: 'Printer' },
    { id: 'cisco-pro-camera', label: 'IP Camera' },
  ];

  for (const { id, label } of ciscoProStencils) {
    it(`returns the ${id} stencil entry`, async () => {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.id).toBe(id);
      expect(entry!.category).toBe('cisco-pro');
      expect(entry!.label).toBe(label);
      expect(entry!.svgContent).toContain('<svg');
      expect(entry!.svgContent).toContain('</svg>');
      expect(entry!.svgContent).toContain('currentColor');
      expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
    });
  }

  it('all cisco-pro SVGs use viewBox="0 0 64 64"', async () => {
    for (const { id } of ciscoProStencils) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.svgContent).toContain('viewBox="0 0 64 64"');
    }
  });

  it('all cisco-pro SVGs contain xmlns attribute', async () => {
    for (const { id } of ciscoProStencils) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.svgContent).toContain('xmlns="http://www.w3.org/2000/svg"');
    }
  });

  it('returns 30 stencils in the cisco-pro category', () => {
    const entries = getStencilsByCategory('cisco-pro');
    expect(entries).toHaveLength(30);
    const ids = entries.map((e) => e.id).sort();
    expect(ids).toEqual([
      'cisco-pro-aci',
      'cisco-pro-amp',
      'cisco-pro-asa',
      'cisco-pro-call-manager',
      'cisco-pro-camera',
      'cisco-pro-cloud',
      'cisco-pro-firewall',
      'cisco-pro-hyperflex',
      'cisco-pro-internet',
      'cisco-pro-ip-phone',
      'cisco-pro-ise',
      'cisco-pro-l3-switch',
      'cisco-pro-laptop',
      'cisco-pro-meraki',
      'cisco-pro-nexus',
      'cisco-pro-printer',
      'cisco-pro-router',
      'cisco-pro-sd-wan',
      'cisco-pro-server',
      'cisco-pro-stack',
      'cisco-pro-stealthwatch',
      'cisco-pro-switch',
      'cisco-pro-ucs',
      'cisco-pro-umbrella',
      'cisco-pro-video-endpoint',
      'cisco-pro-viptela',
      'cisco-pro-webex',
      'cisco-pro-wireless-ap',
      'cisco-pro-wlc',
      'cisco-pro-workstation',
    ]);
  });
});

// ── getStencil — GCP Pro category ─────────────────────────

describe('getStencil — gcp-pro stencils', () => {
  const gcpProStencils: Array<{ id: string; label: string }> = [
    // Compute
    { id: 'gcp-pro-compute-engine', label: 'Compute Engine' },
    { id: 'gcp-pro-app-engine', label: 'App Engine' },
    { id: 'gcp-pro-cloud-functions', label: 'Cloud Functions' },
    { id: 'gcp-pro-gke', label: 'GKE' },
    { id: 'gcp-pro-cloud-run', label: 'Cloud Run' },
    // Storage
    { id: 'gcp-pro-cloud-storage', label: 'Cloud Storage' },
    { id: 'gcp-pro-persistent-disk', label: 'Persistent Disk' },
    { id: 'gcp-pro-filestore', label: 'Filestore' },
    // Database
    { id: 'gcp-pro-cloud-sql', label: 'Cloud SQL' },
    { id: 'gcp-pro-firestore', label: 'Firestore' },
    { id: 'gcp-pro-bigtable', label: 'Bigtable' },
    { id: 'gcp-pro-spanner', label: 'Spanner' },
    { id: 'gcp-pro-bigquery', label: 'BigQuery' },
    // Networking
    { id: 'gcp-pro-vpc', label: 'VPC' },
    { id: 'gcp-pro-cloud-cdn', label: 'Cloud CDN' },
    { id: 'gcp-pro-cloud-dns', label: 'Cloud DNS' },
    { id: 'gcp-pro-cloud-load-balancing', label: 'Cloud Load Balancing' },
    { id: 'gcp-pro-cloud-armor', label: 'Cloud Armor' },
    // AI/ML
    { id: 'gcp-pro-vertex-ai', label: 'Vertex AI' },
    { id: 'gcp-pro-cloud-vision', label: 'Cloud Vision' },
    { id: 'gcp-pro-cloud-speech', label: 'Cloud Speech' },
    // Management
    { id: 'gcp-pro-cloud-monitoring', label: 'Cloud Monitoring' },
    { id: 'gcp-pro-cloud-logging', label: 'Cloud Logging' },
    { id: 'gcp-pro-cloud-build', label: 'Cloud Build' },
    { id: 'gcp-pro-pub-sub', label: 'Pub/Sub' },
  ];

  for (const { id, label } of gcpProStencils) {
    it(`returns the ${id} stencil entry`, async () => {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.id).toBe(id);
      expect(entry!.category).toBe('gcp-pro');
      expect(entry!.label).toBe(label);
      expect(entry!.svgContent).toContain('<svg');
      expect(entry!.svgContent).toContain('</svg>');
      expect(entry!.svgContent).toContain('currentColor');
      expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
    });
  }

  it('all gcp-pro SVGs use viewBox="0 0 64 64"', async () => {
    for (const { id } of gcpProStencils) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.svgContent).toContain('viewBox="0 0 64 64"');
    }
  });

  it('all gcp-pro SVGs contain xmlns attribute', async () => {
    for (const { id } of gcpProStencils) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.svgContent).toContain('xmlns="http://www.w3.org/2000/svg"');
    }
  });

  it('returns 25 stencils in the gcp-pro category', () => {
    const entries = getStencilsByCategory('gcp-pro');
    expect(entries).toHaveLength(25);
    const ids = entries.map((e) => e.id).sort();
    expect(ids).toEqual([
      'gcp-pro-app-engine',
      'gcp-pro-bigquery',
      'gcp-pro-bigtable',
      'gcp-pro-cloud-armor',
      'gcp-pro-cloud-build',
      'gcp-pro-cloud-cdn',
      'gcp-pro-cloud-dns',
      'gcp-pro-cloud-functions',
      'gcp-pro-cloud-load-balancing',
      'gcp-pro-cloud-logging',
      'gcp-pro-cloud-monitoring',
      'gcp-pro-cloud-run',
      'gcp-pro-cloud-speech',
      'gcp-pro-cloud-sql',
      'gcp-pro-cloud-storage',
      'gcp-pro-cloud-vision',
      'gcp-pro-compute-engine',
      'gcp-pro-filestore',
      'gcp-pro-firestore',
      'gcp-pro-gke',
      'gcp-pro-persistent-disk',
      'gcp-pro-pub-sub',
      'gcp-pro-spanner',
      'gcp-pro-vertex-ai',
      'gcp-pro-vpc',
    ]);
  });
});

// ── getStencil — edge cases ───────────────────────────────

describe('getStencil — edge cases', () => {
  it('returns undefined for an unknown stencil ID', async () => {
    expect(await getStencil('nonexistent')).toBeUndefined();
  });

  it('returns undefined for an empty string ID', async () => {
    expect(await getStencil('')).toBeUndefined();
  });
});

// ── getStencilsByCategory ─────────────────────────────────

describe('getStencilsByCategory', () => {
  it('returns 16 stencils in the network category', () => {
    const entries = getStencilsByCategory('network');
    expect(entries).toHaveLength(16);
    const ids = entries.map((e) => e.id).sort();
    expect(ids).toContain('router');
    expect(ids).toContain('switch');
    expect(ids).toContain('firewall');
    expect(ids).toContain('server');
  });

  it('returns 15 stencils in the generic-it category (plus prometheus)', () => {
    const entries = getStencilsByCategory('generic-it');
    expect(entries).toHaveLength(16);
    const ids = entries.map((e) => e.id).sort();
    expect(ids).toContain('database');
    expect(ids).toContain('laptop');
    expect(ids).toContain('printer');
    expect(ids).toContain('prometheus');
  });

  it('returns 15 stencils in the architecture category', () => {
    const entries = getStencilsByCategory('architecture');
    expect(entries).toHaveLength(15);
    const ids = entries.map((e) => e.id).sort();
    expect(ids).toContain('microservice');
    expect(ids).toContain('container');
    expect(ids).toContain('cloud');
  });

  it('returns 15 stencils in the kubernetes category', () => {
    const entries = getStencilsByCategory('kubernetes');
    expect(entries).toHaveLength(15);
    expect(entries.some((e) => e.id === 'k8s-pod')).toBe(true);
  });

  it('returns 16 stencils in the security category', () => {
    const entries = getStencilsByCategory('security');
    expect(entries).toHaveLength(16);
    const ids = entries.map((e) => e.id).sort();
    expect(ids).toContain('shield');
    expect(ids).toContain('lock');
    expect(ids).toContain('zero-trust');
  });

  it('returns 20 stencils in the fortinet category', () => {
    const entries = getStencilsByCategory('fortinet');
    expect(entries).toHaveLength(20);
    const ids = entries.map((e) => e.id).sort();
    expect(ids).toEqual([
      'forti-adc',
      'forti-analyzer',
      'forti-ap',
      'forti-authenticator',
      'forti-client',
      'forti-ddos',
      'forti-deceptor',
      'forti-edr',
      'forti-extender',
      'forti-gate',
      'forti-mail',
      'forti-manager',
      'forti-nac',
      'forti-proxy',
      'forti-sandbox',
      'forti-siem',
      'forti-soar',
      'forti-switch',
      'forti-token',
      'forti-web',
    ]);
  });

  it('returns empty array for unknown category', () => {
    expect(getStencilsByCategory('nonexistent')).toEqual([]);
  });

  it('returns empty array for empty string category', () => {
    expect(getStencilsByCategory('')).toEqual([]);
  });
});

// ── getAllCategories ───────────────────────────────────────

describe('getAllCategories', () => {
<<<<<<< HEAD
  it('returns all expected categories', () => {
=======
  it('returns all unique categories including azure-pro', () => {
>>>>>>> origin/main
    const categories = getAllCategories();
    expect(categories).toContain('architecture');
    expect(categories).toContain('aws-pro');
    expect(categories).toContain('azure-pro');
    expect(categories).toContain('cisco-pro');
    expect(categories).toContain('fortinet');
    expect(categories).toContain('gcp-pro');
    expect(categories).toContain('generic-it');
    expect(categories).toContain('kubernetes');
    expect(categories).toContain('network');
<<<<<<< HEAD
    expect(categories).toContain('security');
  });

  it('returns the correct number of categories', () => {
    expect(getAllCategories()).toHaveLength(11);
=======
    // Old categories removed
    expect(categories).not.toContain('azure');
    expect(categories).not.toContain('azure-arm');
  });

  it('returns the correct number of categories', () => {
    expect(getAllCategories()).toHaveLength(10);
>>>>>>> origin/main
  });
});

// ── STENCIL_CATALOG integrity ─────────────────────────────

describe('STENCIL_CATALOG', () => {
  it('contains all stencil entries', () => {
<<<<<<< HEAD
    expect(STENCIL_CATALOG.size).toBeGreaterThan(200);
=======
    expect(STENCIL_CATALOG.size).toBeGreaterThanOrEqual(140);
>>>>>>> origin/main
  });

  it('has map keys matching entry IDs', () => {
    for (const [key, entry] of STENCIL_CATALOG) {
      expect(key).toBe(entry.id);
    }
  });

  it('all entries have valid SVG content starting with <svg and ending with </svg>', () => {
    for (const entry of STENCIL_CATALOG.values()) {
      expect(entry.svgContent).toContain('<svg');
      expect(entry.svgContent).toContain('</svg>');
    }
  });

  it('all entries have positive default dimensions', () => {
    for (const entry of STENCIL_CATALOG.values()) {
      expect(entry.defaultSize.width).toBeGreaterThan(0);
      expect(entry.defaultSize.height).toBeGreaterThan(0);
    }
  });

  it('all SVGs contain xmlns attribute', () => {
    for (const entry of STENCIL_CATALOG.values()) {
      expect(entry.svgContent).toContain('xmlns="http://www.w3.org/2000/svg"');
    }
  });

  it('all SVGs contain viewBox attribute', () => {
    for (const entry of STENCIL_CATALOG.values()) {
      expect(entry.svgContent).toContain('viewBox=');
    }
  });

  it('regular icons have 64×64 viewBox', async () => {
    const regularIds = [
      'server', 'load-balancer', 'firewall', 'router', 'switch',
      'database', 'microservice', 'container', 'k8s-pod',
      'shield', 'lock', 'laptop', 'printer',
    ];
    for (const id of regularIds) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.svgContent).toContain('viewBox="0 0 64 64"');
    }
  });
});

// ── svgToDataUri ──────────────────────────────────────────

describe('svgToDataUri', () => {
  it('converts SVG content to a data URI', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const uri = svgToDataUri(svg);
    expect(uri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it('encodes special characters correctly', () => {
    const svg = '<svg><text>Hello & World</text></svg>';
    const uri = svgToDataUri(svg);
    expect(uri).toContain(encodeURIComponent('&'));
    expect(uri).not.toContain('&');
  });

  it('produces a URI that can be decoded back to original SVG', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="16"/></svg>';
    const uri = svgToDataUri(svg);
    const prefix = 'data:image/svg+xml;charset=utf-8,';
    const decoded = decodeURIComponent(uri.slice(prefix.length));
    expect(decoded).toBe(svg);
  });

  it('works with catalog stencil SVG content', async () => {
    const entry = await getStencil('server');
    expect(entry).toBeDefined();
    const uri = svgToDataUri(entry!.svgContent);
    expect(uri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(uri.length).toBeGreaterThan(50);
  });
});
