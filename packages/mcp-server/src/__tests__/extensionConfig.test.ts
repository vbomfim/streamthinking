/**
 * Unit tests for MCP extension configuration.
 *
 * Validates the .github/extensions/infinicanvas.mcp.json file has the
 * correct structure for Copilot CLI MCP extension registration.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Load extension config ──────────────────────────────────

const configPath = resolve(
  import.meta.dirname,
  '../../../../.github/extensions/infinicanvas.mcp.json',
);

let config: Record<string, unknown>;

try {
  const raw = readFileSync(configPath, 'utf-8');
  config = JSON.parse(raw) as Record<string, unknown>;
} catch {
  config = {};
}

// ── Tests ──────────────────────────────────────────────────

describe('MCP extension configuration', () => {
  it('is valid JSON', () => {
    const raw = readFileSync(configPath, 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('uses stdio transport type', () => {
    // The config should define an MCP server with stdio transport
    const servers = config['mcpServers'] as Record<string, Record<string, unknown>> | undefined;
    expect(servers).toBeDefined();

    const serverNames = Object.keys(servers!);
    expect(serverNames.length).toBeGreaterThanOrEqual(1);

    const server = servers![serverNames[0]!]!;
    expect(server['type']).toBe('stdio');
  });

  it('points to correct server entry via tsx', () => {
    const servers = config['mcpServers'] as Record<string, Record<string, unknown>>;
    const server = Object.values(servers)[0]!;

    // Command should use tsx to run the entry point
    const command = server['command'] as string;
    const args = server['args'] as string[];

    expect(command).toBe('npx');
    expect(args).toContain('tsx');
    // Should reference the main.ts entry point
    const mainArg = args.find((a: string) => a.includes('main.ts'));
    expect(mainArg).toBeDefined();
  });

  it('declares environment variables without hardcoded values', () => {
    const servers = config['mcpServers'] as Record<string, Record<string, unknown>>;
    const server = Object.values(servers)[0]!;
    const env = server['env'] as Record<string, string> | undefined;

    expect(env).toBeDefined();
    // Should reference GATEWAY_URL and API_KEY env vars
    expect(env!['INFINICANVAS_GATEWAY_URL']).toBeDefined();
    expect(env!['INFINICANVAS_API_KEY']).toBeDefined();

    // Values should NOT be hardcoded secrets — they should be env var references
    const apiKeyValue = env!['INFINICANVAS_API_KEY']!;
    expect(apiKeyValue).not.toMatch(/^[a-zA-Z0-9]{16,}$/); // Not a real key
  });

  it('has server name "infinicanvas"', () => {
    const servers = config['mcpServers'] as Record<string, Record<string, unknown>>;
    expect(servers['infinicanvas']).toBeDefined();
  });
});
