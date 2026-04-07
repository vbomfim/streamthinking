/**
 * Composite expression tools for the MCP server.
 *
 * These tools create structured, multi-element diagrams on the canvas:
 * flowcharts, sequence diagrams, mind maps, reasoning chains,
 * wireframes, roadmaps, and kanban boards.
 *
 * @module
 */

import type {
  VisualExpression,
  FlowchartData,
  FlowNode,
  FlowEdge,
  SequenceDiagramData,
  Participant,
  Message,
  MindMapData,
  MindMapBranch,
  ReasoningChainData,
  ReasoningStep,
  WireframeData,
  WireframeComponent,
  RoadmapData,
  RoadmapPhase,
  RoadmapItem,
  KanbanData,
  KanbanColumn,
} from '@infinicanvas/protocol';
import { LAYOUT } from '../defaults.js';
import { buildExpression } from '../expressionFactory.js';
import type { IGatewayClient } from '../gatewayClient.js';

/**
 * Estimate flowchart size using dagre-compatible constants.
 *
 * Uses the same node width, height, separation, and padding values
 * as the renderer's dagre layout to produce a close approximation
 * of the final rendered size. [S5-1]
 */
function estimateFlowchartSize(
  nodeCount: number,
  direction: 'TB' | 'LR' | 'BT' | 'RL',
): { width: number; height: number } {
  // Match renderer constants for consistent sizing
  const NODE_WIDTH = 140;
  const NODE_HEIGHT = 50;
  const NODE_SEP = 50;
  const RANK_SEP = 60;
  const PADDING = 30;
  const TITLE_HEIGHT = 30;

  const isVertical = direction === 'TB' || direction === 'BT';
  const cols = isVertical ? Math.ceil(Math.sqrt(nodeCount)) : nodeCount;
  const rows = isVertical ? Math.ceil(nodeCount / Math.max(cols, 1)) : 1;

  const width = cols * NODE_WIDTH + Math.max(cols - 1, 0) * NODE_SEP + PADDING * 2;
  const height = rows * NODE_HEIGHT + Math.max(rows - 1, 0) * RANK_SEP + PADDING * 2 + TITLE_HEIGHT;

  return { width, height };
}

/** Estimate diagram size from node count using simple grid layout. */
function estimateDiagramSize(
  nodeCount: number,
  direction: 'TB' | 'LR' | 'BT' | 'RL' = 'TB',
): { width: number; height: number } {
  const cols = direction === 'TB' || direction === 'BT'
    ? Math.ceil(Math.sqrt(nodeCount))
    : nodeCount;
  const rows = direction === 'TB' || direction === 'BT'
    ? Math.ceil(nodeCount / cols)
    : 1;

  return {
    width: cols * LAYOUT.cellGapX + LAYOUT.padding * 2,
    height: rows * LAYOUT.cellGapY + LAYOUT.padding * 2,
  };
}

// ── Tool parameter types ───────────────────────────────────

export interface DrawFlowchartParams {
  title: string;
  nodes: { id: string; label: string; shape?: FlowNode['shape'] }[];
  edges: { from: string; to: string; label?: string }[];
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  x?: number;
  y?: number;
}

export interface DrawSequenceDiagramParams {
  title: string;
  participants: { id: string; name: string }[];
  messages: { from: string; to: string; label: string; type?: Message['type'] }[];
  x?: number;
  y?: number;
}

export interface DrawMindMapParams {
  centralTopic: string;
  branches: MindMapBranch[];
  x?: number;
  y?: number;
}

export interface DrawReasoningChainParams {
  question: string;
  steps: { title: string; content: string }[];
  finalAnswer: string;
  x?: number;
  y?: number;
}

