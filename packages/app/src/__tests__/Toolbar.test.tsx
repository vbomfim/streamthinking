/**
 * Unit tests for Toolbar component.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies toolbar renders, tool buttons work, and active tool
 * is visually highlighted.
 *
 * @vitest-environment jsdom
 * @module
 */

import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Toolbar } from '../components/toolbar/Toolbar.js';
import { useCanvasStore } from '@infinicanvas/engine';

// ── Test helpers ───────────────────────────────────────────

function resetStore() {
  useCanvasStore.setState({
    activeTool: 'select',
  });
}

// ── Tests ──────────────────────────────────────────────────

describe('Toolbar', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all 8 tool buttons [AC3]', () => {
    const { container } = render(<Toolbar />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(8);
  });

  it('renders with role="toolbar" for accessibility', () => {
    const { container } = render(<Toolbar />);
    const toolbar = container.querySelector('[role="toolbar"]');
    expect(toolbar).not.toBeNull();
  });

  it('highlights the active tool (Select by default) [AC3]', () => {
    const { container } = render(<Toolbar />);
    const selectButton = container.querySelector('[data-tool="select"]');
    expect(selectButton).not.toBeNull();
    expect(selectButton!.getAttribute('aria-pressed')).toBe('true');
  });

  it('sets activeTool in store when clicking a tool [AC3]', () => {
    const { container } = render(<Toolbar />);

    const rectButton = container.querySelector('[data-tool="rectangle"]');
    expect(rectButton).not.toBeNull();

    fireEvent.click(rectButton!);

    expect(useCanvasStore.getState().activeTool).toBe('rectangle');
  });

  it('updates active highlighting when tool changes [AC3]', () => {
    const { container, rerender } = render(<Toolbar />);

    fireEvent.click(container.querySelector('[data-tool="ellipse"]')!);

    // Re-render to pick up state change
    rerender(<Toolbar />);

    const ellipseBtn = container.querySelector('[data-tool="ellipse"]');
    const selectBtn = container.querySelector('[data-tool="select"]');

    expect(ellipseBtn!.getAttribute('aria-pressed')).toBe('true');
    expect(selectBtn!.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders all expected tool types', () => {
    const { container } = render(<Toolbar />);

    const toolTypes = ['select', 'rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'freehand', 'text'];
    for (const type of toolTypes) {
      const btn = container.querySelector(`[data-tool="${type}"]`);
      expect(btn, `Button for tool "${type}" should exist`).not.toBeNull();
    }
  });

  it('each button has an accessible label', () => {
    const { container } = render(<Toolbar />);
    const buttons = container.querySelectorAll('button');

    for (const button of buttons) {
      const label = button.getAttribute('aria-label');
      expect(label, 'Each button should have an aria-label').toBeTruthy();
    }
  });
});
