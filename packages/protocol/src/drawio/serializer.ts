/**
 * draw.io XML Serializer — VisualExpression ↔ mxGraphModel.
 *
 * Provides bidirectional serialization between InfiniCanvas VisualExpressions
 * and draw.io's mxGraphModel XML format.
 *
 * Export: VisualExpression[] → mxGraphModel XML string
 * Import: mxGraphModel XML string → VisualExpression[]
 *
 * @module
 */

import { XMLParser } from 'fast-xml-parser';
import type { VisualExpression } from '../schema/expressions.js';
import type { ExpressionStyle } from '../schema/metadata.js';
import { DEFAULT_EXPRESSION_STYLE } from '../schema/metadata.js';
import type {
  RectangleData,
  EllipseData,
  DiamondData,
  LineData,
  ArrowData,
  TextData,
  StickyNoteData,
  StencilData,
} from '../schema/primitives.js';

// ── XML helpers ───────────────────────────────────────────

/** Escape special characters for safe XML attribute values. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Unescape standard XML entities.
 *
 * Required because `processEntities: false` in fast-xml-parser disables
 * ALL entity processing (including the 5 predefined XML entities).
 * We re-enable just the safe, predefined set here.
 */
function unescapeXml(text: string): string {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

/** Render an XML attribute if the value is defined. */
function attr(name: string, value: string | number | undefined): string {
  if (value === undefined) return '';
  return ` ${name}="${typeof value === 'string' ? escapeXml(value) : value}"`;
}

// ── Style conversion ──────────────────────────────────────

/** Build a draw.io style string from a VisualExpression. */
function buildStyleString(expr: VisualExpression): string {
  const parts: string[] = [];

  // Shape prefix
  switch (expr.kind) {
    case 'ellipse':
      parts.push('ellipse');
      break;
    case 'diamond':
      parts.push('rhombus');
      break;
    case 'text':
      parts.push('text');
      break;
    case 'sticky-note':
      parts.push('shape=note');
      break;
    case 'stencil': {
      const stencilData = expr.data as StencilData;
      parts.push(`shape=mxgraph.${stencilData.stencilId}`);
      break;
    }
    case 'line':
      parts.push('endArrow=none');
      break;
    default:
      // rectangle and others use default shape
      break;
  }

  const { style } = expr;

  // Fill color — only use 'none' when background is explicitly transparent
  if (style.backgroundColor === 'transparent') {
    parts.push('fillColor=none');
  } else {
    parts.push(`fillColor=${style.backgroundColor}`);
  }

  // Stroke
  parts.push(`strokeColor=${style.strokeColor}`);

  if (style.strokeWidth !== DEFAULT_EXPRESSION_STYLE.strokeWidth) {
    parts.push(`strokeWidth=${style.strokeWidth}`);
  }

  // Opacity (InfiniCanvas 0-1 → draw.io 0-100)
  if (style.opacity < 1) {
    parts.push(`opacity=${Math.round(style.opacity * 100)}`);
  }

  // Dashed/dotted with distinct dash patterns for round-trip fidelity
  if (style.strokeStyle === 'dashed') {
    parts.push('dashed=1');
    parts.push('dashPattern=8 5');
  } else if (style.strokeStyle === 'dotted') {
    parts.push('dashed=1');
    parts.push('dashPattern=1 3');
  }

  // Rounded for rectangles
  if (expr.kind === 'rectangle') {
    parts.push('rounded=1');
  }

  // Text-related data properties
  if (expr.kind === 'text') {
    const textData = expr.data as TextData;
    parts.push(`fontSize=${textData.fontSize}`);
    parts.push(`fontFamily=${textData.fontFamily}`);
    parts.push(`align=${textData.textAlign}`);
  } else {
    // Font from style (non-text shapes)
    if (style.fontSize !== undefined) {
      parts.push(`fontSize=${style.fontSize}`);
    }
    if (style.fontFamily !== undefined && style.fontFamily !== DEFAULT_EXPRESSION_STYLE.fontFamily) {
      parts.push(`fontFamily=${style.fontFamily}`);
    }
  }

  // Sticky note gets its color from data.color
  if (expr.kind === 'sticky-note') {
    const noteData = expr.data as StickyNoteData;
    // Override fillColor with note's color
    const fillIdx = parts.findIndex((p) => p.startsWith('fillColor='));
    if (fillIdx >= 0) {
      parts[fillIdx] = `fillColor=${noteData.color}`;
    } else {
      parts.push(`fillColor=${noteData.color}`);
    }
  }

  parts.push('whiteSpace=wrap');
  parts.push('html=1');

  // Rotation angle (only when non-zero)
  if (expr.angle !== 0) {
    parts.push(`rotation=${expr.angle}`);
  }

  return parts.join(';') + ';';
}

/** Extract the text value for an mxCell's value attribute. */
function getValueText(expr: VisualExpression): string {
  const data = expr.data;
  switch (data.kind) {
    case 'rectangle':
    case 'ellipse':
    case 'diamond':
      return (data as RectangleData | EllipseData | DiamondData).label ?? '';
    case 'text':
      return (data as TextData).text;
    case 'sticky-note':
      return (data as StickyNoteData).text;
    case 'arrow':
      return (data as ArrowData).label ?? '';
    case 'stencil':
      return (data as StencilData).label ?? '';
    default:
      return '';
  }
}

// ── Export ─────────────────────────────────────────────────

/** Serialize a single vertex expression to an mxCell XML string. */
function vertexToMxCell(expr: VisualExpression): string {
  const value = getValueText(expr);
  const style = buildStyleString(expr);
  const { x, y } = expr.position;
  const { width, height } = expr.size;

  return `    <mxCell${attr('id', expr.id)}${attr('value', value)} style="${escapeXml(style)}" vertex="1" parent="1">\n` +
    `      <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/>\n` +
    `    </mxCell>`;
}

/** Serialize an edge expression (arrow/line) to an mxCell XML string. */
function edgeToMxCell(expr: VisualExpression): string {
  const data = expr.data as ArrowData | LineData;
  const value = expr.kind === 'arrow' ? ((data as ArrowData).label ?? '') : '';
  const style = buildStyleString(expr);

  // Source/target bindings
  let sourceAttr = '';
  let targetAttr = '';
  if (expr.kind === 'arrow') {
    const arrowData = data as ArrowData;
    if (arrowData.startBinding) {
      sourceAttr = attr('source', arrowData.startBinding.expressionId);
    }
    if (arrowData.endBinding) {
      targetAttr = attr('target', arrowData.endBinding.expressionId);
    }
  }

  // Waypoints (all points except first and last for arrows, all for lines)
  const points = data.points;
  let geometryContent: string;

  if (points.length > 2) {
    // Intermediate points are waypoints
    const waypoints = points.slice(1, -1);
    const waypointXml = waypoints
      .map(([px, py]) => `          <mxPoint x="${px}" y="${py}"/>`)
      .join('\n');
    geometryContent =
      `      <mxGeometry relative="1" as="geometry">\n` +
      `        <Array as="points">\n${waypointXml}\n        </Array>\n` +
      `      </mxGeometry>`;
  } else {
    geometryContent = `      <mxGeometry relative="1" as="geometry"/>`;
  }

  return `    <mxCell${attr('id', expr.id)}${attr('value', value)} style="${escapeXml(style)}" edge="1" parent="1"${sourceAttr}${targetAttr}>\n${geometryContent}\n    </mxCell>`;
}

/**
 * Export VisualExpressions to draw.io mxGraphModel XML.
 *
 * @param expressions - Array of VisualExpressions to serialize
 * @returns Valid mxGraphModel XML string
 */
export function expressionsToDrawio(expressions: VisualExpression[]): string {
  const cells = expressions.map((expr) => {
    if (expr.kind === 'arrow' || expr.kind === 'line') {
      return edgeToMxCell(expr);
    }
    return vertexToMxCell(expr);
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<mxGraphModel>',
    '  <root>',
    '    <mxCell id="0"/>',
    '    <mxCell id="1" parent="0"/>',
    ...cells,
    '  </root>',
    '</mxGraphModel>',
  ].join('\n');
}

// ── Import ────────────────────────────────────────────────

/** Infrastructure cell IDs that should be skipped during import. */
const INFRASTRUCTURE_IDS = new Set(['0', '1']);

/** Parse a draw.io semicolon-delimited style string into a map. */
function parseStyleString(style: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!style) return map;

  const tokens = style.split(';').filter(Boolean);
  for (const token of tokens) {
    const eqIdx = token.indexOf('=');
    if (eqIdx >= 0) {
      map.set(token.slice(0, eqIdx), token.slice(eqIdx + 1));
    } else {
      // Shape identifier token (e.g., "ellipse", "rhombus", "text")
      map.set('__shape__', token);
    }
  }
  return map;
}

/** Determine the expression kind from a draw.io style map. */
function resolveKindFromStyle(
  styleMap: Map<string, string>,
  isEdge: boolean,
): VisualExpression['kind'] {
  if (isEdge) {
    const endArrow = styleMap.get('endArrow');
    if (endArrow === 'none') return 'line';
    return 'arrow';
  }

  const shapeValue = styleMap.get('shape');
  const shapeIdent = styleMap.get('__shape__');

  if (shapeValue === 'note') return 'sticky-note';
  if (shapeValue?.startsWith('mxgraph.')) return 'stencil';
  if (shapeIdent === 'ellipse') return 'ellipse';
  if (shapeIdent === 'rhombus') return 'diamond';
  if (shapeIdent === 'text') return 'text';

  return 'rectangle'; // default vertex
}

/** Convert a draw.io style map to an ExpressionStyle. */
function styleMapToExpressionStyle(styleMap: Map<string, string>): ExpressionStyle {
  const style: ExpressionStyle = { ...DEFAULT_EXPRESSION_STYLE };

  const fillColor = styleMap.get('fillColor');
  if (fillColor !== undefined) {
    style.backgroundColor = fillColor === 'none' ? 'transparent' : fillColor;
  }

  const strokeColor = styleMap.get('strokeColor');
  if (strokeColor !== undefined) {
    style.strokeColor = strokeColor;
  }

  const strokeWidth = styleMap.get('strokeWidth');
  if (strokeWidth !== undefined) {
    style.strokeWidth = Number(strokeWidth);
  }

  const opacity = styleMap.get('opacity');
  if (opacity !== undefined) {
    style.opacity = Number(opacity) / 100;
  }

  const dashed = styleMap.get('dashed');
  if (dashed === '1') {
    // Distinguish dotted vs dashed via dashPattern
    const dashPattern = styleMap.get('dashPattern') ?? '';
    const segments = dashPattern.split(/\s+/).filter(Boolean).map(Number);
    const hasShortSegments = segments.length >= 2 && (segments[0] ?? 0) <= 3;
    style.strokeStyle = hasShortSegments ? 'dotted' : 'dashed';
  }

  const fontSize = styleMap.get('fontSize');
  if (fontSize !== undefined) {
    style.fontSize = Number(fontSize);
  }

  const fontFamily = styleMap.get('fontFamily');
  if (fontFamily !== undefined) {
    style.fontFamily = fontFamily;
  }

  return style;
}

/** Parsed mxCell from fast-xml-parser. */
interface ParsedMxCell {
  '@_id'?: string;
  '@_value'?: string;
  '@_style'?: string;
  '@_vertex'?: string;
  '@_edge'?: string;
  '@_parent'?: string;
  '@_source'?: string;
  '@_target'?: string;
  mxGeometry?: ParsedGeometry;
}

/** Parsed mxGeometry from fast-xml-parser. */
interface ParsedGeometry {
  '@_x'?: string;
  '@_y'?: string;
  '@_width'?: string;
  '@_height'?: string;
  '@_relative'?: string;
  '@_as'?: string;
  Array?: ParsedArray;
  mxPoint?: ParsedPoint | ParsedPoint[];
}

/** Parsed Array element (waypoints). */
interface ParsedArray {
  '@_as'?: string;
  mxPoint?: ParsedPoint | ParsedPoint[];
}

/** Parsed mxPoint element. */
interface ParsedPoint {
  '@_x'?: string;
  '@_y'?: string;
  '@_as'?: string;
}

/** Maximum input size for XML import (10 MB). */
const MAX_INPUT_SIZE = 10_000_000;

/** Maximum number of expressions to import. */
const MAX_EXPRESSION_COUNT = 5_000;

/** Sanitize a numeric value: replace NaN/Infinity with a fallback. */
function sanitizeNum(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/** Clamp a dimension value: non-negative and finite. */
function clampDimension(value: number): number {
  const n = sanitizeNum(value, 0);
  return n < 0 ? 0 : n;
}

/** Extract geometry (position/size) from a parsed mxGeometry element. */
function extractGeometry(geo: ParsedGeometry | undefined): {
  position: { x: number; y: number };
  size: { width: number; height: number };
} {
  if (!geo) {
    return {
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
    };
  }

  return {
    position: {
      x: sanitizeNum(Number(geo['@_x'] ?? 0), 0),
      y: sanitizeNum(Number(geo['@_y'] ?? 0), 0),
    },
    size: {
      width: clampDimension(Number(geo['@_width'] ?? 100)),
      height: clampDimension(Number(geo['@_height'] ?? 100)),
    },
  };
}

/** Extract waypoints from parsed geometry. */
function extractWaypoints(geo: ParsedGeometry | undefined): [number, number][] {
  if (!geo) return [];

  const points: [number, number][] = [];

  // Check for Array of points (waypoints)
  if (geo.Array) {
    const arrayPoints = geo.Array.mxPoint;
    if (arrayPoints) {
      const pointList = Array.isArray(arrayPoints) ? arrayPoints : [arrayPoints];
      for (const p of pointList) {
        points.push([Number(p['@_x'] ?? 0), Number(p['@_y'] ?? 0)]);
      }
    }
  }

  return points;
}

/** Build expression data from parsed mxCell attributes. */
function buildExpressionData(
  kind: VisualExpression['kind'],
  value: string,
  styleMap: Map<string, string>,
  cell: ParsedMxCell,
  geo: ParsedGeometry | undefined,
): VisualExpression['data'] {
  switch (kind) {
    case 'rectangle':
      return { kind: 'rectangle', label: value || undefined } as RectangleData;
    case 'ellipse':
      return { kind: 'ellipse', label: value || undefined } as EllipseData;
    case 'diamond':
      return { kind: 'diamond', label: value || undefined } as DiamondData;
    case 'text': {
      const fontSize = Number(styleMap.get('fontSize') ?? 16);
      const fontFamily = styleMap.get('fontFamily') ?? 'sans-serif';
      const textAlign = (styleMap.get('align') ?? 'left') as 'left' | 'center' | 'right';
      return { kind: 'text', text: value, fontSize, fontFamily, textAlign } as TextData;
    }
    case 'sticky-note': {
      const fillColor = styleMap.get('fillColor') ?? '#FFEB3B';
      return { kind: 'sticky-note', text: value, color: fillColor } as StickyNoteData;
    }
    case 'stencil': {
      const shapeValue = styleMap.get('shape') ?? '';
      const stencilId = shapeValue.startsWith('mxgraph.') ? shapeValue.slice('mxgraph.'.length) : shapeValue;
      return {
        kind: 'stencil',
        stencilId,
        category: 'imported',
        label: value || undefined,
      } as StencilData;
    }
    case 'arrow': {
      const waypoints = extractWaypoints(geo);
      // Build points: source → waypoints → target (use [0,0] for unspecified endpoints)
      const allPoints: [number, number][] = [[0, 0], ...waypoints, [0, 0]];

      // Extract sourcePoint/targetPoint from geometry (same as line)
      if (geo?.mxPoint) {
        const geoPoints = Array.isArray(geo.mxPoint) ? geo.mxPoint : [geo.mxPoint];
        const sourcePoint = geoPoints.find((p) => p['@_as'] === 'sourcePoint');
        const targetPoint = geoPoints.find((p) => p['@_as'] === 'targetPoint');
        if (sourcePoint) {
          allPoints[0] = [Number(sourcePoint['@_x'] ?? 0), Number(sourcePoint['@_y'] ?? 0)];
        }
        if (targetPoint) {
          allPoints[allPoints.length - 1] = [Number(targetPoint['@_x'] ?? 0), Number(targetPoint['@_y'] ?? 0)];
        }
      }

      const arrowData: ArrowData = { kind: 'arrow', points: allPoints, label: value || undefined };

      const source = cell['@_source'];
      if (source) {
        arrowData.startBinding = { expressionId: source, anchor: 'auto' };
      }
      const target = cell['@_target'];
      if (target) {
        arrowData.endBinding = { expressionId: target, anchor: 'auto' };
      }

      return arrowData;
    }
    case 'line': {
      const lineWaypoints = extractWaypoints(geo);
      const linePoints: [number, number][] = [[0, 0], ...lineWaypoints, [0, 0]];

      // Check for sourcePoint/targetPoint in geometry
      if (geo?.mxPoint) {
        const geoPoints = Array.isArray(geo.mxPoint) ? geo.mxPoint : [geo.mxPoint];
        const sourcePoint = geoPoints.find((p) => p['@_as'] === 'sourcePoint');
        const targetPoint = geoPoints.find((p) => p['@_as'] === 'targetPoint');
        if (sourcePoint) {
          linePoints[0] = [Number(sourcePoint['@_x'] ?? 0), Number(sourcePoint['@_y'] ?? 0)];
        }
        if (targetPoint) {
          linePoints[linePoints.length - 1] = [Number(targetPoint['@_x'] ?? 0), Number(targetPoint['@_y'] ?? 0)];
        }
      }

      return { kind: 'line', points: linePoints } as LineData;
    }
    default:
      return { kind: 'rectangle', label: value || undefined } as RectangleData;
  }
}

/**
 * Import draw.io mxGraphModel XML to VisualExpressions.
 *
 * @param xml - mxGraphModel XML string to parse
 * @returns Array of VisualExpressions
 */
export function drawioToExpressions(xml: string): VisualExpression[] {
  if (xml.length > MAX_INPUT_SIZE) {
    throw new Error(`draw.io XML input too large: ${xml.length} bytes exceeds ${MAX_INPUT_SIZE} byte limit`);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: false,
    isArray: (tagName) => tagName === 'mxCell' || tagName === 'mxPoint',
  });

  let parsed: { mxGraphModel?: { root?: { mxCell?: ParsedMxCell[] } } };
  try {
    parsed = parser.parse(xml) as typeof parsed;
  } catch {
    return [];
  }

  const cells = parsed.mxGraphModel?.root?.mxCell;
  if (!cells) return [];

  // Guard against excessively large imports
  if (cells.length > MAX_EXPRESSION_COUNT) {
    throw new Error(
      `draw.io file contains ${cells.length} cells, exceeding the limit of ${MAX_EXPRESSION_COUNT}. ` +
      `Reduce the diagram size or split into smaller files.`,
    );
  }

  const expressions: VisualExpression[] = [];
  const now = Date.now();

  for (const cell of cells) {
    const id = cell['@_id'] ?? '';
    if (INFRASTRUCTURE_IDS.has(id)) continue;
    if (!cell['@_vertex'] && !cell['@_edge']) continue;

    const styleStr = cell['@_style'] ?? '';
    const styleMap = parseStyleString(styleStr);
    const isEdge = cell['@_edge'] === '1';
    const kind = resolveKindFromStyle(styleMap, isEdge);
    const value = unescapeXml(cell['@_value'] ?? '');

    const geo = cell.mxGeometry;
    const { position, size } = isEdge
      ? { position: { x: 0, y: 0 }, size: { width: 0, height: 0 } }
      : extractGeometry(geo);

    const expressionStyle = styleMapToExpressionStyle(styleMap);
    const data = buildExpressionData(kind, value, styleMap, cell, geo);

    // Parse rotation angle from style (Finding #7)
    const rotationStr = styleMap.get('rotation');
    const angle = rotationStr !== undefined ? sanitizeNum(Number(rotationStr), 0) : 0;

    const expr: VisualExpression = {
      id,
      kind,
      position,
      size,
      angle,
      style: expressionStyle,
      meta: {
        author: { type: 'agent', id: 'drawio-import', name: 'draw.io Import', provider: 'infinicanvas' },
        createdAt: now,
        updatedAt: now,
        tags: ['drawio-import'],
        locked: false,
      },
      data,
    };

    expressions.push(expr);
  }

  return expressions;
}

