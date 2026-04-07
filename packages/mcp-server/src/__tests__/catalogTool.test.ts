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
});
