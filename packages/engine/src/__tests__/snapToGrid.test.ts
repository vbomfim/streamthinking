/**
 * Unit tests for snapToGrid utility — pure math functions.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers rounding to nearest grid intersection for both single
 * values and coordinate pairs.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { snapToGrid, snapPosition, computeSnappedDelta } from '../utils/snapToGrid.js';

// ── snapToGrid (single value) ──────────────────────────────────

describe('snapToGrid', () => {
  it('snaps 15 to 20 with gridSize 20', () => {
    expect(snapToGrid(15, 20)).toBe(20);
  });

  it('snaps 25 to 20 with gridSize 20 (rounds to nearest)', () => {
    expect(snapToGrid(25, 20)).toBe(20);
  });

  it('snaps 35 to 40 with gridSize 20', () => {
    expect(snapToGrid(35, 20)).toBe(40);
  });

  it('snaps negative values: -15 → -20', () => {
    expect(snapToGrid(-15, 20)).toBe(-20);
  });

  it('snaps exact grid values unchanged', () => {
    expect(snapToGrid(40, 20)).toBe(40);
    expect(snapToGrid(0, 20)).toBe(0);
    expect(snapToGrid(100, 20)).toBe(100);
  });

  it('snaps midpoint values (rounds half up): 10 → 20 with gridSize 20', () => {
    // Math.round(10/20)*20 = Math.round(0.5)*20 = 1*20 = 20
    expect(snapToGrid(10, 20)).toBe(20);
  });

  it('works with different grid sizes', () => {
    expect(snapToGrid(7, 10)).toBe(10);
    expect(snapToGrid(3, 10)).toBe(0);
    expect(snapToGrid(12, 5)).toBe(10);
    expect(snapToGrid(13, 5)).toBe(15);
  });

  it('handles zero value', () => {
    expect(snapToGrid(0, 20)).toBe(0);
  });

  it('handles large values', () => {
    expect(snapToGrid(1009, 20)).toBe(1000);
    expect(snapToGrid(1011, 20)).toBe(1020);
  });

  it('returns value unchanged when gridSize is zero', () => {
    expect(snapToGrid(15, 0)).toBe(15);
  });

  it('returns value unchanged when gridSize is negative', () => {
    expect(snapToGrid(15, -20)).toBe(15);
  });

  it('works with gridSize of 1', () => {
    expect(snapToGrid(15, 1)).toBe(15);
  });

  it('works with fractional gridSize', () => {
    expect(snapToGrid(7, 2.5)).toBe(7.5);
  });
});

// ── snapPosition (x, y pair) ───────────────────────────────────

describe('snapPosition', () => {
  it('snaps both x and y to grid', () => {
    expect(snapPosition(15, 35, 20)).toEqual({ x: 20, y: 40 });
  });

  it('snaps exact positions unchanged', () => {
    expect(snapPosition(40, 60, 20)).toEqual({ x: 40, y: 60 });
  });

  it('snaps negative coordinates', () => {
    expect(snapPosition(-15, -35, 20)).toEqual({ x: -20, y: -40 });
  });

  it('snaps mixed positive/negative coordinates', () => {
    expect(snapPosition(15, -35, 20)).toEqual({ x: 20, y: -40 });
  });

  it('snaps with different grid sizes', () => {
    expect(snapPosition(7, 13, 10)).toEqual({ x: 10, y: 10 });
    expect(snapPosition(12, 3, 5)).toEqual({ x: 10, y: 5 });
  });
});

// ── computeSnappedDelta ────────────────────────────────────────

describe('computeSnappedDelta', () => {
  it('snaps delta based on lead expression position', () => {
    const positions = new Map([['a', { x: 100, y: 200 }]]);
    // raw target: (100+13, 200+7) = (113, 207) → snapped (120, 200)
    const result = computeSnappedDelta(13, 7, positions, 20);
    expect(result).toEqual({ dx: 20, dy: 0 });
  });

  it('preserves relative offsets for multi-select', () => {
    const positions = new Map([
      ['a', { x: 100, y: 200 }],
      ['b', { x: 130, y: 250 }],
    ]);
    // Lead expr 'a' raw target: (113, 207) → snapped (120, 200)
    const result = computeSnappedDelta(13, 7, positions, 20);
    expect(result).toEqual({ dx: 20, dy: 0 });
    // 'b' would get (130+20, 250+0) = (150, 250) — relative offset preserved
  });

  it('returns raw delta when positions map is empty', () => {
    const positions = new Map<string, { x: number; y: number }>();
    const result = computeSnappedDelta(13, 7, positions, 20);
    expect(result).toEqual({ dx: 13, dy: 7 });
  });

  it('handles zero delta', () => {
    const positions = new Map([['a', { x: 100, y: 200 }]]);
    const result = computeSnappedDelta(0, 0, positions, 20);
    expect(result).toEqual({ dx: 0, dy: 0 });
  });
});
