/**
 * Gateway connection — manages WebSocket lifecycle for collaboration.
 *
 * Connects to the InfiniCanvas gateway server, handles session creation/joining,
 * forwards local operations, applies remote operations, and manages reconnection.
 *
 * This is a plain-object factory (not a React hook) so it can be tested without
 * React rendering. A thin React hook wrapper can be added in the app package.
 *
 * @module
 */

import type {
  ProtocolOperation,
  VisualExpression,
  AuthorInfo,
} from '@infinicanvas/protocol';
import { useCanvasStore } from '../store/canvasStore.js';
import { useAgentStore } from '../store/agentStore.js';

// ── Types ──────────────────────────────────────────────────

/** Options for creating a gateway connection. */
export interface GatewayConnectionOptions {
  /** WebSocket URL, e.g. ws://localhost:8080 */
  url: string;
  /** API key for gateway authentication. */
  apiKey: string;
  /** Session ID to join. Omit to create a new session. */
  sessionId?: string;
}

/** Gateway connection state and controls. */
export interface GatewayConnection {
  /** Whether the WebSocket is currently connected. */
  readonly connected: boolean;
  /** Current session ID, set after session-created or state-sync. */
  readonly sessionId: string | null;
  /** Connected agents/participants. */
  readonly agents: AuthorInfo[];
  /** Last error message, if any. */
  readonly error: string | null;
  /** Send an arbitrary JSON message through the WebSocket. */
  sendMessage: (message: Record<string, unknown>) => void;
  /** Cleanly close the connection. No reconnection after this. */
  disconnect: () => void;
}

// ── Client → Server message shapes ────────────────────────

interface CreateSessionMessage {
  type: 'create-session';
  auth: { apiKey: string };
}

interface JoinMessage {
  type: 'join';
  sessionId: string;
  auth: { apiKey: string };
}

interface OperationMessage {
  type: 'operation';
  operation: ProtocolOperation;
}

type OutboundMessage = CreateSessionMessage | JoinMessage | OperationMessage;

// ── Server → Client message shapes ────────────────────────

interface SessionCreatedMessage {
  type: 'session-created';
  sessionId: string;
}

interface StateSyncMessage {
  type: 'state-sync';
  sessionId: string;
  expressions: VisualExpression[];
  expressionOrder: string[];
  waypoints?: Array<{ x: number; y: number; zoom: number; label?: string }>;
  agents?: unknown[];
}

interface OperationBroadcast {
  type: 'operation';
  operation: ProtocolOperation;
}

interface AgentJoinedMessage {
  type: 'agent-joined';
  agent: AuthorInfo;
}

interface AgentLeftMessage {
  type: 'agent-left';
  agentId: string;
}

interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

interface WaypointAddInbound {
  type: 'waypoint-add';
  waypoint: { x: number; y: number; zoom: number; label?: string };
}

interface WaypointRemoveInbound {
  type: 'waypoint-remove';
  index: number;
}

interface WaypointReorderInbound {
  type: 'waypoint-reorder';
  fromIndex: number;
  toIndex: number;
}

interface ScreenshotRequestInbound {
  type: 'screenshot-request';
  requestId: string;
}

type InboundMessage =
  | SessionCreatedMessage
  | StateSyncMessage
  | OperationBroadcast
  | AgentJoinedMessage
  | AgentLeftMessage
  | ErrorMessage
  | WaypointAddInbound
  | WaypointRemoveInbound
  | WaypointReorderInbound
  | ScreenshotRequestInbound;

// ── Constants ──────────────────────────────────────────────

/** Maximum number of operation IDs to keep in the sent set. */
const MAX_SENT_SET_SIZE = 1000;

/** Initial reconnect delay in milliseconds. */
const INITIAL_BACKOFF_MS = 1000;

/** Maximum reconnect delay in milliseconds. */
const MAX_BACKOFF_MS = 30_000;

/** WebSocket close code for authentication failure. */
const AUTH_FAILURE_CODE = 4001;

// ── Factory ────────────────────────────────────────────────

/**
 * Create a gateway connection that manages WebSocket lifecycle.
 *
 * @param options - Connection configuration (url, apiKey, sessionId)
 * @param WebSocketImpl - WebSocket constructor (injectable for testing)
 * @returns GatewayConnection object with state and disconnect control
 */
