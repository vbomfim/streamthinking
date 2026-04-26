/**
 * URL codec — encode/decode canvas state for URL hash fragment sharing.
 *
 * Encode pipeline: JSON string → UTF-8 bytes → pako.deflateRaw → base64url (no padding)
 * Decode pipeline: base64url → pako.inflateRaw → UTF-8 string → importFromJson (Zod validation)
 *
 * Uses discriminated union result types for safe error handling — never throws. [CLEAN-CODE] [SOLID]
 *
 * @module
 */

import { deflateRaw, inflateRaw } from 'pako';
import { importFromJson } from './fromJson.js';
import type { VisualExpression } from '@infinicanvas/protocol';

/** Default maximum compressed size in bytes (32 KB). */
const DEFAULT_MAX_BYTES = 32_768;

/** Maximum decompressed size in bytes (2 MB) — guards against decompression bombs. */
const MAX_INFLATED_BYTES = 2_097_152;

/** Content types that are unsafe for URL-shared canvases. */
type UnsafeContentType = 'external-image' | 'svg-data-uri';

/** Warning about content stripped during encode or decode. */
export interface ContentWarning {
  type: UnsafeContentType;
  count: number;
  message: string;
}

/** Successful URL encode result. */
export interface UrlEncodeResult {
  success: true;
  /** base64url encoded string (no padding). */
  encoded: string;
  /** Compressed byte count. */
  byteLength: number;
  /** Warnings about content that was stripped for safety. */
  warnings: ContentWarning[];
}

/** Failed URL encode result with diagnostic info. */
export interface UrlEncodeError {
  success: false;
  error: string;
  /** Compressed byte count (if deflation succeeded). */
  byteLength?: number;
}

/** Discriminated union for encode outcomes. */
export type UrlEncodeOutcome = UrlEncodeResult | UrlEncodeError;

// ── Helpers ───────────────────────────────────────────────────

