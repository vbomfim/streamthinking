/**
 * Unit tests for cursor mapping logic.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies correct cursor per tool/state combination.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { getCursorForToolState } from '../interaction/cursorMapping.js';
import type { ToolType } from '../types/index.js';

// ── getCursorForToolState ────────────────────────────────────

describe('getCursorForToolState', () => {
  // Drawing tools → crosshair
  const drawingTools: ToolType[] = ['rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'freehand'];

  for (const tool of drawingTools) {
    it(`returns "crosshair" for ${tool} tool`, () => {
      expect(getCursorForToolState(tool, 'none', false)).toBe('crosshair');
    });
  }

  // Text tool → text cursor
  it('returns "text" for text tool', () => {
    expect(getCursorForToolState('text', 'none', false)).toBe('text');
  });

  // Select tool → default
  it('returns "default" for select tool with no hover', () => {
    expect(getCursorForToolState('select', 'none', false)).toBe('default');
  });

  // Select tool hovering shape → move
  it('returns "move" for select tool hovering shape body', () => {
    expect(getCursorForToolState('select', 'body', false)).toBe('move');
  });

  // Pan mode (space held) → grab
  it('returns "grab" for pan mode (space held, not dragging)', () => {
    expect(getCursorForToolState('select', 'none', true)).toBe('grab');
  });

  // Pan mode overrides all tools
  it('returns "grab" for pan mode even with drawing tool', () => {
    expect(getCursorForToolState('rectangle', 'none', true)).toBe('grab');
  });
});
