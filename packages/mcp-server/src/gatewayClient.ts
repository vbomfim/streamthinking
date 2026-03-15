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
  DeletePayload,
  MorphPayload,
  StylePayload,
  ExpressionKind,
  ExpressionData,
} from '@infinicanvas/protocol';
import { MCP_AUTHOR } from './defaults.js';

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

type ServerMessage =
  | SessionCreatedMessage
  | StateSyncMessage
  | OperationBroadcast
  | ErrorMessage;

/** Options for creating a gateway client. */
export interface GatewayClientOptions {
  /** Gateway WebSocket URL (default: ws://localhost:8080). */
  url?: string;
  /** API key for gateway authentication. */
  apiKey?: string;
  /** Existing session ID to join (creates new session if omitted). */
  sessionId?: string;
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
  /** Send a delete operation for one or more expression IDs. */
  sendDelete(expressionIds: string[]): Promise<void>;
  /** Send a morph operation to change an expression's kind. */
  sendMorph(expressionId: string, fromKind: ExpressionKind, toKind: ExpressionKind, newData: ExpressionData): Promise<void>;
  /** Send a style operation to change expression visual properties. */
  sendStyle(expressionIds: string[], style: Partial<import('@infinicanvas/protocol').ExpressionStyle>): Promise<void>;
  /** Get the current canvas state (expressions). */
  getState(): VisualExpression[];
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
  private readonly url: string;
  private readonly apiKey: string;
  private readonly initialSessionId: string | undefined;
  private readonly author: AuthorInfo;

  constructor(options: GatewayClientOptions = {}) {
    this.url = options.url ?? process.env['INFINICANVAS_GATEWAY_URL'] ?? 'ws://localhost:8080';
    this.apiKey = options.apiKey ?? process.env['INFINICANVAS_API_KEY'] ?? '';
    this.initialSessionId = options.sessionId ?? process.env['INFINICANVAS_SESSION_ID'] ?? undefined;
    this.author = MCP_AUTHOR;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      const onError = (err: Error) => {
        this.ws?.removeListener('error', onError);
        reject(new Error(`Gateway connection failed: ${err.message}`));
      };

      this.ws.on('error', onError);

      this.ws.on('open', () => {
        this.ws?.removeListener('error', onError);
        this.setupMessageHandler(resolve, reject);

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
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
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
    };

    await this.sendOperation('create', payload);

    // Update local state
    this.expressions.push(expression);
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

  getState(): VisualExpression[] {
    return [...this.expressions];
  }

  // ── Private helpers ──────────────────────────────────────

  private setupMessageHandler(
    onReady: () => void,
    onFail: (err: Error) => void,
  ): void {
    let settled = false;

    this.ws?.on('message', (raw: WebSocket.RawData) => {
      const msg = JSON.parse(raw.toString()) as ServerMessage;

      switch (msg.type) {
        case 'session-created':
          this.sessionId = msg.sessionId;
          if (!settled) {
            settled = true;
            onReady();
          }
          break;

        case 'state-sync':
          this.sessionId = msg.sessionId;
          this.expressions = msg.expressions;
          if (!settled) {
            settled = true;
            onReady();
          }
          break;

        case 'operation':
          this.applyRemoteOperation(msg.operation);
          break;

        case 'error':
          if (!settled) {
            settled = true;
            onFail(new Error(`Gateway error [${msg.code}]: ${msg.message}`));
          }
          break;
      }
    });
  }

  private applyRemoteOperation(op: ProtocolOperation): void {
    if (op.payload.type === 'create') {
      const createPayload = op.payload;
      const exists = this.expressions.some((e) => e.id === createPayload.expressionId);
      if (!exists) {
        // This was from another client — we'd need the full expression
        // For now, we just track what we sent ourselves
      }
    } else if (op.payload.type === 'delete') {
      const deletePayload = op.payload;
      this.expressions = this.expressions.filter(
        (e) => !deletePayload.expressionIds.includes(e.id),
      );
    }
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
