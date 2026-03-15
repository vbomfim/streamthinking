/**
 * AgentSidebar — collapsible panel showing connected AI agents.
 *
 * Displays agent name, provider, connection status, and activity
 * indicator (pulsing dot) when an AI agent is actively adding
 * expressions to the canvas.
 *
 * Uses the agentStore from @infinicanvas/engine for state.
 *
 * @module
 */

import { useState } from 'react';
import { useAgentStore } from '@infinicanvas/engine';
import type { AuthorInfo } from '@infinicanvas/protocol';

/** Props for the AgentSidebar component. */
export interface AgentSidebarProps {
  /** IDs of agents currently active (adding expressions). */
  activeAgentIds?: string[];
}

/** Extract provider name from AuthorInfo (agents have provider, humans don't). */
function getProvider(agent: AuthorInfo): string {
  return agent.type === 'agent' ? agent.provider : 'local';
}

/** Single agent row within the sidebar list. */
function AgentRow({
  agent,
  isActive,
}: {
  agent: AuthorInfo;
  isActive: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderBottom: '1px solid var(--border, #2a2a2a)',
      }}
    >
      {/* Status dot — green = connected */}
      <span
        data-testid={`status-dot-${agent.id}`}
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#4CAF50',
          flexShrink: 0,
        }}
      />

      {/* Agent info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-primary, #e0e0e0)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {agent.name}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-secondary, #888)',
          }}
        >
          {getProvider(agent)}
        </div>
      </div>

      {/* Activity indicator — pulsing dot when active */}
      <span
        data-testid={`activity-dot-${agent.id}`}
        data-active={isActive ? 'true' : 'false'}
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: isActive ? '#FF9800' : 'transparent',
          animation: isActive ? 'pulse 1.5s ease-in-out infinite' : 'none',
          flexShrink: 0,
        }}
      />
    </div>
  );
}

/**
 * Collapsible sidebar panel displaying connected agents.
 *
 * Shows agent name, provider, connection status (green dot),
 * and a pulsing activity indicator during AI expression creation.
 */
export function AgentSidebar({ activeAgentIds = [] }: AgentSidebarProps) {
  const agents = useAgentStore((state) => state.agents);
  const [isExpanded, setIsExpanded] = useState(true);

  const activeSet = new Set(activeAgentIds);

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        width: '220px',
        backgroundColor: 'var(--bg-panel, #1e1e1e)',
        borderRadius: '8px',
        border: '1px solid var(--border, #333)',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        zIndex: 1000,
        boxShadow: '0 4px 12px var(--shadow-strong, rgba(0, 0, 0, 0.3))',
      }}
    >
      {/* Header — click to collapse/expand */}
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-label="Agents"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '10px 12px',
          backgroundColor: 'transparent',
          border: 'none',
          borderBottom: isExpanded ? '1px solid var(--border, #333)' : 'none',
          cursor: 'pointer',
          color: 'var(--text-primary, #e0e0e0)',
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        <span>Agents</span>
        <span
          style={{
            transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s ease',
            fontSize: '12px',
          }}
        >
          ▼
        </span>
      </button>

      {/* Agent list — visible only when expanded */}
      {isExpanded && (
        <div>
          {agents.length === 0 ? (
            <div
              style={{
                padding: '12px',
                textAlign: 'center',
                color: 'var(--text-secondary, #666)',
                fontSize: '12px',
              }}
            >
              No agents connected
            </div>
          ) : (
            agents.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                isActive={activeSet.has(agent.id)}
              />
            ))
          )}
        </div>
      )}

      {/* CSS animation for pulsing activity dot */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