export interface DrawWireframeParams {
  title: string;
  screenSize: { width: number; height: number };
  components: {
    type: WireframeComponent['type'];
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  x?: number;
  y?: number;
}

export interface DrawRoadmapParams {
  title: string;
  orientation?: RoadmapData['orientation'];
  phases: {
    id: string;
    name: string;
    items: { id: string; title: string; status: RoadmapItem['status'] }[];
  }[];
  x?: number;
  y?: number;
}

export interface DrawKanbanParams {
  title: string;
  columns: {
    id: string;
    title: string;
    cards: { id: string; title: string; description?: string }[];
  }[];
  x?: number;
  y?: number;
}

// ── Build functions ────────────────────────────────────────

/** Build a flowchart visual expression. */
export function buildFlowchart(params: DrawFlowchartParams): VisualExpression {
  if (params.nodes.length === 0) {
    throw new Error('Flowchart requires at least one node');
  }

  const direction = params.direction ?? 'TB';
  const nodes: FlowNode[] = params.nodes.map((n) => ({
    id: n.id,
    label: n.label,
    shape: n.shape ?? 'rect',
  }));

  const edges: FlowEdge[] = params.edges.map((e) => ({
    from: e.from,
    to: e.to,
    label: e.label,
  }));

  const data: FlowchartData = {
    kind: 'flowchart',
    title: params.title,
    nodes,
    edges,
    direction,
  };

  const size = estimateFlowchartSize(nodes.length, direction);
  const position = { x: params.x ?? 0, y: params.y ?? 0 };

  return buildExpression('flowchart', position, size, data);
}

/** Build a sequence diagram visual expression. */
export function buildSequenceDiagram(params: DrawSequenceDiagramParams): VisualExpression {
  if (params.participants.length === 0) {
    throw new Error('Sequence diagram requires at least one participant');
  }

  const participants: Participant[] = params.participants.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  const messages: Message[] = params.messages.map((m) => ({
    from: m.from,
    to: m.to,
    label: m.label,
    type: m.type ?? 'sync',
  }));

  const data: SequenceDiagramData = {
    kind: 'sequence-diagram',
    title: params.title,
    participants,
    messages,
  };

  const width = participants.length * LAYOUT.cellGapX + LAYOUT.padding * 2;
  const height = messages.length * LAYOUT.cellGapY + LAYOUT.padding * 2;
  const position = { x: params.x ?? 0, y: params.y ?? 0 };

  return buildExpression('sequence-diagram', position, { width, height }, data);
}

/** Count total nodes in a mind map branch tree. */
function countBranches(branches: MindMapBranch[]): number {
  let count = branches.length;
  for (const b of branches) {
    count += countBranches(b.children);
  }
  return count;
}

/** Build a mind map visual expression. */
export function buildMindMap(params: DrawMindMapParams): VisualExpression {
  if (params.branches.length === 0) {
    throw new Error('Mind map requires at least one branch');
  }

  const data: MindMapData = {
    kind: 'mind-map',
    centralTopic: params.centralTopic,
    branches: params.branches,
  };

  const totalNodes = countBranches(params.branches) + 1; // +1 for central topic
  const size = estimateDiagramSize(totalNodes);
  const position = { x: params.x ?? 0, y: params.y ?? 0 };

  return buildExpression('mind-map', position, size, data);
}

/** Build a reasoning chain visual expression. */
export function buildReasoningChain(params: DrawReasoningChainParams): VisualExpression {
  if (params.steps.length === 0) {
    throw new Error('Reasoning chain requires at least one step');
  }

  const steps: ReasoningStep[] = params.steps.map((s) => ({
    title: s.title,
    content: s.content,
  }));

  const data: ReasoningChainData = {
    kind: 'reasoning-chain',
    question: params.question,
    steps,
    finalAnswer: params.finalAnswer,
  };

  // Vertical layout: question → steps → answer
  const height = (steps.length + 2) * LAYOUT.cellGapY + LAYOUT.padding * 2;
  const width = LAYOUT.cellGapX * 2 + LAYOUT.padding * 2;
  const position = { x: params.x ?? 0, y: params.y ?? 0 };

  return buildExpression('reasoning-chain', position, { width, height }, data);
}

/** Build a wireframe visual expression. */
export function buildWireframe(params: DrawWireframeParams): VisualExpression {
  const components: WireframeComponent[] = params.components.map((c, i) => ({
    id: `comp-${i}`,
    type: c.type,
    label: c.label,
    x: c.x,
    y: c.y,
    width: c.width,
    height: c.height,
  }));

  const data: WireframeData = {
    kind: 'wireframe',
    title: params.title,
    screenSize: params.screenSize,
    components,
  };

  const position = { x: params.x ?? 0, y: params.y ?? 0 };

  return buildExpression(
    'wireframe',
    position,
    { width: params.screenSize.width, height: params.screenSize.height },
    data,
  );
}

/** Build a roadmap visual expression. */
export function buildRoadmap(params: DrawRoadmapParams): VisualExpression {
  if (params.phases.length === 0) {
    throw new Error('Roadmap requires at least one phase');
  }

  const orientation = params.orientation ?? 'horizontal';
  const phases: RoadmapPhase[] = params.phases.map((p) => ({
    id: p.id,
    name: p.name,
    items: p.items.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
    })),
  }));

  const data: RoadmapData = {
    kind: 'roadmap',
    title: params.title,
    orientation,
    phases,
  };

  const maxItems = Math.max(...phases.map((p) => p.items.length), 1);
  const width = orientation === 'horizontal'
    ? phases.length * LAYOUT.cellGapX + LAYOUT.padding * 2
    : LAYOUT.cellGapX * 2 + LAYOUT.padding * 2;
  const height = orientation === 'horizontal'
    ? maxItems * LAYOUT.cellGapY + LAYOUT.padding * 2
    : phases.length * LAYOUT.cellGapY + LAYOUT.padding * 2;

  const position = { x: params.x ?? 0, y: params.y ?? 0 };

  return buildExpression('roadmap', position, { width, height }, data);
}

