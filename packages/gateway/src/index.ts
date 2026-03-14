/**
 * InfiniCanvas Gateway — public API.
 *
 * @module
 */

export { createGateway } from './server.js';
export { SessionManager } from './sessionManager.js';
export { RateLimiter } from './rateLimiter.js';
export { authenticate } from './authMiddleware.js';
export { validateOperation, applyOperation } from './protocolHandler.js';
export { registerAgent, broadcastToOthers } from './agentRegistry.js';
export { log, logError } from './logger.js';

export type {
  Session,
  ClientMessage,
  ServerMessage,
  CreateSessionMessage,
  JoinMessage,
  OperationMessage,
  LeaveMessage,
  SessionCreatedMessage,
  StateSyncMessage,
  OperationBroadcast,
  AgentJoinedMessage,
  AgentLeftMessage,
  ErrorMessage,
} from './types.js';
