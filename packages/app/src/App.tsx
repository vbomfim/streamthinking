/**
 * Root application component.
 *
 * Renders the Canvas component from @infinicanvas/engine
 * with the AgentSidebar overlay for connected AI agents.
 *
 * @module
 */

import { Canvas } from '@infinicanvas/engine';
import { AgentSidebar } from './components/sidebar/AgentSidebar.js';

export function App() {
  return (
    <>
      <Canvas />
      <AgentSidebar />
    </>
  );
}
