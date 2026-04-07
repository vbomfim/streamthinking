/**
 * Gateway WebSocket client for the MCP server.
 *
 * Connects to the InfiniCanvas gateway to send operations and receive
 * canvas state. Used by all tool implementations to push expressions
 * onto the shared canvas.
 *
 * @module
 */

import WebSocket from 'ws';
import { nanoid } from 'nanoid';
import type {
  VisualExpression,
  ProtocolOperation,
  AuthorInfo,
  CreatePayload,
  UpdatePayload,
  DeletePayload,
  MovePayload,
  TransformPayload,
  MorphPayload,
  StylePayload,
  ExpressionKind,
  ExpressionData,
  ExpressionStyle,
} from '@infinicanvas/protocol';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';
import { MCP_AUTHOR } from './defaults.js';

/** A saved camera position for presentation-mode navigation. */
export interface CameraWaypoint {
  x: number;
  y: number;
  zoom: number;
  label?: string;
}

/** Messages the gateway sends back to us. */
interface SessionCreatedMessage {
  type: 'session-created';
  sessionId: string;
}

interface StateSyncMessage {
  type: 'state-sync';
  sessionId: string;
  expressions: VisualExpression[];
  expressionOrder: string[];
  waypoints?: CameraWaypoint[];
}

interface OperationBroadcast {
  type: 'operation';
  operation: ProtocolOperation;
}

interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

/** Inbound agent-request relayed by the gateway from a human client. */
interface AgentRequestInbound {
  type: 'agent-request';
  requestId: string;
  action: string;
  context: {
    expressions: Array<{
      id: string;
      kind: string;
      label?: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
      data: unknown;
    }>;
    suggestedPosition: { x: number; y: number };
  };
  prompt: string;
}

/** Inbound waypoint-add broadcast from the gateway. */
interface WaypointAddInbound {
  type: 'waypoint-add';
  waypoint: CameraWaypoint;
}

/** Inbound waypoint-remove broadcast from the gateway. */
interface WaypointRemoveInbound {
  type: 'waypoint-remove';
  index: number;
}

/** Inbound waypoint-reorder broadcast from the gateway. */
interface WaypointReorderInbound {
  type: 'waypoint-reorder';
  fromIndex: number;
  toIndex: number;
}

/** Inbound screenshot response from a browser client. */
interface ScreenshotResponseInbound {
  type: 'screenshot-response';
  requestId: string;
  imageBase64: string;
  width: number;
  height: number;
}

type ServerMessage =
  | SessionCreatedMessage
  | StateSyncMessage
  | OperationBroadcast
  | ErrorMessage
  | AgentRequestInbound
  | WaypointAddInbound
  | WaypointRemoveInbound
  | WaypointReorderInbound
  | ScreenshotResponseInbound;

/** Options for creating a gateway client. */
export interface GatewayClientOptions {
  /** Gateway WebSocket URL (default: ws://localhost:8080). */
  url?: string;
  /** API key for gateway authentication. */
  apiKey?: string;
  /** Existing session ID to join (creates new session if omitted). */
  sessionId?: string;
}

/** A pending action request from a human user. */
export interface PendingAgentRequest {
  /** Unique request identifier. */
  requestId: string;
  /** Action type: explain, extend, or diagram. */
  action: string;
  /** Human-readable prompt describing what the AI should do. */
  prompt: string;
  /** Context about selected expressions and suggested position. */
  context: {
    expressions: Array<{
      id: string;
      kind: string;
      label?: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
      data: unknown;
    }>;
    suggestedPosition: { x: number; y: number };
  };
  /** Unix timestamp (ms) when the request was received. */
  receivedAt: number;
}

/**
 * Gateway client interface — the port through which tools interact
 * with the collaborative canvas.
 */
