/**
 * @infinicanvas/engine — public API.
 *
 * Re-exports the canvas store, components, camera math, renderers,
 * hooks, and type definitions.
 *
 * @module
 */

// ── State store ────────────────────────────────────────────
export { useCanvasStore } from './store/canvasStore.js';
export { useAgentStore } from './store/agentStore.js';
export type { AgentState, AgentActions } from './store/agentStore.js';

// ── History ────────────────────────────────────────────────
export { HistoryManager } from './history/historyManager.js';
export type { CanvasSnapshot } from './history/historyManager.js';

// ── Camera math ────────────────────────────────────────────
export {
  screenToWorld,
  worldToScreen,
  applyTransform,
  zoomAtPoint,
} from './camera.js';

// ── Renderers ──────────────────────────────────────────────
export { renderGrid, getGridSpacing } from './renderer/gridRenderer.js';
export { createRenderLoop } from './renderer/renderLoop.js';
export type { RenderLoop, ExpressionProvider } from './renderer/renderLoop.js';
export {
  renderExpressions,
  renderLabel,
  renderArrowhead,
  wrapText,
  clearDrawableCache,
  clearImageCache,
} from './renderer/primitiveRenderer.js';
export { mapStyleToRoughOptions, computeStyleHash } from './renderer/styleMapper.js';
export { isVisible, getWorldViewport } from './renderer/viewportCulling.js';
export type { BoundingBox, WorldViewport } from './renderer/viewportCulling.js';
export { createDrawableCache } from './renderer/drawableCache.js';
export type { DrawableCache } from './renderer/drawableCache.js';

// ── Hooks ──────────────────────────────────────────────────
export { useCanvasInteraction } from './hooks/useCanvasInteraction.js';
export type { CanvasInteraction } from './hooks/useCanvasInteraction.js';
<<<<<<< HEAD
export { useUndoRedoShortcuts } from './hooks/useUndoRedoShortcuts.js';
=======
export { createGatewayConnection } from './hooks/useGatewayConnection.js';
export type {
  GatewayConnectionOptions,
  GatewayConnection,
} from './hooks/useGatewayConnection.js';
>>>>>>> 6369895 (feat(engine): client-side gateway connection — Issue #12)

// ── Components ─────────────────────────────────────────────
export { Canvas } from './components/Canvas.js';
export { ErrorBoundary } from './components/ErrorBoundary.js';

// ── Types ──────────────────────────────────────────────────
export type {
  ToolType,
  Camera,
  CanvasState,
  CanvasActions,
} from './types/index.js';

