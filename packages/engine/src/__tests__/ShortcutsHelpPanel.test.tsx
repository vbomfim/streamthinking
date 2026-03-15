// @vitest-environment jsdom
/**
 * Unit tests for ShortcutsHelpPanel component.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Acceptance criteria from Issue #10.
 *
 * @module
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ShortcutsHelpPanel } from '../components/ShortcutsHelpPanel.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ShortcutsHelpPanel', () => {
  it('renders a table with shortcut entries', () => {
    const { container } = render(
      <ShortcutsHelpPanel onClose={vi.fn()} />,
    );

    // Should have a table or list of shortcuts
    const rows = container.querySelectorAll('tr, [role="row"]');
    // At minimum we expect tool shortcuts + action shortcuts
    expect(rows.length).toBeGreaterThan(8);
  });

  it('displays tool shortcut keys', () => {
    render(<ShortcutsHelpPanel onClose={vi.fn()} />);

    // Verify key tool shortcuts are visible
    expect(screen.getByText('Select')).toBeDefined();
    expect(screen.getByText('Rectangle')).toBeDefined();
    expect(screen.getByText('Ellipse')).toBeDefined();
    expect(screen.getByText('Diamond')).toBeDefined();
    expect(screen.getByText('Line')).toBeDefined();
    expect(screen.getByText('Arrow')).toBeDefined();
    expect(screen.getByText('Freehand')).toBeDefined();
    expect(screen.getByText('Text')).toBeDefined();
  });

  it('displays action shortcut keys', () => {
    render(<ShortcutsHelpPanel onClose={vi.fn()} />);

    // Verify action shortcuts are visible
    expect(screen.getByText(/Undo/)).toBeDefined();
    expect(screen.getByText(/Redo/)).toBeDefined();
    expect(screen.getByText(/Duplicate/)).toBeDefined();
    expect(screen.getByText(/Select All/i)).toBeDefined();
    expect(screen.getByText(/Delete selected/)).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<ShortcutsHelpPanel onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<ShortcutsHelpPanel onClose={onClose} />);

    // Click the backdrop (outermost overlay element)
    const backdrop = container.querySelector('[data-testid="shortcuts-backdrop"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the panel', () => {
    const onClose = vi.fn();
    const { container } = render(<ShortcutsHelpPanel onClose={onClose} />);

    // Click inside the panel content
    const panel = container.querySelector('[data-testid="shortcuts-panel"]');
    expect(panel).not.toBeNull();
    fireEvent.click(panel!);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('has a visible title', () => {
    render(<ShortcutsHelpPanel onClose={vi.fn()} />);

    expect(screen.getByText(/Keyboard Shortcuts/i)).toBeDefined();
  });
});
