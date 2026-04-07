/**
 * QA Guardian — Integration, Edge Case, and Contract tests for stencil code generation.
 *
 * Complements the Developer Guardian's 32 unit tests with:
 * - Edge case / boundary tests for normalization edge inputs
 * - Contract validation for generated TypeScript output structure
 * - Integration tests verifying SVG ↔ catalog cross-module consistency
 * - Coverage gap tests for untested input classes
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import type { DrawioShape, DrawioStencilLibrary } from '@infinicanvas/protocol';
import {
  normalizeStencilId,
  normalizeExportName,
  generateSvgModule,
  generateCatalogRegistration,
} from '../renderer/stencils/drawio/generateStencilCode.js';

// ── Test helpers ─────────────────────────────────────────────

/** Create a minimal DrawioShape for testing. */
function makeShape(
  name: string,
  svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>',
  width = 100,
  height = 100,
): DrawioShape {
  return { name, width, height, aspect: 'variable', svg, connections: [] };
}

/** Create a DrawioStencilLibrary from shapes. */
function makeLibrary(name: string, shapes: DrawioShape[]): DrawioStencilLibrary {
  return { name, shapes };
}

// ══════════════════════════════════════════════════════════════
// [EDGE] normalizeStencilId — boundary inputs
// ══════════════════════════════════════════════════════════════

