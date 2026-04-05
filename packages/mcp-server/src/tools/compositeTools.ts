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
  createExcalidrawRectangle,
  createExcalidrawEllipse,
  createExcalidrawDiamond,
  createExcalidrawArrow,
  createExcalidrawLine,
  createExcalidrawText,
} from './excalidrawBuilder.js';

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
): [[number, number], [number, number]] {
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

/** Create a labeled Excalidraw rectangle (rect + bound text elements). */
function excalidrawLabeledRect(params: {
  x: number; y: number; width: number; height: number;
  label: string; backgroundColor?: string; strokeColor?: string;
}): Record<string, unknown>[] {
  const rect = createExcalidrawRectangle(params);
  const text = createExcalidrawText({
    x: params.x + params.width / 2 - 50,
    y: params.y + params.height / 2 - 12,
    text: params.label,
    containerId: rect.id as string,
  });
  (rect as Record<string, unknown>).boundElements = [{ id: text.id, type: 'text' }];
  return [rect, text];
}

/** Create a labeled Excalidraw ellipse (ellipse + bound text elements). */
function excalidrawLabeledEllipse(params: {
  x: number; y: number; width: number; height: number;
  label: string; backgroundColor?: string;
}): Record<string, unknown>[] {
  const ellipse = createExcalidrawEllipse(params);
  const text = createExcalidrawText({
    x: params.x + params.width / 2 - 50,
    y: params.y + params.height / 2 - 12,
    text: params.label,
    containerId: ellipse.id as string,
  });
  (ellipse as Record<string, unknown>).boundElements = [{ id: text.id, type: 'text' }];
  return [ellipse, text];
}

/** Create a labeled Excalidraw diamond (diamond + bound text elements). */
function excalidrawLabeledDiamond(params: {
  x: number; y: number; width: number; height: number;
  label: string; backgroundColor?: string;
}): Record<string, unknown>[] {
  const diamond = createExcalidrawDiamond(params);
  const text = createExcalidrawText({
    x: params.x + params.width / 2 - 50,
    y: params.y + params.height / 2 - 12,
    text: params.label,
    containerId: diamond.id as string,
  });
  (diamond as Record<string, unknown>).boundElements = [{ id: text.id, type: 'text' }];
  return [diamond, text];
}

export async function executeDrawFlowchart(
  client: IGatewayClient,
  params: DrawFlowchartParams,
): Promise<string> {
  const ox = params.x ?? 0, oy = params.y ?? 0;
  const dir = params.direction ?? 'TB';
  const isVert = dir === 'TB' || dir === 'BT';
  const ids = new Map<string, { cx: number; cy: number }>();
  const newElements: Record<string, unknown>[] = [];

  // Title
  const titleEl = createExcalidrawText({
    x: ox, y: oy, text: params.title, fontSize: 18,
    width: Math.max(params.title.length * 18 * 0.6, 100), height: 27,
  });
  newElements.push(titleEl);

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
    const shape = SHAPE_MAP[node.shape ?? 'rect'] ?? 'rectangle';
    const nodeParams = {
      x: pos.cx - P.nodeW / 2, y: pos.cy - P.nodeH / 2,
      width: P.nodeW, height: P.nodeH, label: node.label,
    };
    if (shape === 'ellipse') {
      newElements.push(...excalidrawLabeledEllipse(nodeParams));
    } else if (shape === 'diamond') {
      newElements.push(...excalidrawLabeledDiamond(nodeParams));
    } else {
      newElements.push(...excalidrawLabeledRect(nodeParams));
    }
  }

  // Create edges as arrows
  for (const edge of params.edges) {
    const from = ids.get(edge.from);
    const to = ids.get(edge.to);
    if (!from || !to) continue;
    const fromRect = { x: from.cx - P.nodeW / 2, y: from.cy - P.nodeH / 2, width: P.nodeW, height: P.nodeH };
    const toRect = { x: to.cx - P.nodeW / 2, y: to.cy - P.nodeH / 2, width: P.nodeW, height: P.nodeH };
    const pts = smartArrowPoints(fromRect, toRect);
    const arrow = createExcalidrawArrow({
      startX: pts[0][0], startY: pts[0][1],
      endX: pts[1][0], endY: pts[1][1],
      label: edge.label,
    });
    newElements.push(arrow);
  }

  await client.sendSceneUpdate([...client.getExcalidrawElements(), ...newElements]);
  return `Created flowchart '${params.title}' with ${params.nodes.length} nodes and ${params.edges.length} edges`;
}

