/**
 * Unit tests for S7-3 and S7-4 schema hardening.
 *
 * S7-3: Recursive schemas (mindMapBranch, decisionOption) have depth limits.
 * S7-4: All string fields have .max() length constraints.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import {
  // Data schemas
  rectangleDataSchema,
  ellipseDataSchema,
  diamondDataSchema,
  textDataSchema,
  stickyNoteDataSchema,
  imageDataSchema,
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
  commentDataSchema,
  calloutDataSchema,
  highlightDataSchema,
  markerDataSchema,
  // Full expression
  visualExpressionSchema,
  expressionStyleSchema,
  // Helpers
  withMaxDepth,
} from '../index.js';

// ── Test helpers ───────────────────────────────────────────

const humanAuthor = { type: 'human' as const, id: 'user-1', name: 'Alice' };

const defaultStyle = {
  strokeColor: '#000000',
  backgroundColor: 'transparent',
  fillStyle: 'none' as const,
  strokeWidth: 2,
  roughness: 0,
  opacity: 1,
};

const defaultMeta = {
  author: humanAuthor,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  tags: [],
  locked: false,
};

function makeExpression(data: Record<string, unknown>) {
  return {
    id: 'expr-1',
    kind: (data as { kind: string }).kind,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    angle: 0,
    style: defaultStyle,
    meta: defaultMeta,
    data,
  };
}

/** Generate a string of given length. */
function strOfLength(n: number): string {
  return 'x'.repeat(n);
}

/** Build nested mind map branches to a given depth. */
function buildNestedBranches(depth: number): Record<string, unknown> {
  let current: Record<string, unknown> = { id: 'leaf', label: 'Leaf', children: [] };
  for (let i = depth - 1; i >= 1; i--) {
    current = { id: `branch-${i}`, label: `Branch ${i}`, children: [current] };
  }
  return current;
}

/** Build nested decision options to a given depth. */
function buildNestedOptions(depth: number): Record<string, unknown> {
  let current: Record<string, unknown> = { label: 'Leaf', children: [] };
  for (let i = depth - 1; i >= 1; i--) {
    current = { label: `Option ${i}`, children: [current] };
  }
  return current;
}

// ═══════════════════════════════════════════════════════════
// S7-4: String field max-length constraints
// ═══════════════════════════════════════════════════════════