export function createGatewayConnection(
  options: GatewayConnectionOptions,
  WebSocketImpl: typeof WebSocket = WebSocket,
): GatewayConnection {
  // ── Mutable internal state ─────────────────────────────

  let ws: WebSocket | null = null;
  let isConnected = false;
  let currentSessionId: string | null = options.sessionId ?? null;
  let lastError: string | null = null;
  let intentionalClose = false;
  let backoffMs = INITIAL_BACKOFF_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let storeUnsubscribe: (() => void) | null = null;
  let waypointUnsubscribe: (() => void) | null = null;

  /** Set of operation IDs we sent — used for deduplication. */
  const sentOperationIds = new Set<string>();

  /** Track the last operationLog length we've processed. */
  let lastLogLength = 0;

  /**
   * When true, incoming waypoint messages from the gateway are suppressed.
   * Used to prevent feedback loops when the local store change was initiated
   * by the user (and we're about to send it ourselves).
   */
  let suppressRemoteWaypoints = false;

  // ── Connection object (returned to caller) ─────────────

  const connection: GatewayConnection = {
    get connected() {
      return isConnected;
    },
    get sessionId() {
      return currentSessionId;
    },
    get agents() {
      return useAgentStore.getState().agents;
    },
    get error() {
      return lastError;
    },
    sendMessage: (message: Record<string, unknown>) => {
      if (ws && ws.readyState === WebSocketImpl.OPEN) {
        ws.send(JSON.stringify(message));
      }
    },
    disconnect: () => {
      intentionalClose = true;
      cleanup();
    },
  };

  // ── Internal helpers ───────────────────────────────────

  function send(message: OutboundMessage): void {
    if (ws && ws.readyState === WebSocketImpl.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function pruneSentSet(): void {
    if (sentOperationIds.size > MAX_SENT_SET_SIZE) {
      const arr = Array.from(sentOperationIds);
      const toRemove = arr.slice(0, arr.length - MAX_SENT_SET_SIZE);
      for (const id of toRemove) {
        sentOperationIds.delete(id);
      }
    }
  }

  function cleanup(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (storeUnsubscribe) {
      storeUnsubscribe();
      storeUnsubscribe = null;
    }

    if (waypointUnsubscribe) {
      waypointUnsubscribe();
      waypointUnsubscribe = null;
    }

    if (ws) {
      // Remove handlers to prevent close handler from triggering reconnect
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;

      if (ws.readyState === WebSocketImpl.OPEN || ws.readyState === WebSocketImpl.CONNECTING) {
        ws.close(1000, 'Client disconnect');
      }
      ws = null;
    }

    isConnected = false;
    useAgentStore.getState().clearAgents();
  }

  function scheduleReconnect(): void {
    if (intentionalClose) return;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, backoffMs);

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s, 30s...
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
  }

  // ── Message handlers ───────────────────────────────────

  function handleMessage(event: MessageEvent): void {
    let message: InboundMessage;
    try {
      message = JSON.parse(event.data as string) as InboundMessage;
    } catch {
      return; // Ignore malformed messages
    }

    switch (message.type) {
      case 'session-created': {
        currentSessionId = message.sessionId;
        break;
      }

      case 'state-sync': {
        currentSessionId = message.sessionId;
        // Gateway sends expressions as Record<id, expr>; replaceState expects array
        const exprs = Array.isArray(message.expressions)
          ? message.expressions
          : Object.values(message.expressions);
        useCanvasStore.getState().replaceState(
          exprs as VisualExpression[],
          message.expressionOrder,
        );
        // Restore waypoints from the gateway session
        if (Array.isArray(message.waypoints)) {
          const store = useCanvasStore.getState();
          store.clearWaypoints();
          for (const wp of message.waypoints) {
            store.addWaypoint(wp);
          }
        }
        // Load agents already registered in the session
        if (message.agents && Array.isArray(message.agents)) {
          const agentStore = useAgentStore.getState();
          agentStore.clearAgents();
          for (const agent of message.agents) {
            agentStore.addAgent(agent as Parameters<typeof agentStore.addAgent>[0]);
          }
        }
        // Reset log tracking since state was replaced
        lastLogLength = 0;
        break;
      }

      case 'operation': {
        const op = message.operation;
        // Deduplication: skip operations we sent
        if (sentOperationIds.has(op.id)) {
          return;
        }
        useCanvasStore.getState().applyRemoteOperation(op);
        break;
      }

      case 'agent-joined': {
        useAgentStore.getState().addAgent(message.agent);
        break;
      }

      case 'agent-left': {
        useAgentStore.getState().removeAgent(message.agentId);
        break;
      }

      case 'error': {
        lastError = message.message;
        break;
      }

      case 'waypoint-add': {
        suppressRemoteWaypoints = true;
        useCanvasStore.getState().addWaypoint(message.waypoint);
        suppressRemoteWaypoints = false;
        break;
      }

      case 'waypoint-remove': {
        suppressRemoteWaypoints = true;
        useCanvasStore.getState().removeWaypoint(message.index);
        suppressRemoteWaypoints = false;
        break;
      }

      case 'waypoint-reorder': {
        suppressRemoteWaypoints = true;
        useCanvasStore.getState().reorderWaypoints(message.fromIndex, message.toIndex);
        suppressRemoteWaypoints = false;
        break;
      }

      case 'screenshot-request': {
        const reqId = (message as ScreenshotRequestInbound).requestId;
        const currentWs = ws;
        // Capture after a short delay to let the render loop complete a frame
        setTimeout(() => {
          const canvas = document.querySelector('canvas');
          if (canvas && currentWs && currentWs.readyState === WebSocketImpl.OPEN) {
            try {
              const imageBase64 = canvas.toDataURL('image/png');
              currentWs.send(JSON.stringify({
                type: 'screenshot-response',
                requestId: reqId,
                imageBase64,
                width: canvas.width,
                height: canvas.height,
              }));
            } catch {
              currentWs.send(JSON.stringify({
                type: 'screenshot-response',
                requestId: reqId,
                imageBase64: '',
                width: 0,
                height: 0,
              }));
            }
          }
        }, 200);
        break;
      }
    }
  }

  function handleOpen(): void {
    isConnected = true;
    lastError = null;
    backoffMs = INITIAL_BACKOFF_MS; // Reset backoff on successful connect

    // Send handshake message — use live session ID if one was assigned [R8]
    if (currentSessionId) {
      send({
        type: 'join',
        sessionId: currentSessionId,
        auth: { apiKey: options.apiKey },
      });
    } else if (options.sessionId) {
      send({
        type: 'join',
        sessionId: options.sessionId,
        auth: { apiKey: options.apiKey },
      });
    } else {
      send({
        type: 'create-session',
        auth: { apiKey: options.apiKey },
      });
    }

    // Subscribe to store operation log for forwarding local ops
    lastLogLength = useCanvasStore.getState().operationLog.length;
    storeUnsubscribe = useCanvasStore.subscribe((state) => {
      const log = state.operationLog;
      if (log.length > lastLogLength) {
        // Forward new operations
        for (let i = lastLogLength; i < log.length; i++) {
          const op = log[i]!;
          sentOperationIds.add(op.id);
          send({ type: 'operation', operation: op });
        }
        lastLogLength = log.length;
        pruneSentSet();
      }
    });

    // Subscribe to waypoint changes for forwarding to the gateway.
    // Uses a snapshot comparison to detect local mutations.
    let lastWaypoints = [...useCanvasStore.getState().waypoints];
    waypointUnsubscribe = useCanvasStore.subscribe((state) => {
      // Skip if this change was triggered by a remote message
      if (suppressRemoteWaypoints) return;

      const current = state.waypoints;
      if (current === lastWaypoints) return;
      if (current.length === lastWaypoints.length &&
          current.every((wp, i) => wp === lastWaypoints[i])) {
        return;
      }

      // Detect what changed and send the appropriate message.
      // New waypoint added at the end:
      if (current.length === lastWaypoints.length + 1 &&
          lastWaypoints.every((wp, i) => current[i] === wp)) {
        const added = current[current.length - 1]!;
        connection.sendMessage({
          type: 'waypoint-add',
          waypoint: { x: added.x, y: added.y, zoom: added.zoom, label: added.label },
        });
      }
      // Waypoint removed:
      else if (current.length === lastWaypoints.length - 1) {
        const removedIndex = lastWaypoints.findIndex(
          (wp, i) => current[i] !== wp && !current.includes(wp),
        );
        if (removedIndex >= 0) {
          connection.sendMessage({ type: 'waypoint-remove', index: removedIndex });
        }
      }
      // Reorder or other bulk change — send as reorder if sizes match:
      else if (current.length === lastWaypoints.length) {
        // Find the moved element — simple heuristic: find mismatched indices
        let fromIdx = -1;
        for (let i = 0; i < lastWaypoints.length; i++) {
          if (lastWaypoints[i] !== current[i]) {
            fromIdx = i;
            break;
          }
        }
        if (fromIdx >= 0) {
          const moved = lastWaypoints[fromIdx];
          const toIdx = current.indexOf(moved!);
          if (toIdx >= 0 && toIdx !== fromIdx) {
            connection.sendMessage({
              type: 'waypoint-reorder',
              fromIndex: fromIdx,
              toIndex: toIdx,
            });
          }
        }
      }

      lastWaypoints = [...current];
    });
  }

  function handleClose(event: CloseEvent): void {
    isConnected = false;

    // Unsubscribe from store while disconnected
    if (storeUnsubscribe) {
      storeUnsubscribe();
      storeUnsubscribe = null;
    }

    if (waypointUnsubscribe) {
      waypointUnsubscribe();
      waypointUnsubscribe = null;
    }

    if (event.code === AUTH_FAILURE_CODE) {
      lastError = 'Authentication failed';
      intentionalClose = true; // Don't retry on auth failure
      return;
    }

    if (!intentionalClose) {
      scheduleReconnect();
    }
  }

  // ── Connect ────────────────────────────────────────────

  function connect(): void {
    ws = new WebSocketImpl(options.url);

    ws.onopen = handleOpen;
    ws.onmessage = handleMessage;
    ws.onclose = handleClose;
    ws.onerror = () => {
      // Error events are followed by close events — handled there
    };
  }

  // Start connection immediately
  connect();

  return connection;
}