describe('[EDGE] normalizeStencilId — boundary inputs', () => {
  it('handles empty library and shape names', () => {
    const result = normalizeStencilId('', '');
    // Should produce 'drawio--' since both segments are empty after normalization
    expect(result).toBe('drawio--');
  });

  it('handles purely non-alphanumeric input → empty segment', () => {
    const result = normalizeStencilId('---', '!!!');
    expect(result).toBe('drawio--');
  });

  it('handles unicode/non-latin characters (stripped as non-alphanumeric)', () => {
    const result = normalizeStencilId('aws', 'レイヤー');
    // Non-ASCII chars are stripped by [^a-z0-9]+ regex, leaving empty
    expect(result).toBe('drawio-aws-');
  });

  it('handles emoji in shape names (stripped)', () => {
    const result = normalizeStencilId('test', '🚀 Rocket Launch');
    expect(result).toContain('drawio-test-');
    expect(result).toContain('rocket-launch');
  });

  it('handles numeric-only names', () => {
    expect(normalizeStencilId('123', '456')).toBe('drawio-123-456');
  });

  it('handles extremely long names without error', () => {
    const longName = 'a'.repeat(1000);
    const result = normalizeStencilId('lib', longName);
    expect(result).toContain('drawio-lib-');
    expect(result.length).toBeGreaterThan(10);
  });

  it('handles mixed case consistently (always lowercase)', () => {
    const a = normalizeStencilId('AWS', 'EC2');
    const b = normalizeStencilId('aws', 'ec2');
    const c = normalizeStencilId('Aws', 'Ec2');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('handles tab and newline characters as separators', () => {
    const result = normalizeStencilId('aws', 'Cloud\tFunction\nService');
    expect(result).toBe('drawio-aws-cloud-function-service');
  });

  it('handles single-character names', () => {
    expect(normalizeStencilId('a', 'b')).toBe('drawio-a-b');
  });
});

// ══════════════════════════════════════════════════════════════
// [EDGE] normalizeExportName — boundary inputs
// ══════════════════════════════════════════════════════════════

describe('[EDGE] normalizeExportName — boundary inputs', () => {
  it('handles empty library and shape names', () => {
    const result = normalizeExportName('', '');
    expect(result).toBe('DRAWIO___SVG');
  });

  it('handles unicode input (stripped)', () => {
    const result = normalizeExportName('aws', '日本語');
    // Non-ASCII stripped, leaves DRAWIO_AWS__SVG
    expect(result).toMatch(/^DRAWIO_AWS_.*_SVG$/);
  });

  it('handles numeric-only names', () => {
    expect(normalizeExportName('123', '456')).toBe('DRAWIO_123_456_SVG');
  });

  it('handles extremely long names', () => {
    const longName = 'VERY_LONG_'.repeat(100);
    const result = normalizeExportName('lib', longName);
    expect(result).toMatch(/^DRAWIO_LIB_.*_SVG$/);
    expect(result.length).toBeGreaterThan(20);
  });

  it('export name matches stencil ID semantically', () => {
    // Both should produce the same root tokens
    const id = normalizeStencilId('gcp', 'Cloud SQL');
    const exp = normalizeExportName('gcp', 'Cloud SQL');
    // 'drawio-gcp-cloud-sql' vs 'DRAWIO_GCP_CLOUD_SQL_SVG'
    expect(id).toBe('drawio-gcp-cloud-sql');
    expect(exp).toBe('DRAWIO_GCP_CLOUD_SQL_SVG');
  });
});

// ══════════════════════════════════════════════════════════════
// [EDGE] generateSvgModule — edge cases
// ══════════════════════════════════════════════════════════════

describe('[EDGE] generateSvgModule — edge cases', () => {
  it('escapes backslashes in SVG content', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text>path\\to\\file</text></svg>';
    const shapes = [makeShape('Test', svg)];
    const result = generateSvgModule('aws', shapes);

    // Backslashes should be doubled for template literal safety
    expect(result).toContain('\\\\');
  });

  it('handles SVG with mixed dangerous characters (backtick + ${} + backslash)', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text>`${exploit}` and \\path</text></svg>';
    const shapes = [makeShape('Mixed', svg)];
    const result = generateSvgModule('test', shapes);

    // All dangerous chars should be escaped
    expect(result).not.toMatch(/(?<!\\)`\$\{/); // no unescaped `${
    expect(result).toContain('\\`');
    expect(result).toContain('\\${');
    expect(result).toContain('\\\\');
  });

  it('handles triple+ collision deduplication correctly', () => {
    const shapes = [
      makeShape('Lambda', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect/></svg>'),
      makeShape('lambda', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle/></svg>'),
      makeShape('LAMBDA', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path/></svg>'),
      makeShape('Lambda!', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><line/></svg>'),
    ];
    const result = generateSvgModule('aws', shapes);

    // Should have 4 unique export names
    expect(result).toContain('DRAWIO_AWS_LAMBDA_SVG');
    expect(result).toContain('DRAWIO_AWS_LAMBDA_2_SVG');
    expect(result).toContain('DRAWIO_AWS_LAMBDA_3_SVG');
    expect(result).toContain('DRAWIO_AWS_LAMBDA_4_SVG');
  });

  it('generates valid export statements (each line ends with semicolon or is blank)', () => {
    const shapes = [
      makeShape('EC2'),
      makeShape('S3'),
    ];
    const result = generateSvgModule('aws', shapes);
    const lines = result.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      if (trimmed.startsWith('//')) continue; // comments
      // Export lines should contain 'export const' and end with `;`
      if (trimmed.startsWith('export const')) {
        expect(trimmed).toMatch(/;\s*$/);
      }
    }
  });

  it('handles single shape with very large SVG content', () => {
    const largeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${'<rect x="0" y="0" width="1" height="1"/>'.repeat(500)}</svg>`;
    const shapes = [makeShape('Large', largeSvg)];
    const result = generateSvgModule('test', shapes);

    expect(result).toContain('export const DRAWIO_TEST_LARGE_SVG');
    expect(result).toContain('</svg>');
  });
});

// ══════════════════════════════════════════════════════════════
// [EDGE] generateCatalogRegistration — edge cases
// ══════════════════════════════════════════════════════════════

describe('[EDGE] generateCatalogRegistration — edge cases', () => {
  it('escapes single quotes in shape labels', () => {
    const shapes = [makeShape("O'Reilly Server")];
    const library = makeLibrary('test', shapes);
    const result = generateCatalogRegistration([library]);

    // The label should have the quote escaped
    expect(result).toContain("O\\'Reilly Server");
    // Should NOT have an unescaped single quote breaking the string
    expect(result).not.toMatch(/label: 'O'Reilly/);
  });

  it('handles empty libraries array', () => {
    const result = generateCatalogRegistration([]);
    expect(result).toBe('');
  });

  it('handles library with many shapes without error', () => {
    const shapes = Array.from({ length: 100 }, (_, i) =>
      makeShape(`Shape${i}`)
    );
    const library = makeLibrary('big', shapes);
    const result = generateCatalogRegistration([library]);

    expect(result).toContain('STENCIL_CATALOG.set');
    // Should have 100 registration calls
    const setCallCount = (result.match(/STENCIL_CATALOG\.set\(/g) ?? []).length;
    expect(setCallCount).toBe(100);
  });

  it('uses defaultSize of 44×44 (not shape intrinsic dimensions)', () => {
    // The generated code should use DEFAULT_STENCIL_SIZE (44), not shape w/h
    const shapes = [makeShape('BigShape', undefined, 200, 300)];
    const library = makeLibrary('test', shapes);
    const result = generateCatalogRegistration([library]);

    expect(result).toContain('defaultSize: { width: 44, height: 44 }');
    expect(result).not.toContain('width: 200');
    expect(result).not.toContain('height: 300');
  });

  it('generates correct category from library name', () => {
    const library = makeLibrary('My Cloud Provider', [makeShape('VM')]);
    const result = generateCatalogRegistration([library]);

    expect(result).toContain("category: 'drawio-my-cloud-provider'");
  });

  it('triple deduplication in catalog matches SVG module deduplication', () => {
    const shapes = [
      makeShape('Lambda'),
      makeShape('lambda'),
      makeShape('LAMBDA'),
    ];
    const library = makeLibrary('aws', shapes);

    const svgModule = generateSvgModule('aws', shapes);
    const catalogModule = generateCatalogRegistration([library]);

    // Both modules should have the same deduplicated export names
    expect(svgModule).toContain('DRAWIO_AWS_LAMBDA_SVG');
    expect(svgModule).toContain('DRAWIO_AWS_LAMBDA_2_SVG');
    expect(svgModule).toContain('DRAWIO_AWS_LAMBDA_3_SVG');

    expect(catalogModule).toContain('DRAWIO_AWS_LAMBDA_SVG');
    expect(catalogModule).toContain('DRAWIO_AWS_LAMBDA_2_SVG');
    expect(catalogModule).toContain('DRAWIO_AWS_LAMBDA_3_SVG');
  });
});

// ══════════════════════════════════════════════════════════════
// [CONTRACT] Generated TypeScript output structure
// ══════════════════════════════════════════════════════════════

describe('[CONTRACT] Generated SVG module TypeScript structure', () => {
  const shapes = [
    makeShape('EC2', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect/></svg>'),
    makeShape('S3', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle/></svg>'),
  ];
  const result = generateSvgModule('aws', shapes);

  it('starts with auto-generated header on line 1', () => {
    const firstLine = result.split('\n')[0];
    expect(firstLine).toBe('// AUTO-GENERATED — DO NOT EDIT');
  });

  it('contains source library attribution', () => {
    expect(result).toContain("// Source: draw.io stencil library 'aws'");
  });

  it('contains generator script attribution', () => {
    expect(result).toContain('// Generated by: scripts/generate-drawio-stencils.ts');
  });

  it('each export uses template literals (backtick-delimited)', () => {
    const exportLines = result.split('\n').filter(l => l.startsWith('export const'));
    expect(exportLines.length).toBe(2);
    for (const line of exportLines) {
      expect(line).toMatch(/= `.*`;$/s);
    }
  });

  it('export names follow DRAWIO_{LIB}_{SHAPE}_SVG pattern', () => {
    const exportLines = result.split('\n').filter(l => l.startsWith('export const'));
    for (const line of exportLines) {
      expect(line).toMatch(/export const DRAWIO_[A-Z0-9_]+_SVG/);
    }
  });
});

describe('[CONTRACT] Generated catalog registration TypeScript structure', () => {
  const library = makeLibrary('aws', [
    makeShape('EC2'),
    makeShape('S3'),
  ]);
  const result = generateCatalogRegistration([library]);

  it('imports STENCIL_CATALOG from relative path', () => {
    expect(result).toContain("import { STENCIL_CATALOG } from '../stencilCatalog.js'");
  });

  it('imports SVG constants from per-library file', () => {
    expect(result).toContain("from './svgs/aws.js'");
  });

  it('each STENCIL_CATALOG.set() call has all required fields', () => {
    // Extract set() call blocks
    const setBlocks = result.split('STENCIL_CATALOG.set(').slice(1); // skip before first set
    expect(setBlocks.length).toBe(2); // EC2 and S3

    for (const block of setBlocks) {
      expect(block).toContain("id: '");
      expect(block).toContain("category: '");
      expect(block).toContain("label: '");
      expect(block).toContain('svgContent: ');
      expect(block).toContain('defaultSize: {');
    }
  });

  it('stencil IDs in set() calls use drawio- prefix', () => {
    const idMatches = result.match(/id: '([^']+)'/g) ?? [];
    for (const match of idMatches) {
      expect(match).toMatch(/id: 'drawio-/);
    }
  });

  it('categories use drawio-{lib} format', () => {
    const catMatches = result.match(/category: '([^']+)'/g) ?? [];
    for (const match of catMatches) {
      expect(match).toMatch(/category: 'drawio-/);
    }
  });

  it('import names match svgContent references', () => {
    // Extract imported names
    const importMatch = result.match(/import \{\n([\s\S]*?)\n\} from/);
    expect(importMatch).not.toBeNull();
    const importedNames = importMatch![1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    // Each imported name should appear as svgContent reference
    for (const name of importedNames) {
      expect(result).toContain(`svgContent: ${name}`);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// [BOUNDARY] Cross-module integration: SVG module ↔ catalog
// ══════════════════════════════════════════════════════════════

describe('[BOUNDARY] Cross-module SVG ↔ catalog integration', () => {
  it('all export names in SVG module appear in catalog imports', () => {
    const shapes = [
      makeShape('Cloud Run'),
      makeShape('Cloud SQL'),
      makeShape('Cloud Functions'),
    ];
    const library = makeLibrary('gcp', shapes);

    const svgModule = generateSvgModule('gcp', shapes);
    const catalogModule = generateCatalogRegistration([library]);

    // Extract export names from SVG module
    const exportMatches = svgModule.match(/export const (DRAWIO_[A-Z0-9_]+_SVG)/g) ?? [];
    const exportNames = exportMatches.map(m => m.replace('export const ', ''));

    expect(exportNames.length).toBe(3);

    // Each export name should be imported in catalog module
    for (const name of exportNames) {
      expect(catalogModule).toContain(name);
    }
  });

  it('stencil IDs are unique across multiple libraries', () => {
    const awsLib = makeLibrary('aws', [makeShape('VM'), makeShape('DNS')]);
    const gcpLib = makeLibrary('gcp', [makeShape('VM'), makeShape('DNS')]);

    const result = generateCatalogRegistration([awsLib, gcpLib]);

    // Even though shape names are the same, library prefix makes IDs unique
    expect(result).toContain("id: 'drawio-aws-vm'");
    expect(result).toContain("id: 'drawio-gcp-vm'");
    expect(result).toContain("id: 'drawio-aws-dns'");
    expect(result).toContain("id: 'drawio-gcp-dns'");
  });

  it('SVG module per library uses correct file name convention', () => {
    const libs = [
      makeLibrary('aws', [makeShape('EC2')]),
      makeLibrary('gcp', [makeShape('Cloud Run')]),
      makeLibrary('My Provider', [makeShape('VM')]),
    ];
    const result = generateCatalogRegistration(libs);

    expect(result).toContain("from './svgs/aws.js'");
    expect(result).toContain("from './svgs/gcp.js'");
    expect(result).toContain("from './svgs/my-provider.js'");
  });

  it('catalog registration order matches library order', () => {
    const libs = [
      makeLibrary('alpha', [makeShape('A')]),
      makeLibrary('beta', [makeShape('B')]),
      makeLibrary('gamma', [makeShape('C')]),
    ];
    const result = generateCatalogRegistration(libs);

    const alphaPos = result.indexOf("'drawio-alpha-a'");
    const betaPos = result.indexOf("'drawio-beta-b'");
    const gammaPos = result.indexOf("'drawio-gamma-c'");

    expect(alphaPos).toBeLessThan(betaPos);
    expect(betaPos).toBeLessThan(gammaPos);
  });
});

// ══════════════════════════════════════════════════════════════
// [COVERAGE] Normalization collision awareness
// ══════════════════════════════════════════════════════════════

describe('[COVERAGE] Normalization collision scenarios', () => {
  it('names that differ only in case produce the same stencil ID', () => {
    const a = normalizeStencilId('aws', 'Lambda');
    const b = normalizeStencilId('aws', 'LAMBDA');
    const c = normalizeStencilId('aws', 'lambda');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('names that differ only in separator type produce the same stencil ID', () => {
    const space = normalizeStencilId('aws', 'Cloud Run');
    const underscore = normalizeStencilId('aws', 'Cloud_Run');
    const dot = normalizeStencilId('aws', 'Cloud.Run');
    const slash = normalizeStencilId('aws', 'Cloud/Run');
    expect(space).toBe(underscore);
    expect(underscore).toBe(dot);
    expect(dot).toBe(slash);
  });

  it('names with different special chars but same alphanumeric parts collide', () => {
    const a = normalizeStencilId('aws', 'EC2 (Large)');
    const b = normalizeStencilId('aws', 'EC2-Large');
    const c = normalizeStencilId('aws', 'EC2...Large');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('deduplication prevents collision in generated SVG module', () => {
    const shapes = [
      makeShape('Cloud Run'),
      makeShape('Cloud_Run'),
    ];
    const result = generateSvgModule('gcp', shapes);

    // Should deduplicate even though the raw names differ
    expect(result).toContain('DRAWIO_GCP_CLOUD_RUN_SVG');
    expect(result).toContain('DRAWIO_GCP_CLOUD_RUN_2_SVG');
  });

  it('deduplication prevents collision in catalog registration', () => {
    const shapes = [
      makeShape('Cloud Run'),
      makeShape('Cloud.Run'),
    ];
    const library = makeLibrary('gcp', shapes);
    const result = generateCatalogRegistration([library]);

    // Export names should be deduplicated
    expect(result).toContain('DRAWIO_GCP_CLOUD_RUN_SVG');
    expect(result).toContain('DRAWIO_GCP_CLOUD_RUN_2_SVG');
    // But stencil IDs are based on raw shape names (both normalize the same)
    // Note: stencil IDs DO collide — the catalog uses STENCIL_CATALOG.set() so
    // the second one overwrites the first for the same key. This may be
    // intentional or a gap depending on how the pipeline is meant to handle it.
  });
});

// ══════════════════════════════════════════════════════════════
// [COVERAGE] Real-world draw.io shape name patterns
// ══════════════════════════════════════════════════════════════

describe('[COVERAGE] Real-world draw.io name patterns', () => {
  it('AWS-style names: "Amazon EC2 Auto Scaling"', () => {
    expect(normalizeStencilId('aws', 'Amazon EC2 Auto Scaling')).toBe(
      'drawio-aws-amazon-ec2-auto-scaling',
    );
    expect(normalizeExportName('aws', 'Amazon EC2 Auto Scaling')).toBe(
      'DRAWIO_AWS_AMAZON_EC2_AUTO_SCALING_SVG',
    );
  });

  it('GCP-style names: "Cloud Armor Managed Protection Plus"', () => {
    expect(normalizeStencilId('gcp', 'Cloud Armor Managed Protection Plus')).toBe(
      'drawio-gcp-cloud-armor-managed-protection-plus',
    );
  });

  it('Cisco-style names with version numbers: "ASA 5500-X"', () => {
    expect(normalizeStencilId('cisco', 'ASA 5500-X')).toBe(
      'drawio-cisco-asa-5500-x',
    );
  });

  it('Network-style names with abbreviations: "L3 Switch / Router"', () => {
    expect(normalizeStencilId('network', 'L3 Switch / Router')).toBe(
      'drawio-network-l3-switch-router',
    );
  });

  it('Azure-style names: "Azure Kubernetes Service (AKS)"', () => {
    expect(normalizeStencilId('azure', 'Azure Kubernetes Service (AKS)')).toBe(
      'drawio-azure-azure-kubernetes-service-aks',
    );
  });
});
