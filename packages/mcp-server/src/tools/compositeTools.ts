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

  const size = estimateDiagramSize(nodes.length, direction);
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

// ── Tool executors (send to gateway) ───────────────────────

export async function executeDrawFlowchart(
  client: IGatewayClient,
  params: DrawFlowchartParams,
): Promise<string> {
  const expr = buildFlowchart(params);
  await client.sendCreate(expr);
  return `Created flowchart '${params.title}' with ${params.nodes.length} nodes and ${params.edges.length} edges [id: ${expr.id}]`;
}

export async function executeDrawSequenceDiagram(
  client: IGatewayClient,
  params: DrawSequenceDiagramParams,
): Promise<string> {
  const expr = buildSequenceDiagram(params);
  await client.sendCreate(expr);
  return `Created sequence diagram '${params.title}' with ${params.participants.length} participants and ${params.messages.length} messages [id: ${expr.id}]`;
}

export async function executeDrawMindMap(
  client: IGatewayClient,
  params: DrawMindMapParams,
): Promise<string> {
  const expr = buildMindMap(params);
  await client.sendCreate(expr);
  return `Created mind map '${params.centralTopic}' with ${params.branches.length} branches [id: ${expr.id}]`;
}

export async function executeDrawReasoningChain(
  client: IGatewayClient,
  params: DrawReasoningChainParams,
): Promise<string> {
  const expr = buildReasoningChain(params);
  await client.sendCreate(expr);
  return `Created reasoning chain '${params.question}' with ${params.steps.length} steps [id: ${expr.id}]`;
}

export async function executeDrawWireframe(
  client: IGatewayClient,
  params: DrawWireframeParams,
): Promise<string> {
  const expr = buildWireframe(params);
  await client.sendCreate(expr);
  return `Created wireframe '${params.title}' (${params.screenSize.width}×${params.screenSize.height}) with ${params.components.length} components [id: ${expr.id}]`;
}

export async function executeDrawRoadmap(
  client: IGatewayClient,
  params: DrawRoadmapParams,
): Promise<string> {
  const expr = buildRoadmap(params);
  await client.sendCreate(expr);
  const totalItems = params.phases.reduce((sum, p) => sum + p.items.length, 0);
  return `Created roadmap '${params.title}' with ${params.phases.length} phases and ${totalItems} items [id: ${expr.id}]`;
}

export async function executeDrawKanban(
  client: IGatewayClient,
  params: DrawKanbanParams,
): Promise<string> {
  const expr = buildKanban(params);
  await client.sendCreate(expr);
  const totalCards = params.columns.reduce((sum, c) => sum + c.cards.length, 0);
  return `Created kanban board '${params.title}' with ${params.columns.length} columns and ${totalCards} cards [id: ${expr.id}]`;
}
