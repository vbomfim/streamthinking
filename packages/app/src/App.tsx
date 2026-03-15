/**
 * Root application component.
 *
 * Renders the Canvas component from @infinicanvas/engine
 * with the Toolbar for drawing tools and AgentSidebar overlay
 * for connected AI agents.
 *
 * @module
 */

import { Canvas } from '@infinicanvas/engine';
import { Toolbar } from './components/toolbar/Toolbar.js';
import { AgentSidebar } from './components/sidebar/AgentSidebar.js';

export function App() {
  return (
    <>
      <Canvas />
      <Toolbar />
      <AgentSidebar />
    </>
  );
}
