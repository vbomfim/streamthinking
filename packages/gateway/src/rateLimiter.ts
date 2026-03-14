/**
 * Rate limiter for WebSocket clients.
 *
 * Uses a fixed-window counter to enforce a maximum number of
 * operations per second per client connection. Note: boundary bursts
 * are possible (up to 2x rate at window edges). A sliding-window or
 * token-bucket implementation is planned for V2.
 *
 * @module
 */

import type { WebSocket } from 'ws';

/** Default maximum operations per second per client. */
const DEFAULT_MAX_OPS_PER_SECOND = 100;

interface ClientWindow {
  /** Timestamp (ms) when the current window started. */
  windowStart: number;
  /** Number of operations in the current window. */
  count: number;
}

export class RateLimiter {
  private readonly maxOpsPerSecond: number;
  private readonly clients = new Map<WebSocket, ClientWindow>();

  constructor(maxOpsPerSecond = DEFAULT_MAX_OPS_PER_SECOND) {
    this.maxOpsPerSecond = maxOpsPerSecond;
  }

  /**
   * Check whether a client is allowed to send another operation.
   * Returns `true` if the operation is allowed, `false` if rate-limited.
   */
  allow(ws: WebSocket): boolean {
    const now = Date.now();
    let window = this.clients.get(ws);

    if (!window || now - window.windowStart >= 1000) {
      // Start a new 1-second window.
      window = { windowStart: now, count: 0 };
      this.clients.set(ws, window);
    }

    window.count++;
    return window.count <= this.maxOpsPerSecond;
  }

  /** Remove tracking for a disconnected client. */
  remove(ws: WebSocket): void {
    this.clients.delete(ws);
  }
}
