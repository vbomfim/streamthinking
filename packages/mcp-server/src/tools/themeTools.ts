/**
 * Theme tools for the MCP server.
 *
 * Provides tools for AI agents to apply professional color themes
 * to canvas expressions and list available themes.
 *
 * @module
 */

import type { ExpressionStyle } from '@infinicanvas/protocol';
import { THEME_PRESETS, getThemeById, applyThemeToExpressions } from '@infinicanvas/engine';
import type { IGatewayClient } from '../gatewayClient.js';

// ── Tool parameter types ───────────────────────────────────

export interface ApplyThemeParams {
  themeId: string;
}

// ── Tool implementations ───────────────────────────────────

/**
 * List all available theme presets with their IDs and descriptions.
 * Returns a formatted string suitable for AI consumption.
 */
export function executeListThemes(): string {
  const lines = [`Available themes (${THEME_PRESETS.length}):\n`];

  for (const theme of THEME_PRESETS) {
    const swatches = [
      theme.colors.primary,
      theme.colors.secondary,
      theme.colors.accent,
      theme.colors.stroke,
    ].join(', ');

    lines.push(
      `  • ${theme.id} — "${theme.name}": ${theme.description} [${swatches}]`,
    );
  }

  lines.push('\nUse canvas_apply_theme with the theme id to apply.');
  return lines.join('\n');
}

/**
 * Apply a theme preset to expressions on the canvas.
 *
 * Groups expressions by kind and sends style operations for each group,
 * mapping the theme's color palette to the appropriate style properties.
 */
export async function executeApplyTheme(
  client: IGatewayClient,
  params: ApplyThemeParams,
): Promise<string> {
  const theme = getThemeById(params.themeId);
  if (!theme) {
    const ids = THEME_PRESETS.map((t) => t.id).join(', ');
    return `Theme '${params.themeId}' not found. Available themes: ${ids}`;
  }

  const expressions = client.getState();
  if (expressions.length === 0) {
    return `No expressions on the canvas to theme.`;
  }

  // Compute themed styles
  const themed = applyThemeToExpressions(expressions, theme);

  // Group by style diff to minimize operations
  const styleGroups = new Map<string, { ids: string[]; style: Partial<ExpressionStyle> }>();

  for (let i = 0; i < expressions.length; i++) {
    const original = expressions[i]!;
    const themedExpr = themed[i]!;

    // Compute the diff between original and themed styles
    const diff: Record<string, unknown> = {};
    for (const key of Object.keys(themedExpr.style)) {
      const k = key as keyof ExpressionStyle;
      if (themedExpr.style[k] !== original.style[k]) {
        diff[key] = themedExpr.style[k];
      }
    }

    if (Object.keys(diff).length === 0) continue;

    // Group by serialized style diff
    const groupKey = JSON.stringify(diff);
    const existing = styleGroups.get(groupKey);
    if (existing) {
      existing.ids.push(original.id);
    } else {
      styleGroups.set(groupKey, { ids: [original.id], style: diff as Partial<ExpressionStyle> });
    }
  }

  // Send style operations for each group
  let totalStyled = 0;
  for (const group of styleGroups.values()) {
    await client.sendStyle(group.ids, group.style);
    totalStyled += group.ids.length;
  }

  return `Applied theme "${theme.name}" to ${totalStyled} expression(s). Colors: primary=${theme.colors.primary}, stroke=${theme.colors.stroke}, font=${theme.fontFamily}`;
}
