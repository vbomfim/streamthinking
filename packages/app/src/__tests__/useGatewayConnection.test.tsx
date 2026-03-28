// @vitest-environment jsdom
/**
 * Unit tests for useGatewayConnection hook.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies: reads settings, calls createGatewayConnection, syncs state,
 * disconnects on unmount, reconnects on settings change, handles missing settings.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { SETTINGS_STORAGE_KEY } from '../components/panels/SettingsPanel.js';
import { useGatewayConnection } from '../hooks/useGatewayConnection.js';

// ── Mock createGatewayConnection ───────────────────────────

const mockDisconnect = vi.fn();

function createMockConnection(overrides: Record<string, unknown> = {}) {
  return {
    connected: false,
    sessionId: null as string | null,
    agents: [],
    error: null as string | null,
    disconnect: mockDisconnect,
    ...overrides,
  };
}

let mockConnection = createMockConnection();

vi.mock('@infinicanvas/engine', () => ({
  createGatewayConnection: vi.fn(() => mockConnection),
}));

// Import after mock so we get the mocked version
const { createGatewayConnection } = await import('@infinicanvas/engine');

// ── Helpers ────────────────────────────────────────────────

function setSettings(url: string, key: string): void {
  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ gatewayUrl: url, apiKey: key }),
  );
}

// ── Setup / Teardown ───────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockConnection = createMockConnection();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

// ── Tests ──────────────────────────────────────────────────

describe('useGatewayConnection', () => {
  describe('no settings configured', () => {
    it('returns hasSettings: false when localStorage is empty', () => {
      const { result } = renderHook(() => useGatewayConnection());

      expect(result.current.hasSettings).toBe(false);
    });

    it('does not call createGatewayConnection when no settings', () => {
      renderHook(() => useGatewayConnection());

      expect(createGatewayConnection).not.toHaveBeenCalled();
    });

    it('returns disconnected state when no settings', () => {
      const { result } = renderHook(() => useGatewayConnection());

      expect(result.current.connected).toBe(false);
      expect(result.current.sessionId).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('partial settings', () => {
    it('does not connect when only gatewayUrl is set', () => {
      setSettings('ws://localhost:3001', '');
      const { result } = renderHook(() => useGatewayConnection());

      expect(result.current.hasSettings).toBe(false);
      expect(createGatewayConnection).not.toHaveBeenCalled();
    });

    it('does not connect when only apiKey is set', () => {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ gatewayUrl: '', apiKey: 'sk-test' }),
      );
      const { result } = renderHook(() => useGatewayConnection());

      expect(result.current.hasSettings).toBe(false);
      expect(createGatewayConnection).not.toHaveBeenCalled();
    });
  });

  describe('with valid settings', () => {
    it('calls createGatewayConnection with correct options', () => {
      setSettings('ws://localhost:3001', 'sk-test-123');
      renderHook(() => useGatewayConnection());

      expect(createGatewayConnection).toHaveBeenCalledWith({
        url: 'ws://localhost:3001',
        apiKey: 'sk-test-123',
        sessionId: 'local-dev',
      });
    });

    it('returns hasSettings: true', () => {
      setSettings('ws://localhost:3001', 'sk-test-123');
      const { result } = renderHook(() => useGatewayConnection());

      expect(result.current.hasSettings).toBe(true);
    });

    it('syncs connected state from connection object', () => {
      mockConnection = createMockConnection({ connected: true });
      setSettings('ws://localhost:3001', 'sk-test-123');
      const { result } = renderHook(() => useGatewayConnection());

      // After initial poll tick
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.connected).toBe(true);
    });

    it('syncs sessionId from connection object', () => {
      mockConnection = createMockConnection({ sessionId: 'sess-abc' });
      setSettings('ws://localhost:3001', 'sk-test-123');
      const { result } = renderHook(() => useGatewayConnection());

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.sessionId).toBe('sess-abc');
    });

    it('syncs error from connection object', () => {
      mockConnection = createMockConnection({ error: 'Auth failed' });
      setSettings('ws://localhost:3001', 'sk-test-123');
      const { result } = renderHook(() => useGatewayConnection());

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.error).toBe('Auth failed');
    });
  });

  describe('disconnect on unmount', () => {
    it('calls connection.disconnect() when hook unmounts', () => {
      setSettings('ws://localhost:3001', 'sk-test-123');
      const { unmount } = renderHook(() => useGatewayConnection());

      unmount();

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it('does not call disconnect when no connection was created', () => {
      // No settings → no connection
      const { unmount } = renderHook(() => useGatewayConnection());

      unmount();

      expect(mockDisconnect).not.toHaveBeenCalled();
    });
  });

  describe('settings change detection', () => {
    it('reconnects when settings change in localStorage', () => {
      setSettings('ws://localhost:3001', 'sk-key-1');
      const { result } = renderHook(() => useGatewayConnection());

      expect(createGatewayConnection).toHaveBeenCalledTimes(1);

      // Simulate settings change from another tab (storage event)
      act(() => {
        setSettings('ws://localhost:4001', 'sk-key-2');
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: SETTINGS_STORAGE_KEY,
            storageArea: localStorage,
          }),
        );
      });

      // Should disconnect old and create new
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
      expect(createGatewayConnection).toHaveBeenCalledTimes(2);
      expect(createGatewayConnection).toHaveBeenLastCalledWith({
        url: 'ws://localhost:4001',
        apiKey: 'sk-key-2',
        sessionId: 'local-dev',
      });
    });

    it('disconnects when settings are cleared', () => {
      setSettings('ws://localhost:3001', 'sk-key-1');
      renderHook(() => useGatewayConnection());

      expect(createGatewayConnection).toHaveBeenCalledTimes(1);

      // Clear settings
      act(() => {
        localStorage.removeItem(SETTINGS_STORAGE_KEY);
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: SETTINGS_STORAGE_KEY,
            storageArea: localStorage,
          }),
        );
      });

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('corrupt localStorage', () => {
    it('handles corrupt JSON gracefully', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, 'not-json!!!');
      const { result } = renderHook(() => useGatewayConnection());

      expect(result.current.hasSettings).toBe(false);
      expect(createGatewayConnection).not.toHaveBeenCalled();
    });
  });
});
