/**
 * Unit tests for Copy / Paste / Cut keyboard shortcuts.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Acceptance criteria from Issue #69.
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import { useCanvasStore } from '../store/canvasStore.js';
import {
  copySelected,
  cutSelected,
  pasteFromClipboard,
  _resetClipboard,
} from '../hooks/useKeyboardShortcuts.js';

// ── Test fixtures ──────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string, x = 100, y = 200) {
  const expr = builder.rectangle(x, y, 300, 150).label('Test Rectangle').build();
  return { ...expr, id };
}

function makeEllipse(id: string, x = 50, y = 50) {
  const expr = builder.ellipse(x, y, 200, 200).label('Test Ellipse').build();
  return { ...expr, id };
}

/** Reset store to clean state before each test. */
function resetStore() {
  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
    operationLog: [],
    canUndo: false,
    canRedo: false,
  });
  useCanvasStore.getState().clearHistory();
}

// ── Setup ──────────────────────────────────────────────────

beforeEach(() => {
  resetStore();
  _resetClipboard();
});

// ── Ctrl+C (Copy) ──────────────────────────────────────────

describe('Ctrl+C — copySelected', () => {
  it('stores selected expressions in clipboard (no visual side-effect)', () => {
    const rect = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1']));

    copySelected();

    // Store state should be unchanged — no expressions added or removed
    const state = useCanvasStore.getState();
    expect(Object.keys(state.expressions)).toHaveLength(1);
    expect(state.selectedIds.has('rect-1')).toBe(true);
  });

  it('copies multiple selected expressions', () => {
    const rect = makeRectangle('rect-1');
    const ellipse = makeEllipse('ellipse-1');
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().addExpression(ellipse);
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1', 'ellipse-1']));

    copySelected();

    // Paste should produce 2 new expressions
    pasteFromClipboard();
    const state = useCanvasStore.getState();
    expect(Object.keys(state.expressions)).toHaveLength(4); // 2 originals + 2 pasted
  });

  it('no-op when nothing is selected', () => {
    const rect = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().setSelectedIds(new Set());

    copySelected();

    // Paste should be a no-op since clipboard is empty
    pasteFromClipboard();
    const state = useCanvasStore.getState();
    expect(Object.keys(state.expressions)).toHaveLength(1); // only the original
  });
});

// ── Ctrl+V (Paste) ─────────────────────────────────────────

describe('Ctrl+V — pasteFromClipboard', () => {
  it('creates clones with new IDs and +20,+20 offset', () => {
    const rect = makeRectangle('rect-1', 100, 200);
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1']));

    copySelected();
    pasteFromClipboard();

    const state = useCanvasStore.getState();
    const allIds = Object.keys(state.expressions);
    expect(allIds).toHaveLength(2);

    const pastedId = allIds.find((id) => id !== 'rect-1')!;
    const pasted = state.expressions[pastedId]!;

    // New ID (not the original)
    expect(pasted.id).not.toBe('rect-1');
    // Offset by +20,+20
    expect(pasted.position.x).toBe(120);
    expect(pasted.position.y).toBe(220);
    // Same kind and size
    expect(pasted.kind).toBe('rectangle');
    expect(pasted.size.width).toBe(300);
    expect(pasted.size.height).toBe(150);
  });

  it('selects pasted expressions (deselects originals)', () => {
    const rect = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1']));

    copySelected();
    pasteFromClipboard();

    const state = useCanvasStore.getState();
    // Original should not be selected
    expect(state.selectedIds.has('rect-1')).toBe(false);
    // One new item should be selected
    expect(state.selectedIds.size).toBe(1);
    const selectedId = Array.from(state.selectedIds)[0]!;
    expect(selectedId).not.toBe('rect-1');
  });

  it('each subsequent paste offsets by additional +20,+20', () => {
    const rect = makeRectangle('rect-1', 100, 200);
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1']));

    copySelected();

    // First paste: +20,+20
    pasteFromClipboard();
    const state1 = useCanvasStore.getState();
    const firstPasteId = Array.from(state1.selectedIds)[0]!;
    const firstPasted = state1.expressions[firstPasteId]!;
    expect(firstPasted.position.x).toBe(120);
    expect(firstPasted.position.y).toBe(220);

    // Second paste: +40,+40 from original
    pasteFromClipboard();
    const state2 = useCanvasStore.getState();
    const secondPasteId = Array.from(state2.selectedIds)[0]!;
    const secondPasted = state2.expressions[secondPasteId]!;
    expect(secondPasted.position.x).toBe(140);
    expect(secondPasted.position.y).toBe(240);

    // Third paste: +60,+60 from original
    pasteFromClipboard();
    const state3 = useCanvasStore.getState();
    const thirdPasteId = Array.from(state3.selectedIds)[0]!;
    const thirdPasted = state3.expressions[thirdPasteId]!;
    expect(thirdPasted.position.x).toBe(160);
    expect(thirdPasted.position.y).toBe(260);
  });

  it('no-op when clipboard is empty', () => {
    pasteFromClipboard();

    const state = useCanvasStore.getState();
    expect(Object.keys(state.expressions)).toHaveLength(0);
    expect(state.selectedIds.size).toBe(0);
  });

  it('preserves expression data (style, angle, data) on paste', () => {
    const rect = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1']));

    copySelected();
    pasteFromClipboard();

    const state = useCanvasStore.getState();
    const pastedId = Array.from(state.selectedIds)[0]!;
    const pasted = state.expressions[pastedId]!;
    const original = state.expressions['rect-1']!;

    expect(pasted.style).toEqual(original.style);
    expect(pasted.angle).toBe(original.angle);
    expect(pasted.data).toEqual(original.data);
  });

  it('updates timestamps on pasted expressions', () => {
    const rect = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1']));

    copySelected();

    // Small delay to ensure timestamp differs
    const beforePaste = Date.now();
    pasteFromClipboard();

    const state = useCanvasStore.getState();
    const pastedId = Array.from(state.selectedIds)[0]!;
    const pasted = state.expressions[pastedId]!;

    expect(pasted.meta.createdAt).toBeGreaterThanOrEqual(beforePaste);
    expect(pasted.meta.updatedAt).toBeGreaterThanOrEqual(beforePaste);
  });
});

