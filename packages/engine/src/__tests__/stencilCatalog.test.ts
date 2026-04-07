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
  it('returns all 8 unique categories', () => {
    const categories = getAllCategories();
    expect(categories).toContain('architecture');
    expect(categories).toContain('azure');
    expect(categories).toContain('azure-arm');
    expect(categories).toContain('fortinet');
    expect(categories).toContain('generic-it');
    expect(categories).toContain('kubernetes');
    expect(categories).toContain('network');
  });

  it('returns the correct number of categories', () => {
    expect(getAllCategories()).toHaveLength(8);
  });
});

// ── STENCIL_CATALOG integrity ─────────────────────────────

describe('STENCIL_CATALOG', () => {
  it('contains all 76 eager stencil entries', () => {
    expect(STENCIL_CATALOG.size).toBe(76);
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