export async function executeDrawSequenceDiagram(
  client: IGatewayClient,
  params: DrawSequenceDiagramParams,
): Promise<string> {
  const ox = params.x ?? 0, oy = params.y ?? 0;
  const newElements: Record<string, unknown>[] = [];

  // Title
  newElements.push(createExcalidrawText({
    x: ox, y: oy, text: params.title, fontSize: 18,
    width: Math.max(params.title.length * 18 * 0.6, 100), height: 27,
  }));

  // Participants
  const pMap = new Map<string, number>();
  params.participants.forEach((p, i) => {
    const cx = ox + i * P.lifelineGap + P.participantW / 2;
    pMap.set(p.id, cx);
    newElements.push(...excalidrawLabeledRect({
      x: cx - P.participantW / 2, y: oy + 30,
      width: P.participantW, height: P.participantH,
      label: p.name, backgroundColor: '#e3f2fd',
    }));
  });

  // Messages as arrows
  const lastMsgY = oy + 30 + P.participantH + 30 + (params.messages.length - 1) * P.msgGap;
  params.messages.forEach((msg, i) => {
    const fromX = pMap.get(msg.from) ?? ox;
    const toX = pMap.get(msg.to) ?? ox + 100;
    const y = oy + 30 + P.participantH + 30 + i * P.msgGap;
    const lifeW = 4;
    const fromRect = { x: fromX - lifeW / 2, y: y - lifeW / 2, width: lifeW, height: lifeW };
    const toRect = { x: toX - lifeW / 2, y: y - lifeW / 2, width: lifeW, height: lifeW };
    const pts = smartArrowPoints(fromRect, toRect);
    const arrow = createExcalidrawArrow({
      startX: pts[0][0], startY: pts[0][1],
      endX: pts[1][0], endY: pts[1][1],
      label: msg.label,
    });
    newElements.push(arrow);
  });

  // Lifelines — vertical dashed lines from participant bottom to below last message
  const lifelineEnd = lastMsgY + 40;
  for (const [, cx] of pMap) {
    const lineStart = oy + 30 + P.participantH;
    const line = createExcalidrawLine({
      points: [[cx, lineStart], [cx, lifelineEnd]],
    });
    newElements.push(line);
  }

  await client.sendSceneUpdate([...client.getExcalidrawElements(), ...newElements]);
  return `Created sequence diagram '${params.title}' with ${params.participants.length} participants and ${params.messages.length} messages`;
}

