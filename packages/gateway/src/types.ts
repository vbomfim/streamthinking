/**
 * Gateway type definitions.
 *
 * Defines the message protocol between WebSocket clients and the gateway server,
 * plus the server-side Session data structure.
 *
 * @module
 */

import type { WebSocket } from 'ws';
import type {
  VisualExpression,
  ProtocolOperation,
  AuthorInfo,
} from '@infinicanvas/protocol';

// ── Session ────────────────────────────────────────────────

/** Server-side session state for a collaborative canvas. */
export interface Session {
  /** Unique session identifier. */
  id: string;
  /** All expressions on the canvas, keyed by ID. */
  expressions: Record<string, VisualExpression>;
  /** Ordered list of expression IDs (z-order). */
  expressionOrder: string[];
  /** Connected WebSocket clients. */
  clients: Set<WebSocket>;
  /** Registered AI agents in this session. */
  agents: Map<string, AuthorInfo>;
  /** Unix timestamp (ms) when the session was created. */
  createdAt: number;
  /** Unix timestamp (ms) of the last activity in this session. */
  lastActivity: number;
}

// ── Client → Server Messages ──────────────────────────────

export interface CreateSessionMessage {
  type: 'create-session';
  auth: { apiKey: string };
}

export interface JoinMessage {
  type: 'join';
  sessionId: string;
  auth: { apiKey: string };
}

export interface OperationMessage {
  type: 'operation';
  operation: ProtocolOperation;
}

export interface LeaveMessage {
  type: 'leave';
}

export type ClientMessage =
  | CreateSessionMessage
  | JoinMessage
  | OperationMessage
  | LeaveMessage;

// ── Server → Client Messages ──────────────────────────────

export interface SessionCreatedMessage {
  type: 'session-created';
  sessionId: string;
}

export interface StateSyncMessage {
  type: 'state-sync';
  sessionId: string;
  expressions: VisualExpression[];
  expressionOrder: string[];
}

export interface OperationBroadcast {
  type: 'operation';
  operation: ProtocolOperation;
}

export interface AgentJoinedMessage {
  type: 'agent-joined';
  agent: AuthorInfo;
}

export interface AgentLeftMessage {
  type: 'agent-left';
  agentId: string;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

export type ServerMessage =
  | SessionCreatedMessage
  | StateSyncMessage
  | OperationBroadcast
  | AgentJoinedMessage
  | AgentLeftMessage
  | ErrorMessage;
