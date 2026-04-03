/**
 * Canvas catalog tool — complete reference guide for AI models.
 *
 * Returns a formatted text catalog of all available canvas elements,
 * stencils (read dynamically from the engine), layout guidelines,
 * and best practices for creating diagrams.
 *
 * @module
 */

import {
  getAllCategories,
  getStencilsByCategory,
} from '@infinicanvas/engine';

// ── Section builders ───────────────────────────────────────

function buildPrimitivesSection(): string {
  return `## Primitives
- rectangle: Box/container. Recommended sizes: small=120×60, medium=160×80, large=200×120
- ellipse: Circle/oval. Start/end nodes. Sizes: small=80×80, medium=120×80
- diamond: Decision node. Size: 100×100
- arrow: Connector with optional arrowheads (triangle, chevron, diamond, circle). Both ends configurable.
- text: Label/heading. fontSize defaults: title=18, label=14, body=12, caption=10
- sticky-note: Quick note. Default 200×200.`;
}

function buildStencilsSection(): string {
  const categories = getAllCategories();
  const lines: string[] = ['## Stencils'];

  for (const category of categories) {
    const stencils = getStencilsByCategory(category);
    lines.push(`\n### ${category}`);
    for (const s of stencils) {
      const size = `${s.defaultSize.width}×${s.defaultSize.height}`;
      const container = s.defaultSize.width >= 150 ? ' [container]' : '';
      lines.push(`- ${s.id}: ${s.label} (${size})${container}`);
    }
  }

  lines.push(`
### Stencil Label Placement
- **Container stencils** (zones, clusters, namespaces): Use \`labelPosition: 'top-left'\` and \`fontSize: 14\`. This renders the label inside the container at the top-left.
- **Icon stencils** (server, database, pod, etc.): Use \`labelPosition: 'below'\` (default) and \`fontSize: 10\`.
- **Inner components**: When placing stencils inside containers, use at least 64×64 size. Leave 40px margin from container edges.`);

  return lines.join('\n');
}

function buildLayoutGuideSection(): string {
  return `## Layout Guide
- Gap between objects: 40-60px
- Gap between connected nodes: 60-80px vertically, 80-100px horizontally
- Minimum margin from edges: 40px
- Inner objects: place 20px inside container borders
- Standard grid: align objects to 20px grid for clean layouts
- Container inner padding: place inner objects at least 40px from container edges
- Inner stencils: use 64×64 minimum size (override with width/height params)`;
}

function buildFontGuideSection(): string {
  return `## Font Guide
- Title/heading: fontSize=18, fontFamily='sans-serif'
- Label (inside shapes): fontSize=14 (auto-scales with shape)
- Body text: fontSize=12
- Caption/annotation: fontSize=10
- Stencil labels: fontSize=10 (auto-scales with stencil size)`;
}

function buildArrowGuideSection(): string {
  return `## Arrow Guide
- Connect to nearest edges: if target is below → source.bottom to target.top
- If target is right → source.right to target.left
- Arrowhead types: triangle (filled), chevron (open V), diamond, circle
- Default: endArrowhead='triangle', startArrowhead='none'
- For bidirectional: both ends = 'triangle'
- For plain line: both ends = 'none'

### Arrow Labels
- Use the \`label\` parameter to add text labels to arrows (e.g., "HTTPS", "/api", "TCP/443")
- Labels render at the arrow midpoint with a white background for readability
- Font size defaults to 12px, uses the arrow's strokeColor`;
}

// ── Section registry ───────────────────────────────────────

const SECTIONS: Record<string, () => string> = {
  primitives: buildPrimitivesSection,
  stencils: buildStencilsSection,
  layout: buildLayoutGuideSection,
  fonts: buildFontGuideSection,
  arrows: buildArrowGuideSection,
};

const VALID_SECTIONS = Object.keys(SECTIONS);

// ── Public executor ────────────────────────────────────────

export interface CatalogParams {
  section?: string;
}

/**
 * Build and return the catalog text, optionally filtered to a single section.
 */
export function executeCatalog(params: CatalogParams): string {
  const { section } = params;

  if (section) {
    const key = section.toLowerCase();
    const builder = SECTIONS[key];
    if (!builder) {
      return `Unknown section "${section}". Valid sections: ${VALID_SECTIONS.join(', ')}`;
    }
    return builder();
  }

  // Return all sections separated by blank lines
  return [
    '# InfiniCanvas Element Catalog',
    '',
    buildPrimitivesSection(),
    '',
    buildStencilsSection(),
    '',
    buildLayoutGuideSection(),
    '',
    buildFontGuideSection(),
    '',
    buildArrowGuideSection(),
  ].join('\n');
}
