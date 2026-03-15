/**
 * Default styles, colors, and layout constants for the MCP server.
 *
 * Provides sensible defaults so AI agents don't need to specify every
 * visual property — they can focus on intent and structure.
 *
 * @module
 */

import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';
import type { ExpressionStyle } from '@infinicanvas/protocol';

/**
 * Default visual style for canvas expressions.
 * Re-exported from the canonical source in @infinicanvas/protocol.
 */
export const DEFAULT_STYLE: ExpressionStyle = { ...DEFAULT_EXPRESSION_STYLE };

/** Pastel color palette for sticky notes. */
export const STICKY_NOTE_COLORS = [
  '#FFEB3B', // Yellow
  '#FF9800', // Orange
  '#E91E63', // Pink
  '#9C27B0', // Purple
  '#3F51B5', // Indigo
  '#03A9F4', // Light Blue
  '#4CAF50', // Green
  '#8BC34A', // Light Green
] as const;

/** Pick a random pastel color from the palette. */
export function randomStickyColor(): string {
  const index = Math.floor(Math.random() * STICKY_NOTE_COLORS.length);
  return STICKY_NOTE_COLORS[index]!;
}

/** Default text properties. */
export const DEFAULT_TEXT = {
  fontSize: 16,
  fontFamily: 'sans-serif',
  textAlign: 'left' as const,
};

/** Grid spacing for auto-layout of composite child elements. */
export const LAYOUT = {
  /** Horizontal gap between grid cells. */
  cellGapX: 200,
  /** Vertical gap between grid cells. */
  cellGapY: 150,
  /** Default node width. */
  nodeWidth: 160,
  /** Default node height. */
  nodeHeight: 80,
  /** Padding around composite diagrams. */
  padding: 40,
} as const;

/** MCP server author info — identifies operations as coming from the MCP tool server. */
export const MCP_AUTHOR = {
  type: 'agent' as const,
  id: 'mcp-server',
  name: 'InfiniCanvas MCP',
  provider: 'mcp',
};
