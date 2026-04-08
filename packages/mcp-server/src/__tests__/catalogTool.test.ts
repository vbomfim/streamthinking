/**
 * Tests for the canvas catalog tool.
 *
 * Verifies that the catalog correctly reports stencil counts,
 * category breakdowns, and draw.io stencil availability.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { executeCatalog } from '../tools/catalogTool.js';

describe('executeCatalog', () => {
  it('returns full catalog when no section specified', () => {
    const result = executeCatalog({});

    expect(result).toContain('InfiniCanvas Element Catalog');
    expect(result).toContain('Primitives');
    expect(result).toContain('Stencils');
    expect(result).toContain('Layout Guide');
  });

  it('returns stencils section with total count', () => {
    const result = executeCatalog({ section: 'stencils' });

    expect(result).toMatch(/Total: \d+ stencils/);
  });

  it('returns stencils section with category counts', () => {
    const result = executeCatalog({ section: 'stencils' });

    expect(result).toContain('network');
    expect(result).toContain('kubernetes');
    expect(result).toContain('azure');
    // Category should show count in parentheses
    expect(result).toMatch(/### \w[\w-]* \(\d+\)/);
  });

  it('includes draw.io stencil availability note', () => {
    const result = executeCatalog({ section: 'stencils' });

    expect(result).toContain('draw.io');
  });

  it('returns error for unknown section', () => {
    const result = executeCatalog({ section: 'nonexistent' });

    expect(result).toContain('Unknown section');
  });

  // ── Connector information in catalog ───────────────────

  it('arrows section lists routing modes', () => {
    const result = executeCatalog({ section: 'arrows' });

    expect(result).toContain('straight');
    expect(result).toContain('orthogonal');
    expect(result).toContain('curved');
    expect(result).toContain('elbow');
    expect(result).toContain('entityRelation');
    expect(result).toContain('isometric');
  });

  it('arrows section lists arrowhead types by category', () => {
    const result = executeCatalog({ section: 'arrows' });

    // Standard arrowheads
    expect(result).toContain('classic');
    expect(result).toContain('open');
    expect(result).toContain('diamond');

    // ER arrowheads
    expect(result).toContain('ERone');
    expect(result).toContain('ERmany');
    expect(result).toContain('ERmandOne');

    // UML arrowheads
    expect(result).toContain('openAsync');
    expect(result).toContain('dash');
  });

  it('full catalog includes connector section', () => {
    const result = executeCatalog({});

    expect(result).toContain('Routing');
    expect(result).toContain('Arrowhead');
  });

  it('connectors section is available as valid section filter', () => {
    const result = executeCatalog({ section: 'arrows' });

    // Should not be an error
    expect(result).not.toContain('Unknown section');
    expect(result).toContain('Routing');
  });
});
