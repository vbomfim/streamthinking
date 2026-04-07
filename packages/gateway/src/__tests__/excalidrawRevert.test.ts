/**
 * Tests verifying the Excalidraw revert (Ticket #88).
 *
 * Ensures that:
 * 1. 'scene-update' message type is rejected as unknown
 * 2. state-sync response does not include excalidrawElements
 * 3. Session type does not have excalidrawElements field
 * 4. SessionManager.joinSession() return type has no excalidrawElements
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { createGateway } from '../server.js';
import type { ServerMessage, Session } from '../types.js';
import { SessionManager } from '../sessionManager.js';

// ── Test Helpers ───────────────────────────────────────────

const TEST_API_KEY = 'test-key';
let port: number;
let gateway: ReturnType<typeof createGateway>;
let openClients: WebSocket[];

function connectClient(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => {
      openClients.push(ws);
      resolve(ws);
    });
    ws.on('error', reject);
  });
}

function send(ws: WebSocket, message: unknown): void {
  ws.send(JSON.stringify(message));
}

function waitForMessage(ws: WebSocket, timeoutMs = 2000): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for message')), timeoutMs);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()) as ServerMessage);
    });
  });
}

// ── Setup / Teardown ───────────────────────────────────────

beforeAll(() => {
  process.env['INFINICANVAS_API_KEY'] = TEST_API_KEY;
});

afterAll(() => {
  delete process.env['INFINICANVAS_API_KEY'];
});

beforeEach(async () => {
  openClients = [];
  gateway = createGateway({ port: 0 });
  gateway.start();

  const addr = gateway.wss.address();
  if (typeof addr === 'object' && addr !== null) {
    port = addr.port;
  } else {
    await new Promise<void>((resolve) => {
      gateway.wss.on('listening', () => {
        const a = gateway.wss.address();
        if (typeof a === 'object' && a !== null) {
          port = a.port;
        }
        resolve();
      });
    });
  }
});

afterEach(async () => {
  for (const client of openClients) {
    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      client.terminate();
    }
  }
  openClients = [];
  await gateway.stop();
});

// ── Tests ──────────────────────────────────────────────────

describe('Excalidraw revert — Ticket #88', () => {
  it('rejects scene-update as unknown message type', async () => {
    const ws = await connectClient();

    // Join a session first
    send(ws, { type: 'join', sessionId: 'test-session', auth: { apiKey: TEST_API_KEY } });
    await waitForMessage(ws); // state-sync

    // Send a scene-update message — should be rejected
    send(ws, { type: 'scene-update', elements: [{ id: 'e1', type: 'rectangle' }] });
    const errorMsg = await waitForMessage(ws);

    expect(errorMsg.type).toBe('error');
    expect((errorMsg as { code: string }).code).toBe('UNKNOWN_MESSAGE_TYPE');
  });

  it('state-sync response does not include excalidrawElements', async () => {
    const ws = await connectClient();

    send(ws, { type: 'join', sessionId: 'test-session', auth: { apiKey: TEST_API_KEY } });
    const stateSync = await waitForMessage(ws);

    expect(stateSync.type).toBe('state-sync');
    // Verify excalidrawElements is NOT present in state-sync
    expect(stateSync).not.toHaveProperty('excalidrawElements');
  });

  it('Session type does not have excalidrawElements field', () => {
    const sessionManager = new SessionManager();
    sessionManager.createSessionWithId('type-test');
    const session = sessionManager.getSession('type-test');
    expect(session).toBeDefined();
    // Verify the session object has no excalidrawElements property
    expect(session).not.toHaveProperty('excalidrawElements');
  });

  it('joinSession return value has no excalidrawElements', () => {
    const sessionManager = new SessionManager();
    sessionManager.createSessionWithId('join-test');

    // Create a mock WebSocket-like object
    const mockWs = {
      readyState: 1,
      OPEN: 1,
    } as unknown as import('ws').WebSocket;

    const state = sessionManager.joinSession('join-test', mockWs);
    expect(state).toBeDefined();
    expect(state).not.toHaveProperty('excalidrawElements');
    expect(state).toHaveProperty('expressions');
    expect(state).toHaveProperty('expressionOrder');
    expect(state).toHaveProperty('agents');
    expect(state).toHaveProperty('waypoints');
  });

  it('gateway handles create/delete/update operations normally', async () => {
    const ws = await connectClient();

    send(ws, { type: 'join', sessionId: 'ops-test', auth: { apiKey: TEST_API_KEY } });
    await waitForMessage(ws); // state-sync

    // Send a create operation — should succeed (no error response)
    send(ws, {
      type: 'operation',
      operation: {
        id: 'op-1',
        type: 'create',
        author: { type: 'human', id: 'user-1', name: 'Alice' },
        timestamp: Date.now(),
        payload: {
          type: 'create',
          expressionId: 'expr-1',
          kind: 'rectangle',
          position: { x: 0, y: 0 },
          size: { width: 100, height: 50 },
          data: { kind: 'rectangle' },
        },
      },
    });

    // Connect a second client to verify broadcast
    const ws2 = await connectClient();
    send(ws2, { type: 'join', sessionId: 'ops-test', auth: { apiKey: TEST_API_KEY } });
    const stateSync2 = await waitForMessage(ws2);

    expect(stateSync2.type).toBe('state-sync');
    // The created expression should be in the state
    const syncMsg = stateSync2 as { expressions: unknown[] };
    expect(syncMsg.expressions.length).toBe(1);
  });
});