/** Build a kanban board visual expression. */
export function buildKanban(params: DrawKanbanParams): VisualExpression {
  if (params.columns.length === 0) {
    throw new Error('Kanban board requires at least one column');
  }

  const columns: KanbanColumn[] = params.columns.map((col) => ({
    id: col.id,
    title: col.title,
    cards: col.cards.map((card) => ({
      id: card.id,
      title: card.title,
      description: card.description,
    })),
  }));

  const data: KanbanData = {
    kind: 'kanban',
    title: params.title,
    columns,
  };

  const maxCards = Math.max(...columns.map((c) => c.cards.length), 1);
  const width = columns.length * LAYOUT.cellGapX + LAYOUT.padding * 2;
  const height = maxCards * LAYOUT.cellGapY + LAYOUT.padding * 2;
  const position = { x: params.x ?? 0, y: params.y ?? 0 };

  return buildExpression('kanban', position, { width, height }, data);
}

// ── Tool executors — decompose into primitives ─────────────

import {
  buildRectangle,
  buildEllipse,
  buildText,
  buildArrow,
  buildStickyNote,
} from './primitiveTools.js';

/** Layout constants for primitive decomposition. */
const P = {
  nodeW: 140, nodeH: 50, nodeSep: 60, rankSep: 80, pad: 40,
  colW: 200, cardH: 40, cardGap: 10, headerH: 36,
  participantW: 100, participantH: 40, msgGap: 50, lifelineGap: 160,
  stepW: 300, stepH: 60, stepGap: 20,
  branchSpread: 200, branchRadial: 160,
};

const SHAPE_MAP: Record<string, string> = {
  rect: 'rectangle', diamond: 'diamond', ellipse: 'ellipse',
  parallelogram: 'rectangle', cylinder: 'rectangle',
};

/**
 * Compute arrow start/end points that exit from the correct edge of
 * each bounding box based on relative positions of the two objects.
 */
function smartArrowPoints(
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
): [number, number][] {
  const fromCx = from.x + from.width / 2;
  const fromCy = from.y + from.height / 2;
  const toCx = to.x + to.width / 2;
  const toCy = to.y + to.height / 2;

  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  let startX: number, startY: number, endX: number, endY: number;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection
    if (dx > 0) {
      startX = from.x + from.width; startY = fromCy;  // right edge
      endX = to.x; endY = toCy;                         // left edge
    } else {
      startX = from.x; startY = fromCy;                 // left edge
      endX = to.x + to.width; endY = toCy;              // right edge
    }
  } else {
    // Vertical connection
    if (dy > 0) {
      startX = fromCx; startY = from.y + from.height;   // bottom edge
      endX = toCx; endY = to.y;                          // top edge
    } else {
      startX = fromCx; startY = from.y;                  // top edge
      endX = toCx; endY = to.y + to.height;              // bottom edge
    }
  }

  return [[startX, startY], [endX, endY]];
}

