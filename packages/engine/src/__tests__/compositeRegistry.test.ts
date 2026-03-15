/**
 * Unit tests for composite renderer registry.
 *
 * Covers: registration, retrieval, unknown kind handling,
 * and clearing the registry.
 *
 * @module
 */

import { describe, it, expect, afterEach } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
import type { RoughCanvas } from 'roughjs/bin/canvas.js';
import {
  registerCompositeRenderer,
  getCompositeRenderer,
  clearCompositeRenderers,
} from '../renderer/compositeRegistry.js';

afterEach(() => {
  clearCompositeRenderers();
});

// ── Registration & Retrieval ─────────────────────────────────

describe('registerCompositeRenderer', () => {
  it('stores a renderer by kind', () => {
    const renderer = vi.fn();
    registerCompositeRenderer('flowchart', renderer);

    const retrieved = getCompositeRenderer('flowchart');
    expect(retrieved).toBe(renderer);
  });
});

describe('getCompositeRenderer', () => {
  it('returns the registered renderer for a known kind', () => {
    const renderer = vi.fn();
    registerCompositeRenderer('flowchart', renderer);

    expect(getCompositeRenderer('flowchart')).toBe(renderer);
  });

  it('returns null for an unregistered kind', () => {
    expect(getCompositeRenderer('unknown-composite')).toBeNull();
  });
});

describe('clearCompositeRenderers', () => {
  it('removes all registered renderers', () => {
    const renderer1 = vi.fn();
    const renderer2 = vi.fn();
    registerCompositeRenderer('flowchart', renderer1);
    registerCompositeRenderer('sequence-diagram', renderer2);

    clearCompositeRenderers();

    expect(getCompositeRenderer('flowchart')).toBeNull();
    expect(getCompositeRenderer('sequence-diagram')).toBeNull();
  });
});
