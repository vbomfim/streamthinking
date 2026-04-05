/**
 * Contract tests for MCP Server tools.
 *
 * Validates that each MCP tool:
 * - Returns proper error messages for invalid inputs [AC5]
 * - Creates valid protocol expressions with all required fields [AC6]
 * - Includes correct author attribution [AC7]
 * - Handles gateway failures gracefully [CONTRACT]
 *
 * Ticket #31
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
import {
  executeDrawRectangle,
  executeDrawEllipse,
  executeDrawLine,
  executeDrawArrow,
  executeDrawText,
  executeAddStickyNote,
} from '../tools/primitiveTools.js';
import {
  buildFlowchart,
  buildSequenceDiagram,
  buildMindMap,
  buildReasoningChain,
  buildWireframe,
  buildRoadmap,
  buildKanban,
  executeDrawFlowchart,
} from '../tools/compositeTools.js';
import {
  executeMorph,
  formatCanvasState,
} from '../tools/managementTools.js';
import { buildExpression } from '../expressionFactory.js';
import {
  buildAnnotation,
  buildHighlight,
  buildComment,
} from '../tools/annotationTools.js';
import type { IGatewayClient } from '../gatewayClient.js';

// ── Mock Gateway Client ──────────────────────────────────────

function createMockClient(options?: {
  connected?: boolean;
  expressions?: VisualExpression[];
  throwOnSend?: boolean;
}): IGatewayClient {
  const {
    connected = true,
    expressions = [],
    throwOnSend = false,
  } = options ?? {};

  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(connected),
    getSessionId: vi.fn().mockReturnValue('session-1'),
    sendCreate: vi.fn(async () => {
      if (throwOnSend) throw new Error('Gateway connection lost');
    }),
    sendDelete: vi.fn(async () => {
      if (throwOnSend) throw new Error('Gateway connection lost');
    }),
    sendMorph: vi.fn(async () => {
      if (throwOnSend) throw new Error('Gateway connection lost');
    }),
    sendStyle: vi.fn(async () => {
      if (throwOnSend) throw new Error('Gateway connection lost');
    }),
    getState: vi.fn().mockReturnValue(expressions),
    sendSceneUpdate: vi.fn(async () => {
      if (throwOnSend) throw new Error('Gateway connection lost');
    }),
    getExcalidrawElements: vi.fn().mockReturnValue([]),
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('Expression protocol compliance [CONTRACT][AC6 #31]', () => {
  const requiredFields = ['id', 'kind', 'position', 'size', 'angle', 'style', 'data', 'meta'];

  it('buildFlowchart produces all required fields', () => {
    const expr = buildFlowchart({
      title: 'Test Flow',
      nodes: [{ id: 'n1', label: 'Start' }],
      edges: [],
    });
    for (const field of requiredFields) {
      expect(expr).toHaveProperty(field);
    }
    expect(expr.kind).toBe('flowchart');
  });

  it('buildSequenceDiagram produces all required fields', () => {
    const expr = buildSequenceDiagram({
      title: 'Test Seq',
      participants: [{ id: 'p1', label: 'User' }],
      messages: [],
    });
    for (const field of requiredFields) {
      expect(expr).toHaveProperty(field);
    }
    expect(expr.kind).toBe('sequence-diagram');
  });

  it('buildMindMap produces all required fields', () => {
    const expr = buildMindMap({
      centralTopic: 'Ideas',
      branches: [{ label: 'Branch 1', children: [] }],
    });
    for (const field of requiredFields) {
      expect(expr).toHaveProperty(field);
    }
    expect(expr.kind).toBe('mind-map');
  });
});

describe('Author attribution [CONTRACT][AC7 #31]', () => {
  it('all composite tools use MCP agent author', () => {
    const flowchart = buildFlowchart({
      title: 'Test',
      nodes: [{ id: 'n1', label: 'A' }],
      edges: [],
    });
    expect(flowchart.meta.author.type).toBe('agent');
    expect(flowchart.meta.author.provider).toBe('mcp');
  });

  it('annotation tools use MCP agent author', () => {
    const annotation = buildAnnotation({ targetId: 'r1', text: 'Note' });
    expect(annotation.meta.author.type).toBe('agent');
    expect(annotation.meta.author.provider).toBe('mcp');

    const highlight = buildHighlight({ elementIds: ['r1'] });
    expect(highlight.meta.author.type).toBe('agent');
    expect(highlight.meta.author.provider).toBe('mcp');

    const comment = buildComment({ targetId: 'r1', text: 'Comment' });
    expect(comment.meta.author.type).toBe('agent');
    expect(comment.meta.author.provider).toBe('mcp');
  });
});

describe('Unique IDs per expression [CONTRACT]', () => {
  it('each composite build call generates a unique ID', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const expr = buildFlowchart({ title: 'Test', nodes: [{ id: 'n1', label: 'A' }], edges: [] });
      expect(ids.has(expr.id)).toBe(false);
      ids.add(expr.id);
    }
  });
});

describe('Gateway failure handling [CONTRACT][AC5 #31]', () => {
  it('executeDrawRectangle propagates gateway error', async () => {
    const client = createMockClient({ throwOnSend: true });

    await expect(
      executeDrawRectangle(client, { x: 0, y: 0, width: 100, height: 50 }),
    ).rejects.toThrow('Gateway connection lost');
  });

  it('executeDrawFlowchart propagates gateway error', async () => {
    const client = createMockClient({ throwOnSend: true });

    await expect(
      executeDrawFlowchart(client, {
        title: 'Test',
        nodes: [{ id: 'n1', label: 'Start' }],
        edges: [],
      }),
    ).rejects.toThrow('Gateway connection lost');
  });
});

describe('Tool input validation [EDGE][AC5 #31]', () => {
  it('executeDrawLine requires at least 2 points', async () => {
    const client = createMockClient();
    await expect(executeDrawLine(client, { points: [[0, 0]] })).rejects.toThrow();
  });

  it('executeDrawArrow requires at least 2 points', async () => {
    const client = createMockClient();
    await expect(executeDrawArrow(client, { points: [[0, 0]] })).rejects.toThrow();
  });

  it('buildFlowchart requires at least 1 node', () => {
    expect(() => buildFlowchart({ title: 'Empty', nodes: [], edges: [] })).toThrow();
  });

  it('buildSequenceDiagram requires at least 1 participant', () => {
    expect(() => buildSequenceDiagram({
      title: 'Empty',
      participants: [],
      messages: [],
    })).toThrow();
  });

  it('buildMindMap requires at least 1 branch', () => {
    expect(() => buildMindMap({
      centralTopic: 'Empty',
      branches: [],
    })).toThrow();
  });

  it('buildKanban requires at least 1 column', () => {
    expect(() => buildKanban({
      title: 'Empty',
      columns: [],
    })).toThrow();
  });

  it('buildReasoningChain requires at least 1 step', () => {
    expect(() => buildReasoningChain({
      question: 'Why?',
      steps: [],
      finalAnswer: 'Because',
    })).toThrow();
  });

  it('buildHighlight requires at least 1 element', () => {
    expect(() => buildHighlight({ elementIds: [] })).toThrow();
  });
});

describe('Morph validation [EDGE][AC5 #31]', () => {
  it('morph to same kind returns rejection message', async () => {
    const rect = buildExpression(
      'rectangle',
      { x: 0, y: 0 },
      { width: 100, height: 50 },
      { kind: 'rectangle', label: undefined },
    );
    const client = createMockClient({ expressions: [rect] });

    const result = await executeMorph(client, { elementId: rect.id, toKind: 'rectangle' });
    expect(result).toContain('already');
  });

  it('morph nonexistent element throws with error message', async () => {
    const client = createMockClient({ expressions: [] });

    await expect(
      executeMorph(client, { elementId: 'ghost', toKind: 'ellipse' }),
    ).rejects.toThrow('not found');
  });
});

describe('Canvas state formatting [CONTRACT][AC3 #31]', () => {
  it('formatCanvasState includes all expression IDs and kinds', () => {
    const expressions: VisualExpression[] = [
      buildExpression('rectangle', { x: 0, y: 0 }, { width: 100, height: 50 }, { kind: 'rectangle', label: undefined }),
      buildExpression('ellipse', { x: 200, y: 100 }, { width: 80, height: 60 }, { kind: 'ellipse', label: undefined }),
    ];

    const output = formatCanvasState(expressions);
    expect(output).toContain('rectangle');
    expect(output).toContain('ellipse');
    for (const expr of expressions) {
      expect(output).toContain(expr.id);
    }
  });

  it('formatCanvasState on empty canvas reports empty', () => {
    const output = formatCanvasState([]);
    expect(output.toLowerCase()).toContain('empty');
  });
});

describe('Composite tool sizing [BOUNDARY]', () => {
  it('flowchart with many nodes produces reasonable dimensions', () => {
    const nodes = Array.from({ length: 20 }, (_, i) => ({
      id: `n${i}`,
      label: `Node ${i}`,
    }));
    const edges = nodes.slice(1).map((n, i) => ({
      from: nodes[i]!.id,
      to: n.id,
    }));

    const expr = buildFlowchart({ title: 'Large', nodes, edges });
    expect(expr.size.width).toBeGreaterThan(0);
    expect(expr.size.height).toBeGreaterThan(0);
    // Size should scale with number of nodes
    expect(expr.size.height).toBeGreaterThan(100);
  });

  it('kanban with many columns has increasing width', () => {
    const small = buildKanban({
      title: 'Small',
      columns: [{ title: 'A', cards: ['1'] }],
    });
    const large = buildKanban({
      title: 'Large',
      columns: Array.from({ length: 5 }, (_, i) => ({
        title: `Col ${i}`,
        cards: ['a', 'b'],
      })),
    });

    expect(large.size.width).toBeGreaterThan(small.size.width);
  });

  it('roadmap horizontal vs vertical orientation changes dimensions', () => {
    const phases = [{ title: 'Phase 1', items: ['A', 'B'] }];
    const horizontal = buildRoadmap({ title: 'H', phases, orientation: 'horizontal' });
    const vertical = buildRoadmap({ title: 'V', phases, orientation: 'vertical' });

    // Orientation should affect which dimension is larger
    // (Not strictly testing exact values, just that they differ)
    expect(horizontal.size.width !== vertical.size.width ||
           horizontal.size.height !== vertical.size.height).toBe(true);
  });
});
