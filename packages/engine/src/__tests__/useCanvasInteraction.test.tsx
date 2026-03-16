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

// ── #70: Middle-click drag pan ──────────────────────────────

describe('useCanvasInteraction — middle-click pan (#70)', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    cleanup();
  });

  it('sets cursor to grabbing on middle-click mousedown', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', {
        button: 1, clientX: 100, clientY: 100, bubbles: true,
      }));
    });

    expect(canvas.getAttribute('data-cursor')).toBe('grabbing');
  });

  it('pans camera on middle-click drag', () => {
    useCanvasStore.setState({ camera: { x: 0, y: 0, zoom: 1 } });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', {
        button: 1, clientX: 100, clientY: 100, bubbles: true,
      }));
    });

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousemove', {
        clientX: 200, clientY: 150, bubbles: true,
      }));
    });

    // Delta is (200-100, 150-100) = (100, 50)
    // Divided by zoom 1: camera moves by (-100, -50)
    const camera = useCanvasStore.getState().camera;
    expect(camera.x).toBeCloseTo(-100, 5);
    expect(camera.y).toBeCloseTo(-50, 5);
  });

  it('divides middle-click pan delta by zoom for consistent speed', () => {
    useCanvasStore.setState({ camera: { x: 0, y: 0, zoom: 2 } });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', {
        button: 1, clientX: 100, clientY: 100, bubbles: true,
      }));
    });

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousemove', {
        clientX: 200, clientY: 150, bubbles: true,
      }));
    });

    // Delta (100, 50) / zoom 2 = (-50, -25)
    const camera = useCanvasStore.getState().camera;
    expect(camera.x).toBeCloseTo(-50, 5);
    expect(camera.y).toBeCloseTo(-25, 5);
  });

  it('resets cursor to default on mouseup after middle-click pan', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', {
        button: 1, clientX: 100, clientY: 100, bubbles: true,
      }));
    });

    expect(canvas.getAttribute('data-cursor')).toBe('grabbing');

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mouseup', {
        clientX: 200, clientY: 150, bubbles: true,
      }));
    });

    expect(canvas.getAttribute('data-cursor')).toBe('default');
  });

  it('does not start middle-click pan on right-click (button 2)', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', {
        button: 2, clientX: 100, clientY: 100, bubbles: true,
      }));
    });

    // Cursor should remain default — no pan started
    expect(canvas.getAttribute('data-cursor')).toBe('default');
  });
});

// ── #70: Shift+scroll horizontal pan ────────────────────────

describe('useCanvasInteraction — shift+scroll pan (#70)', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    cleanup();
  });

  it('pans horizontally on shift+wheel', () => {
    useCanvasStore.setState({ camera: { x: 0, y: 0, zoom: 1 } });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY: 100, shiftKey: true, clientX: 400, clientY: 300, bubbles: true,
      }));
    });

    const camera = useCanvasStore.getState().camera;
    // deltaY=100 / zoom=1 → camera.x shifts by 100
    // Pan direction: subtracting deltaY moves content left (positive camera.x means viewing further right)
    expect(camera.x).not.toBe(0);
    expect(camera.y).toBe(0); // Y should NOT change
  });

  it('does not change zoom on shift+wheel', () => {
    useCanvasStore.setState({ camera: { x: 0, y: 0, zoom: 1 } });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY: 100, shiftKey: true, clientX: 400, clientY: 300, bubbles: true,
      }));
    });

    const camera = useCanvasStore.getState().camera;
    expect(camera.zoom).toBe(1); // Zoom should remain unchanged
  });

  it('divides shift+scroll pan by zoom for consistent speed', () => {
    useCanvasStore.setState({ camera: { x: 0, y: 0, zoom: 2 } });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY: 100, shiftKey: true, clientX: 400, clientY: 300, bubbles: true,
      }));
    });

    const camera = useCanvasStore.getState().camera;
    // deltaY=100 / zoom=2 = 50 world units
    expect(Math.abs(camera.x)).toBeCloseTo(50, 5);
  });

  it('still zooms on wheel without shift (regression)', () => {
    useCanvasStore.setState({ camera: { x: 0, y: 0, zoom: 1 } });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY: -100, clientX: 400, clientY: 300, bubbles: true,
      }));
    });

    const camera = useCanvasStore.getState().camera;
    expect(camera.zoom).toBeGreaterThan(1); // Should have zoomed in
  });
});
