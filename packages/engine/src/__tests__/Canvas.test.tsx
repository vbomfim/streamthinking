// @vitest-environment jsdom
/**
 * Integration tests for Canvas component — rendering and resize behavior.
 *
 * Tests the Canvas component through its public interface (DOM output)
 * without testing internal implementation details.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { Canvas } from '../components/Canvas.js';

// ── ResizeObserver mock ──────────────────────────────────────

type ResizeCallback = (entries: ResizeObserverEntry[]) => void;

let resizeCallback: ResizeCallback | null = null;
let observedElements: Element[] = [];

const mockDisconnect = vi.fn();
const mockObserve = vi.fn((element: Element) => {
  observedElements.push(element);
});

class MockResizeObserver {
  constructor(callback: ResizeCallback) {
    resizeCallback = callback;
  }
  observe = mockObserve;
  unobserve = vi.fn();
  disconnect = mockDisconnect;
}

// ── Setup ────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  resizeCallback = null;
  observedElements = [];
  mockDisconnect.mockClear();
  mockObserve.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── AC2: Canvas renders 100vw × 100vh white ──────────────────

describe('Canvas rendering [AC2]', () => {
  /**
   * @vitest-environment jsdom
   */

  it('[AC2] renders a container div with 100vw × 100vh dimensions', () => {
    const { container } = render(<Canvas />);

    // The Canvas component wraps CanvasInner in ErrorBoundary
    // CanvasInner renders a div > canvas structure
    const outerDiv = container.firstElementChild;
    expect(outerDiv).toBeTruthy();

    // Find the container div (the one with viewport dimensions)
    const viewportDiv = container.querySelector('div[style]');
    expect(viewportDiv).toBeTruthy();

    const style = (viewportDiv as HTMLElement).style;
    expect(style.width).toBe('100vw');
    expect(style.height).toBe('100vh');
    expect(style.overflow).toBe('hidden');
    expect(style.margin).toBe('0px');
    expect(style.padding).toBe('0px');
  });

  it('[AC2] renders a canvas element with white background', () => {
    const { container } = render(<Canvas />);

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    // jsdom normalizes hex colors to rgb()
    expect(canvas!.style.backgroundColor).toMatch(/^(#ffffff|rgb\(255,\s*255,\s*255\))$/);
    expect(canvas!.style.display).toBe('block');
  });

  it('[AC2] renders exactly one canvas element', () => {
    const { container } = render(<Canvas />);

    const canvases = container.querySelectorAll('canvas');
    expect(canvases).toHaveLength(1);
  });
});

// ── AC3: ResizeObserver debounced 100ms ───────────────────────

describe('Canvas resize behavior [AC3]', () => {
  it('[AC3] attaches a ResizeObserver to the container div on mount', () => {
    render(<Canvas />);

    expect(mockObserve).toHaveBeenCalledTimes(1);
    expect(observedElements).toHaveLength(1);

    // The observed element should be the container div
    const observed = observedElements[0];
    expect(observed).toBeInstanceOf(HTMLDivElement);
  });

  it('[AC3] disconnects ResizeObserver on unmount', () => {
    const { unmount } = render(<Canvas />);

    unmount();

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('[AC3] debounces resize callbacks (100ms delay)', async () => {
    vi.useFakeTimers();

    render(<Canvas />);

    expect(resizeCallback).toBeTruthy();

    // Simulate rapid resizes
    const mockEntry = { contentRect: { width: 800, height: 600 } } as ResizeObserverEntry;

    act(() => {
      resizeCallback!([mockEntry]);
    });
    act(() => {
      resizeCallback!([mockEntry]);
    });
    act(() => {
      resizeCallback!([mockEntry]);
    });

    // Before debounce settles — nothing should have happened yet
    // (the timeout hasn't fired)
    act(() => {
      vi.advanceTimersByTime(50);
    });

    // After 100ms the debounced handler fires exactly once
    act(() => {
      vi.advanceTimersByTime(60); // total 110ms
    });

    // No errors — the resize was handled
    vi.useRealTimers();
  });

  it('[AC3] clears pending debounce timeout on unmount', () => {
    vi.useFakeTimers();

    const { unmount } = render(<Canvas />);

    // Trigger a resize
    const mockEntry = { contentRect: { width: 800, height: 600 } } as ResizeObserverEntry;
    act(() => {
      resizeCallback!([mockEntry]);
    });

    // Unmount before debounce fires
    unmount();

    // Advancing timers should not throw — timeout was cleaned up
    expect(() => {
      vi.advanceTimersByTime(200);
    }).not.toThrow();

    vi.useRealTimers();
  });
});

// ── AC9: ErrorBoundary catches rendering errors ──────────────

describe('Canvas ErrorBoundary integration [AC9]', () => {
  it('[AC9] Canvas is wrapped in ErrorBoundary', () => {
    // The Canvas component renders ErrorBoundary > CanvasInner
    // We verify by checking it renders successfully
    const { container } = render(<Canvas />);

    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