export async function executeDrawFlowchart(
  client: IGatewayClient,
  params: DrawFlowchartParams,
): Promise<string> {
  const ox = params.x ?? 0, oy = params.y ?? 0;
  const dir = params.direction ?? 'TB';
  const isVert = dir === 'TB' || dir === 'BT';
  const ids = new Map<string, { cx: number; cy: number }>();

  // Title
  const titleExpr = buildText({ x: ox, y: oy, text: params.title, fontSize: 18, fontFamily: 'sans-serif', textAlign: 'left' });
  await client.sendCreate(titleExpr);

  // Layout nodes in grid
  const cols = isVert ? Math.ceil(Math.sqrt(params.nodes.length)) : params.nodes.length;
  params.nodes.forEach((node, i) => {
    const col = isVert ? i % cols : i;
    const row = isVert ? Math.floor(i / cols) : 0;
    const cx = ox + P.pad + col * (P.nodeW + P.nodeSep) + P.nodeW / 2;
    const cy = oy + P.pad + 30 + row * (P.nodeH + P.rankSep) + P.nodeH / 2;
    ids.set(node.id, { cx, cy });
  });

  // Create nodes
  for (const node of params.nodes) {
    const pos = ids.get(node.id)!;
    const kind = SHAPE_MAP[node.shape ?? 'rect'] ?? 'rectangle';
    const expr = buildExpression(
      kind as VisualExpression['kind'],
      { x: pos.cx - P.nodeW / 2, y: pos.cy - P.nodeH / 2 },
      { width: P.nodeW, height: P.nodeH },
      { kind, label: node.label } as VisualExpression['data'],
    );
    await client.sendCreate(expr);
  }

  // Create edges as arrows
  for (const edge of params.edges) {
    const from = ids.get(edge.from);
    const to = ids.get(edge.to);
    if (!from || !to) continue;
    const fromRect = { x: from.cx - P.nodeW / 2, y: from.cy - P.nodeH / 2, width: P.nodeW, height: P.nodeH };
    const toRect = { x: to.cx - P.nodeW / 2, y: to.cy - P.nodeH / 2, width: P.nodeW, height: P.nodeH };
    const pts = smartArrowPoints(fromRect, toRect);
    const arrow = buildArrow({
      points: pts,
      endArrowhead: true, label: edge.label,
    });
    await client.sendCreate(arrow);
  }

  return `Created flowchart '${params.title}' with ${params.nodes.length} nodes and ${params.edges.length} edges (primitives)`;
}

export async function executeDrawSequenceDiagram(
  client: IGatewayClient,
  params: DrawSequenceDiagramParams,
): Promise<string> {
  const ox = params.x ?? 0, oy = params.y ?? 0;

  // Title
  await client.sendCreate(buildText({ x: ox, y: oy, text: params.title, fontSize: 18, fontFamily: 'sans-serif', textAlign: 'left' }));

  // Participants
  const pMap = new Map<string, number>();
  for (let i = 0; i < params.participants.length; i++) {
    const p = params.participants[i]!;
    const cx = ox + i * P.lifelineGap + P.participantW / 2;
    pMap.set(p.id, cx);
    const expr = buildRectangle({ x: cx - P.participantW / 2, y: oy + 30, width: P.participantW, height: P.participantH, label: p.name, backgroundColor: '#e3f2fd', fillStyle: 'solid' });
    await client.sendCreate(expr);
  }

  // Messages as arrows
  const lastMsgY = oy + 30 + P.participantH + 30 + (params.messages.length - 1) * P.msgGap;
  for (let i = 0; i < params.messages.length; i++) {
    const msg = params.messages[i]!;
    const fromX = pMap.get(msg.from) ?? ox;
    const toX = pMap.get(msg.to) ?? ox + 100;
    const y = oy + 30 + P.participantH + 30 + i * P.msgGap;
    const lifeW = 4;
    const fromRect = { x: fromX - lifeW / 2, y: y - lifeW / 2, width: lifeW, height: lifeW };
    const toRect = { x: toX - lifeW / 2, y: y - lifeW / 2, width: lifeW, height: lifeW };
    const pts = smartArrowPoints(fromRect, toRect);

    if (msg.type === 'reply') {
      const expr = buildExpression(
        'arrow',
        { x: Math.min(fromX, toX), y: y - 10 },
        { width: Math.abs(toX - fromX), height: 20 },
        { kind: 'arrow', points: pts, startArrowhead: 'none', endArrowhead: 'triangle', label: msg.label } as VisualExpression['data'],
        { strokeStyle: 'dashed' as const },
      );
      await client.sendCreate(expr);
    } else {
      const arrow = buildArrow({ points: pts, endArrowhead: true, label: msg.label });
      await client.sendCreate(arrow);
    }
  }

  // Lifelines — vertical dashed lines from participant bottom to below last message
  const lifelineEnd = lastMsgY + 40;
  for (const [, cx] of pMap) {
    const lineStart = oy + 30 + P.participantH;
    const pts: [number, number][] = [[cx, lineStart], [cx, lifelineEnd]];
    const expr = buildExpression(
      'arrow',
      { x: cx, y: lineStart },
      { width: 1, height: lifelineEnd - lineStart },
      { kind: 'arrow', points: pts, startArrowhead: 'none', endArrowhead: 'none' } as VisualExpression['data'],
      { strokeStyle: 'dashed' as const, strokeColor: '#888888', strokeWidth: 1 },
    );
    await client.sendCreate(expr);
  }

  return `Created sequence diagram '${params.title}' with ${params.participants.length} participants and ${params.messages.length} messages (primitives)`;
}

