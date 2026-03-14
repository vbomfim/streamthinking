/**
 * Unit tests for useCanvasInteraction hook.
 *
 * Covers: pan with Space+drag [AC1], scroll-wheel zoom [AC2],
 * zoom clamping, cursor changes, pan speed consistency [AC7].
 *
 * Uses a wrapper component to ensure the canvas ref is properly
 * connected during React's commit phase.
 *
 * @vitest-environment jsdom
 * @module
 */

import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction.js';
import { useCanvasStore } from '../store/canvasStore.js';

// ── Helpers ──────────────────────────────────────────────────

/** Reset store to clean state before each test. */
function resetStore() {
  useCanvasStore.setState({
    camera: { x: 0, y: 0, zoom: 1 },
  });
}

/**
 * Wrapper component that renders a canvas and wires up
 * the interaction hook. Exposes cursor via data attribute.
 */
function TestCanvas() {
  const { canvasRef, cursor } = useCanvasInteraction();
  return (
    <canvas
      ref={canvasRef}
      data-testid="canvas"
      data-cursor={cursor}
      style={{ cursor }}
    />
  );
}

// ── Tests ────────────────────────────────────────────────────

describe('useCanvasInteraction', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    cleanup();
  });

  it('returns a canvasRef', () => {
    const { result } = renderHook(() => useCanvasInteraction());
    expect(result.current.canvasRef).toBeDefined();
    expect(result.current.canvasRef).toHaveProperty('current');
  });

  it('returns cursor state', () => {
    const { result } = renderHook(() => useCanvasInteraction());
    expect(result.current.cursor).toBe('default');
  });
});

describe('useCanvasInteraction — pan [AC1]', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    cleanup();
  });

  it('sets cursor to grab when Space is pressed', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });

    expect(canvas.getAttribute('data-cursor')).toBe('grab');
  });

  it('resets cursor when Space is released', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });
    expect(canvas.getAttribute('data-cursor')).toBe('grab');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    });
    expect(canvas.getAttribute('data-cursor')).toBe('default');
  });

  it('sets cursor to grabbing during Space+drag', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', {
        clientX: 100, clientY: 100, bubbles: true,
      }));
    });

    expect(canvas.getAttribute('data-cursor')).toBe('grabbing');
  });

  it('[AC7] divides pan delta by zoom for consistent speed', () => {
    // Set zoom to 2
    useCanvasStore.setState({ camera: { x: 0, y: 0, zoom: 2 } });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    // Simulate Space+drag
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', {
        clientX: 100, clientY: 100, bubbles: true,
      }));
    });

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousemove', {
        clientX: 200, clientY: 150, bubbles: true,
      }));
    });

    // Delta is (200-100, 150-100) = (100, 50)
    // Divided by zoom 2: camera should move by (-50, -25)
    const camera = useCanvasStore.getState().camera;
    expect(camera.x).toBeCloseTo(-50, 5);
    expect(camera.y).toBeCloseTo(-25, 5);
  });
});

describe('useCanvasInteraction — zoom [AC2]', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    cleanup();
  });

  it('zooms in on scroll down (negative deltaY)', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    const initialZoom = useCanvasStore.getState().camera.zoom;

    act(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY: -100, clientX: 400, clientY: 300, bubbles: true,
      }));
    });

    const newZoom = useCanvasStore.getState().camera.zoom;
    expect(newZoom).toBeGreaterThan(initialZoom);
  });

  it('zooms out on scroll up (positive deltaY)', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    const initialZoom = useCanvasStore.getState().camera.zoom;

    act(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY: 100, clientX: 400, clientY: 300, bubbles: true,
      }));
    });

    const newZoom = useCanvasStore.getState().camera.zoom;
    expect(newZoom).toBeLessThan(initialZoom);
  });

  it('clamps zoom to minimum 0.1', () => {
    useCanvasStore.setState({ camera: { x: 0, y: 0, zoom: 0.15 } });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    // Massive scroll to zoom out past minimum
    for (let i = 0; i < 50; i++) {
      act(() => {
        canvas.dispatchEvent(new WheelEvent('wheel', {
          deltaY: 1000, clientX: 400, clientY: 300, bubbles: true,
        }));
      });
    }

    const zoom = useCanvasStore.getState().camera.zoom;
    expect(zoom).toBeGreaterThanOrEqual(0.1);
  });

  it('clamps zoom to maximum 5.0', () => {
    useCanvasStore.setState({ camera: { x: 0, y: 0, zoom: 4.5 } });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    // Massive scroll to zoom in past maximum
    for (let i = 0; i < 50; i++) {
      act(() => {
        canvas.dispatchEvent(new WheelEvent('wheel', {
          deltaY: -1000, clientX: 400, clientY: 300, bubbles: true,
        }));
      });
    }

    const zoom = useCanvasStore.getState().camera.zoom;
    expect(zoom).toBeLessThanOrEqual(5.0);
  });
});
