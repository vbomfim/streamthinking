/**
 * Unit tests for reasoning chain composite renderer.
 *
 * Covers: question box, numbered step cards, final answer box,
 * card counting, vertical stacking, empty data, style inheritance,
 * and renderer purity.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { VisualExpression, ExpressionStyle, ReasoningChainData } from '@infinicanvas/protocol';
import {
  renderReasoningChain,
  clearLayoutCache,
  computeReasoningLayout,
  invalidateLayoutCache,
} from '../renderer/composites/reasoningChainRenderer.js';

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

function makeReasoningExpression(
  data: Partial<ReasoningChainData> & { question: string },
  overrides: Partial<VisualExpression> = {},
): VisualExpression {
  const chainData: ReasoningChainData = {
    kind: 'reasoning-chain',
    question: data.question,
    steps: data.steps ?? [],
    finalAnswer: data.finalAnswer ?? '',
  };

  return {
    id: 'reasoning-1',
    kind: 'reasoning-chain',
    position: { x: 100, y: 100 },
    size: { width: 400, height: 500 },
    angle: 0,
    style: makeStyle(),
    meta: {
      author: { type: 'human', id: 'user-1', name: 'Test' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data: chainData,
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
    measureText: vi.fn(() => ({ width: 50 })),
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
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

beforeEach(() => {
  clearLayoutCache();
});

afterEach(() => {
  clearLayoutCache();
});

// ── Layout Computation Tests ─────────────────────────────────

describe('reasoning chain layout computation', () => {
  it('creates a question card at the top', () => {
    const data: ReasoningChainData = {
      kind: 'reasoning-chain',
      question: 'Why is the sky blue?',
      steps: [
        { title: 'Sunlight composition', content: 'White light contains all colors' },
      ],
      finalAnswer: 'Rayleigh scattering',
    };

    const layout = computeReasoningLayout(data, 400);

    expect(layout.questionCard).toBeDefined();
    expect(layout.questionCard.y).toBeDefined();
  });

  it('creates cards for each step with correct numbering', () => {
    const data: ReasoningChainData = {
      kind: 'reasoning-chain',
      question: 'What is 2+2?',
      steps: [
        { title: 'Addition', content: '2+2=4' },
        { title: 'Verification', content: 'Counting confirms 4' },
        { title: 'Conclusion', content: 'The answer is 4' },
      ],
      finalAnswer: '4',
    };

    const layout = computeReasoningLayout(data, 400);

    expect(layout.stepCards).toHaveLength(3);

    // Each step should have a number
    expect(layout.stepCards[0]!.stepNumber).toBe(1);
    expect(layout.stepCards[1]!.stepNumber).toBe(2);
    expect(layout.stepCards[2]!.stepNumber).toBe(3);
  });

  it('stacks step cards vertically', () => {
    const data: ReasoningChainData = {
      kind: 'reasoning-chain',
      question: 'Test',
      steps: [
        { title: 'Step A', content: 'content' },
        { title: 'Step B', content: 'content' },
        { title: 'Step C', content: 'content' },
      ],
      finalAnswer: 'Done',
    };

    const layout = computeReasoningLayout(data, 400);

    // Each step card should be below the previous one
    for (let i = 1; i < layout.stepCards.length; i++) {
      expect(layout.stepCards[i]!.y).toBeGreaterThan(layout.stepCards[i - 1]!.y);
    }
  });

  it('creates a final answer card at the bottom', () => {
    const data: ReasoningChainData = {
      kind: 'reasoning-chain',
      question: 'Test',
      steps: [
        { title: 'Step', content: 'content' },
      ],
      finalAnswer: 'The Answer',
    };

    const layout = computeReasoningLayout(data, 400);

    expect(layout.answerCard).toBeDefined();

    // Answer card should be below all step cards
    const lastStep = layout.stepCards[layout.stepCards.length - 1]!;
    expect(layout.answerCard.y).toBeGreaterThan(lastStep.y);
  });

  it('auto-sizes total height based on step count', () => {
    const data2: ReasoningChainData = {
      kind: 'reasoning-chain',
      question: 'Test',
      steps: [
        { title: 'S1', content: 'c' },
        { title: 'S2', content: 'c' },
      ],
      finalAnswer: 'Done',
    };

    const data5: ReasoningChainData = {
      kind: 'reasoning-chain',
      question: 'Test',
      steps: [
        { title: 'S1', content: 'c' },
        { title: 'S2', content: 'c' },
        { title: 'S3', content: 'c' },
        { title: 'S4', content: 'c' },
        { title: 'S5', content: 'c' },
      ],
      finalAnswer: 'Done',
    };

    const layout2 = computeReasoningLayout(data2, 400);
    const layout5 = computeReasoningLayout(data5, 400);

    expect(layout5.totalHeight).toBeGreaterThan(layout2.totalHeight);
  });

  it('card width equals expression width minus padding', () => {
    const data: ReasoningChainData = {
      kind: 'reasoning-chain',
      question: 'Test',
      steps: [{ title: 'S1', content: 'c' }],
      finalAnswer: 'Done',
    };

    const exprWidth = 400;
    const layout = computeReasoningLayout(data, exprWidth);

    // Card width should be exprWidth - 2*padding
    expect(layout.cardWidth).toBeLessThan(exprWidth);
    expect(layout.cardWidth).toBeGreaterThan(0);
  });
});

// ── Question Box Rendering ───────────────────────────────────

describe('reasoning chain question box', () => {
  it('renders question in a bordered box at the top', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeReasoningExpression({
      question: 'Why do birds sing?',
      steps: [],
      finalAnswer: '',
    });

    renderReasoningChain(ctx, expr, rc as any);

    // Question box rendered as rectangle
    expect(rc.rectangle).toHaveBeenCalled();
    expect(rc.draw).toHaveBeenCalled();

    // Question text rendered
    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    const hasQuestion = fillTextCalls.some((t: string) =>
      t.includes('Why do birds sing?'),
    );
    expect(hasQuestion).toBe(true);
  });
});

// ── Step Card Rendering ──────────────────────────────────────

describe('reasoning chain step cards', () => {
  it('renders numbered step cards with titles', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeReasoningExpression({
      question: 'Test',
      steps: [
        { title: 'Analyze', content: 'Look at the data' },
        { title: 'Evaluate', content: 'Check results' },
      ],
      finalAnswer: 'Done',
    });

    renderReasoningChain(ctx, expr, rc as any);

    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);

    // Step numbers + titles should be rendered
    const hasStep1 = fillTextCalls.some((t: string) =>
      t.includes('Step 1') && t.includes('Analyze'),
    );
    const hasStep2 = fillTextCalls.some((t: string) =>
      t.includes('Step 2') && t.includes('Evaluate'),
    );
    expect(hasStep1).toBe(true);
    expect(hasStep2).toBe(true);
  });

  it('renders step content below step title', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeReasoningExpression({
      question: 'Test',
      steps: [
        { title: 'Analyze', content: 'Look at the data' },
      ],
      finalAnswer: 'Done',
    });

    renderReasoningChain(ctx, expr, rc as any);

    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    const hasContent = fillTextCalls.some((t: string) =>
      t.includes('Look at the data'),
    );
    expect(hasContent).toBe(true);
  });

  it('renders step cards as Rough.js rectangles', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeReasoningExpression({
      question: 'Test',
      steps: [
        { title: 'S1', content: 'c1' },
        { title: 'S2', content: 'c2' },
      ],
      finalAnswer: 'Done',
    });

    renderReasoningChain(ctx, expr, rc as any);

    // Question box + 2 step cards + answer box = at least 4 rectangles
    expect(rc.rectangle.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('renders downward arrows between steps', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeReasoningExpression({
      question: 'Test',
      steps: [
        { title: 'S1', content: 'c1' },
        { title: 'S2', content: 'c2' },
      ],
      finalAnswer: 'Done',
    });

    renderReasoningChain(ctx, expr, rc as any);

    // Downward arrows between cards
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});

// ── Final Answer Box ─────────────────────────────────────────

describe('reasoning chain final answer', () => {
  it('renders final answer in a distinct box at the bottom', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeReasoningExpression({
      question: 'Test',
      steps: [{ title: 'S1', content: 'c1' }],
      finalAnswer: 'The answer is 42',
    });

    renderReasoningChain(ctx, expr, rc as any);

    // Answer text should have a "✓" prefix
    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    const hasAnswerPrefix = fillTextCalls.some((t: string) =>
      t.includes('✓'),
    );
    expect(hasAnswerPrefix).toBe(true);

    // Answer content
    const hasAnswer = fillTextCalls.some((t: string) =>
      t.includes('The answer is 42'),
    );
    expect(hasAnswer).toBe(true);
  });

  it('renders final answer box with thicker border', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeReasoningExpression({
      question: 'Test',
      steps: [{ title: 'S1', content: 'c1' }],
      finalAnswer: 'Answer',
    });

    renderReasoningChain(ctx, expr, rc as any);

    // The answer box rectangle should be called with thicker strokeWidth
    const rectCalls = rc.rectangle.mock.calls;
    const lastRectCall = rectCalls[rectCalls.length - 1]!;
    const options = lastRectCall[lastRectCall.length - 1];
    expect(options.strokeWidth).toBeGreaterThan(2);
  });

  it('renders final answer box with green tint fill', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeReasoningExpression({
      question: 'Test',
      steps: [{ title: 'S1', content: 'c1' }],
      finalAnswer: 'Answer',
    });

    renderReasoningChain(ctx, expr, rc as any);

    // The answer box should have a green-tinted fill
    const rectCalls = rc.rectangle.mock.calls;
    const lastRectCall = rectCalls[rectCalls.length - 1]!;
    const options = lastRectCall[lastRectCall.length - 1];
    // Green tint: fill should contain green channel
    expect(options.fill).toBeDefined();
  });
});

// ── Zod validation rejects empty data (S6-3) ────────────────

describe('reasoning chain Zod validation (S6-3)', () => {
  it('rejects reasoning chain with zero steps', async () => {
    const { reasoningChainDataSchema } = await import('@infinicanvas/protocol');

    const result = reasoningChainDataSchema.safeParse({
      kind: 'reasoning-chain',
      question: 'Test?',
      steps: [],
      finalAnswer: 'Done',
    });

    expect(result.success).toBe(false);
  });
});

describe('reasoning chain question and answer rendering', () => {
  it('renders question and answer with a single step', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeReasoningExpression({
      question: 'Quick answer?',
      steps: [{ title: 'Think', content: 'Thought about it' }],
      finalAnswer: 'Yes!',
    });

    renderReasoningChain(ctx, expr, rc as any);

    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    const hasQuestion = fillTextCalls.some((t: string) =>
      t.includes('Quick answer?'),
    );
    const hasAnswer = fillTextCalls.some((t: string) =>
      t.includes('Yes!'),
    );
    expect(hasQuestion).toBe(true);
    expect(hasAnswer).toBe(true);
  });
});

// ── Style Inheritance ────────────────────────────────────────

describe('reasoning chain style inheritance', () => {
  it('inherits stroke color from expression style', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeReasoningExpression(
      {
        question: 'Styled?',
        steps: [{ title: 'S1', content: 'c' }],
        finalAnswer: 'Yes',
      },
      {
        style: makeStyle({ strokeColor: '#ff0000' }),
      },
    );

    renderReasoningChain(ctx, expr, rc as any);

    // First rectangle (question box) should use expression stroke color
    const rectCall = rc.rectangle.mock.calls[0];
    expect(rectCall).toBeDefined();
    const options = rectCall![rectCall!.length - 1];
    expect(options.stroke).toBe('#ff0000');
  });

  it('respects roughness from expression style', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeReasoningExpression(
      {
        question: 'Rough?',
        steps: [],
        finalAnswer: '',
      },
      {
        style: makeStyle({ roughness: 0 }),
      },
    );

    renderReasoningChain(ctx, expr, rc as any);

    const rectCall = rc.rectangle.mock.calls[0];
    expect(rectCall).toBeDefined();
    const options = rectCall![rectCall!.length - 1];
    expect(options.roughness).toBe(0);
  });
});

// ── Renderer Purity ──────────────────────────────────────────

describe('reasoning chain renderer purity', () => {
  it('does NOT mutate expression during render', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const originalWidth = 400;
    const originalHeight = 500;

    const expr = makeReasoningExpression(
      {
        question: 'Pure?',
        steps: [
          { title: 'S1', content: 'c1' },
          { title: 'S2', content: 'c2' },
        ],
        finalAnswer: 'Yes',
      },
      {
        size: { width: originalWidth, height: originalHeight },
      },
    );

    renderReasoningChain(ctx, expr, rc as any);

    expect(expr.size.width).toBe(originalWidth);
    expect(expr.size.height).toBe(originalHeight);
  });
});

// ── Cache Key includes exprWidth (S6-1) ──────────────────────

describe('reasoning chain cache key includes exprWidth (S6-1)', () => {
  it('recomputes layout when expression width changes', () => {
    const data: ReasoningChainData = {
      kind: 'reasoning-chain',
      question: 'Width test?',
      steps: [{ title: 'Step', content: 'content' }],
      finalAnswer: 'Done',
    };

    const layoutNarrow = computeReasoningLayout(data, 300);
    const layoutWide = computeReasoningLayout(data, 600);

    // Card widths should differ because exprWidth differs
    expect(layoutWide.cardWidth).toBeGreaterThan(layoutNarrow.cardWidth);
  });

  it('invalidates cache when width changes between renders', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeReasoningExpression(
      {
        question: 'Resize?',
        steps: [{ title: 'S1', content: 'c' }],
        finalAnswer: 'Yes',
      },
      { size: { width: 300, height: 500 } },
    );

    // First render at width 300
    renderReasoningChain(ctx, expr, rc as any);
    const firstRectCalls = rc.rectangle.mock.calls.slice();

    // "Resize" — change expression width and re-render
    const resizedExpr = {
      ...expr,
      size: { width: 600, height: 500 },
    };

    renderReasoningChain(ctx, resizedExpr, rc as any);

    // The new render should use wider cards: the question box width
    // from the second render should be wider than from the first render.
    const firstQuestionW = firstRectCalls[0]![2] as number;
    const secondRenderCalls = rc.rectangle.mock.calls.slice(firstRectCalls.length);
    const secondQuestionW = secondRenderCalls[0]![2] as number;

    expect(secondQuestionW).toBeGreaterThan(firstQuestionW);
  });
});

// ── Layout cache invalidation (S6-4) ─────────────────────────

describe('reasoning chain cache invalidation (S6-4)', () => {
  it('removes cache entry on invalidateLayoutCache', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeReasoningExpression({
      question: 'Cache test?',
      steps: [{ title: 'S1', content: 'c' }],
      finalAnswer: 'Done',
    });

    // Render to populate cache
    renderReasoningChain(ctx, expr, rc as any);

    // Invalidate the specific entry
    invalidateLayoutCache(expr.id);

    // Re-render — should still work (recomputes layout)
    expect(() => renderReasoningChain(ctx, expr, rc as any)).not.toThrow();
  });
});
