/**
 * Container expression tools for the MCP server.
 *
 * Creates container and swimlane expressions on the canvas
 * for AI agents to organize shapes into visual groups.
 *
 * @module
 */

import type {
  VisualExpression,
  ExpressionStyle,
  ContainerData,
} from '@infinicanvas/protocol';
import { buildExpression } from '../expressionFactory.js';
import type { IGatewayClient } from '../gatewayClient.js';

// ── Tool parameter types ───────────────────────────────────

export interface CreateContainerParams {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  headerHeight?: number;
  padding?: number;
  collapsed?: boolean;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: ExpressionStyle['fillStyle'];
}

export interface CreateSwimlanesParams {
  x: number;
  y: number;
  lanes: Array<{ title: string }>;
  orientation?: 'horizontal' | 'vertical';
  laneWidth?: number;
  laneHeight?: number;
}

// ── Constants ──────────────────────────────────────────────

/** Default header height for containers. */
const DEFAULT_HEADER_HEIGHT = 40;

/** Default inner padding for containers. */
const DEFAULT_PADDING = 20;

/** Default lane width for horizontal swimlanes. */
const DEFAULT_LANE_WIDTH = 300;

/** Default lane height for horizontal swimlanes. */
const DEFAULT_LANE_HEIGHT = 400;

/** Gap between swimlane containers. */
const LANE_GAP = 0;

// ── Tool implementations ───────────────────────────────────

/** Build a container VisualExpression. */
export function buildContainer(params: CreateContainerParams): VisualExpression {
  const data: ContainerData = {
    kind: 'container',
    title: params.title,
    headerHeight: params.headerHeight ?? DEFAULT_HEADER_HEIGHT,
    padding: params.padding ?? DEFAULT_PADDING,
    collapsed: params.collapsed ?? false,
  };

  const styleOverrides: Partial<ExpressionStyle> = {};
  if (params.strokeColor) styleOverrides.strokeColor = params.strokeColor;
  if (params.backgroundColor) styleOverrides.backgroundColor = params.backgroundColor;
  if (params.fillStyle) styleOverrides.fillStyle = params.fillStyle;

  return buildExpression(
    'container',
    { x: params.x, y: params.y },
    { width: params.width, height: params.height },
    data,
    styleOverrides,
  );
}

/** Build multiple container VisualExpressions arranged as swimlanes. */
export function buildSwimlanes(params: CreateSwimlanesParams): VisualExpression[] {
  const orientation = params.orientation ?? 'horizontal';
  const laneWidth = params.laneWidth ?? DEFAULT_LANE_WIDTH;
  const laneHeight = params.laneHeight ?? DEFAULT_LANE_HEIGHT;
  const lanes: VisualExpression[] = [];

  for (let i = 0; i < params.lanes.length; i++) {
    const lane = params.lanes[i]!;
    const laneX = orientation === 'horizontal'
      ? params.x + i * (laneWidth + LANE_GAP)
      : params.x;
    const laneY = orientation === 'horizontal'
      ? params.y
      : params.y + i * (laneHeight + LANE_GAP);

    lanes.push(buildContainer({
      x: laneX,
      y: laneY,
      width: laneWidth,
      height: laneHeight,
      title: lane.title,
    }));
  }

  return lanes;
}

// ── Tool executors (send to gateway) ───────────────────────

/** Execute container creation: build and send to gateway. */
export async function executeCreateContainer(
  client: IGatewayClient,
  params: CreateContainerParams,
): Promise<string> {
  const expr = buildContainer(params);
  await client.sendCreate(expr);
  return `Created container '${params.title}' (${params.width}×${params.height}) at (${params.x}, ${params.y}) [id: ${expr.id}]`;
}

/** Execute swimlane creation: build N containers and send to gateway. */
export async function executeCreateSwimlanes(
  client: IGatewayClient,
  params: CreateSwimlanesParams,
): Promise<string> {
  const lanes = buildSwimlanes(params);

  // #112 Fix #8: Use batch create for efficiency
  await client.sendBatchCreate(lanes);

  const ids = lanes.map((l) => l.id);
  const orientation = params.orientation ?? 'horizontal';
  const titles = params.lanes.map((l) => l.title).join(', ');
  return `Created ${lanes.length} ${orientation} swimlane(s): ${titles} [ids: ${ids.join(', ')}]`;
}
