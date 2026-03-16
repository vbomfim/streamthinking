/**
 * Unit tests for useInlineEditor hook.
 *
 * Covers: double-click to edit text, sticky-notes, and shape labels.
 * Verifies startEditing, commitEdit, cancelEdit, and expression data updates.
 *
 * @vitest-environment jsdom
 * @module
 */

import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { useInlineEditor } from '../hooks/useInlineEditor.js';
import { useCanvasStore } from '../store/canvasStore.js';
import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import type { InlineEditorState } from '../hooks/useInlineEditor.js';

// ── Test helpers ─────────────────────────────────────────────

const DEFAULT_STYLE: ExpressionStyle = {
  strokeColor: '#000000',
  backgroundColor: 'transparent',
  fillStyle: 'none',
  strokeWidth: 2,
  roughness: 1,
  opacity: 1,
};

const DEFAULT_META = {
  author: { type: 'agent' as const, id: 'test', name: 'Test', provider: 'test' },
  createdAt: 0,
  updatedAt: 0,
  tags: [],
  locked: false,
};

function makeText(id: string, x: number, y: number, text: string): VisualExpression {
  return {
    id,
    kind: 'text',
    position: { x, y },
    size: { width: 200, height: 50 },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: { ...DEFAULT_META },
    data: { kind: 'text', text, fontSize: 16, fontFamily: 'sans-serif', textAlign: 'left' as const },
  };
}

function makeRect(id: string, x: number, y: number, label?: string): VisualExpression {
  return {
    id,
    kind: 'rectangle',
    position: { x, y },
    size: { width: 150, height: 100 },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: { ...DEFAULT_META },
    data: { kind: 'rectangle', ...(label !== undefined ? { label } : {}) },
  };
}

function makeEllipse(id: string, x: number, y: number, label?: string): VisualExpression {
  return {
    id,
    kind: 'ellipse',
    position: { x, y },
    size: { width: 150, height: 100 },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: { ...DEFAULT_META },
    data: { kind: 'ellipse', ...(label !== undefined ? { label } : {}) },
  };
}

function makeDiamond(id: string, x: number, y: number, label?: string): VisualExpression {
  return {
    id,
    kind: 'diamond',
    position: { x, y },
    size: { width: 150, height: 100 },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: { ...DEFAULT_META },
    data: { kind: 'diamond', ...(label !== undefined ? { label } : {}) },
  };
}

function makeStickyNote(id: string, x: number, y: number, text: string): VisualExpression {
  return {
    id,
    kind: 'sticky-note',
    position: { x, y },
    size: { width: 200, height: 200 },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: { ...DEFAULT_META },
    data: { kind: 'sticky-note', text, color: '#FFEB3B' },
  };
}

function makeLine(id: string): VisualExpression {
  return {
    id,
    kind: 'line',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: { ...DEFAULT_META },
    data: { kind: 'line', points: [[0, 0], [100, 100]] as [number, number][] },
  };
}

/** Reset store to clean state. */
function resetStore() {
  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
  });
}

/**
 * Render the hook inside a fresh component and return an accessor.
 * Uses a local ref pattern to avoid cross-test contamination
 * from module-level variables.
 */
function renderEditor() {
  const stateRef = { current: null as InlineEditorState | null };

  function Harness() {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const state = useInlineEditor(canvasRef);
    stateRef.current = state;
    return <canvas ref={canvasRef} data-testid="canvas" width={800} height={600} />;
  }

  const rendered = render(<Harness />);
  const getState = () => stateRef.current!;
  return { getState, ...rendered };
}

// ── Tests ────────────────────────────────────────────────────

