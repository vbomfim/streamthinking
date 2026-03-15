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

// ── Management tools ───────────────────────────────────────
export { formatCanvasState } from './tools/managementTools.js';
