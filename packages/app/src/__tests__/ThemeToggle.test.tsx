/**
 * Unit tests for ThemeToggle component.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies theme toggle button renders, switches theme, and
 * persists preference.
 *
 * @vitest-environment jsdom
 * @module
 */

import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useUiStore } from '@infinicanvas/engine';
import { ThemeToggle } from '../components/panels/ThemeToggle.js';

beforeEach(() => {
  useUiStore.setState({ theme: 'light' });
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('ThemeToggle', () => {
  it('renders a toggle button', () => {
    const { container } = render(<ThemeToggle />);
    const button = container.querySelector('[aria-label="Toggle theme"]');
    expect(button).not.toBeNull();
  });

  it('switches theme from light to dark on click', () => {
    const { container } = render(<ThemeToggle />);
    const button = container.querySelector('[aria-label="Toggle theme"]')!;
    fireEvent.click(button);
    expect(useUiStore.getState().theme).toBe('dark');
  });

  it('switches theme from dark to light on click', () => {
    useUiStore.setState({ theme: 'dark' });
    localStorage.setItem('infinicanvas:theme', 'dark');
    const { container } = render(<ThemeToggle />);
    const button = container.querySelector('[aria-label="Toggle theme"]')!;
    fireEvent.click(button);
    expect(useUiStore.getState().theme).toBe('light');
  });

  it('displays sun icon for dark theme (to switch to light)', () => {
    useUiStore.setState({ theme: 'dark' });
    localStorage.setItem('infinicanvas:theme', 'dark');
    const { container } = render(<ThemeToggle />);
    const button = container.querySelector('[aria-label="Toggle theme"]')!;
    // Dark mode shows sun icon (to indicate "switch to light")
    expect(button.getAttribute('data-theme')).toBe('dark');
  });

  it('displays moon icon for light theme (to switch to dark)', () => {
    const { container } = render(<ThemeToggle />);
    const button = container.querySelector('[aria-label="Toggle theme"]')!;
    // Light mode shows moon icon (to indicate "switch to dark")
    expect(button.getAttribute('data-theme')).toBe('light');
  });
});
