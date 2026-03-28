/**
 * Gateway integration tests.
 *
 * Tests the full WebSocket gateway end-to-end: two real ws clients connect,
 * send messages, and verify the server correctly handles auth, validation,
 * session lifecycle, rate limiting, agent registry, and broadcasting.
 *
 * Test setup:
 * - Starts a real WebSocket server on a random port
 * - Uses real `ws` client connections
 * - Sets INFINICANVAS_API_KEY=test-key in the environment
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { createGateway } from '../server.js';
import type { ServerMessage } from '../types.js';

// ── Test Helpers ───────────────────────────────────────────

const TEST_API_KEY = 'test-key';
let port: number;
let gateway: ReturnType<typeof createGateway>;
/** Track all clients for cleanup. */
let openClients: WebSocket[];

/** Connect a ws client to the gateway. */
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

/** Send a JSON message to the server. */
function send(ws: WebSocket, message: unknown): void {
  ws.send(JSON.stringify(message));
}

/** Wait for the next message from the server. */
function waitForMessage(ws: WebSocket, timeoutMs = 2000): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for message')), timeoutMs);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()) as ServerMessage);
    });
  });
}

/** Wait for a WebSocket close event. */
function waitForClose(ws: WebSocket, timeoutMs = 2000): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for close')), timeoutMs);
    ws.on('close', (code, reason) => {
      clearTimeout(timer);
      resolve({ code, reason: reason.toString() });
    });
  });
}

/** Create a valid protocol operation for testing. */
function createTestOperation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'op-1',
    type: 'create',
    author: { type: 'human', id: 'user-1', name: 'Alice' },
    timestamp: Date.now(),
    payload: {
      type: 'create',
      expressionId: 'expr-1',
      kind: 'rectangle',
      position: { x: 100, y: 200 },
      size: { width: 50, height: 50 },
      data: {
        kind: 'rectangle',
      },
    },
    ...overrides,
  };
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
  // Use port 0 to get a random available port
  gateway = createGateway({ port: 0 });
  gateway.start();

  // Wait for server to be ready and extract the assigned port
  const addr = gateway.wss.address();
  if (typeof addr === 'object' && addr !== null) {
    port = addr.port;
  } else {
    // Server hasn't started yet — wait for the listening event
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
  // Close all tracked clients
  for (const client of openClients) {
    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      client.terminate();
    }
  }
  openClients = [];
  await gateway.stop();
});

// ── Tests ──────────────────────────────────────────────────

