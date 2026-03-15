/**
 * AgentActions — context-aware AI action buttons.
 *
 * Appears when expressions are selected, providing quick-action
 * buttons for AI interactions. The buttons emit events/callbacks —
 * actual AI interaction is handled by the MCP server layer.
 *
 * Actions:
 * - "Explain this" → asks AI to explain the selected expression
 * - "Extend this" → asks AI to add more to the selected composite
 * - "Diagram this" → asks AI to create a diagram from selected text
 *   (only shown for text-type expressions)
 *
 * @module
 */

import {
  MessageCircle,
  Maximize2,
  FileImage,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { VisualExpression } from '@infinicanvas/protocol';

/** Action types emitted by AgentActions. */
export type AgentActionType = 'explain' | 'extend' | 'diagram';

/** Props for AgentActions. */
export interface AgentActionsProps {
  /** Currently selected expressions. */
  selectedExpressions: VisualExpression[];
  /** Callback when an action button is clicked. */
  onAction: (action: AgentActionType, expressions: VisualExpression[]) => void;
}

/** Action button definition. */
interface ActionDefinition {
  action: AgentActionType;
  label: string;
  icon: LucideIcon;
  /** Whether this action is available for the given expression kinds. */
  isAvailable: (expressions: VisualExpression[]) => boolean;
}

/** Text-like expression kinds that support "Diagram this". */
const TEXT_KINDS = new Set(['text', 'sticky-note', 'comment']);

/** All available agent actions. */
const ACTIONS: ActionDefinition[] = [
  {
    action: 'explain',
    label: 'Explain this',
    icon: MessageCircle,
    isAvailable: () => true,
  },
  {
    action: 'extend',
    label: 'Extend this',
    icon: Maximize2,
    isAvailable: () => true,
  },
  {
    action: 'diagram',
    label: 'Diagram this',
    icon: FileImage,
    isAvailable: (expressions) =>
      expressions.length > 0 && expressions.every((e) => TEXT_KINDS.has(e.kind)),
  },
];

/** Icon size for action buttons. */
const ICON_SIZE = 14;

/**
 * AgentActions — floating action bar for AI interactions.
 *
 * Renders only when expressions are selected. Shows context-aware
 * action buttons that emit events for the MCP server to handle.
 */
export function AgentActions({ selectedExpressions, onAction }: AgentActionsProps) {
  if (selectedExpressions.length === 0) {
    return null;
  }

  const availableActions = ACTIONS.filter((a) => a.isAvailable(selectedExpressions));

  if (availableActions.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="agent-actions"
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 4,
        padding: 4,
        backgroundColor: '#1e1e1e',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        border: '1px solid #333',
        zIndex: 30,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {availableActions.map((actionDef) => {
        const Icon = actionDef.icon;
        return (
          <button
            key={actionDef.action}
            type="button"
            aria-label={actionDef.label}
            onClick={() => onAction(actionDef.action, selectedExpressions)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: '#e0e0e0',
              fontSize: 13,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              transition: 'background-color 0.1s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '#333';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <Icon size={ICON_SIZE} />
            <span>{actionDef.label}</span>
          </button>
        );
      })}
    </div>
  );
}
