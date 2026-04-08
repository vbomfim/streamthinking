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
  ArrowheadType,
  RoutingMode,
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
  endArrowhead?: ArrowheadType | boolean;
  startArrowhead?: ArrowheadType | boolean;
  /** Routing mode for the connector path. */
  routing?: RoutingMode;
  /** Filled (true) or outline (false) start arrowhead. */
  startFill?: boolean;
  /** Filled (true) or outline (false) end arrowhead. */
  endFill?: boolean;
  /** Smooth bezier curves on orthogonal corners. */
  curved?: boolean;
  /** Round corners on orthogonal route segments. */
  rounded?: boolean;
}

export interface DrawTextParams {
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export interface AddStickyNoteParams {
  x: number;
  y: number;
  text: string;
  color?: string;
  width?: number;
  height?: number;
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

/** Resolve an arrowhead param to an ArrowheadType string. */
function resolveArrowhead(
  value: ArrowheadType | boolean | undefined,
  defaultForTrue: ArrowheadType,
  defaultForUndefined: ArrowheadType,
): ArrowheadType {
  if (typeof value === 'string') return value;
  if (value === true) return defaultForTrue;
  if (value === false) return 'none';
  return defaultForUndefined;
}

/** Create an arrow expression on the canvas. */
export function buildArrow(params: DrawArrowParams): VisualExpression {
  if (params.points.length < 2) {
    throw new Error('Arrow requires at least 2 points');
  }

  const data: ArrowData = {
    kind: 'arrow',
    points: params.points,
    endArrowhead: resolveArrowhead(params.endArrowhead, 'triangle', 'triangle'),
    startArrowhead: resolveArrowhead(params.startArrowhead, 'triangle', 'none'),
    label: params.label,
    routing: params.routing,
    startFill: params.startFill,
    endFill: params.endFill,
    curved: params.curved,
    rounded: params.rounded,
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
    textAlign: params.textAlign ?? DEFAULT_TEXT.textAlign,
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
    { width: params.width ?? 200, height: params.height ?? 200 },
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
  const routing = params.routing ? ` (${params.routing})` : '';
  return `Created arrow${label} with ${params.points.length} points${routing} [id: ${expr.id}]`;
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

// ── ER Relation convenience tool ───────────────────────────

/** Supported ER cardinality types. */
export type ERCardinality =
  | 'one-to-one'
  | 'one-to-many'
  | 'many-to-many'
  | 'zero-to-one'
  | 'zero-to-many';

export interface DrawERRelationParams {
  /** Start endpoint — coordinates or expressionId string. */
  from: { x: number; y: number } | string;
  /** End endpoint — coordinates or expressionId string. */
  to: { x: number; y: number } | string;
  /** ER cardinality of the relationship. */
  cardinality: ERCardinality;
  /** Optional label for the relationship. */
  label?: string;
}

/** Map cardinality to start/end ArrowheadType. */
const CARDINALITY_MAP: Record<ERCardinality, { start: ArrowheadType; end: ArrowheadType }> = {
  'one-to-one':   { start: 'ERmandOne',    end: 'ERmandOne' },
  'one-to-many':  { start: 'ERmandOne',    end: 'ERoneToMany' },
  'many-to-many': { start: 'ERoneToMany',  end: 'ERoneToMany' },
  'zero-to-one':  { start: 'ERmandOne',    end: 'ERzeroToOne' },
  'zero-to-many': { start: 'ERmandOne',    end: 'ERzeroToMany' },
};

/** Build an ER relation arrow from coordinate endpoints. */
export function buildERRelation(params: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  cardinality: ERCardinality;
  label?: string;
}): VisualExpression {
  const { start, end } = CARDINALITY_MAP[params.cardinality];

  return buildArrow({
    points: [[params.from.x, params.from.y], [params.to.x, params.to.y]],
    routing: 'entityRelation',
    startArrowhead: start,
    endArrowhead: end,
    label: params.label,
  });
}

/** Resolve an endpoint to { x, y } — supports coordinates or expressionId lookup. */
function resolveEndpoint(
  endpoint: { x: number; y: number } | string,
  expressions: VisualExpression[],
  label: string,
): { x: number; y: number } {
  if (typeof endpoint === 'string') {
    const expr = expressions.find((e) => e.id === endpoint);
    if (!expr) {
      throw new Error(`Expression '${endpoint}' not found for ${label} endpoint`);
    }
    return {
      x: expr.position.x + expr.size.width / 2,
      y: expr.position.y + expr.size.height / 2,
    };
  }
  return endpoint;
}

/** Execute ER relation tool: resolve endpoints, build arrow, send to gateway. */
export async function executeDrawERRelation(
  client: IGatewayClient,
  params: DrawERRelationParams,
): Promise<string> {
  const expressions = client.getState();
  const from = resolveEndpoint(params.from, expressions, 'from');
  const to = resolveEndpoint(params.to, expressions, 'to');

  const expr = buildERRelation({
    from,
    to,
    cardinality: params.cardinality,
    label: params.label,
  });
  await client.sendCreate(expr);

  const label = params.label ? ` '${params.label}'` : '';
  return `Created ER relation${label} (${params.cardinality}) [id: ${expr.id}]`;
}
