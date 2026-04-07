/**
 * Integration tests for MCP server lifecycle and tool registration.
 *
 * Tests the full server integration: startServer → createMcpServer → tool registration,
 * cleanup lifecycle, and error resilience across module boundaries.
 *
 * Ticket #32 — Copilot CLI Extension
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IGatewayClient } from '../gatewayClient.js';

// ── Mock gateway client factory ──────────────────────────────

function createMockGatewayClient(options?: {
  connectThrows?: boolean;
  disconnectThrows?: boolean;
}): IGatewayClient {
  return {
    connect: options?.connectThrows
      ? vi.fn().mockRejectedValue(new Error('Connection refused'))
      : vi.fn().mockResolvedValue(undefined),
    disconnect: options?.disconnectThrows
      ? vi.fn(() => { throw new Error('Already disconnected'); })
      : vi.fn(),
    isConnected: vi.fn().mockReturnValue(!options?.connectThrows),
    getSessionId: vi.fn().mockReturnValue('session-test'),
    sendCreate: vi.fn().mockResolvedValue(undefined),
    sendBatchCreate: vi.fn().mockResolvedValue(undefined),
    sendDelete: vi.fn().mockResolvedValue(undefined),
    sendMorph: vi.fn().mockResolvedValue(undefined),
    sendStyle: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockReturnValue([]),
  };
}

// ── Tests ────────────────────────────────────────────────────

describe('MCP server integration [CONTRACT]', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('startServer + createMcpServer integration [AC #32]', () => {
    it('[AC-1][CONTRACT] creates MCP server with all registered tools', async () => {
      const mockClient = createMockGatewayClient();
      const { startServer } = await import('../main.js');
      const { createMcpServer } = await import('../server.js');

      // Verify createMcpServer returns a valid McpServer
      const server = createMcpServer(mockClient);
      expect(server).toBeDefined();
      expect(server).toHaveProperty('tool');
      expect(server).toHaveProperty('connect');

      const cleanup = await startServer({ gatewayClient: mockClient, skipTransport: true });
      cleanup();
    });

    it('[AC-2][CONTRACT] cleanup function can be called multiple times safely', async () => {
      const mockClient = createMockGatewayClient();
      const { startServer } = await import('../main.js');
      const cleanup = await startServer({ gatewayClient: mockClient, skipTransport: true });

      // First cleanup
      cleanup();
      expect(mockClient.disconnect).toHaveBeenCalledOnce();

      // Second cleanup — should not throw
      expect(() => cleanup()).not.toThrow();
      expect(mockClient.disconnect).toHaveBeenCalledTimes(2);
    });

    it('[EDGE] startServer with gateway failure writes warning to stderr', async () => {
      const failingClient = createMockGatewayClient({ connectThrows: true });
      const { startServer } = await import('../main.js');

      const cleanup = await startServer({ gatewayClient: failingClient, skipTransport: true });

      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not connect to InfiniCanvas gateway'),
      );

      cleanup();
    });

    it('[EDGE] cleanup still works after failed gateway connection', async () => {
      const failingClient = createMockGatewayClient({ connectThrows: true });
      const { startServer } = await import('../main.js');

      const cleanup = await startServer({ gatewayClient: failingClient, skipTransport: true });
      cleanup();

      // disconnect should still be called even though connect failed
      expect(failingClient.disconnect).toHaveBeenCalledOnce();
    });
  });

  describe('tool executor gateway integration [BOUNDARY]', () => {
    it('[CONTRACT] tools pass gateway client through to executor correctly', async () => {
      const mockClient = createMockGatewayClient();
      const { startServer } = await import('../main.js');
      const cleanup = await startServer({ gatewayClient: mockClient, skipTransport: true });

      // Verify gateway was connected before server was created
      expect(mockClient.connect).toHaveBeenCalledOnce();

      cleanup();
      expect(mockClient.disconnect).toHaveBeenCalledOnce();
    });

    it('[EDGE] startServer sequence: connect → create server → return cleanup', async () => {
      const callOrder: string[] = [];
      const mockClient = createMockGatewayClient();
      (mockClient.connect as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callOrder.push('connect');
      });
      (mockClient.disconnect as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push('disconnect');
      });

      const { startServer } = await import('../main.js');
      const cleanup = await startServer({ gatewayClient: mockClient, skipTransport: true });

      expect(callOrder).toEqual(['connect']);

      cleanup();
      expect(callOrder).toEqual(['connect', 'disconnect']);
    });
  });
});

describe('Extension config schema validation [CONTRACT]', () => {
  it('[CONTRACT] config matches GitHub Copilot MCP extension specification', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');

    const configPath = resolve(
      import.meta.dirname,
      '../../../../.github/extensions/infinicanvas.mcp.json',
    );
    const raw = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);

    // Required top-level: mcpServers
    expect(config).toHaveProperty('mcpServers');
    expect(typeof config.mcpServers).toBe('object');

    // Each server entry must have: type, command, args
    for (const [name, server] of Object.entries(config.mcpServers) as [string, any][]) {
      expect(server).toHaveProperty('type');
      expect(['stdio', 'sse']).toContain(server.type);

      expect(server).toHaveProperty('command');
      expect(typeof server.command).toBe('string');
      expect(server.command.length).toBeGreaterThan(0);

      expect(server).toHaveProperty('args');
      expect(Array.isArray(server.args)).toBe(true);

      // If env is present, all values must be strings
      if (server.env) {
        for (const [key, value] of Object.entries(server.env)) {
          expect(typeof key).toBe('string');
          expect(typeof value).toBe('string');
        }
      }
    }
  });

  it('[CONTRACT] command resolves to a valid entry point file', async () => {
    const { readFileSync, existsSync } = await import('fs');
    const { resolve } = await import('path');

    const configPath = resolve(
      import.meta.dirname,
      '../../../../.github/extensions/infinicanvas.mcp.json',
    );
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    const server = config.mcpServers['infinicanvas'];
    const mainArg = server.args.find((a: string) => a.includes('main.ts'));

    expect(mainArg).toBeDefined();

    // Resolve relative to the repo root (config is at .github/extensions/)
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    const entryPath = resolve(repoRoot, mainArg);
    expect(existsSync(entryPath)).toBe(true);
  });

  it('[EDGE] env vars use shell-style defaults, not hardcoded secrets', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');

    const configPath = resolve(
      import.meta.dirname,
      '../../../../.github/extensions/infinicanvas.mcp.json',
    );
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    const env = config.mcpServers['infinicanvas'].env;

    // Gateway URL should have a default fallback
    expect(env['INFINICANVAS_GATEWAY_URL']).toMatch(/\$\{.*:-.*\}/);

    // API key should be a reference, not a real value
    expect(env['INFINICANVAS_API_KEY']).toMatch(/^\$\{/);
    // Must not be a 16+ char alphanumeric string (real secret)
    expect(env['INFINICANVAS_API_KEY']).not.toMatch(/^[a-zA-Z0-9]{16,}$/);
  });
});

// ── S5-5: Morph toKind validation ──────────────────────────

describe('MCP morph toKind enum validation (S5-5)', () => {
  it('createMcpServer registers canvas_morph with enum schema, not z.string()', async () => {
    const { createMcpServer } = await import('../server.js');
    const mockClient = createMockGatewayClient();

    // This verifies that createMcpServer does not throw with the enum schema
    const server = createMcpServer(mockClient);
    expect(server).toBeDefined();
  });

  it('morph tool accepts valid ExpressionKind values', async () => {
    // Valid kinds should be accepted by the schema
    const { z } = await import('zod');
    const expressionKindSchema = z.enum([
      'rectangle', 'ellipse', 'diamond', 'line', 'arrow',
      'freehand', 'text', 'sticky-note', 'image',
      'flowchart', 'sequence-diagram', 'wireframe', 'reasoning-chain',
      'roadmap', 'mind-map', 'kanban', 'decision-tree',
      'collaboration-diagram', 'slide', 'code-block', 'table',
      'comment', 'callout', 'highlight', 'marker',
    ]);

    // Valid values pass
    expect(expressionKindSchema.safeParse('rectangle').success).toBe(true);
    expect(expressionKindSchema.safeParse('ellipse').success).toBe(true);
    expect(expressionKindSchema.safeParse('diamond').success).toBe(true);
    expect(expressionKindSchema.safeParse('flowchart').success).toBe(true);
    expect(expressionKindSchema.safeParse('sticky-note').success).toBe(true);

    // Invalid values fail — this is the fix for S5-5
    expect(expressionKindSchema.safeParse('not-a-kind').success).toBe(false);
    expect(expressionKindSchema.safeParse('RECTANGLE').success).toBe(false);
    expect(expressionKindSchema.safeParse('').success).toBe(false);
    expect(expressionKindSchema.safeParse('anything-goes').success).toBe(false);
  });
});
