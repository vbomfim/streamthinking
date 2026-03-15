/**
 * Unit tests for MorphContextMenu — "View as..." context menu.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies context menu renders morph targets for composite expressions
 * and triggers morphing on selection.
 *
 * @vitest-environment jsdom
 * @module
 */

import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MorphContextMenu } from '../components/contextmenu/MorphContextMenu.js';
import type { VisualExpression } from '@infinicanvas/protocol';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';

// ── Test helpers ───────────────────────────────────────────

function makeExpression(
  kind: VisualExpression['kind'],
  data: VisualExpression['data'],
): VisualExpression {
  return {
    id: 'test-expr-1',
    kind,
    position: { x: 100, y: 200 },
    size: { width: 400, height: 300 },
    angle: 0,
    style: { ...DEFAULT_EXPRESSION_STYLE },
    meta: {
      author: { type: 'human', id: 'user-1', name: 'Test User' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data,
  };
}

const flowchartExpr = makeExpression('flowchart', {
  kind: 'flowchart',
  title: 'Test Flow',
  nodes: [{ id: 'n1', label: 'Start', shape: 'rect' as const }],
  edges: [],
  direction: 'TB' as const,
});

const rectangleExpr = makeExpression('rectangle', {
  kind: 'rectangle',
  label: 'Box',
});

// ── Tests ──────────────────────────────────────────────────

describe('MorphContextMenu', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders "View as..." header when expression has morph targets', () => {
    const { getByText } = render(
      <MorphContextMenu
        expression={flowchartExpr}
        position={{ x: 200, y: 300 }}
        onMorph={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(getByText('View as...')).toBeTruthy();
  });

  it('renders morph targets for flowchart (Table, Reasoning Chain)', () => {
    const { getByText } = render(
      <MorphContextMenu
        expression={flowchartExpr}
        position={{ x: 200, y: 300 }}
        onMorph={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(getByText('Table')).toBeTruthy();
    expect(getByText('Reasoning Chain')).toBeTruthy();
  });

  it('renders nothing when expression has no morph targets', () => {
    const { container } = render(
      <MorphContextMenu
        expression={rectangleExpr}
        position={{ x: 200, y: 300 }}
        onMorph={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    // Should render null or empty
    expect(container.querySelector('[data-testid="morph-menu"]')).toBeNull();
  });

  it('calls onMorph with target kind when option is clicked', () => {
    const onMorph = vi.fn();
    const { getByText } = render(
      <MorphContextMenu
        expression={flowchartExpr}
        position={{ x: 200, y: 300 }}
        onMorph={onMorph}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(getByText('Table'));
    expect(onMorph).toHaveBeenCalledWith('test-expr-1', 'table');
  });

  it('calls onClose after selecting a morph target', () => {
    const onClose = vi.fn();
    const { getByText } = render(
      <MorphContextMenu
        expression={flowchartExpr}
        position={{ x: 200, y: 300 }}
        onMorph={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByText('Table'));
    expect(onClose).toHaveBeenCalled();
  });

  it('positions the menu at the given coordinates', () => {
    const { container } = render(
      <MorphContextMenu
        expression={flowchartExpr}
        position={{ x: 250, y: 350 }}
        onMorph={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const menu = container.querySelector('[data-testid="morph-menu"]');
    expect(menu).not.toBeNull();
    const style = (menu as HTMLElement).style;
    expect(style.left).toBe('250px');
    expect(style.top).toBe('350px');
  });

  it('has accessible role="menu" and role="menuitem"', () => {
    const { container } = render(
      <MorphContextMenu
        expression={flowchartExpr}
        position={{ x: 200, y: 300 }}
        onMorph={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const menu = container.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    const items = container.querySelectorAll('[role="menuitem"]');
    expect(items.length).toBe(2); // Table, Reasoning Chain
  });
});
