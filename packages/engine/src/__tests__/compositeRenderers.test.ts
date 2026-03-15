/**
 * Unit tests for the 8 remaining composite renderers.
 *
 * Covers: kanban, table, wireframe, roadmap, code-block, slide,
 * collaboration-diagram, and decision-tree renderers.
 *
 * Each renderer is tested for:
 * - Rendering with known data without errors (happy path)
 * - Correct element count (fillText / draw calls)
 * - Empty data gracefully handled (AC10)
 * - Self-registration in composite registry (AC9)
 *
 * Ticket #17 — Remaining Composite Renderers
 *
 * @module
 */

import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import type {
  VisualExpression,
  ExpressionStyle,
  KanbanData,
  TableData,
  WireframeData,
  RoadmapData,
  CodeBlockData,
  SlideData,
  CollaborationDiagramData,
  DecisionTreeData,
} from '@infinicanvas/protocol';
import {
  getCompositeRenderer,
  clearCompositeRenderers,
} from '../renderer/compositeRegistry.js';

// ── Global stubs for browser APIs ────────────────────────────

class Path2DStub {
  moveTo = vi.fn();
  lineTo = vi.fn();
  closePath = vi.fn();
}

class ImageStub {
  src = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

beforeAll(() => {
  vi.stubGlobal('Path2D', Path2DStub);
  vi.stubGlobal('Image', ImageStub);
});

afterAll(() => {
  vi.unstubAllGlobals();
  clearCompositeRenderers();
});

// ── Helpers ──────────────────────────────────────────────────

function makeStyle(overrides: Partial<ExpressionStyle> = {}): ExpressionStyle {
  return {
    strokeColor: '#000000',
    backgroundColor: '#ffffff',
    fillStyle: 'solid',
    strokeWidth: 2,
    roughness: 1,
    opacity: 1,
    ...overrides,
  };
}

function makeExpression(
  id: string,
  kind: string,
  data: Record<string, unknown>,
  overrides: Partial<VisualExpression> = {},
): VisualExpression {
  return {
    id,
    kind: kind as VisualExpression['kind'],
    position: { x: 100, y: 100 },
    size: { width: 400, height: 300 },
    angle: 0,
    style: makeStyle(),
    meta: {
      author: { type: 'human', id: 'user-1', name: 'Test' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data: data as VisualExpression['data'],
    ...overrides,
  };
}

function createMockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    rotate: vi.fn(),
    translate: vi.fn(),
    quadraticCurveTo: vi.fn(),
    roundRect: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline,
    globalAlpha: 1,
    canvas: { width: 800, height: 600 },
  } as unknown as CanvasRenderingContext2D;
}

function createMockRoughCanvas() {
  return {
    rectangle: vi.fn(() => ({ shape: 'rectangle', options: {}, sets: [] })),
    ellipse: vi.fn(() => ({ shape: 'ellipse', options: {}, sets: [] })),
    polygon: vi.fn(() => ({ shape: 'polygon', options: {}, sets: [] })),
    linearPath: vi.fn(() => ({ shape: 'linearPath', options: {}, sets: [] })),
    line: vi.fn(() => ({ shape: 'line', options: {}, sets: [] })),
    draw: vi.fn(),
  };
}

// ── AC1: Kanban Renderer ─────────────────────────────────────

describe('kanbanRenderer [AC1]', () => {
  let renderKanban: typeof import('../renderer/composites/kanbanRenderer.js').renderKanban;

  beforeAll(async () => {
    const mod = await import('../renderer/composites/kanbanRenderer.js');
    renderKanban = mod.renderKanban;
  });


  it('[HAPPY] renders kanban with columns and cards without error', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: KanbanData = {
      kind: 'kanban',
      title: 'Sprint Board',
      columns: [
        { id: 'c1', title: 'To Do', cards: [{ id: 'k1', title: 'Task A' }, { id: 'k2', title: 'Task B' }] },
        { id: 'c2', title: 'In Progress', cards: [{ id: 'k3', title: 'Task C' }] },
        { id: 'c3', title: 'Done', cards: [] },
      ],
    };
    const expr = makeExpression('kb-1', 'kanban', data as unknown as Record<string, unknown>);

    expect(() => renderKanban(ctx, expr, rc as any)).not.toThrow();

    // Should render title + 3 column headers + 3 card titles
    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Sprint Board');
    expect(textCalls).toContain('To Do');
    expect(textCalls).toContain('In Progress');
    expect(textCalls).toContain('Done');
    expect(textCalls).toContain('Task A');
    expect(textCalls).toContain('Task B');
    expect(textCalls).toContain('Task C');

    // 3 cards = 3 card rectangles drawn via Rough.js
    expect(rc.rectangle.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('[EMPTY] renders empty kanban (no columns) without crash [AC10]', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: KanbanData = { kind: 'kanban', title: 'Empty Board', columns: [] };
    const expr = makeExpression('kb-empty', 'kanban', data as unknown as Record<string, unknown>);

    expect(() => renderKanban(ctx, expr, rc as any)).not.toThrow();
    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Empty Board');
  });

  it('[REGISTRATION] self-registers as "kanban" in composite registry [AC9]', () => {
    // Module side-effect registers on first import (in beforeAll).
    // Verify the function is callable from the registry.
    const renderer = getCompositeRenderer('kanban');
    expect(renderer).not.toBeNull();
    expect(typeof renderer).toBe('function');
  });
});

// ── AC2: Table Renderer ──────────────────────────────────────

describe('tableRenderer [AC2]', () => {
  let renderTable: typeof import('../renderer/composites/tableRenderer.js').renderTable;

  beforeAll(async () => {
    const mod = await import('../renderer/composites/tableRenderer.js');
    renderTable = mod.renderTable;
  });


  it('[HAPPY] renders table with headers and rows', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: TableData = {
      kind: 'table',
      headers: ['Name', 'Age', 'City'],
      rows: [
        ['Alice', '30', 'NYC'],
        ['Bob', '25', 'LA'],
      ],
    };
    const expr = makeExpression('tbl-1', 'table', data as unknown as Record<string, unknown>);

    expect(() => renderTable(ctx, expr, rc as any)).not.toThrow();

    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Name');
    expect(textCalls).toContain('Age');
    expect(textCalls).toContain('City');
    expect(textCalls).toContain('Alice');
    expect(textCalls).toContain('Bob');

    // Grid lines drawn via Rough.js
    expect(rc.line.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('[EMPTY] renders table with no rows without crash [AC10]', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: TableData = { kind: 'table', headers: [], rows: [] };
    const expr = makeExpression('tbl-empty', 'table', data as unknown as Record<string, unknown>);

    expect(() => renderTable(ctx, expr, rc as any)).not.toThrow();
  });

  it('[REGISTRATION] self-registers as "table" [AC9]', () => {
    const renderer = getCompositeRenderer('table');
    expect(renderer).not.toBeNull();
    expect(typeof renderer).toBe('function');
  });
});

// ── AC3: Wireframe Renderer ──────────────────────────────────

describe('wireframeRenderer [AC3]', () => {
  let renderWireframe: typeof import('../renderer/composites/wireframeRenderer.js').renderWireframe;

  beforeAll(async () => {
    const mod = await import('../renderer/composites/wireframeRenderer.js');
    renderWireframe = mod.renderWireframe;
  });


  it('[HAPPY] renders wireframe with components showing type labels', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: WireframeData = {
      kind: 'wireframe',
      title: 'Login Page',
      screenSize: { width: 375, height: 667 },
      components: [
        { id: 'w1', type: 'input', label: 'Email', x: 20, y: 50, width: 200, height: 30 },
        { id: 'w2', type: 'button', label: 'Submit', x: 20, y: 100, width: 100, height: 40 },
        { id: 'w3', type: 'text', label: 'Welcome', x: 20, y: 10, width: 200, height: 20 },
      ],
    };
    const expr = makeExpression('wf-1', 'wireframe', data as unknown as Record<string, unknown>);

    expect(() => renderWireframe(ctx, expr, rc as any)).not.toThrow();

    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Login Page');
    // Component type labels like "[input]", "[button]"
    expect(textCalls.some((t: string) => t.includes('[input]'))).toBe(true);
    expect(textCalls.some((t: string) => t.includes('[button]'))).toBe(true);

    // 3 component rectangles
    expect(rc.rectangle.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('[EMPTY] renders wireframe with no components [AC10]', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: WireframeData = {
      kind: 'wireframe',
      title: 'Empty Screen',
      screenSize: { width: 375, height: 667 },
      components: [],
    };
    const expr = makeExpression('wf-empty', 'wireframe', data as unknown as Record<string, unknown>);

    expect(() => renderWireframe(ctx, expr, rc as any)).not.toThrow();
    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Empty Screen');
  });

  it('[REGISTRATION] self-registers as "wireframe" [AC9]', () => {
    const renderer = getCompositeRenderer('wireframe');
    expect(renderer).not.toBeNull();
    expect(typeof renderer).toBe('function');
  });
});

// ── AC4: Roadmap Renderer ────────────────────────────────────

describe('roadmapRenderer [AC4]', () => {
  let renderRoadmap: typeof import('../renderer/composites/roadmapRenderer.js').renderRoadmap;

  beforeAll(async () => {
    const mod = await import('../renderer/composites/roadmapRenderer.js');
    renderRoadmap = mod.renderRoadmap;
  });


  it('[HAPPY] renders roadmap with phases and color-coded items', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: RoadmapData = {
      kind: 'roadmap',
      title: 'Q1 Plan',
      orientation: 'horizontal',
      phases: [
        {
          id: 'p1', name: 'Phase 1', items: [
            { id: 'i1', title: 'Design', status: 'done' },
            { id: 'i2', title: 'Prototype', status: 'in-progress' },
          ],
        },
        {
          id: 'p2', name: 'Phase 2', items: [
            { id: 'i3', title: 'Build', status: 'planned' },
          ],
        },
      ],
    };
    const expr = makeExpression('rm-1', 'roadmap', data as unknown as Record<string, unknown>);

    expect(() => renderRoadmap(ctx, expr, rc as any)).not.toThrow();

    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Q1 Plan');
    expect(textCalls).toContain('Phase 1');
    expect(textCalls).toContain('Phase 2');
    expect(textCalls).toContain('Design');
    expect(textCalls).toContain('Prototype');
    expect(textCalls).toContain('Build');

    // Item chips rendered as rounded rectangles
    expect(rc.rectangle.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('[HAPPY] renders vertical roadmap without error', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: RoadmapData = {
      kind: 'roadmap',
      title: 'Vertical Plan',
      orientation: 'vertical',
      phases: [
        { id: 'p1', name: 'Start', items: [{ id: 'i1', title: 'Init', status: 'done' }] },
      ],
    };
    const expr = makeExpression('rm-v', 'roadmap', data as unknown as Record<string, unknown>);

    expect(() => renderRoadmap(ctx, expr, rc as any)).not.toThrow();
  });

  it('[EMPTY] renders roadmap with no phases [AC10]', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: RoadmapData = { kind: 'roadmap', title: 'Empty Plan', orientation: 'horizontal', phases: [] };
    const expr = makeExpression('rm-empty', 'roadmap', data as unknown as Record<string, unknown>);

    expect(() => renderRoadmap(ctx, expr, rc as any)).not.toThrow();
    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Empty Plan');
  });

  it('[REGISTRATION] self-registers as "roadmap" [AC9]', () => {
    const renderer = getCompositeRenderer('roadmap');
    expect(renderer).not.toBeNull();
    expect(typeof renderer).toBe('function');
  });
});

// ── AC5: Code Block Renderer ─────────────────────────────────

describe('codeBlockRenderer [AC5]', () => {
  let renderCodeBlock: typeof import('../renderer/composites/codeBlockRenderer.js').renderCodeBlock;

  beforeAll(async () => {
    const mod = await import('../renderer/composites/codeBlockRenderer.js');
    renderCodeBlock = mod.renderCodeBlock;
  });


  it('[HAPPY] renders code block with dark background and language label', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: CodeBlockData = {
      kind: 'code-block',
      language: 'typescript',
      code: 'const x = 42;\nconsole.log(x);',
    };
    const expr = makeExpression('cb-1', 'code-block', data as unknown as Record<string, unknown>);

    expect(() => renderCodeBlock(ctx, expr, rc as any)).not.toThrow();

    // Dark background rendered
    expect(ctx.fillRect).toHaveBeenCalled();

    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    // Language label
    expect(textCalls).toContain('typescript');
    // Code lines rendered
    expect(textCalls.some((t: string) => t.includes('const x = 42;'))).toBe(true);
  });

  it('[EMPTY] renders code block with empty code string [AC10]', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: CodeBlockData = { kind: 'code-block', language: '', code: '' };
    const expr = makeExpression('cb-empty', 'code-block', data as unknown as Record<string, unknown>);

    expect(() => renderCodeBlock(ctx, expr, rc as any)).not.toThrow();
  });

  it('[REGISTRATION] self-registers as "code-block" [AC9]', () => {
    const renderer = getCompositeRenderer('code-block');
    expect(renderer).not.toBeNull();
    expect(typeof renderer).toBe('function');
  });
});

// ── AC6: Slide Renderer ──────────────────────────────────────

describe('slideRenderer [AC6]', () => {
  let renderSlide: typeof import('../renderer/composites/slideRenderer.js').renderSlide;

  beforeAll(async () => {
    const mod = await import('../renderer/composites/slideRenderer.js');
    renderSlide = mod.renderSlide;
  });


  it('[HAPPY] renders "title" layout with centered large text', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: SlideData = { kind: 'slide', title: 'Welcome', bullets: [], layout: 'title' };
    const expr = makeExpression('sl-t', 'slide', data as unknown as Record<string, unknown>);

    expect(() => renderSlide(ctx, expr, rc as any)).not.toThrow();
    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Welcome');
  });

  it('[HAPPY] renders "bullets" layout with title and list items', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: SlideData = {
      kind: 'slide',
      title: 'Agenda',
      bullets: ['Intro', 'Demo', 'Q&A'],
      layout: 'bullets',
    };
    const expr = makeExpression('sl-b', 'slide', data as unknown as Record<string, unknown>);

    expect(() => renderSlide(ctx, expr, rc as any)).not.toThrow();
    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Agenda');
    // Bullets rendered with bullet character prefix
    expect(textCalls.some((t: string) => t.includes('Intro'))).toBe(true);
    expect(textCalls.some((t: string) => t.includes('Demo'))).toBe(true);
    expect(textCalls.some((t: string) => t.includes('Q&A'))).toBe(true);
  });

  it('[HAPPY] renders "split" layout with title and two columns', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: SlideData = {
      kind: 'slide',
      title: 'Comparison',
      bullets: ['Left A', 'Left B', 'Right A', 'Right B'],
      layout: 'split',
    };
    const expr = makeExpression('sl-s', 'slide', data as unknown as Record<string, unknown>);

    expect(() => renderSlide(ctx, expr, rc as any)).not.toThrow();
    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Comparison');
  });