export async function executeDrawMindMap(
  client: IGatewayClient,
  params: DrawMindMapParams,
): Promise<string> {
  const ox = params.x ?? 0, oy = params.y ?? 0;
  const newElements: Record<string, unknown>[] = [];

  // Central topic
  const centerW = 120, centerH = 50;
  newElements.push(...excalidrawLabeledEllipse({
    x: ox - centerW / 2, y: oy - centerH / 2,
    width: centerW, height: centerH, label: params.centralTopic,
  }));

  // Branches radially
  const angleStep = (2 * Math.PI) / Math.max(params.branches.length, 1);
  let branchCount = 0;
  const branchW = 120, branchH = 36;

  function layoutBranch(
    branch: MindMapBranch,
    cx: number, cy: number,
    angle: number, depth: number,
    parentRect: { x: number; y: number; width: number; height: number },
  ) {
    const bx = cx + Math.cos(angle) * (P.branchRadial + depth * 80);
    const by = cy + Math.sin(angle) * (P.branchRadial + depth * 80);
    newElements.push(...excalidrawLabeledRect({
      x: bx - branchW / 2, y: by - branchH / 2,
      width: branchW, height: branchH,
      label: branch.label, backgroundColor: '#fff9c4',
    }));
    const childRect = { x: bx - branchW / 2, y: by - branchH / 2, width: branchW, height: branchH };
    const pts = smartArrowPoints(parentRect, childRect);
    newElements.push(createExcalidrawArrow({
      startX: pts[0][0], startY: pts[0][1],
      endX: pts[1][0], endY: pts[1][1],
    }));
    branchCount++;

    if (branch.children) {
      const childAngleSpread = 0.4;
      branch.children.forEach((child, i) => {
        const childAngle = angle + (i - (branch.children.length - 1) / 2) * childAngleSpread;
        layoutBranch(child, bx, by, childAngle, depth + 1, childRect);
      });
    }
  }

  const centerRect = { x: ox - centerW / 2, y: oy - centerH / 2, width: centerW, height: centerH };
  params.branches.forEach((branch, i) => {
    layoutBranch(branch, ox, oy, i * angleStep - Math.PI / 2, 0, centerRect);
  });

  await client.sendSceneUpdate([...client.getExcalidrawElements(), ...newElements]);
  return `Created mind map '${params.centralTopic}' with ${branchCount} branches`;
}

export async function executeDrawReasoningChain(
  client: IGatewayClient,
  params: DrawReasoningChainParams,
): Promise<string> {
  const ox = params.x ?? 0, oy = params.y ?? 0;
  const newElements: Record<string, unknown>[] = [];

  // Question
  newElements.push(...excalidrawLabeledRect({
    x: ox, y: oy, width: P.stepW, height: P.stepH,
    label: params.question, backgroundColor: '#e3f2fd',
  }));

  // Steps
  let cy = oy + P.stepH;
  for (const step of params.steps) {
    const fromRect = { x: ox, y: cy - P.stepH, width: P.stepW, height: P.stepH };
    const toRect = { x: ox, y: cy + P.stepGap, width: P.stepW, height: P.stepH };
    const pts = smartArrowPoints(fromRect, toRect);
    newElements.push(createExcalidrawArrow({
      startX: pts[0][0], startY: pts[0][1],
      endX: pts[1][0], endY: pts[1][1],
    }));
    cy += P.stepGap;
    newElements.push(...excalidrawLabeledRect({
      x: ox, y: cy, width: P.stepW, height: P.stepH,
      label: `${step.title}: ${step.content}`,
    }));
    cy += P.stepH;
  }

  // Final answer
  const fromRect = { x: ox, y: cy - P.stepH, width: P.stepW, height: P.stepH };
  const toRect = { x: ox, y: cy + P.stepGap, width: P.stepW, height: P.stepH };
  const finalPts = smartArrowPoints(fromRect, toRect);
  newElements.push(createExcalidrawArrow({
    startX: finalPts[0][0], startY: finalPts[0][1],
    endX: finalPts[1][0], endY: finalPts[1][1],
  }));
  cy += P.stepGap;
  newElements.push(...excalidrawLabeledRect({
    x: ox, y: cy, width: P.stepW, height: P.stepH,
    label: params.finalAnswer, backgroundColor: '#c8e6c9',
  }));

  await client.sendSceneUpdate([...client.getExcalidrawElements(), ...newElements]);
  return `Created reasoning chain '${params.question}' with ${params.steps.length} steps`;
}

export async function executeDrawWireframe(
  client: IGatewayClient,
  params: DrawWireframeParams,
): Promise<string> {
  const ox = params.x ?? 0, oy = params.y ?? 0;
  const newElements: Record<string, unknown>[] = [];

  // Screen frame
  newElements.push(...excalidrawLabeledRect({
    x: ox, y: oy,
    width: params.screenSize.width, height: params.screenSize.height,
    label: params.title,
  }));

  // Components as rectangles with labels
  for (const comp of params.components) {
    newElements.push(...excalidrawLabeledRect({
      x: ox + comp.x, y: oy + comp.y,
      width: comp.width, height: comp.height,
      label: `[${comp.type}] ${comp.label}`,
      backgroundColor: '#f5f5f5',
    }));
  }

  await client.sendSceneUpdate([...client.getExcalidrawElements(), ...newElements]);
  return `Created wireframe '${params.title}' with ${params.components.length} components`;
}

