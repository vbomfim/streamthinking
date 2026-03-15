/**
 * Shared expression factory for the MCP server.
 *
 * Builds a complete VisualExpression from kind, position, size, data,
 * and optional style overrides. Extracted to avoid copy-pasting the
 * same factory across primitive, composite, and annotation tools.
 *
 * @module
 */

import { nanoid } from 'nanoid';
import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import { DEFAULT_STYLE, MCP_AUTHOR } from './defaults.js';

/**
 * Build a fully-formed VisualExpression with sensible defaults.
 *
 * @param kind - Expression kind (must match data.kind)
 * @param position - Top-left corner { x, y }
 * @param size - Dimensions { width, height }
 * @param data - Kind-specific payload
 * @param styleOverrides - Optional partial style to merge over defaults
 * @returns A new VisualExpression with unique ID and current timestamp
 */
export function buildExpression(
  kind: VisualExpression['kind'],
  position: { x: number; y: number },
  size: { width: number; height: number },
  data: VisualExpression['data'],
  styleOverrides?: Partial<ExpressionStyle>,
): VisualExpression {
  const now = Date.now();
  return {
    id: nanoid(),
    kind,
    position,
    size,
    angle: 0,
    style: { ...DEFAULT_STYLE, ...styleOverrides },
    meta: {
      author: MCP_AUTHOR,
      createdAt: now,
      updatedAt: now,
      tags: [],
      locked: false,
    },
    data,
  };
}
