/**
 * Unit tests for agentStore — connected agent tracking.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { AuthorInfo } from '@infinicanvas/protocol';
import { useAgentStore } from '../store/agentStore.js';

// ── Test fixtures ──────────────────────────────────────────

const agent1: AuthorInfo = {
  type: 'agent',
  id: 'agent-1',
  name: 'Claude',
  provider: 'anthropic',
};

const agent2: AuthorInfo = {
  type: 'agent',
  id: 'agent-2',
  name: 'GPT-4',
  provider: 'openai',
};

const humanUser: AuthorInfo = {
  type: 'human',
  id: 'user-1',
  name: 'Alice',
};

// ── Store reset before each test ───────────────────────────

beforeEach(() => {
  useAgentStore.setState({ agents: [] });
});

// ── Tests ──────────────────────────────────────────────────

describe('agentStore', () => {
  describe('initial state', () => {
    it('starts with empty agents list', () => {
      const state = useAgentStore.getState();
      expect(state.agents).toEqual([]);
    });
  });

  describe('addAgent', () => {
    it('adds agent to the list', () => {
      useAgentStore.getState().addAgent(agent1);

      const state = useAgentStore.getState();
      expect(state.agents).toHaveLength(1);
      expect(state.agents[0]).toEqual(agent1);
    });

    it('adds multiple agents', () => {
      useAgentStore.getState().addAgent(agent1);
      useAgentStore.getState().addAgent(agent2);

      const state = useAgentStore.getState();
      expect(state.agents).toHaveLength(2);
    });

    it('does not add duplicate agents (same id)', () => {
      useAgentStore.getState().addAgent(agent1);
      useAgentStore.getState().addAgent(agent1);

      const state = useAgentStore.getState();
      expect(state.agents).toHaveLength(1);
    });

    it('supports human authors too', () => {
      useAgentStore.getState().addAgent(humanUser);

      const state = useAgentStore.getState();
      expect(state.agents).toHaveLength(1);
      expect(state.agents[0]).toEqual(humanUser);
    });
  });

  describe('removeAgent', () => {
    it('removes agent by id', () => {
      useAgentStore.getState().addAgent(agent1);
      useAgentStore.getState().addAgent(agent2);
      useAgentStore.getState().removeAgent('agent-1');

      const state = useAgentStore.getState();
      expect(state.agents).toHaveLength(1);
      expect(state.agents[0]?.id).toBe('agent-2');
    });

    it('does nothing when id not found', () => {
      useAgentStore.getState().addAgent(agent1);
      useAgentStore.getState().removeAgent('nonexistent');

      const state = useAgentStore.getState();
      expect(state.agents).toHaveLength(1);
    });
  });

  describe('setAgents', () => {
    it('replaces entire agents list', () => {
      useAgentStore.getState().addAgent(agent1);
      useAgentStore.getState().setAgents([agent2, humanUser]);

      const state = useAgentStore.getState();
      expect(state.agents).toHaveLength(2);
      expect(state.agents[0]?.id).toBe('agent-2');
      expect(state.agents[1]?.id).toBe('user-1');
    });
  });

  describe('clearAgents', () => {
    it('empties the agents list', () => {
      useAgentStore.getState().addAgent(agent1);
      useAgentStore.getState().addAgent(agent2);
      useAgentStore.getState().clearAgents();

      const state = useAgentStore.getState();
      expect(state.agents).toEqual([]);
    });
  });
});
