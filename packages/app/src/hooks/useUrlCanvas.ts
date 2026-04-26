/**
 * useUrlCanvas — React hook for URL-based canvas sharing.
 *
 * On mount: checks window.location.hash for `#data=` prefix, decodes,
 * and loads canvas state from the URL. Provides `shareAsUrl()` to encode
 * current canvas state into the URL hash and copy to clipboard.
 *
 * [CLEAN-CODE] [SOLID]
 *
 * @module
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  useCanvasStore,
  exportToJson,
  encodeCanvasForUrl,
  decodeCanvasFromUrl,
} from '@infinicanvas/engine';
import type { ContentWarning } from '@infinicanvas/engine';

/** Result from the shareAsUrl action. */
export interface ShareResult {
  success: boolean;
  url?: string;
  error?: string;
  byteLength?: number;
  /** Whether the URL was copied to clipboard (false if clipboard API unavailable/denied). */
  clipboardCopied?: boolean;
  /** Warnings about content stripped for safety. */
  warnings?: ContentWarning[];
}

/** Return type of the useUrlCanvas hook. */
export interface UseUrlCanvasReturn {
  /** Encode current canvas into URL hash and copy to clipboard. */
  shareAsUrl: () => Promise<ShareResult>;
  /** Whether canvas was loaded from a URL on mount. */
  loadedFromUrl: boolean;
  /** Warnings from loading a URL-shared canvas (e.g., stripped images). */
  loadWarnings: ContentWarning[];
}

/** Parse the hash fragment into key-value pairs (simple key=value;key2=value2). */
function parseHash(hash: string): Map<string, string> {
  const map = new Map<string, string>();
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return map;

  // Support both & and standalone data= for simplicity
  const pairs = raw.split('&');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx);
    const value = pair.slice(eqIdx + 1);
    map.set(key, value);
  }
  return map;
}

/** Rebuild hash fragment from key-value map. */
function buildHash(map: Map<string, string>): string {
  const entries: string[] = [];
  for (const [key, value] of map) {
    entries.push(`${key}=${value}`);
  }
  return entries.length > 0 ? `#${entries.join('&')}` : '';
}

/**
 * React hook for URL-based canvas sharing.
 *
 * - On mount: if URL contains `#data=<encoded>`, decodes and loads canvas state
 * - `shareAsUrl()`: encodes current state → sets hash → copies URL to clipboard
 */
export function useUrlCanvas(): UseUrlCanvasReturn {
  const [loadedFromUrl, setLoadedFromUrl] = useState(false);
  const [loadWarnings, setLoadWarnings] = useState<ContentWarning[]>([]);
  const initialLoadDone = useRef(false);

  // Load from URL hash on mount (once)
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const hash = window.location.hash;
    const params = parseHash(hash);
    const data = params.get('data');
    if (!data) return;

    const result = decodeCanvasFromUrl(data);
    if (result.success) {
      useCanvasStore.getState().replaceState(
        result.data.expressions,
        result.data.expressionOrder,
      );
      setLoadedFromUrl(true);
      if (result.warnings.length > 0) {
        setLoadWarnings(result.warnings);
        console.warn('[useUrlCanvas] Content stripped from shared URL:', result.warnings.map((w) => w.message).join('; '));
      }
    } else {
      console.warn('[useUrlCanvas] Corrupt URL data, loading blank canvas:', result.error);
    }
  }, []);

  const shareAsUrl = useCallback(async (): Promise<ShareResult> => {
    const { expressions, expressionOrder } = useCanvasStore.getState();
    const json = exportToJson(expressions, expressionOrder);

    const encodeResult = encodeCanvasForUrl(json);
    if (!encodeResult.success) {
      return {
        success: false,
        error: encodeResult.error,
        byteLength: encodeResult.byteLength,
      };
    }

    // Update hash, preserving other params
    const params = parseHash(window.location.hash);
    params.set('data', encodeResult.encoded);
    const newHash = buildHash(params);

    // Use replaceState to avoid creating browser history entries
    const url = new URL(window.location.href);
    url.hash = newHash.slice(1);
    const newUrl = url.toString();
    window.history.replaceState(null, '', newHash);

    // Copy to clipboard — surface failures honestly
    let clipboardCopied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(newUrl);
        clipboardCopied = true;
      }
    } catch (err) {
      console.warn('[useUrlCanvas] Clipboard write failed:', err);
    }

    return {
      success: true,
      url: newUrl,
      byteLength: encodeResult.byteLength,
      clipboardCopied,
      warnings: encodeResult.warnings,
    };
  }, []);

  return { shareAsUrl, loadedFromUrl, loadWarnings };
}
