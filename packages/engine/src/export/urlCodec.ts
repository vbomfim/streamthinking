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
import type { ImportResult } from './fromJson.js';

/** Default maximum compressed size in bytes (32 KB). */
const DEFAULT_MAX_BYTES = 32_768;

/** Maximum decompressed size in bytes (2 MB) — guards against decompression bombs. */
const MAX_INFLATED_BYTES = 2_097_152;

/** Successful URL encode result. */
export interface UrlEncodeResult {
  success: true;
  /** base64url encoded string (no padding). */
  encoded: string;
  /** Compressed byte count. */
  byteLength: number;
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
  // Guard: empty canvas
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const expressions = parsed['expressions'] as Record<string, unknown> | undefined;
    if (!expressions || Object.keys(expressions).length === 0) {
      return { success: false, error: 'Nothing to share — canvas is empty' };
    }
  } catch {
    return { success: false, error: 'Invalid JSON input' };
  }

  // Compress: UTF-8 → deflateRaw
  let deflated: Uint8Array;
  try {
    const utf8 = new TextEncoder().encode(json);
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

  return { success: true, encoded, byteLength };
}

/**
 * Decode a URL-encoded canvas string back into validated canvas state.
 *
 * Handles corrupt base64, corrupt deflate, corrupt JSON, and invalid schema.
 * Returns the same ImportResult type as importFromJson — never throws.
 *
 * @param encoded - base64url string from URL hash fragment
 */
export function decodeCanvasFromUrl(encoded: string): ImportResult {
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
  return importFromJson(jsonString);
}
