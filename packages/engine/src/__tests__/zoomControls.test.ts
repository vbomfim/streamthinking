/**
 * Unit tests for zoom control logic — pure functions.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers: zoom in/out by 20%, fit-to-content bounding box,
 * empty canvas reset, and zoom clamping.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import {
  computeFitToContent,
  clampZoom,
  ZOOM_STEP,
  MIN_ZOOM,
  MAX_ZOOM,
} from '../camera.js';
import type { Camera } from '../types/index.js';
import type { VisualExpression } from '@infinicanvas/protocol';

// ── Helper: create a minimal expression for testing ──────────

function makeExpression(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): VisualExpression {
  return {
    id,
    kind: 'rectangle',
    position: { x, y },
    size: { width, height },
    angle: 0,
    data: {},
    style: {
      strokeColor: '#000000',
      strokeWidth: 2,
      backgroundColor: 'transparent',
      opacity: 1,
      roughness: 1,
      fillStyle: 'solid',
    },
    meta: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      author: { type: 'human', id: 'test', name: 'Test' },
      version: 1,
      locked: false,
    },
  } as VisualExpression;
}

// ── Zoom step constants ──────────────────────────────────────

describe('Zoom constants', () => {
  it('ZOOM_STEP is 0.2 (20%)', () => {
    expect(ZOOM_STEP).toBe(0.2);
  });

  it('MIN_ZOOM is 0.1', () => {
    expect(MIN_ZOOM).toBe(0.1);
  });

  it('MAX_ZOOM is 5.0', () => {
    expect(MAX_ZOOM).toBe(5.0);
  });
});

// ── clampZoom ────────────────────────────────────────────────

describe('clampZoom', () => {
  it('returns zoom unchanged when within bounds', () => {
    expect(clampZoom(1.0)).toBe(1.0);
    expect(clampZoom(2.5)).toBe(2.5);
  });

  it('clamps below MIN_ZOOM to MIN_ZOOM', () => {
    expect(clampZoom(0.05)).toBe(MIN_ZOOM);
  });

  it('clamps above MAX_ZOOM to MAX_ZOOM', () => {
    expect(clampZoom(10)).toBe(MAX_ZOOM);
  });

  it('allows exact boundary values', () => {
    expect(clampZoom(MIN_ZOOM)).toBe(MIN_ZOOM);
    expect(clampZoom(MAX_ZOOM)).toBe(MAX_ZOOM);
  });
});

// ── computeFitToContent ──────────────────────────────────────

describe('computeFitToContent', () => {
  it('returns origin camera at 100% zoom for empty canvas', () => {
    const camera = computeFitToContent({}, [], 1000, 800);
    expect(camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('centers a single expression in the viewport', () => {
    const expressions: Record<string, VisualExpression> = {};
    const expr = makeExpression('a', 100, 100, 200, 100);
    expressions['a'] = expr;

    const camera = computeFitToContent(expressions, ['a'], 1000, 800);

    // The expression center is at (200, 150)
    // With 10% padding, the effective viewport for fitting is 900×720
    // The expression is 200×100, so zoom = min(900/200, 720/100) = min(4.5, 7.2) = 4.5
    // But clamped to MAX_ZOOM = 5.0, so zoom = 4.5
    // camera.x = center.x - viewportWidth / 2 / zoom
    // camera.y = center.y - viewportHeight / 2 / zoom
    expect(camera.zoom).toBeGreaterThan(0);
    expect(camera.zoom).toBeLessThanOrEqual(MAX_ZOOM);

    // Verify the center of the bounding box maps to the center of the viewport
    // screen = (world - camera) * zoom
    // viewport_center_x = 500, viewport_center_y = 400
    const screenCenterX = (200 - camera.x) * camera.zoom;
    const screenCenterY = (150 - camera.y) * camera.zoom;
    expect(screenCenterX).toBeCloseTo(500, 0);
    expect(screenCenterY).toBeCloseTo(400, 0);
  });

  it('fits multiple expressions with correct bounding box', () => {
    const expressions: Record<string, VisualExpression> = {};
    expressions['a'] = makeExpression('a', 0, 0, 100, 100);
    expressions['b'] = makeExpression('b', 400, 300, 100, 100);

    const camera = computeFitToContent(
      expressions,
      ['a', 'b'],
      1000,
      800,
    );

    // Bounding box: (0,0) to (500,400), center (250, 200)
    // With 10% padding, effective viewport = 900×720
    // zoom = min(900/500, 720/400) = min(1.8, 1.8) = 1.8
    expect(camera.zoom).toBeCloseTo(1.8, 1);

    // Center should map to viewport center
    const screenCenterX = (250 - camera.x) * camera.zoom;
    const screenCenterY = (200 - camera.y) * camera.zoom;
    expect(screenCenterX).toBeCloseTo(500, 0);
    expect(screenCenterY).toBeCloseTo(400, 0);
  });

  it('clamps zoom to MAX_ZOOM for tiny expressions', () => {
    const expressions: Record<string, VisualExpression> = {};
    expressions['a'] = makeExpression('a', 0, 0, 5, 5);

    const camera = computeFitToContent(expressions, ['a'], 1000, 800);

    expect(camera.zoom).toBe(MAX_ZOOM);
  });

  it('handles expressions with negative positions', () => {
    const expressions: Record<string, VisualExpression> = {};
    expressions['a'] = makeExpression('a', -200, -100, 100, 100);
    expressions['b'] = makeExpression('b', 100, 50, 100, 100);

    const camera = computeFitToContent(expressions, ['a', 'b'], 1000, 800);

    // Bounding box: (-200, -100) to (200, 150), center (0, 25), size 400×250
    expect(camera.zoom).toBeGreaterThan(0);

    // Center at (0, 25) should map to viewport center
    const screenCenterX = (0 - camera.x) * camera.zoom;
    const screenCenterY = (25 - camera.y) * camera.zoom;
    expect(screenCenterX).toBeCloseTo(500, 0);
    expect(screenCenterY).toBeCloseTo(400, 0);
  });

  it('skips missing expression IDs in order array', () => {
    const expressions: Record<string, VisualExpression> = {};
    expressions['a'] = makeExpression('a', 100, 100, 200, 200);

    // 'b' is in order but not in expressions
    const camera = computeFitToContent(expressions, ['a', 'b'], 1000, 800);
    expect(camera.zoom).toBeGreaterThan(0);
  });

  it('uses 10% padding on each side', () => {
    const expressions: Record<string, VisualExpression> = {};
    // Expression exactly fills 1000×800 viewport at zoom 1
    expressions['a'] = makeExpression('a', 0, 0, 1000, 800);

    const camera = computeFitToContent(expressions, ['a'], 1000, 800);

    // With 10% padding (5% each side), effective viewport = 900×720
    // zoom = min(900/1000, 720/800) = min(0.9, 0.9) = 0.9
    expect(camera.zoom).toBeCloseTo(0.9, 1);
  });
});
