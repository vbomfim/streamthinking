/**
 * Unit tests for StencilPalette — browsable stencil panel for placing
 * SVG icon expressions on the canvas.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies palette renders categories, stencil items, collapsible
 * sections, click-to-place, and drag-to-place behavior.
 *
 * @vitest-environment jsdom
 * @module
 */

import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { StencilPalette } from '../components/toolbar/StencilPalette.js';
import type { VisualExpression } from '@infinicanvas/protocol';
import { stencilDataSchema } from '@infinicanvas/protocol';
import {
  getAllCategories,
  getStencilsByCategory,
  STENCIL_CATALOG,
} from '@infinicanvas/engine';

// ── Tests ──────────────────────────────────────────────────

describe('StencilPalette', () => {
  afterEach(() => {
    cleanup();
  });

  // ── Rendering ──────────────────────────────────────────────

  it('renders all category headers', () => {
    const { getByText } = render(
      <StencilPalette onInsert={vi.fn()} isOpen={true} />,
    );

    // Categories from the catalog (display names)
    expect(getByText('Architecture')).toBeTruthy();
    expect(getByText('Azure')).toBeTruthy();
    expect(getByText('Azure ARM')).toBeTruthy();
    expect(getByText('Generic IT')).toBeTruthy();
    expect(getByText('Kubernetes')).toBeTruthy();
    expect(getByText('Network')).toBeTruthy();
  });

  it('renders stencil items for all categories', () => {
    const { container } = render(
      <StencilPalette onInsert={vi.fn()} isOpen={true} />,
    );

    const stencilItems = container.querySelectorAll('[data-testid^="stencil-item-"]');
    expect(stencilItems.length).toBe(STENCIL_CATALOG.size);
  });

  it('renders stencil labels', () => {
    const { getByText } = render(
      <StencilPalette onInsert={vi.fn()} isOpen={true} />,
    );

    // Sample stencils from different categories
    expect(getByText('Server')).toBeTruthy();
    expect(getByText('Database')).toBeTruthy();
    expect(getByText('Kubernetes Pod')).toBeTruthy();
  });

  it('renders SVG thumbnails for stencils', () => {
    const { container } = render(
      <StencilPalette onInsert={vi.fn()} isOpen={true} />,
    );

    const thumbnails = container.querySelectorAll('[data-testid^="stencil-svg-"]');
    expect(thumbnails.length).toBe(STENCIL_CATALOG.size);
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <StencilPalette onInsert={vi.fn()} isOpen={false} />,
    );

    expect(container.querySelector('[data-testid="stencil-palette-panel"]')).toBeNull();
  });

  it('renders the panel when isOpen is true', () => {
    const { container } = render(
      <StencilPalette onInsert={vi.fn()} isOpen={true} />,
    );

    expect(container.querySelector('[data-testid="stencil-palette-panel"]')).not.toBeNull();
  });

  // ── Collapsible categories ────────────────────────────────

  it('collapses a category when clicking the header', () => {
    const { getByText, container } = render(
      <StencilPalette onInsert={vi.fn()} isOpen={true} />,
    );

    // All categories are expanded by default
    const networkStencils = getStencilsByCategory('network');
    const firstNetworkItem = container.querySelector(
      `[data-testid="stencil-item-${networkStencils[0]!.id}"]`,
    );
    expect(firstNetworkItem).not.toBeNull();

    // Click the Network header to collapse
    fireEvent.click(getByText('Network'));

    // Network stencils should now be hidden
    const hiddenItem = container.querySelector(
      `[data-testid="stencil-item-${networkStencils[0]!.id}"]`,
    );
    expect(hiddenItem).toBeNull();
  });

  it('re-expands a collapsed category when clicking again', () => {
    const { getByText, container } = render(
      <StencilPalette onInsert={vi.fn()} isOpen={true} />,
    );

    const networkStencils = getStencilsByCategory('network');

    // Collapse
    fireEvent.click(getByText('Network'));
    expect(
      container.querySelector(`[data-testid="stencil-item-${networkStencils[0]!.id}"]`),
    ).toBeNull();

    // Re-expand
    fireEvent.click(getByText('Network'));
    expect(
      container.querySelector(`[data-testid="stencil-item-${networkStencils[0]!.id}"]`),
    ).not.toBeNull();
  });

  // ── Click-to-place ────────────────────────────────────────

  it('calls onInsert with a valid stencil expression when clicking a stencil', () => {
    const onInsert = vi.fn();
    const { getByText } = render(
      <StencilPalette onInsert={onInsert} isOpen={true} />,
    );

    fireEvent.click(getByText('Server'));
    expect(onInsert).toHaveBeenCalledTimes(1);

    const expr: VisualExpression = onInsert.mock.calls[0]![0];
    expect(expr.kind).toBe('stencil');
    expect(expr.id).toBeTruthy();
    expect(expr.position).toEqual({ x: 0, y: 0 });
    expect(stencilDataSchema.safeParse(expr.data).success).toBe(true);
  });

  it('uses the stencil defaultSize from the catalog', () => {
    const onInsert = vi.fn();
    const { getByText } = render(
      <StencilPalette onInsert={onInsert} isOpen={true} />,
    );

    fireEvent.click(getByText('Server'));
    const expr: VisualExpression = onInsert.mock.calls[0]![0];
    expect(expr.size).toEqual({ width: 64, height: 64 });
  });

  it('populates stencilId and category in the expression data', () => {
    const onInsert = vi.fn();
    const { getByText } = render(
      <StencilPalette onInsert={onInsert} isOpen={true} />,
    );

    fireEvent.click(getByText('Server'));
    const expr: VisualExpression = onInsert.mock.calls[0]![0];
    const data = expr.data as { kind: string; stencilId: string; category: string; label?: string };
    expect(data.stencilId).toBe('server');
    expect(data.category).toBe('network');
    expect(data.label).toBe('Server');
  });

  it('generates unique IDs for each inserted stencil', () => {
    const onInsert = vi.fn();
    const { getByText } = render(
      <StencilPalette onInsert={onInsert} isOpen={true} />,
    );

    fireEvent.click(getByText('Server'));
    fireEvent.click(getByText('Database'));

    const expr1 = onInsert.mock.calls[0]![0] as VisualExpression;
    const expr2 = onInsert.mock.calls[1]![0] as VisualExpression;
    expect(expr1.id).not.toBe(expr2.id);
  });

  // ── Drag-to-place ────────────────────────────────────────

  it('sets draggable attribute on stencil items', () => {
    const { container } = render(
      <StencilPalette onInsert={vi.fn()} isOpen={true} />,
    );

    const firstItem = container.querySelector('[data-testid^="stencil-item-"]');
    expect(firstItem).not.toBeNull();
    expect(firstItem!.getAttribute('draggable')).toBe('true');
  });

  it('sets stencil data on dragStart event', () => {
    const { container } = render(
      <StencilPalette onInsert={vi.fn()} isOpen={true} />,
    );

    const firstItem = container.querySelector('[data-testid="stencil-item-server"]');
    expect(firstItem).not.toBeNull();

    const setDataMock = vi.fn();
    const dataTransfer = {
      setData: setDataMock,
      effectAllowed: '',
    };

    fireEvent.dragStart(firstItem!, { dataTransfer });

    expect(setDataMock).toHaveBeenCalledWith(
      'application/x-infinicanvas-stencil',
      'server',
    );
  });

  // ── Accessibility ─────────────────────────────────────────

  it('renders with accessible navigation role', () => {
    const { container } = render(
      <StencilPalette onInsert={vi.fn()} isOpen={true} />,
    );

    const panel = container.querySelector('[role="navigation"]');
    expect(panel).not.toBeNull();
  });

  it('category headers have button role for accessibility', () => {
    const { container } = render(
      <StencilPalette onInsert={vi.fn()} isOpen={true} />,
    );

    const categoryHeaders = container.querySelectorAll('[data-testid^="category-header-"]');
    const categories = getAllCategories();
    expect(categoryHeaders.length).toBe(categories.length);

    for (const header of categoryHeaders) {
      expect(header.tagName.toLowerCase()).toBe('button');
    }
  });
});
