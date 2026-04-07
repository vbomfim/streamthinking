/**
 * Tests for composite expression tools.
 *
 * Verifies that each composite tool builds correct VisualExpression
 * objects with proper data payloads and sizing.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VisualExpression, FlowchartData, SequenceDiagramData, MindMapData, ReasoningChainData, WireframeData, RoadmapData, KanbanData } from '@infinicanvas/protocol';
import type { IGatewayClient } from '../gatewayClient.js';
import {
  buildFlowchart,
  buildSequenceDiagram,
  buildMindMap,
  buildReasoningChain,
  buildWireframe,
  buildRoadmap,
  buildKanban,
  executeDrawFlowchart,
  executeDrawSequenceDiagram,
  executeDrawMindMap,
  executeDrawReasoningChain,
  executeDrawWireframe,
  executeDrawRoadmap,
  executeDrawKanban,
} from '../tools/compositeTools.js';

// ── Mock gateway client ────────────────────────────────────

function createMockClient(): IGatewayClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    getSessionId: vi.fn().mockReturnValue('test-session'),
    sendCreate: vi.fn().mockResolvedValue(undefined),
    sendBatchCreate: vi.fn().mockResolvedValue(undefined),
    sendDelete: vi.fn().mockResolvedValue(undefined),
    sendMorph: vi.fn().mockResolvedValue(undefined),
    sendStyle: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockReturnValue([]),
  };
}

// ── Flowchart ──────────────────────────────────────────────

describe('buildFlowchart', () => {
  it('creates a flowchart with nodes and edges', () => {
    const expr = buildFlowchart({
      title: 'Auth Flow',
      nodes: [
        { id: 'start', label: 'Start' },
        { id: 'login', label: 'Login' },
        { id: 'end', label: 'End' },
      ],
      edges: [
        { from: 'start', to: 'login' },
        { from: 'login', to: 'end', label: 'success' },
      ],
    });

    expect(expr.kind).toBe('flowchart');
    const data = expr.data as FlowchartData;
    expect(data.title).toBe('Auth Flow');
    expect(data.nodes).toHaveLength(3);
    expect(data.edges).toHaveLength(2);
    expect(data.direction).toBe('TB');
  });

  it('applies default rect shape to nodes without shape', () => {
    const expr = buildFlowchart({
      title: 'Test',
      nodes: [{ id: 'n1', label: 'Node' }],
      edges: [],
    });

    const data = expr.data as FlowchartData;
    expect(data.nodes[0]!.shape).toBe('rect');
  });

  it('preserves custom node shapes', () => {
    const expr = buildFlowchart({
      title: 'Test',
      nodes: [
        { id: 'n1', label: 'Decision', shape: 'diamond' },
        { id: 'n2', label: 'Start', shape: 'ellipse' },
      ],
      edges: [],
    });

    const data = expr.data as FlowchartData;
    expect(data.nodes[0]!.shape).toBe('diamond');
    expect(data.nodes[1]!.shape).toBe('ellipse');
  });

  it('uses custom direction', () => {
    const expr = buildFlowchart({
      title: 'LR Flow',
      nodes: [{ id: 'n1', label: 'A' }],
      edges: [],
      direction: 'LR',
    });

    const data = expr.data as FlowchartData;
    expect(data.direction).toBe('LR');
  });

  it('positions at custom coordinates', () => {
    const expr = buildFlowchart({
      title: 'Test',
      nodes: [{ id: 'n1', label: 'A' }],
      edges: [],
      x: 500,
      y: 300,
    });

    expect(expr.position).toEqual({ x: 500, y: 300 });
  });

  it('throws error when no nodes provided', () => {
    expect(() => buildFlowchart({
      title: 'Empty',
      nodes: [],
      edges: [],
    })).toThrow('Flowchart requires at least one node');
  });

  it('calculates size based on node count', () => {
    const small = buildFlowchart({
      title: 'Small',
      nodes: [{ id: 'n1', label: 'A' }],
      edges: [],
    });
    const large = buildFlowchart({
      title: 'Large',
      nodes: Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, label: `Node ${i}` })),
      edges: [],
    });

    expect(large.size.width).toBeGreaterThan(small.size.width);
    expect(large.size.height).toBeGreaterThan(small.size.height);
  });
});

describe('executeDrawFlowchart', () => {
  it('sends create and returns confirmation message', async () => {
    const client = createMockClient();
    const result = await executeDrawFlowchart(client, {
      title: 'Test Flow',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });

    expect(client.sendCreate).toHaveBeenCalled();
    expect(result).toContain("'Test Flow'");
    expect(result).toContain('2 nodes');
    expect(result).toContain('1 edges');
  });
});

// ── Sequence Diagram ───────────────────────────────────────

describe('buildSequenceDiagram', () => {
  it('creates a sequence diagram with participants and messages', () => {
    const expr = buildSequenceDiagram({
      title: 'Login Sequence',
      participants: [
        { id: 'client', name: 'Client' },
        { id: 'server', name: 'Server' },
      ],
      messages: [
        { from: 'client', to: 'server', label: 'POST /login' },
        { from: 'server', to: 'client', label: '200 OK', type: 'reply' },
      ],
    });

    expect(expr.kind).toBe('sequence-diagram');
    const data = expr.data as SequenceDiagramData;
    expect(data.title).toBe('Login Sequence');
    expect(data.participants).toHaveLength(2);
    expect(data.messages).toHaveLength(2);
  });

  it('defaults message type to sync', () => {
    const expr = buildSequenceDiagram({
      title: 'Test',
      participants: [{ id: 'a', name: 'A' }],
      messages: [{ from: 'a', to: 'a', label: 'self-call' }],
    });

    const data = expr.data as SequenceDiagramData;
    expect(data.messages[0]!.type).toBe('sync');
  });

  it('throws when no participants provided', () => {
    expect(() => buildSequenceDiagram({
      title: 'Empty',
      participants: [],
      messages: [],
    })).toThrow('Sequence diagram requires at least one participant');
  });

  it('sizes based on participant and message count', () => {
    const expr = buildSequenceDiagram({
      title: 'Test',
      participants: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ],
      messages: [
        { from: 'a', to: 'b', label: 'm1' },
        { from: 'b', to: 'c', label: 'm2' },
      ],
    });

    // Width grows with participants, height with messages
    expect(expr.size.width).toBeGreaterThan(400);
    expect(expr.size.height).toBeGreaterThan(200);
  });
});

describe('executeDrawSequenceDiagram', () => {
  it('sends create and returns confirmation', async () => {
    const client = createMockClient();
    const result = await executeDrawSequenceDiagram(client, {
      title: 'Auth',
      participants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      messages: [{ from: 'a', to: 'b', label: 'request' }],
    });

    expect(client.sendCreate).toHaveBeenCalled();
    expect(result).toContain("'Auth'");
    expect(result).toContain('2 participants');
    expect(result).toContain('1 messages');
  });
});

// ── Mind Map ───────────────────────────────────────────────

describe('buildMindMap', () => {
  it('creates a mind map with branches', () => {
    const expr = buildMindMap({
      centralTopic: 'AI',
      branches: [
        { id: 'ml', label: 'Machine Learning', children: [] },
        {
          id: 'dl', label: 'Deep Learning', children: [
            { id: 'cnn', label: 'CNN', children: [] },
            { id: 'rnn', label: 'RNN', children: [] },
          ],
        },
      ],
    });

    expect(expr.kind).toBe('mind-map');
    const data = expr.data as MindMapData;
    expect(data.centralTopic).toBe('AI');
    expect(data.branches).toHaveLength(2);
    expect(data.branches[1]!.children).toHaveLength(2);
  });

  it('throws when no branches provided', () => {
    expect(() => buildMindMap({
      centralTopic: 'Empty',
      branches: [],
    })).toThrow('Mind map requires at least one branch');
  });
});

describe('executeDrawMindMap', () => {
  it('sends create and returns confirmation', async () => {
    const client = createMockClient();
    const result = await executeDrawMindMap(client, {
      centralTopic: 'Testing',
      branches: [{ id: 'b1', label: 'Unit', children: [] }],
    });

    expect(client.sendCreate).toHaveBeenCalled();
    expect(result).toContain("'Testing'");
    expect(result).toContain('1 branches');
  });
});

// ── Reasoning Chain ────────────────────────────────────────

describe('buildReasoningChain', () => {
  it('creates a reasoning chain with steps and answer', () => {
    const expr = buildReasoningChain({
      question: 'Why use TypeScript?',
      steps: [
        { title: 'Type Safety', content: 'Catches bugs at compile time' },
        { title: 'IDE Support', content: 'Better autocomplete and refactoring' },
      ],
      finalAnswer: 'TypeScript improves code quality and developer productivity.',
    });

    expect(expr.kind).toBe('reasoning-chain');
    const data = expr.data as ReasoningChainData;
    expect(data.question).toBe('Why use TypeScript?');
    expect(data.steps).toHaveLength(2);
    expect(data.finalAnswer).toContain('TypeScript');
  });

  it('throws when no steps provided', () => {
    expect(() => buildReasoningChain({
      question: 'Empty?',
      steps: [],
      finalAnswer: 'No answer',
    })).toThrow('Reasoning chain requires at least one step');
  });

  it('sizes vertically based on step count', () => {
    const short = buildReasoningChain({
      question: 'Q?',
      steps: [{ title: 'S1', content: 'C1' }],
      finalAnswer: 'A',
    });
    const long = buildReasoningChain({
      question: 'Q?',
      steps: Array.from({ length: 5 }, (_, i) => ({
        title: `Step ${i}`,
        content: `Content ${i}`,
      })),
      finalAnswer: 'A',
    });

    expect(long.size.height).toBeGreaterThan(short.size.height);
  });
});

describe('executeDrawReasoningChain', () => {
  it('sends create and returns confirmation', async () => {
    const client = createMockClient();
    const result = await executeDrawReasoningChain(client, {
      question: 'Why TDD?',
      steps: [{ title: 'Red', content: 'Write failing test' }],
      finalAnswer: 'TDD ensures correctness.',
    });

    expect(client.sendCreate).toHaveBeenCalled();
    expect(result).toContain("'Why TDD?'");
    expect(result).toContain('1 steps');
  });
});

// ── Wireframe ──────────────────────────────────────────────

describe('buildWireframe', () => {
  it('creates a wireframe with components', () => {
    const expr = buildWireframe({
      title: 'Login Page',
      screenSize: { width: 375, height: 812 },
      components: [
        { type: 'input', label: 'Email', x: 20, y: 100, width: 335, height: 44 },
        { type: 'input', label: 'Password', x: 20, y: 164, width: 335, height: 44 },
        { type: 'button', label: 'Sign In', x: 20, y: 228, width: 335, height: 44 },
      ],
    });

    expect(expr.kind).toBe('wireframe');
    const data = expr.data as WireframeData;
    expect(data.title).toBe('Login Page');
    expect(data.screenSize).toEqual({ width: 375, height: 812 });
    expect(data.components).toHaveLength(3);
  });

  it('sizes to screen dimensions', () => {
    const expr = buildWireframe({
      title: 'Test',
      screenSize: { width: 1024, height: 768 },
      components: [],
    });

    expect(expr.size).toEqual({ width: 1024, height: 768 });
  });

  it('auto-generates component IDs', () => {
    const expr = buildWireframe({
      title: 'Test',
      screenSize: { width: 375, height: 812 },
      components: [
        { type: 'button', label: 'A', x: 0, y: 0, width: 100, height: 40 },
        { type: 'button', label: 'B', x: 0, y: 50, width: 100, height: 40 },
      ],
    });

    const data = expr.data as WireframeData;
    expect(data.components[0]!.id).toBe('comp-0');
    expect(data.components[1]!.id).toBe('comp-1');
  });
});

describe('executeDrawWireframe', () => {
  it('sends create and returns confirmation', async () => {
    const client = createMockClient();
    const result = await executeDrawWireframe(client, {
      title: 'Dashboard',
      screenSize: { width: 1024, height: 768 },
      components: [
        { type: 'nav', label: 'Top Nav', x: 0, y: 0, width: 1024, height: 60 },
      ],
    });

    expect(client.sendCreate).toHaveBeenCalled();
    expect(result).toContain("'Dashboard'");
    expect(result).toContain('1 components');
  });
});

// ── Roadmap ────────────────────────────────────────────────

describe('buildRoadmap', () => {
  it('creates a roadmap with phases and items', () => {
    const expr = buildRoadmap({
      title: 'Q1 Roadmap',
      phases: [
        {
          id: 'p1', name: 'Phase 1', items: [
            { id: 'i1', title: 'Design', status: 'done' },
            { id: 'i2', title: 'Implement', status: 'in-progress' },
          ],
        },
        {
          id: 'p2', name: 'Phase 2', items: [
            { id: 'i3', title: 'Test', status: 'planned' },
          ],
        },
      ],
    });

    expect(expr.kind).toBe('roadmap');
    const data = expr.data as RoadmapData;
    expect(data.title).toBe('Q1 Roadmap');
    expect(data.phases).toHaveLength(2);
    expect(data.orientation).toBe('horizontal');
  });

  it('supports vertical orientation', () => {
    const expr = buildRoadmap({
      title: 'Test',
      orientation: 'vertical',
      phases: [{ id: 'p1', name: 'P1', items: [{ id: 'i1', title: 'I1', status: 'planned' }] }],
    });

    const data = expr.data as RoadmapData;
    expect(data.orientation).toBe('vertical');
  });

  it('throws when no phases provided', () => {
    expect(() => buildRoadmap({
      title: 'Empty',
      phases: [],
    })).toThrow('Roadmap requires at least one phase');
  });
});

describe('executeDrawRoadmap', () => {
  it('sends create and returns confirmation with counts', async () => {
    const client = createMockClient();
    const result = await executeDrawRoadmap(client, {
      title: 'MVP',
      phases: [
        {
          id: 'p1', name: 'P1', items: [
            { id: 'i1', title: 'A', status: 'planned' },
            { id: 'i2', title: 'B', status: 'done' },
          ],
        },
      ],
    });

    expect(client.sendCreate).toHaveBeenCalled();
    expect(result).toContain("'MVP'");
    expect(result).toContain('1 phases');
    expect(result).toContain('2 items');
  });
});

// ── Kanban ─────────────────────────────────────────────────

describe('buildKanban', () => {
  it('creates a kanban board with columns and cards', () => {
    const expr = buildKanban({
      title: 'Sprint Board',
      columns: [
        {
          id: 'todo', title: 'To Do', cards: [
            { id: 'c1', title: 'Task 1', description: 'First task' },
          ],
        },
        {
          id: 'doing', title: 'In Progress', cards: [
            { id: 'c2', title: 'Task 2' },
          ],
        },
        { id: 'done', title: 'Done', cards: [] },
      ],
    });

    expect(expr.kind).toBe('kanban');
    const data = expr.data as KanbanData;
    expect(data.title).toBe('Sprint Board');
    expect(data.columns).toHaveLength(3);
    expect(data.columns[0]!.cards).toHaveLength(1);
    expect(data.columns[0]!.cards[0]!.description).toBe('First task');
  });

  it('throws when no columns provided', () => {
    expect(() => buildKanban({
      title: 'Empty',
      columns: [],
    })).toThrow('Kanban board requires at least one column');
  });

  it('sizes based on column and card count', () => {
    const small = buildKanban({
      title: 'Small',
      columns: [{ id: 'c1', title: 'Col', cards: [{ id: 'c', title: 'Card' }] }],
    });
    const large = buildKanban({
      title: 'Large',
      columns: Array.from({ length: 5 }, (_, i) => ({
        id: `col-${i}`,
        title: `Column ${i}`,
        cards: Array.from({ length: 3 }, (_, j) => ({
          id: `card-${i}-${j}`,
          title: `Card ${j}`,
        })),
      })),
    });

    expect(large.size.width).toBeGreaterThan(small.size.width);
  });
});

describe('executeDrawKanban', () => {
  it('sends create and returns confirmation with counts', async () => {
    const client = createMockClient();
    const result = await executeDrawKanban(client, {
      title: 'Board',
      columns: [
        { id: 'c1', title: 'Todo', cards: [{ id: '1', title: 'A' }, { id: '2', title: 'B' }] },
        { id: 'c2', title: 'Done', cards: [{ id: '3', title: 'C' }] },
      ],
    });

    expect(client.sendCreate).toHaveBeenCalled();
    expect(result).toContain("'Board'");
    expect(result).toContain('2 columns');
    expect(result).toContain('3 cards');
  });
});

// ── Cross-cutting concerns ─────────────────────────────────

describe('composite tools cross-cutting', () => {
  it('all expressions default to position (0,0) when not specified', () => {
    const flowchart = buildFlowchart({ title: 'T', nodes: [{ id: 'n', label: 'N' }], edges: [] });
    const kanban = buildKanban({ title: 'T', columns: [{ id: 'c', title: 'C', cards: [] }] });

    expect(flowchart.position).toEqual({ x: 0, y: 0 });
    expect(kanban.position).toEqual({ x: 0, y: 0 });
  });

  it('all expressions use custom positions when specified', () => {
    const flowchart = buildFlowchart({ title: 'T', nodes: [{ id: 'n', label: 'N' }], edges: [], x: 100, y: 200 });

    expect(flowchart.position).toEqual({ x: 100, y: 200 });
  });

  it('each expression has MCP author info', () => {
    const expr = buildFlowchart({ title: 'T', nodes: [{ id: 'n', label: 'N' }], edges: [] });

    expect(expr.meta.author.type).toBe('agent');
    expect(expr.meta.author.id).toMatch(/^mcp-/);
    expect(expr.meta.author.provider).toBe('mcp');
  });
});
