/**
 * WebSocket gateway server for InfiniCanvas.
 *
 * Provides real-time collaboration via WebSocket connections.
 * Handles session management, authentication, protocol validation,
 * rate limiting, and agent registration.
 *
 * @module
 */

import { WebSocketServer } from 'ws';
import type { WebSocket, RawData } from 'ws';
import { SessionManager } from './sessionManager.js';
import { RateLimiter } from './rateLimiter.js';
import { authenticate } from './authMiddleware.js';
import { validateOperation, applyOperation } from './protocolHandler.js';
import { registerAgent, broadcastToOthers } from './agentRegistry.js';
import { log, logError } from './logger.js';
import type { ClientMessage, ServerMessage } from './types.js';

/** Maximum allowed message size: 1 MB. */
const MAX_MESSAGE_SIZE = 1024 * 1024;

/**
 * Create and configure the WebSocket gateway server.
 * Returns the server instance (does NOT call listen — the caller starts it).
 */
export function createGateway(options: {
  sessionManager?: SessionManager;
  rateLimiter?: RateLimiter;
  port?: number;
} = {}): { wss: WebSocketServer; sessionManager: SessionManager; start: () => void; stop: () => Promise<void> } {
  const sessionManager = options.sessionManager ?? new SessionManager();
  const rateLimiter = options.rateLimiter ?? new RateLimiter();
  const port = options.port ?? (Number(process.env['PORT']) || 8080);

  /** Per-client session mapping (instance-scoped). */
  const clientSessions = new Map<WebSocket, string>();

  const wss = new WebSocketServer({ port, maxPayload: MAX_MESSAGE_SIZE });

  wss.on('connection', (ws: WebSocket) => {
    log('client_connected');

    ws.on('message', (raw: RawData, isBinary: boolean) => {
      // Reject binary frames.
      if (isBinary) {
        logError('binary_rejected', new Error('Binary frames not supported'));
        ws.close(1003, 'Binary frames not supported');
        return;
      }

      const data = raw.toString();

      // Message size check (defense in depth — ws maxPayload also enforces this).
      if (data.length > MAX_MESSAGE_SIZE) {
        sendError(ws, 'MESSAGE_TOO_LARGE', 'Message exceeds 1MB limit');
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch {
        sendError(ws, 'INVALID_JSON', 'Message is not valid JSON');
        return;
      }

      // Validate message has a known type
      if (!parsed || typeof parsed !== 'object' || !('type' in parsed) ||
          typeof (parsed as Record<string, unknown>).type !== 'string') {
        sendError(ws, 'INVALID_MESSAGE', 'Message must have a string type field');
        return;
      }

      const message = parsed as ClientMessage;

      handleMessage(ws, message, sessionManager, rateLimiter, clientSessions);
    });

    ws.on('close', () => {
      const sessionId = clientSessions.get(ws);
      if (sessionId) {
        sessionManager.leaveSession(sessionId, ws);
        clientSessions.delete(ws);
      } else {
        sessionManager.removeClientFromAll(ws);
      }
      rateLimiter.remove(ws);
      log('client_disconnected');
    });

    ws.on('error', (error: Error) => {
      logError('ws_error', error);
    });
  });

  const start = (): void => {
    sessionManager.startGC();
    log('gateway_started', { port });
  };

  const stop = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      sessionManager.stopGC();
      // Terminate all connected clients before closing the server.
      for (const client of wss.clients) {
        client.terminate();
      }
      wss.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  return { wss, sessionManager, start, stop };
}

// ── Message Handler ────────────────────────────────────────

function handleMessage(
  ws: WebSocket,
  message: ClientMessage,
  sessionManager: SessionManager,
  rateLimiter: RateLimiter,
  clientSessions: Map<WebSocket, string>,
): void {
  switch (message.type) {
    case 'create-session': {
      if (!authenticate(ws, message.auth?.apiKey)) return;

      // Leave existing session if any (prevent stale client references)
      const existingSession = clientSessions.get(ws);
      if (existingSession) {
        sessionManager.leaveSession(existingSession, ws);
        clientSessions.delete(ws);
      }

      const sessionId = sessionManager.createSession();
      sessionManager.joinSession(sessionId, ws);
      clientSessions.set(ws, sessionId);
      send(ws, { type: 'session-created', sessionId });
      break;
    }

    case 'join': {
      if (!authenticate(ws, message.auth?.apiKey)) return;

      // Leave existing session if any (prevent stale client references)
      const prevSession = clientSessions.get(ws);
      if (prevSession) {
        sessionManager.leaveSession(prevSession, ws);
        clientSessions.delete(ws);
      }

      // Auto-create the session if it doesn't exist (enables well-known session IDs)
      let state = sessionManager.joinSession(message.sessionId, ws);
      if (!state) {
        sessionManager.createSessionWithId(message.sessionId);
        state = sessionManager.joinSession(message.sessionId, ws);
        if (!state) {
          sendError(ws, 'SESSION_NOT_FOUND', 'Failed to create session');
          return;
        }
      }
      clientSessions.set(ws, message.sessionId);
      send(ws, {
        type: 'state-sync',
        sessionId: message.sessionId,
        expressions: state.expressions,
        expressionOrder: state.expressionOrder,
        agents: state.agents,
        waypoints: state.waypoints,
      });
      break;
    }

    case 'operation': {
      const sessionId = clientSessions.get(ws);
      if (!sessionId) {
        sendError(ws, 'NOT_IN_SESSION', 'Join a session before sending operations');
        return;
      }

      // Rate limiting.
      if (!rateLimiter.allow(ws)) {
        sendError(ws, 'RATE_LIMITED', 'Too many operations — slow down');
        return;
      }

      // Validate operation against protocol schema.
      const validationError = validateOperation(message.operation);
      if (validationError) {
        send(ws, validationError);
        return;
      }

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        sendError(ws, 'SESSION_NOT_FOUND', 'Session no longer exists');
        return;
      }

      // Apply state mutation.
      applyOperation(session, message.operation);

      // Check for agent registration.
      const agentMsg = registerAgent(session, message.operation.author);
      if (agentMsg) {
        broadcastToOthers(session, ws, agentMsg);
      }

      // Broadcast operation to other clients.
      broadcastToOthers(session, ws, {
        type: 'operation',
        operation: message.operation,
      });
      break;
    }

    case 'agent-request': {
      const sessionId = clientSessions.get(ws);
      if (!sessionId) {
        sendError(ws, 'NOT_IN_SESSION', 'Join a session before sending agent requests');
        return;
      }

      // Rate limiting (same as operations).
      if (!rateLimiter.allow(ws)) {
        sendError(ws, 'RATE_LIMITED', 'Too many requests — slow down');
        return;
      }

      // Validate required top-level fields.
      if (!message.requestId || !message.action || !message.context || !message.prompt) {
        sendError(ws, 'INVALID_AGENT_REQUEST', 'agent-request requires requestId, action, context, and prompt');
        return;
      }

      // Validate action against allowed values.
      const ALLOWED_ACTIONS = ['explain', 'extend', 'diagram'];
      if (!ALLOWED_ACTIONS.includes(message.action)) {
        sendError(ws, 'INVALID_AGENT_REQUEST', `action must be one of: ${ALLOWED_ACTIONS.join(', ')}`);
        return;
      }

      // Validate context structure.
      if (!Array.isArray(message.context.expressions) || !message.context.suggestedPosition) {
        sendError(ws, 'INVALID_AGENT_REQUEST', 'context must include expressions array and suggestedPosition');
        return;
      }

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        sendError(ws, 'SESSION_NOT_FOUND', 'Session no longer exists');
        return;
      }

      const safeAction = String(message.action).slice(0, 50);
      log('agent_request', { sessionId, requestId: message.requestId, action: safeAction });

      // Relay to all other clients (MCP server, other agents) — gateway is just a relay.
      broadcastToOthers(session, ws, {
        type: 'agent-request',
        requestId: message.requestId,
        action: message.action,
        context: message.context,
        prompt: message.prompt,
      });
      break;
    }

    case 'identify': {
      const sessionId = clientSessions.get(ws);
      if (!sessionId) {
        sendError(ws, 'NOT_IN_SESSION', 'Join a session before identifying');
        return;
      }

      if (!message.agent || !message.agent.id || !message.agent.name) {
        sendError(ws, 'INVALID_IDENTIFY', 'identify requires agent with id and name');
        return;
      }

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        sendError(ws, 'SESSION_NOT_FOUND', 'Session no longer exists');
        return;
      }

      const agentMsg = registerAgent(session, message.agent);
      if (agentMsg) {
        // Broadcast to ALL clients including sender so the browser sees it
        for (const client of session.clients) {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify(agentMsg));
          }
        }
      }
      break;
    }

    case 'leave': {
      const sessionId = clientSessions.get(ws);
      if (sessionId) {
        sessionManager.leaveSession(sessionId, ws);
        clientSessions.delete(ws);
        log('client_left_session', { sessionId });
      }
      break;
    }

    case 'waypoint-add': {
      const sessionId = clientSessions.get(ws);
      if (!sessionId) {
        sendError(ws, 'NOT_IN_SESSION', 'Join a session before adding waypoints');
        return;
      }

      if (!message.waypoint || typeof message.waypoint.x !== 'number' ||
          typeof message.waypoint.y !== 'number' || typeof message.waypoint.zoom !== 'number') {
        sendError(ws, 'INVALID_WAYPOINT', 'waypoint-add requires waypoint with x, y, zoom');
        return;
      }

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        sendError(ws, 'SESSION_NOT_FOUND', 'Session no longer exists');
        return;
      }

      session.waypoints.push({
        x: message.waypoint.x,
        y: message.waypoint.y,
        zoom: message.waypoint.zoom,
        label: message.waypoint.label,
      });
      session.lastActivity = Date.now();

      broadcastToOthers(session, ws, {
        type: 'waypoint-add',
        waypoint: message.waypoint,
      });
      break;
    }

    case 'waypoint-remove': {
      const sessionId = clientSessions.get(ws);
      if (!sessionId) {
        sendError(ws, 'NOT_IN_SESSION', 'Join a session before removing waypoints');
        return;
      }

      if (typeof message.index !== 'number') {
        sendError(ws, 'INVALID_WAYPOINT', 'waypoint-remove requires numeric index');
        return;
      }

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        sendError(ws, 'SESSION_NOT_FOUND', 'Session no longer exists');
        return;
      }

      if (message.index >= 0 && message.index < session.waypoints.length) {
        session.waypoints.splice(message.index, 1);
        session.lastActivity = Date.now();

        broadcastToOthers(session, ws, {
          type: 'waypoint-remove',
          index: message.index,
        });
      }
      break;
    }

    case 'waypoint-reorder': {
      const sessionId = clientSessions.get(ws);
      if (!sessionId) {
        sendError(ws, 'NOT_IN_SESSION', 'Join a session before reordering waypoints');
        return;
      }

      if (typeof message.fromIndex !== 'number' || typeof message.toIndex !== 'number') {
        sendError(ws, 'INVALID_WAYPOINT', 'waypoint-reorder requires fromIndex and toIndex');
        return;
      }

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        sendError(ws, 'SESSION_NOT_FOUND', 'Session no longer exists');
        return;
      }

      const { fromIndex, toIndex } = message;
      if (fromIndex >= 0 && fromIndex < session.waypoints.length &&
          toIndex >= 0 && toIndex < session.waypoints.length &&
          fromIndex !== toIndex) {
        const [moved] = session.waypoints.splice(fromIndex, 1);
        session.waypoints.splice(toIndex, 0, moved!);
        session.lastActivity = Date.now();

        broadcastToOthers(session, ws, {
          type: 'waypoint-reorder',
          fromIndex,
          toIndex,
        });
      }
      break;
    }

    case 'screenshot-request': {
      const sessionId = clientSessions.get(ws);
      if (!sessionId) {
        sendError(ws, 'NOT_IN_SESSION', 'Join a session before requesting screenshots');
        return;
      }

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        sendError(ws, 'SESSION_NOT_FOUND', 'Session no longer exists');
        return;
      }

      // Relay to all other clients (browser will handle the capture)
      broadcastToOthers(session, ws, message);
      break;
    }

    case 'screenshot-response': {
      const sessionId = clientSessions.get(ws);
      if (!sessionId) return;

      const session = sessionManager.getSession(sessionId);
      if (!session) return;

      // Relay back to the requester (MCP server)
      broadcastToOthers(session, ws, message);
      break;
    }

    default: {
      sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type`);
      break;
    }
  }
}

// ── Helpers ────────────────────────────────────────────────

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, code: string, message: string): void {
  send(ws, { type: 'error', code, message });
}
