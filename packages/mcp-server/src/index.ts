/**
 * InfiniCanvas MCP Server — public API.
 *
 * Re-exports the server factory, gateway client, defaults,
 * and tool implementations for programmatic usage.
 *
 * @module
 */

// ── Server ─────────────────────────────────────────────────
export { createMcpServer } from './server.js';

// ── Entry point ────────────────────────────────────────────
export { startServer } from './main.js';
export type { StartServerOptions } from './main.js';

// ── Gateway client ─────────────────────────────────────────
export { createGatewayClient, GatewayClient } from './gatewayClient.js';
export type { IGatewayClient, GatewayClientOptions } from './gatewayClient.js';

// ── Defaults ───────────────────────────────────────────────
export {
  DEFAULT_STYLE,
  DEFAULT_TEXT,
  LAYOUT,
  MCP_AUTHOR,
  STICKY_NOTE_COLORS,
  randomStickyColor,
} from './defaults.js';

// ── Primitive tools ────────────────────────────────────────
export {
  buildRectangle,
  buildEllipse,
  buildLine,
  buildArrow,
  buildText,
  buildStickyNote,
} from './tools/primitiveTools.js';
export type {
  DrawRectangleParams,
  DrawEllipseParams,
  DrawLineParams,
  DrawArrowParams,
  DrawTextParams,
  AddStickyNoteParams,
} from './tools/primitiveTools.js';

// ── Composite tools ────────────────────────────────────────
export {
  buildFlowchart,
  buildSequenceDiagram,
  buildMindMap,
  buildReasoningChain,
  buildWireframe,
  buildRoadmap,
  buildKanban,
} from './tools/compositeTools.js';

// ── Annotation tools ───────────────────────────────────────
export {
  buildAnnotation,
  buildHighlight,
  buildComment,
} from './tools/annotationTools.js';

// ── Container tools (#112) ─────────────────────────────────
export {
  buildContainer,
  buildSwimlanes,
} from './tools/containerTools.js';
export type {
  CreateContainerParams,
  CreateSwimlanesParams,
} from './tools/containerTools.js';

// ── Management tools ───────────────────────────────────────
export { formatCanvasState, formatStructuredState, getExpressionLabel } from './tools/managementTools.js';

// ── Query tools ────────────────────────────────────────────
export {
  executeCanvasQuery,
  executeGetExpression,
  intersects,
} from './tools/queryTools.js';
export type { CanvasQueryParams, GetExpressionParams } from './tools/queryTools.js';
