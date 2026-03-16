/**
 * Root application component.
 *
 * Renders the Canvas component from @infinicanvas/engine
 * with the Toolbar for drawing tools, ExpressionPalette for
 * composite insertion, AgentActions for AI interactions,
 * AgentSidebar overlay, theme toggle, and export menu.
 *
 * @module
 */

import { useCallback, useState } from 'react';
import { Canvas, useCanvasStore, morphExpression } from '@infinicanvas/engine';
import type { VisualExpression, ExpressionKind } from '@infinicanvas/protocol';
import { Toolbar } from './components/toolbar/Toolbar.js';
import { ExpressionPalette } from './components/toolbar/ExpressionPalette.js';
import { AgentActions } from './components/toolbar/AgentActions.js';
import type { AgentActionType } from './components/toolbar/AgentActions.js';
import { AgentSidebar } from './components/sidebar/AgentSidebar.js';
import { StylePanel } from './components/panels/StylePanel.js';
import { ThemeToggle } from './components/panels/ThemeToggle.js';
import { ExportMenu } from './components/panels/ExportMenu.js';
import { ZoomControls } from './components/panels/ZoomControls.js';
import { SettingsPanel } from './components/panels/SettingsPanel.js';
import { WelcomeScreen } from './components/WelcomeScreen.js';
import { Settings } from 'lucide-react';

export function App() {
  const addExpression = useCanvasStore((s) => s.addExpression);
  const updateExpression = useCanvasStore((s) => s.updateExpression);
  const expressions = useCanvasStore((s) => s.expressions);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const [showSettings, setShowSettings] = useState(false);

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
      <ZoomControls />
      <WelcomeScreen />
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {/* Top-left action bar: theme toggle + export menu + settings */}
      <div
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          display: 'flex',
          gap: 4,
          padding: 4,
          backgroundColor: 'var(--bg-toolbar, #ffffff)',
          borderRadius: 10,
          boxShadow: '0 2px 8px var(--shadow, rgba(0,0,0,0.12))',
          border: '1px solid var(--border, #e0e0e0)',
          zIndex: 20,
        }}
      >
        <ThemeToggle />
        <ExportMenu />
        <button
          type="button"
          aria-label="Settings"
          data-testid="settings-button"
          onClick={() => setShowSettings(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: 'var(--text-primary, #333333)',
            transition: 'background-color 0.15s, color 0.15s',
          }}
        >
          <Settings size={18} />
        </button>
      </div>
    </>
  );
}
