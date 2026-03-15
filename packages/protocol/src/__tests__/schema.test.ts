/**
 * Schema validation tests for InfiniCanvas Protocol.
 *
 * Verifies that Zod schemas correctly validate and reject data
 * for all expression kinds, metadata, and operations.
 */

import { describe, it, expect } from 'vitest';
import {
  authorInfoSchema,
  expressionStyleSchema,
  // Primitives
  rectangleDataSchema,
  ellipseDataSchema,
  diamondDataSchema,
  lineDataSchema,
  arrowDataSchema,
  freehandDataSchema,
  textDataSchema,
  stickyNoteDataSchema,
  imageDataSchema,
  // Composites
  flowchartDataSchema,
  sequenceDiagramDataSchema,
  wireframeDataSchema,
  reasoningChainDataSchema,
  roadmapDataSchema,
  mindMapDataSchema,
  kanbanDataSchema,
  decisionTreeDataSchema,
  collaborationDiagramDataSchema,
  slideDataSchema,
  codeBlockDataSchema,
  tableDataSchema,
  // Annotations
  commentDataSchema,
  calloutDataSchema,
  highlightDataSchema,
  markerDataSchema,
  // Full expression
  visualExpressionSchema,
  expressionDataSchema,
  // Operations
  protocolOperationSchema,
  operationPayloadSchema,
  createPayloadSchema,
  // Defaults
  DEFAULT_EXPRESSION_STYLE,
} from '../index.js';

// ── Test helpers ───────────────────────────────────────────

const humanAuthor = { type: 'human' as const, id: 'user-1', name: 'Alice' };
const agentAuthor = { type: 'agent' as const, id: 'agent-1', name: 'Canvas AI', provider: 'openai' };

const defaultStyle = {
  strokeColor: '#000000',
  backgroundColor: 'transparent',
  fillStyle: 'none' as const,
  strokeWidth: 2,
  roughness: 0,
  opacity: 1,
};

