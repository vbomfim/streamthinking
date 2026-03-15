// @vitest-environment jsdom
/**
 * Unit tests for AgentSidebar component.
 *
 * Tests the sidebar panel that shows connected agents, their status,
 * and activity indicators. Written FIRST following TDD.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { AuthorInfo } from '@infinicanvas/protocol';
import { useAgentStore } from '@infinicanvas/engine';
import { AgentSidebar } from '../components/sidebar/AgentSidebar.js';

// ── Test fixtures ──────────────────────────────────────────

const agent1: AuthorInfo = {
  type: 'agent',
  id: 'agent-claude',
  name: 'Claude',
  provider: 'anthropic',
};

const agent2: AuthorInfo = {
  type: 'agent',
  id: 'agent-gpt',
  name: 'GPT-4',
  provider: 'openai',
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

describe('AgentSidebar', () => {
  describe('empty state', () => {
    it('renders sidebar with "Agents" heading', () => {
      render(<AgentSidebar />);

      expect(screen.getByText('Agents')).toBeTruthy();
    });

    it('shows "No agents connected" when list is empty', () => {
      render(<AgentSidebar />);

      expect(screen.getByText('No agents connected')).toBeTruthy();
    });
  });

  describe('agent list rendering', () => {
    it('renders agent name and provider', () => {
      useAgentStore.setState({ agents: [agent1] });

      render(<AgentSidebar />);

      expect(screen.getByText('Claude')).toBeTruthy();
      expect(screen.getByText('anthropic')).toBeTruthy();
    });

    it('renders multiple agents', () => {
      useAgentStore.setState({ agents: [agent1, agent2] });

      render(<AgentSidebar />);

      expect(screen.getByText('Claude')).toBeTruthy();
      expect(screen.getByText('GPT-4')).toBeTruthy();
    });

    it('shows connected status indicator', () => {
      useAgentStore.setState({ agents: [agent1] });

      render(<AgentSidebar />);

      const statusDot = screen.getByTestId('status-dot-agent-claude');
      expect(statusDot).toBeTruthy();
    });
  });

  describe('activity indicator', () => {
    it('shows pulsing activity dot when isActive is true', () => {
      useAgentStore.setState({ agents: [agent1] });

      render(<AgentSidebar activeAgentIds={['agent-claude']} />);

      const activityDot = screen.getByTestId('activity-dot-agent-claude');
      expect(activityDot).toBeTruthy();
      // Check for the pulsing animation class/attribute
      expect(activityDot.getAttribute('data-active')).toBe('true');
    });

    it('does not show activity dot when agent is idle', () => {
      useAgentStore.setState({ agents: [agent1] });

      render(<AgentSidebar activeAgentIds={[]} />);

      const activityDot = screen.getByTestId('activity-dot-agent-claude');
      expect(activityDot.getAttribute('data-active')).toBe('false');
    });
  });

  describe('collapse/expand', () => {
    it('starts expanded by default', () => {
      useAgentStore.setState({ agents: [agent1] });

      render(<AgentSidebar />);

      // Agent name should be visible
      expect(screen.getByText('Claude')).toBeTruthy();
    });

    it('collapses when header is clicked', () => {
      useAgentStore.setState({ agents: [agent1] });

      render(<AgentSidebar />);

      const header = screen.getByRole('button', { name: /agents/i });
      fireEvent.click(header);

      // Agent list should be hidden
      expect(screen.queryByText('Claude')).toBeNull();
    });

    it('expands when collapsed header is clicked again', () => {
      useAgentStore.setState({ agents: [agent1] });

      render(<AgentSidebar />);

      const header = screen.getByRole('button', { name: /agents/i });
      // Collapse
      fireEvent.click(header);
      expect(screen.queryByText('Claude')).toBeNull();

      // Expand
      fireEvent.click(header);
      expect(screen.getByText('Claude')).toBeTruthy();
    });
  });
});