export interface IGatewayClient {
  /** Connect to the gateway and create or join a session. */
  connect(): Promise<void>;
  /** Disconnect from the gateway. */
  disconnect(): void;
  /** Whether the client is currently connected. */
  isConnected(): boolean;
  /** Current session ID (null if not connected). */
  getSessionId(): string | null;
  /** Send a create operation for a visual expression. */
  sendCreate(expression: VisualExpression): Promise<void>;
  /** Send create operations for multiple expressions in sequence. */
  sendBatchCreate(expressions: VisualExpression[]): Promise<void>;
  /** Send a delete operation for one or more expression IDs. */
  sendDelete(expressionIds: string[]): Promise<void>;
  /** Send a morph operation to change an expression's kind. */
  sendMorph(expressionId: string, fromKind: ExpressionKind, toKind: ExpressionKind, newData: ExpressionData): Promise<void>;
  /** Send a style operation to change expression visual properties. */
  sendStyle(expressionIds: string[], style: Partial<import('@infinicanvas/protocol').ExpressionStyle>): Promise<void>;
  /** Send an update operation to change position, size, style, or data. */
  sendUpdate(expressionId: string, changes: { position?: { x: number; y: number }; size?: { width: number; height: number }; style?: Record<string, unknown>; data?: Record<string, unknown> }): Promise<void>;
  /** Get the current canvas state (expressions). */
  getState(): VisualExpression[];
  /** Get and clear all pending agent requests from human users. */
  getPendingRequests(): PendingAgentRequest[];
  /** Update the agent display name and re-identify with the gateway. */
  updateAgentName(name: string): void;
  /** Get the current waypoint list from the gateway session. */
  getWaypoints(): CameraWaypoint[];
  /** Send a waypoint-add message to the gateway. */
  sendWaypointAdd(waypoint: CameraWaypoint): void;
  /** Send a waypoint-remove message to the gateway. */
  sendWaypointRemove(index: number): void;
  /** Send a waypoint-reorder message to the gateway. */
  sendWaypointReorder(fromIndex: number, toIndex: number): void;
  /** Request a screenshot from a connected browser client. */
  requestScreenshot(timeoutMs?: number): Promise<{ imageBase64: string; width: number; height: number }>;
}

/**
 * WebSocket client that connects to the InfiniCanvas gateway.
 *
 * Maintains a live connection and synchronizes canvas state. All tool
 * implementations use this client to push operations.
 */
export class GatewayClient implements IGatewayClient {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private expressions: VisualExpression[] = [];
  private waypoints: CameraWaypoint[] = [];
  private pendingRequests: PendingAgentRequest[] = [];
  private screenshotResolvers = new Map<string, (data: { imageBase64: string; width: number; height: number }) => void>();
  private readonly url: string;
  private readonly apiKey: string;
  private readonly initialSessionId: string | undefined;
  private author: AuthorInfo;

  /** Maximum pending requests to queue (prevents unbounded growth). */
  private static readonly MAX_PENDING_REQUESTS = 50;

  constructor(options: GatewayClientOptions = {}) {
    this.url = options.url ?? process.env['INFINICANVAS_GATEWAY_URL'] ?? 'ws://localhost:8080';
    this.apiKey = options.apiKey ?? process.env['INFINICANVAS_API_KEY'] ?? '';
    this.initialSessionId = options.sessionId ?? process.env['INFINICANVAS_SESSION_ID'] ?? undefined;
    this.author = MCP_AUTHOR;
  }

  /** Timeout (ms) for the initial gateway handshake. */
  private static readonly CONNECT_TIMEOUT_MS = 10_000;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const settle = (fn: (v?: any) => void, value?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        fn(value);
      };

      this.ws = new WebSocket(this.url);

      const timeout = setTimeout(() => {
        this.ws?.close();
        settle(reject, new Error('Gateway connection timed out (10s)'));
      }, GatewayClient.CONNECT_TIMEOUT_MS);

      const onError = (err: Error) => {
        settle(reject, new Error(`Gateway connection failed: ${err.message}`));
      };

      this.ws.on('error', onError);

      this.ws.on('close', () => {
        settle(reject, new Error('Connection closed before session established'));
      });