describe('S7-4: String field max-length constraints', () => {
  // ── label/title/name fields → max 500 ───────────────────

  describe('label/title/name fields (max 500)', () => {
    it('rejects rectangle label exceeding 500 chars', () => {
      const result = rectangleDataSchema.safeParse({
        kind: 'rectangle',
        label: strOfLength(501),
      });
      expect(result.success).toBe(false);
    });

    it('accepts rectangle label at exactly 500 chars', () => {
      const result = rectangleDataSchema.safeParse({
        kind: 'rectangle',
        label: strOfLength(500),
      });
      expect(result.success).toBe(true);
    });

    it('rejects ellipse label exceeding 500 chars', () => {
      const result = ellipseDataSchema.safeParse({
        kind: 'ellipse',
        label: strOfLength(501),
      });
      expect(result.success).toBe(false);
    });

    it('rejects diamond label exceeding 500 chars', () => {
      const result = diamondDataSchema.safeParse({
        kind: 'diamond',
        label: strOfLength(501),
      });
      expect(result.success).toBe(false);
    });

    it('rejects flowchart title exceeding 500 chars', () => {
      const result = flowchartDataSchema.safeParse({
        kind: 'flowchart',
        title: strOfLength(501),
        nodes: [{ id: 'n1', label: 'A', shape: 'rect' }],
        edges: [],
        direction: 'TB',
      });
      expect(result.success).toBe(false);
    });

    it('rejects kanban title exceeding 500 chars', () => {
      const result = kanbanDataSchema.safeParse({
        kind: 'kanban',
        title: strOfLength(501),
        columns: [{ id: 'c1', title: 'Todo', cards: [] }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects marker label exceeding 500 chars', () => {
      const result = markerDataSchema.safeParse({
        kind: 'marker',
        label: strOfLength(501),
      });
      expect(result.success).toBe(false);
    });
  });

  // ── text/description/content fields → max 10,000 ────────

  describe('text/description/content fields (max 10_000)', () => {
    it('rejects text content exceeding 10,000 chars', () => {
      const result = textDataSchema.safeParse({
        kind: 'text',
        text: strOfLength(10_001),
        fontSize: 16,
        fontFamily: 'Arial',
        textAlign: 'left',
      });
      expect(result.success).toBe(false);
    });

    it('accepts text content at exactly 10,000 chars', () => {
      const result = textDataSchema.safeParse({
        kind: 'text',
        text: strOfLength(10_000),
        fontSize: 16,
        fontFamily: 'Arial',
        textAlign: 'left',
      });
      expect(result.success).toBe(true);
    });

    it('rejects sticky note text exceeding 10,000 chars', () => {
      const result = stickyNoteDataSchema.safeParse({
        kind: 'sticky-note',
        text: strOfLength(10_001),
        color: 'yellow',
      });
      expect(result.success).toBe(false);
    });

    it('rejects comment text exceeding 10,000 chars', () => {
      const result = commentDataSchema.safeParse({
        kind: 'comment',
        text: strOfLength(10_001),
        targetExpressionId: 'e1',
        resolved: false,
      });
      expect(result.success).toBe(false);
    });

    it('rejects callout text exceeding 10,000 chars', () => {
      const result = calloutDataSchema.safeParse({
        kind: 'callout',
        text: strOfLength(10_001),
        targetExpressionId: 'e1',
        position: 'top',
      });
      expect(result.success).toBe(false);
    });

    it('rejects reasoning chain question exceeding 10,000 chars', () => {
      const result = reasoningChainDataSchema.safeParse({
        kind: 'reasoning-chain',
        question: strOfLength(10_001),
        steps: [{ title: 'Step 1', content: 'Content' }],
        finalAnswer: 'Answer',
      });
      expect(result.success).toBe(false);
    });

    it('rejects reasoning chain finalAnswer exceeding 10,000 chars', () => {
      const result = reasoningChainDataSchema.safeParse({
        kind: 'reasoning-chain',
        question: 'Question?',
        steps: [{ title: 'Step 1', content: 'Content' }],
        finalAnswer: strOfLength(10_001),
      });
      expect(result.success).toBe(false);
    });

    it('rejects kanban card description exceeding 10,000 chars', () => {
      const result = kanbanDataSchema.safeParse({
        kind: 'kanban',
        title: 'Board',
        columns: [{
          id: 'c1',
          title: 'Todo',
          cards: [{ id: 'k1', title: 'Task', description: strOfLength(10_001) }],
        }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects decision tree question exceeding 10,000 chars', () => {
      const result = decisionTreeDataSchema.safeParse({
        kind: 'decision-tree',
        question: strOfLength(10_001),
        options: [{ label: 'Yes', children: [] }],
      });
      expect(result.success).toBe(false);
    });
  });

  // ── code field → max 100,000 ────────────────────────────

  describe('code field (max 100_000)', () => {
    it('rejects code exceeding 100,000 chars', () => {
      const result = codeBlockDataSchema.safeParse({
        kind: 'code-block',
        language: 'typescript',
        code: strOfLength(100_001),
      });
      expect(result.success).toBe(false);
    });

    it('accepts code at exactly 100,000 chars', () => {
      const result = codeBlockDataSchema.safeParse({
        kind: 'code-block',
        language: 'typescript',
        code: strOfLength(100_000),
      });
      expect(result.success).toBe(true);
    });
  });

  // ── image src field → max 2,000,000 ─────────────────────

  describe('image src field (max 2_000_000)', () => {
    it('rejects image src exceeding 2,000,000 chars', () => {
      const longDataUri = 'data:image/' + strOfLength(2_000_000);
      const result = imageDataSchema.safeParse({
        kind: 'image',
        src: longDataUri,
      });
      expect(result.success).toBe(false);
    });

    it('accepts image src within limit', () => {
      const result = imageDataSchema.safeParse({
        kind: 'image',
        src: 'https://example.com/img.png',
      });
      expect(result.success).toBe(true);
    });
  });

  // ── expressionStyleSchema fontFamily ─────────────────────

  describe('expressionStyle fontFamily (max 500)', () => {
    it('rejects fontFamily exceeding 500 chars', () => {
      const result = expressionStyleSchema.safeParse({
        ...defaultStyle,
        fontFamily: strOfLength(501),
      });
      expect(result.success).toBe(false);
    });
  });

  // ── table headers and rows ──────────────────────────────

  describe('table string constraints', () => {
    it('rejects table header exceeding 500 chars', () => {
      const result = tableDataSchema.safeParse({
        kind: 'table',
        headers: [strOfLength(501)],
        rows: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects table cell exceeding 10,000 chars', () => {
      const result = tableDataSchema.safeParse({
        kind: 'table',
        headers: ['Col1'],
        rows: [[strOfLength(10_001)]],
      });
      expect(result.success).toBe(false);
    });
  });

  // ── slide bullets ───────────────────────────────────────

  describe('slide bullet string constraints', () => {
    it('rejects bullet exceeding 10,000 chars', () => {
      const result = slideDataSchema.safeParse({
        kind: 'slide',
        title: 'Title',
        bullets: [strOfLength(10_001)],
        layout: 'bullets',
      });
      expect(result.success).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// S7-3: Recursive schema depth limits
// ═══════════════════════════════════════════════════════════

describe('S7-3: Recursive schema depth limits', () => {
  describe('Mind map depth limit (max 10)', () => {
    it('accepts mind map with depth 10', () => {
      const branch = buildNestedBranches(10);
      const expr = makeExpression({
        kind: 'mind-map',
        centralTopic: 'Root',
        branches: [branch],
      });
      const result = visualExpressionSchema.safeParse(expr);
      expect(result.success).toBe(true);
    });

    it('rejects mind map with depth 11', () => {
      const branch = buildNestedBranches(11);
      const expr = makeExpression({
        kind: 'mind-map',
        centralTopic: 'Root',
        branches: [branch],
      });
      const result = visualExpressionSchema.safeParse(expr);
      expect(result.success).toBe(false);
    });

    it('accepts mind map with flat branches (depth 1)', () => {
      const expr = makeExpression({
        kind: 'mind-map',
        centralTopic: 'Root',
        branches: [
          { id: 'b1', label: 'Branch 1', children: [] },
          { id: 'b2', label: 'Branch 2', children: [] },
        ],
      });
      const result = visualExpressionSchema.safeParse(expr);
      expect(result.success).toBe(true);
    });
  });

  describe('Decision tree depth limit (max 8)', () => {
    it('accepts decision tree with depth 8', () => {
      const option = buildNestedOptions(8);
      const expr = makeExpression({
        kind: 'decision-tree',
        question: 'Root question?',
        options: [option],
      });
      const result = visualExpressionSchema.safeParse(expr);
      expect(result.success).toBe(true);
    });

    it('rejects decision tree with depth 9', () => {
      const option = buildNestedOptions(9);
      const expr = makeExpression({
        kind: 'decision-tree',
        question: 'Root question?',
        options: [option],
      });
      const result = visualExpressionSchema.safeParse(expr);
      expect(result.success).toBe(false);
    });

    it('accepts decision tree with flat options (depth 1)', () => {
      const expr = makeExpression({
        kind: 'decision-tree',
        question: 'Choose?',
        options: [
          { label: 'A', children: [] },
          { label: 'B', children: [] },
        ],
      });
      const result = visualExpressionSchema.safeParse(expr);
      expect(result.success).toBe(true);
    });
  });

  describe('withMaxDepth helper', () => {
    it('exports withMaxDepth as a reusable helper', () => {
      expect(typeof withMaxDepth).toBe('function');
    });
  });
});
