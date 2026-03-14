// @vitest-environment jsdom
/**
 * Integration tests for ErrorBoundary — crash resilience.
 *
 * Tests that ErrorBoundary catches rendering errors from child
 * components and displays fallback UI instead of crashing.
 *
 * @module
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ErrorBoundary } from '../components/ErrorBoundary.js';

// ── Helpers ──────────────────────────────────────────────────

/** Component that always throws during render. */
function ThrowingComponent({ message }: { message?: string }): never {
  throw new Error(message ?? 'Test rendering error');
}

/** Component that renders normally. */
function HealthyComponent() {
  return <div data-testid="healthy">All good</div>;
}

// ── Setup ────────────────────────────────────────────────────

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Suppress React error boundary console.error noise in test output
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleSpy.mockRestore();
});

// ── AC9: ErrorBoundary ───────────────────────────────────────

describe('ErrorBoundary [AC9]', () => {
  it('[AC9] renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <HealthyComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('healthy')).toBeTruthy();
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('[AC9] catches rendering error and shows default fallback UI', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );

    // Should show the default fallback with error message
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Test rendering error')).toBeTruthy();

    // Should NOT render the child
    expect(container.querySelector('[data-testid="healthy"]')).toBeNull();
  });

  it('[AC9] displays the specific error message from the thrown error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Canvas GPU context lost" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Canvas GPU context lost')).toBeTruthy();
  });

  it('[AC9] renders custom fallback when provided', () => {
    const customFallback = <div data-testid="custom-fallback">Custom error UI</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('custom-fallback')).toBeTruthy();
    expect(screen.getByText('Custom error UI')).toBeTruthy();
  });

  it('[AC9] logs the error via componentDidCatch', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="logged error" />
      </ErrorBoundary>,
    );

    // React itself calls console.error, and our componentDidCatch also logs
    expect(consoleSpy).toHaveBeenCalled();

    // Verify our custom log prefix was used
    const calls = consoleSpy.mock.calls;
    const boundaryLogCall = calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('[ErrorBoundary]'),
    );
    expect(boundaryLogCall).toBeTruthy();
  });

  it('[AC9] default fallback has full-viewport styling (100vw × 100vh)', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );

    // The fallback div should have viewport dimensions
    const fallbackDiv = container.firstElementChild as HTMLElement;
    expect(fallbackDiv).toBeTruthy();
    expect(fallbackDiv.style.width).toBe('100vw');
    expect(fallbackDiv.style.height).toBe('100vh');
    // jsdom normalizes hex colors to rgb()
    expect(fallbackDiv.style.backgroundColor).toMatch(/^(#fef2f2|rgb\(254,\s*242,\s*242\))$/);
  });
});

// ── Edge cases ───────────────────────────────────────────────

describe('ErrorBoundary edge cases [EDGE]', () => {
  it('[EDGE] handles error with no message (falls back to default text)', () => {
    function ThrowEmptyError(): never {
      const err = new Error();
      err.message = '';
      throw err;
    }

    const { container } = render(
      <ErrorBoundary>
        <ThrowEmptyError />
      </ErrorBoundary>,
    );

    // Should still render fallback without crashing
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('[EDGE] isolates errors — siblings outside boundary are unaffected', () => {
    const { container } = render(
      <div>
        <div data-testid="sibling">I survive</div>
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      </div>,
    );

    expect(screen.getByTestId('sibling')).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });
});
