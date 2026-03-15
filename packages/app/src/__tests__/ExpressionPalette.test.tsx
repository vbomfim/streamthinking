/**
 * Unit tests for ExpressionPalette — quick-insert panel for composites.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies palette renders template options and creates valid
 * expressions when clicked.
 *
 * @vitest-environment jsdom
 * @module
 */

import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { ExpressionPalette } from '../components/toolbar/ExpressionPalette.js';
import type { VisualExpression } from '@infinicanvas/protocol';
import {
  flowchartDataSchema,
  sequenceDiagramDataSchema,
  mindMapDataSchema,
  reasoningChainDataSchema,
  kanbanDataSchema,
  tableDataSchema,
  roadmapDataSchema,
  codeBlockDataSchema,
  slideDataSchema,
} from '@infinicanvas/protocol';

// ── Tests ──────────────────────────────────────────────────

describe('ExpressionPalette', () => {
  afterEach(() => {
    cleanup();
  });

  /** Opens the palette by clicking the toggle button. */
  function openPalette(getByLabelText: ReturnType<typeof render>['getByLabelText']): void {
    fireEvent.click(getByLabelText('Insert expression'));
  }

  it('renders all composite template buttons', () => {
    const { getByText, getByLabelText } = render(
      <ExpressionPalette onInsert={vi.fn()} />,
    );

    openPalette(getByLabelText);

    expect(getByText('Flowchart')).toBeTruthy();
    expect(getByText('Sequence Diagram')).toBeTruthy();
    expect(getByText('Mind Map')).toBeTruthy();
    expect(getByText('Reasoning Chain')).toBeTruthy();
    expect(getByText('Kanban')).toBeTruthy();
    expect(getByText('Table')).toBeTruthy();
    expect(getByText('Roadmap')).toBeTruthy();
    expect(getByText('Code Block')).toBeTruthy();
    expect(getByText('Slide')).toBeTruthy();
  });

  it('calls onInsert with valid flowchart expression', () => {
    const onInsert = vi.fn();
    const { getByText, getByLabelText } = render(
      <ExpressionPalette onInsert={onInsert} />,
    );

    openPalette(getByLabelText);
    fireEvent.click(getByText('Flowchart'));
    expect(onInsert).toHaveBeenCalledTimes(1);

    const expr: VisualExpression = onInsert.mock.calls[0][0];
    expect(expr.kind).toBe('flowchart');
    expect(flowchartDataSchema.safeParse(expr.data).success).toBe(true);
  });

  it('calls onInsert with valid sequence diagram expression', () => {
    const onInsert = vi.fn();
    const { getByText, getByLabelText } = render(
      <ExpressionPalette onInsert={onInsert} />,
    );

    openPalette(getByLabelText);
    fireEvent.click(getByText('Sequence Diagram'));
    expect(onInsert).toHaveBeenCalledTimes(1);

    const expr: VisualExpression = onInsert.mock.calls[0][0];
    expect(expr.kind).toBe('sequence-diagram');
    expect(sequenceDiagramDataSchema.safeParse(expr.data).success).toBe(true);
  });

  it('calls onInsert with valid mind map expression', () => {
    const onInsert = vi.fn();
    const { getByText, getByLabelText } = render(
      <ExpressionPalette onInsert={onInsert} />,
    );

    openPalette(getByLabelText);
    fireEvent.click(getByText('Mind Map'));
    expect(onInsert).toHaveBeenCalledTimes(1);

    const expr: VisualExpression = onInsert.mock.calls[0][0];
    expect(expr.kind).toBe('mind-map');
    expect(mindMapDataSchema.safeParse(expr.data).success).toBe(true);
  });

  it('calls onInsert with valid reasoning chain expression', () => {
    const onInsert = vi.fn();
    const { getByText, getByLabelText } = render(
      <ExpressionPalette onInsert={onInsert} />,
    );

    openPalette(getByLabelText);
    fireEvent.click(getByText('Reasoning Chain'));
    expect(onInsert).toHaveBeenCalledTimes(1);

    const expr: VisualExpression = onInsert.mock.calls[0][0];
    expect(expr.kind).toBe('reasoning-chain');
    expect(reasoningChainDataSchema.safeParse(expr.data).success).toBe(true);
  });

  it('calls onInsert with valid kanban expression', () => {
    const onInsert = vi.fn();
    const { getByText, getByLabelText } = render(
      <ExpressionPalette onInsert={onInsert} />,
    );

    openPalette(getByLabelText);
    fireEvent.click(getByText('Kanban'));
    expect(onInsert).toHaveBeenCalledTimes(1);

    const expr: VisualExpression = onInsert.mock.calls[0][0];
    expect(expr.kind).toBe('kanban');
    expect(kanbanDataSchema.safeParse(expr.data).success).toBe(true);
  });

  it('calls onInsert with valid table expression', () => {
    const onInsert = vi.fn();
    const { getByText, getByLabelText } = render(
      <ExpressionPalette onInsert={onInsert} />,
    );

    openPalette(getByLabelText);
    fireEvent.click(getByText('Table'));
    expect(onInsert).toHaveBeenCalledTimes(1);

    const expr: VisualExpression = onInsert.mock.calls[0][0];
    expect(expr.kind).toBe('table');
    expect(tableDataSchema.safeParse(expr.data).success).toBe(true);
  });

  it('calls onInsert with valid roadmap expression', () => {
    const onInsert = vi.fn();
    const { getByText, getByLabelText } = render(
      <ExpressionPalette onInsert={onInsert} />,
    );

    openPalette(getByLabelText);
    fireEvent.click(getByText('Roadmap'));
    expect(onInsert).toHaveBeenCalledTimes(1);

    const expr: VisualExpression = onInsert.mock.calls[0][0];
    expect(expr.kind).toBe('roadmap');
    expect(roadmapDataSchema.safeParse(expr.data).success).toBe(true);
  });

  it('calls onInsert with valid code block expression', () => {
    const onInsert = vi.fn();
    const { getByText, getByLabelText } = render(
      <ExpressionPalette onInsert={onInsert} />,
    );

    openPalette(getByLabelText);
    fireEvent.click(getByText('Code Block'));
    expect(onInsert).toHaveBeenCalledTimes(1);

    const expr: VisualExpression = onInsert.mock.calls[0][0];
    expect(expr.kind).toBe('code-block');
    expect(codeBlockDataSchema.safeParse(expr.data).success).toBe(true);
  });

  it('calls onInsert with valid slide expression', () => {
    const onInsert = vi.fn();
    const { getByText, getByLabelText } = render(
      <ExpressionPalette onInsert={onInsert} />,
    );

    openPalette(getByLabelText);
    fireEvent.click(getByText('Slide'));
    expect(onInsert).toHaveBeenCalledTimes(1);

    const expr: VisualExpression = onInsert.mock.calls[0][0];
    expect(expr.kind).toBe('slide');
    expect(slideDataSchema.safeParse(expr.data).success).toBe(true);
  });

  it('each template generates unique expression IDs', () => {
    const onInsert = vi.fn();
    const { getByText, getByLabelText } = render(
      <ExpressionPalette onInsert={onInsert} />,
    );

    openPalette(getByLabelText);
    fireEvent.click(getByText('Flowchart'));
    fireEvent.click(getByText('Mind Map'));

    const expr1 = onInsert.mock.calls[0][0] as VisualExpression;
    const expr2 = onInsert.mock.calls[1][0] as VisualExpression;
    expect(expr1.id).not.toBe(expr2.id);
  });

  it('renders with accessible role="toolbar"', () => {
    const { container, getByLabelText } = render(
      <ExpressionPalette onInsert={vi.fn()} />,
    );

    openPalette(getByLabelText);
    const toolbar = container.querySelector('[role="toolbar"]');
    expect(toolbar).not.toBeNull();
  });

  it('can be toggled open/closed', () => {
    const { container, getByLabelText } = render(
      <ExpressionPalette onInsert={vi.fn()} />,
    );

    // Should have a toggle button
    const toggle = getByLabelText('Insert expression');
    expect(toggle).toBeTruthy();

    // Initially closed — no template buttons visible
    expect(container.querySelector('[data-testid="palette-panel"]')).toBeNull();

    // Click to open
    fireEvent.click(toggle);
    expect(container.querySelector('[data-testid="palette-panel"]')).not.toBeNull();

    // Click to close
    fireEvent.click(toggle);
    expect(container.querySelector('[data-testid="palette-panel"]')).toBeNull();
  });
});
