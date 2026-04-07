/**
 * Unit tests for draw.io stencil code generation.
 *
 * TDD: tests written before implementation per ticket #101.
 *
 * Covers:
 *  - Stencil ID normalization (spaces, special chars, casing)
 *  - Export name generation (SCREAMING_SNAKE + _SVG suffix)
 *  - SVG module TypeScript source generation
 *  - Catalog registration source generation
 *  - Edge cases: dots, parentheses, slashes, empty names
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

// ── normalizeStencilId ───────────────────────────────────────

describe('normalizeStencilId', () => {
  it('converts simple shape name to lowercase kebab-case ID', () => {
    expect(normalizeStencilId('aws', 'EC2')).toBe('drawio-aws-ec2');
  });

  it('replaces spaces with hyphens', () => {
    expect(normalizeStencilId('aws', 'Elastic Load Balancing')).toBe(
      'drawio-aws-elastic-load-balancing',
    );
  });

  it('handles dots in shape names', () => {
    expect(normalizeStencilId('aws', 'Amazon S3.Standard')).toBe(
      'drawio-aws-amazon-s3-standard',
    );
  });

  it('handles parentheses in shape names', () => {
    expect(normalizeStencilId('gcp', 'Cloud Functions (2nd gen)')).toBe(
      'drawio-gcp-cloud-functions-2nd-gen',
    );
  });

  it('handles slashes in shape names', () => {
    expect(normalizeStencilId('network', 'Router/Switch')).toBe(
      'drawio-network-router-switch',
    );
  });

  it('collapses consecutive hyphens', () => {
    expect(normalizeStencilId('aws', 'EC2 -- Instance')).toBe(
      'drawio-aws-ec2-instance',
    );
  });

  it('trims leading/trailing hyphens from the shape portion', () => {
    expect(normalizeStencilId('aws', ' -EC2- ')).toBe('drawio-aws-ec2');
  });

  it('handles underscores by converting to hyphens', () => {
    expect(normalizeStencilId('cisco', 'core_router')).toBe(
      'drawio-cisco-core-router',
    );
  });

  it('strips non-alphanumeric characters except hyphens', () => {
    expect(normalizeStencilId('azure', 'VM (B2s) @Preview!')).toBe(
      'drawio-azure-vm-b2s-preview',
    );
  });

  it('normalizes the library name too', () => {
    expect(normalizeStencilId('AWS 4', 'Lambda')).toBe(
      'drawio-aws-4-lambda',
    );
  });

  // Finding #5: empty input validation
  it('throws on empty library name', () => {
    expect(() => normalizeStencilId('', 'EC2')).toThrow();
  });

  it('throws on whitespace-only library name', () => {
    expect(() => normalizeStencilId('  ', 'EC2')).toThrow();
  });

  it('throws on empty shape name', () => {
    expect(() => normalizeStencilId('aws', '')).toThrow();
  });

  it('throws on whitespace-only shape name', () => {
    expect(() => normalizeStencilId('aws', '   ')).toThrow();
  });
});

// ── normalizeExportName ──────────────────────────────────────

describe('normalizeExportName', () => {
  it('converts to SCREAMING_SNAKE with _SVG suffix', () => {
    expect(normalizeExportName('aws', 'EC2')).toBe('DRAWIO_AWS_EC2_SVG');
  });

  it('replaces spaces with underscores', () => {
    expect(normalizeExportName('aws', 'Elastic Load Balancing')).toBe(
      'DRAWIO_AWS_ELASTIC_LOAD_BALANCING_SVG',
    );
  });

  it('handles dots', () => {
    expect(normalizeExportName('aws', 'S3.Standard')).toBe(
      'DRAWIO_AWS_S3_STANDARD_SVG',
    );
  });

  it('handles parentheses and special chars', () => {
    expect(normalizeExportName('gcp', 'Cloud Functions (2nd gen)')).toBe(
      'DRAWIO_GCP_CLOUD_FUNCTIONS_2ND_GEN_SVG',
    );
  });

  it('collapses consecutive underscores', () => {
    expect(normalizeExportName('aws', 'EC2 -- Instance')).toBe(
      'DRAWIO_AWS_EC2_INSTANCE_SVG',
    );
  });

  it('handles leading digits in shape name by prefixing with library', () => {
    // The library prefix ensures the export name starts with a letter
    expect(normalizeExportName('aws', '48xlarge')).toBe(
      'DRAWIO_AWS_48XLARGE_SVG',
    );
  });

  // Finding #5: empty input validation
  it('throws on empty library name', () => {
    expect(() => normalizeExportName('', 'EC2')).toThrow();
  });

  it('throws on empty shape name', () => {
    expect(() => normalizeExportName('aws', '')).toThrow();
  });
});

// ── generateSvgModule ────────────────────────────────────────

describe('generateSvgModule', () => {
  it('generates correct file header with auto-generated warning', () => {
    const shapes = [makeShape('EC2')];
    const result = generateSvgModule('aws', shapes);

    expect(result).toContain('// AUTO-GENERATED — DO NOT EDIT');
    expect(result).toContain("// Source: draw.io stencil library 'aws'");
    expect(result).toContain('// Generated by: scripts/generate-drawio-stencils.ts');
  });

  it('generates named SVG exports', () => {
    const shapes = [
      makeShape('EC2', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect/></svg>'),
      makeShape('S3', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle/></svg>'),
    ];
    const result = generateSvgModule('aws', shapes);

    expect(result).toContain('export const DRAWIO_AWS_EC2_SVG = `');
    expect(result).toContain('<rect/>');
    expect(result).toContain('export const DRAWIO_AWS_S3_SVG = `');
    expect(result).toContain('<circle/>');
  });

  it('returns empty string for empty shapes array', () => {
    const result = generateSvgModule('aws', []);
    expect(result).toBe('');
  });

  it('escapes backticks in SVG content', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text>price is `$5`</text></svg>';
    const shapes = [makeShape('Test', svg)];
    const result = generateSvgModule('aws', shapes);

    // Backticks should be escaped for template literal safety
    expect(result).not.toContain('`$5`');
    expect(result).toContain('\\`');
  });

  it('escapes dollar signs followed by curly braces in SVG', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text>${injection}</text></svg>';
    const shapes = [makeShape('Test', svg)];
    const result = generateSvgModule('aws', shapes);

    // Template literal interpolation should be escaped
    expect(result).toContain('\\${injection}');
  });

  it('deduplicates export names by appending numeric suffix', () => {
    const shapes = [
      makeShape('Lambda', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect/></svg>'),
      makeShape('lambda', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle/></svg>'),
    ];
    const result = generateSvgModule('aws', shapes);

    expect(result).toContain('DRAWIO_AWS_LAMBDA_SVG');
    expect(result).toContain('DRAWIO_AWS_LAMBDA_2_SVG');
  });

  // Finding #6: sanitize libraryName in comments
  it('sanitizes newlines in library name within header comment', () => {
    const shapes = [makeShape('EC2')];
    const result = generateSvgModule('aws\nevil', shapes);

    // Should not break out of single-line comment
    expect(result).not.toContain('// Source: draw.io stencil library \'aws\nevil\'');
    expect(result).toContain("// Source: draw.io stencil library 'aws evil'");
  });
});

// ── generateCatalogRegistration ──────────────────────────────

describe('generateCatalogRegistration', () => {
  it('generates import from stencilCatalog', () => {
    const library = makeLibrary('aws', [makeShape('EC2')]);
    const result = generateCatalogRegistration([library]);

    expect(result).toContain("import { STENCIL_CATALOG } from '../stencilCatalog.js'");
  });

  it('generates import from SVG module file', () => {
    const library = makeLibrary('aws', [makeShape('EC2')]);
    const result = generateCatalogRegistration([library]);

    expect(result).toContain("from './svgs/aws.js'");
    expect(result).toContain('DRAWIO_AWS_EC2_SVG');
  });

  it('generates STENCIL_CATALOG.set() calls with correct fields', () => {
    const library = makeLibrary('aws', [makeShape('EC2', undefined, 50, 60)]);
    const result = generateCatalogRegistration([library]);

    expect(result).toContain("STENCIL_CATALOG.set('drawio-aws-ec2'");
    expect(result).toContain("id: 'drawio-aws-ec2'");
    expect(result).toContain("category: 'drawio-aws'");
    expect(result).toContain("label: 'EC2'");
    expect(result).toContain('svgContent: DRAWIO_AWS_EC2_SVG');
    expect(result).toContain('defaultSize: { width: 44, height: 44 }');
  });

  it('generates auto-generated header', () => {
    const library = makeLibrary('aws', [makeShape('EC2')]);
    const result = generateCatalogRegistration([library]);

    expect(result).toContain('// AUTO-GENERATED — DO NOT EDIT');
  });

  it('handles multiple libraries', () => {
    const awsLib = makeLibrary('aws', [makeShape('EC2')]);
    const gcpLib = makeLibrary('gcp', [makeShape('Cloud Run')]);
    const result = generateCatalogRegistration([awsLib, gcpLib]);

    expect(result).toContain("from './svgs/aws.js'");
    expect(result).toContain("from './svgs/gcp.js'");
    expect(result).toContain("STENCIL_CATALOG.set('drawio-aws-ec2'");
    expect(result).toContain("STENCIL_CATALOG.set('drawio-gcp-cloud-run'");
  });

  it('returns empty string when all libraries have no shapes', () => {
    const library = makeLibrary('aws', []);
    const result = generateCatalogRegistration([library]);
    expect(result).toBe('');
  });

  it('skips libraries with empty shapes but includes others', () => {
    const emptyLib = makeLibrary('aws', []);
    const goodLib = makeLibrary('gcp', [makeShape('Cloud Run')]);
    const result = generateCatalogRegistration([emptyLib, goodLib]);

    expect(result).not.toContain("from './svgs/aws.js'");
    expect(result).toContain("from './svgs/gcp.js'");
  });

  it('generates valid TypeScript (no duplicate identifiers)', () => {
    const library = makeLibrary('aws', [
      makeShape('Lambda'),
      makeShape('lambda'),
    ]);
    const result = generateCatalogRegistration([library]);

    // Should have deduplicated export names
    expect(result).toContain('DRAWIO_AWS_LAMBDA_SVG');
    expect(result).toContain('DRAWIO_AWS_LAMBDA_2_SVG');
  });

  // Finding #1: proper label escaping (backslash, newlines)
  it('escapes backslashes in labels', () => {
    const library = makeLibrary('aws', [makeShape('A\\B')]);
    const result = generateCatalogRegistration([library]);

    // Backslash must be escaped for valid TypeScript string
    expect(result).toContain("label: 'A\\\\B'");
  });

  it('escapes newlines in labels', () => {
    const library = makeLibrary('aws', [makeShape('A\nB')]);
    const result = generateCatalogRegistration([library]);

    // Newline must be escaped for valid TypeScript string
    expect(result).toContain("label: 'A\\nB'");
  });

  it('escapes carriage returns in labels', () => {
    const library = makeLibrary('aws', [makeShape('A\rB')]);
    const result = generateCatalogRegistration([library]);

    expect(result).toContain("label: 'A\\rB'");
  });

  it('escapes single quotes in labels', () => {
    const library = makeLibrary('aws', [makeShape("it's a test")]);
    const result = generateCatalogRegistration([library]);

    expect(result).toContain("label: 'it\\'s a test'");
  });

  // Finding #2: stencil ID deduplication
  it('deduplicates stencil IDs for case-colliding shape names', () => {
    const library = makeLibrary('aws', [
      makeShape('Lambda'),
      makeShape('lambda'),
    ]);
    const result = generateCatalogRegistration([library]);

    // First should be the base ID, second should get -2 suffix
    expect(result).toContain("STENCIL_CATALOG.set('drawio-aws-lambda'");
    expect(result).toContain("STENCIL_CATALOG.set('drawio-aws-lambda-2'");
    expect(result).toContain("id: 'drawio-aws-lambda'");
    expect(result).toContain("id: 'drawio-aws-lambda-2'");
  });

  it('deduplicates stencil IDs across three-way collision', () => {
    const library = makeLibrary('aws', [
      makeShape('Lambda'),
      makeShape('lambda'),
      makeShape('LAMBDA'),
    ]);
    const result = generateCatalogRegistration([library]);

    expect(result).toContain("id: 'drawio-aws-lambda'");
    expect(result).toContain("id: 'drawio-aws-lambda-2'");
    expect(result).toContain("id: 'drawio-aws-lambda-3'");
  });

  // Finding #6: sanitize libraryName in comments
  it('sanitizes newlines in library name within registration comments', () => {
    const library = makeLibrary('aws\nevil', [makeShape('EC2')]);
    const result = generateCatalogRegistration([library]);

    // Should not break out of single-line comment
    expect(result).not.toContain('// Register aws\nevil stencils');
    expect(result).toContain('// Register aws evil stencils');
  });
});

// ── Integration: round-trip consistency ──────────────────────

describe('Integration: ID and export name consistency', () => {
  it('stencil IDs in catalog registration match normalizeStencilId output', () => {
    const shapes = [makeShape('Elastic Load Balancing')];
    const library = makeLibrary('aws', shapes);
    const result = generateCatalogRegistration([library]);

    const expectedId = normalizeStencilId('aws', 'Elastic Load Balancing');
    expect(result).toContain(`'${expectedId}'`);
  });

  it('export names in SVG module match those in catalog registration', () => {
    const shapes = [makeShape('Cloud Functions')];
    const library = makeLibrary('gcp', shapes);

    const svgModule = generateSvgModule('gcp', shapes);
    const catalogModule = generateCatalogRegistration([library]);

    const expectedExport = normalizeExportName('gcp', 'Cloud Functions');
    expect(svgModule).toContain(`export const ${expectedExport}`);
    expect(catalogModule).toContain(expectedExport);
  });
});
