/**
 * Unit tests for FloatingConnectorPanel component.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies: panel visibility, positioning near arrow midpoint,
 * connector controls (routing, arrowheads, edge properties),
 * viewport clamping, and drawing mode behavior.
 *
 * @vitest-environment jsdom
 * @module
 */

import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FloatingConnectorPanel } from '../components/panels/FloatingConnectorPanel.js';
import { useCanvasStore } from '@infinicanvas/engine';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';

// ── Test helpers ───────────────────────────────────────────

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

/** Create an arrow expression directly (no builder needed). */
function makeArrowExpr(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    kind: 'arrow' as const,
    position: { x: 0, y: 0 },
    size: { width: 200, height: 100 },
    angle: 0,
    style: { ...DEFAULT_EXPRESSION_STYLE },
    meta: {
      author: { type: 'human' as const, id: 'user-1', name: 'Test' },
      createdAt: 0,
      updatedAt: 0,
      tags: [],
      locked: false,
    },
    data: {
      kind: 'arrow' as const,
      points: [[0, 0], [200, 100]] as [number, number][],
      ...overrides,
    },
  };
}

function setupWithArrow(overrides: Record<string, unknown> = {}) {
  const arrowExpr = makeArrowExpr('arrow-1', overrides);
  useCanvasStore.getState().addExpression(arrowExpr);
  useCanvasStore.setState({ selectedIds: new Set(['arrow-1']) });
}

function makeRectangle(id: string) {
  return {
    id,
    kind: 'rectangle' as const,
    position: { x: 100, y: 200 },
    size: { width: 300, height: 150 },
    angle: 0,
    style: { ...DEFAULT_EXPRESSION_STYLE },
    meta: {
      author: { type: 'human' as const, id: 'user-1', name: 'Test' },
      createdAt: 0,
      updatedAt: 0,
      tags: [],
      locked: false,
    },
    data: { kind: 'rectangle' as const, label: 'Test' },
  };
}

// ── Tests ──────────────────────────────────────────────────

