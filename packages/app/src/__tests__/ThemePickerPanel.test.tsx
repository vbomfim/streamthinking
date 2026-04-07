/**
 * Unit tests for ThemePickerPanel component.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies: toggle visibility, theme items render, theme application,
 * scope toggle, panel closes after selection.
 *
 * @vitest-environment jsdom
 * @module
 */

import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemePickerPanel } from '../components/panels/ThemePickerPanel.js';
import { useCanvasStore } from '@infinicanvas/engine';
import { THEME_PRESETS, getThemeById } from '@infinicanvas/engine';
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
  useCanvasStore.getState().clearHistory();
}

// ── Tests ──────────────────────────────────────────────────

describe('ThemePickerPanel', () => {
  beforeEach(() => resetStore());
  afterEach(() => cleanup());

  it('renders the theme picker button', () => {
    const { container } = render(<ThemePickerPanel />);
    const button = container.querySelector('[data-testid="theme-picker-button"]');
    expect(button).not.toBeNull();
  });

  it('panel is hidden by default', () => {
    const { container } = render(<ThemePickerPanel />);
    const panel = container.querySelector('[data-testid="theme-picker-panel"]');
    expect(panel).toBeNull();
  });

  it('opens panel on button click', () => {
    const { container } = render(<ThemePickerPanel />);
    const button = container.querySelector('[data-testid="theme-picker-button"]')!;
    fireEvent.click(button);
    const panel = container.querySelector('[data-testid="theme-picker-panel"]');
    expect(panel).not.toBeNull();
  });

  it('closes panel on second button click', () => {
    const { container } = render(<ThemePickerPanel />);
    const button = container.querySelector('[data-testid="theme-picker-button"]')!;
    fireEvent.click(button);
    fireEvent.click(button);
    const panel = container.querySelector('[data-testid="theme-picker-panel"]');
    expect(panel).toBeNull();
  });

  it('renders all theme items when open', () => {
    const { container } = render(<ThemePickerPanel />);
    const button = container.querySelector('[data-testid="theme-picker-button"]')!;
    fireEvent.click(button);

    const items = container.querySelectorAll('[data-testid="theme-item"]');
    expect(items.length).toBe(THEME_PRESETS.length);
  });

  it('each theme item has correct data-theme-id', () => {
    const { container } = render(<ThemePickerPanel />);
    const button = container.querySelector('[data-testid="theme-picker-button"]')!;
    fireEvent.click(button);

    const ids = THEME_PRESETS.map((t) => t.id);
    for (const id of ids) {
      const item = container.querySelector(`[data-theme-id="${id}"]`);
      expect(item).not.toBeNull();
    }
  });

  it('applies theme to all expressions on click', () => {
    useCanvasStore.getState().addExpression(makeRectangle('rect-1'));

    const { container } = render(<ThemePickerPanel />);
    const button = container.querySelector('[data-testid="theme-picker-button"]')!;
    fireEvent.click(button);

    const corporateItem = container.querySelector('[data-theme-id="corporate"]')!;
    fireEvent.click(corporateItem);

    const theme = getThemeById('corporate')!;
    const expr = useCanvasStore.getState().expressions['rect-1'];
    expect(expr!.style.backgroundColor).toBe(theme.colors.primary);
  });

  it('closes panel after applying a theme', () => {
    useCanvasStore.getState().addExpression(makeRectangle('rect-1'));

    const { container } = render(<ThemePickerPanel />);
    const button = container.querySelector('[data-testid="theme-picker-button"]')!;
    fireEvent.click(button);

    const corporateItem = container.querySelector('[data-theme-id="corporate"]')!;
    fireEvent.click(corporateItem);

    const panel = container.querySelector('[data-testid="theme-picker-panel"]');
    expect(panel).toBeNull();
  });

  it('does not show scope toggle when nothing is selected', () => {
    const { container } = render(<ThemePickerPanel />);
    const button = container.querySelector('[data-testid="theme-picker-button"]')!;
    fireEvent.click(button);

    const scopeAll = container.querySelector('[data-testid="theme-scope-all"]');
    expect(scopeAll).toBeNull();
  });

  it('shows scope toggle when expressions are selected', () => {
    useCanvasStore.getState().addExpression(makeRectangle('rect-1'));
    useCanvasStore.setState({ selectedIds: new Set(['rect-1']) });

    const { container } = render(<ThemePickerPanel />);
    const button = container.querySelector('[data-testid="theme-picker-button"]')!;
    fireEvent.click(button);

    const scopeAll = container.querySelector('[data-testid="theme-scope-all"]');
    const scopeSelected = container.querySelector('[data-testid="theme-scope-selected"]');
    expect(scopeAll).not.toBeNull();
    expect(scopeSelected).not.toBeNull();
  });

  it('closes panel on Escape key', () => {
    const { container } = render(<ThemePickerPanel />);
    const button = container.querySelector('[data-testid="theme-picker-button"]')!;
    fireEvent.click(button);
    expect(container.querySelector('[data-testid="theme-picker-panel"]')).not.toBeNull();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(container.querySelector('[data-testid="theme-picker-panel"]')).toBeNull();
  });

  it('closes panel on click outside', () => {
    const { container } = render(<ThemePickerPanel />);
    const button = container.querySelector('[data-testid="theme-picker-button"]')!;
    fireEvent.click(button);
    expect(container.querySelector('[data-testid="theme-picker-panel"]')).not.toBeNull();

    // Click on document body (outside the panel)
    fireEvent.mouseDown(document.body);
    expect(container.querySelector('[data-testid="theme-picker-panel"]')).toBeNull();
  });
});
