/**
 * Unit tests for AgentActions — context-aware AI action buttons.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies action buttons render when expressions are selected
 * and emit correct events on click.
 *
 * @vitest-environment jsdom
 * @module
 */

import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { AgentActions } from '../components/toolbar/AgentActions.js';
import type { VisualExpression, ExpressionKind } from '@infinicanvas/protocol';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';

// ── Test helpers ───────────────────────────────────────────

function makeExpression(
  kind: ExpressionKind,
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

const textExpr = makeExpression('text', {
  kind: 'text',
  content: 'Hello world',
  fontSize: 16,
  fontFamily: 'sans-serif',
  textAlign: 'left',
});

// ── Tests ──────────────────────────────────────────────────

describe('AgentActions', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when no expressions are selected', () => {
    const { container } = render(
      <AgentActions
        selectedExpressions={[]}
        onAction={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-testid="agent-actions"]')).toBeNull();
  });

  it('renders action buttons when an expression is selected', () => {
    const { getByText } = render(
      <AgentActions
        selectedExpressions={[flowchartExpr]}
        onAction={vi.fn()}
      />,
    );

    expect(getByText('Explain this')).toBeTruthy();
    expect(getByText('Extend this')).toBeTruthy();
  });

  it('shows "Diagram this" only for text expressions', () => {
    const { getByText, queryByText, rerender } = render(
      <AgentActions
        selectedExpressions={[textExpr]}
        onAction={vi.fn()}
      />,
    );

    expect(getByText('Diagram this')).toBeTruthy();

    // Re-render with flowchart — should NOT show "Diagram this"
    rerender(
      <AgentActions
        selectedExpressions={[flowchartExpr]}
        onAction={vi.fn()}
      />,
    );
    expect(queryByText('Diagram this')).toBeNull();
  });

  it('emits "explain" action with expression data', () => {
    const onAction = vi.fn();
    const { getByText } = render(
      <AgentActions
        selectedExpressions={[flowchartExpr]}
        onAction={onAction}
      />,
    );

    fireEvent.click(getByText('Explain this'));
    expect(onAction).toHaveBeenCalledWith('explain', [flowchartExpr]);
  });

  it('emits "extend" action with expression data', () => {
    const onAction = vi.fn();
    const { getByText } = render(
      <AgentActions
        selectedExpressions={[flowchartExpr]}
        onAction={onAction}
      />,
    );

    fireEvent.click(getByText('Extend this'));
    expect(onAction).toHaveBeenCalledWith('extend', [flowchartExpr]);
  });

  it('emits "diagram" action for text expressions', () => {
    const onAction = vi.fn();
    const { getByText } = render(
      <AgentActions
        selectedExpressions={[textExpr]}
        onAction={onAction}
      />,
    );

    fireEvent.click(getByText('Diagram this'));
    expect(onAction).toHaveBeenCalledWith('diagram', [textExpr]);
  });

  it('renders with accessible aria-labels on buttons', () => {
    const { container } = render(
      <AgentActions
        selectedExpressions={[flowchartExpr]}
        onAction={vi.fn()}
      />,
    );

    const buttons = container.querySelectorAll('button');
    for (const button of buttons) {
      expect(button.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('passes all selected expressions to action callback', () => {
    const secondExpr = {
      ...flowchartExpr,
      id: 'test-expr-2',
    };

    const onAction = vi.fn();
    const { getByText } = render(
      <AgentActions
        selectedExpressions={[flowchartExpr, secondExpr]}
        onAction={onAction}
      />,
    );

    fireEvent.click(getByText('Explain this'));
    expect(onAction).toHaveBeenCalledWith('explain', [flowchartExpr, secondExpr]);
  });
});
