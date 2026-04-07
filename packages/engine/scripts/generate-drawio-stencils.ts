#!/usr/bin/env npx tsx
/**
 * Draw.io stencil generation pipeline.
 *
 * Downloads draw.io stencil library XML files from the jgraph/drawio
 * GitHub repository, parses them with `parseStencilLibrary()`, and
 * generates TypeScript source files with SVG constants + catalog
 * registration.
 *
 * Usage:
 *   npx tsx scripts/generate-drawio-stencils.ts
 *
 * Generated files:
 *   src/renderer/stencils/drawio/svgs/{library}.ts  — SVG exports
 *   src/renderer/stencils/drawio/index.ts           — catalog registration
 *
 * @module
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseStencilLibrary } from '@infinicanvas/protocol';
import type { DrawioStencilLibrary } from '@infinicanvas/protocol';

import {
  generateSvgModule,
  generateCatalogRegistration,
} from '../src/renderer/stencils/drawio/generateStencilCode.js';

// ── Configuration ────────────────────────────────────────────

/** Pinned commit SHA from jgraph/drawio for reproducible builds. */
const DRAWIO_PINNED_SHA = '890ea0b7880f4962bfc2b25b35103286aad0d1cb';

/** Base URL for draw.io stencil XML files, pinned to a specific commit. */
const DRAWIO_STENCIL_BASE_URL =
  `https://raw.githubusercontent.com/jgraph/drawio/${DRAWIO_PINNED_SHA}/src/main/webapp/stencils`;

/** Library definitions: which stencil files to download and how to name them. */
interface LibraryConfig {
  /** Filename on the draw.io repo (e.g., "aws4.xml"). */
  filename: string;
  /** Short library identifier used in generated IDs (e.g., "aws"). */
  name: string;
}

const LIBRARY_CONFIGS: readonly LibraryConfig[] = [
  { filename: 'aws4.xml', name: 'aws' },
  { filename: 'gcp.xml', name: 'gcp' },
  { filename: 'kubernetes2.xml', name: 'kubernetes' },
  { filename: 'azure.xml', name: 'azure' },
  { filename: 'cisco.xml', name: 'cisco' },
  { filename: 'network.xml', name: 'network' },
];

/** Download timeout in milliseconds. */
const DOWNLOAD_TIMEOUT_MS = 30_000;

// ── Paths ────────────────────────────────────────────────────

const __filename_resolved = fileURLToPath(import.meta.url);
const __dirname_resolved = dirname(__filename_resolved);
const ENGINE_ROOT = join(__dirname_resolved, '..');
const DRAWIO_DIR = join(ENGINE_ROOT, 'src', 'renderer', 'stencils', 'drawio');
const SVGS_DIR = join(DRAWIO_DIR, 'svgs');

// ── Download ─────────────────────────────────────────────────

/**
 * Download a stencil library XML file from GitHub.
 *
 * Returns null if the download fails (logged but not thrown).
 */
async function downloadLibrary(config: LibraryConfig): Promise<string | null> {
  const url = `${DRAWIO_STENCIL_BASE_URL}/${config.filename}`;
  console.log(`  ⬇ Downloading ${config.name} from ${url}...`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`  ✗ Failed to download ${config.name}: HTTP ${response.status}`);
      return null;
    }

    const xml = await response.text();
    console.log(`  ✓ Downloaded ${config.name} (${(xml.length / 1024).toFixed(1)} KB)`);
    return xml;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  ✗ Failed to download ${config.name}: ${message}`);
    return null;
  }
}

// ── Pipeline ─────────────────────────────────────────────────

interface GenerationResult {
  libraryName: string;
  shapeCount: number;
  skipped: boolean;
  error?: string;
}

async function main(): Promise<void> {
  console.log('🔧 draw.io Stencil Generation Pipeline');
  console.log('═'.repeat(50));
  console.log('');

  // Ensure output directories exist
  await mkdir(SVGS_DIR, { recursive: true });

  const results: GenerationResult[] = [];
  const parsedLibraries: DrawioStencilLibrary[] = [];

  // Step 1: Download and parse each library (in parallel)
  console.log('Step 1: Download & parse stencil libraries');
  console.log('─'.repeat(50));

  const downloadResults = await Promise.allSettled(
    LIBRARY_CONFIGS.map(async (config) => {
      const xml = await downloadLibrary(config);
      return { config, xml };
    }),
  );

  for (const settled of downloadResults) {
    if (settled.status === 'rejected') {
      const message = settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
      results.push({ libraryName: 'unknown', shapeCount: 0, skipped: true, error: message });
      continue;
    }

    const { config, xml } = settled.value;

    if (xml === null) {
      results.push({ libraryName: config.name, shapeCount: 0, skipped: true, error: 'Download failed' });
      continue;
    }

    try {
      const library = parseStencilLibrary(xml);
      // Override the library name with our config name for consistent naming
      const normalizedLibrary: DrawioStencilLibrary = {
        name: config.name,
        shapes: library.shapes,
      };
      parsedLibraries.push(normalizedLibrary);
      results.push({ libraryName: config.name, shapeCount: library.shapes.length, skipped: false });
      console.log(`  ✓ Parsed ${config.name}: ${library.shapes.length} shapes`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ Failed to parse ${config.name}: ${message}`);
      results.push({ libraryName: config.name, shapeCount: 0, skipped: true, error: message });
    }
  }

  console.log('');

  // Step 2: Generate SVG modules
  console.log('Step 2: Generate TypeScript SVG modules');
  console.log('─'.repeat(50));

  for (const library of parsedLibraries) {
    const source = generateSvgModule(library.name, library.shapes);
    if (source) {
      const filePath = join(SVGS_DIR, `${library.name}.ts`);
      await writeFile(filePath, source, 'utf-8');
      console.log(`  ✓ Generated ${library.name}.ts (${library.shapes.length} exports)`);
    }
  }

  console.log('');

  // Step 3: Generate catalog registration
  console.log('Step 3: Generate catalog registration');
  console.log('─'.repeat(50));

  const catalogSource = generateCatalogRegistration(parsedLibraries);
  if (catalogSource) {
    const catalogPath = join(DRAWIO_DIR, 'index.ts');
    await writeFile(catalogPath, catalogSource, 'utf-8');
    console.log('  ✓ Generated drawio/index.ts');
  } else {
    console.log('  ⚠ No shapes to register — skipping catalog generation');
  }

  console.log('');

  // Step 4: Summary
  console.log('Summary');
  console.log('═'.repeat(50));
  console.log('');
  console.log('Library            Shapes   Status');
  console.log('─'.repeat(50));

  let totalShapes = 0;
  for (const result of results) {
    const status = result.skipped ? `SKIPPED (${result.error})` : 'OK';
    const shapes = result.skipped ? '-' : String(result.shapeCount);
    console.log(
      `${result.libraryName.padEnd(19)}${shapes.padStart(6)}   ${status}`,
    );
    if (!result.skipped) {
      totalShapes += result.shapeCount;
    }
  }

  console.log('─'.repeat(50));
  console.log(`Total              ${String(totalShapes).padStart(6)}   ${parsedLibraries.length}/${LIBRARY_CONFIGS.length} libraries`);
  console.log('');

  if (parsedLibraries.length === 0) {
    console.error('✗ No libraries were successfully processed.');
    process.exit(1);
  }

  console.log('✓ Generation complete. Review generated files before committing.');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
