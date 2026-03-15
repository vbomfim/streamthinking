/**
 * Unit tests for MCP GatewayClient.
 *
 * Covers: remote create operations (R2), JSON.parse error handling (R6),
 * and style/angle in CreatePayload (R3).
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GatewayClient } from '../gatewayClient.js';
import type { ProtocolOperation, VisualExpression } from '@infinicanvas/protocol';

// ── Mock WebSocket ──────────────────────────────────────────

type MessageCallback = (raw: { toString(): string }) => void;
type ErrorCallback = (err: Error) => void;
type OpenCallback = () => void;

class MockWS {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  readyState = MockWS.OPEN;
  private handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  sentMessages: string[] = [];

  on(event: string, cb: (...args: unknown[]) => void): void {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event]!.push(cb);
  }

  removeListener(_event: string, _cb: unknown): void {
    // No-op for tests
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = MockWS.CLOSED;
  }

  // Test helpers

  simulateOpen(): void {
    this.readyState = MockWS.OPEN;
    const openHandlers = this.handlers['open'] ?? [];
    for (const cb of openHandlers) (cb as OpenCallback)();
  }

  simulateMessage(data: unknown): void {
    const messageHandlers = this.handlers['message'] ?? [];
    const raw = { toString: () => JSON.stringify(data) };
    for (const cb of messageHandlers) (cb as MessageCallback)(raw);
  }

  simulateRawMessage(rawStr: string): void {
    const messageHandlers = this.handlers['message'] ?? [];
    const raw = { toString: () => rawStr };
    for (const cb of messageHandlers) (cb as MessageCallback)(raw);
  }

  simulateError(err: Error): void {
    const errorHandlers = this.handlers['error'] ?? [];
    for (const cb of errorHandlers) (cb as ErrorCallback)(err);
  }
}

// ── Test setup ──────────────────────────────────────────────

let mockWs: MockWS;

// Patch WebSocket constructor
vi.mock('ws', () => {
  return {
    default: class {
      constructor() {
        return mockWs;
      }
      static OPEN = 1;
      static CLOSED = 3;
    },
  };
});

beforeEach(() => {
  mockWs = new MockWS();
});

// ── R2: Remote create operation handling ─────────────────────

describe('GatewayClient remote operations (R2)', () => {
  it('reconstructs expression from remote create and adds to state', async () => {
    const client = new GatewayClient({ url: 'ws://localhost:8080' });
    const connectPromise = client.connect();

    // Simulate connection established
    mockWs.simulateOpen();
    mockWs.simulateMessage({
      type: 'session-created',
      sessionId: 'sess-1',
    });

    await connectPromise;

    // Simulate remote create operation
    const remoteOp: ProtocolOperation = {
      id: 'remote-op-1',
      type: 'create',
      author: { type: 'human', id: 'user-2', name: 'Bob' },
      timestamp: Date.now(),
      payload: {
        type: 'create',
        expressionId: 'remote-rect-1',
        kind: 'rectangle',
        position: { x: 50, y: 100 },
        size: { width: 200, height: 150 },
        data: { kind: 'rectangle', label: 'Remote Box' },
      },
    };

    mockWs.simulateMessage({ type: 'operation', operation: remoteOp });

    // Verify expression appears in getState()
    const state = client.getState();
    expect(state).toHaveLength(1);
    expect(state[0]!.id).toBe('remote-rect-1');
    expect(state[0]!.kind).toBe('rectangle');
    expect(state[0]!.position).toEqual({ x: 50, y: 100 });
    expect(state[0]!.size).toEqual({ width: 200, height: 150 });
    expect(state[0]!.meta.author.id).toBe('user-2');

    client.disconnect();
  });

  it('does not duplicate expression if remote create is for existing ID', async () => {
    const client = new GatewayClient({ url: 'ws://localhost:8080' });
    const connectPromise = client.connect();

    mockWs.simulateOpen();
    mockWs.simulateMessage({
      type: 'session-created',
      sessionId: 'sess-1',
    });

    await connectPromise;

    // Create an expression locally
    const localExpr: VisualExpression = {
      id: 'expr-1',
      kind: 'rectangle',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
      angle: 0,
      style: {
        strokeColor: '#000000',
        backgroundColor: 'transparent',
        fillStyle: 'none',
        strokeWidth: 2,
        roughness: 1,
        opacity: 1,
      },
      meta: {
        author: { type: 'agent', id: 'mcp', name: 'MCP', provider: 'mcp' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        locked: false,
      },
      data: { kind: 'rectangle' },
    };
    await client.sendCreate(localExpr);

    // Simulate remote create for same ID
    const remoteOp: ProtocolOperation = {
      id: 'remote-op-dup',
      type: 'create',
      author: { type: 'human', id: 'user-2', name: 'Bob' },
      timestamp: Date.now(),
      payload: {
        type: 'create',
        expressionId: 'expr-1',
        kind: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        data: { kind: 'rectangle' },
      },
    };

    mockWs.simulateMessage({ type: 'operation', operation: remoteOp });

    // Should still have only 1 expression
    expect(client.getState()).toHaveLength(1);

    client.disconnect();
  });

  it('uses style and angle from CreatePayload when present (R3)', async () => {
    const client = new GatewayClient({ url: 'ws://localhost:8080' });
    const connectPromise = client.connect();

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'session-created', sessionId: 'sess-1' });
    await connectPromise;

    const customStyle = {
      strokeColor: '#ff0000',
      backgroundColor: '#00ff00',
      fillStyle: 'solid' as const,
      strokeWidth: 5,
      roughness: 0,
      opacity: 0.7,
    };

    const remoteOp: ProtocolOperation = {
      id: 'remote-op-styled',
      type: 'create',
      author: { type: 'human', id: 'user-2', name: 'Bob' },
      timestamp: Date.now(),
      payload: {
        type: 'create',
        expressionId: 'styled-rect',
        kind: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        data: { kind: 'rectangle' },
        style: customStyle,
        angle: 45,
      },
    };

    mockWs.simulateMessage({ type: 'operation', operation: remoteOp });

    const state = client.getState();
    expect(state[0]!.style).toEqual(customStyle);
    expect(state[0]!.angle).toBe(45);

    client.disconnect();
  });
});

// ── R6: JSON.parse error handling ────────────────────────────

describe('GatewayClient JSON.parse safety (R6)', () => {
  it('does not crash on malformed WebSocket message', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const client = new GatewayClient({ url: 'ws://localhost:8080' });
    const connectPromise = client.connect();

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'session-created', sessionId: 'sess-1' });
    await connectPromise;

    // Send malformed (non-JSON) message — should not throw
    expect(() => {
      mockWs.simulateRawMessage('this is not valid JSON{{{');
    }).not.toThrow();

    // Client should still be connected
    expect(client.isConnected()).toBe(true);

    warnSpy.mockRestore();
    client.disconnect();
  });

  it('logs warning on malformed message', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const client = new GatewayClient({ url: 'ws://localhost:8080' });
    const connectPromise = client.connect();

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'session-created', sessionId: 'sess-1' });
    await connectPromise;

    mockWs.simulateRawMessage('invalid json');

    expect(warnSpy).toHaveBeenCalledWith(
      '[GatewayClient] Malformed WebSocket message, ignoring',
    );

    warnSpy.mockRestore();
    client.disconnect();
  });

  it('continues processing valid messages after malformed one', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const client = new GatewayClient({ url: 'ws://localhost:8080' });
    const connectPromise = client.connect();

    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'session-created', sessionId: 'sess-1' });
    await connectPromise;

    // Send malformed, then valid
    mockWs.simulateRawMessage('broken');
    mockWs.simulateMessage({
      type: 'operation',
      operation: {
        id: 'op-1',
        type: 'create',
        author: { type: 'human', id: 'u1', name: 'Test' },
        timestamp: Date.now(),
        payload: {
          type: 'create',
          expressionId: 'expr-after',
          kind: 'rectangle',
          position: { x: 0, y: 0 },
          size: { width: 50, height: 50 },
          data: { kind: 'rectangle' },
        },
      },
    });

    // The valid message should have been processed
    expect(client.getState()).toHaveLength(1);
    expect(client.getState()[0]!.id).toBe('expr-after');

    warnSpy.mockRestore();
    client.disconnect();
  });
});

// ── I2-1: Remote update/move/transform/style/morph handlers ──

describe('GatewayClient remote operation handlers (I2-1)', () => {
  /** Helper: connect client, create session, seed one expression. */
  async function seedClient(): Promise<{
    client: InstanceType<typeof GatewayClient>;
  }> {
    const client = new GatewayClient({ url: 'ws://localhost:8080' });
    const p = client.connect();
    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'session-created', sessionId: 'sess-1' });
    await p;

    // Seed an expression via remote create
    mockWs.simulateMessage({
      type: 'operation',
      operation: {
        id: 'seed-op',
        type: 'create',
        author: { type: 'human', id: 'u1', name: 'Test' },
        timestamp: Date.now(),
        payload: {
          type: 'create',
          expressionId: 'expr-1',
          kind: 'rectangle',
          position: { x: 10, y: 20 },
          size: { width: 100, height: 50 },
          data: { kind: 'rectangle', label: 'Box' },
        },
      },
    });
    return { client };
  }

  it('applies remote update operation', async () => {
    const { client } = await seedClient();

    mockWs.simulateMessage({
      type: 'operation',
      operation: {
        id: 'update-op',
        type: 'update',
        author: { type: 'human', id: 'u2', name: 'Bob' },
        timestamp: Date.now(),
        payload: {
          type: 'update',
          expressionId: 'expr-1',
          changes: {
            position: { x: 200, y: 300 },
            size: { width: 400, height: 250 },
          },
        },
      },
    });

    const expr = client.getState().find((e) => e.id === 'expr-1');
    expect(expr!.position).toEqual({ x: 200, y: 300 });
    expect(expr!.size).toEqual({ width: 400, height: 250 });
    client.disconnect();
  });

  it('applies remote move operation', async () => {
    const { client } = await seedClient();

    mockWs.simulateMessage({
      type: 'operation',
      operation: {
        id: 'move-op',
        type: 'move',
        author: { type: 'human', id: 'u2', name: 'Bob' },
        timestamp: Date.now(),
        payload: {
          type: 'move',
          expressionId: 'expr-1',
          from: { x: 10, y: 20 },
          to: { x: 500, y: 600 },
        },
      },
    });

    const expr = client.getState().find((e) => e.id === 'expr-1');
    expect(expr!.position).toEqual({ x: 500, y: 600 });
    client.disconnect();
  });

  it('applies remote transform operation', async () => {
    const { client } = await seedClient();

    mockWs.simulateMessage({
      type: 'operation',
      operation: {
        id: 'transform-op',
        type: 'transform',
        author: { type: 'human', id: 'u2', name: 'Bob' },
        timestamp: Date.now(),
        payload: {
          type: 'transform',
          expressionId: 'expr-1',
          angle: 90,
          size: { width: 300, height: 200 },
        },
      },
    });

    const expr = client.getState().find((e) => e.id === 'expr-1');
    expect(expr!.angle).toBe(90);
    expect(expr!.size).toEqual({ width: 300, height: 200 });
    client.disconnect();
  });

  it('applies remote style operation', async () => {
    const { client } = await seedClient();

    mockWs.simulateMessage({
      type: 'operation',
      operation: {
        id: 'style-op',
        type: 'style',
        author: { type: 'human', id: 'u2', name: 'Bob' },
        timestamp: Date.now(),
        payload: {
          type: 'style',
          expressionIds: ['expr-1'],
          style: { strokeColor: '#ff0000', opacity: 0.5 },
        },
      },
    });

    const expr = client.getState().find((e) => e.id === 'expr-1');
    expect(expr!.style.strokeColor).toBe('#ff0000');
    expect(expr!.style.opacity).toBe(0.5);
    client.disconnect();
  });

  it('applies remote morph operation', async () => {
    const { client } = await seedClient();

    mockWs.simulateMessage({
      type: 'operation',
      operation: {
        id: 'morph-op',
        type: 'morph',
        author: { type: 'human', id: 'u2', name: 'Bob' },
        timestamp: Date.now(),
        payload: {
          type: 'morph',
          expressionId: 'expr-1',
          fromKind: 'rectangle',
          toKind: 'ellipse',
          newData: { kind: 'ellipse', label: 'Morphed' },
        },
      },
    });

    const expr = client.getState().find((e) => e.id === 'expr-1');
    expect(expr!.kind).toBe('ellipse');
    expect(expr!.data).toEqual({ kind: 'ellipse', label: 'Morphed' });
    client.disconnect();
  });

  it('ignores update for nonexistent expression', async () => {
    const { client } = await seedClient();

    mockWs.simulateMessage({
      type: 'operation',
      operation: {
        id: 'update-ghost',
        type: 'update',
        author: { type: 'human', id: 'u2', name: 'Bob' },
        timestamp: Date.now(),
        payload: {
          type: 'update',
          expressionId: 'nonexistent',
          changes: { position: { x: 999, y: 999 } },
        },
      },
    });

    // Original expression untouched
    const expr = client.getState().find((e) => e.id === 'expr-1');
    expect(expr!.position).toEqual({ x: 10, y: 20 });
    client.disconnect();
  });
});

