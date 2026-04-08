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
  getAllStencilMeta,
  THEME_PRESETS,
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
  const allMeta = getAllStencilMeta();
  const lines: string[] = ['## Stencils'];

  lines.push(`\nTotal: ${allMeta.length} stencils across ${categories.length} categories.`);
  lines.push('Use `canvas_search_stencils` to find stencils by name, or `canvas_list_stencils` with search/pagination.');

  for (const category of categories) {
    const stencils = getStencilsByCategory(category);
    lines.push(`\n### ${category} (${stencils.length})`);
    for (const s of stencils) {
      const size = `${s.defaultSize.width}×${s.defaultSize.height}`;
      const container = s.defaultSize.width >= 150 ? ' [container]' : '';
      lines.push(`- ${s.id}: ${s.label} (${size})${container}`);
    }
  }

  lines.push(`
### draw.io Stencils
Additional stencils from draw.io libraries may be available as lazy-loaded categories.
Use \`canvas_list_stencils\` or \`canvas_search_stencils\` to discover all available stencils,
including any registered draw.io stencil packs.

### Stencil Label Placement
- **Container stencils** (zones, clusters, namespaces): Use \`labelPosition: 'top-left'\` and \`fontSize: 14\`. This renders the label inside the container at the top-left.
- **Icon stencils** (server, database, pod, etc.): Use \`labelPosition: 'below'\` (default) and \`fontSize: 10\`.

### Container Stencils — Do NOT use default sizes!
Container stencils (cluster, namespace, zone, resource-group, etc.) have small default sizes (200×150).
**Always calculate the actual size needed** based on what goes inside — see Layout Guide.
- A container with 2 inner objects side-by-side needs at least **width: 340px, height: 200px**
- A container with 3 inner objects in a row needs at least **width: 450px, height: 200px**
- A cluster containing a namespace needs at least **100px more** than the namespace in each dimension`);

  return lines.join('\n');
}

function buildLayoutGuideSection(): string {
  return `## Layout Guide

### Container Sizing Formula
When placing objects inside containers, calculate the container size:
- **Width** = (number of columns × object width) + ((columns - 1) × horizontal gap) + (2 × padding)
- **Height** = (number of rows × object height) + ((rows - 1) × vertical gap) + (2 × padding) + label height

### Concrete values
- **Padding** inside containers: 50px on all sides (top needs 70px if container has a label)
- **Gap** between inner objects: 80px horizontal, 80px vertical
- **Inner stencil size**: 64×64 minimum (use width/height params to override)

### Example: 3 objects in a row inside a namespace
- Objects: 3 × 64px wide = 192px
- Gaps: 2 × 80px = 160px
- Padding: 2 × 50px = 100px
- **Total width needed: 452px**
- Height: 64px + 70px top + 50px bottom = **184px minimum**

### Example: namespace inside a cluster
- Namespace is 452×184
- Cluster padding: 50px each side, 70px top for label
- **Cluster width: 452 + 100 = 552px**
- **Cluster height: 184 + 120 = 304px**

### Nesting rule
Always size from inside out: calculate innermost container first, then add padding for each outer container.

### Object spacing outside containers
- Gap between separate objects: 60px
- Gap between external stencils: 80-100px horizontal for arrows to be readable`;
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
- Default: endArrowhead='triangle', startArrowhead='none'
- For bidirectional: both ends = 'triangle'
- For plain line: both ends = 'none'

### Routing Modes
Set via the \`routing\` parameter on \`canvas_draw_arrow\`:
- **straight** — Direct line between points (default)
- **orthogonal** — Right-angle segments (Manhattan routing)
- **curved** — Smooth bezier curve
- **elbow** — Single-bend elbow connector
- **entityRelation** — ER-style routing with perpendicular exits from shapes
- **isometric** — 30°/60° isometric routing for isometric diagrams
- **orthogonalCurved** — Orthogonal routing with bezier-smoothed corners

### Arrowhead Types
Set via \`startArrowhead\` and \`endArrowhead\` parameters. Use \`startFill\`/\`endFill\` (boolean) to toggle filled vs outline.

**Standard:**
- \`none\` — no arrowhead
- \`classic\` — filled triangle (draw.io default)
- \`classicThin\` — thinner filled triangle
- \`triangle\` — alias for classic (backward compat)
- \`open\` — outline triangle
- \`openThin\` — thinner outline triangle
- \`block\` / \`blockThin\` — filled rectangle
- \`oval\` — filled circle
- \`diamond\` / \`diamondThin\` — filled diamond

**ER Diagram:**
- \`ERone\` — single bar (|)
- \`ERmany\` — crow's foot (>)
- \`ERmandOne\` — mandatory one (||)
- \`ERoneToMany\` — one to many (|>)
- \`ERzeroToOne\` — zero to one (o|)
- \`ERzeroToMany\` — zero to many (o>)

**UML:**
- \`openAsync\` — open arrowhead (async message)
- \`dash\` — dashed end
- \`cross\` — X mark

**Other:**
- \`box\` — small filled box
- \`halfCircle\` — half circle
- \`doubleBlock\` — double block arrows

### Connector Options
- \`curved: true\` — Smooth bezier curves on orthogonal corners
- \`rounded: true\` — Round corners on orthogonal route segments

### Arrow Labels
- Use the \`label\` parameter to add text labels to arrows (e.g., "HTTPS", "/api", "TCP/443")
- Labels render at the arrow midpoint with a white background for readability
- Font size defaults to 12px, uses the arrow's strokeColor

### ER Diagrams
Use \`canvas_draw_er_relation\` for quick ER diagram connectors with pre-configured cardinality arrowheads.
Supported cardinalities: one-to-one, one-to-many, many-to-many, zero-to-one, zero-to-many.`;
}

function buildThemesSection(): string {
  const themeLines = THEME_PRESETS.map((t) =>
    `- **${t.id}** — "${t.name}": ${t.description} (font: ${t.fontFamily})`,
  );

  return `## Color Themes
One-click professional color themes. Use \`canvas_apply_theme\` to apply.

### Available Themes
${themeLines.join('\n')}

### Usage
- \`canvas_apply_theme\` — Apply a theme to all or selected expressions
- \`canvas_list_themes\` — List available themes with color details
- Themes assign: primary fill to shapes, accent to sticky notes, stroke color, and font family
- Theme application is undo-able`;
}

// ── Section registry ───────────────────────────────────────

const SECTIONS: Record<string, () => string> = {
  primitives: buildPrimitivesSection,
  stencils: buildStencilsSection,
  layout: buildLayoutGuideSection,
  fonts: buildFontGuideSection,
  arrows: buildArrowGuideSection,
  themes: buildThemesSection,
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
    '',
    buildThemesSection(),
  ].join('\n');
}
