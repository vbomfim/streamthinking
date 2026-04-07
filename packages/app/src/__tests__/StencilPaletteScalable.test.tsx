/**
 * Unit tests for StencilPalette scalable features — search, badges,
 * show-more pagination, category sorting, and tooltips.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Extends the existing StencilPalette.test.tsx with new feature tests.
 *
 * @vitest-environment jsdom
 * @module
 */

import { render, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { StencilPalette } from '../components/toolbar/StencilPalette.js';
import { getAllStencilMeta } from '@infinicanvas/engine';

// ── Tests ──────────────────────────────────────────────────

describe('StencilPalette — Scalable features', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // ── Search ──────────────────────────────────────────────

  describe('Search input', () => {
    it('renders a search input when the palette is open', async () => {
      const { container } = render(
        <StencilPalette onInsert={vi.fn()} isOpen={true} />,
      );

      await waitFor(() => {
        const input = container.querySelector('[data-testid="stencil-search-input"]');
        expect(input).not.toBeNull();
      });
    });

    it('does not render search input when palette is closed', () => {
      const { container } = render(
        <StencilPalette onInsert={vi.fn()} isOpen={false} />,
      );
      const input = container.querySelector('[data-testid="stencil-search-input"]');
      expect(input).toBeNull();
    });

    it('filters stencils by search query after debounce', async () => {
      const { container } = render(
        <StencilPalette onInsert={vi.fn()} isOpen={true} />,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(container.querySelector('[data-testid^="stencil-item-"]')).not.toBeNull();
      });

      const input = container.querySelector('[data-testid="stencil-search-input"]') as HTMLInputElement;

      // Type a search query and wait for debounce
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Server' } });
      });

      // Wait for debounce (200ms) + state update
      await waitFor(() => {
        // Should show Server stencil
        expect(container.querySelector('[data-testid="stencil-item-server"]')).not.toBeNull();
        // Should NOT show unrelated stencils like Database
        expect(container.querySelector('[data-testid="stencil-item-database"]')).toBeNull();
      }, { timeout: 2000 });
    });

    it('shows a clear button when search has text', async () => {
      const { container } = render(
        <StencilPalette onInsert={vi.fn()} isOpen={true} />,
      );

      const input = container.querySelector('[data-testid="stencil-search-input"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: 'test' } });
      });

      // Clear button appears immediately (not debounced — it tracks raw input)
      const clearButton = container.querySelector('[data-testid="stencil-search-clear"]');
      expect(clearButton).not.toBeNull();
    });

    it('clears search when clear button is clicked', async () => {
      const { container } = render(
        <StencilPalette onInsert={vi.fn()} isOpen={true} />,
      );

      const input = container.querySelector('[data-testid="stencil-search-input"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: 'test' } });
      });

      const clearButton = container.querySelector('[data-testid="stencil-search-clear"]');

      await act(async () => {
        fireEvent.click(clearButton!);
      });

      expect(input.value).toBe('');
    });

    it('search is case-insensitive', async () => {
      const { container } = render(
        <StencilPalette onInsert={vi.fn()} isOpen={true} />,
      );

      // Wait for load
      await waitFor(() => {
        expect(container.querySelector('[data-testid^="stencil-item-"]')).not.toBeNull();
      });

      const input = container.querySelector('[data-testid="stencil-search-input"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: 'server' } });
      });

      await waitFor(() => {
        expect(container.querySelector('[data-testid="stencil-item-server"]')).not.toBeNull();
      }, { timeout: 2000 });
    });
  });

  // ── Category badges ─────────────────────────────────────

  describe('Category count badges', () => {
    it('shows stencil count on category headers from metadata', () => {
      const { container } = render(
        <StencilPalette onInsert={vi.fn()} isOpen={true} />,
      );

      // Category count badges appear immediately (sync metadata)
      const allMeta = getAllStencilMeta();
      const networkCount = allMeta.filter((m) => m.category === 'network').length;

      const badge = container.querySelector('[data-testid="category-count-network"]');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe(String(networkCount));
    });
  });

  // ── Show more ────────────────────────────────────────────

  describe('Show more pagination', () => {
    it('does not show "Show more" button for small categories', async () => {
      const { container } = render(
        <StencilPalette onInsert={vi.fn()} isOpen={true} />,
      );

      // Wait for stencils to load
      await waitFor(() => {
        expect(container.querySelector('[data-testid^="stencil-item-"]')).not.toBeNull();
      });

      // Network has ~5 stencils — no show more button expected
      const showMore = container.querySelector('[data-testid="show-more-network"]');
      expect(showMore).toBeNull();
    });
  });

  // ── Category sort order ─────────────────────────────────

  describe('Category sort order', () => {
    it('renders categories in priority order', () => {
      const { container } = render(
        <StencilPalette onInsert={vi.fn()} isOpen={true} />,
      );

      const headers = container.querySelectorAll('[data-testid^="category-header-"]');
      const categoryOrder = [...headers].map(
        (h) => h.getAttribute('data-testid')!.replace('category-header-', ''),
      );

      // Network should appear before azure-arm
      const networkIdx = categoryOrder.indexOf('network');
      const azureArmIdx = categoryOrder.indexOf('azure-arm');
      expect(networkIdx).toBeLessThan(azureArmIdx);
    });
  });

  // ── Tooltips ────────────────────────────────────────────

  describe('Stencil tooltips', () => {
    it('stencil items have title attribute for tooltip', async () => {
      const { container } = render(
        <StencilPalette onInsert={vi.fn()} isOpen={true} />,
      );

      await waitFor(() => {
        const serverItem = container.querySelector('[data-testid="stencil-item-server"]');
        expect(serverItem).not.toBeNull();
        expect(serverItem!.getAttribute('title')).toBe('Server');
      });
    });
  });
});
