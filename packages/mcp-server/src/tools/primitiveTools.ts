/**
 * Primitive expression tools for the MCP server.
 *
 * These tools create basic visual elements on the canvas:
 * rectangles, ellipses, lines, arrows, text, and sticky notes.
 *
 * @module
 */

import type { ExpressionStyle } from '@infinicanvas/protocol';
import { randomStickyColor } from '../defaults.js';
import type { IGatewayClient } from '../gatewayClient.js';
import {
  createExcalidrawRectangle,
  createExcalidrawEllipse,
  createExcalidrawArrow,
  createExcalidrawLine,
  createExcalidrawText,
} from './excalidrawBuilder.js';

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
  endArrowhead?: boolean;
  startArrowhead?: boolean;
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

// ── Tool executors (send to gateway) ───────────────────────

/** Draw a rectangle on the canvas via Excalidraw elements. */
export async function executeDrawRectangle(
  client: IGatewayClient,
  params: DrawRectangleParams,
): Promise<string> {
  const existingElements = client.getExcalidrawElements();
  const excalRect = createExcalidrawRectangle({
    x: params.x, y: params.y, width: params.width, height: params.height,
    label: params.label, backgroundColor: params.backgroundColor,
    strokeColor: params.strokeColor,
  });
  const elements = [...existingElements, excalRect];
  if (params.label) {
    const textEl = createExcalidrawText({
      x: params.x + 10,
      y: params.y + params.height / 2 - 12,
      text: params.label,
      width: params.width - 20,
      containerId: excalRect.id as string,
    });
    (excalRect as Record<string, unknown>).boundElements = [{ id: textEl.id, type: 'text' }];
    elements.push(textEl);
  }
  await client.sendSceneUpdate(elements);

  const label = params.label ? ` '${params.label}'` : '';
  return `Created rectangle${label} (${params.width}×${params.height}) at (${params.x}, ${params.y}) [id: ${excalRect.id}]`;
}

export async function executeDrawEllipse(
  client: IGatewayClient,
  params: DrawEllipseParams,
): Promise<string> {
  const existingElements = client.getExcalidrawElements();
  const excalEllipse = createExcalidrawEllipse({
    x: params.x, y: params.y, width: params.width, height: params.height,
    label: params.label,
  });
  const elements = [...existingElements, excalEllipse];
  if (params.label) {
    const textEl = createExcalidrawText({
      x: params.x + 10,
      y: params.y + params.height / 2 - 12,
      text: params.label,
      width: params.width - 20,
      containerId: excalEllipse.id as string,
    });
    (excalEllipse as Record<string, unknown>).boundElements = [{ id: textEl.id, type: 'text' }];
    elements.push(textEl);
  }
  await client.sendSceneUpdate(elements);

  const label = params.label ? ` '${params.label}'` : '';
  return `Created ellipse${label} (${params.width}×${params.height}) at (${params.x}, ${params.y}) [id: ${excalEllipse.id}]`;
}

export async function executeDrawLine(
  client: IGatewayClient,
  params: DrawLineParams,
): Promise<string> {
  if (params.points.length < 2) {
    throw new Error('Line requires at least 2 points');
  }
  const existingElements = client.getExcalidrawElements();
  const excalLine = createExcalidrawLine({ points: params.points });
  await client.sendSceneUpdate([...existingElements, excalLine]);
  return `Created line with ${params.points.length} points [id: ${excalLine.id}]`;
}

export async function executeDrawArrow(
  client: IGatewayClient,
  params: DrawArrowParams,
): Promise<string> {
  if (params.points.length < 2) {
    throw new Error('Arrow requires at least 2 points');
  }
  const existingElements = client.getExcalidrawElements();
  const start = params.points[0]!;
  const end = params.points[params.points.length - 1]!;
  const excalArrow = createExcalidrawArrow({
    startX: start[0], startY: start[1],
    endX: end[0], endY: end[1],
    label: params.label,
  });
  await client.sendSceneUpdate([...existingElements, excalArrow]);

  const label = params.label ? ` '${params.label}'` : '';
  return `Created arrow${label} with ${params.points.length} points [id: ${excalArrow.id}]`;
}

export async function executeDrawText(
  client: IGatewayClient,
  params: DrawTextParams,
): Promise<string> {
  const existingElements = client.getExcalidrawElements();
  const fontSize = params.fontSize ?? 14;
  const estimatedWidth = Math.max(params.text.length * fontSize * 0.6, 100);
  const excalText = createExcalidrawText({
    x: params.x, y: params.y, text: params.text,
    fontSize, width: estimatedWidth, height: fontSize * 1.5,
  });
  await client.sendSceneUpdate([...existingElements, excalText]);

  const preview = params.text.length > 40 ? params.text.slice(0, 40) + '…' : params.text;
  return `Created text '${preview}' at (${params.x}, ${params.y}) [id: ${excalText.id}]`;
}

export async function executeAddStickyNote(
  client: IGatewayClient,
  params: AddStickyNoteParams,
): Promise<string> {
  const existingElements = client.getExcalidrawElements();
  const w = params.width ?? 200;
  const h = params.height ?? 200;
  const color = params.color ?? randomStickyColor();
  const excalRect = createExcalidrawRectangle({
    x: params.x, y: params.y, width: w, height: h,
    backgroundColor: color,
    strokeColor: '#1e1e1e',
  });
  const excalText = createExcalidrawText({
    x: params.x + w / 2 - 50,
    y: params.y + h / 2 - 12,
    text: params.text,
    containerId: excalRect.id as string,
  });
  (excalRect as Record<string, unknown>).boundElements = [{ id: excalText.id, type: 'text' }];
  await client.sendSceneUpdate([...existingElements, excalRect, excalText]);

  const preview = params.text.length > 40 ? params.text.slice(0, 40) + '…' : params.text;
  return `Created sticky note '${preview}' at (${params.x}, ${params.y}) [id: ${excalRect.id}]`;
}