export async function executeDrawMindMap(
  client: IGatewayClient,
  params: DrawMindMapParams,
): Promise<string> {
  const ox = params.x ?? 0, oy = params.y ?? 0;

  // Central topic
  const centerW = 120, centerH = 50;
  const center = buildEllipse({ x: ox - centerW / 2, y: oy - centerH / 2, width: centerW, height: centerH, label: params.centralTopic });
  await client.sendCreate(center);

  // Branches radially
  const angleStep = (2 * Math.PI) / Math.max(params.branches.length, 1);
  let branchCount = 0;
  const branchW = 120, branchH = 36;

  async function layoutBranch(
    branch: MindMapBranch,
    cx: number, cy: number,
    angle: number, depth: number,
    parentRect: { x: number; y: number; width: number; height: number },
  ) {
    const bx = cx + Math.cos(angle) * (P.branchRadial + depth * 80);
    const by = cy + Math.sin(angle) * (P.branchRadial + depth * 80);
    const rect = buildRectangle({ x: bx - branchW / 2, y: by - branchH / 2, width: branchW, height: branchH, label: branch.label, backgroundColor: '#fff9c4', fillStyle: 'solid' });
    await client.sendCreate(rect);
    const childRect = { x: bx - branchW / 2, y: by - branchH / 2, width: branchW, height: branchH };
    const pts = smartArrowPoints(parentRect, childRect);
    const line = buildArrow({ points: pts });
    await client.sendCreate(line);
    branchCount++;

    if (branch.children) {
      const childAngleSpread = 0.4;
      for (let i = 0; i < branch.children.length; i++) {
        const child = branch.children[i]!;
        const childAngle = angle + (i - (branch.children.length - 1) / 2) * childAngleSpread;
        await layoutBranch(child, bx, by, childAngle, depth + 1, childRect);
      }
    }
  }

  const centerRect = { x: ox - centerW / 2, y: oy - centerH / 2, width: centerW, height: centerH };
  for (let i = 0; i < params.branches.length; i++) {
    const branch = params.branches[i]!;
    await layoutBranch(branch, ox, oy, i * angleStep - Math.PI / 2, 0, centerRect);
  }

  return `Created mind map '${params.centralTopic}' with ${branchCount} branches (primitives)`;
}

export async function executeDrawReasoningChain(
  client: IGatewayClient,
  params: DrawReasoningChainParams,
): Promise<string> {
  const ox = params.x ?? 0, oy = params.y ?? 0;

  // Question
  const q = buildRectangle({ x: ox, y: oy, width: P.stepW, height: P.stepH, label: params.question, backgroundColor: '#e3f2fd', fillStyle: 'solid' });
  await client.sendCreate(q);

  // Steps
  let cy = oy + P.stepH;
  for (const step of params.steps) {
    const fromRect = { x: ox, y: cy - P.stepH, width: P.stepW, height: P.stepH };
    const toRect = { x: ox, y: cy + P.stepGap, width: P.stepW, height: P.stepH };
    const pts = smartArrowPoints(fromRect, toRect);
    const arrow = buildArrow({ points: pts, endArrowhead: true });
    await client.sendCreate(arrow);
    cy += P.stepGap;
    const rect = buildRectangle({ x: ox, y: cy, width: P.stepW, height: P.stepH, label: `${step.title}: ${step.content}` });
    await client.sendCreate(rect);
    cy += P.stepH;
  }

  // Final answer
  const fromRect = { x: ox, y: cy - P.stepH, width: P.stepW, height: P.stepH };
  const toRect = { x: ox, y: cy + P.stepGap, width: P.stepW, height: P.stepH };
  const finalPts = smartArrowPoints(fromRect, toRect);
  const arrow = buildArrow({ points: finalPts, endArrowhead: true });
  await client.sendCreate(arrow);
  cy += P.stepGap;
  const ans = buildRectangle({ x: ox, y: cy, width: P.stepW, height: P.stepH, label: params.finalAnswer, backgroundColor: '#c8e6c9', fillStyle: 'solid' });
  await client.sendCreate(ans);

  return `Created reasoning chain '${params.question}' with ${params.steps.length} steps (primitives)`;
}

