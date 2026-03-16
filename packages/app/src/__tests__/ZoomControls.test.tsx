/**
 * Unit tests for ZoomControls component.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies: renders buttons, zoom in/out by 20%, fit-to-content,
 * displays current zoom percentage.
 *
 * @vitest-environment jsdom
 * @module
 */

import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ZoomControls } from '../components/panels/ZoomControls.js';
import { useCanvasStore } from '@infinicanvas/engine';

function resetStore() {
  useCanvasStore.setState({
    camera: { x: 0, y: 0, zoom: 1 },
    expressions: {},
    expressionOrder: [],
  });
}

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  cleanup();
});

describe('ZoomControls', () => {
  it('renders zoom out button (−)', () => {
    const { container } = render(<ZoomControls />);
    const button = container.querySelector('[data-testid="zoom-out"]');
    expect(button).not.toBeNull();
  });

  it('renders zoom percentage display', () => {
    const { container } = render(<ZoomControls />);
    const display = container.querySelector('[data-testid="zoom-display"]');
    expect(display).not.toBeNull();
    expect(display!.textContent).toBe('100%');
  });

  it('renders zoom in button (+)', () => {
    const { container } = render(<ZoomControls />);
    const button = container.querySelector('[data-testid="zoom-in"]');
    expect(button).not.toBeNull();
  });

  it('renders fit-to-content button (⊡)', () => {
    const { container } = render(<ZoomControls />);
    const button = container.querySelector('[data-testid="zoom-fit"]');
    expect(button).not.toBeNull();
  });

  it('zooms in by 20% when + is clicked', () => {
    const { container } = render(<ZoomControls />);
    const button = container.querySelector('[data-testid="zoom-in"]')!;
    fireEvent.click(button);

    const { camera } = useCanvasStore.getState();
    expect(camera.zoom).toBeCloseTo(1.2, 2);
  });

  it('zooms out by 20% when − is clicked', () => {
    const { container } = render(<ZoomControls />);
    const button = container.querySelector('[data-testid="zoom-out"]')!;
    fireEvent.click(button);

    const { camera } = useCanvasStore.getState();
    expect(camera.zoom).toBeCloseTo(0.8, 2);
  });

  it('displays updated zoom percentage after zoom in', () => {
    const { container, rerender } = render(<ZoomControls />);
    const button = container.querySelector('[data-testid="zoom-in"]')!;
    fireEvent.click(button);
    rerender(<ZoomControls />);

    const display = container.querySelector('[data-testid="zoom-display"]');
    expect(display!.textContent).toBe('120%');
  });

  it('does not zoom below 10% (MIN_ZOOM)', () => {
    useCanvasStore.setState({ camera: { x: 0, y: 0, zoom: 0.1 } });
    const { container } = render(<ZoomControls />);
    const button = container.querySelector('[data-testid="zoom-out"]')!;
    fireEvent.click(button);

    const { camera } = useCanvasStore.getState();
    expect(camera.zoom).toBeGreaterThanOrEqual(0.1);
  });

  it('does not zoom above 500% (MAX_ZOOM)', () => {
    useCanvasStore.setState({ camera: { x: 0, y: 0, zoom: 5.0 } });
    const { container } = render(<ZoomControls />);
    const button = container.querySelector('[data-testid="zoom-in"]')!;
    fireEvent.click(button);

    const { camera } = useCanvasStore.getState();
    expect(camera.zoom).toBeLessThanOrEqual(5.0);
  });

  it('resets to origin at 100% for empty canvas on fit-to-content', () => {
    useCanvasStore.setState({
      camera: { x: 500, y: 300, zoom: 2 },
      expressions: {},
      expressionOrder: [],
    });

    const { container } = render(<ZoomControls />);
    const button = container.querySelector('[data-testid="zoom-fit"]')!;
    fireEvent.click(button);

    const { camera } = useCanvasStore.getState();
    expect(camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});
