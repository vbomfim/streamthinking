/**
 * Unit tests for sequence diagram composite renderer.
 *
 * Covers: participant rendering, lifeline dashes, message arrow placement
 * (sync/async/reply), title rendering, auto-sizing, empty diagram,
 * style inheritance, and renderer purity.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { VisualExpression, ExpressionStyle, SequenceDiagramData } from '@infinicanvas/protocol';
import {
  renderSequenceDiagram,
  clearLayoutCache,
  computeSequenceLayout,
  invalidateLayoutCache,
} from '../renderer/composites/sequenceDiagramRenderer.js';

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

function makeSequenceExpression(
  data: Partial<SequenceDiagramData> & { title: string },
  overrides: Partial<VisualExpression> = {},
): VisualExpression {
  const seqData: SequenceDiagramData = {
    kind: 'sequence-diagram',
    title: data.title,
    participants: data.participants ?? [],
    messages: data.messages ?? [],
  };

  return {
    id: 'seq-1',
    kind: 'sequence-diagram',
    position: { x: 50, y: 50 },
    size: { width: 600, height: 400 },
    angle: 0,
    style: makeStyle(),
    meta: {
      author: { type: 'human', id: 'user-1', name: 'Test' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data: seqData,
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

describe('sequence diagram layout computation', () => {
  it('places participants evenly spaced horizontally', () => {
    const data: SequenceDiagramData = {
      kind: 'sequence-diagram',
      title: 'Test',
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
        { id: 'c', name: 'Carol' },
      ],
      messages: [],
    };

    const layout = computeSequenceLayout(data);

    expect(layout.participants).toHaveLength(3);

    // Participants should be ordered left to right
    const xs = layout.participants.map(p => p.x);
    expect(xs[0]).toBeLessThan(xs[1]!);
    expect(xs[1]).toBeLessThan(xs[2]!);

    // Even spacing: distance between consecutive participants should be equal
    const gap1 = xs[1]! - xs[0]!;
    const gap2 = xs[2]! - xs[1]!;
    expect(gap1).toBeCloseTo(gap2, 1);
  });

  it('computes lifeline count matching participant count', () => {
    const data: SequenceDiagramData = {
      kind: 'sequence-diagram',
      title: 'Test',
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
      messages: [],
    };

    const layout = computeSequenceLayout(data);
    expect(layout.lifelines).toHaveLength(2);
  });

  it('computes arrow placement for messages between correct participants', () => {
    const data: SequenceDiagramData = {
      kind: 'sequence-diagram',
      title: 'Test',
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
      messages: [
        { from: 'a', to: 'b', label: 'request', type: 'sync' },
        { from: 'b', to: 'a', label: 'response', type: 'reply' },
      ],
    };

    const layout = computeSequenceLayout(data);
    const participantXMap = new Map(layout.participants.map(p => [p.id, p.x]));

    expect(layout.arrows).toHaveLength(2);

    // First arrow: Alice → Bob
    const arrow0 = layout.arrows[0]!;
    expect(arrow0.fromX).toBe(participantXMap.get('a'));
    expect(arrow0.toX).toBe(participantXMap.get('b'));
    expect(arrow0.type).toBe('sync');

    // Second arrow: Bob → Alice
    const arrow1 = layout.arrows[1]!;
    expect(arrow1.fromX).toBe(participantXMap.get('b'));
    expect(arrow1.toX).toBe(participantXMap.get('a'));
    expect(arrow1.type).toBe('reply');
  });

  it('auto-sizes height based on message count', () => {
    const twoMessages: SequenceDiagramData = {
      kind: 'sequence-diagram',
      title: 'Test',
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
      messages: [
        { from: 'a', to: 'b', label: 'm1', type: 'sync' },
        { from: 'b', to: 'a', label: 'm2', type: 'reply' },
      ],
    };

    const fiveMessages: SequenceDiagramData = {
      kind: 'sequence-diagram',
      title: 'Test',
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
      messages: [
        { from: 'a', to: 'b', label: 'm1', type: 'sync' },
        { from: 'b', to: 'a', label: 'm2', type: 'reply' },
        { from: 'a', to: 'b', label: 'm3', type: 'async' },
        { from: 'b', to: 'a', label: 'm4', type: 'reply' },
        { from: 'a', to: 'b', label: 'm5', type: 'sync' },
      ],
    };

    const layout2 = computeSequenceLayout(twoMessages);
    const layout5 = computeSequenceLayout(fiveMessages);

    expect(layout5.totalHeight).toBeGreaterThan(layout2.totalHeight);
  });
});

// ── Participant Rendering ────────────────────────────────────

describe('sequence diagram participant rendering', () => {
  it('renders participant rectangles at the top', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeSequenceExpression({
      title: 'Test',
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
    });

    renderSequenceDiagram(ctx, expr, rc as any);

    // Should render participant boxes as rectangles
    expect(rc.rectangle).toHaveBeenCalled();
    expect(rc.draw).toHaveBeenCalled();
  });

  it('renders participant names as labels', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeSequenceExpression({
      title: 'Test',
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
    });

    renderSequenceDiagram(ctx, expr, rc as any);

    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(fillTextCalls).toContain('Alice');
    expect(fillTextCalls).toContain('Bob');
  });
});

// ── Lifeline Rendering ───────────────────────────────────────

describe('sequence diagram lifelines', () => {
  it('renders dashed lifelines for each participant', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeSequenceExpression({
      title: 'Test',
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
      messages: [
        { from: 'a', to: 'b', label: 'call', type: 'sync' },
      ],
    });

    renderSequenceDiagram(ctx, expr, rc as any);

    // Lifelines are rendered using dashed lines
    expect(ctx.setLineDash).toHaveBeenCalled();
    // The dashed pattern should be non-empty (e.g., [6, 4])
    const dashCalls = ctx.setLineDash.mock.calls;
    const hasDashedCall = dashCalls.some((c: any[]) => {
      const pattern = c[0] as number[];
      return pattern.length > 0;
    });
    expect(hasDashedCall).toBe(true);
  });
});

// ── Message Arrow Rendering ──────────────────────────────────

describe('sequence diagram message arrows', () => {
  it('renders sync arrows with filled arrowheads', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeSequenceExpression({
      title: 'Test',
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
      messages: [
        { from: 'a', to: 'b', label: 'syncCall', type: 'sync' },
      ],
    });

    renderSequenceDiagram(ctx, expr, rc as any);

    // Sync arrow: solid line + filled arrowhead
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();

    // Label should be rendered
    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(fillTextCalls).toContain('syncCall');
  });

  it('renders reply arrows with dashed lines', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeSequenceExpression({
      title: 'Test',
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
      messages: [
        { from: 'b', to: 'a', label: 'response', type: 'reply' },
      ],
    });

    renderSequenceDiagram(ctx, expr, rc as any);

    // Reply arrows use dashed lines
    expect(ctx.setLineDash).toHaveBeenCalled();
  });

  it('renders async arrows with open arrowheads', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeSequenceExpression({
      title: 'Test',
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
      messages: [
        { from: 'a', to: 'b', label: 'asyncCall', type: 'async' },
      ],
    });

    renderSequenceDiagram(ctx, expr, rc as any);

    // Async arrow: solid line + open arrowhead (uses stroke, not fill)
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('renders message labels above the arrows', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeSequenceExpression({
      title: 'Test',
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
      messages: [
        { from: 'a', to: 'b', label: 'doSomething()', type: 'sync' },
      ],
    });

    renderSequenceDiagram(ctx, expr, rc as any);

    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(fillTextCalls).toContain('doSomething()');
  });
});

// ── Title Rendering ──────────────────────────────────────────

describe('sequence diagram title', () => {
  it('renders title above the diagram', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeSequenceExpression({
      title: 'Login Flow',
      participants: [
        { id: 'a', name: 'Client' },
        { id: 'b', name: 'Server' },
      ],
    });

    renderSequenceDiagram(ctx, expr, rc as any);

    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(fillTextCalls).toContain('Login Flow');
  });
});

// ── Zod validation rejects empty data (S6-3) ────────────────

describe('sequence diagram Zod validation (S6-3)', () => {
  it('rejects sequence diagram with fewer than 2 participants', async () => {
    const { sequenceDiagramDataSchema } = await import('@infinicanvas/protocol');

    const result = sequenceDiagramDataSchema.safeParse({
      kind: 'sequence-diagram',
      title: 'Empty',
      participants: [],
      messages: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects sequence diagram with only 1 participant', async () => {
    const { sequenceDiagramDataSchema } = await import('@infinicanvas/protocol');

    const result = sequenceDiagramDataSchema.safeParse({
      kind: 'sequence-diagram',
      title: 'Solo',
      participants: [{ id: 'a', name: 'Alice' }],
      messages: [],
    });

    expect(result.success).toBe(false);
  });
});

describe('sequence diagram with participants but no messages', () => {
  it('renders gracefully with participants but no messages', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeSequenceExpression({
      title: 'No Messages',
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
      messages: [],
    });

    expect(() => renderSequenceDiagram(ctx, expr, rc as any)).not.toThrow();

    // Should render participant labels
    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(fillTextCalls).toContain('Alice');
    expect(fillTextCalls).toContain('Bob');
  });
});

// ── Style Inheritance ────────────────────────────────────────

describe('sequence diagram style inheritance', () => {
  it('inherits stroke color from expression style', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeSequenceExpression(
      {
        title: 'Styled',
        participants: [
          { id: 'a', name: 'Alice' },
          { id: 'b', name: 'Bob' },
        ],
        messages: [
          { from: 'a', to: 'b', label: 'hi', type: 'sync' },
        ],
      },
      {
        style: makeStyle({ strokeColor: '#ff0000' }),
      },
    );

    renderSequenceDiagram(ctx, expr, rc as any);

    // Participant boxes should use the expression stroke color
    const rectCall = rc.rectangle.mock.calls[0];
    expect(rectCall).toBeDefined();
    const options = rectCall![rectCall!.length - 1];
    expect(options.stroke).toBe('#ff0000');
  });

  it('respects roughness from expression style', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeSequenceExpression(
      {
        title: 'Rough',
        participants: [
          { id: 'a', name: 'Alice' },
        ],
      },
      {
        style: makeStyle({ roughness: 3 }),
      },
    );

    renderSequenceDiagram(ctx, expr, rc as any);

    const rectCall = rc.rectangle.mock.calls[0];
    expect(rectCall).toBeDefined();
    const options = rectCall![rectCall!.length - 1];
    expect(options.roughness).toBe(3);
  });
});

// ── Renderer Purity ──────────────────────────────────────────

describe('sequence diagram renderer purity', () => {
  it('does NOT mutate expression during render', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const originalWidth = 600;
    const originalHeight = 400;

    const expr = makeSequenceExpression(
      {
        title: 'Pure',
        participants: [
          { id: 'a', name: 'Alice' },
          { id: 'b', name: 'Bob' },
        ],
        messages: [
          { from: 'a', to: 'b', label: 'test', type: 'sync' },
        ],
      },
      {
        size: { width: originalWidth, height: originalHeight },
      },
    );

    renderSequenceDiagram(ctx, expr, rc as any);

    expect(expr.size.width).toBe(originalWidth);
    expect(expr.size.height).toBe(originalHeight);
  });
});

// ── Layout cache invalidation (S6-4) ─────────────────────────

describe('sequence diagram cache invalidation (S6-4)', () => {
  it('removes cache entry on invalidateLayoutCache', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeSequenceExpression({
      title: 'Cache Test',
      participants: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ],
      messages: [{ from: 'a', to: 'b', label: 'hi', type: 'sync' }],
    });

    // Render to populate cache
    renderSequenceDiagram(ctx, expr, rc as any);

    // Invalidate the specific entry
    invalidateLayoutCache(expr.id);

    // Re-render — should still work (recomputes layout)
    expect(() => renderSequenceDiagram(ctx, expr, rc as any)).not.toThrow();
  });
});
