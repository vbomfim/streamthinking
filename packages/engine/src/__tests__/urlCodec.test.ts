/**
 * Unit tests for URL codec — encode/decode canvas state for URL sharing.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers round-trips, edge cases, corrupt input, size limits, and performance.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression } from '@infinicanvas/protocol';
import { exportToJson } from '../export/toJson.js';
import { encodeCanvasForUrl, decodeCanvasFromUrl } from '../export/urlCodec.js';
import { generate100ObjectFixture } from './fixtures/100-objects-connected.js';

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

/** Helper: build a single rectangle expression with override id. */
function makeRectangle(id: string, label = 'Test'): VisualExpression {
  const expr = builder.rectangle(100, 200, 300, 150).label(label).build();
  return { ...expr, id };
}

/** Helper: build a canvas JSON string from expressions. */
function buildJson(expressions: Record<string, VisualExpression>): string {
  return exportToJson(expressions, Object.keys(expressions));
}

describe('urlCodec', () => {
  // ── Round-trip tests ──────────────────────────────────────

  it('encode → decode round-trip (1 shape)', () => {
    const rect = makeRectangle('rect-1');
    const json = buildJson({ 'rect-1': rect });

    const encoded = encodeCanvasForUrl(json);
    expect(encoded.success).toBe(true);
    if (!encoded.success) return;

    const decoded = decodeCanvasFromUrl(encoded.encoded);
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;

    // Verify data integrity
    expect(decoded.data.expressions).toHaveLength(1);
    expect(decoded.data.expressions[0]!.id).toBe('rect-1');
    expect(decoded.data.expressions[0]!.kind).toBe('rectangle');
  });

  it('encode → decode round-trip (25 shapes)', () => {
    const expressions: Record<string, VisualExpression> = {};
    for (let i = 0; i < 15; i++) {
      const id = `rect-${i}`;
      expressions[id] = makeRectangle(id, `Rect ${i}`);
    }
    for (let i = 0; i < 5; i++) {
      const id = `ellipse-${i}`;
      const expr = builder.ellipse(i * 100, i * 50, 80, 60).label(`E${i}`).build();
      expressions[id] = { ...expr, id };
    }
    for (let i = 0; i < 5; i++) {
      const id = `text-${i}`;
      const expr = builder.text(`Note ${i}`, i * 200, 500).build();
      expressions[id] = { ...expr, id };
    }

    const json = buildJson(expressions);
    const encoded = encodeCanvasForUrl(json);
    expect(encoded.success).toBe(true);
    if (!encoded.success) return;

    const decoded = decodeCanvasFromUrl(encoded.encoded);
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;

    expect(decoded.data.expressions).toHaveLength(25);
    expect(decoded.data.expressionOrder).toHaveLength(25);
  });

  it('encode → decode round-trip (100 shapes)', () => {
    const fixture = generate100ObjectFixture();
    const json = JSON.stringify(fixture);

    const encoded = encodeCanvasForUrl(json);
    expect(encoded.success).toBe(true);
    if (!encoded.success) return;

    const decoded = decodeCanvasFromUrl(encoded.encoded);
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;

    expect(decoded.data.expressions).toHaveLength(100);
    expect(decoded.data.expressionOrder).toHaveLength(100);
  });

  it('encode → decode with Unicode labels (emoji, CJK)', () => {
    const rect = makeRectangle('uni-1', '🎨 キャンバス 画布 مرحبا');
    const json = buildJson({ 'uni-1': rect });

    const encoded = encodeCanvasForUrl(json);
    expect(encoded.success).toBe(true);
    if (!encoded.success) return;

    const decoded = decodeCanvasFromUrl(encoded.encoded);
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;

    const data = decoded.data.expressions[0]!.data;
    expect('label' in data && data.label).toBe('🎨 キャンバス 画布 مرحبا');
  });

  // ── Error cases ───────────────────────────────────────────

  it('encode rejects > maxBytes', () => {
    // Build enough data to exceed a tiny limit
    const expressions: Record<string, VisualExpression> = {};
    for (let i = 0; i < 50; i++) {
      const id = `rect-${i}`;
      expressions[id] = makeRectangle(id, `Rectangle with a long label text #${i}`);
    }
    const json = buildJson(expressions);

    const result = encodeCanvasForUrl(json, 100); // Very low limit
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('exceeds');
      expect(result.byteLength).toBeGreaterThan(100);
    }
  });

  it('encode empty canvas returns error', () => {
    const json = exportToJson({}, []);
    const result = encodeCanvasForUrl(json);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Nothing to share');
    }
  });

  it('decode corrupt base64 returns error, never throws', () => {
    const result = decodeCanvasFromUrl('!!!not-base64!!!');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it('decode corrupt deflate returns error, never throws', () => {
    // Valid base64 but not valid deflated data
    const result = decodeCanvasFromUrl('SGVsbG9Xb3JsZA');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it('decode corrupt JSON returns error, never throws', () => {
    // We need to encode some non-JSON bytes via deflate
    // Import pako directly for this test
    const pako = require('pako');
    const badJson = '{ not valid json at all }}}';
    const bytes = new TextEncoder().encode(badJson);
    const deflated = pako.deflateRaw(bytes);
    // base64url encode
    let b64 = Buffer.from(deflated).toString('base64');
    b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const result = decodeCanvasFromUrl(b64);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it('decode invalid schema returns error (Zod validation)', () => {
    const pako = require('pako');
    // Valid JSON but missing required fields
    const badPayload = JSON.stringify({ version: '1.0', expressions: { 'x': { bad: true } }, expressionOrder: ['x'] });
    const bytes = new TextEncoder().encode(badPayload);
    const deflated = pako.deflateRaw(bytes);
    let b64 = Buffer.from(deflated).toString('base64');
    b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const result = decodeCanvasFromUrl(b64);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  // ── base64url format tests ────────────────────────────────

  it('base64url output has no padding characters', () => {
    const rect = makeRectangle('rect-1');
    const json = buildJson({ 'rect-1': rect });

    const encoded = encodeCanvasForUrl(json);
    expect(encoded.success).toBe(true);
    if (!encoded.success) return;

    expect(encoded.encoded).not.toContain('=');
  });

  it('base64url output has no URL-unsafe characters', () => {
    // Generate enough data to make + and / likely in standard base64
    const expressions: Record<string, VisualExpression> = {};
    for (let i = 0; i < 20; i++) {
      const id = `rect-${i}`;
      expressions[id] = makeRectangle(id, `Label ${i}`);
    }
    const json = buildJson(expressions);

    const encoded = encodeCanvasForUrl(json);
    expect(encoded.success).toBe(true);
    if (!encoded.success) return;

    expect(encoded.encoded).not.toContain('+');
    expect(encoded.encoded).not.toContain('/');
  });

  // ── Size & performance tests ──────────────────────────────

  it('100-object fixture compressed size < 8 KB', () => {
    const fixture = generate100ObjectFixture();
    const json = JSON.stringify(fixture);

    const encoded = encodeCanvasForUrl(json);
    expect(encoded.success).toBe(true);
    if (!encoded.success) return;

    expect(encoded.byteLength).toBeLessThan(8192);
  });

  it('encode/decode performance < 50ms for 100 shapes', () => {
    const fixture = generate100ObjectFixture();
    const json = JSON.stringify(fixture);

    const start = performance.now();
    const encoded = encodeCanvasForUrl(json);
    expect(encoded.success).toBe(true);
    if (!encoded.success) return;

    decodeCanvasFromUrl(encoded.encoded);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });
});
