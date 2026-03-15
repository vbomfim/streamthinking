/**
 * Unit tests for Toolbar style indicator (color swatch).
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies the toolbar shows a color swatch indicating current
 * stroke/fill colors from lastUsedStyle.
 *
 * @vitest-environment jsdom
 * @module
 */

import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Toolbar } from '../components/toolbar/Toolbar.js';
import { useCanvasStore } from '@infinicanvas/engine';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';

// ── Test helpers ───────────────────────────────────────────

function resetStore() {
  useCanvasStore.setState({
    activeTool: 'select',
    lastUsedStyle: { ...DEFAULT_EXPRESSION_STYLE },
  });
}

// ── Tests ──────────────────────────────────────────────────

describe('Toolbar style indicator', () => {
  beforeEach(() => resetStore());
  afterEach(() => cleanup());

  it('renders a style indicator swatch', () => {
    const { container } = render(<Toolbar />);
    const indicator = container.querySelector('[data-testid="style-indicator"]');
    expect(indicator).not.toBeNull();
  });

  it('shows current stroke color as border', () => {
    useCanvasStore.setState({
      lastUsedStyle: { ...DEFAULT_EXPRESSION_STYLE, strokeColor: '#ff0000' },
    });

    const { container } = render(<Toolbar />);
    const indicator = container.querySelector('[data-testid="style-indicator"]') as HTMLElement;
    expect(indicator).not.toBeNull();
    // jsdom normalizes hex to rgb — verify the stroke color is applied
    expect(indicator.style.borderColor).toBe('rgb(255, 0, 0)');
  });

  it('shows current fill color as background', () => {
    useCanvasStore.setState({
      lastUsedStyle: { ...DEFAULT_EXPRESSION_STYLE, backgroundColor: '#00ff00' },
    });

    const { container } = render(<Toolbar />);
    const indicator = container.querySelector('[data-testid="style-indicator"]') as HTMLElement;
    expect(indicator).not.toBeNull();
    expect(indicator.style.backgroundColor).toBe('rgb(0, 255, 0)');
  });

  it('shows transparent pattern when fill is transparent', () => {
    const { container } = render(<Toolbar />);
    const indicator = container.querySelector('[data-testid="style-indicator"]') as HTMLElement;
    expect(indicator).not.toBeNull();
    // Default is transparent — should use a checkerboard-like background
    expect(indicator.dataset.transparent).toBe('true');
  });
});