describe('useInlineEditor — startEditing', () => {
  beforeEach(() => { cleanup(); resetStore(); });
  afterEach(() => { cleanup(); });

  it('starts editing a text expression', () => {
    const expr = makeText('t1', 100, 100, 'Hello');
    useCanvasStore.setState({ expressions: { t1: expr }, expressionOrder: ['t1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('t1'); });
    expect(getState().editingId).toBe('t1');
  });

  it('starts editing a sticky-note expression', () => {
    const expr = makeStickyNote('s1', 100, 100, 'Sticky text');
    useCanvasStore.setState({ expressions: { s1: expr }, expressionOrder: ['s1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('s1'); });
    expect(getState().editingId).toBe('s1');
  });

  it('starts editing a rectangle expression for label', () => {
    const expr = makeRect('r1', 100, 100, 'Label');
    useCanvasStore.setState({ expressions: { r1: expr }, expressionOrder: ['r1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('r1'); });
    expect(getState().editingId).toBe('r1');
  });

  it('starts editing an ellipse expression for label', () => {
    const expr = makeEllipse('e1', 100, 100);
    useCanvasStore.setState({ expressions: { e1: expr }, expressionOrder: ['e1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('e1'); });
    expect(getState().editingId).toBe('e1');
  });

  it('starts editing a diamond expression for label', () => {
    const expr = makeDiamond('d1', 100, 100, 'Decision');
    useCanvasStore.setState({ expressions: { d1: expr }, expressionOrder: ['d1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('d1'); });
    expect(getState().editingId).toBe('d1');
  });

  it('does not start editing for unsupported kind (line)', () => {
    const expr = makeLine('l1');
    useCanvasStore.setState({ expressions: { l1: expr }, expressionOrder: ['l1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('l1'); });
    expect(getState().editingId).toBeNull();
  });

  it('does not start editing for non-existent expression', () => {
    const { getState } = renderEditor();
    act(() => { getState().startEditing('nonexistent'); });
    expect(getState().editingId).toBeNull();
  });

  it('does not start editing for locked expression', () => {
    const expr = makeText('t1', 100, 100, 'Hello');
    expr.meta.locked = true;
    useCanvasStore.setState({ expressions: { t1: expr }, expressionOrder: ['t1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('t1'); });
    expect(getState().editingId).toBeNull();
  });
});

describe('useInlineEditor — getEditingText', () => {
  beforeEach(() => { cleanup(); resetStore(); });
  afterEach(() => { cleanup(); });

  it('returns current text for text expression', () => {
    const expr = makeText('t1', 100, 100, 'Hello World');
    useCanvasStore.setState({ expressions: { t1: expr }, expressionOrder: ['t1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('t1'); });
    expect(getState().getEditingText()).toBe('Hello World');
  });

  it('returns current label for rectangle expression', () => {
    const expr = makeRect('r1', 100, 100, 'My Label');
    useCanvasStore.setState({ expressions: { r1: expr }, expressionOrder: ['r1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('r1'); });
    expect(getState().getEditingText()).toBe('My Label');
  });

  it('returns empty string for rectangle with no label', () => {
    const expr = makeRect('r1', 100, 100);
    useCanvasStore.setState({ expressions: { r1: expr }, expressionOrder: ['r1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('r1'); });
    expect(getState().getEditingText()).toBe('');
  });

  it('returns current text for sticky-note expression', () => {
    const expr = makeStickyNote('s1', 100, 100, 'Sticky Content');
    useCanvasStore.setState({ expressions: { s1: expr }, expressionOrder: ['s1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('s1'); });
    expect(getState().getEditingText()).toBe('Sticky Content');
  });

  it('returns empty string when not editing', () => {
    const { getState } = renderEditor();
    expect(getState().getEditingText()).toBe('');
  });
});

describe('useInlineEditor — commitEdit for text expressions', () => {
  beforeEach(() => { cleanup(); resetStore(); });
  afterEach(() => { cleanup(); });

  it('updates text expression with new text', () => {
    const expr = makeText('t1', 100, 100, 'Old text');
    useCanvasStore.setState({ expressions: { t1: expr }, expressionOrder: ['t1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('t1'); });
    act(() => { getState().commitEdit('New text'); });

    const updated = useCanvasStore.getState().expressions['t1'];
    expect(updated).toBeDefined();
    expect(updated.data).toEqual(
      expect.objectContaining({ kind: 'text', text: 'New text' }),
    );
    expect(getState().editingId).toBeNull();
  });

  it('deletes text expression when committed with empty text', () => {
    const expr = makeText('t1', 100, 100, 'Will be deleted');
    useCanvasStore.setState({ expressions: { t1: expr }, expressionOrder: ['t1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('t1'); });
    act(() => { getState().commitEdit(''); });

    expect(useCanvasStore.getState().expressions['t1']).toBeUndefined();
    expect(getState().editingId).toBeNull();
  });

  it('deletes text expression when committed with whitespace-only text', () => {
    const expr = makeText('t1', 100, 100, 'Will be deleted');
    useCanvasStore.setState({ expressions: { t1: expr }, expressionOrder: ['t1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('t1'); });
    act(() => { getState().commitEdit('   '); });

    expect(useCanvasStore.getState().expressions['t1']).toBeUndefined();
    expect(getState().editingId).toBeNull();
  });

  it('preserves font properties when updating text', () => {
    const expr = makeText('t1', 100, 100, 'Old');
    useCanvasStore.setState({ expressions: { t1: expr }, expressionOrder: ['t1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('t1'); });
    act(() => { getState().commitEdit('New'); });

    const updated = useCanvasStore.getState().expressions['t1'];
    expect(updated.data).toEqual({
      kind: 'text',
      text: 'New',
      fontSize: 16,
      fontFamily: 'sans-serif',
      textAlign: 'left',
    });
  });
});

describe('useInlineEditor — commitEdit for shape labels', () => {
  beforeEach(() => { cleanup(); resetStore(); });
  afterEach(() => { cleanup(); });

  it('updates rectangle label with new text', () => {
    const expr = makeRect('r1', 100, 100, 'Old Label');
    useCanvasStore.setState({ expressions: { r1: expr }, expressionOrder: ['r1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('r1'); });
    act(() => { getState().commitEdit('New Label'); });

    const updated = useCanvasStore.getState().expressions['r1'];
    expect(updated).toBeDefined();
    expect(updated.data).toEqual({ kind: 'rectangle', label: 'New Label' });
    expect(getState().editingId).toBeNull();
  });

  it('removes rectangle label when committed with empty text', () => {
    const expr = makeRect('r1', 100, 100, 'Will be removed');
    useCanvasStore.setState({ expressions: { r1: expr }, expressionOrder: ['r1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('r1'); });
    act(() => { getState().commitEdit(''); });

    const updated = useCanvasStore.getState().expressions['r1'];
    expect(updated).toBeDefined();
    expect((updated.data as { label?: string }).label).toBeUndefined();
    expect(getState().editingId).toBeNull();
  });

  it('updates ellipse label', () => {
    const expr = makeEllipse('e1', 100, 100, 'Circle');
    useCanvasStore.setState({ expressions: { e1: expr }, expressionOrder: ['e1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('e1'); });
    act(() => { getState().commitEdit('Ellipse Label'); });

    expect(useCanvasStore.getState().expressions['e1'].data).toEqual({
      kind: 'ellipse',
      label: 'Ellipse Label',
    });
  });

  it('updates diamond label', () => {
    const expr = makeDiamond('d1', 100, 100, 'Yes/No');
    useCanvasStore.setState({ expressions: { d1: expr }, expressionOrder: ['d1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('d1'); });
    act(() => { getState().commitEdit('Decision Point'); });

    expect(useCanvasStore.getState().expressions['d1'].data).toEqual({
      kind: 'diamond',
      label: 'Decision Point',
    });
  });

  it('adds label to rectangle that had no label', () => {
    const expr = makeRect('r1', 100, 100);
    useCanvasStore.setState({ expressions: { r1: expr }, expressionOrder: ['r1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('r1'); });
    act(() => { getState().commitEdit('Brand New Label'); });

    expect(useCanvasStore.getState().expressions['r1'].data).toEqual({
      kind: 'rectangle',
      label: 'Brand New Label',
    });
  });
});

describe('useInlineEditor — commitEdit for sticky-note', () => {
  beforeEach(() => { cleanup(); resetStore(); });
  afterEach(() => { cleanup(); });

  it('updates sticky-note text', () => {
    const expr = makeStickyNote('s1', 100, 100, 'Old note');
    useCanvasStore.setState({ expressions: { s1: expr }, expressionOrder: ['s1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('s1'); });
    act(() => { getState().commitEdit('Updated note'); });

    const updated = useCanvasStore.getState().expressions['s1'];
    expect(updated).toBeDefined();
    expect(updated.data).toEqual(
      expect.objectContaining({ kind: 'sticky-note', text: 'Updated note' }),
    );
  });

  it('deletes sticky-note when text is empty', () => {
    const expr = makeStickyNote('s1', 100, 100, 'Will be deleted');
    useCanvasStore.setState({ expressions: { s1: expr }, expressionOrder: ['s1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('s1'); });
    act(() => { getState().commitEdit(''); });

    expect(useCanvasStore.getState().expressions['s1']).toBeUndefined();
  });

  it('preserves sticky-note color when updating text', () => {
    const expr = makeStickyNote('s1', 100, 100, 'Old');
    useCanvasStore.setState({ expressions: { s1: expr }, expressionOrder: ['s1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('s1'); });
    act(() => { getState().commitEdit('New'); });

    expect(useCanvasStore.getState().expressions['s1'].data).toEqual({
      kind: 'sticky-note',
      text: 'New',
      color: '#FFEB3B',
    });
  });
});

describe('useInlineEditor — cancelEdit', () => {
  beforeEach(() => { cleanup(); resetStore(); });
  afterEach(() => { cleanup(); });

  it('clears editing state without modifying expression', () => {
    const expr = makeText('t1', 100, 100, 'Original');
    useCanvasStore.setState({ expressions: { t1: expr }, expressionOrder: ['t1'] });

    const { getState } = renderEditor();
    act(() => { getState().startEditing('t1'); });
    expect(getState().editingId).toBe('t1');

    act(() => { getState().cancelEdit(); });
    expect(getState().editingId).toBeNull();
    expect((useCanvasStore.getState().expressions['t1'].data as { text: string }).text).toBe('Original');
  });

  it('is a no-op when not editing', () => {
    const { getState } = renderEditor();
    act(() => { getState().cancelEdit(); });
    expect(getState().editingId).toBeNull();
  });
});

describe('useInlineEditor — commitEdit when not editing', () => {
  beforeEach(() => { cleanup(); resetStore(); });
  afterEach(() => { cleanup(); });

  it('is a no-op when not editing', () => {
    const expr = makeText('t1', 100, 100, 'Hello');
    useCanvasStore.setState({ expressions: { t1: expr }, expressionOrder: ['t1'] });

    const { getState } = renderEditor();
    act(() => { getState().commitEdit('Should not change anything'); });

    expect((useCanvasStore.getState().expressions['t1'].data as { text: string }).text).toBe('Hello');
  });
});

describe('useInlineEditor — double-click event integration', () => {
  beforeEach(() => { cleanup(); resetStore(); });
  afterEach(() => { cleanup(); });

  function fireDblClick(canvas: HTMLElement, offsetX: number, offsetY: number) {
    const event = new MouseEvent('dblclick', { bubbles: true, clientX: offsetX, clientY: offsetY });
    Object.defineProperty(event, 'offsetX', { value: offsetX });
    Object.defineProperty(event, 'offsetY', { value: offsetY });
    canvas.dispatchEvent(event);
  }

  it('starts editing when canvas receives dblclick on a text expression', () => {
    const expr = makeText('t1', 100, 100, 'Dblclick me');
    useCanvasStore.setState({
      expressions: { t1: expr },
      expressionOrder: ['t1'],
      activeTool: 'select',
    });

    const { getState, getByTestId } = renderEditor();
    const canvas = getByTestId('canvas');

    act(() => { fireDblClick(canvas, 150, 150); });
    expect(getState().editingId).toBe('t1');
  });

  it('starts editing when canvas receives dblclick on a rectangle', () => {
    const expr = makeRect('r1', 100, 100, 'Box Label');
    useCanvasStore.setState({
      expressions: { r1: expr },
      expressionOrder: ['r1'],
      activeTool: 'select',
    });

    const { getState, getByTestId } = renderEditor();
    const canvas = getByTestId('canvas');

    act(() => { fireDblClick(canvas, 150, 150); });
    expect(getState().editingId).toBe('r1');
  });

  it('does not start editing on dblclick when tool is not select', () => {
    const expr = makeText('t1', 100, 100, 'Text');
    useCanvasStore.setState({
      expressions: { t1: expr },
      expressionOrder: ['t1'],
      activeTool: 'rectangle',
    });

    const { getState, getByTestId } = renderEditor();
    const canvas = getByTestId('canvas');

    act(() => { fireDblClick(canvas, 150, 150); });
    expect(getState().editingId).toBeNull();
  });

  it('does not start editing on dblclick on empty space', () => {
    const expr = makeText('t1', 500, 500, 'Far away');
    useCanvasStore.setState({
      expressions: { t1: expr },
      expressionOrder: ['t1'],
      activeTool: 'select',
    });

    const { getState, getByTestId } = renderEditor();
    const canvas = getByTestId('canvas');

    act(() => { fireDblClick(canvas, 10, 10); });
    expect(getState().editingId).toBeNull();
  });

  it('does not start editing on dblclick on non-editable expression (line)', () => {
    const expr = makeLine('l1');
    useCanvasStore.setState({
      expressions: { l1: expr },
      expressionOrder: ['l1'],
      activeTool: 'select',
    });

    const { getState, getByTestId } = renderEditor();
    const canvas = getByTestId('canvas');

    act(() => { fireDblClick(canvas, 50, 50); });
    expect(getState().editingId).toBeNull();
  });
});
