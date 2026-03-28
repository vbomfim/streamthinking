/**
 * useGatewayConnection — React hook wrapping the engine's gateway factory.
 *
 * Reads gateway settings from localStorage, creates a connection via
 * `createGatewayConnection` from @infinicanvas/engine, and syncs the
 * connection's mutable state into React state via a polling interval.
 *
 * Handles: missing settings (offline mode), settings changes (storage event),
 * cleanup on unmount, and corrupt localStorage gracefully. [CLEAN-CODE]
 *
 * @module
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createGatewayConnection } from '@infinicanvas/engine';
import type { GatewayConnection } from '@infinicanvas/engine';
import { SETTINGS_STORAGE_KEY, SETTINGS_CHANGED_EVENT } from '../components/panels/SettingsPanel.js';
import type { AppSettings } from '../components/panels/SettingsPanel.js';

// ── Types ──────────────────────────────────────────────────

/** State returned by useGatewayConnection. */
export interface GatewayConnectionState {
  /** Whether the WebSocket is currently connected. */
  connected: boolean;
  /** Current gateway session ID. */
  sessionId: string | null;
  /** Last error message from the connection. */
  error: string | null;
  /** Whether both gatewayUrl and apiKey are configured. */
  hasSettings: boolean;
  /** Send an arbitrary JSON message through the gateway WebSocket. */
  sendMessage: (message: Record<string, unknown>) => void;
}

// ── Constants ──────────────────────────────────────────────

/** Interval (ms) for polling connection state into React state. */
const POLL_INTERVAL_MS = 500;

// ── Helpers ────────────────────────────────────────────────

/**
 * Load gateway settings from localStorage.
 *
 * Returns null when localStorage is unavailable, empty, or contains
 * invalid JSON. Returns settings only when both fields are non-empty.
 * Mirrors the loading logic in SettingsPanel. [DRY]
 */
function loadSettings(): AppSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const gatewayUrl =
      typeof parsed.gatewayUrl === 'string' ? parsed.gatewayUrl : '';
    const apiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey : '';

    if (!gatewayUrl || !apiKey) return null;

    return { gatewayUrl, apiKey };
  } catch {
    return null;
  }
}

// ── Hook ───────────────────────────────────────────────────

/**
 * React hook that manages the gateway connection lifecycle.
 *
 * - Reads settings from localStorage
 * - Creates/destroys connection when settings change
 * - Polls connection state into React state
 * - Cleans up on unmount
 */
export function useGatewayConnection(): GatewayConnectionState {
  /** No-op send for when connection is not available. */
  const noopSend = useCallback((): void => {}, []);

  const connectionRef = useRef<GatewayConnection | null>(null);
  const [state, setState] = useState<GatewayConnectionState>({
    connected: false,
    sessionId: null,
    error: null,
    hasSettings: false,
    sendMessage: noopSend,
  });

  /**
   * Tear down the current connection (if any) and optionally
   * create a new one from the current settings. [SRP]
   */
  const syncConnection = useCallback(() => {
    const settings = loadSettings();
    const hasSettings = settings !== null;

    // Disconnect existing connection before creating a new one
    if (connectionRef.current) {
      connectionRef.current.disconnect();
      connectionRef.current = null;
    }

    if (hasSettings) {
      const conn = createGatewayConnection({
        url: settings.gatewayUrl,
        apiKey: settings.apiKey,
        sessionId: 'local-dev',
      });
      connectionRef.current = conn;
    }

    // Immediately sync state
    const conn = connectionRef.current;
    setState({
      connected: conn?.connected ?? false,
      sessionId: conn?.sessionId ?? null,
      error: conn?.error ?? null,
      hasSettings,
      sendMessage: conn?.sendMessage ?? noopSend,
    });
  }, []);

  // ── Initial connection + storage event listener ────────

  useEffect(() => {
    syncConnection();

    /** React to settings changes from other tabs. */
    function handleStorageChange(event: StorageEvent): void {
      if (event.key === SETTINGS_STORAGE_KEY || event.key === null) {
        syncConnection();
      }
    }

    /** React to settings changes from same tab (SettingsPanel save). */
    function handleSettingsChanged(): void {
      syncConnection();
    }

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(SETTINGS_CHANGED_EVENT, handleSettingsChanged);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, handleSettingsChanged);
      // Cleanup connection on unmount
      if (connectionRef.current) {
        connectionRef.current.disconnect();
        connectionRef.current = null;
      }
    };
  }, [syncConnection]);

  // ── Poll connection state into React state ─────────────

  useEffect(() => {
    const timer = setInterval(() => {
      const conn = connectionRef.current;
      setState((prev) => {
        const next: GatewayConnectionState = {
          connected: conn?.connected ?? false,
          sessionId: conn?.sessionId ?? null,
          error: conn?.error ?? null,
          hasSettings: prev.hasSettings,
          sendMessage: conn?.sendMessage ?? noopSend,
        };

        // Avoid unnecessary re-renders [YAGNI]
        if (
          prev.connected === next.connected &&
          prev.sessionId === next.sessionId &&
          prev.error === next.error
        ) {
          return prev;
        }

        return next;
      });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  return state;
}