// ── I2-2: Default style consistency ──────────────────────────

describe('GatewayClient default style uses canonical values (I2-2)', () => {
  it('remote create without style uses DEFAULT_EXPRESSION_STYLE', async () => {
    const client = new GatewayClient({ url: 'ws://localhost:8080' });
    const p = client.connect();
    mockWs.simulateOpen();
    mockWs.simulateMessage({ type: 'session-created', sessionId: 'sess-1' });
    await p;

    mockWs.simulateMessage({
      type: 'operation',
      operation: {
        id: 'op-default',
        type: 'create',
        author: { type: 'human', id: 'u1', name: 'Test' },
        timestamp: Date.now(),
        payload: {
          type: 'create',
          expressionId: 'default-expr',
          kind: 'rectangle',
          position: { x: 0, y: 0 },
          size: { width: 100, height: 100 },
          data: { kind: 'rectangle' },
        },
      },
    });

    const expr = client.getState()[0]!;
    expect(expr.style.strokeColor).toBe('#1e1e1e');
    expect(expr.style.fillStyle).toBe('hachure');
    expect(expr.style.roughness).toBe(1);
    expect(expr.style.backgroundColor).toBe('transparent');
    expect(expr.style.strokeWidth).toBe(2);
    expect(expr.style.opacity).toBe(1);

    client.disconnect();
  });
});
