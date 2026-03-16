/**
 * Unit tests for touch gesture logic — pure distance/midpoint calculations.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers: pinch distance calculation, midpoint calculation,
 * two-finger pan delta computation.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import {
  computePinchDistance,
  computeMidpoint,
  computePanDelta,
} from '../hooks/useTouchGestures.js';

// ── computePinchDistance ──────────────────────────────────────

describe('computePinchDistance', () => {
  it('returns 0 for identical points', () => {
    expect(computePinchDistance(100, 100, 100, 100)).toBe(0);
  });

  it('returns correct distance for horizontal separation', () => {
    expect(computePinchDistance(0, 0, 300, 0)).toBe(300);
  });

  it('returns correct distance for vertical separation', () => {
    expect(computePinchDistance(0, 0, 0, 400)).toBe(400);
  });

  it('returns correct distance for diagonal separation (3-4-5 triangle)', () => {
    expect(computePinchDistance(0, 0, 300, 400)).toBe(500);
  });

  it('handles negative coordinates', () => {
    expect(computePinchDistance(-100, -100, 200, 300)).toBe(500);
  });
});

// ── computeMidpoint ──────────────────────────────────────────

describe('computeMidpoint', () => {
  it('returns the midpoint for identical points', () => {
    expect(computeMidpoint(100, 100, 100, 100)).toEqual({ x: 100, y: 100 });
  });

  it('returns the midpoint for two points on x-axis', () => {
    expect(computeMidpoint(0, 0, 200, 0)).toEqual({ x: 100, y: 0 });
  });

  it('returns the midpoint for two points on y-axis', () => {
    expect(computeMidpoint(0, 0, 0, 200)).toEqual({ x: 0, y: 100 });
  });

  it('returns the midpoint for diagonal points', () => {
    expect(computeMidpoint(100, 200, 300, 400)).toEqual({ x: 200, y: 300 });
  });

  it('handles negative coordinates', () => {
    expect(computeMidpoint(-100, -200, 100, 200)).toEqual({ x: 0, y: 0 });
  });
});

// ── computePanDelta ──────────────────────────────────────────

describe('computePanDelta', () => {
  it('returns zero delta when midpoints are the same', () => {
    const current = { x: 200, y: 300 };
    const previous = { x: 200, y: 300 };
    expect(computePanDelta(current, previous)).toEqual({ dx: 0, dy: 0 });
  });

  it('returns correct delta for horizontal movement', () => {
    const current = { x: 250, y: 300 };
    const previous = { x: 200, y: 300 };
    expect(computePanDelta(current, previous)).toEqual({ dx: 50, dy: 0 });
  });

  it('returns correct delta for vertical movement', () => {
    const current = { x: 200, y: 350 };
    const previous = { x: 200, y: 300 };
    expect(computePanDelta(current, previous)).toEqual({ dx: 0, dy: 50 });
  });

  it('returns correct delta for diagonal movement', () => {
    const current = { x: 250, y: 350 };
    const previous = { x: 200, y: 300 };
    expect(computePanDelta(current, previous)).toEqual({ dx: 50, dy: 50 });
  });

  it('handles negative deltas (reverse direction)', () => {
    const current = { x: 150, y: 250 };
    const previous = { x: 200, y: 300 };
    expect(computePanDelta(current, previous)).toEqual({ dx: -50, dy: -50 });
  });
});
