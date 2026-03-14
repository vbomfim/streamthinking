/**
 * Agent store — tracks connected agents in a collaborative session.
 *
 * Simple Zustand store for maintaining the list of agents (AI or human)
 * currently participating in the canvas session via the gateway.
 *
 * @module
 */

import { create } from 'zustand';
import type { AuthorInfo } from '@infinicanvas/protocol';

/** Agent store state. */
export interface AgentState {
  /** Currently connected agents/participants. */
  agents: AuthorInfo[];
}

/** Agent store actions. */
export interface AgentActions {
  /** Add an agent to the connected list. Ignores duplicates by id. */
  addAgent: (agent: AuthorInfo) => void;
  /** Remove an agent by id. */
  removeAgent: (agentId: string) => void;
  /** Replace the entire agents list. */
  setAgents: (agents: AuthorInfo[]) => void;
  /** Clear all agents. */
  clearAgents: () => void;
}

export const useAgentStore = create<AgentState & AgentActions>()((set) => ({
  agents: [],

  addAgent: (agent: AuthorInfo) => {
    set((state) => {
      const exists = state.agents.some((a) => a.id === agent.id);
      if (exists) {
        return state;
      }
      return { agents: [...state.agents, agent] };
    });
  },

  removeAgent: (agentId: string) => {
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== agentId),
    }));
  },

  setAgents: (agents: AuthorInfo[]) => {
    set({ agents });
  },

  clearAgents: () => {
    set({ agents: [] });
  },
}));
