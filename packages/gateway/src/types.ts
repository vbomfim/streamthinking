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

// ── Waypoints ──────────────────────────────────────────────

/** A saved camera position for presentation-mode navigation. */
export interface CameraWaypoint {
  x: number;
  y: number;
  zoom: number;
  label?: string;
}

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
  /** Saved camera waypoints for presentation mode. */
  waypoints: CameraWaypoint[];
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

/** Human user requesting an AI agent action on selected expressions. */
export interface AgentRequestMessage {
  type: 'agent-request';
  /** Unique request identifier for tracking. */
  requestId: string;
  /** Action requested: explain, extend, or diagram. */
  action: string;
  /** Context about selected expressions and suggested placement. */
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
  /** Human-readable prompt describing what the AI should do. */
  prompt: string;
}

/** Add a waypoint to the session's waypoint list. */
export interface WaypointAddMessage {
  type: 'waypoint-add';
  waypoint: CameraWaypoint;
}

/** Remove a waypoint by index. */
export interface WaypointRemoveMessage {
  type: 'waypoint-remove';
  index: number;
}

/** Reorder a waypoint from one index to another. */
export interface WaypointReorderMessage {
  type: 'waypoint-reorder';
  fromIndex: number;
  toIndex: number;
}

/** Request a screenshot of the canvas from a connected browser client. */
export interface ScreenshotRequestMessage {
  type: 'screenshot-request';
  requestId: string;
}

/** Browser response containing a base64-encoded PNG screenshot. */
export interface ScreenshotResponseMessage {
  type: 'screenshot-response';
  requestId: string;
  imageBase64: string;
  width: number;
  height: number;
}

export type ClientMessage =
  | CreateSessionMessage
  | JoinMessage
  | OperationMessage
  | LeaveMessage
  | AgentRequestMessage
  | IdentifyMessage
  | WaypointAddMessage
  | WaypointRemoveMessage
  | WaypointReorderMessage
  | ScreenshotRequestMessage
  | ScreenshotResponseMessage;

/** Client identifies itself as an agent (sent after joining a session). */
export interface IdentifyMessage {
  type: 'identify';
  agent: AuthorInfo;
}

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
  waypoints?: CameraWaypoint[];
  agents?: AuthorInfo[];
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

/** Broadcast a waypoint addition to other clients. */
export interface WaypointAddBroadcast {
  type: 'waypoint-add';
  waypoint: CameraWaypoint;
}

/** Broadcast a waypoint removal to other clients. */
export interface WaypointRemoveBroadcast {
  type: 'waypoint-remove';
  index: number;
}

/** Broadcast a waypoint reorder to other clients. */
export interface WaypointReorderBroadcast {
  type: 'waypoint-reorder';
  fromIndex: number;
  toIndex: number;
}

export type ServerMessage =
  | SessionCreatedMessage
  | StateSyncMessage
  | OperationBroadcast
  | AgentJoinedMessage
  | AgentLeftMessage
  | ErrorMessage
  | WaypointAddBroadcast
  | WaypointRemoveBroadcast
  | WaypointReorderBroadcast;
