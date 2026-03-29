/**
 * Unit tests for Presentation Mode — waypoint store actions.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Each test corresponds to an acceptance criterion from the Presentation Mode spec.
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../store/canvasStore.js';
import type { CameraWaypoint } from '../types/index.js';

// ── Store reset before each test ───────────────────────────

beforeEach(() => {
  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
    operationLog: [],
    canUndo: false,
    canRedo: false,
    waypoints: [],
    presentationIndex: -1,
  });
  useCanvasStore.getState().clearHistory();
});

// ── addWaypoint ────────────────────────────────────────────

describe('addWaypoint', () => {
  it('adds a waypoint with explicit coordinates', () => {
    useCanvasStore.getState().addWaypoint({ x: 100, y: 200, zoom: 1.5 });

    const state = useCanvasStore.getState();
    expect(state.waypoints).toHaveLength(1);
    expect(state.waypoints[0]).toEqual({ x: 100, y: 200, zoom: 1.5 });
  });

  it('adds a waypoint with an optional label', () => {
    useCanvasStore
      .getState()
      .addWaypoint({ x: 50, y: 50, zoom: 2, label: 'Overview' });

    const state = useCanvasStore.getState();
    expect(state.waypoints[0]?.label).toBe('Overview');
  });

  it('snapshots current camera when called with no argument', () => {
    // Set camera to a known position
    useCanvasStore.getState().setCamera({ x: 300, y: 400, zoom: 0.75 });

    useCanvasStore.getState().addWaypoint();

    const state = useCanvasStore.getState();
    expect(state.waypoints).toHaveLength(1);
    expect(state.waypoints[0]).toEqual({ x: 300, y: 400, zoom: 0.75 });
  });

  it('appends multiple waypoints in order', () => {
    const store = useCanvasStore.getState();
    store.addWaypoint({ x: 0, y: 0, zoom: 1 });
    store.addWaypoint({ x: 100, y: 100, zoom: 2 });
    store.addWaypoint({ x: 200, y: 200, zoom: 0.5 });

    const state = useCanvasStore.getState();
    expect(state.waypoints).toHaveLength(3);
    expect(state.waypoints[0]?.x).toBe(0);
    expect(state.waypoints[1]?.x).toBe(100);
    expect(state.waypoints[2]?.x).toBe(200);
  });
});

// ── removeWaypoint ─────────────────────────────────────────

describe('removeWaypoint', () => {
  it('removes a waypoint by index', () => {
    const store = useCanvasStore.getState();
    store.addWaypoint({ x: 0, y: 0, zoom: 1 });
    store.addWaypoint({ x: 100, y: 100, zoom: 2 });
    store.addWaypoint({ x: 200, y: 200, zoom: 0.5 });

    useCanvasStore.getState().removeWaypoint(1);

    const state = useCanvasStore.getState();
    expect(state.waypoints).toHaveLength(2);
    expect(state.waypoints[0]?.x).toBe(0);
    expect(state.waypoints[1]?.x).toBe(200);
  });

  it('is a no-op for out-of-range index', () => {
    useCanvasStore.getState().addWaypoint({ x: 0, y: 0, zoom: 1 });

    useCanvasStore.getState().removeWaypoint(5);

    expect(useCanvasStore.getState().waypoints).toHaveLength(1);
  });

  it('is a no-op for negative index', () => {
    useCanvasStore.getState().addWaypoint({ x: 0, y: 0, zoom: 1 });

    useCanvasStore.getState().removeWaypoint(-1);

    expect(useCanvasStore.getState().waypoints).toHaveLength(1);
  });

  it('resets presentationIndex when removing the active waypoint', () => {
    const store = useCanvasStore.getState();
    store.addWaypoint({ x: 0, y: 0, zoom: 1 });
    store.addWaypoint({ x: 100, y: 100, zoom: 2 });
    store.goToWaypoint(1);

    expect(useCanvasStore.getState().presentationIndex).toBe(1);

    useCanvasStore.getState().removeWaypoint(1);

    // Should clamp to last valid index or reset to -1
    const state = useCanvasStore.getState();
    expect(state.presentationIndex).toBe(-1);
  });
});

// ── clearWaypoints ─────────────────────────────────────────

describe('clearWaypoints', () => {
  it('clears all waypoints and resets presentationIndex', () => {
    const store = useCanvasStore.getState();
    store.addWaypoint({ x: 0, y: 0, zoom: 1 });
    store.addWaypoint({ x: 100, y: 100, zoom: 2 });
    store.goToWaypoint(0);

    useCanvasStore.getState().clearWaypoints();

    const state = useCanvasStore.getState();
    expect(state.waypoints).toHaveLength(0);
    expect(state.presentationIndex).toBe(-1);
  });
});

// ── goToWaypoint ───────────────────────────────────────────

describe('goToWaypoint', () => {
  it('sets presentationIndex and moves camera to waypoint position', () => {
    const store = useCanvasStore.getState();
    store.addWaypoint({ x: 100, y: 200, zoom: 1.5 });
    store.addWaypoint({ x: 300, y: 400, zoom: 0.5 });

    useCanvasStore.getState().goToWaypoint(1);

    const state = useCanvasStore.getState();
    expect(state.presentationIndex).toBe(1);
    expect(state.camera.x).toBe(300);
    expect(state.camera.y).toBe(400);
    expect(state.camera.zoom).toBe(0.5);
  });

  it('is a no-op for out-of-range index', () => {
    useCanvasStore.getState().addWaypoint({ x: 100, y: 200, zoom: 1.5 });

    useCanvasStore.getState().goToWaypoint(5);

    const state = useCanvasStore.getState();
    expect(state.presentationIndex).toBe(-1);
    expect(state.camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('is a no-op for negative index', () => {
    useCanvasStore.getState().addWaypoint({ x: 100, y: 200, zoom: 1.5 });

    useCanvasStore.getState().goToWaypoint(-1);

    const state = useCanvasStore.getState();
    expect(state.presentationIndex).toBe(-1);
  });
});

// ── nextWaypoint ───────────────────────────────────────────

describe('nextWaypoint', () => {
  it('advances to the next waypoint', () => {
    const store = useCanvasStore.getState();
    store.addWaypoint({ x: 0, y: 0, zoom: 1 });
    store.addWaypoint({ x: 100, y: 100, zoom: 2 });
    store.addWaypoint({ x: 200, y: 200, zoom: 0.5 });
    store.goToWaypoint(0);

    useCanvasStore.getState().nextWaypoint();

    const state = useCanvasStore.getState();
    expect(state.presentationIndex).toBe(1);
    expect(state.camera.x).toBe(100);
  });

  it('wraps around from last to first waypoint', () => {
    const store = useCanvasStore.getState();
    store.addWaypoint({ x: 0, y: 0, zoom: 1 });
    store.addWaypoint({ x: 100, y: 100, zoom: 2 });
    store.goToWaypoint(1); // last waypoint

    useCanvasStore.getState().nextWaypoint();

    const state = useCanvasStore.getState();
    expect(state.presentationIndex).toBe(0);
    expect(state.camera.x).toBe(0);
  });

  it('starts at first waypoint when not in presentation mode', () => {
    const store = useCanvasStore.getState();
    store.addWaypoint({ x: 50, y: 50, zoom: 1 });
    store.addWaypoint({ x: 100, y: 100, zoom: 2 });
    // presentationIndex is -1 (not in presentation mode)

    useCanvasStore.getState().nextWaypoint();

    const state = useCanvasStore.getState();
    expect(state.presentationIndex).toBe(0);
    expect(state.camera.x).toBe(50);
  });

  it('is a no-op when there are no waypoints', () => {
    useCanvasStore.getState().nextWaypoint();

    const state = useCanvasStore.getState();
    expect(state.presentationIndex).toBe(-1);
  });
});

// ── prevWaypoint ───────────────────────────────────────────

describe('prevWaypoint', () => {
  it('goes to the previous waypoint', () => {
    const store = useCanvasStore.getState();
    store.addWaypoint({ x: 0, y: 0, zoom: 1 });
    store.addWaypoint({ x: 100, y: 100, zoom: 2 });
    store.addWaypoint({ x: 200, y: 200, zoom: 0.5 });
    store.goToWaypoint(2);

    useCanvasStore.getState().prevWaypoint();

    const state = useCanvasStore.getState();
    expect(state.presentationIndex).toBe(1);
    expect(state.camera.x).toBe(100);
  });

  it('wraps around from first to last waypoint', () => {
    const store = useCanvasStore.getState();
    store.addWaypoint({ x: 0, y: 0, zoom: 1 });
    store.addWaypoint({ x: 100, y: 100, zoom: 2 });
    store.goToWaypoint(0); // first waypoint

    useCanvasStore.getState().prevWaypoint();

    const state = useCanvasStore.getState();
    expect(state.presentationIndex).toBe(1);
    expect(state.camera.x).toBe(100);
  });

  it('starts at last waypoint when not in presentation mode', () => {
    const store = useCanvasStore.getState();
    store.addWaypoint({ x: 50, y: 50, zoom: 1 });
    store.addWaypoint({ x: 100, y: 100, zoom: 2 });
    // presentationIndex is -1 (not in presentation mode)

    useCanvasStore.getState().prevWaypoint();

    const state = useCanvasStore.getState();
    expect(state.presentationIndex).toBe(1);
    expect(state.camera.x).toBe(100);
  });

  it('is a no-op when there are no waypoints', () => {
    useCanvasStore.getState().prevWaypoint();

    const state = useCanvasStore.getState();
    expect(state.presentationIndex).toBe(-1);
  });
});

// ── exitPresentation ───────────────────────────────────────

describe('exitPresentation', () => {
  it('sets presentationIndex to -1 without changing camera', () => {
    const store = useCanvasStore.getState();
    store.addWaypoint({ x: 100, y: 200, zoom: 1.5 });
    store.goToWaypoint(0);

    // Camera is now at waypoint position
    expect(useCanvasStore.getState().camera.x).toBe(100);

    useCanvasStore.getState().exitPresentation();

    const state = useCanvasStore.getState();
    expect(state.presentationIndex).toBe(-1);
    // Camera stays at last position — user keeps their view
    expect(state.camera.x).toBe(100);
    expect(state.camera.y).toBe(200);
  });

  it('preserves waypoints when exiting', () => {
    const store = useCanvasStore.getState();
    store.addWaypoint({ x: 0, y: 0, zoom: 1 });
    store.addWaypoint({ x: 100, y: 100, zoom: 2 });
    store.goToWaypoint(0);

    useCanvasStore.getState().exitPresentation();

    expect(useCanvasStore.getState().waypoints).toHaveLength(2);
  });
});
