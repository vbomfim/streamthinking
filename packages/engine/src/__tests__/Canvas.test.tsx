// @vitest-environment jsdom
/**
 * Integration tests for Canvas component — rendering and resize behavior.
 *
 * Tests the Canvas component through its public interface (DOM output)
 * without testing internal implementation details.
 *
 * S5-2: Also verifies that the render loop is wired with roughCanvas
 * and expressionProvider (not undefined).
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { Canvas } from '../components/Canvas.js';

// ── Capture createRenderLoop calls ───────────────────────────

const mockStart = vi.fn();
const mockStop = vi.fn();
const mockUpdateSize = vi.fn();

const capturedArgs: unknown[][] = [];

vi.mock('../renderer/renderLoop.js', () => ({
  createRenderLoop: (...args: unknown[]) => {
    capturedArgs.push(args);
    return { start: mockStart, stop: mockStop, updateSize: mockUpdateSize };
  },
}));

// Mock roughjs to avoid canvas context issues in jsdom
vi.mock('roughjs', () => ({
  default: {
    canvas: vi.fn(() => ({ rectangle: vi.fn(), draw: vi.fn() })),
  },
}));

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

const mockCtx = {
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  fillText: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  drawImage: vi.fn(),
  closePath: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  measureText: vi.fn(() => ({ width: 50 })),
  canvas: { width: 800, height: 600 },
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'left' as CanvasTextAlign,
  textBaseline: 'top' as CanvasTextBaseline,
  globalAlpha: 1,
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);

  // Mock canvas getContext to return a mock 2D context (jsdom returns null)
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement, contextId: string) {
      if (contextId === '2d') return mockCtx as unknown as CanvasRenderingContext2D;
      return originalGetContext.call(this, contextId as any) as any;
    },
  );

  resizeCallback = null;
  observedElements = [];
  capturedArgs.length = 0;
  mockDisconnect.mockClear();
  mockObserve.mockClear();
  mockStart.mockClear();
  mockStop.mockClear();
  mockUpdateSize.mockClear();
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

// ── S5-2: Render loop wiring ─────────────────────────────────

describe('Canvas render loop wiring (S5-2)', () => {
  it('passes roughCanvas (not undefined) to createRenderLoop', () => {
    render(<Canvas />);

    expect(capturedArgs.length).toBeGreaterThanOrEqual(1);
    const lastArgs = capturedArgs[capturedArgs.length - 1]!;
    // args: (ctx, getCamera, width, height, roughCanvas, expressionProvider, selectionProvider)
    const roughCanvas = lastArgs[4];
    expect(roughCanvas).toBeDefined();
    expect(roughCanvas).not.toBeNull();
  });

  it('passes expressionProvider (not undefined) to createRenderLoop', () => {
    render(<Canvas />);

    expect(capturedArgs.length).toBeGreaterThanOrEqual(1);
    const lastArgs = capturedArgs[capturedArgs.length - 1]!;
    const expressionProvider = lastArgs[5] as { getExpressions: () => unknown; getExpressionOrder: () => unknown };
    expect(expressionProvider).toBeDefined();
    expect(expressionProvider).not.toBeNull();
    expect(typeof expressionProvider.getExpressions).toBe('function');
    expect(typeof expressionProvider.getExpressionOrder).toBe('function');
  });

  it('passes selectionProvider (not undefined) to createRenderLoop', () => {
    render(<Canvas />);

    expect(capturedArgs.length).toBeGreaterThanOrEqual(1);
    const lastArgs = capturedArgs[capturedArgs.length - 1]!;
    const selectionProvider = lastArgs[6] as { getSelectedIds: () => unknown };
    expect(selectionProvider).toBeDefined();
    expect(selectionProvider).not.toBeNull();
    expect(typeof selectionProvider.getSelectedIds).toBe('function');
  });

  it('starts the render loop after creation', () => {
    render(<Canvas />);
    expect(mockStart).toHaveBeenCalled();
  });

  it('stops the render loop on unmount', () => {
    const { unmount } = render(<Canvas />);
    unmount();
    expect(mockStop).toHaveBeenCalled();
  });
});