  it('[EMPTY] renders slide with no bullets [AC10]', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: SlideData = { kind: 'slide', title: 'Empty Slide', bullets: [], layout: 'bullets' };
    const expr = makeExpression('sl-empty', 'slide', data as unknown as Record<string, unknown>);

    expect(() => renderSlide(ctx, expr, rc as any)).not.toThrow();
    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Empty Slide');
  });

  it('[REGISTRATION] self-registers as "slide" [AC9]', () => {
    const renderer = getCompositeRenderer('slide');
    expect(renderer).not.toBeNull();
    expect(typeof renderer).toBe('function');
  });
});

// ── AC7: Collaboration Diagram Renderer ──────────────────────

describe('collaborationDiagramRenderer [AC7]', () => {
  let renderCollaborationDiagram: typeof import('../renderer/composites/collaborationDiagramRenderer.js').renderCollaborationDiagram;

  beforeAll(async () => {
    const mod = await import('../renderer/composites/collaborationDiagramRenderer.js');
    renderCollaborationDiagram = mod.renderCollaborationDiagram;
  });


  it('[HAPPY] renders objects as rounded rectangles with links', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: CollaborationDiagramData = {
      kind: 'collaboration-diagram',
      title: 'Auth Flow',
      objects: [
        { id: 'o1', name: 'Client', type: 'actor' },
        { id: 'o2', name: 'Server', type: 'system' },
        { id: 'o3', name: 'DB', type: 'database' },
      ],
      links: [
        { from: 'o1', to: 'o2', label: 'login()', direction: 'unidirectional' },
        { from: 'o2', to: 'o3', label: 'query', direction: 'bidirectional' },
      ],
    };
    const expr = makeExpression('cd-1', 'collaboration-diagram', data as unknown as Record<string, unknown>);

    expect(() => renderCollaborationDiagram(ctx, expr, rc as any)).not.toThrow();

    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Auth Flow');
    expect(textCalls).toContain('Client');
    expect(textCalls).toContain('Server');
    expect(textCalls).toContain('DB');
    expect(textCalls).toContain('login()');
    expect(textCalls).toContain('query');

    // 3 objects = 3 rounded rectangles
    expect(rc.rectangle.mock.calls.length).toBeGreaterThanOrEqual(3);
    // 2 links = lines drawn
    expect(rc.line.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('[HAPPY] bidirectional links have arrowheads on both ends', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: CollaborationDiagramData = {
      kind: 'collaboration-diagram',
      title: 'Bi-test',
      objects: [
        { id: 'a', name: 'A', type: 'service' },
        { id: 'b', name: 'B', type: 'service' },
      ],
      links: [
        { from: 'a', to: 'b', label: 'sync', direction: 'bidirectional' },
      ],
    };
    const expr = makeExpression('cd-bi', 'collaboration-diagram', data as unknown as Record<string, unknown>);

    renderCollaborationDiagram(ctx, expr, rc as any);

    // Bidirectional draws arrowheads on both ends (ctx.fill called for arrowheads)
    expect(ctx.beginPath.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('[EMPTY] renders with no objects or links [AC10]', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: CollaborationDiagramData = {
      kind: 'collaboration-diagram',
      title: 'Empty Collab',
      objects: [],
      links: [],
    };
    const expr = makeExpression('cd-empty', 'collaboration-diagram', data as unknown as Record<string, unknown>);

    expect(() => renderCollaborationDiagram(ctx, expr, rc as any)).not.toThrow();
    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Empty Collab');
  });

  it('[REGISTRATION] self-registers as "collaboration-diagram" [AC9]', () => {
    const renderer = getCompositeRenderer('collaboration-diagram');
    expect(renderer).not.toBeNull();
    expect(typeof renderer).toBe('function');
  });
});

// ── AC8: Decision Tree Renderer ──────────────────────────────

describe('decisionTreeRenderer [AC8]', () => {
  let renderDecisionTree: typeof import('../renderer/composites/decisionTreeRenderer.js').renderDecisionTree;

  beforeAll(async () => {
    const mod = await import('../renderer/composites/decisionTreeRenderer.js');
    renderDecisionTree = mod.renderDecisionTree;
  });


  it('[HAPPY] renders root question and branching options', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: DecisionTreeData = {
      kind: 'decision-tree',
      question: 'Use TypeScript?',
      options: [
        {
          label: 'Yes',
          outcome: 'Type safety',
          children: [],
        },
        {
          label: 'No',
          children: [
            { label: 'JavaScript', outcome: 'Fast start', children: [] },
            { label: 'CoffeeScript', outcome: 'Niche', children: [] },
          ],
        },
      ],
    };
    const expr = makeExpression('dt-1', 'decision-tree', data as unknown as Record<string, unknown>);

    expect(() => renderDecisionTree(ctx, expr, rc as any)).not.toThrow();

    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Use TypeScript?');
    expect(textCalls).toContain('Yes');
    expect(textCalls).toContain('No');
    expect(textCalls.some((t: string) => t.includes('Type safety'))).toBe(true);
  });

  it('[HAPPY] respects max 4 levels depth', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    // Create a 6-level deep tree — renderer should stop at level 4
    const deepOption = (depth: number): any => ({
      label: `Level ${depth}`,
      outcome: depth >= 6 ? 'Deep' : undefined,
      children: depth < 6 ? [deepOption(depth + 1)] : [],
    });

    const data: DecisionTreeData = {
      kind: 'decision-tree',
      question: 'Deep Q?',
      options: [deepOption(1)],
    };
    const expr = makeExpression('dt-deep', 'decision-tree', data as unknown as Record<string, unknown>);

    expect(() => renderDecisionTree(ctx, expr, rc as any)).not.toThrow();

    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Deep Q?');
    expect(textCalls).toContain('Level 1');
    // Level 4 should be rendered (max depth)
    expect(textCalls).toContain('Level 4');
    // Level 5+ should NOT be rendered (beyond max depth)
    expect(textCalls).not.toContain('Level 5');
  });

  it('[EMPTY] renders decision tree with no options [AC10]', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: DecisionTreeData = { kind: 'decision-tree', question: 'Empty?', options: [] };
    const expr = makeExpression('dt-empty', 'decision-tree', data as unknown as Record<string, unknown>);

    expect(() => renderDecisionTree(ctx, expr, rc as any)).not.toThrow();
    const textCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(textCalls).toContain('Empty?');
  });

  it('[REGISTRATION] self-registers as "decision-tree" [AC9]', () => {
    const renderer = getCompositeRenderer('decision-tree');
    expect(renderer).not.toBeNull();
    expect(typeof renderer).toBe('function');
  });
});

// ── AC9: All renderers registered in composite registry ──────

describe('composite registry completeness [AC9]', () => {
  it('all 8 new renderers are registered after import', () => {
    // All modules were imported in beforeAll blocks above,
    // triggering their self-registration side effects.
    const expectedKinds = [
      'kanban',
      'table',
      'wireframe',
      'roadmap',
      'code-block',
      'slide',
      'collaboration-diagram',
      'decision-tree',
    ];

    for (const kind of expectedKinds) {
      expect(getCompositeRenderer(kind)).not.toBeNull();
    }
  });
});
