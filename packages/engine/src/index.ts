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
export type { RenderLoop, ExpressionProvider, SelectionProvider } from './renderer/renderLoop.js';
export {
  renderExpressions,
  renderLabel,
  renderArrowhead,
  wrapText,
  clearDrawableCache,
  clearImageCache,
} from './renderer/primitiveRenderer.js';
export { mapStyleToRoughOptions, computeStyleHash, computeRenderHash } from './renderer/styleMapper.js';
export { isVisible, getWorldViewport } from './renderer/viewportCulling.js';
export type { BoundingBox, WorldViewport } from './renderer/viewportCulling.js';
export { createDrawableCache } from './renderer/drawableCache.js';
export type { DrawableCache, RenderContext } from './renderer/drawableCache.js';
export { renderSelection } from './renderer/selectionRenderer.js';

// ── Interaction ────────────────────────────────────────────
export {
  hitTestRectangle,
  hitTestEllipse,
  hitTestDiamond,
  hitTestLine,
  hitTestArrow,
  hitTestFreehand,
  hitTestText,
  hitTestStickyNote,
  hitTestImage,
  hitTestExpression,
} from './interaction/hitTest.js';
export type { WorldPoint } from './interaction/hitTest.js';
export {
  findExpressionAtPoint,
  findExpressionsInMarquee,
} from './interaction/selectionManager.js';
export type { Marquee } from './interaction/selectionManager.js';

// ── Persistence ────────────────────────────────────────────
export { saveCanvasState, loadCanvasState, STORAGE_KEY } from './persistence/localStorage.js';
export type { PersistedCanvasState } from './persistence/localStorage.js';

// ── Hooks ──────────────────────────────────────────────────
export { useCanvasInteraction } from './hooks/useCanvasInteraction.js';
export type { CanvasInteraction } from './hooks/useCanvasInteraction.js';
export { useUndoRedoShortcuts } from './hooks/useUndoRedoShortcuts.js';
export { useSelectionInteraction } from './hooks/useSelectionInteraction.js';
export type { SelectionInteraction, MarqueeRect } from './hooks/useSelectionInteraction.js';
export { subscribeAutoSave, DEBOUNCE_MS } from './hooks/useAutoSave.js';
export { createGatewayConnection } from './hooks/useGatewayConnection.js';
export type {
  GatewayConnectionOptions,
  GatewayConnection,
} from './hooks/useGatewayConnection.js';

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

