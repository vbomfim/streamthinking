// @vitest-environment jsdom
/**
 * Integration tests for AgentSidebar ↔ agentStore interaction.
 *
 * Tests that the sidebar correctly reflects dynamic changes to the
 * agent store — add/remove agents, state transitions, and re-renders.
 * These tests verify component-store integration, NOT internal rendering.
 *
 * Ticket #32 — Copilot CLI Extension
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import type { AuthorInfo } from '@infinicanvas/protocol';
import { useAgentStore } from '@infinicanvas/engine';
import { AgentSidebar } from '../components/sidebar/AgentSidebar.js';

// ── Test fixtures ──────────────────────────────────────────

const agentClaude: AuthorInfo = {
  type: 'agent',
  id: 'agent-claude',
  name: 'Claude',
  provider: 'anthropic',
};

const agentGPT: AuthorInfo = {
  type: 'agent',
  id: 'agent-gpt',
  name: 'GPT-4',
  provider: 'openai',
};

const agentGemini: AuthorInfo = {
  type: 'agent',
  id: 'agent-gemini',
  name: 'Gemini Pro',
  provider: 'google',
};

const humanUser: AuthorInfo = {
  type: 'human',
  id: 'user-1',
  name: 'Test User',
};

// ── Setup ──────────────────────────────────────────────────

beforeEach(() => {
  useAgentStore.setState({ agents: [] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────

describe('AgentSidebar ↔ agentStore integration [COVERAGE]', () => {
  describe('dynamic agent list updates', () => {
    it('[COVERAGE] sidebar updates when agent is added to store after render', () => {
      render(<AgentSidebar />);

      expect(screen.getByText('No agents connected')).toBeTruthy();

      // Simulate agent connecting after render
      act(() => {
        useAgentStore.getState().addAgent(agentClaude);
      });

      expect(screen.queryByText('No agents connected')).toBeNull();
      expect(screen.getByText('Claude')).toBeTruthy();
    });

    it('[COVERAGE] sidebar updates when agent is removed from store', () => {
      useAgentStore.setState({ agents: [agentClaude, agentGPT] });
      render(<AgentSidebar />);

      expect(screen.getByText('Claude')).toBeTruthy();
      expect(screen.getByText('GPT-4')).toBeTruthy();

      // Simulate agent disconnecting
      act(() => {
        useAgentStore.getState().removeAgent('agent-claude');
      });

      expect(screen.queryByText('Claude')).toBeNull();
      expect(screen.getByText('GPT-4')).toBeTruthy();
    });

    it('[COVERAGE] sidebar handles rapid add/remove sequence', () => {
      render(<AgentSidebar />);

      act(() => {
        useAgentStore.getState().addAgent(agentClaude);
        useAgentStore.getState().addAgent(agentGPT);
        useAgentStore.getState().removeAgent('agent-claude');
        useAgentStore.getState().addAgent(agentGemini);
      });

      expect(screen.queryByText('Claude')).toBeNull();
      expect(screen.getByText('GPT-4')).toBeTruthy();
      expect(screen.getByText('Gemini Pro')).toBeTruthy();
    });

    it('[COVERAGE] sidebar shows empty state when all agents are cleared', () => {
      useAgentStore.setState({ agents: [agentClaude, agentGPT] });
      render(<AgentSidebar />);

      act(() => {
        useAgentStore.getState().clearAgents();
      });

      expect(screen.getByText('No agents connected')).toBeTruthy();
    });

    it('[COVERAGE] sidebar reflects setAgents bulk replacement', () => {
      useAgentStore.setState({ agents: [agentClaude] });
      render(<AgentSidebar />);

      act(() => {
        useAgentStore.getState().setAgents([agentGPT, agentGemini]);
      });

      expect(screen.queryByText('Claude')).toBeNull();
      expect(screen.getByText('GPT-4')).toBeTruthy();
      expect(screen.getByText('Gemini Pro')).toBeTruthy();
    });
  });

  describe('activity state integration', () => {
    it('[COVERAGE] active agent transitions: idle → active → idle', () => {
      useAgentStore.setState({ agents: [agentClaude] });

      // Start idle
      const { rerender } = render(<AgentSidebar activeAgentIds={[]} />);
      let dot = screen.getByTestId('activity-dot-agent-claude');
      expect(dot.getAttribute('data-active')).toBe('false');

      // Transition to active
      rerender(<AgentSidebar activeAgentIds={['agent-claude']} />);
      dot = screen.getByTestId('activity-dot-agent-claude');
      expect(dot.getAttribute('data-active')).toBe('true');

      // Transition back to idle
      rerender(<AgentSidebar activeAgentIds={[]} />);
      dot = screen.getByTestId('activity-dot-agent-claude');
      expect(dot.getAttribute('data-active')).toBe('false');
    });

    it('[COVERAGE] multiple agents with different activity states', () => {
      useAgentStore.setState({ agents: [agentClaude, agentGPT, agentGemini] });

      render(<AgentSidebar activeAgentIds={['agent-claude', 'agent-gemini']} />);

      expect(screen.getByTestId('activity-dot-agent-claude').getAttribute('data-active')).toBe('true');
      expect(screen.getByTestId('activity-dot-agent-gpt').getAttribute('data-active')).toBe('false');
      expect(screen.getByTestId('activity-dot-agent-gemini').getAttribute('data-active')).toBe('true');
    });
  });

  describe('collapse/expand with dynamic content [EDGE]', () => {
    it('[EDGE] agents added while sidebar is collapsed appear on expand', () => {
      render(<AgentSidebar />);

      // Collapse
      const header = screen.getByRole('button', { name: /agents/i });
      fireEvent.click(header);

      // Add agent while collapsed
      act(() => {
        useAgentStore.getState().addAgent(agentClaude);
      });

      // Expand — agent should be visible
      fireEvent.click(header);
      expect(screen.getByText('Claude')).toBeTruthy();
    });

    it('[EDGE] multiple collapse/expand cycles maintain consistent state', () => {
      useAgentStore.setState({ agents: [agentClaude] });
      render(<AgentSidebar />);

      const header = screen.getByRole('button', { name: /agents/i });

      for (let i = 0; i < 5; i++) {
        fireEvent.click(header); // collapse
        expect(screen.queryByText('Claude')).toBeNull();
        fireEvent.click(header); // expand
        expect(screen.getByText('Claude')).toBeTruthy();
      }
    });
  });

  describe('human authors in agent list [EDGE]', () => {
    it('[EDGE] renders human users alongside agents', () => {
      useAgentStore.setState({ agents: [agentClaude, humanUser] });

      render(<AgentSidebar />);

      expect(screen.getByText('Claude')).toBeTruthy();
      expect(screen.getByText('Test User')).toBeTruthy();
    });
  });

  describe('accessibility [EDGE]', () => {
    it('[EDGE] collapse button has accessible role and name', () => {
      render(<AgentSidebar />);

      const button = screen.getByRole('button', { name: /agents/i });
      expect(button).toBeTruthy();
    });

    it('[EDGE] status dots have test IDs for automation', () => {
      useAgentStore.setState({ agents: [agentClaude, agentGPT] });
      render(<AgentSidebar />);

      expect(screen.getByTestId('status-dot-agent-claude')).toBeTruthy();
      expect(screen.getByTestId('status-dot-agent-gpt')).toBeTruthy();
      expect(screen.getByTestId('activity-dot-agent-claude')).toBeTruthy();
      expect(screen.getByTestId('activity-dot-agent-gpt')).toBeTruthy();
    });
  });
});
