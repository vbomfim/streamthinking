/**
 * MCP server entry point — wires gateway client, MCP server, and transport.
 *
 * Creates the MCP server, connects to the gateway (URL from env var,
 * default ws://localhost:8080), and starts the stdio transport for
 * Copilot CLI integration.
 *
 * Environment variables:
 * - INFINICANVAS_GATEWAY_URL — Gateway WebSocket URL (default: ws://localhost:8080)
 * - INFINICANVAS_API_KEY — API key for gateway authentication
 * - INFINICANVAS_SESSION_ID — Existing session to join (creates new if omitted)
 *
 * @module
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server.js';
import { createGatewayClient, type IGatewayClient } from './gatewayClient.js';

/** Options for starting the MCP server programmatically. */
export interface StartServerOptions {
  /** Custom gateway client (for testing). Uses createGatewayClient() if omitted. */
  gatewayClient?: IGatewayClient;
  /** Skip stdio transport connection (for testing). */
  skipTransport?: boolean;
}

/**
 * Start the MCP server with gateway connection and stdio transport.
 *
 * Returns a cleanup function that disconnects from the gateway.
 * The cleanup function should be called on process shutdown.
 */
export async function startServer(
  options: StartServerOptions = {},
): Promise<() => void> {
  const gatewayClient = options.gatewayClient ?? createGatewayClient();

  // Connect to gateway (optional — tools will fail gracefully if not connected)
  try {
    await gatewayClient.connect();
  } catch {
    // Gateway may not be running yet — tools will report connection errors
    // The MCP server itself can still start and list tools
    process.stderr.write(
      'Warning: Could not connect to InfiniCanvas gateway. ' +
      'Tools will attempt to reconnect. Set INFINICANVAS_GATEWAY_URL and INFINICANVAS_API_KEY.\n',
    );
  }

  const server = createMcpServer(gatewayClient);

  // Connect stdio transport unless testing
  if (!options.skipTransport) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }

  /** Cleanup function — disconnects gateway and prepares for shutdown. */
  const cleanup = () => {
    gatewayClient.disconnect();
  };

  return cleanup;
}

// ── CLI entry point ────────────────────────────────────────

/**
 * When run directly (not imported), start the server with stdio transport
 * and register signal handlers for graceful shutdown.
 */
async function main(): Promise<void> {
  const cleanup = await startServer();

  // Graceful shutdown
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
}

// Only run main() when executed directly, not when imported for testing
const isDirectExecution = process.argv[1]?.endsWith('main.ts') ||
  process.argv[1]?.endsWith('main.js');

if (isDirectExecution) {
  main().catch((err: unknown) => {
    process.stderr.write(
      `MCP Server fatal error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}
