/**
 * Agent registry for collaborative sessions.
 *
 * Tracks AI agents that participate in a session. When an operation
 * is authored by an agent, the agent is automatically registered
 * and an `agent-joined` message is broadcast to other clients.
 *
 * @module
 */

import type { WebSocket } from 'ws';
import type { AuthorInfo } from '@infinicanvas/protocol';
import type { Session, AgentJoinedMessage } from './types.js';
import { log } from './logger.js';

/**
 * Register an agent in the session if not already known.
 * Returns an `agent-joined` message to broadcast, or `null` if the agent was already registered.
 */
export function registerAgent(
  session: Session,
  author: AuthorInfo,
): AgentJoinedMessage | null {
  if (author.type !== 'agent') return null;

  if (session.agents.has(author.id)) return null;

  session.agents.set(author.id, author);
  log('agent_registered', { sessionId: session.id, agentId: author.id, agentName: author.name });

  return { type: 'agent-joined', agent: author };
}

/**
 * Broadcast a message to all clients in a session except the sender.
 */
export function broadcastToOthers(
  session: Session,
  sender: WebSocket,
  message: unknown,
): void {
  const data = JSON.stringify(message);
  for (const client of session.clients) {
    if (client !== sender && client.readyState === client.OPEN) {
      client.send(data);
    }
  }
}
