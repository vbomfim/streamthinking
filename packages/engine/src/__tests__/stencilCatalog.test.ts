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
  it('returns the server stencil entry', async () => {
    const entry = await getStencil('server');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('server');
    expect(entry!.category).toBe('network');
    expect(entry!.label).toBe('Server');
    expect(entry!.svgContent).toContain('<svg');
    expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
  });

  it('returns the load-balancer stencil entry', async () => {
    const entry = await getStencil('load-balancer');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('load-balancer');
    expect(entry!.category).toBe('network');
    expect(entry!.label).toBe('Load Balancer');
    expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
  });

  it('returns the firewall stencil entry', async () => {
    const entry = await getStencil('firewall');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('firewall');
    expect(entry!.category).toBe('network');
    expect(entry!.label).toBe('Firewall');
    expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
  });

  it('returns the router stencil entry', async () => {
    const entry = await getStencil('router');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('router');
    expect(entry!.category).toBe('network');
    expect(entry!.label).toBe('Router');
    expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
  });

  it('returns the switch stencil entry', async () => {
    const entry = await getStencil('switch');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('switch');
    expect(entry!.category).toBe('network');
    expect(entry!.label).toBe('Switch');
    expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
  });
});

// ── getStencil — Generic IT category ──────────────────────

describe('getStencil — generic-it stencils', () => {
  it('returns the database stencil entry', async () => {
    const entry = await getStencil('database');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('database');
    expect(entry!.category).toBe('generic-it');
    expect(entry!.label).toBe('Database');
    expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
  });

  it('returns the queue stencil entry', async () => {
    const entry = await getStencil('queue');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('queue');
    expect(entry!.category).toBe('generic-it');
    expect(entry!.label).toBe('Queue');
    expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
  });

  it('returns the cache stencil entry', async () => {
    const entry = await getStencil('cache');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('cache');
    expect(entry!.category).toBe('generic-it');
    expect(entry!.label).toBe('Cache');
    expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
  });

  it('returns the api stencil entry', async () => {
    const entry = await getStencil('api');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('api');
    expect(entry!.category).toBe('generic-it');
    expect(entry!.label).toBe('API');
    expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
  });

  it('returns the user stencil entry', async () => {
    const entry = await getStencil('user');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('user');
    expect(entry!.category).toBe('generic-it');
    expect(entry!.label).toBe('User');
    expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
  });

  it('returns the browser stencil entry', async () => {
    const entry = await getStencil('browser');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('browser');
    expect(entry!.category).toBe('generic-it');
    expect(entry!.label).toBe('Browser');
    expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
  });
});

// ── getStencil — Architecture category ────────────────────

describe('getStencil — architecture stencils', () => {
  it('returns the boundary-zone stencil entry with container size', async () => {
    const entry = await getStencil('boundary-zone');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('boundary-zone');
    expect(entry!.category).toBe('architecture');
    expect(entry!.label).toBe('Boundary Zone');
    expect(entry!.defaultSize).toEqual({ width: 200, height: 150 });
  });

  it('returns the microservice stencil entry', async () => {
    const entry = await getStencil('microservice');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('microservice');
    expect(entry!.category).toBe('architecture');
    expect(entry!.label).toBe('Microservice');
    expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
  });

  it('returns the container stencil entry', async () => {
    const entry = await getStencil('container');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('container');
    expect(entry!.category).toBe('architecture');
    expect(entry!.label).toBe('Container');
    expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
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

// ── getStencil — Kubernetes placeholder ───────────────────

describe('getStencil — kubernetes placeholder', () => {
  it('returns the k8s-pod stencil entry', async () => {
    const entry = await getStencil('k8s-pod');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('k8s-pod');
    expect(entry!.category).toBe('kubernetes');
  });

  it('returns undefined for an unknown stencil ID', async () => {
    expect(await getStencil('nonexistent')).toBeUndefined();
  });

  it('returns undefined for an empty string ID', async () => {
    expect(await getStencil('')).toBeUndefined();
  });
});

// ── getStencilsByCategory ─────────────────────────────────

describe('getStencilsByCategory', () => {
  it('returns 5 stencils in the network category', () => {
    const entries = getStencilsByCategory('network');
    expect(entries).toHaveLength(5);
    const ids = entries.map((e) => e.id).sort();
    expect(ids).toEqual(['firewall', 'load-balancer', 'router', 'server', 'switch']);
  });

  it('returns 7 stencils in the generic-it category', () => {
    const entries = getStencilsByCategory('generic-it');
    expect(entries).toHaveLength(7);
    const ids = entries.map((e) => e.id).sort();
    expect(ids).toEqual(['api', 'browser', 'cache', 'database', 'prometheus', 'queue', 'user']);
  });

  it('returns 3 stencils in the architecture category', () => {
    const entries = getStencilsByCategory('architecture');
    expect(entries).toHaveLength(3);
    const ids = entries.map((e) => e.id).sort();
    expect(ids).toEqual(['boundary-zone', 'container', 'microservice']);
  });

  it('returns 1 stencil in the kubernetes category', () => {
    const entries = getStencilsByCategory('kubernetes');
    expect(entries).toHaveLength(10);
    expect(entries.some((e) => e.id === 'k8s-pod')).toBe(true);
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
  it('returns all unique categories including azure-pro', () => {
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
    // Old categories removed
    expect(categories).not.toContain('azure');
    expect(categories).not.toContain('azure-arm');
  });

  it('returns the correct number of categories', () => {
    expect(getAllCategories()).toHaveLength(10);
  });
});

// ── STENCIL_CATALOG integrity ─────────────────────────────

describe('STENCIL_CATALOG', () => {
  it('contains all stencil entries', () => {
    expect(STENCIL_CATALOG.size).toBeGreaterThanOrEqual(140);
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

  it('boundary-zone has the container viewBox 200×150', async () => {
    const entry = await getStencil('boundary-zone');
    expect(entry).toBeDefined();
    expect(entry!.svgContent).toContain('viewBox="0 0 200 150"');
  });

  it('regular icons have 64×64 viewBox', async () => {
    const regularIds = [
      'server', 'load-balancer', 'firewall', 'router', 'switch',
      'database', 'queue', 'cache', 'api', 'user', 'browser',
      'microservice', 'container', 'k8s-pod',
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
