/**
 * Unit tests for useGatewayConnection hook.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Uses a mock WebSocket class to avoid real network connections.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression, ProtocolOperation } from '@infinicanvas/protocol';
import { useCanvasStore } from '../store/canvasStore.js';
import { useAgentStore } from '../store/agentStore.js';
import {
  createGatewayConnection,
  type GatewayConnection,
  type GatewayConnectionOptions,
} from '../hooks/useGatewayConnection.js';

// ── Minimal DOM event shims for Node.js ────────────────────

class MockEvent {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
}

class MockCloseEvent extends MockEvent {
  code: number;
  reason: string;
  constructor(type: string, init?: { code?: number; reason?: string }) {
    super(type);
    this.code = init?.code ?? 1000;
    this.reason = init?.reason ?? '';
  }
}

class MockMessageEvent extends MockEvent {
  data: unknown;
  constructor(type: string, init?: { data?: unknown }) {
    super(type);
    this.data = init?.data;
  }
}

// ── Mock WebSocket ─────────────────────────────────────────

/** Minimal mock WebSocket for testing gateway connection logic. */
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;

  onopen: ((event: MockEvent) => void) | null = null;
  onclose: ((event: MockCloseEvent) => void) | null = null;
  onmessage: ((event: MockMessageEvent) => void) | null = null;
  onerror: ((event: MockEvent) => void) | null = null;

  private _sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    // Track instance for test assertions
    MockWebSocket._instances.push(this);
  }

  send(data: string): void {
    this._sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new MockCloseEvent('close', { code: code ?? 1000, reason: reason ?? '' }));
    }
  }

  // ── Test helpers ──────────────────────────────────────────

  get sentMessages(): string[] {
    return this._sentMessages;
  }

  get sentParsed(): unknown[] {
    return this._sentMessages.map((m) => JSON.parse(m));
  }

  /** Simulate server opening the connection. */
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new MockEvent('open'));
    }
  }

  /** Simulate receiving a message from the server. */
  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      this.onmessage(new MockMessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  /** Simulate server closing the connection. */
  simulateClose(code: number = 1006, reason: string = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new MockCloseEvent('close', { code, reason }));
    }
  }

  /** Simulate a WebSocket error. */
  simulateError(): void {
    if (this.onerror) {
      this.onerror(new MockEvent('error'));
    }
  }

  // ── Static tracking ───────────────────────────────────────

  static _instances: MockWebSocket[] = [];

  static reset(): void {
    MockWebSocket._instances = [];
  }

  static get lastInstance(): MockWebSocket | undefined {
    return MockWebSocket._instances[MockWebSocket._instances.length - 1];
  }
}

// ── Test fixtures ──────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string): VisualExpression {
  const expr = builder
    .rectangle(100, 200, 300, 150)
    .label('Test Rectangle')
    .build();
  return { ...expr, id };
}

const defaultOptions: GatewayConnectionOptions = {
  url: 'ws://localhost:8080',
  apiKey: 'test-key-123',
};

