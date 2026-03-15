/**
 * Primitive expression tools for the MCP server.
 *
 * These tools create basic visual elements on the canvas:
 * rectangles, ellipses, lines, arrows, text, and sticky notes.
 *
 * @module
 */

import type {
  VisualExpression,
  ExpressionStyle,
  RectangleData,
  EllipseData,
  LineData,
  ArrowData,
  TextData,
  StickyNoteData,
} from '@infinicanvas/protocol';
import { DEFAULT_TEXT, randomStickyColor } from '../defaults.js';
import { buildExpression } from '../expressionFactory.js';
import type { IGatewayClient } from '../gatewayClient.js';

// ── Tool parameter types ───────────────────────────────────

export interface DrawRectangleParams {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: ExpressionStyle['fillStyle'];
}

export interface DrawEllipseParams {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface DrawLineParams {
  points: [number, number][];
}

export interface DrawArrowParams {
  points: [number, number][];
  label?: string;
}

export interface DrawTextParams {
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface AddStickyNoteParams {
  x: number;
  y: number;
  text: string;
  color?: string;
}

// ── Tool implementations ───────────────────────────────────

/** Create a rectangle expression on the canvas. */
export function buildRectangle(params: DrawRectangleParams): VisualExpression {
  const data: RectangleData = {
    kind: 'rectangle',
    label: params.label,
  };

  const styleOverrides: Partial<ExpressionStyle> = {};
  if (params.strokeColor) styleOverrides.strokeColor = params.strokeColor;
  if (params.backgroundColor) styleOverrides.backgroundColor = params.backgroundColor;
  if (params.fillStyle) styleOverrides.fillStyle = params.fillStyle;

  return buildExpression(
    'rectangle',
    { x: params.x, y: params.y },
    { width: params.width, height: params.height },
    data,
    styleOverrides,
  );
}

/** Create an ellipse expression on the canvas. */
export function buildEllipse(params: DrawEllipseParams): VisualExpression {
  const data: EllipseData = {
    kind: 'ellipse',
    label: params.label,
  };

  return buildExpression(
    'ellipse',
    { x: params.x, y: params.y },
    { width: params.width, height: params.height },
    data,
  );
}

/** Create a line expression on the canvas. */
export function buildLine(params: DrawLineParams): VisualExpression {
  if (params.points.length < 2) {
    throw new Error('Line requires at least 2 points');
  }

  const data: LineData = {
    kind: 'line',
    points: params.points,
  };

  // Compute bounding box from points
  const xs = params.points.map((p) => p[0]);
  const ys = params.points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return buildExpression(
    'line',
    { x: minX, y: minY },
    { width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1) },
    data,
  );
}

/** Create an arrow expression on the canvas. */
export function buildArrow(params: DrawArrowParams): VisualExpression {
  if (params.points.length < 2) {
    throw new Error('Arrow requires at least 2 points');
  }

  const data: ArrowData = {
    kind: 'arrow',
    points: params.points,
    endArrowhead: true,
  };

  // Compute bounding box from points
  const xs = params.points.map((p) => p[0]);
  const ys = params.points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return buildExpression(
    'arrow',
    { x: minX, y: minY },
    { width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1) },
    data,
  );
}

/** Create a text expression on the canvas. */
export function buildText(params: DrawTextParams): VisualExpression {
  const data: TextData = {
    kind: 'text',
    text: params.text,
    fontSize: params.fontSize ?? DEFAULT_TEXT.fontSize,
    fontFamily: params.fontFamily ?? DEFAULT_TEXT.fontFamily,
    textAlign: DEFAULT_TEXT.textAlign,
  };

  // Estimate text size based on content
  const fontSize = params.fontSize ?? DEFAULT_TEXT.fontSize;
  const estimatedWidth = Math.max(params.text.length * fontSize * 0.6, 100);
  const estimatedHeight = fontSize * 1.5;

  return buildExpression(
    'text',
    { x: params.x, y: params.y },
    { width: estimatedWidth, height: estimatedHeight },
    data,
    { fontSize, fontFamily: params.fontFamily ?? DEFAULT_TEXT.fontFamily },
  );
}

/** Create a sticky note expression on the canvas. */
export function buildStickyNote(params: AddStickyNoteParams): VisualExpression {
  const color = params.color ?? randomStickyColor();

  const data: StickyNoteData = {
    kind: 'sticky-note',
    text: params.text,
    color,
  };

  return buildExpression(
    'sticky-note',
    { x: params.x, y: params.y },
    { width: 200, height: 200 },
    data,
    { backgroundColor: color, fillStyle: 'solid' },
  );
}

// ── Tool executors (send to gateway) ───────────────────────

/** Execute a primitive tool: build expression and send to gateway. */
export async function executeDrawRectangle(
  client: IGatewayClient,
  params: DrawRectangleParams,
): Promise<string> {
  const expr = buildRectangle(params);
  await client.sendCreate(expr);
  const label = params.label ? ` '${params.label}'` : '';
  return `Created rectangle${label} (${params.width}×${params.height}) at (${params.x}, ${params.y}) [id: ${expr.id}]`;
}

export async function executeDrawEllipse(
  client: IGatewayClient,
  params: DrawEllipseParams,
): Promise<string> {
  const expr = buildEllipse(params);
  await client.sendCreate(expr);
  const label = params.label ? ` '${params.label}'` : '';
  return `Created ellipse${label} (${params.width}×${params.height}) at (${params.x}, ${params.y}) [id: ${expr.id}]`;
}

export async function executeDrawLine(
  client: IGatewayClient,
  params: DrawLineParams,
): Promise<string> {
  const expr = buildLine(params);
  await client.sendCreate(expr);
  return `Created line with ${params.points.length} points [id: ${expr.id}]`;
}

export async function executeDrawArrow(
  client: IGatewayClient,
  params: DrawArrowParams,
): Promise<string> {
  const expr = buildArrow(params);
  await client.sendCreate(expr);
  const label = params.label ? ` '${params.label}'` : '';
  return `Created arrow${label} with ${params.points.length} points [id: ${expr.id}]`;
}

export async function executeDrawText(
  client: IGatewayClient,
  params: DrawTextParams,
): Promise<string> {
  const expr = buildText(params);
  await client.sendCreate(expr);
  const preview = params.text.length > 40 ? params.text.slice(0, 40) + '…' : params.text;
  return `Created text '${preview}' at (${params.x}, ${params.y}) [id: ${expr.id}]`;
}

export async function executeAddStickyNote(
  client: IGatewayClient,
  params: AddStickyNoteParams,
): Promise<string> {
  const expr = buildStickyNote(params);
  await client.sendCreate(expr);
  const preview = params.text.length > 40 ? params.text.slice(0, 40) + '…' : params.text;
  return `Created sticky note '${preview}' at (${params.x}, ${params.y}) [id: ${expr.id}]`;
}
