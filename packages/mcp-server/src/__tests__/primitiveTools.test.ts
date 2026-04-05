/**
 * Tests for primitive expression tools.
 *
 * Verifies that each primitive tool creates correct Excalidraw elements
 * and sends them to the gateway client via sendSceneUpdate.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IGatewayClient } from '../gatewayClient.js';
import {
  executeDrawRectangle,
  executeDrawEllipse,
  executeDrawLine,
  executeDrawArrow,
  executeDrawText,
  executeAddStickyNote,
} from '../tools/primitiveTools.js';

// ── Mock gateway client ────────────────────────────────────

function createMockClient(): IGatewayClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    getSessionId: vi.fn().mockReturnValue('test-session'),
    sendCreate: vi.fn().mockResolvedValue(undefined),
    sendDelete: vi.fn().mockResolvedValue(undefined),
    sendMorph: vi.fn().mockResolvedValue(undefined),
    sendStyle: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockReturnValue([]),
    sendSceneUpdate: vi.fn().mockResolvedValue(undefined),
    getExcalidrawElements: vi.fn().mockReturnValue([]),
  };
}

describe('executeDrawRectangle', () => {
  let client: IGatewayClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('sends scene update and returns confirmation', async () => {
    const result = await executeDrawRectangle(client, {
      x: 100, y: 200, width: 300, height: 150, label: 'Test',
    });

    expect(client.sendSceneUpdate).toHaveBeenCalledOnce();
    expect(client.sendCreate).not.toHaveBeenCalled();
    expect(result).toContain('Created rectangle');
    expect(result).toContain("'Test'");
    expect(result).toContain('300×150');
    expect(result).toMatch(/\[id: .+\]/);
  });

  it('omits label in message when not provided', async () => {
    const result = await executeDrawRectangle(client, {
      x: 0, y: 0, width: 100, height: 100,
    });

    expect(result).not.toContain("'");
    expect(result).toContain('Created rectangle');
  });
});

// ── Ellipse ────────────────────────────────────────────────

describe('executeDrawEllipse', () => {
  it('sends scene update and returns confirmation', async () => {
    const client = createMockClient();
    const result = await executeDrawEllipse(client, {
      x: 0, y: 0, width: 100, height: 100, label: 'O',
    });

    expect(client.sendSceneUpdate).toHaveBeenCalledOnce();
    expect(client.sendCreate).not.toHaveBeenCalled();
    expect(result).toContain('Created ellipse');
    expect(result).toContain("'O'");
  });
});

// ── Line ───────────────────────────────────────────────────

describe('executeDrawLine', () => {
  it('sends scene update and returns confirmation', async () => {
    const client = createMockClient();
    const result = await executeDrawLine(client, {
      points: [[0, 0], [100, 100]],
    });

    expect(client.sendSceneUpdate).toHaveBeenCalledOnce();
    expect(client.sendCreate).not.toHaveBeenCalled();
    expect(result).toContain('Created line');
    expect(result).toContain('2 points');
  });

  it('throws error for fewer than 2 points', async () => {
    const client = createMockClient();
    await expect(executeDrawLine(client, { points: [[0, 0]] })).rejects.toThrow('Line requires at least 2 points');
  });
});

// ── Arrow ──────────────────────────────────────────────────

describe('executeDrawArrow', () => {
  it('sends scene update and returns confirmation with label', async () => {
    const client = createMockClient();
    const result = await executeDrawArrow(client, {
      points: [[0, 0], [100, 0]],
      label: 'Next',
    });

    expect(client.sendSceneUpdate).toHaveBeenCalledOnce();
    expect(client.sendCreate).not.toHaveBeenCalled();
    expect(result).toContain('Created arrow');
    expect(result).toContain("'Next'");
  });

  it('throws error for fewer than 2 points', async () => {
    const client = createMockClient();
    await expect(executeDrawArrow(client, { points: [[0, 0]] })).rejects.toThrow('Arrow requires at least 2 points');
  });
});

// ── Text ───────────────────────────────────────────────────

describe('executeDrawText', () => {
  it('sends scene update and returns confirmation', async () => {
    const client = createMockClient();
    const result = await executeDrawText(client, {
      x: 10, y: 20, text: 'Hello World',
    });

    expect(client.sendSceneUpdate).toHaveBeenCalledOnce();
    expect(client.sendCreate).not.toHaveBeenCalled();
    expect(result).toContain('Created text');
    expect(result).toContain("'Hello World'");
  });

  it('truncates long text in confirmation message', async () => {
    const client = createMockClient();
    const longText = 'A'.repeat(60);
    const result = await executeDrawText(client, {
      x: 0, y: 0, text: longText,
    });

    expect(result).toContain('…');
    expect(result.length).toBeLessThan(longText.length + 100);
  });
});

// ── Sticky Note ────────────────────────────────────────────

describe('executeAddStickyNote', () => {
  it('sends scene update and returns confirmation', async () => {
    const client = createMockClient();
    const result = await executeAddStickyNote(client, {
      x: 50, y: 50, text: 'TODO: Fix bug',
    });

    expect(client.sendSceneUpdate).toHaveBeenCalledOnce();
    expect(client.sendCreate).not.toHaveBeenCalled();
    expect(result).toContain('Created sticky note');
    expect(result).toContain("'TODO: Fix bug'");
  });
});

// ── Cross-cutting concerns ─────────────────────────────────

describe('primitive tools cross-cutting', () => {
  it('each execute call produces a unique element ID in result', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const client = createMockClient();
      const result = await executeDrawRectangle(client, { x: 0, y: 0, width: 100, height: 100 });
      const match = result.match(/\[id: (.+)\]/);
      expect(match).toBeTruthy();
      ids.add(match![1]!);
    }
    expect(ids.size).toBe(10);
  });

  it('sends existing elements along with new elements', async () => {
    const existing = [{ id: 'existing-1', type: 'rectangle', x: 0, y: 0 }];
    const client = createMockClient();
    (client.getExcalidrawElements as ReturnType<typeof vi.fn>).mockReturnValue(existing);

    await executeDrawRectangle(client, { x: 100, y: 100, width: 50, height: 50 });

    const sentElements = (client.sendSceneUpdate as ReturnType<typeof vi.fn>).mock.calls[0]![0] as unknown[];
    expect(sentElements.length).toBeGreaterThan(1);
    expect(sentElements[0]).toEqual(existing[0]);
  });
});
