/**
 * Root application component.
 *
 * Renders the Canvas component from @infinicanvas/engine
 * with the Toolbar for drawing tools, ExpressionPalette for
 * composite insertion, AgentActions for AI interactions,
 * and AgentSidebar overlay for connected AI agents.
 *
 * @module
 */

import { useCallback } from 'react';
import { Canvas, useCanvasStore, morphExpression } from '@infinicanvas/engine';
import type { VisualExpression, ExpressionKind } from '@infinicanvas/protocol';
import { Toolbar } from './components/toolbar/Toolbar.js';
import { ExpressionPalette } from './components/toolbar/ExpressionPalette.js';
import { AgentActions } from './components/toolbar/AgentActions.js';
import type { AgentActionType } from './components/toolbar/AgentActions.js';
import { AgentSidebar } from './components/sidebar/AgentSidebar.js';
import { StylePanel } from './components/panels/StylePanel.js';

export function App() {
  const addExpression = useCanvasStore((s) => s.addExpression);
  const updateExpression = useCanvasStore((s) => s.updateExpression);
  const expressions = useCanvasStore((s) => s.expressions);
  const selectedIds = useCanvasStore((s) => s.selectedIds);

  /** Get the list of selected expressions. */
  const selectedExpressions: VisualExpression[] = Array.from(selectedIds)
    .map((id) => expressions[id])
    .filter(Boolean) as VisualExpression[];

  /** Insert a new expression from the palette. */
  const handleInsert = useCallback(
    (expression: VisualExpression) => {
      addExpression(expression);
    },
    [addExpression],
  );

  /** Morph an expression to a new kind. */
  const handleMorph = useCallback(
    (expressionId: string, toKind: ExpressionKind) => {
      const expr = expressions[expressionId];
      if (!expr) return;

      const morphed = morphExpression(expr as VisualExpression, toKind);
      if (!morphed) return;

      updateExpression(expressionId, {
        kind: morphed.kind,
        data: morphed.data,
      } as Partial<VisualExpression>);
    },
    [expressions, updateExpression],
  );

  /** Handle agent actions (emit events for MCP server). */
  const handleAgentAction = useCallback(
    (action: AgentActionType, exprs: VisualExpression[]) => {
      // Emit a custom event for the MCP server to handle
      const event = new CustomEvent('infinicanvas:agent-action', {
        detail: { action, expressions: exprs },
      });
      window.dispatchEvent(event);
    },
    [],
  );

  return (
    <>
      <Canvas />
      <Toolbar />
      <StylePanel />
      <ExpressionPalette onInsert={handleInsert} />
      <AgentActions
        selectedExpressions={selectedExpressions}
        onAction={handleAgentAction}
      />
      <AgentSidebar />
    </>
  );
}
