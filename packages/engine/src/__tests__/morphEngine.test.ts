/**
 * Unit tests for Morph Engine — expression-to-expression transformation.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies morph transformations preserve semantic content while
 * changing expression kind.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import {
  morphExpression,
  canMorph,
  getMorphTargets,
} from '../morph/morphEngine.js';
import type {
  VisualExpression,
  ExpressionKind,
  FlowchartData,
  TableData,
  RoadmapData,
  KanbanData,
  MindMapData,
  ReasoningChainData,
} from '@infinicanvas/protocol';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';

// ── Test helpers ───────────────────────────────────────────

/** Creates a minimal valid VisualExpression with the given kind and data. */
function makeExpression(
  kind: ExpressionKind,
  data: VisualExpression['data'],
): VisualExpression {
  return {
    id: 'test-expr-1',
    kind,
    position: { x: 100, y: 200 },
    size: { width: 400, height: 300 },
    angle: 0,
    style: { ...DEFAULT_EXPRESSION_STYLE },
    meta: {
      author: { type: 'human', id: 'user-1', name: 'Test User' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data,
  };
}

// ── Sample data for morph tests ────────────────────────────

const sampleFlowchart: FlowchartData = {
  kind: 'flowchart',
  title: 'Login Flow',
  nodes: [
    { id: 'n1', label: 'Start', shape: 'ellipse' },
    { id: 'n2', label: 'Validate Input', shape: 'rect' },
    { id: 'n3', label: 'Is Valid?', shape: 'diamond' },
    { id: 'n4', label: 'Login Success', shape: 'rect' },
    { id: 'n5', label: 'Show Error', shape: 'rect' },
  ],
  edges: [
    { from: 'n1', to: 'n2', label: undefined },
    { from: 'n2', to: 'n3', label: undefined },
    { from: 'n3', to: 'n4', label: 'Yes' },
    { from: 'n3', to: 'n5', label: 'No' },
  ],
  direction: 'TB',
};

const sampleTable: TableData = {
  kind: 'table',
  headers: ['Node', 'Shape', 'Connections'],
  rows: [
    ['Start', 'ellipse', '→ Validate Input'],
    ['Validate Input', 'rect', '→ Is Valid?'],
    ['Is Valid?', 'diamond', '→ Login Success, → Show Error'],
    ['Login Success', 'rect', ''],
    ['Show Error', 'rect', ''],
  ],
};

const sampleRoadmap: RoadmapData = {
  kind: 'roadmap',
  title: 'Q1 Plan',
  orientation: 'horizontal',
  phases: [
    {
      id: 'p1',
      name: 'Planning',
      items: [
        { id: 'i1', title: 'Research', status: 'done' },
        { id: 'i2', title: 'Design', status: 'in-progress' },
      ],
    },
    {
      id: 'p2',
      name: 'Execution',
      items: [
        { id: 'i3', title: 'Build MVP', status: 'planned' },
        { id: 'i4', title: 'Test', status: 'planned' },
      ],
    },
  ],
};

const sampleKanban: KanbanData = {
  kind: 'kanban',
  title: 'Q1 Plan',
  columns: [
    {
      id: 'col-p1',
      title: 'Planning',
      cards: [
        { id: 'card-i1', title: 'Research', description: 'Status: done' },
        { id: 'card-i2', title: 'Design', description: 'Status: in-progress' },
      ],
    },
    {
      id: 'col-p2',
      title: 'Execution',
      cards: [
        { id: 'card-i3', title: 'Build MVP', description: 'Status: planned' },
        { id: 'card-i4', title: 'Test', description: 'Status: planned' },
      ],
    },
  ],
};

const sampleMindMap: MindMapData = {
  kind: 'mind-map',
  centralTopic: 'Project Planning',
  branches: [
    {
      id: 'b1',
      label: 'Design',
      children: [
        { id: 'b1-1', label: 'UI Mockups', children: [] },
        { id: 'b1-2', label: 'Architecture', children: [] },
      ],
    },
    {
      id: 'b2',
      label: 'Development',
      children: [
        { id: 'b2-1', label: 'Frontend', children: [] },
        { id: 'b2-2', label: 'Backend', children: [] },
      ],
    },
  ],
};

const sampleReasoningChain: ReasoningChainData = {
  kind: 'reasoning-chain',
  question: 'Should we use microservices?',
  steps: [
    { title: 'Analyze Scale', content: 'The system handles 10K requests/sec' },
    { title: 'Evaluate Team', content: 'Team of 20 developers across 4 squads' },
    { title: 'Consider Complexity', content: 'Multiple bounded contexts identified' },
  ],
  finalAnswer: 'Yes, microservices are appropriate for this scale and team.',
};

// ── canMorph tests ─────────────────────────────────────────

describe('canMorph', () => {
  it('returns true for flowchart → table', () => {
    expect(canMorph('flowchart', 'table')).toBe(true);
  });

  it('returns true for table → flowchart', () => {
    expect(canMorph('table', 'flowchart')).toBe(true);
  });

  it('returns true for roadmap → kanban', () => {
    expect(canMorph('roadmap', 'kanban')).toBe(true);
  });

  it('returns true for kanban → roadmap', () => {
    expect(canMorph('kanban', 'roadmap')).toBe(true);
  });

  it('returns true for mind-map → table', () => {
    expect(canMorph('mind-map', 'table')).toBe(true);
  });

  it('returns true for table → mind-map', () => {
    expect(canMorph('table', 'mind-map')).toBe(true);
  });

  it('returns true for reasoning-chain → flowchart', () => {
    expect(canMorph('reasoning-chain', 'flowchart')).toBe(true);
  });

  it('returns true for flowchart → reasoning-chain', () => {
    expect(canMorph('flowchart', 'reasoning-chain')).toBe(true);
  });

  it('returns false for same kind', () => {
    expect(canMorph('flowchart', 'flowchart')).toBe(false);
  });

  it('returns false for unsupported pair (rectangle → table)', () => {
    expect(canMorph('rectangle', 'table')).toBe(false);
  });

  it('returns false for unsupported pair (flowchart → kanban)', () => {
    expect(canMorph('flowchart', 'kanban')).toBe(false);
  });

  it('returns false for primitive kinds', () => {
    expect(canMorph('rectangle', 'ellipse')).toBe(false);
  });

  it('returns false for annotation kinds', () => {
    expect(canMorph('comment', 'callout')).toBe(false);
  });
});

// ── getMorphTargets tests ──────────────────────────────────

describe('getMorphTargets', () => {
  it('returns [table, reasoning-chain] for flowchart', () => {
    const targets = getMorphTargets('flowchart');
    expect(targets).toContain('table');
    expect(targets).toContain('reasoning-chain');
    expect(targets).toHaveLength(2);
  });

  it('returns [flowchart, mind-map] for table', () => {
    const targets = getMorphTargets('table');
    expect(targets).toContain('flowchart');
    expect(targets).toContain('mind-map');
    expect(targets).toHaveLength(2);
  });

  it('returns [kanban] for roadmap', () => {
    const targets = getMorphTargets('roadmap');
    expect(targets).toContain('kanban');
    expect(targets).toHaveLength(1);
  });

  it('returns [roadmap] for kanban', () => {
    const targets = getMorphTargets('kanban');
    expect(targets).toContain('roadmap');
    expect(targets).toHaveLength(1);
  });

  it('returns [table] for mind-map', () => {
    const targets = getMorphTargets('mind-map');
    expect(targets).toContain('table');
    expect(targets).toHaveLength(1);
  });

  it('returns [flowchart] for reasoning-chain', () => {
    const targets = getMorphTargets('reasoning-chain');
    expect(targets).toContain('flowchart');
    expect(targets).toHaveLength(1);
  });

  it('returns empty array for primitives (rectangle)', () => {
    expect(getMorphTargets('rectangle')).toEqual([]);
  });

  it('returns empty array for annotations (comment)', () => {
    expect(getMorphTargets('comment')).toEqual([]);
  });

  it('returns empty array for unsupported composites (wireframe)', () => {
    expect(getMorphTargets('wireframe')).toEqual([]);
  });
});

// ── morphExpression tests ──────────────────────────────────

describe('morphExpression', () => {
  // ── Flowchart ↔ Table ──────────────────────────────────

  describe('flowchart → table', () => {
    it('converts nodes to rows with label, shape, and connections', () => {
      const expr = makeExpression('flowchart', sampleFlowchart);
      const result = morphExpression(expr, 'table');

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('table');

      const tableData = result!.data as TableData;
      expect(tableData.kind).toBe('table');
      expect(tableData.headers).toHaveLength(3);
      expect(tableData.headers[0]).toBe('Node');
      expect(tableData.headers[1]).toBe('Shape');
      expect(tableData.headers[2]).toBe('Connections');
      expect(tableData.rows).toHaveLength(5);

      // Verify first node row
      expect(tableData.rows[0][0]).toBe('Start');
      expect(tableData.rows[0][1]).toBe('ellipse');
    });

    it('preserves expression identity and envelope', () => {
      const expr = makeExpression('flowchart', sampleFlowchart);
      const result = morphExpression(expr, 'table');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(expr.id);
      expect(result!.position).toEqual(expr.position);
      expect(result!.size).toEqual(expr.size);
      expect(result!.style).toEqual(expr.style);
      expect(result!.meta.author).toEqual(expr.meta.author);
    });

    it('includes edge labels in connections column', () => {
      const expr = makeExpression('flowchart', sampleFlowchart);
      const result = morphExpression(expr, 'table');

      const tableData = result!.data as TableData;
      // 'Is Valid?' node has labeled edges
      const isValidRow = tableData.rows.find((r) => r[0] === 'Is Valid?');
      expect(isValidRow).toBeDefined();
      expect(isValidRow![2]).toContain('Login Success');
      expect(isValidRow![2]).toContain('Show Error');
    });
  });

  describe('table → flowchart', () => {
    it('converts rows to nodes and connections to edges', () => {
      const expr = makeExpression('table', sampleTable);
      const result = morphExpression(expr, 'flowchart');

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('flowchart');

      const flowData = result!.data as FlowchartData;
      expect(flowData.kind).toBe('flowchart');
      expect(flowData.nodes).toHaveLength(5);
      expect(flowData.direction).toBe('TB');

      // Verify node labels come from first column
      const labels = flowData.nodes.map((n) => n.label);
      expect(labels).toContain('Start');
      expect(labels).toContain('Validate Input');
    });

    it('restores node shapes from shape column', () => {
      const expr = makeExpression('table', sampleTable);
      const result = morphExpression(expr, 'flowchart');

      const flowData = result!.data as FlowchartData;
      const startNode = flowData.nodes.find((n) => n.label === 'Start');
      expect(startNode?.shape).toBe('ellipse');

      const diamondNode = flowData.nodes.find((n) => n.label === 'Is Valid?');
      expect(diamondNode?.shape).toBe('diamond');
    });
  });

  // ── Roadmap ↔ Kanban ───────────────────────────────────

  describe('roadmap → kanban', () => {
    it('converts phases to columns and items to cards', () => {
      const expr = makeExpression('roadmap', sampleRoadmap);
      const result = morphExpression(expr, 'kanban');

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('kanban');

      const kanbanData = result!.data as KanbanData;
      expect(kanbanData.kind).toBe('kanban');
      expect(kanbanData.columns).toHaveLength(2);
      expect(kanbanData.columns[0].title).toBe('Planning');
      expect(kanbanData.columns[0].cards).toHaveLength(2);
      expect(kanbanData.columns[0].cards[0].title).toBe('Research');
    });

    it('preserves item status as card description', () => {
      const expr = makeExpression('roadmap', sampleRoadmap);
      const result = morphExpression(expr, 'kanban');

      const kanbanData = result!.data as KanbanData;
      const firstCard = kanbanData.columns[0].cards[0];
      expect(firstCard.description).toContain('done');
    });

    it('preserves title', () => {
      const expr = makeExpression('roadmap', sampleRoadmap);
      const result = morphExpression(expr, 'kanban');

      const kanbanData = result!.data as KanbanData;
      expect(kanbanData.title).toBe('Q1 Plan');
    });
  });

  describe('kanban → roadmap', () => {
    it('converts columns to phases and cards to items', () => {
      const expr = makeExpression('kanban', sampleKanban);
      const result = morphExpression(expr, 'roadmap');

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('roadmap');

      const roadmapData = result!.data as RoadmapData;
      expect(roadmapData.kind).toBe('roadmap');
      expect(roadmapData.phases).toHaveLength(2);
      expect(roadmapData.phases[0].name).toBe('Planning');
      expect(roadmapData.phases[0].items).toHaveLength(2);
      expect(roadmapData.phases[0].items[0].title).toBe('Research');
    });

    it('extracts status from card description', () => {
      const expr = makeExpression('kanban', sampleKanban);
      const result = morphExpression(expr, 'roadmap');

      const roadmapData = result!.data as RoadmapData;
      const firstItem = roadmapData.phases[0].items[0];
      expect(firstItem.status).toBe('done');
    });

    it('preserves title', () => {
      const expr = makeExpression('kanban', sampleKanban);
      const result = morphExpression(expr, 'roadmap');

      const roadmapData = result!.data as RoadmapData;
      expect(roadmapData.title).toBe('Q1 Plan');
    });
  });

  // ── Mind Map ↔ Table ───────────────────────────────────

  describe('mind-map → table', () => {
    it('flattens branches to rows with path and label columns', () => {
      const expr = makeExpression('mind-map', sampleMindMap);
      const result = morphExpression(expr, 'table');

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('table');

      const tableData = result!.data as TableData;
      expect(tableData.kind).toBe('table');
      expect(tableData.headers).toContain('Topic');
      expect(tableData.headers).toContain('Parent');

      // Should flatten: Design, UI Mockups, Architecture, Development, Frontend, Backend
      expect(tableData.rows.length).toBe(6);
    });

    it('includes parent path for nested branches', () => {
      const expr = makeExpression('mind-map', sampleMindMap);
      const result = morphExpression(expr, 'table');

      const tableData = result!.data as TableData;
      // UI Mockups is under Design, which is under Project Planning
      const uiRow = tableData.rows.find((r) => r[0] === 'UI Mockups');
      expect(uiRow).toBeDefined();
      expect(uiRow![1]).toBe('Design');
    });
  });

  describe('table → mind-map', () => {
    it('reconstructs branches from Topic/Parent columns', () => {
      // Create a table that represents a mind map structure
      const mindMapTable: TableData = {
        kind: 'table',
        headers: ['Topic', 'Parent'],
        rows: [
          ['Design', 'Project Planning'],
          ['UI Mockups', 'Design'],
          ['Architecture', 'Design'],
          ['Development', 'Project Planning'],
          ['Frontend', 'Development'],
          ['Backend', 'Development'],
        ],
      };
      const expr = makeExpression('table', mindMapTable);
      const result = morphExpression(expr, 'mind-map');

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('mind-map');

      const mindMapData = result!.data as MindMapData;
      expect(mindMapData.kind).toBe('mind-map');
      expect(mindMapData.centralTopic).toBe('Project Planning');
      expect(mindMapData.branches).toHaveLength(2);
    });
  });

  // ── Reasoning Chain ↔ Flowchart ────────────────────────

  describe('reasoning-chain → flowchart', () => {
    it('converts steps to nodes with sequential edges', () => {
      const expr = makeExpression('reasoning-chain', sampleReasoningChain);
      const result = morphExpression(expr, 'flowchart');

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('flowchart');

      const flowData = result!.data as FlowchartData;
      expect(flowData.kind).toBe('flowchart');
      // question + 3 steps + final answer = 5 nodes
      expect(flowData.nodes).toHaveLength(5);
      // 4 edges connecting them sequentially
      expect(flowData.edges).toHaveLength(4);
      expect(flowData.direction).toBe('TB');
    });

    it('uses question as first node and final answer as last', () => {
      const expr = makeExpression('reasoning-chain', sampleReasoningChain);
      const result = morphExpression(expr, 'flowchart');

      const flowData = result!.data as FlowchartData;
      expect(flowData.nodes[0].label).toBe('Should we use microservices?');
      expect(flowData.nodes[0].shape).toBe('ellipse');
      expect(flowData.nodes[flowData.nodes.length - 1].label).toContain(
        'Yes, microservices',
      );
    });

    it('step nodes use rect shape with title as label', () => {
      const expr = makeExpression('reasoning-chain', sampleReasoningChain);
      const result = morphExpression(expr, 'flowchart');

      const flowData = result!.data as FlowchartData;
      // Steps are nodes[1..3]
      expect(flowData.nodes[1].shape).toBe('rect');
      expect(flowData.nodes[1].label).toBe('Analyze Scale');
    });
  });

  describe('flowchart → reasoning-chain', () => {
    it('converts sequential nodes to reasoning steps', () => {
      // Create a linear flowchart (question → steps → answer)
      const linearFlow: FlowchartData = {
        kind: 'flowchart',
        title: 'Analysis',
        nodes: [
          { id: 'q', label: 'What framework?', shape: 'ellipse' },
          { id: 's1', label: 'Compare React', shape: 'rect' },
          { id: 's2', label: 'Compare Vue', shape: 'rect' },
          { id: 'a', label: 'Use React', shape: 'ellipse' },
        ],
        edges: [
          { from: 'q', to: 's1' },
          { from: 's1', to: 's2' },
          { from: 's2', to: 'a' },
        ],
        direction: 'TB',
      };
      const expr = makeExpression('flowchart', linearFlow);
      const result = morphExpression(expr, 'reasoning-chain');

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('reasoning-chain');

      const rcData = result!.data as ReasoningChainData;
      expect(rcData.kind).toBe('reasoning-chain');
      expect(rcData.question).toBe('What framework?');
      expect(rcData.steps).toHaveLength(2);
      expect(rcData.steps[0].title).toBe('Compare React');
      expect(rcData.steps[1].title).toBe('Compare Vue');
      expect(rcData.finalAnswer).toBe('Use React');
    });
  });

  // ── Error / edge cases ─────────────────────────────────

  describe('error cases', () => {
    it('returns null for unsupported morph pair', () => {
      const expr = makeExpression('flowchart', sampleFlowchart);
      const result = morphExpression(expr, 'kanban');
      expect(result).toBeNull();
    });

    it('returns null for same kind', () => {
      const expr = makeExpression('flowchart', sampleFlowchart);
      const result = morphExpression(expr, 'flowchart');
      expect(result).toBeNull();
    });

    it('returns null for primitive expressions', () => {
      const expr = makeExpression('rectangle', { kind: 'rectangle', label: 'test' });
      const result = morphExpression(expr, 'table');
      expect(result).toBeNull();
    });

    it('does not mutate the original expression [purity]', () => {
      const expr = makeExpression('flowchart', sampleFlowchart);
      const originalData = JSON.stringify(expr);
      morphExpression(expr, 'table');
      expect(JSON.stringify(expr)).toBe(originalData);
    });

    it('handles empty flowchart nodes gracefully', () => {
      const emptyFlow: FlowchartData = {
        kind: 'flowchart',
        title: 'Empty',
        nodes: [],
        edges: [],
        direction: 'TB',
      };
      const expr = makeExpression('flowchart', emptyFlow);
      const result = morphExpression(expr, 'table');

      expect(result).not.toBeNull();
      const tableData = result!.data as TableData;
      expect(tableData.rows).toHaveLength(0);
    });

    it('handles empty kanban columns gracefully', () => {
      const emptyKanban: KanbanData = {
        kind: 'kanban',
        title: 'Empty Board',
        columns: [],
      };
      const expr = makeExpression('kanban', emptyKanban);
      const result = morphExpression(expr, 'roadmap');

      expect(result).not.toBeNull();
      const roadmapData = result!.data as RoadmapData;
      expect(roadmapData.phases).toHaveLength(0);
    });

    it('updates meta.updatedAt on morphed expression', () => {
      const expr = makeExpression('flowchart', sampleFlowchart);
      const beforeMorph = Date.now();
      const result = morphExpression(expr, 'table');

      expect(result).not.toBeNull();
      expect(result!.meta.updatedAt).toBeGreaterThanOrEqual(beforeMorph);
    });
  });
});
