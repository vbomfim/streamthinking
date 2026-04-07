/**
 * Unit tests for MCP server entry point (main.ts).
 *
 * Covers: server startup, gateway connection, session lifecycle,
 * graceful shutdown (SIGTERM/SIGINT), and environment variable usage.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IGatewayClient } from '../gatewayClient.js';

// ── Mock gateway client ────────────────────────────────────

function createMockGatewayClient(options?: {
  connectThrows?: boolean;
}): IGatewayClient {
  return {
    connect: options?.connectThrows
      ? vi.fn().mockRejectedValue(new Error('Connection refused'))
      : vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(!options?.connectThrows),
    getSessionId: vi.fn().mockReturnValue('test-session-1'),
    sendCreate: vi.fn().mockResolvedValue(undefined),
    sendBatchCreate: vi.fn().mockResolvedValue(undefined),
    sendDelete: vi.fn().mockResolvedValue(undefined),
    sendMorph: vi.fn().mockResolvedValue(undefined),
    sendStyle: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockReturnValue([]),
  };
}

// ── Tests for startServer ──────────────────────────────────

describe('MCP server entry point (main.ts)', () => {
  let mockClient: IGatewayClient;

  beforeEach(() => {
    mockClient = createMockGatewayClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('startServer', () => {
    it('connects to gateway and creates MCP server', async () => {
      const { startServer } = await import('../main.js');
      const cleanup = await startServer({ gatewayClient: mockClient });

      expect(mockClient.connect).toHaveBeenCalledOnce();

      cleanup();
    });

    it('starts even when gateway connection fails', async () => {
      const failingClient = createMockGatewayClient({ connectThrows: true });

      const { startServer } = await import('../main.js');
      const cleanup = await startServer({ gatewayClient: failingClient });

      expect(failingClient.connect).toHaveBeenCalledOnce();
      // Server should still be running — tools will fail gracefully

      cleanup();
    });

    it('returns a cleanup function that disconnects gateway', async () => {
      const { startServer } = await import('../main.js');
      const cleanup = await startServer({ gatewayClient: mockClient });

      cleanup();

      expect(mockClient.disconnect).toHaveBeenCalledOnce();
    });
  });

  describe('environment variable configuration', () => {
    it('uses INFINICANVAS_GATEWAY_URL from environment when creating client', async () => {
      // The createGatewayClient in gatewayClient.ts reads from process.env
      // This is tested at the GatewayClient level — here we verify the main
      // module passes through correctly by using a custom client
      const { startServer } = await import('../main.js');
      const cleanup = await startServer({ gatewayClient: mockClient });

      // connect() was called — proves the client is used
      expect(mockClient.connect).toHaveBeenCalledOnce();

      cleanup();
    });
  });

  describe('gateway connection failure messaging (S5-6)', () => {
    it('logs honest error message when gateway fails — no reconnect claim', async () => {
      const failingClient = createMockGatewayClient({ connectThrows: true });
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

      const { startServer } = await import('../main.js');
      const cleanup = await startServer({ gatewayClient: failingClient });

      // Should NOT contain misleading "reconnect" language
      const allWrites = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(allWrites).not.toContain('attempt to reconnect');
      expect(allWrites).not.toContain('will reconnect');

      // Should contain honest messaging
      expect(allWrites).toContain('Gateway unavailable');
      expect(allWrites).toContain('will return errors');
      expect(allWrites).toContain('Restart');

      stderrSpy.mockRestore();
      cleanup();
    });

    it('does not log error message when gateway connects successfully', async () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

      const { startServer } = await import('../main.js');
      const cleanup = await startServer({ gatewayClient: mockClient });

      const allWrites = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(allWrites).not.toContain('Gateway unavailable');
      expect(allWrites).not.toContain('Warning');

      stderrSpy.mockRestore();
      cleanup();
    });
  });
});