// ── Ctrl+X (Cut) ───────────────────────────────────────────

describe('Ctrl+X — cutSelected', () => {
  it('copies to clipboard and deletes originals', () => {
    const rect = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1']));

    cutSelected();

    // Original should be deleted
    const state = useCanvasStore.getState();
    expect(Object.keys(state.expressions)).toHaveLength(0);
    expect(state.expressionOrder).toHaveLength(0);
  });

  it('paste works after cut', () => {
    const rect = makeRectangle('rect-1', 100, 200);
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1']));

    cutSelected();
    pasteFromClipboard();

    const state = useCanvasStore.getState();
    expect(Object.keys(state.expressions)).toHaveLength(1);

    const pastedId = Object.keys(state.expressions)[0]!;
    const pasted = state.expressions[pastedId]!;
    expect(pasted.id).not.toBe('rect-1');
    expect(pasted.position.x).toBe(120);
    expect(pasted.position.y).toBe(220);
    expect(pasted.kind).toBe('rectangle');
  });

  it('cuts multiple selected expressions', () => {
    const rect = makeRectangle('rect-1');
    const ellipse = makeEllipse('ellipse-1');
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().addExpression(ellipse);
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1', 'ellipse-1']));

    cutSelected();

    // All originals deleted
    const state = useCanvasStore.getState();
    expect(Object.keys(state.expressions)).toHaveLength(0);

    // Paste restores both
    pasteFromClipboard();
    const state2 = useCanvasStore.getState();
    expect(Object.keys(state2.expressions)).toHaveLength(2);
  });

  it('skips locked expressions during cut', () => {
    const rect = makeRectangle('rect-1');
    rect.meta.locked = true;
    useCanvasStore.getState().addExpression(rect);

    const ellipse = makeEllipse('ellipse-1');
    useCanvasStore.getState().addExpression(ellipse);
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1', 'ellipse-1']));

    cutSelected();

    // Locked expression should remain
    const state = useCanvasStore.getState();
    expect(state.expressions['rect-1']).toBeDefined();
    expect(state.expressions['ellipse-1']).toBeUndefined();
  });

  it('no-op when nothing is selected', () => {
    const rect = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().setSelectedIds(new Set());

    cutSelected();

    const state = useCanvasStore.getState();
    expect(Object.keys(state.expressions)).toHaveLength(1);
  });
});

// ── Copy overwrite ─────────────────────────────────────────

describe('clipboard overwrite', () => {
  it('new copy replaces previous clipboard contents', () => {
    const rect = makeRectangle('rect-1', 100, 200);
    const ellipse = makeEllipse('ellipse-1', 300, 400);

    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().addExpression(ellipse);

    // Copy rect
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1']));
    copySelected();

    // Copy ellipse (should replace)
    useCanvasStore.getState().setSelectedIds(new Set(['ellipse-1']));
    copySelected();

    // Paste should produce ellipse, not rect
    pasteFromClipboard();
    const state = useCanvasStore.getState();
    const pastedId = Array.from(state.selectedIds)[0]!;
    const pasted = state.expressions[pastedId]!;
    expect(pasted.kind).toBe('ellipse');
  });

  it('paste resets offset counter after new copy', () => {
    const rect = makeRectangle('rect-1', 100, 200);
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1']));

    copySelected();
    pasteFromClipboard(); // offset +20
    pasteFromClipboard(); // offset +40

    // New copy should reset offset counter
    const ellipse = makeEllipse('ellipse-1', 300, 400);
    useCanvasStore.getState().addExpression(ellipse);
    useCanvasStore.getState().setSelectedIds(new Set(['ellipse-1']));
    copySelected();

    pasteFromClipboard();
    const state = useCanvasStore.getState();
    const pastedId = Array.from(state.selectedIds)[0]!;
    const pasted = state.expressions[pastedId]!;
    // Should be +20 from ellipse origin, not +60
    expect(pasted.position.x).toBe(320);
    expect(pasted.position.y).toBe(420);
  });
});