/** Check if an image src is an external URL (not a safe data:image/ URI). */
function isExternalUrl(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

/** Check if an image src is an SVG data URI (potential script vector). */
function isSvgDataUri(src: string): boolean {
  return /^data:image\/svg/i.test(src);
}

/**
 * Sanitize expressions for URL sharing — strip unsafe content.
 *
 * Removes external image URLs (tracking risk) and SVG data URIs
 * (potential script injection via foreignObject). Returns sanitized
 * expressions and warnings about what was stripped.
 */
function sanitizeForUrl(
  expressions: Record<string, VisualExpression>,
): { sanitized: Record<string, VisualExpression>; warnings: ContentWarning[] } {
  const sanitized: Record<string, VisualExpression> = {};
  let externalCount = 0;
  let svgCount = 0;

  for (const [id, expr] of Object.entries(expressions)) {
    // NOTE: Only 'image' expressions have user-provided URLs (src field).
    // If new expression kinds with URL fields are added, update this check.
    if (expr.kind === 'image' && expr.data.kind === 'image') {
      const src = expr.data.src;
      if (isExternalUrl(src)) {
        externalCount++;
        continue; // strip entirely
      }
      if (isSvgDataUri(src)) {
        svgCount++;
        continue; // strip entirely
      }
    }
    sanitized[id] = expr;
  }

  const warnings: ContentWarning[] = [];
  if (externalCount > 0) {
    warnings.push({
      type: 'external-image',
      count: externalCount,
      message: `${externalCount} external image(s) removed — external URLs are not allowed in shared links for privacy`,
    });
  }
  if (svgCount > 0) {
    warnings.push({
      type: 'svg-data-uri',
      count: svgCount,
      message: `${svgCount} SVG image(s) removed — SVG data URIs are not allowed in shared links for security`,
    });
  }

  return { sanitized, warnings };
}

/** Convert a Uint8Array to a base64url string (no padding). */
function toBase64Url(bytes: Uint8Array): string {
  // Build standard base64 from binary
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 = btoa(binary);
  // Replace URL-unsafe chars and strip padding
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Convert a base64url string (with or without padding) to Uint8Array. */
function fromBase64Url(b64url: string): Uint8Array {
  // Restore standard base64 chars
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  // Restore padding (pad === 1 is structurally invalid base64)
  const pad = b64.length % 4;
  if (pad === 1) throw new Error('Invalid base64url: impossible length');
  if (pad === 2) b64 += '==';
  else if (pad === 3) b64 += '=';

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── Public API ────────────────────────────────────────────────

/**
 * Encode canvas JSON for URL hash fragment sharing.
 *
 * Compresses using deflateRaw and produces a URL-safe base64 string.
 * Returns a discriminated result — never throws.
 *
 * @param json - Serialized canvas JSON string (from exportToJson)
 * @param maxBytes - Maximum compressed size (default 32 KB)
 */
export function encodeCanvasForUrl(
  json: string,
  maxBytes: number = DEFAULT_MAX_BYTES,
): UrlEncodeOutcome {
  // Guard: parse and validate shape defensively (never throw)
  let version: string;
  let expressions: Record<string, VisualExpression>;
  let expressionOrder: string[];
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { success: false, error: 'Invalid JSON input: expected an object' };
    }
    if (typeof parsed['version'] !== 'string') {
      return { success: false, error: 'Invalid JSON input: missing version' };
    }
    if (typeof parsed['expressions'] !== 'object' || parsed['expressions'] === null || Array.isArray(parsed['expressions'])) {
      return { success: false, error: 'Nothing to share — canvas is empty' };
    }
    if (!Array.isArray(parsed['expressionOrder'])) {
      return { success: false, error: 'Invalid JSON input: missing expressionOrder' };
    }
    version = parsed['version'] as string;
    expressions = parsed['expressions'] as Record<string, VisualExpression>;
    expressionOrder = parsed['expressionOrder'] as string[];
    if (Object.keys(expressions).length === 0) {
      return { success: false, error: 'Nothing to share — canvas is empty' };
    }
  } catch {
    return { success: false, error: 'Invalid JSON input' };
  }

  // Sanitize: strip external images and SVG data URIs
  const { sanitized, warnings } = sanitizeForUrl(expressions);
  const sanitizedOrder = expressionOrder.filter((id) => id in sanitized);

  if (Object.keys(sanitized).length === 0) {
    return { success: false, error: 'Nothing to share — all expressions were removed during safety check' };
  }

  const sanitizedJson = JSON.stringify({
    version,
    expressions: sanitized,
    expressionOrder: sanitizedOrder,
  });

  // Compress: UTF-8 → deflateRaw
  let deflated: Uint8Array;
  try {
    const utf8 = new TextEncoder().encode(sanitizedJson);
    deflated = deflateRaw(utf8);
  } catch (err) {
    return {
      success: false,
      error: `Compression failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const byteLength = deflated.length;

  // Size check
  if (byteLength > maxBytes) {
    return {
      success: false,
      error: `Compressed size (${byteLength} bytes) exceeds limit (${maxBytes} bytes). Try reducing the number of expressions.`,
      byteLength,
    };
  }

  // Encode to base64url
  const encoded = toBase64Url(deflated);

  return { success: true, encoded, byteLength, warnings };
}

/** Decode result with warnings about stripped content. */
export interface UrlDecodeSuccess {
  success: true;
  data: {
    expressions: VisualExpression[];
    expressionOrder: string[];
  };
  /** Warnings about content stripped during decode. */
  warnings: ContentWarning[];
}

export interface UrlDecodeError {
  success: false;
  error: string;
}

/** Discriminated union for decode outcomes. */
export type UrlDecodeResult = UrlDecodeSuccess | UrlDecodeError;

/**
 * Decode a URL-encoded canvas string back into validated canvas state.
 *
 * Handles corrupt base64, corrupt deflate, corrupt JSON, and invalid schema.
 * Strips external image URLs and SVG data URIs for security.
 * Returns a discriminated result — never throws.
 *
 * @param encoded - base64url string from URL hash fragment
 */
export function decodeCanvasFromUrl(encoded: string): UrlDecodeResult {
  if (!encoded || encoded.trim() === '') {
    return { success: false, error: 'Empty URL data' };
  }

  // Step 1: base64url → bytes
  let compressed: Uint8Array;
  try {
    compressed = fromBase64Url(encoded);
  } catch {
    return { success: false, error: 'Invalid URL data: corrupt base64 encoding' };
  }

  // Step 2: inflateRaw → UTF-8 (with size limit to prevent decompression bombs)
  // NOTE: inflateRaw fully decompresses before size check. Practical risk is low
  // because input is bounded to ~32KB compressed (deflate ratio rarely exceeds 1000:1,
  // so worst case ~32MB which browsers handle). True streaming limits would require
  // pako's Inflate class with chunk-level byte counting.
  let jsonString: string;
  try {
    const inflated = inflateRaw(compressed);
    if (inflated.length > MAX_INFLATED_BYTES) {
      return { success: false, error: `Decompressed data too large (${inflated.length} bytes > ${MAX_INFLATED_BYTES} byte limit)` };
    }
    jsonString = new TextDecoder('utf-8', { fatal: true }).decode(inflated);
  } catch {
    return { success: false, error: 'Invalid URL data: corrupt compressed data' };
  }

  // Step 3: JSON parse + Zod validation via importFromJson
  const importResult = importFromJson(jsonString);
  if (!importResult.success) {
    return importResult;
  }

  // Step 4: Sanitize — strip unsafe content from decoded expressions
  const exprRecord: Record<string, VisualExpression> = {};
  for (const expr of importResult.data.expressions) {
    exprRecord[expr.id] = expr;
  }
  const { sanitized, warnings } = sanitizeForUrl(exprRecord);
  const sanitizedExprs = importResult.data.expressions.filter((e) => e.id in sanitized);
  const sanitizedOrder = importResult.data.expressionOrder.filter((id) => id in sanitized);

  return {
    success: true,
    data: { expressions: sanitizedExprs, expressionOrder: sanitizedOrder },
    warnings,
  };
}