export async function executeDrawRoadmap(
  client: IGatewayClient,
  params: DrawRoadmapParams,
): Promise<string> {
  const ox = params.x ?? 0, oy = params.y ?? 0;
  const isHoriz = (params.orientation ?? 'horizontal') === 'horizontal';
  const newElements: Record<string, unknown>[] = [];

  // Title
  newElements.push(createExcalidrawText({
    x: ox, y: oy, text: params.title, fontSize: 18,
    width: Math.max(params.title.length * 18 * 0.6, 100), height: 27,
  }));

  const statusColors: Record<string, string> = { done: '#c8e6c9', 'in-progress': '#fff9c4', planned: '#f5f5f5' };

  params.phases.forEach((phase, pi) => {
    const px = isHoriz ? ox + pi * (P.colW + 20) : ox;
    const py = isHoriz ? oy + 30 : oy + 30 + pi * 200;

    // Phase header
    newElements.push(...excalidrawLabeledRect({
      x: px, y: py, width: P.colW, height: P.headerH,
      label: phase.name, backgroundColor: '#e3f2fd',
    }));

    // Items
    phase.items.forEach((item, ii) => {
      const iy = py + P.headerH + 10 + ii * (P.cardH + P.cardGap);
      newElements.push(...excalidrawLabeledRect({
        x: px + 10, y: iy, width: P.colW - 20, height: P.cardH,
        label: item.title, backgroundColor: statusColors[item.status] ?? '#f5f5f5',
      }));
    });
  });

  await client.sendSceneUpdate([...client.getExcalidrawElements(), ...newElements]);
  const totalItems = params.phases.reduce((s, p) => s + p.items.length, 0);
  return `Created roadmap '${params.title}' with ${params.phases.length} phases and ${totalItems} items`;
}

export async function executeDrawKanban(
  client: IGatewayClient,
  params: DrawKanbanParams,
): Promise<string> {
  const ox = params.x ?? 0, oy = params.y ?? 0;
  const newElements: Record<string, unknown>[] = [];

  // Title
  newElements.push(createExcalidrawText({
    x: ox, y: oy, text: params.title, fontSize: 18,
    width: Math.max(params.title.length * 18 * 0.6, 100), height: 27,
  }));

  params.columns.forEach((col, ci) => {
    const cx = ox + ci * (P.colW + 20);
    const cy = oy + 30;

    // Column header
    newElements.push(...excalidrawLabeledRect({
      x: cx, y: cy, width: P.colW, height: P.headerH,
      label: col.title, backgroundColor: '#e3f2fd',
    }));

    // Cards as colored rectangles with text (sticky-note style)
    col.cards.forEach((card, ii) => {
      const iy = cy + P.headerH + 10 + ii * (P.cardH + P.cardGap);
      const cardText = card.description ? `${card.title}\n${card.description}` : card.title;
      const cardRect = createExcalidrawRectangle({
        x: cx + 10, y: iy, width: P.colW - 20, height: P.cardH,
        backgroundColor: '#FFF9C4', strokeColor: '#1e1e1e',
      });
      const cardTextEl = createExcalidrawText({
        x: cx + 10 + (P.colW - 20) / 2 - 50,
        y: iy + P.cardH / 2 - 12,
        text: cardText,
        containerId: cardRect.id as string,
      });
      (cardRect as Record<string, unknown>).boundElements = [{ id: cardTextEl.id, type: 'text' }];
      newElements.push(cardRect, cardTextEl);
    });
  });

  await client.sendSceneUpdate([...client.getExcalidrawElements(), ...newElements]);
  const totalCards = params.columns.reduce((s, c) => s + c.cards.length, 0);
  return `Created kanban '${params.title}' with ${params.columns.length} columns and ${totalCards} cards`;
}