      this.ws.on('open', () => {
        this.ws?.removeListener('error', onError);
        this.setupMessageHandler(
          () => settle(resolve),
          (err) => settle(reject, err),
        );

        if (this.initialSessionId) {
          this.send({
            type: 'join',
            sessionId: this.initialSessionId,
            auth: { apiKey: this.apiKey },
          });
        } else {
          this.send({
            type: 'create-session',
            auth: { apiKey: this.apiKey },
          });
        }
      });
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'MCP server disconnect');
      this.ws = null;
    }
    this.sessionId = null;
    this.expressions = [];
    this.waypoints = [];
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Send identify message to register this agent in the session immediately. */
  private sendIdentify(): void {
    this.send({
      type: 'identify',
      agent: this.author,
    });
  }

  updateAgentName(name: string): void {
    this.author = { ...this.author, name };
    if (this.isConnected()) {
      this.sendIdentify();
    }
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  async sendCreate(expression: VisualExpression): Promise<void> {
    const payload: CreatePayload = {
      type: 'create',
      expressionId: expression.id,
      kind: expression.kind,
      position: expression.position,
      size: expression.size,
      data: expression.data,
      style: expression.style,
      angle: expression.angle,
    };

    await this.sendOperation('create', payload);

    // Update local state
    this.expressions.push(expression);
  }

  async sendBatchCreate(expressions: VisualExpression[]): Promise<void> {
    for (const expression of expressions) {
      await this.sendCreate(expression);
    }
  }

  async sendDelete(expressionIds: string[]): Promise<void> {
    const payload: DeletePayload = {
      type: 'delete',
      expressionIds,
    };

    await this.sendOperation('delete', payload);

    // Update local state
    this.expressions = this.expressions.filter(
      (e) => !expressionIds.includes(e.id),
    );
  }

  async sendMorph(
    expressionId: string,
    fromKind: ExpressionKind,
    toKind: ExpressionKind,
    newData: ExpressionData,
  ): Promise<void> {
    const payload: MorphPayload = {
      type: 'morph',
      expressionId,
      fromKind,
      toKind,
      newData,
    };

    await this.sendOperation('morph', payload);
  }

  async sendStyle(
    expressionIds: string[],
    style: Partial<import('@infinicanvas/protocol').ExpressionStyle>,
  ): Promise<void> {
    const payload: StylePayload = {
      type: 'style',
      expressionIds,
      style,
    };

    await this.sendOperation('style', payload);
  }

  async sendUpdate(
    expressionId: string,
    changes: {
      position?: { x: number; y: number };
      size?: { width: number; height: number };
      style?: Record<string, unknown>;
      data?: Record<string, unknown>;
    },
  ): Promise<void> {
    const payload = {
      type: 'update' as const,
      expressionId,
      changes: changes as { position?: { x: number; y: number }; size?: { width: number; height: number } },
    };
    await this.sendOperation('update', payload);

    // Update local state
    const expr = this.expressions.find((e) => e.id === expressionId);
    if (expr) {
      if (changes.position) expr.position = changes.position;
      if (changes.size) expr.size = changes.size;
      if (changes.style) expr.style = { ...expr.style, ...changes.style } as typeof expr.style;
      if (changes.data) expr.data = changes.data as unknown as typeof expr.data;
    }
  }

  getState(): VisualExpression[] {
    return [...this.expressions];
  }

  getPendingRequests(): PendingAgentRequest[] {
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];
    return requests;
  }

  getWaypoints(): CameraWaypoint[] {
    return [...this.waypoints];
  }

  sendWaypointAdd(waypoint: CameraWaypoint): void {
    this.send({ type: 'waypoint-add', waypoint });
    // Optimistic local update
    this.waypoints.push(waypoint);
  }

  sendWaypointRemove(index: number): void {
    this.send({ type: 'waypoint-remove', index });
    // Optimistic local update
    if (index >= 0 && index < this.waypoints.length) {
      this.waypoints.splice(index, 1);
    }
  }

  sendWaypointReorder(fromIndex: number, toIndex: number): void {
    this.send({ type: 'waypoint-reorder', fromIndex, toIndex });
    // Optimistic local update
    if (fromIndex >= 0 && fromIndex < this.waypoints.length &&
        toIndex >= 0 && toIndex < this.waypoints.length &&
        fromIndex !== toIndex) {
      const [moved] = this.waypoints.splice(fromIndex, 1);
      this.waypoints.splice(toIndex, 0, moved!);
    }
  }

  async requestScreenshot(timeoutMs = 5000): Promise<{ imageBase64: string; width: number; height: number }> {
    if (!this.isConnected()) {
      throw new Error('Not connected to gateway');
    }

    const requestId = nanoid();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.screenshotResolvers.delete(requestId);
        reject(new Error('Screenshot request timed out — is a browser connected?'));
      }, timeoutMs);

      this.screenshotResolvers.set(requestId, (data) => {
        clearTimeout(timer);
        this.screenshotResolvers.delete(requestId);
        resolve(data);
      });

      this.send({ type: 'screenshot-request', requestId });
    });
  }

  // ── Private helpers ──────────────────────────────────────

  private setupMessageHandler(
    onReady: () => void,
    onFail: (err: Error) => void,
  ): void {
    let settled = false;

    this.ws?.on('message', (raw: WebSocket.RawData) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(raw.toString()) as ServerMessage;
      } catch {
        console.warn('[GatewayClient] Malformed WebSocket message, ignoring');
        return;
      }

      switch (msg.type) {
        case 'session-created':
          this.sessionId = msg.sessionId;
          this.sendIdentify();
          if (!settled) {
            settled = true;
            onReady();
          }
          break;

        case 'state-sync':
          this.sessionId = msg.sessionId;
          this.expressions = msg.expressions;
          this.waypoints = msg.waypoints ?? [];
          this.sendIdentify();
          if (!settled) {
            settled = true;
            onReady();
          }
          break;

        case 'operation':
          this.applyRemoteOperation(msg.operation);
          break;

        case 'agent-request':
          this.enqueueAgentRequest(msg);
          break;

        case 'waypoint-add':
          this.waypoints.push(msg.waypoint);
          break;

        case 'waypoint-remove':
          if (msg.index >= 0 && msg.index < this.waypoints.length) {
            this.waypoints.splice(msg.index, 1);
          }
          break;

        case 'waypoint-reorder': {
          const { fromIndex, toIndex } = msg;
          if (fromIndex >= 0 && fromIndex < this.waypoints.length &&
              toIndex >= 0 && toIndex < this.waypoints.length &&
              fromIndex !== toIndex) {
            const [moved] = this.waypoints.splice(fromIndex, 1);
            this.waypoints.splice(toIndex, 0, moved!);
          }
          break;
        }

        case 'error':
          if (!settled) {
            settled = true;
            onFail(new Error(`Gateway error [${msg.code}]: ${msg.message}`));
          }
          break;

        case 'screenshot-response': {
          const resolver = this.screenshotResolvers.get(msg.requestId);
          if (resolver) {
            resolver({ imageBase64: msg.imageBase64, width: msg.width, height: msg.height });
          }
          break;
        }
      }
    });
  }

  private applyRemoteOperation(op: ProtocolOperation): void {
    switch (op.payload.type) {
      case 'create': {
        const p = op.payload as CreatePayload;
        const exists = this.expressions.some((e) => e.id === p.expressionId);
        if (!exists) {
          const expr: VisualExpression = {
            id: p.expressionId,
            kind: p.kind,
            position: p.position,
            size: p.size,
            angle: p.angle ?? 0,
            style: p.style ?? { ...DEFAULT_EXPRESSION_STYLE },
            meta: {
              author: op.author,
              createdAt: op.timestamp,
              updatedAt: op.timestamp,
              tags: [],
              locked: false,
            },
            data: p.data,
          };
          this.expressions.push(expr);
        }
        break;
      }

      case 'update': {
        const p = op.payload as UpdatePayload;
        const existing = this.expressions.find((e) => e.id === p.expressionId);
        if (existing) {
          if (p.changes.position) existing.position = p.changes.position;
          if (p.changes.size) existing.size = p.changes.size;
          if (p.changes.angle !== undefined) existing.angle = p.changes.angle;
          if (p.changes.style) {
            existing.style = { ...existing.style, ...p.changes.style } as ExpressionStyle;
          }
          if (p.changes.data) existing.data = p.changes.data;
        }
        break;
      }

      case 'delete': {
        const p = op.payload as DeletePayload;
        this.expressions = this.expressions.filter(
          (e) => !p.expressionIds.includes(e.id),
        );
        break;
      }

      case 'move': {
        const p = op.payload as MovePayload;
        const existing = this.expressions.find((e) => e.id === p.expressionId);
        if (existing) {
          existing.position = p.to;
        }
        break;
      }

      case 'transform': {
        const p = op.payload as TransformPayload;
        const existing = this.expressions.find((e) => e.id === p.expressionId);
        if (existing) {
          if (p.angle !== undefined) existing.angle = p.angle;
          if (p.size) existing.size = p.size;
        }
        break;
      }

      case 'style': {
        const p = op.payload as StylePayload;
        for (const id of p.expressionIds) {
          const existing = this.expressions.find((e) => e.id === id);
          if (existing) {
            existing.style = { ...existing.style, ...p.style } as ExpressionStyle;
          }
        }
        break;
      }

      case 'morph': {
        const p = op.payload as MorphPayload;
        const existing = this.expressions.find((e) => e.id === p.expressionId);
        if (existing) {
          existing.kind = p.toKind;
          existing.data = p.newData;
        }
        break;
      }

      default:
        // Other operation types are broadcast-only and don't affect local state
        break;
    }
  }

  /** Queue an inbound agent-request for retrieval by the pending requests tool. */
  private enqueueAgentRequest(msg: AgentRequestInbound): void {
    // Enforce queue size limit — drop oldest if full.
    if (this.pendingRequests.length >= GatewayClient.MAX_PENDING_REQUESTS) {
      this.pendingRequests.shift();
    }

    this.pendingRequests.push({
      requestId: msg.requestId,
      action: msg.action,
      prompt: msg.prompt,
      context: msg.context,
      receivedAt: Date.now(),
    });
  }

  private async sendOperation(
    type: ProtocolOperation['type'],
    payload: ProtocolOperation['payload'],
  ): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to gateway');
    }

    const operation: ProtocolOperation = {
      id: nanoid(),
      type,
      author: this.author,
      timestamp: Date.now(),
      payload,
    };

    this.send({ type: 'operation', operation });
  }

  private send(message: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

/**
 * Create a gateway client instance.
 *
 * Uses environment variables for configuration if not provided:
 * - INFINICANVAS_GATEWAY_URL (default: ws://localhost:8080)
 * - INFINICANVAS_API_KEY
 * - INFINICANVAS_SESSION_ID (optional — creates new session if omitted)
 */
export function createGatewayClient(
  options?: GatewayClientOptions,
): IGatewayClient {
  return new GatewayClient(options);
}