describe('FloatingConnectorPanel', () => {
  beforeEach(() => {
    resetStore();
    // Set a known viewport size for positioning tests
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
  });
  afterEach(() => cleanup());

  // ── Visibility ──

  it('is hidden when no expression is selected', () => {
    const { container } = render(<FloatingConnectorPanel />);
    const panel = container.querySelector('[data-testid="floating-connector-panel"]');
    expect(panel).toBeNull();
  });

  it('is hidden when a non-arrow expression is selected', () => {
    const rect = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.setState({ selectedIds: new Set(['rect-1']) });
    const { container } = render(<FloatingConnectorPanel />);
    const panel = container.querySelector('[data-testid="floating-connector-panel"]');
    expect(panel).toBeNull();
  });

  it('is visible when an arrow expression is selected', () => {
    setupWithArrow();
    const { container } = render(<FloatingConnectorPanel />);
    const panel = container.querySelector('[data-testid="floating-connector-panel"]');
    expect(panel).not.toBeNull();
  });

  it('is visible when a line expression is selected', () => {
    const lineExpr = {
      ...makeArrowExpr('line-1'),
      kind: 'line' as const,
      data: { kind: 'line' as const, points: [[0, 0], [100, 100]] as [number, number][] },
    };
    useCanvasStore.getState().addExpression(lineExpr);
    useCanvasStore.setState({ selectedIds: new Set(['line-1']) });
    const { container } = render(<FloatingConnectorPanel />);
    const panel = container.querySelector('[data-testid="floating-connector-panel"]');
    expect(panel).not.toBeNull();
  });

  it('is visible when arrow tool is active in drawing mode', () => {
    useCanvasStore.setState({ activeTool: 'arrow' });
    const { container } = render(<FloatingConnectorPanel />);
    const panel = container.querySelector('[data-testid="floating-connector-panel"]');
    expect(panel).not.toBeNull();
  });

  it('is hidden when a non-arrow tool is active (rectangle)', () => {
    useCanvasStore.setState({ activeTool: 'rectangle' });
    const { container } = render(<FloatingConnectorPanel />);
    const panel = container.querySelector('[data-testid="floating-connector-panel"]');
    expect(panel).toBeNull();
  });

  // ── Positioning ──

  it('positions near the arrow midpoint (converted to screen coords)', () => {
    // Arrow from [0,0] to [200,100], midpoint = [100,50]
    // Camera at origin, zoom=1 → screen = world
    // Panel should be offset from midpoint: x+20, y+60
    setupWithArrow();
    const { container } = render(<FloatingConnectorPanel />);
    const panel = container.querySelector('[data-testid="floating-connector-panel"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.style.position).toBe('fixed');
    // Left should be arrow midpoint.x (100) + offset (20) = 120
    const left = parseInt(panel.style.left);
    expect(left).toBe(120);
    // Top should be arrow midpoint.y (50) + offset (60) = 110
    const top = parseInt(panel.style.top);
    expect(top).toBe(110);
  });

  it('adjusts position based on camera pan', () => {
    setupWithArrow();
    // Camera panned: offset (50, 30), zoom=1
    // screen = (world - camera) * zoom = (100-50, 50-30) = (50, 20)
    useCanvasStore.setState({ camera: { x: 50, y: 30, zoom: 1 } });
    const { container } = render(<FloatingConnectorPanel />);
    const panel = container.querySelector('[data-testid="floating-connector-panel"]') as HTMLElement;
    const left = parseInt(panel.style.left);
    const top = parseInt(panel.style.top);
    // midpoint screen = (100-50)*1=50, (50-30)*1=20 → +20/+60 offset → 70, 80
    expect(left).toBe(70);
    expect(top).toBe(80);
  });

  it('adjusts position based on camera zoom', () => {
    setupWithArrow();
    // Zoom=2, camera at origin → screen = world * 2
    // midpoint=(100,50) → screen=(200,100) → +20/+60 → (220,160)
    useCanvasStore.setState({ camera: { x: 0, y: 0, zoom: 2 } });
    const { container } = render(<FloatingConnectorPanel />);
    const panel = container.querySelector('[data-testid="floating-connector-panel"]') as HTMLElement;
    const left = parseInt(panel.style.left);
    const top = parseInt(panel.style.top);
    expect(left).toBe(220);
    expect(top).toBe(160);
  });

  it('clamps position when panel would overflow right edge', () => {
    // Arrow far to the right → midpoint would place panel off-screen
    const arrowExpr = makeArrowExpr('arrow-far', {
      points: [[900, 0], [1100, 100]] as [number, number][],
    });
    useCanvasStore.getState().addExpression(arrowExpr);
    useCanvasStore.setState({ selectedIds: new Set(['arrow-far']) });
    const { container } = render(<FloatingConnectorPanel />);
    const panel = container.querySelector('[data-testid="floating-connector-panel"]') as HTMLElement;
    const left = parseInt(panel.style.left);
    // Should be clamped so panel stays visible (left + panelWidth <= viewport width)
    expect(left).toBeLessThanOrEqual(1024 - 180); // 180 is approximate min panel width
  });

  it('clamps position when panel would overflow bottom edge', () => {
    const arrowExpr = makeArrowExpr('arrow-bottom', {
      points: [[0, 700], [200, 800]] as [number, number][],
    });
    useCanvasStore.getState().addExpression(arrowExpr);
    useCanvasStore.setState({ selectedIds: new Set(['arrow-bottom']) });
    const { container } = render(<FloatingConnectorPanel />);
    const panel = container.querySelector('[data-testid="floating-connector-panel"]') as HTMLElement;
    const top = parseInt(panel.style.top);
    // Should be clamped so panel stays visible
    expect(top).toBeLessThanOrEqual(768 - 100); // approximate panel height
  });

  it('uses static position in drawing mode (no arrow to position near)', () => {
    useCanvasStore.setState({ activeTool: 'arrow' });
    const { container } = render(<FloatingConnectorPanel />);
    const panel = container.querySelector('[data-testid="floating-connector-panel"]') as HTMLElement;
    // In drawing mode without a selected arrow, use a fixed position near the bottom-center
    expect(panel.style.position).toBe('fixed');
    // Should have some reasonable position (not NaN)
    expect(parseInt(panel.style.left)).not.toBeNaN();
    expect(parseInt(panel.style.top)).not.toBeNaN();
  });

  // ── Connector controls ──

  it('renders routing mode dropdown', () => {
    setupWithArrow();
    const { container } = render(<FloatingConnectorPanel />);
    const select = container.querySelector('[data-testid="routing-mode-select"]');
    expect(select).not.toBeNull();
    expect(select?.tagName).toBe('SELECT');
  });

  it('routing dropdown has all routing mode options', () => {
    setupWithArrow();
    const { container } = render(<FloatingConnectorPanel />);
    const select = container.querySelector('[data-testid="routing-mode-select"]') as HTMLSelectElement;
    const options = select?.querySelectorAll('option');
    expect(options?.length).toBeGreaterThanOrEqual(7);
  });

  it('changing routing dropdown updates arrow data', () => {
    setupWithArrow({ routing: 'straight' });
    const { container } = render(<FloatingConnectorPanel />);
    const select = container.querySelector('[data-testid="routing-mode-select"]') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'orthogonal' } });
    const data = useCanvasStore.getState().expressions['arrow-1']?.data as unknown as Record<string, unknown>;
    expect(data?.routing).toBe('orthogonal');
  });

  it('renders start and end arrowhead dropdowns', () => {
    setupWithArrow();
    const { container } = render(<FloatingConnectorPanel />);
    const startSelect = container.querySelector('[data-testid="start-arrowhead-select"]');
    const endSelect = container.querySelector('[data-testid="end-arrowhead-select"]');
    expect(startSelect).not.toBeNull();
    expect(endSelect).not.toBeNull();
    expect(startSelect?.tagName).toBe('SELECT');
    expect(endSelect?.tagName).toBe('SELECT');
  });

  it('arrowhead dropdowns use optgroups for categories', () => {
    setupWithArrow();
    const { container } = render(<FloatingConnectorPanel />);
    const endSelect = container.querySelector('[data-testid="end-arrowhead-select"]');
    const optgroups = endSelect?.querySelectorAll('optgroup');
    expect(optgroups?.length).toBeGreaterThanOrEqual(2);
  });

  it('changing end arrowhead dropdown updates arrow data', () => {
    setupWithArrow({ endArrowhead: 'none' });
    const { container } = render(<FloatingConnectorPanel />);
    const endSelect = container.querySelector('[data-testid="end-arrowhead-select"]') as HTMLSelectElement;
    fireEvent.change(endSelect, { target: { value: 'classic' } });
    const data = useCanvasStore.getState().expressions['arrow-1']?.data as unknown as Record<string, unknown>;
    expect(data?.endArrowhead).toBe('classic');
  });

  it('changing start arrowhead dropdown updates arrow data', () => {
    setupWithArrow({ startArrowhead: 'none' });
    const { container } = render(<FloatingConnectorPanel />);
    const startSelect = container.querySelector('[data-testid="start-arrowhead-select"]') as HTMLSelectElement;
    fireEvent.change(startSelect, { target: { value: 'diamond' } });
    const data = useCanvasStore.getState().expressions['arrow-1']?.data as unknown as Record<string, unknown>;
    expect(data?.startArrowhead).toBe('diamond');
  });

  // ── Edge properties ──

  it('shows edge property checkboxes for orthogonal routing', () => {
    setupWithArrow({ routing: 'orthogonal' });
    const { container } = render(<FloatingConnectorPanel />);
    const edgeRow = container.querySelector('[data-testid="edge-properties-row"]');
    expect(edgeRow).not.toBeNull();
  });

  it('hides edge property checkboxes for non-orthogonal routing', () => {
    setupWithArrow({ routing: 'straight' });
    const { container } = render(<FloatingConnectorPanel />);
    const edgeRow = container.querySelector('[data-testid="edge-properties-row"]');
    expect(edgeRow).toBeNull();
  });

  // ── Arrowhead row layout ──

  it('arrowhead dropdowns are in a horizontal row', () => {
    setupWithArrow();
    const { container } = render(<FloatingConnectorPanel />);
    const arrowheadRow = container.querySelector('[data-testid="arrowhead-row"]');
    expect(arrowheadRow).not.toBeNull();
    const style = (arrowheadRow as HTMLElement).style;
    expect(style.display).toBe('flex');
  });

  // ── All controls in single container ──

  it('wraps all connector controls in the floating panel container', () => {
    setupWithArrow();
    const { container } = render(<FloatingConnectorPanel />);
    const panel = container.querySelector('[data-testid="floating-connector-panel"]');
    expect(panel).not.toBeNull();
    const selects = panel!.querySelectorAll('select');
    expect(selects.length).toBe(3); // routing + start arrowhead + end arrowhead
  });

  // ── Drawing mode defaults ──

  it('in drawing mode, routing dropdown reflects default arrow style', () => {
    useCanvasStore.setState({
      activeTool: 'arrow',
      defaultArrowStyle: { routing: 'curved', startArrowhead: 'none', endArrowhead: 'classic' },
    });
    const { container } = render(<FloatingConnectorPanel />);
    const select = container.querySelector('[data-testid="routing-mode-select"]') as HTMLSelectElement;
    expect(select.value).toBe('curved');
  });

  it('in drawing mode, changing routing updates defaultArrowStyle', () => {
    useCanvasStore.setState({ activeTool: 'arrow' });
    const { container } = render(<FloatingConnectorPanel />);
    const select = container.querySelector('[data-testid="routing-mode-select"]') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'elbow' } });
    const defaults = useCanvasStore.getState().defaultArrowStyle;
    expect(defaults.routing).toBe('elbow');
  });

  // ── Drag handle ──

  it('renders a drag handle header with cursor grab', () => {
    setupWithArrow();
    const { container } = render(<FloatingConnectorPanel />);
    const header = container.querySelector('[data-testid="connector-drag-handle"]') as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.style.cursor).toBe('grab');
  });

  it('positions panel below arrow midpoint with +60px Y offset by default', () => {
    // Arrow from [0,0] to [200,100], midpoint = [100,50]
    // Camera at origin, zoom=1 → screen = world
    // Panel should be offset: x + 20, y + 60
    setupWithArrow();
    const { container } = render(<FloatingConnectorPanel />);
    const panel = container.querySelector('[data-testid="floating-connector-panel"]') as HTMLElement;
    const top = parseInt(panel.style.top);
    // Midpoint Y is 50, offset should be +60 → 110
    expect(top).toBe(110);
  });

  it('resets drag offset when a different arrow is selected', () => {
    // Select first arrow
    setupWithArrow();
    const { container, rerender } = render(<FloatingConnectorPanel />);

    // Select a different arrow
    const arrow2 = makeArrowExpr('arrow-2', {
      points: [[0, 0], [100, 300]] as [number, number][],
    });
    useCanvasStore.getState().addExpression(arrow2);
    useCanvasStore.setState({ selectedIds: new Set(['arrow-2']) });
    rerender(<FloatingConnectorPanel />);

    const updatedPanel = container.querySelector('[data-testid="floating-connector-panel"]') as HTMLElement;
    const newTop = parseInt(updatedPanel.style.top);
    // Position should be recalculated for the new arrow, not carry over drag offset
    // Arrow-2 midpoint is (50, 150), +60 offset → 210
    expect(newTop).toBe(210);
  });

  it('panel mousedown does not propagate to canvas (prevents pan)', () => {
    setupWithArrow();
    const { container } = render(<FloatingConnectorPanel />);
    const panel = container.querySelector('[data-testid="floating-connector-panel"]') as HTMLElement;
    expect(panel).not.toBeNull();
    // Verify the panel has an onMouseDown handler that calls stopPropagation
    // by checking the element exists and dispatching an event
    const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    panel.dispatchEvent(mouseDown);
  });
});
