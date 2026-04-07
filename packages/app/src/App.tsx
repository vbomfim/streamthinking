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
import { Canvas, useCanvasStore, screenToWorld } from '@infinicanvas/engine';
import type { VisualExpression } from '@infinicanvas/protocol';
import { Toolbar } from './components/toolbar/Toolbar.js';
import { StencilPalette } from './components/toolbar/StencilPalette.js';
import { AgentActions } from './components/toolbar/AgentActions.js';
import type { AgentActionType } from './components/toolbar/AgentActions.js';
import { AgentSidebar } from './components/sidebar/AgentSidebar.js';
import { StylePanel } from './components/panels/StylePanel.js';
import { ThemeToggle } from './components/panels/ThemeToggle.js';
import { ExportMenu } from './components/panels/ExportMenu.js';
import { ZoomControls } from './components/panels/ZoomControls.js';
import { WaypointPanel } from './components/panels/WaypointPanel.js';
import { SettingsPanel } from './components/panels/SettingsPanel.js';
import { ConnectionStatus } from './components/panels/ConnectionStatus.js';
import { WelcomeScreen } from './components/WelcomeScreen.js';
import { useGatewayConnection } from './hooks/useGatewayConnection.js';
import { useAgentActionHandler } from './hooks/useAgentActionHandler.js';
import { Settings } from 'lucide-react';

export function App() {
  const addExpression = useCanvasStore((s) => s.addExpression);
  const expressions = useCanvasStore((s) => s.expressions);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const setSelectedIds = useCanvasStore((s) => s.setSelectedIds);
  const [showSettings, setShowSettings] = useState(false);
  const [showStencilPalette, setShowStencilPalette] = useState(false);
  const waypointPanelOpen = useCanvasStore((s) => s.waypointPanelOpen);
  const setWaypointPanelOpen = useCanvasStore((s) => s.setWaypointPanelOpen);
  const gatewayState = useGatewayConnection();
  const { isLoading: agentLoading } = useAgentActionHandler(
    gatewayState.sendMessage,
    gatewayState.connected,
  );

  /** Get the list of selected expressions. */
  const selectedExpressions: VisualExpression[] = Array.from(selectedIds)
    .map((id) => expressions[id])
    .filter(Boolean) as VisualExpression[];

  /** Insert a new expression from the palette. */
  const handleInsert = useCallback(
    (expression: VisualExpression) => {
      // Place at viewport center with slight random offset to avoid stacking
      const { camera } = useCanvasStore.getState();
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const world = screenToWorld(cx, cy, camera);
      const offset = (Math.random() - 0.5) * 40;

      // Scale size inversely by zoom so inserted items appear consistent on screen
      const w = expression.size.width / camera.zoom;
      const h = expression.size.height / camera.zoom;

      const centered = {
        ...expression,
        position: {
          x: world.x - w / 2 + offset,
          y: world.y - h / 2 + offset,
        },
        size: { width: w, height: h },
      };
      addExpression(centered);
      setSelectedIds(new Set([centered.id]));
    },
    [addExpression, setSelectedIds],
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
      <Toolbar
        onToggleStencilPalette={() => setShowStencilPalette((prev) => !prev)}
        isStencilPaletteOpen={showStencilPalette}
        onToggleWaypointPanel={() => setWaypointPanelOpen(!waypointPanelOpen)}
        isWaypointPanelOpen={waypointPanelOpen}
      />
      <StylePanel />
      <StencilPalette onInsert={handleInsert} isOpen={showStencilPalette} />
      <AgentActions
        selectedExpressions={selectedExpressions}
        onAction={handleAgentAction}
        isLoading={agentLoading}
      />
      <AgentSidebar />
      <ZoomControls />
      <WaypointPanel isOpen={waypointPanelOpen} />
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
        <ConnectionStatus {...gatewayState} />
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
