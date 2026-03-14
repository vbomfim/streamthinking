/**
 * Authentication middleware for WebSocket connections.
 *
 * Validates API keys provided in create-session and join messages
 * against the `INFINICANVAS_API_KEY` environment variable.
 *
 * @module
 */

import type { WebSocket } from 'ws';
import { timingSafeEqual } from 'node:crypto';
import { log } from './logger.js';

/**
 * Validate the provided API key against the server's configured key.
 * Returns `true` if authentication succeeds.
 *
 * If invalid or missing, closes the WebSocket with code 4001 "Unauthorized"
 * and returns `false`.
 *
 * Uses constant-time comparison to prevent timing attacks.
 */
export function authenticate(ws: WebSocket, apiKey: string | undefined): boolean {
  const serverKey = process.env['INFINICANVAS_API_KEY'];

  if (!serverKey) {
    log('auth_no_server_key');
    ws.close(4001, 'Unauthorized');
    return false;
  }

  if (!apiKey || apiKey.length !== serverKey.length ||
      !timingSafeEqual(Buffer.from(apiKey), Buffer.from(serverKey))) {
    log('auth_failed');
    ws.close(4001, 'Unauthorized');
    return false;
  }

  return true;
}
