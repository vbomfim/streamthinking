/**
 * Session manager for the gateway.
 *
 * Manages collaborative canvas sessions in-memory. Each session holds
 * canvas state, connected clients, and registered agents.
 *
 * Sessions with no connected clients are garbage-collected after
 * 30 minutes of inactivity.
 *
 * @module
 */

import type { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import type { VisualExpression, AuthorInfo } from '@infinicanvas/protocol';
import type { Session } from './types.js';
import { log } from './logger.js';

/** Idle session TTL: 30 minutes in milliseconds. */
const SESSION_TTL_MS = 30 * 60 * 1000;

/** Garbage collection interval: 5 minutes. */
const GC_INTERVAL_MS = 5 * 60 * 1000;

export class SessionManager {
  private readonly sessions = new Map<string, Session>();
  private gcTimer: ReturnType<typeof setInterval> | null = null;

  /** Start the garbage collection timer. */
  startGC(): void {
    this.gcTimer = setInterval(() => this.collectExpiredSessions(), GC_INTERVAL_MS);
    // Don't prevent process exit if server is shutting down
    if (this.gcTimer && typeof this.gcTimer === 'object' && 'unref' in this.gcTimer) {
      (this.gcTimer as NodeJS.Timeout).unref();
    }
  }

  /** Stop the garbage collection timer. */
  stopGC(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
  }

  /** Create a new session and return its ID. */
  createSession(): string {
    const id = nanoid();
    this.createSessionWithId(id);
    return id;
  }

  /** Create a session with a specific ID (for well-known session IDs). */
  createSessionWithId(id: string): void {
    if (this.sessions.has(id)) return; // already exists
    const session: Session = {
      id,
      expressions: {},
      expressionOrder: [],
      clients: new Set(),
      agents: new Map(),
      waypoints: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    this.sessions.set(id, session);
    log('session_created', { sessionId: id });
  }

  /** Get a session by ID, or undefined if not found. */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Add a client to a session.
   * Returns the current session state for state-sync, or undefined if session not found.
   */
  joinSession(
    sessionId: string,
    ws: WebSocket,
  ): { expressions: VisualExpression[]; expressionOrder: string[]; agents: AuthorInfo[]; waypoints: import('./types.js').CameraWaypoint[] } | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.clients.add(ws);
    session.lastActivity = Date.now();

    log('client_joined', { sessionId, clientCount: session.clients.size });

    const expressions = session.expressionOrder
      .map((id) => session.expressions[id])
      .filter((expr): expr is VisualExpression => expr !== undefined);

    return {
      expressions,
      expressionOrder: session.expressionOrder,
      agents: [...session.agents.values()],
      waypoints: [...session.waypoints],
    };
  }

  /** Remove a client from a session. */
  leaveSession(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.clients.delete(ws);
    session.lastActivity = Date.now();

    log('client_left', { sessionId, clientCount: session.clients.size });
  }

  /** Remove a client from all sessions it belongs to. Returns affected session IDs. */
  removeClientFromAll(ws: WebSocket): string[] {
    const affectedSessions: string[] = [];
    for (const [id, session] of this.sessions) {
      if (session.clients.has(ws)) {
        session.clients.delete(ws);
        session.lastActivity = Date.now();
        affectedSessions.push(id);
        log('client_disconnected', { sessionId: id, clientCount: session.clients.size });
      }
    }
    return affectedSessions;
  }

  /** Get all sessions (for testing). */
  getAllSessions(): Map<string, Session> {
    return this.sessions;
  }

  /** Remove expired sessions (no clients for > SESSION_TTL_MS). */
  private collectExpiredSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.clients.size === 0 && now - session.lastActivity > SESSION_TTL_MS) {
        this.sessions.delete(id);
        log('session_gc', { sessionId: id });
      }
    }
  }
}
