/**
 * Unit tests for StylePanel component.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies: panel renders controls, hides when nothing selected,
 * changing controls updates expressions, style values validated.
 *
 * @vitest-environment jsdom
 * @module
 */

import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StylePanel } from '../components/panels/StylePanel.js';
import { useCanvasStore } from '@infinicanvas/engine';
import { ExpressionBuilder, DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';

// ── Test helpers ───────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string) {
  const expr = builder.rectangle(100, 200, 300, 150).label('Test').build();
  return { ...expr, id };
}

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
    lastUsedStyle: { ...DEFAULT_EXPRESSION_STYLE },
  });
}

function setupWithSelectedExpression() {
  const expr = makeRectangle('rect-1');
  useCanvasStore.getState().addExpression(expr);
  useCanvasStore.setState({ selectedIds: new Set(['rect-1']) });
}

// ── Tests ──────────────────────────────────────────────────

describe('StylePanel', () => {
  beforeEach(() => resetStore());
  afterEach(() => cleanup());

  // ── Visibility ──

  it('is hidden when Select tool active and nothing selected', () => {
    // activeTool defaults to 'select', selectedIds is empty
    const { container } = render(<StylePanel />);
    const panel = container.querySelector('[data-testid="style-panel"]');
    expect(panel).toBeNull();
  });

  it('is visible when expressions are selected', () => {
    setupWithSelectedExpression();
    const { container } = render(<StylePanel />);
    const panel = container.querySelector('[data-testid="style-panel"]');
    expect(panel).not.toBeNull();
  });

  it('is visible when drawing tool active and nothing selected', () => {
    useCanvasStore.setState({ activeTool: 'rectangle' });
    const { container } = render(<StylePanel />);
    const panel = container.querySelector('[data-testid="style-panel"]');
    expect(panel).not.toBeNull();
  });

  // ── Controls rendering ──

  it('renders stroke color preset buttons', () => {
    setupWithSelectedExpression();
    const { container } = render(<StylePanel />);
    const swatches = container.querySelectorAll('[data-testid="stroke-color-swatch"]');
    expect(swatches.length).toBe(8);
  });

  it('renders custom hex color input for stroke', () => {
    setupWithSelectedExpression();
    const { container } = render(<StylePanel />);
    const input = container.querySelector('[data-testid="stroke-color-input"]');
    expect(input).not.toBeNull();
  });

  it('renders fill color preset buttons with transparent option', () => {
    setupWithSelectedExpression();
    const { container } = render(<StylePanel />);
    const swatches = container.querySelectorAll('[data-testid="fill-color-swatch"]');
    // 8 colors + 1 transparent = 9
    expect(swatches.length).toBe(9);
  });

  it('renders stroke width radio buttons (thin/normal/thick)', () => {
    setupWithSelectedExpression();
    const { container } = render(<StylePanel />);
    const radios = container.querySelectorAll('[name="strokeWidth"]');
    expect(radios.length).toBe(3);
  });

  it('renders fill style selector', () => {
    setupWithSelectedExpression();
    const { container } = render(<StylePanel />);
    const radios = container.querySelectorAll('[name="fillStyle"]');
    expect(radios.length).toBe(4);
  });

  it('renders roughness slider', () => {
    setupWithSelectedExpression();
    const { container } = render(<StylePanel />);
    const slider = container.querySelector('[data-testid="roughness-slider"]');
    expect(slider).not.toBeNull();
  });

  it('renders opacity slider', () => {
    setupWithSelectedExpression();
    const { container } = render(<StylePanel />);
    const slider = container.querySelector('[data-testid="opacity-slider"]');
    expect(slider).not.toBeNull();
  });

  // ── Style application ──

  it('changing stroke color updates selected expression', () => {
    setupWithSelectedExpression();
    const { container } = render(<StylePanel />);

    // Click the red preset (#ff0000 is second swatch)
    const redSwatch = container.querySelector('[data-testid="stroke-color-swatch"][data-color="#e03131"]');
    expect(redSwatch).not.toBeNull();
    fireEvent.click(redSwatch!);

    const style = useCanvasStore.getState().expressions['rect-1']?.style;
    expect(style?.strokeColor).toBe('#e03131');
  });

  it('changing fill color updates selected expression', () => {
    setupWithSelectedExpression();
    const { container } = render(<StylePanel />);

    const blueSwatch = container.querySelector('[data-testid="fill-color-swatch"][data-color="#1971c2"]');
    expect(blueSwatch).not.toBeNull();
    fireEvent.click(blueSwatch!);

    const style = useCanvasStore.getState().expressions['rect-1']?.style;
    expect(style?.backgroundColor).toBe('#1971c2');
  });

  it('changing stroke width updates selected expression', () => {
    setupWithSelectedExpression();
    const { container } = render(<StylePanel />);

    const thickRadio = container.querySelector('[name="strokeWidth"][value="4"]');
    expect(thickRadio).not.toBeNull();
    fireEvent.click(thickRadio!);

    const style = useCanvasStore.getState().expressions['rect-1']?.style;
    expect(style?.strokeWidth).toBe(4);
  });

  it('changing fill style updates selected expression', () => {
    setupWithSelectedExpression();
    const { container } = render(<StylePanel />);

    const solidRadio = container.querySelector('[name="fillStyle"][value="solid"]');
    expect(solidRadio).not.toBeNull();
    fireEvent.click(solidRadio!);

    const style = useCanvasStore.getState().expressions['rect-1']?.style;
    expect(style?.fillStyle).toBe('solid');
  });

  it('changing roughness slider updates selected expression', () => {
    setupWithSelectedExpression();
    const { container } = render(<StylePanel />);

    const slider = container.querySelector('[data-testid="roughness-slider"]') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '0' } });

    const style = useCanvasStore.getState().expressions['rect-1']?.style;
    expect(style?.roughness).toBe(0);
  });

  it('changing opacity slider updates selected expression', () => {
    setupWithSelectedExpression();
    const { container } = render(<StylePanel />);

    const slider = container.querySelector('[data-testid="opacity-slider"]') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '0.5' } });

    const style = useCanvasStore.getState().expressions['rect-1']?.style;
    expect(style?.opacity).toBe(0.5);
  });

  // ── Last-used style ──

  it('updates lastUsedStyle when changing stroke color', () => {
    setupWithSelectedExpression();
    const { container } = render(<StylePanel />);

    const redSwatch = container.querySelector('[data-testid="stroke-color-swatch"][data-color="#e03131"]');
    fireEvent.click(redSwatch!);

    expect(useCanvasStore.getState().lastUsedStyle.strokeColor).toBe('#e03131');
  });

  // ── Reflects current selection style ──

  it('shows the current style of the first selected expression', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    // Set a specific style
    useCanvasStore.getState().styleExpressions(['rect-1'], { strokeWidth: 4 });
    useCanvasStore.setState({ selectedIds: new Set(['rect-1']) });

    const { container } = render(<StylePanel />);

    const thickRadio = container.querySelector('[name="strokeWidth"][value="4"]') as HTMLInputElement;
    expect(thickRadio?.checked).toBe(true);
  });

  // ── Drawing mode (pre-draw style) ──

  it('shows lastUsedStyle values in drawing mode', () => {
    useCanvasStore.setState({
      activeTool: 'rectangle',
      lastUsedStyle: { ...DEFAULT_EXPRESSION_STYLE, strokeColor: '#e03131', strokeWidth: 4 },
    });
    const { container } = render(<StylePanel />);

    // Stroke color swatch for red should be pressed
    const redSwatch = container.querySelector(
      '[data-testid="stroke-color-swatch"][data-color="#e03131"]',
    );
    expect(redSwatch?.getAttribute('aria-pressed')).toBe('true');

    // Stroke width thick radio should be checked
    const thickRadio = container.querySelector('[name="strokeWidth"][value="4"]') as HTMLInputElement;
    expect(thickRadio?.checked).toBe(true);
  });

  it('changing color in drawing mode updates lastUsedStyle (not expressions)', () => {
    useCanvasStore.setState({ activeTool: 'rectangle' });
    const { container } = render(<StylePanel />);

    const blueSwatch = container.querySelector(
      '[data-testid="stroke-color-swatch"][data-color="#1971c2"]',
    );
    fireEvent.click(blueSwatch!);

    // lastUsedStyle should be updated
    expect(useCanvasStore.getState().lastUsedStyle.strokeColor).toBe('#1971c2');

    // No expressions should have been modified (there are none)
    expect(Object.keys(useCanvasStore.getState().expressions)).toHaveLength(0);
  });

  it('changing fill in drawing mode updates lastUsedStyle', () => {
    useCanvasStore.setState({ activeTool: 'ellipse' });
    const { container } = render(<StylePanel />);

    const greenSwatch = container.querySelector(
      '[data-testid="fill-color-swatch"][data-color="#2f9e44"]',
    );
    fireEvent.click(greenSwatch!);

    expect(useCanvasStore.getState().lastUsedStyle.backgroundColor).toBe('#2f9e44');
  });

  it('changing stroke width in drawing mode updates lastUsedStyle', () => {
    useCanvasStore.setState({ activeTool: 'line' });
    const { container } = render(<StylePanel />);

    const thickRadio = container.querySelector('[name="strokeWidth"][value="4"]');
    fireEvent.click(thickRadio!);

    expect(useCanvasStore.getState().lastUsedStyle.strokeWidth).toBe(4);
  });

  it('still shows selected expression style when in selection mode', () => {
    // Both selection and a non-select tool shouldn't happen normally,
    // but selection mode takes precedence when selectedIds > 0
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().styleExpressions(['rect-1'], { strokeColor: '#9c36b5' });
    useCanvasStore.setState({ selectedIds: new Set(['rect-1']) });

    const { container } = render(<StylePanel />);

    const purpleSwatch = container.querySelector(
      '[data-testid="stroke-color-swatch"][data-color="#9c36b5"]',
    );
    expect(purpleSwatch?.getAttribute('aria-pressed')).toBe('true');
  });
});
