/**
 * Unit tests for style mapping — ExpressionStyle → Rough.js Options.
 *
 * Covers: stroke, fill, fillStyle, strokeWidth, roughness mapping,
 * transparent/none handling, and style hash computation.
 *
 * @module
 */

import { mapStyleToRoughOptions, computeStyleHash } from '../renderer/styleMapper.js';
import type { ExpressionStyle } from '@infinicanvas/protocol';

// ── Helpers ──────────────────────────────────────────────────

function makeStyle(overrides: Partial<ExpressionStyle> = {}): ExpressionStyle {
  return {
    strokeColor: '#000000',
    backgroundColor: '#ffffff',
    fillStyle: 'solid',
    strokeWidth: 2,
    roughness: 1,
    opacity: 1,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────

describe('mapStyleToRoughOptions', () => {
  it('maps strokeColor to stroke', () => {
    const style = makeStyle({ strokeColor: '#ff0000' });
    const options = mapStyleToRoughOptions(style);
    expect(options.stroke).toBe('#ff0000');
  });

  it('maps backgroundColor to fill', () => {
    const style = makeStyle({ backgroundColor: '#00ff00' });
    const options = mapStyleToRoughOptions(style);
    expect(options.fill).toBe('#00ff00');
  });

  it('maps fillStyle to fillStyle', () => {
    const style = makeStyle({ fillStyle: 'hachure' });
    const options = mapStyleToRoughOptions(style);
    expect(options.fillStyle).toBe('hachure');
  });

  it('maps cross-hatch fillStyle', () => {
    const style = makeStyle({ fillStyle: 'cross-hatch' });
    const options = mapStyleToRoughOptions(style);
    expect(options.fillStyle).toBe('cross-hatch');
  });

  it('maps strokeWidth to strokeWidth', () => {
    const style = makeStyle({ strokeWidth: 4 });
    const options = mapStyleToRoughOptions(style);
    expect(options.strokeWidth).toBe(4);
  });

  it('maps roughness to roughness', () => {
    const style = makeStyle({ roughness: 2.5 });
    const options = mapStyleToRoughOptions(style);
    expect(options.roughness).toBe(2.5);
  });

  it('sets fill to undefined when backgroundColor is transparent', () => {
    const style = makeStyle({ backgroundColor: 'transparent' });
    const options = mapStyleToRoughOptions(style);
    expect(options.fill).toBeUndefined();
  });

  it('sets fillStyle to undefined when fillStyle is none', () => {
    const style = makeStyle({ fillStyle: 'none' });
    const options = mapStyleToRoughOptions(style);
    expect(options.fillStyle).toBeUndefined();
  });

  it('does not include opacity in rough options (handled via ctx.globalAlpha)', () => {
    const style = makeStyle({ opacity: 0.5 });
    const options = mapStyleToRoughOptions(style);
    expect(options).not.toHaveProperty('opacity');
  });

  it('handles solid fillStyle', () => {
    const style = makeStyle({ fillStyle: 'solid' });
    const options = mapStyleToRoughOptions(style);
    expect(options.fillStyle).toBe('solid');
  });

  it('handles zero roughness (smooth lines)', () => {
    const style = makeStyle({ roughness: 0 });
    const options = mapStyleToRoughOptions(style);
    expect(options.roughness).toBe(0);
  });

  it('sets bowing to 0 when roughness is 0 for clean geometry', () => {
    const style = makeStyle({ roughness: 0 });
    const options = mapStyleToRoughOptions(style);
    expect(options.bowing).toBe(0);
  });

  it('does not force bowing to 0 when roughness is positive', () => {
    const style = makeStyle({ roughness: 2 });
    const options = mapStyleToRoughOptions(style);
    expect(options.bowing).toBeUndefined();
  });

  it('handles minimum strokeWidth', () => {
    const style = makeStyle({ strokeWidth: 1 });
    const options = mapStyleToRoughOptions(style);
    expect(options.strokeWidth).toBe(1);
  });
});

describe('computeStyleHash', () => {
  it('returns same hash for identical styles', () => {
    const style1 = makeStyle();
    const style2 = makeStyle();
    expect(computeStyleHash(style1)).toBe(computeStyleHash(style2));
  });

  it('returns different hash when strokeColor changes', () => {
    const style1 = makeStyle({ strokeColor: '#000000' });
    const style2 = makeStyle({ strokeColor: '#ff0000' });
    expect(computeStyleHash(style1)).not.toBe(computeStyleHash(style2));
  });

  it('returns different hash when backgroundColor changes', () => {
    const style1 = makeStyle({ backgroundColor: '#ffffff' });
    const style2 = makeStyle({ backgroundColor: '#000000' });
    expect(computeStyleHash(style1)).not.toBe(computeStyleHash(style2));
  });

  it('returns different hash when fillStyle changes', () => {
    const style1 = makeStyle({ fillStyle: 'solid' });
    const style2 = makeStyle({ fillStyle: 'hachure' });
    expect(computeStyleHash(style1)).not.toBe(computeStyleHash(style2));
  });

  it('returns different hash when strokeWidth changes', () => {
    const style1 = makeStyle({ strokeWidth: 2 });
    const style2 = makeStyle({ strokeWidth: 4 });
    expect(computeStyleHash(style1)).not.toBe(computeStyleHash(style2));
  });

  it('returns different hash when roughness changes', () => {
    const style1 = makeStyle({ roughness: 0 });
    const style2 = makeStyle({ roughness: 2 });
    expect(computeStyleHash(style1)).not.toBe(computeStyleHash(style2));
  });

  it('returns different hash when opacity changes', () => {
    const style1 = makeStyle({ opacity: 1 });
    const style2 = makeStyle({ opacity: 0.5 });
    expect(computeStyleHash(style1)).not.toBe(computeStyleHash(style2));
  });

  it('returns a string', () => {
    const hash = computeStyleHash(makeStyle());
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });
});