describe('Gateway Integration', () => {

  // ─────────────────────────────────────────────────────────
  // 1. Two clients connect, one sends operation → other receives it
  // ─────────────────────────────────────────────────────────
  describe('Operation Broadcasting', () => {
    it('broadcasts operations to other session clients', async () => {
      const client1 = await connectClient();
      const client2 = await connectClient();

      // Client 1 creates a session
      send(client1, { type: 'create-session', auth: { apiKey: TEST_API_KEY } });
      const created = await waitForMessage(client1);
      expect(created.type).toBe('session-created');
      if (created.type !== 'session-created') throw new Error('Expected session-created');
      const sessionId = created.sessionId;

      // Client 2 joins the session
      send(client2, { type: 'join', sessionId, auth: { apiKey: TEST_API_KEY } });
      const synced = await waitForMessage(client2);
      expect(synced.type).toBe('state-sync');

      // Collect client2 messages eagerly
      const client2Messages: ServerMessage[] = [];
      client2.on('message', (data) => {
        client2Messages.push(JSON.parse(data.toString()) as ServerMessage);
      });

      // Client 1 sends an operation
      const operation = createTestOperation();
      send(client1, { type: 'operation', operation });

      // Wait for broadcast to arrive
      await new Promise((r) => setTimeout(r, 200));

      // Client 2 should have received the broadcast
      expect(client2Messages.length).toBeGreaterThanOrEqual(1);
      const broadcast = client2Messages[0]!;
      expect(broadcast.type).toBe('operation');
      if (broadcast.type === 'operation') {
        expect(broadcast.operation.id).toBe('op-1');
        expect(broadcast.operation.payload.type).toBe('create');
      }

      // Client 1 should NOT receive its own operation back
      const noMessage = await waitForMessage(client1, 200).catch(() => null);
      expect(noMessage).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────
  // 2. Auth failure: invalid API key → connection closed 4001
  // ─────────────────────────────────────────────────────────
  describe('Authentication', () => {
    it('closes connection with 4001 for invalid API key on create-session', async () => {
      const client = await connectClient();
      const closePromise = waitForClose(client);

      send(client, { type: 'create-session', auth: { apiKey: 'wrong-key' } });

      const { code, reason } = await closePromise;
      expect(code).toBe(4001);
      expect(reason).toBe('Unauthorized');
    });

    it('closes connection with 4001 for missing API key', async () => {
      const client = await connectClient();
      const closePromise = waitForClose(client);

      send(client, { type: 'create-session', auth: { apiKey: '' } });

      const { code, reason } = await closePromise;
      expect(code).toBe(4001);
      expect(reason).toBe('Unauthorized');
    });

    it('closes connection with 4001 for invalid API key on join', async () => {
      const client1 = await connectClient();
      send(client1, { type: 'create-session', auth: { apiKey: TEST_API_KEY } });
      const created = await waitForMessage(client1);
      if (created.type !== 'session-created') throw new Error('Expected session-created');

      const client2 = await connectClient();
      const closePromise = waitForClose(client2);

      send(client2, { type: 'join', sessionId: created.sessionId, auth: { apiKey: 'bad' } });

      const { code } = await closePromise;
      expect(code).toBe(4001);

      client1.close();
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3. Validation failure: invalid operation → error, not broadcast
  // ─────────────────────────────────────────────────────────
  describe('Operation Validation', () => {
    it('returns error for invalid operation, does NOT broadcast', async () => {
      const client1 = await connectClient();
      const client2 = await connectClient();

      // Create and join session
      send(client1, { type: 'create-session', auth: { apiKey: TEST_API_KEY } });
      const created = await waitForMessage(client1);
      if (created.type !== 'session-created') throw new Error('Expected session-created');

      send(client2, { type: 'join', sessionId: created.sessionId, auth: { apiKey: TEST_API_KEY } });
      await waitForMessage(client2); // state-sync

      // Send invalid operation (missing required fields)
      send(client1, {
        type: 'operation',
        operation: { id: 'op-bad', type: 'create', author: 'not-an-object' },
      });

      // Client 1 should get error response
      const errorMsg = await waitForMessage(client1);
      expect(errorMsg.type).toBe('error');
      if (errorMsg.type === 'error') {
        expect(errorMsg.code).toBe('INVALID_OPERATION');
      }

      // Client 2 should NOT receive the invalid operation
      const noMessage = await waitForMessage(client2, 200).catch(() => null);
      expect(noMessage).toBeNull();

      client1.close();
      client2.close();
    });
  });

  // ─────────────────────────────────────────────────────────
  // 4. Session lifecycle: create → join → operation → leave → rejoin
  // ─────────────────────────────────────────────────────────
  describe('Session Lifecycle', () => {
    it('supports full create → join → operation → leave → rejoin cycle', async () => {
      const client1 = await connectClient();

      // Step 1: Create session
      send(client1, { type: 'create-session', auth: { apiKey: TEST_API_KEY } });
      const created = await waitForMessage(client1);
      expect(created.type).toBe('session-created');
      if (created.type !== 'session-created') throw new Error('Expected session-created');
      const sessionId = created.sessionId;

      // Step 2: Send an operation to add an expression
      const operation = createTestOperation();
      send(client1, { type: 'operation', operation });

      // Small delay for server to process
      await new Promise((r) => setTimeout(r, 50));

      // Step 3: Client 2 joins and gets state-sync with the expression
      const client2 = await connectClient();
      send(client2, { type: 'join', sessionId, auth: { apiKey: TEST_API_KEY } });
      const synced = await waitForMessage(client2);
      expect(synced.type).toBe('state-sync');
      if (synced.type === 'state-sync') {
        expect(synced.expressions.length).toBe(1);
        expect(synced.expressions[0]!.id).toBe('expr-1');
        expect(synced.expressionOrder).toEqual(['expr-1']);
      }

      // Step 4: Client 2 leaves
      send(client2, { type: 'leave' });
      await new Promise((r) => setTimeout(r, 50));

      // Step 5: Client 2 rejoins and still gets the state
      send(client2, { type: 'join', sessionId, auth: { apiKey: TEST_API_KEY } });
      const resynced = await waitForMessage(client2);
      expect(resynced.type).toBe('state-sync');
      if (resynced.type === 'state-sync') {
        expect(resynced.expressions.length).toBe(1);
      }

      client1.close();
      client2.close();
    });
  });

  // ─────────────────────────────────────────────────────────
  // 5. Rate limiting: burst 101 messages → last one gets RATE_LIMITED
  // ─────────────────────────────────────────────────────────
  describe('Rate Limiting', () => {
    it('rate-limits after 100 operations per second', async () => {
      const client = await connectClient();

      // Create session
      send(client, { type: 'create-session', auth: { apiKey: TEST_API_KEY } });
      await waitForMessage(client); // session-created

      // Send 101 operations rapidly
      const messages: ServerMessage[] = [];
      const messagePromise = new Promise<void>((resolve) => {
        client.on('message', (data) => {
          const msg = JSON.parse(data.toString()) as ServerMessage;
          messages.push(msg);
          // Look for rate-limited error
          if (msg.type === 'error' && msg.code === 'RATE_LIMITED') {
            resolve();
          }
        });
      });

      for (let i = 0; i < 101; i++) {
        const op = createTestOperation({
          id: `op-${i}`,
          payload: {
            type: 'create',
            expressionId: `expr-${i}`,
            kind: 'rectangle',
            position: { x: i, y: i },
            size: { width: 50, height: 50 },
            data: { kind: 'rectangle' },
          },
        });
        send(client, { type: 'operation', operation: op });
      }

      // Wait for the rate-limited error (with timeout)
      await Promise.race([
        messagePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('No RATE_LIMITED received')), 3000)),
      ]);

      const rateLimitedMsg = messages.find(
        (m) => m.type === 'error' && m.code === 'RATE_LIMITED',
      );
      expect(rateLimitedMsg).toBeDefined();

      client.close();
    });
  });

  // ─────────────────────────────────────────────────────────
  // 6. Agent registry: operation from agent → agent-joined broadcast
  // ─────────────────────────────────────────────────────────
  describe('Agent Registry', () => {
    it('broadcasts agent-joined when agent sends first operation', async () => {
      const humanClient = await connectClient();
      const agentClient = await connectClient();

      // Collect all messages for the human client eagerly.
      const humanMessages: ServerMessage[] = [];
      humanClient.on('message', (data) => {
        humanMessages.push(JSON.parse(data.toString()) as ServerMessage);
      });

      // Create session with human client
      send(humanClient, { type: 'create-session', auth: { apiKey: TEST_API_KEY } });
      await waitForMessage(humanClient); // session-created (already captured in humanMessages)

      // Agent joins the session
      send(agentClient, {
        type: 'join',
        sessionId: (humanMessages[0] as { sessionId: string }).sessionId,
        auth: { apiKey: TEST_API_KEY },
      });
      await waitForMessage(agentClient); // state-sync

      // Agent sends an operation
      const agentOp = createTestOperation({
        author: { type: 'agent', id: 'agent-1', name: 'TestBot', provider: 'openai' },
      });
      send(agentClient, { type: 'operation', operation: agentOp });

      // Wait for messages to arrive at human client
      await new Promise((r) => setTimeout(r, 200));

      // Human should have received: session-created, agent-joined, operation
      expect(humanMessages.length).toBeGreaterThanOrEqual(3);

      const agentJoinedMsg = humanMessages.find((m) => m.type === 'agent-joined');
      expect(agentJoinedMsg).toBeDefined();
      if (agentJoinedMsg && agentJoinedMsg.type === 'agent-joined') {
        expect(agentJoinedMsg.agent.id).toBe('agent-1');
        if (agentJoinedMsg.agent.type === 'agent') {
          expect(agentJoinedMsg.agent.name).toBe('TestBot');
          expect(agentJoinedMsg.agent.provider).toBe('openai');
        }
      }

      const opMsg = humanMessages.find((m) => m.type === 'operation');
      expect(opMsg).toBeDefined();

      // Sending another operation from the same agent should NOT trigger agent-joined again
      const prevCount = humanMessages.length;
      const agentOp2 = createTestOperation({
        id: 'op-2',
        author: { type: 'agent', id: 'agent-1', name: 'TestBot', provider: 'openai' },
        payload: {
          type: 'create',
          expressionId: 'expr-2',
          kind: 'rectangle',
          position: { x: 200, y: 200 },
          size: { width: 50, height: 50 },
          data: { kind: 'rectangle' },
        },
      });
      send(agentClient, { type: 'operation', operation: agentOp2 });

      await new Promise((r) => setTimeout(r, 200));

      // Should only have one more message (operation), NOT agent-joined again
      const newMessages = humanMessages.slice(prevCount);
      expect(newMessages.length).toBe(1);
      expect(newMessages[0]!.type).toBe('operation');
    });
  });

  // ─────────────────────────────────────────────────────────
  // 7. Message size limit: >1MB → error
  // ─────────────────────────────────────────────────────────
  describe('Message Size Limit', () => {
    it('rejects messages larger than 1MB', async () => {
      const client = await connectClient();

      // Create session
      send(client, { type: 'create-session', auth: { apiKey: TEST_API_KEY } });
      await waitForMessage(client); // session-created

      // Send an oversized message (>1MB)
      // ws library's maxPayload will close the connection
      const largePayload = 'x'.repeat(1024 * 1024 + 1);
      const closePromise = waitForClose(client, 3000);

      client.send(largePayload);

      // The connection should be closed by ws due to maxPayload
      const closeResult = await closePromise;
      expect(closeResult.code).toBeDefined();

      // Client should be disconnected
    });
  });

  // ─────────────────────────────────────────────────────────
  // 8. Non-existent session join → auto-creates session
  // ─────────────────────────────────────────────────────────
  describe('Auto-create Session on Join', () => {
    it('auto-creates session when joining with unknown session ID', async () => {
      const client = await connectClient();

      send(client, {
        type: 'join',
        sessionId: 'new-session-id',
        auth: { apiKey: TEST_API_KEY },
      });

      const msg = await waitForMessage(client);
      expect(msg.type).toBe('state-sync');
      if (msg.type === 'state-sync') {
        expect(msg.sessionId).toBe('new-session-id');
        expect(msg.expressions).toEqual([]);
      }

      client.close();
    });
  });

  // ─────────────────────────────────────────────────────────
  // Additional edge cases
  // ─────────────────────────────────────────────────────────
  describe('Edge Cases', () => {
    it('returns error when sending operation without joining a session', async () => {
      const client = await connectClient();

      const operation = createTestOperation();
      send(client, { type: 'operation', operation });

      const msg = await waitForMessage(client);
      expect(msg.type).toBe('error');
      if (msg.type === 'error') {
        expect(msg.code).toBe('NOT_IN_SESSION');
      }

      client.close();
    });

    it('returns error for invalid JSON', async () => {
      const client = await connectClient();

      client.send('not valid json {{{');

      const msg = await waitForMessage(client);
      expect(msg.type).toBe('error');
      if (msg.type === 'error') {
        expect(msg.code).toBe('INVALID_JSON');
      }

      client.close();
    });

    it('closes connection for binary frames', async () => {
      const client = await connectClient();

      const closePromise = waitForClose(client);
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      client.send(binaryData);

      const { code } = await closePromise;
      expect(code).toBe(1003);
    });

    it('handles client disconnect gracefully', async () => {
      const client = await connectClient();

      // Create session
      send(client, { type: 'create-session', auth: { apiKey: TEST_API_KEY } });
      await waitForMessage(client); // session-created

      // Abruptly terminate
      client.terminate();

      // Server should not crash — we just wait a bit
      await new Promise((r) => setTimeout(r, 100));

      // Verify server is still accepting connections
      const client2 = await connectClient();
      expect(client2.readyState).toBe(WebSocket.OPEN);
      client2.close();
    });

    it('state-sync returns expressions in correct order after multiple creates', async () => {
      const client1 = await connectClient();

      // Create session
      send(client1, { type: 'create-session', auth: { apiKey: TEST_API_KEY } });
      const created = await waitForMessage(client1);
      if (created.type !== 'session-created') throw new Error('Expected session-created');
      const sessionId = created.sessionId;

      // Create three expressions in order
      for (const eid of ['a', 'b', 'c']) {
        const op = createTestOperation({
          id: `op-${eid}`,
          payload: {
            type: 'create',
            expressionId: `expr-${eid}`,
            kind: 'rectangle',
            position: { x: 0, y: 0 },
            size: { width: 10, height: 10 },
            data: { kind: 'rectangle' },
          },
        });
        send(client1, { type: 'operation', operation: op });
      }

      await new Promise((r) => setTimeout(r, 100));

      // New client joins and gets state-sync
      const client2 = await connectClient();
      send(client2, { type: 'join', sessionId, auth: { apiKey: TEST_API_KEY } });
      const synced = await waitForMessage(client2);
      expect(synced.type).toBe('state-sync');
      if (synced.type === 'state-sync') {
        expect(synced.expressionOrder).toEqual(['expr-a', 'expr-b', 'expr-c']);
        expect(synced.expressions.length).toBe(3);
      }

      client1.close();
      client2.close();
    });
  });
});
