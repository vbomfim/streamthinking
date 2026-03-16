/**
 * Unit tests for WelcomeScreen component.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies: renders on first visit, dismisses on button click,
 * saves dismissed state, not shown after dismissal.
 *
 * @vitest-environment jsdom
 * @module
 */

import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WelcomeScreen, WELCOME_STORAGE_KEY } from '../components/WelcomeScreen.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('WelcomeScreen', () => {
  it('renders overlay on first visit (no localStorage)', () => {
    const { container } = render(<WelcomeScreen />);
    const overlay = container.querySelector('[data-testid="welcome-screen"]');
    expect(overlay).not.toBeNull();
  });

  it('displays project name "StreamThinking"', () => {
    const { container } = render(<WelcomeScreen />);
    expect(container.textContent).toContain('StreamThinking');
  });

  it('displays tagline', () => {
    const { container } = render(<WelcomeScreen />);
    expect(container.textContent).toContain(
      'A visual communication protocol for humans & AI',
    );
  });

  it('displays 3 example actions', () => {
    const { container } = render(<WelcomeScreen />);
    const actions = container.querySelectorAll('[data-testid="welcome-action"]');
    expect(actions.length).toBe(3);
  });

  it('displays example action: "Draw a shape"', () => {
    const { container } = render(<WelcomeScreen />);
    expect(container.textContent).toContain('Draw a shape');
  });

  it('displays example action: "Ask AI to diagram something"', () => {
    const { container } = render(<WelcomeScreen />);
    expect(container.textContent).toContain('Ask AI to diagram something');
  });

  it('displays example action: "Import a canvas"', () => {
    const { container } = render(<WelcomeScreen />);
    expect(container.textContent).toContain('Import a canvas');
  });

  it('displays "Get Started" button', () => {
    const { container } = render(<WelcomeScreen />);
    const button = container.querySelector('[data-testid="welcome-dismiss"]');
    expect(button).not.toBeNull();
    expect(button!.textContent).toBe('Get Started');
  });

  it('dismisses overlay on "Get Started" click', () => {
    const { container } = render(<WelcomeScreen />);
    const button = container.querySelector('[data-testid="welcome-dismiss"]')!;
    fireEvent.click(button);

    const overlay = container.querySelector('[data-testid="welcome-screen"]');
    expect(overlay).toBeNull();
  });

  it('saves dismissed state to localStorage on click', () => {
    const { container } = render(<WelcomeScreen />);
    const button = container.querySelector('[data-testid="welcome-dismiss"]')!;
    fireEvent.click(button);

    expect(localStorage.getItem(WELCOME_STORAGE_KEY)).toBe('true');
  });

  it('does not render when localStorage has welcomed flag', () => {
    localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
    const { container } = render(<WelcomeScreen />);
    const overlay = container.querySelector('[data-testid="welcome-screen"]');
    expect(overlay).toBeNull();
  });
});
