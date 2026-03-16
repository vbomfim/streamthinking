/**
 * Unit tests for metadata tooltip logic — pure functions.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers: relative time formatting, tooltip data construction.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeTime, buildTooltipData } from '../hooks/useMetadataTooltip.js';
import type { VisualExpression } from '@infinicanvas/protocol';

// ── formatRelativeTime ───────────────────────────────────────

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for timestamps less than 60 seconds ago', () => {
    const timestamp = Date.now() - 30_000; // 30s ago
    expect(formatRelativeTime(timestamp)).toBe('just now');
  });

  it('returns "1 minute ago" for 60-119 seconds ago', () => {
    const timestamp = Date.now() - 90_000; // 90s ago
    expect(formatRelativeTime(timestamp)).toBe('1 minute ago');
  });

  it('returns "N minutes ago" for 2-59 minutes ago', () => {
    const timestamp = Date.now() - 5 * 60_000; // 5 min ago
    expect(formatRelativeTime(timestamp)).toBe('5 minutes ago');
  });

  it('returns "1 hour ago" for 60-119 minutes ago', () => {
    const timestamp = Date.now() - 90 * 60_000; // 90 min ago
    expect(formatRelativeTime(timestamp)).toBe('1 hour ago');
  });

  it('returns "N hours ago" for 2-23 hours ago', () => {
    const timestamp = Date.now() - 5 * 3600_000; // 5 hours ago
    expect(formatRelativeTime(timestamp)).toBe('5 hours ago');
  });

  it('returns "1 day ago" for 24-47 hours ago', () => {
    const timestamp = Date.now() - 36 * 3600_000; // 36 hours ago
    expect(formatRelativeTime(timestamp)).toBe('1 day ago');
  });

  it('returns "N days ago" for 2+ days ago', () => {
    const timestamp = Date.now() - 5 * 86400_000; // 5 days ago
    expect(formatRelativeTime(timestamp)).toBe('5 days ago');
  });
});

// ── buildTooltipData ─────────────────────────────────────────

describe('buildTooltipData', () => {
  const baseExpression: VisualExpression = {
    id: 'test-1',
    kind: 'rectangle',
    position: { x: 100, y: 200 },
    size: { width: 300, height: 150 },
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
      createdAt: Date.now() - 3600_000,
      updatedAt: Date.now(),
      author: { type: 'human', id: 'user-1', name: 'Alice' },
      version: 1,
      locked: false,
    },
  } as VisualExpression;

  it('returns author name from meta', () => {
    const data = buildTooltipData(baseExpression);
    expect(data.authorName).toBe('Alice');
  });

  it('returns expression kind', () => {
    const data = buildTooltipData(baseExpression);
    expect(data.kind).toBe('rectangle');
  });

  it('returns createdAt timestamp', () => {
    const data = buildTooltipData(baseExpression);
    expect(data.createdAt).toBe(baseExpression.meta.createdAt);
  });

  it('returns "Unknown" for expression without author name', () => {
    const expr = {
      ...baseExpression,
      meta: {
        ...baseExpression.meta,
        author: { type: 'agent' as const, id: 'bot-1' },
      },
    } as VisualExpression;
    const data = buildTooltipData(expr);
    expect(data.authorName).toBe('Unknown');
  });
});