// ── Setup/teardown ─────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  MockWebSocket.reset();

  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
    operationLog: [],
  });

  useAgentStore.setState({ agents: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Helper ─────────────────────────────────────────────────

function createConnection(opts?: Partial<GatewayConnectionOptions>): GatewayConnection {
  return createGatewayConnection(
    { ...defaultOptions, ...opts },
    MockWebSocket as unknown as typeof WebSocket,
  );
}

// ── Tests ──────────────────────────────────────────────────

describe('createGatewayConnection', () => {
  describe('connection lifecycle [AC1, AC9]', () => {
    it('creates WebSocket with provided URL', () => {
      const conn = createConnection();

      expect(MockWebSocket.lastInstance).toBeDefined();
      expect(MockWebSocket.lastInstance!.url).toBe('ws://localhost:8080');
      conn.disconnect();
    });

    it('sends create-session when no sessionId provided', () => {
      const conn = createConnection();
      const ws = MockWebSocket.lastInstance!;

      ws.simulateOpen();

      expect(ws.sentParsed).toHaveLength(1);
      expect(ws.sentParsed[0]).toEqual({
        type: 'create-session',
        auth: { apiKey: 'test-key-123' },
      });

      conn.disconnect();
    });

    it('sends join when sessionId provided', () => {
      const conn = createConnection({ sessionId: 'session-abc' });
      const ws = MockWebSocket.lastInstance!;

      ws.simulateOpen();

      expect(ws.sentParsed).toHaveLength(1);
      expect(ws.sentParsed[0]).toEqual({
        type: 'join',
        sessionId: 'session-abc',
        auth: { apiKey: 'test-key-123' },
      });

      conn.disconnect();
    });

    it('sets connected=true on open, false on close [AC9]', () => {
      const conn = createConnection();
      const ws = MockWebSocket.lastInstance!;

      expect(conn.connected).toBe(false);

      ws.simulateOpen();
      expect(conn.connected).toBe(true);

      conn.disconnect();
      expect(conn.connected).toBe(false);
    });
  });

  describe('session-created [AC1]', () => {
    it('sets sessionId on session-created message', () => {
      const conn = createConnection();
      const ws = MockWebSocket.lastInstance!;

      ws.simulateOpen();
      ws.simulateMessage({
        type: 'session-created',
        sessionId: 'sess-xyz',
      });

      expect(conn.sessionId).toBe('sess-xyz');
      conn.disconnect();
    });
  });

  describe('state-sync [AC2]', () => {
    it('replaces local state on state-sync', () => {
      const conn = createConnection({ sessionId: 'sess-1' });
      const ws = MockWebSocket.lastInstance!;

      // Add local state first
      const localExpr = makeRectangle('local-1');
      useCanvasStore.getState().addExpression(localExpr);

      ws.simulateOpen();
      const remoteExpr = makeRectangle('remote-1');
      ws.simulateMessage({
        type: 'state-sync',
        sessionId: 'sess-1',
        expressions: [remoteExpr],
        expressionOrder: ['remote-1'],
      });

      const state = useCanvasStore.getState();
      expect(state.expressions['local-1']).toBeUndefined();
      expect(state.expressions['remote-1']).toBeDefined();
      expect(state.expressionOrder).toEqual(['remote-1']);

      expect(conn.sessionId).toBe('sess-1');
      conn.disconnect();
    });
  });

  describe('local operation forwarding [AC3]', () => {
    it('sends local operations to gateway', () => {
      const conn = createConnection();
      const ws = MockWebSocket.lastInstance!;

      ws.simulateOpen();
      // Session needs to be established
      ws.simulateMessage({ type: 'session-created', sessionId: 'sess-1' });

      // Clear sent messages from handshake
      ws.sentMessages.length = 0;

      // Add an expression — this should trigger a send
      const expr = makeRectangle('rect-1');
      useCanvasStore.getState().addExpression(expr);

      expect(ws.sentMessages.length).toBeGreaterThanOrEqual(1);
      const lastSent = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]!);
      expect(lastSent.type).toBe('operation');
      expect(lastSent.operation.type).toBe('create');
      expect(lastSent.operation.payload.expressionId).toBe('rect-1');

      conn.disconnect();
    });
  });

  describe('remote operation application [AC4]', () => {
    it('applies remote operations to local store', () => {
      const conn = createConnection();
      const ws = MockWebSocket.lastInstance!;

      ws.simulateOpen();
      ws.simulateMessage({ type: 'session-created', sessionId: 'sess-1' });

      const remoteOp: ProtocolOperation = {
        id: 'remote-op-1',
        type: 'create',
        author: { type: 'human', id: 'user-2', name: 'Bob' },
        timestamp: Date.now(),
        payload: {
          type: 'create',
          expressionId: 'remote-rect-1',
          kind: 'rectangle',
          position: { x: 10, y: 20 },
          size: { width: 100, height: 50 },
          data: { kind: 'rectangle' },
        },
      };

      ws.simulateMessage({ type: 'operation', operation: remoteOp });

      const state = useCanvasStore.getState();
      expect(state.expressions['remote-rect-1']).toBeDefined();
      // Remote ops should NOT be in operationLog
      // (only the local create-session handshake ops should be there, if any)
      const remoteInLog = state.operationLog.find((op) => op.id === 'remote-op-1');
      expect(remoteInLog).toBeUndefined();

      conn.disconnect();
    });
  });

  describe('deduplication [AC5]', () => {
    it('skips self-originated operations echoed back', () => {
      const conn = createConnection();
      const ws = MockWebSocket.lastInstance!;

      ws.simulateOpen();
      ws.simulateMessage({ type: 'session-created', sessionId: 'sess-1' });

      // Add expression locally
      const expr = makeRectangle('rect-1');
      useCanvasStore.getState().addExpression(expr);

      const state = useCanvasStore.getState();
      const sentOp = state.operationLog[0]!;

      // Simulate the server echoing back our own operation
      ws.simulateMessage({ type: 'operation', operation: sentOp });

      // Expression should still exist (not duplicated or re-processed)
      const finalState = useCanvasStore.getState();
      expect(finalState.expressionOrder.filter((id) => id === 'rect-1')).toHaveLength(1);

      conn.disconnect();
    });

    it('prunes sent set when it exceeds 1000 IDs', () => {
      const conn = createConnection();
      const ws = MockWebSocket.lastInstance!;

      ws.simulateOpen();
      ws.simulateMessage({ type: 'session-created', sessionId: 'sess-1' });

      // Simulate adding many operations to fill the sent set
      for (let i = 0; i < 1050; i++) {
        const expr = makeRectangle(`rect-${i}`);
        useCanvasStore.getState().addExpression(expr);
      }

      // The connection should still work without errors
      // (sent set pruned to keep last 1000)
      expect(conn.connected).toBe(true);
      expect(conn.error).toBeNull();

      conn.disconnect();
    });
  });

  describe('reconnection [AC6]', () => {
    it('reconnects with exponential backoff on unexpected close', () => {
      const conn = createConnection();
      const ws1 = MockWebSocket.lastInstance!;

      ws1.simulateOpen();
      ws1.simulateMessage({ type: 'session-created', sessionId: 'sess-1' });

      // Unexpected close
      ws1.simulateClose(1006, 'Connection lost');

      expect(conn.connected).toBe(false);

      // After 1s — first reconnect attempt
      vi.advanceTimersByTime(1000);
      expect(MockWebSocket._instances).toHaveLength(2);

      const ws2 = MockWebSocket.lastInstance!;
      ws2.simulateClose(1006, 'Still down');

      // After 2s — second attempt
      vi.advanceTimersByTime(2000);
      expect(MockWebSocket._instances).toHaveLength(3);

      const ws3 = MockWebSocket.lastInstance!;
      ws3.simulateClose(1006, 'Still down');

      // After 4s — third attempt
      vi.advanceTimersByTime(4000);
      expect(MockWebSocket._instances).toHaveLength(4);

      const ws4 = MockWebSocket.lastInstance!;
      ws4.simulateClose(1006, 'Still down');

      // After 8s — fourth attempt
      vi.advanceTimersByTime(8000);
      expect(MockWebSocket._instances).toHaveLength(5);

      // Clean up
      conn.disconnect();
    });

    it('caps backoff at 30 seconds', () => {
      const conn = createConnection();
      const ws = MockWebSocket.lastInstance!;

      ws.simulateOpen();
      ws.simulateMessage({ type: 'session-created', sessionId: 'sess-1' });

      // Close and exhaust backoff: 1, 2, 4, 8, 16, 30, 30...
      for (let i = 0; i < 6; i++) {
        const lastWs = MockWebSocket.lastInstance!;
        lastWs.simulateClose(1006);
        // Advance enough time for next backoff
        vi.advanceTimersByTime(30_000);
      }

      const instanceCount = MockWebSocket._instances.length;

      // One more close
      MockWebSocket.lastInstance!.simulateClose(1006);
      // Should reconnect after max 30s, not longer
      vi.advanceTimersByTime(30_000);
      expect(MockWebSocket._instances.length).toBe(instanceCount + 1);

      conn.disconnect();
    });

    it('resets backoff on successful reconnection', () => {
      const conn = createConnection();
      let ws = MockWebSocket.lastInstance!;

      ws.simulateOpen();
      ws.simulateMessage({ type: 'session-created', sessionId: 'sess-1' });

      // First disconnect
      ws.simulateClose(1006);
      vi.advanceTimersByTime(1000);
      expect(MockWebSocket._instances).toHaveLength(2);

      // Successful reconnect
      ws = MockWebSocket.lastInstance!;
      ws.simulateOpen();
      ws.simulateMessage({ type: 'session-created', sessionId: 'sess-1' });

      // Second disconnect — backoff should be reset to 1s
      ws.simulateClose(1006);
      vi.advanceTimersByTime(1000);
      expect(MockWebSocket._instances).toHaveLength(3);

      conn.disconnect();
    });
  });

  describe('auth failure [AC7]', () => {
    it('stops retry on 4001 close code', () => {
      const conn = createConnection();
      const ws = MockWebSocket.lastInstance!;

      ws.simulateOpen();
      ws.simulateClose(4001, 'Unauthorized');

      expect(conn.error).toBe('Authentication failed');
      expect(conn.connected).toBe(false);

      // Advance time — should NOT reconnect
      vi.advanceTimersByTime(60_000);
      expect(MockWebSocket._instances).toHaveLength(1);

      conn.disconnect();
    });

    it('sets error string on error message', () => {
      const conn = createConnection();
      const ws = MockWebSocket.lastInstance!;

      ws.simulateOpen();
      ws.simulateMessage({
        type: 'error',
        code: 'INVALID_SESSION',
        message: 'Session not found',
      });

      expect(conn.error).toBe('Session not found');

      conn.disconnect();
    });
  });

  describe('agent tracking [AC8]', () => {
    it('adds agent on agent-joined message', () => {
      const conn = createConnection();
      const ws = MockWebSocket.lastInstance!;

      ws.simulateOpen();
      ws.simulateMessage({
        type: 'agent-joined',
        agent: { type: 'agent', id: 'agent-1', name: 'Claude', provider: 'anthropic' },
      });

      const state = useAgentStore.getState();
      expect(state.agents).toHaveLength(1);
      expect(state.agents[0]?.id).toBe('agent-1');

      conn.disconnect();
    });

    it('removes agent on agent-left message', () => {
      useAgentStore.getState().addAgent({
        type: 'agent',
        id: 'agent-1',
        name: 'Claude',
        provider: 'anthropic',
      });

      const conn = createConnection();
      const ws = MockWebSocket.lastInstance!;

      ws.simulateOpen();
      ws.simulateMessage({
        type: 'agent-left',
        agentId: 'agent-1',
      });

      const state = useAgentStore.getState();
      expect(state.agents).toHaveLength(0);

      conn.disconnect();
    });
  });

  describe('disconnect [AC10]', () => {
    it('cleanly closes connection and prevents reconnection', () => {
      const conn = createConnection();
      const ws = MockWebSocket.lastInstance!;

      ws.simulateOpen();
      ws.simulateMessage({ type: 'session-created', sessionId: 'sess-1' });

      expect(conn.connected).toBe(true);

      conn.disconnect();

      expect(conn.connected).toBe(false);

      // Advance time — should NOT reconnect
      vi.advanceTimersByTime(60_000);
      expect(MockWebSocket._instances).toHaveLength(1);
    });

    it('can be called multiple times safely', () => {
      const conn = createConnection();
      const ws = MockWebSocket.lastInstance!;

      ws.simulateOpen();

      conn.disconnect();
      conn.disconnect(); // Should not throw

      expect(conn.connected).toBe(false);
    });

    it('clears agents on disconnect', () => {
      const conn = createConnection();
      const ws = MockWebSocket.lastInstance!;

      ws.simulateOpen();
      ws.simulateMessage({
        type: 'agent-joined',
        agent: { type: 'agent', id: 'agent-1', name: 'Claude', provider: 'anthropic' },
      });

      expect(useAgentStore.getState().agents).toHaveLength(1);

      conn.disconnect();

      expect(useAgentStore.getState().agents).toHaveLength(0);
    });
  });
});
