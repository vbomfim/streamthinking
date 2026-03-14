/**
 * Unit tests for viewport culling logic.
 *
 * Covers: intersection detection, partial visibility, completely off-screen,
 * edge cases (zero-size, large expressions), and zoom factor handling.
 *
 * @module
 */

import { isVisible, getWorldViewport } from '../renderer/viewportCulling.js';
import type { Camera } from '../types/index.js';

// ── Tests ────────────────────────────────────────────────────

describe('getWorldViewport', () => {
  it('returns world bounds at identity camera', () => {
    const camera: Camera = { x: 0, y: 0, zoom: 1 };
    const viewport = getWorldViewport(camera, 800, 600);
    expect(viewport).toEqual({ left: 0, top: 0, right: 800, bottom: 600 });
  });

  it('accounts for camera pan offset', () => {
    const camera: Camera = { x: 100, y: 200, zoom: 1 };
    const viewport = getWorldViewport(camera, 800, 600);
    expect(viewport).toEqual({ left: 100, top: 200, right: 900, bottom: 800 });
  });

  it('accounts for zoom level', () => {
    const camera: Camera = { x: 0, y: 0, zoom: 2 };
    const viewport = getWorldViewport(camera, 800, 600);
    expect(viewport).toEqual({ left: 0, top: 0, right: 400, bottom: 300 });
  });

  it('accounts for pan and zoom together', () => {
    const camera: Camera = { x: 50, y: 50, zoom: 0.5 };
    const viewport = getWorldViewport(camera, 800, 600);
    expect(viewport).toEqual({ left: 50, top: 50, right: 1650, bottom: 1250 });
  });
});

describe('isVisible', () => {
  const identityCamera: Camera = { x: 0, y: 0, zoom: 1 };
  const viewportWidth = 800;
  const viewportHeight = 600;

  it('returns true for expression fully inside viewport', () => {
    const bbox = { x: 100, y: 100, width: 200, height: 150 };
    expect(isVisible(bbox, identityCamera, viewportWidth, viewportHeight)).toBe(true);
  });

  it('returns true for expression partially overlapping left edge', () => {
    const bbox = { x: -50, y: 100, width: 200, height: 150 };
    expect(isVisible(bbox, identityCamera, viewportWidth, viewportHeight)).toBe(true);
  });

  it('returns true for expression partially overlapping right edge', () => {
    const bbox = { x: 700, y: 100, width: 200, height: 150 };
    expect(isVisible(bbox, identityCamera, viewportWidth, viewportHeight)).toBe(true);
  });

  it('returns true for expression partially overlapping top edge', () => {
    const bbox = { x: 100, y: -50, width: 200, height: 150 };
    expect(isVisible(bbox, identityCamera, viewportWidth, viewportHeight)).toBe(true);
  });

  it('returns true for expression partially overlapping bottom edge', () => {
    const bbox = { x: 100, y: 500, width: 200, height: 150 };
    expect(isVisible(bbox, identityCamera, viewportWidth, viewportHeight)).toBe(true);
  });

  it('returns false for expression completely to the left', () => {
    const bbox = { x: -300, y: 100, width: 200, height: 150 };
    expect(isVisible(bbox, identityCamera, viewportWidth, viewportHeight)).toBe(false);
  });

  it('returns false for expression completely to the right', () => {
    const bbox = { x: 900, y: 100, width: 200, height: 150 };
    expect(isVisible(bbox, identityCamera, viewportWidth, viewportHeight)).toBe(false);
  });

  it('returns false for expression completely above', () => {
    const bbox = { x: 100, y: -300, width: 200, height: 150 };
    expect(isVisible(bbox, identityCamera, viewportWidth, viewportHeight)).toBe(false);
  });

  it('returns false for expression completely below', () => {
    const bbox = { x: 100, y: 700, width: 200, height: 150 };
    expect(isVisible(bbox, identityCamera, viewportWidth, viewportHeight)).toBe(false);
  });

  it('returns true for expression touching the viewport edge exactly', () => {
    // Expression right edge touches viewport left edge
    const bbox = { x: -200, y: 100, width: 200, height: 150 };
    // x + width = 0, viewport left = 0 → touching, should NOT be visible (no overlap)
    expect(isVisible(bbox, identityCamera, viewportWidth, viewportHeight)).toBe(false);
  });

  it('returns true for expression covering entire viewport', () => {
    const bbox = { x: -100, y: -100, width: 1000, height: 800 };
    expect(isVisible(bbox, identityCamera, viewportWidth, viewportHeight)).toBe(true);
  });

  it('handles camera panned to negative coordinates', () => {
    const camera: Camera = { x: -500, y: -500, zoom: 1 };
    // Expression at world origin — camera is panned left/up, so origin should be visible
    const bbox = { x: -400, y: -400, width: 100, height: 100 };
    expect(isVisible(bbox, camera, viewportWidth, viewportHeight)).toBe(true);
  });

  it('handles zoom factor in visibility check', () => {
    // With zoom 2, visible world is [0, 0] → [400, 300]
    const camera: Camera = { x: 0, y: 0, zoom: 2 };
    const insideBbox = { x: 100, y: 100, width: 50, height: 50 };
    expect(isVisible(insideBbox, camera, viewportWidth, viewportHeight)).toBe(true);

    // This is outside the zoomed-in viewport
    const outsideBbox = { x: 500, y: 400, width: 50, height: 50 };
    expect(isVisible(outsideBbox, camera, viewportWidth, viewportHeight)).toBe(false);
  });

  it('returns true for zero-size expression at visible position', () => {
    // A point at (100, 100) has no area — treated as not visible
    const bbox = { x: 100, y: 100, width: 0, height: 0 };
    expect(isVisible(bbox, identityCamera, viewportWidth, viewportHeight)).toBe(false);
  });
});