export async function executeDrawWireframe(
  client: IGatewayClient,
  params: DrawWireframeParams,
): Promise<string> {
  const ox = params.x ?? 0, oy = params.y ?? 0;

  // Screen frame
  const frame = buildRectangle({ x: ox, y: oy, width: params.screenSize.width, height: params.screenSize.height, label: params.title });
  await client.sendCreate(frame);

  // Components as rectangles with labels
  for (const comp of params.components) {
    const rect = buildRectangle({
      x: ox + comp.x, y: oy + comp.y,
      width: comp.width, height: comp.height,
      label: `[${comp.type}] ${comp.label}`,
      backgroundColor: '#f5f5f5', fillStyle: 'solid',
    });
    await client.sendCreate(rect);
  }

  return `Created wireframe '${params.title}' with ${params.components.length} components (primitives)`;
}

export async function executeDrawRoadmap(
  client: IGatewayClient,
  params: DrawRoadmapParams,
): Promise<string> {
  const ox = params.x ?? 0, oy = params.y ?? 0;
  const isHoriz = (params.orientation ?? 'horizontal') === 'horizontal';

  // Title
  await client.sendCreate(buildText({ x: ox, y: oy, text: params.title, fontSize: 18, fontFamily: 'sans-serif', textAlign: 'left' }));

  const statusColors: Record<string, string> = { done: '#c8e6c9', 'in-progress': '#fff9c4', planned: '#f5f5f5' };

  for (let pi = 0; pi < params.phases.length; pi++) {
    const phase = params.phases[pi]!;
    const px = isHoriz ? ox + pi * (P.colW + 20) : ox;
    const py = isHoriz ? oy + 30 : oy + 30 + pi * 200;

    // Phase header
    const header = buildRectangle({ x: px, y: py, width: P.colW, height: P.headerH, label: phase.name, backgroundColor: '#e3f2fd', fillStyle: 'solid' });
    await client.sendCreate(header);

    // Items
    for (let ii = 0; ii < phase.items.length; ii++) {
      const item = phase.items[ii]!;
      const iy = py + P.headerH + 10 + ii * (P.cardH + P.cardGap);
      const card = buildRectangle({
        x: px + 10, y: iy, width: P.colW - 20, height: P.cardH,
        label: item.title, backgroundColor: statusColors[item.status] ?? '#f5f5f5', fillStyle: 'solid',
      });
      await client.sendCreate(card);
    }
  }

  const totalItems = params.phases.reduce((s, p) => s + p.items.length, 0);
  return `Created roadmap '${params.title}' with ${params.phases.length} phases and ${totalItems} items (primitives)`;
}

export async function executeDrawKanban(
  client: IGatewayClient,
  params: DrawKanbanParams,
): Promise<string> {
  const ox = params.x ?? 0, oy = params.y ?? 0;

  // Title
  await client.sendCreate(buildText({ x: ox, y: oy, text: params.title, fontSize: 18, fontFamily: 'sans-serif', textAlign: 'left' }));

  for (let ci = 0; ci < params.columns.length; ci++) {
    const col = params.columns[ci]!;
    const cx = ox + ci * (P.colW + 20);
    const cy = oy + 30;

    // Column header
    const header = buildRectangle({ x: cx, y: cy, width: P.colW, height: P.headerH, label: col.title, backgroundColor: '#e3f2fd', fillStyle: 'solid' });
    await client.sendCreate(header);

    // Cards
    for (let ii = 0; ii < col.cards.length; ii++) {
      const card = col.cards[ii]!;
      const iy = cy + P.headerH + 10 + ii * (P.cardH + P.cardGap);
      const cardExpr = buildStickyNote({
        x: cx + 10, y: iy, width: P.colW - 20, height: P.cardH,
        text: card.description ? `${card.title}\n${card.description}` : card.title,
      });
      await client.sendCreate(cardExpr);
    }
  }

  const totalCards = params.columns.reduce((s, c) => s + c.cards.length, 0);
  return `Created kanban '${params.title}' with ${params.columns.length} columns and ${totalCards} cards (primitives)`;
}