function makeExpression(data: Record<string, unknown>) {
  return {
    id: 'expr-1',
    kind: (data as { kind: string }).kind,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    angle: 0,
    style: defaultStyle,
    meta: {
      author: humanAuthor,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data,
  };
}

// ── AuthorInfo ─────────────────────────────────────────────

describe('AuthorInfo schema', () => {
  it('accepts a valid human author', () => {
    const result = authorInfoSchema.safeParse(humanAuthor);
    expect(result.success).toBe(true);
  });

  it('accepts a valid agent author', () => {
    const result = authorInfoSchema.safeParse(agentAuthor);
    expect(result.success).toBe(true);
  });

  it('rejects author with empty name', () => {
    const result = authorInfoSchema.safeParse({ type: 'human', id: 'u1', name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects agent author without provider', () => {
    const result = authorInfoSchema.safeParse({ type: 'agent', id: 'a1', name: 'Bot' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown author type', () => {
    const result = authorInfoSchema.safeParse({ type: 'robot', id: 'r1', name: 'R2' });
    expect(result.success).toBe(false);
  });
});

// ── ExpressionStyle ────────────────────────────────────────

describe('ExpressionStyle schema', () => {
  it('accepts a valid style', () => {
    const result = expressionStyleSchema.safeParse(defaultStyle);
    expect(result.success).toBe(true);
  });

  it('accepts style with optional fontSize and fontFamily', () => {
    const result = expressionStyleSchema.safeParse({
      ...defaultStyle,
      fontSize: 16,
      fontFamily: 'monospace',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid hex color', () => {
    const result = expressionStyleSchema.safeParse({
      ...defaultStyle,
      strokeColor: 'red',
    });
    expect(result.success).toBe(false);
  });

  it('rejects strokeWidth out of range', () => {
    const tooLow = expressionStyleSchema.safeParse({ ...defaultStyle, strokeWidth: 0 });
    const tooHigh = expressionStyleSchema.safeParse({ ...defaultStyle, strokeWidth: 11 });
    expect(tooLow.success).toBe(false);
    expect(tooHigh.success).toBe(false);
  });

  it('rejects opacity out of range', () => {
    const tooLow = expressionStyleSchema.safeParse({ ...defaultStyle, opacity: -0.1 });
    const tooHigh = expressionStyleSchema.safeParse({ ...defaultStyle, opacity: 1.1 });
    expect(tooLow.success).toBe(false);
    expect(tooHigh.success).toBe(false);
  });

  it('rejects invalid fillStyle', () => {
    const result = expressionStyleSchema.safeParse({ ...defaultStyle, fillStyle: 'dots' });
    expect(result.success).toBe(false);
  });
});

// ── Primitive Data Schemas ─────────────────────────────────

describe('Primitive data schemas', () => {
  describe('RectangleData', () => {
    it('accepts rectangle with label', () => {
      expect(rectangleDataSchema.safeParse({ kind: 'rectangle', label: 'Box' }).success).toBe(true);
    });

    it('accepts rectangle without label', () => {
      expect(rectangleDataSchema.safeParse({ kind: 'rectangle' }).success).toBe(true);
    });
  });

  describe('EllipseData', () => {
    it('accepts ellipse', () => {
      expect(ellipseDataSchema.safeParse({ kind: 'ellipse', label: 'Circle' }).success).toBe(true);
    });
  });

  describe('DiamondData', () => {
    it('accepts diamond', () => {
      expect(diamondDataSchema.safeParse({ kind: 'diamond' }).success).toBe(true);
    });
  });

  describe('LineData', () => {
    it('accepts line with points', () => {
      const result = lineDataSchema.safeParse({
        kind: 'line',
        points: [[0, 0], [100, 100]],
      });
      expect(result.success).toBe(true);
    });

    it('rejects line with fewer than 2 points', () => {
      const result = lineDataSchema.safeParse({
        kind: 'line',
        points: [[0, 0]],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ArrowData', () => {
    it('accepts arrow with arrowheads', () => {
      const result = arrowDataSchema.safeParse({
        kind: 'arrow',
        points: [[0, 0], [100, 50]],
        startArrowhead: false,
        endArrowhead: true,
      });
      expect(result.success).toBe(true);
    });

    it('accepts arrow without optional arrowhead flags', () => {
      const result = arrowDataSchema.safeParse({
        kind: 'arrow',
        points: [[0, 0], [100, 50]],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('FreehandData', () => {
    it('accepts freehand with pressure points', () => {
      const result = freehandDataSchema.safeParse({
        kind: 'freehand',
        points: [[0, 0, 0.5], [10, 10, 0.8]],
      });
      expect(result.success).toBe(true);
    });

    it('rejects freehand with 2D points', () => {
      const result = freehandDataSchema.safeParse({
        kind: 'freehand',
        points: [[0, 0], [10, 10]],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('TextData', () => {
    it('accepts valid text data', () => {
      const result = textDataSchema.safeParse({
        kind: 'text',
        text: 'Hello World',
        fontSize: 16,
        fontFamily: 'sans-serif',
        textAlign: 'center',
      });
      expect(result.success).toBe(true);
    });

    it('rejects text with empty string', () => {
      const result = textDataSchema.safeParse({
        kind: 'text',
        text: '',
        fontSize: 16,
        fontFamily: 'sans-serif',
        textAlign: 'left',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid textAlign value', () => {
      const result = textDataSchema.safeParse({
        kind: 'text',
        text: 'Hello',
        fontSize: 16,
        fontFamily: 'sans-serif',
        textAlign: 'justify',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('StickyNoteData', () => {
    it('accepts sticky note', () => {
      const result = stickyNoteDataSchema.safeParse({
        kind: 'sticky-note',
        text: 'Remember this',
        color: '#FFEB3B',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ImageData', () => {
    it('accepts image with alt text', () => {
      const result = imageDataSchema.safeParse({
        kind: 'image',
        src: 'https://example.com/img.png',
        alt: 'An image',
      });
      expect(result.success).toBe(true);
    });

    it('accepts image without alt text', () => {
      const result = imageDataSchema.safeParse({
        kind: 'image',
        src: 'data:image/png;base64,abc',
      });
      expect(result.success).toBe(true);
    });
  });
});

// ── Composite Data Schemas ─────────────────────────────────

describe('Composite data schemas', () => {
  describe('FlowchartData', () => {
    it('accepts valid flowchart', () => {
      const result = flowchartDataSchema.safeParse({
        kind: 'flowchart',
        title: 'Auth Flow',
        nodes: [
          { id: 'n1', label: 'Start', shape: 'rect' },
          { id: 'n2', label: 'Check', shape: 'diamond' },
        ],
        edges: [{ from: 'n1', to: 'n2', label: 'proceed' }],
        direction: 'TB',
      });
      expect(result.success).toBe(true);
    });

    it('rejects flowchart with no nodes', () => {
      const result = flowchartDataSchema.safeParse({
        kind: 'flowchart',
        title: 'Empty',
        nodes: [],
        edges: [],
        direction: 'TB',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid direction', () => {
      const result = flowchartDataSchema.safeParse({
        kind: 'flowchart',
        title: 'Test',
        nodes: [{ id: 'n1', label: 'X', shape: 'rect' }],
        edges: [],
        direction: 'XY',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SequenceDiagramData', () => {
    it('accepts valid sequence diagram', () => {
      const result = sequenceDiagramDataSchema.safeParse({
        kind: 'sequence-diagram',
        title: 'API Call',
        participants: [
          { id: 'client', name: 'Client' },
          { id: 'server', name: 'Server' },
        ],
        messages: [
          { from: 'client', to: 'server', label: 'GET /api', type: 'sync' },
          { from: 'server', to: 'client', label: '200 OK', type: 'reply' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects sequence diagram with fewer than 2 participants', () => {
      const result = sequenceDiagramDataSchema.safeParse({
        kind: 'sequence-diagram',
        title: 'Solo',
        participants: [{ id: 'alone', name: 'Alone' }],
        messages: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('WireframeData', () => {
    it('accepts valid wireframe', () => {
      const result = wireframeDataSchema.safeParse({
        kind: 'wireframe',
        title: 'Login Screen',
        screenSize: { width: 375, height: 812 },
        components: [
          { id: 'c1', type: 'input', label: 'Email', x: 10, y: 100, width: 355, height: 40 },
          { id: 'c2', type: 'button', label: 'Login', x: 10, y: 160, width: 355, height: 44 },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ReasoningChainData', () => {
    it('accepts valid reasoning chain', () => {
      const result = reasoningChainDataSchema.safeParse({
        kind: 'reasoning-chain',
        question: 'Why use TypeScript?',
        steps: [
          { title: 'Type Safety', content: 'Catches errors at compile time' },
          { title: 'Tooling', content: 'Better IDE support' },
        ],
        finalAnswer: 'TypeScript improves developer experience and code quality',
      });
      expect(result.success).toBe(true);
    });

    it('rejects reasoning chain with no steps', () => {
      const result = reasoningChainDataSchema.safeParse({
        kind: 'reasoning-chain',
        question: 'Why?',
        steps: [],
        finalAnswer: 'Because',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RoadmapData', () => {
    it('accepts valid roadmap', () => {
      const result = roadmapDataSchema.safeParse({
        kind: 'roadmap',
        title: 'Q1 Plan',
        orientation: 'horizontal',
        phases: [
          {
            id: 'p1',
            name: 'Phase 1',
            items: [{ id: 'i1', title: 'Setup', status: 'done' }],
          },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('MindMapData', () => {
    it('accepts valid mind map with nested branches', () => {
      const result = mindMapDataSchema.safeParse({
        kind: 'mind-map',
        centralTopic: 'InfiniCanvas',
        branches: [
          {
            id: 'b1',
            label: 'Protocol',
            children: [
              { id: 'b1a', label: 'Types', children: [] },
              { id: 'b1b', label: 'Validation', children: [] },
            ],
          },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('KanbanData', () => {
    it('accepts valid kanban board', () => {
      const result = kanbanDataSchema.safeParse({
        kind: 'kanban',
        title: 'Sprint 1',
        columns: [
          {
            id: 'col1',
            title: 'To Do',
            cards: [{ id: 'card1', title: 'Task 1' }],
          },
          {
            id: 'col2',
            title: 'Done',
            cards: [],
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects kanban with no columns', () => {
      const result = kanbanDataSchema.safeParse({
        kind: 'kanban',
        title: 'Empty Board',
        columns: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('DecisionTreeData', () => {
    it('accepts valid decision tree with recursive options', () => {
      const result = decisionTreeDataSchema.safeParse({
        kind: 'decision-tree',
        question: 'Which framework?',
        options: [
          {
            label: 'React',
            outcome: 'Use React',
            children: [],
          },
          {
            label: 'Vue',
            children: [
              {
                label: 'Vue 2',
                outcome: 'Legacy',
                children: [],
              },
              {
                label: 'Vue 3',
                outcome: 'Modern',
                children: [],
              },
            ],
          },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('CollaborationDiagramData', () => {
    it('accepts valid collaboration diagram', () => {
      const result = collaborationDiagramDataSchema.safeParse({
        kind: 'collaboration-diagram',
        title: 'System Architecture',
        objects: [
          { id: 'o1', name: 'Frontend', type: 'component' },
          { id: 'o2', name: 'Backend', type: 'component' },
        ],
        links: [
          { from: 'o1', to: 'o2', label: 'REST API', direction: 'unidirectional' },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('SlideData', () => {
    it('accepts valid slide', () => {
      const result = slideDataSchema.safeParse({
        kind: 'slide',
        title: 'Introduction',
        bullets: ['Point 1', 'Point 2'],
        layout: 'bullets',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('CodeBlockData', () => {
    it('accepts valid code block', () => {
      const result = codeBlockDataSchema.safeParse({
        kind: 'code-block',
        language: 'typescript',
        code: 'const x = 42;',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('TableData', () => {
    it('accepts valid table', () => {
      const result = tableDataSchema.safeParse({
        kind: 'table',
        headers: ['Name', 'Age'],
        rows: [['Alice', '30'], ['Bob', '25']],
      });
      expect(result.success).toBe(true);
    });

    it('rejects table with no headers', () => {
      const result = tableDataSchema.safeParse({
        kind: 'table',
        headers: [],
        rows: [],
      });
      expect(result.success).toBe(false);
    });
  });
});

// ── Annotation Data Schemas ────────────────────────────────

describe('Annotation data schemas', () => {
  describe('CommentData', () => {
    it('accepts valid comment', () => {
      const result = commentDataSchema.safeParse({
        kind: 'comment',
        text: 'This looks good',
        targetExpressionId: 'expr-1',
        resolved: false,
      });
      expect(result.success).toBe(true);
    });

    it('rejects comment with empty text', () => {
      const result = commentDataSchema.safeParse({
        kind: 'comment',
        text: '',
        targetExpressionId: 'expr-1',
        resolved: false,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CalloutData', () => {
    it('accepts valid callout', () => {
      const result = calloutDataSchema.safeParse({
        kind: 'callout',
        text: 'Note this!',
        targetExpressionId: 'expr-2',
        position: 'top',
      });
      expect(result.success).toBe(true);
    });

    it('rejects callout with invalid position', () => {
      const result = calloutDataSchema.safeParse({
        kind: 'callout',
        text: 'Note',
        targetExpressionId: 'expr-2',
        position: 'center',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('HighlightData', () => {
    it('accepts valid highlight', () => {
      const result = highlightDataSchema.safeParse({
        kind: 'highlight',
        targetExpressionIds: ['expr-1', 'expr-2'],
        color: '#FF0000',
      });
      expect(result.success).toBe(true);
    });

    it('rejects highlight with no targets', () => {
      const result = highlightDataSchema.safeParse({
        kind: 'highlight',
        targetExpressionIds: [],
        color: '#FF0000',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('MarkerData', () => {
    it('accepts marker with icon', () => {
      const result = markerDataSchema.safeParse({
        kind: 'marker',
        label: 'Important',
        icon: 'star',
      });
      expect(result.success).toBe(true);
    });

    it('accepts marker without icon', () => {
      const result = markerDataSchema.safeParse({
        kind: 'marker',
        label: 'Flag',
      });
      expect(result.success).toBe(true);
    });
  });
});

// ── ExpressionData discriminated union ─────────────────────

describe('ExpressionData discriminated union', () => {
  it('accepts rectangle via discriminated union', () => {
    const result = expressionDataSchema.safeParse({ kind: 'rectangle', label: 'Box' });
    expect(result.success).toBe(true);
  });

  it('accepts flowchart via discriminated union', () => {
    const result = expressionDataSchema.safeParse({
      kind: 'flowchart',
      title: 'Test',
      nodes: [{ id: 'n1', label: 'Start', shape: 'rect' }],
      edges: [],
      direction: 'TB',
    });
    expect(result.success).toBe(true);
  });

  it('accepts comment via discriminated union', () => {
    const result = expressionDataSchema.safeParse({
      kind: 'comment',
      text: 'Hello',
      targetExpressionId: 'e1',
      resolved: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown kind', () => {
    const result = expressionDataSchema.safeParse({ kind: 'unknown-thing' });
    expect(result.success).toBe(false);
  });
});

// ── VisualExpression ───────────────────────────────────────

describe('VisualExpression schema', () => {
  it('accepts a valid rectangle expression', () => {
    const expr = makeExpression({ kind: 'rectangle', label: 'Test' });
    const result = visualExpressionSchema.safeParse(expr);
    expect(result.success).toBe(true);
  });

  it('accepts a valid flowchart expression', () => {
    const expr = makeExpression({
      kind: 'flowchart',
      title: 'Test Flow',
      nodes: [{ id: 'n1', label: 'Start', shape: 'rect' }],
      edges: [],
      direction: 'LR',
    });
    const result = visualExpressionSchema.safeParse(expr);
    expect(result.success).toBe(true);
  });

  it('rejects expression with missing id', () => {
    const expr = makeExpression({ kind: 'rectangle' });
    const { id: _, ...noId } = expr;
    const result = visualExpressionSchema.safeParse(noId);
    expect(result.success).toBe(false);
  });

  it('rejects expression with zero-size dimensions', () => {
    const expr = makeExpression({ kind: 'rectangle' });
    expr.size = { width: 0, height: 100 };
    const result = visualExpressionSchema.safeParse(expr);
    expect(result.success).toBe(false);
  });

  it('accepts expression with optional parentId and children', () => {
    const expr = {
      ...makeExpression({ kind: 'rectangle' }),
      parentId: 'parent-1',
      children: ['child-1', 'child-2'],
    };
    const result = visualExpressionSchema.safeParse(expr);
    expect(result.success).toBe(true);
  });
});

// ── Protocol Operation Schemas ─────────────────────────────

describe('Protocol operation schemas', () => {
  it('accepts a valid create operation', () => {
    const op = {
      id: 'op-1',
      type: 'create',
      author: humanAuthor,
      timestamp: Date.now(),
      payload: {
        type: 'create',
        expressionId: 'expr-new',
        kind: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 100, height: 50 },
        data: { kind: 'rectangle', label: 'New Box' },
      },
    };
    const result = protocolOperationSchema.safeParse(op);
    expect(result.success).toBe(true);
  });

  it('accepts a valid move operation', () => {
    const op = {
      id: 'op-2',
      type: 'move',
      author: agentAuthor,
      timestamp: Date.now(),
      payload: {
        type: 'move',
        expressionId: 'expr-1',
        from: { x: 0, y: 0 },
        to: { x: 100, y: 200 },
      },
    };
    const result = protocolOperationSchema.safeParse(op);
    expect(result.success).toBe(true);
  });

  it('accepts a valid delete operation', () => {
    const op = {
      id: 'op-3',
      type: 'delete',
      author: humanAuthor,
      timestamp: Date.now(),
      payload: {
        type: 'delete',
        expressionIds: ['expr-1', 'expr-2'],
      },
    };
    const result = protocolOperationSchema.safeParse(op);
    expect(result.success).toBe(true);
  });

  it('accepts a valid group operation', () => {
    const op = {
      id: 'op-4',
      type: 'group',
      author: humanAuthor,
      timestamp: Date.now(),
      payload: {
        type: 'group',
        expressionIds: ['expr-1', 'expr-2'],
        groupId: 'group-1',
      },
    };
    const result = protocolOperationSchema.safeParse(op);
    expect(result.success).toBe(true);
  });

  it('accepts a valid style operation', () => {
    const op = {
      id: 'op-5',
      type: 'style',
      author: humanAuthor,
      timestamp: Date.now(),
      payload: {
        type: 'style',
        expressionIds: ['expr-1'],
        style: { fillStyle: 'hachure', opacity: 0.8 },
      },
    };
    const result = protocolOperationSchema.safeParse(op);
    expect(result.success).toBe(true);
  });

  it('accepts a valid query operation', () => {
    const op = {
      id: 'op-6',
      type: 'query',
      author: agentAuthor,
      timestamp: Date.now(),
      payload: {
        type: 'query',
        kind: 'flowchart',
        tags: ['architecture'],
      },
    };
    const result = protocolOperationSchema.safeParse(op);
    expect(result.success).toBe(true);
  });

  it('accepts a valid snapshot operation', () => {
    const op = {
      id: 'op-7',
      type: 'snapshot',
      author: humanAuthor,
      timestamp: Date.now(),
      payload: {
        type: 'snapshot',
        label: 'Before refactor',
        expressionIds: [],
      },
    };
    const result = protocolOperationSchema.safeParse(op);
    expect(result.success).toBe(true);
  });

  it('accepts a valid morph operation', () => {
    const op = {
      id: 'op-8',
      type: 'morph',
      author: agentAuthor,
      timestamp: Date.now(),
      payload: {
        type: 'morph',
        expressionId: 'expr-1',
        fromKind: 'rectangle',
        toKind: 'diamond',
        newData: { kind: 'diamond', label: 'Decision?' },
      },
    };
    const result = protocolOperationSchema.safeParse(op);
    expect(result.success).toBe(true);
  });

  it('rejects operation with missing required fields', () => {
    const result = protocolOperationSchema.safeParse({
      type: 'create',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects operation with invalid type', () => {
    const result = protocolOperationSchema.safeParse({
      id: 'op-bad',
      type: 'explode',
      author: humanAuthor,
      timestamp: Date.now(),
      payload: { type: 'explode' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects payload with mismatched type', () => {
    const result = operationPayloadSchema.safeParse({
      type: 'create',
      // missing expressionId, kind, position, size, data
    });
    expect(result.success).toBe(false);
  });
});

// ── kind/data.kind mismatch validation ──────────────────────

describe('VisualExpression kind/data.kind consistency', () => {
  it('rejects expression where kind does not match data.kind', () => {
    const result = visualExpressionSchema.safeParse({
      id: 'mismatch-1',
      kind: 'rectangle',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
      angle: 0,
      style: {
        strokeColor: '#000000',
        backgroundColor: 'transparent',
        fillStyle: 'none',
        strokeWidth: 2,
        roughness: 1,
        opacity: 1,
      },
      meta: {
        author: humanAuthor,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        locked: false,
      },
      data: { kind: 'ellipse' },  // mismatch!
    });
    expect(result.success).toBe(false);
  });

  it('accepts expression where kind matches data.kind', () => {
    const result = visualExpressionSchema.safeParse({
      id: 'match-1',
      kind: 'rectangle',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
      angle: 0,
      style: {
        strokeColor: '#000000',
        backgroundColor: 'transparent',
        fillStyle: 'none',
        strokeWidth: 2,
        roughness: 1,
        opacity: 1,
      },
      meta: {
        author: humanAuthor,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        locked: false,
      },
      data: { kind: 'rectangle' },
    });
    expect(result.success).toBe(true);
  });
});

// ── R3: CreatePayload with style/angle ─────────────────────
describe('CreatePayload style/angle fields (R3)', () => {
  it('accepts create payload with optional style and angle', () => {
    const result = createPayloadSchema.safeParse({
      type: 'create',
      expressionId: 'expr-1',
      kind: 'rectangle',
      position: { x: 10, y: 20 },
      size: { width: 100, height: 50 },
      data: { kind: 'rectangle', label: 'Box' },
      style: {
        strokeColor: '#ff0000',
        backgroundColor: '#00ff00',
        fillStyle: 'solid',
        strokeWidth: 3,
        roughness: 0,
        opacity: 0.8,
      },
      angle: 45,
    });
    expect(result.success).toBe(true);
  });

  it('accepts create payload without style and angle (backwards compatible)', () => {
    const result = createPayloadSchema.safeParse({
      type: 'create',
      expressionId: 'expr-1',
      kind: 'rectangle',
      position: { x: 10, y: 20 },
      size: { width: 100, height: 50 },
      data: { kind: 'rectangle' },
    });
    expect(result.success).toBe(true);
  });

  it('roundtrip: style in create payload is preserved through validation', () => {
    const customStyle = {
      strokeColor: '#ff0000',
      backgroundColor: '#00ff00',
      fillStyle: 'solid' as const,
      strokeWidth: 5,
      roughness: 2,
      opacity: 0.5,
    };
    const payload = {
      type: 'create',
      expressionId: 'expr-1',
      kind: 'rectangle',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
      data: { kind: 'rectangle' },
      style: customStyle,
      angle: 30,
    };
    const result = createPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.style).toEqual(customStyle);
      expect(result.data.angle).toBe(30);
    }
  });
});

// ── R4: Image src validation ───────────────────────────────
describe('Image src validation (R4)', () => {
  it('rejects javascript: URI', () => {
    const result = imageDataSchema.safeParse({
      kind: 'image',
      src: 'javascript:alert(1)',
    });
    expect(result.success).toBe(false);
  });

  it('rejects data:text/html URI', () => {
    const result = imageDataSchema.safeParse({
      kind: 'image',
      src: 'data:text/html,<script>alert(1)</script>',
    });
    expect(result.success).toBe(false);
  });

  it('accepts https:// URL', () => {
    const result = imageDataSchema.safeParse({
      kind: 'image',
      src: 'https://example.com/img.png',
    });
    expect(result.success).toBe(true);
  });

  it('accepts http:// URL', () => {
    const result = imageDataSchema.safeParse({
      kind: 'image',
      src: 'http://example.com/photo.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('accepts data:image/png;base64 URI', () => {
    const result = imageDataSchema.safeParse({
      kind: 'image',
      src: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(result.success).toBe(true);
  });

  it('accepts data:image/jpeg;base64 URI', () => {
    const result = imageDataSchema.safeParse({
      kind: 'image',
      src: 'data:image/jpeg;base64,/9j/4AAQ=',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty string', () => {
    const result = imageDataSchema.safeParse({
      kind: 'image',
      src: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects ftp:// URL', () => {
    const result = imageDataSchema.safeParse({
      kind: 'image',
      src: 'ftp://example.com/file.png',
    });
    expect(result.success).toBe(false);
  });
});

// ── I2-2: DEFAULT_EXPRESSION_STYLE ─────────────────────────
describe('DEFAULT_EXPRESSION_STYLE (I2-2)', () => {
  it('exports canonical default values', () => {
    expect(DEFAULT_EXPRESSION_STYLE.strokeColor).toBe('#1e1e1e');
    expect(DEFAULT_EXPRESSION_STYLE.backgroundColor).toBe('transparent');
    expect(DEFAULT_EXPRESSION_STYLE.fillStyle).toBe('hachure');
    expect(DEFAULT_EXPRESSION_STYLE.strokeWidth).toBe(2);
    expect(DEFAULT_EXPRESSION_STYLE.roughness).toBe(1);
    expect(DEFAULT_EXPRESSION_STYLE.opacity).toBe(1);
  });

  it('passes its own schema validation', () => {
    const result = expressionStyleSchema.safeParse(DEFAULT_EXPRESSION_STYLE);
    expect(result.success).toBe(true);
  });
});
