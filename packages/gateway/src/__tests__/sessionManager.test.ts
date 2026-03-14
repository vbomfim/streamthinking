/**
 * Session manager unit tests.
 *
 * Tests for session lifecycle, client management, and garbage collection.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SessionManager } from '../sessionManager.js';

// Minimal WebSocket stub for unit testing (avoids real ws dependency).
function createMockWs(): any {
  return {
    readyState: 1,
    OPEN: 1,
    send: vi.fn(),
    close: vi.fn(),
  };
}

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  afterEach(() => {
    manager.stopGC();
  });

  describe('createSession', () => {
    it('creates a session with a unique ID', () => {
      const id = manager.createSession();
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('creates sessions with different IDs', () => {
      const id1 = manager.createSession();
      const id2 = manager.createSession();
      expect(id1).not.toBe(id2);
    });

    it('initializes session with empty state', () => {
      const id = manager.createSession();
      const session = manager.getSession(id);
      expect(session).toBeDefined();
      expect(session!.expressions).toEqual({});
      expect(session!.expressionOrder).toEqual([]);
      expect(session!.clients.size).toBe(0);
      expect(session!.agents.size).toBe(0);
    });

    it('sets createdAt and lastActivity timestamps', () => {
      const before = Date.now();
      const id = manager.createSession();
      const after = Date.now();
      const session = manager.getSession(id);
      expect(session!.createdAt).toBeGreaterThanOrEqual(before);
      expect(session!.createdAt).toBeLessThanOrEqual(after);
      expect(session!.lastActivity).toBeGreaterThanOrEqual(before);
    });
  });

  describe('joinSession', () => {
    it('returns current state when joining a valid session', () => {
      const id = manager.createSession();
      const ws = createMockWs();
      const state = manager.joinSession(id, ws);
      expect(state).toBeDefined();
      expect(state!.expressions).toEqual([]);
      expect(state!.expressionOrder).toEqual([]);
    });

    it('adds client to session', () => {
      const id = manager.createSession();
      const ws = createMockWs();
      manager.joinSession(id, ws);
      const session = manager.getSession(id);
      expect(session!.clients.has(ws)).toBe(true);
    });

    it('returns undefined for non-existent session', () => {
      const ws = createMockWs();
      const state = manager.joinSession('nonexistent', ws);
      expect(state).toBeUndefined();
    });

    it('supports multiple clients in one session', () => {
      const id = manager.createSession();
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      manager.joinSession(id, ws1);
      manager.joinSession(id, ws2);
      const session = manager.getSession(id);
      expect(session!.clients.size).toBe(2);
    });
  });

  describe('leaveSession', () => {
    it('removes client from session', () => {
      const id = manager.createSession();
      const ws = createMockWs();
      manager.joinSession(id, ws);
      manager.leaveSession(id, ws);
      const session = manager.getSession(id);
      expect(session!.clients.has(ws)).toBe(false);
    });

    it('does nothing for non-existent session', () => {
      const ws = createMockWs();
      // Should not throw
      manager.leaveSession('nonexistent', ws);
    });
  });

  describe('removeClientFromAll', () => {
    it('removes client from all sessions', () => {
      const id1 = manager.createSession();
      const id2 = manager.createSession();
      const ws = createMockWs();
      manager.joinSession(id1, ws);
      manager.joinSession(id2, ws);
      const affected = manager.removeClientFromAll(ws);
      expect(affected).toContain(id1);
      expect(affected).toContain(id2);
      expect(manager.getSession(id1)!.clients.size).toBe(0);
      expect(manager.getSession(id2)!.clients.size).toBe(0);
    });
  });

  describe('garbage collection', () => {
    it('does not remove sessions with active clients', () => {
      vi.useFakeTimers();
      const id = manager.createSession();
      const ws = createMockWs();
      manager.joinSession(id, ws);

      // Fast-forward 31 minutes
      vi.advanceTimersByTime(31 * 60 * 1000);

      // Session should still exist (has clients)
      expect(manager.getSession(id)).toBeDefined();
      vi.useRealTimers();
    });
  });
});
