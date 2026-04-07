/**
 * InfiniCanvas MCP Server — canvas tools for AI agents.
 *
 * Registers MCP tools that allow any AI model (Copilot CLI, GPT, Claude)
 * to draw diagrams, annotate, and manage visual expressions on the canvas
 * via standard Model Context Protocol tool calling.
 *
 * Architecture:
 * ```
 * AI Model (any model with tool calling)
 *   ↓ MCP tool calls (stdio transport)
 * MCP Server (this module)
 *   ↓ WebSocket
 * Gateway Server (packages/gateway)
 *   ↓ broadcast
 * Browser Canvas (packages/app)
 * ```
 *
 * @module
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { type IGatewayClient } from './gatewayClient.js';

// ── Tool executors ─────────────────────────────────────────
import {
  executeDrawRectangle,
  executeDrawEllipse,
  executeDrawLine,
  executeDrawArrow,
  executeDrawText,
  executeAddStickyNote,
} from './tools/primitiveTools.js';
import {
  executeDrawFlowchart,
  executeDrawSequenceDiagram,
  executeDrawMindMap,
  executeDrawReasoningChain,
  executeDrawWireframe,
  executeDrawRoadmap,
  executeDrawKanban,
} from './tools/compositeTools.js';
import {
  executeAnnotate,
  executeHighlight,
  executeAddComment,
} from './tools/annotationTools.js';
import {
  executeGetState,
  executeClear,
  executeDeleteExpression,
  executeMorph,
  formatStructuredState,
} from './tools/managementTools.js';
import {
  executeCanvasQuery,
  executeGetExpression,
} from './tools/queryTools.js';
import {
  executeCanvasSave,
  executeCanvasLoad,
  executeCanvasListSaves,
} from './tools/persistenceTools.js';
import {
  executePlaceStencil,
  executeListStencils,
} from './tools/stencilTools.js';
import { executeCatalog } from './tools/catalogTool.js';
import {
  executeAddWaypoint,
  executeListWaypoints,
  executeRemoveWaypoint,
} from './tools/waypointTools.js';
import {
  executeExportDrawio,
  executeImportDrawio,
} from './tools/drawioTools.js';
import {
  executeApplyTheme,
  executeListThemes,
} from './tools/themeTools.js';
import {
  executeListLayers,
  executeAddLayer,
  executeSetActiveLayer,
  executeToggleLayerVisibility,
  executeMoveToLayer,
} from './tools/layerTools.js';
import type { ILayerGatewayClient } from './tools/layerTools.js';

// ── Zod schemas for tool parameters ────────────────────────

const pointArraySchema = z.array(z.tuple([z.number(), z.number()]));
const fillStyleSchema = z.enum(['solid', 'hachure', 'cross-hatch', 'none']);
const flowNodeShapeSchema = z.enum(['rect', 'diamond', 'ellipse', 'parallelogram', 'cylinder']);
const messageTypeSchema = z.enum(['sync', 'async', 'reply']);
const wireframeComponentTypeSchema = z.enum(['button', 'input', 'text', 'image', 'container', 'nav', 'list']);
const roadmapStatusSchema = z.enum(['planned', 'in-progress', 'done']);
const roadmapOrientationSchema = z.enum(['horizontal', 'vertical']);
const calloutPositionSchema = z.enum(['top', 'right', 'bottom', 'left']);
const flowDirectionSchema = z.enum(['TB', 'LR', 'BT', 'RL']);

// ── Server creation ────────────────────────────────────────

/**
 * Create and configure the MCP server with all canvas tools registered.
 *
 * The server uses stdio transport for Copilot CLI integration and
 * connects to the gateway WebSocket server for canvas operations.
 */
export function createMcpServer(gatewayClient: IGatewayClient): McpServer {
  const server = new McpServer({
    name: 'infinicanvas',
    version: '0.1.0',
  });

  // ── Primitive expression tools ─────────────────────────

  server.tool(
    'canvas_draw_rectangle',
    'Draw a rectangle on the canvas. Use for boxes, containers, cards, or any rectangular element. Recommended sizes: small (120×60), medium (160×80), large (200×120). Leave 40-60px gaps between objects.',
    {
      x: z.number().describe('X position on the canvas'),
      y: z.number().describe('Y position on the canvas'),
      width: z.number().positive().describe('Width of the rectangle'),
      height: z.number().positive().describe('Height of the rectangle'),
      label: z.string().optional().describe('Text label inside the rectangle'),
      strokeColor: z.string().optional().describe('Border color in hex (e.g. "#FF0000")'),
      backgroundColor: z.string().optional().describe('Fill color in hex or "transparent"'),
      fillStyle: fillStyleSchema.optional().describe('Fill rendering style'),
    },
    async (params) => {
      const result = await executeDrawRectangle(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_draw_ellipse',
    'Draw an ellipse (circle/oval) on the canvas. Use for start/end nodes, bubbles, or circular elements.',
    {
      x: z.number().describe('X position on the canvas'),
      y: z.number().describe('Y position on the canvas'),
      width: z.number().positive().describe('Width of the ellipse'),
      height: z.number().positive().describe('Height of the ellipse'),
      label: z.string().optional().describe('Text label inside the ellipse'),
    },
    async (params) => {
      const result = await executeDrawEllipse(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_draw_line',
    'Draw a line connecting multiple points. Use for connectors, separators, or freeform paths.',
    {
      points: pointArraySchema.min(2).describe('Array of [x, y] coordinate pairs (minimum 2 points)'),
    },
    async (params) => {
      const result = await executeDrawLine(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_draw_arrow',
    'Draw an arrow connecting multiple points. Use for directional connections, flow indicators, or pointers. Connect to nearest edges: if target is below, use source bottom → target top. If target is right, use source right → target left.',
    {
      points: pointArraySchema.min(2).describe('Array of [x, y] coordinate pairs (minimum 2 points)'),
      label: z.string().optional().describe('Label text for the arrow'),
    },
    async (params) => {
      const result = await executeDrawArrow(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_draw_text',
    'Place text on the canvas. Use for labels, headings, descriptions, or any textual content. Font sizes: title=18, label=14, body=12, caption=10. Use fontFamily \'sans-serif\' for clean text.',
    {
      x: z.number().describe('X position on the canvas'),
      y: z.number().describe('Y position on the canvas'),
      text: z.string().min(1).describe('The text content to display'),
      fontSize: z.number().positive().optional().describe('Font size in pixels (default: 14)'),
      fontFamily: z.string().optional().describe('Font family name (default: "sans-serif")'),
    },
    async (params) => {
      const result = await executeDrawText(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_add_sticky_note',
    'Add a sticky note to the canvas. Use for quick notes, reminders, or informal annotations. Good for annotations and card-style content. Default size 200×200. Use width/height params to customize.',
    {
      x: z.number().describe('X position on the canvas'),
      y: z.number().describe('Y position on the canvas'),
      text: z.string().min(1).describe('Note text content'),
      color: z.string().optional().describe('Background color in hex (default: random pastel)'),
    },
    async (params) => {
      const result = await executeAddStickyNote(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // ── Composite expression tools ─────────────────────────

  server.tool(
    'canvas_draw_flowchart',
    'Call canvas_catalog first to understand available elements and layout guidelines. Draw a flowchart diagram. Use for process flows, decision trees, algorithms, or any step-by-step visualization. Nodes are auto-laid out in a grid with 60px horizontal and 80px vertical spacing.',
    {
      title: z.string().min(1).describe('Title of the flowchart'),
      nodes: z.array(z.object({
        id: z.string().describe('Unique node identifier'),
        label: z.string().describe('Display text for the node'),
        shape: flowNodeShapeSchema.optional().describe('Node shape (default: "rect")'),
      })).min(1).describe('Flowchart nodes'),
      edges: z.array(z.object({
        from: z.string().describe('Source node ID'),
        to: z.string().describe('Target node ID'),
        label: z.string().optional().describe('Edge label text'),
      })).describe('Connections between nodes'),
      direction: flowDirectionSchema.optional().describe('Layout direction: TB (top-bottom), LR (left-right), BT, RL'),
      x: z.number().optional().describe('X position on the canvas'),
      y: z.number().optional().describe('Y position on the canvas'),
    },
    async (params) => {
      const result = await executeDrawFlowchart(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_draw_sequence_diagram',
    'Call canvas_catalog first to understand available elements and layout guidelines. Draw a sequence diagram showing interactions between participants over time. Use for API flows, protocol designs, or system interactions.',
    {
      title: z.string().min(1).describe('Title of the sequence diagram'),
      participants: z.array(z.object({
        id: z.string().describe('Unique participant identifier'),
        name: z.string().describe('Display name for the participant'),
      })).min(1).describe('Sequence diagram participants (actors/systems)'),
      messages: z.array(z.object({
        from: z.string().describe('Sender participant ID'),
        to: z.string().describe('Receiver participant ID'),
        label: z.string().describe('Message description'),
        type: messageTypeSchema.optional().describe('Message type: sync, async, or reply'),
      })).describe('Messages exchanged between participants'),
      x: z.number().optional().describe('X position on the canvas'),
      y: z.number().optional().describe('Y position on the canvas'),
    },
    async (params) => {
      const result = await executeDrawSequenceDiagram(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  const mindMapBranchSchema: z.ZodType<{ id: string; label: string; children: unknown[] }> = z.object({
    id: z.string().describe('Branch identifier'),
    label: z.string().describe('Branch label text'),
    children: z.lazy(() => z.array(mindMapBranchSchema)).describe('Sub-branches'),
  });

  server.tool(
    'canvas_draw_mind_map',
    'Call canvas_catalog first to understand available elements and layout guidelines. Draw a mind map radiating from a central topic. Use for brainstorming, concept exploration, or hierarchical idea organization.',
    {
      centralTopic: z.string().min(1).describe('Central topic of the mind map'),
      branches: z.array(mindMapBranchSchema).min(1).describe('Main branches radiating from the center'),
      x: z.number().optional().describe('X position on the canvas'),
      y: z.number().optional().describe('Y position on the canvas'),
    },
    async (params) => {
      const result = await executeDrawMindMap(gatewayClient, params as Parameters<typeof executeDrawMindMap>[1]);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_draw_reasoning_chain',
    'Call canvas_catalog first to understand available elements and layout guidelines. Draw a visual reasoning chain showing step-by-step thinking. Use for explaining logic, problem-solving, or showing thought process.',
    {
      question: z.string().min(1).describe('The question or problem being reasoned about'),
      steps: z.array(z.object({
        title: z.string().describe('Step title or heading'),
        content: z.string().describe('Step explanation or reasoning'),
      })).min(1).describe('Reasoning steps from question to answer'),
      finalAnswer: z.string().min(1).describe('The final conclusion or answer'),
      x: z.number().optional().describe('X position on the canvas'),
      y: z.number().optional().describe('Y position on the canvas'),
    },
    async (params) => {
      const result = await executeDrawReasoningChain(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_draw_wireframe',
    'Call canvas_catalog first to understand available elements and layout guidelines. Draw a UI wireframe with positioned components. Use for mockups, UI prototyping, or screen design.',
    {
      title: z.string().min(1).describe('Title of the wireframe/screen'),
      screenSize: z.object({
        width: z.number().positive().describe('Screen width in pixels'),
        height: z.number().positive().describe('Screen height in pixels'),
      }).describe('Target screen dimensions'),
      components: z.array(z.object({
        type: wireframeComponentTypeSchema.describe('UI component type'),
        label: z.string().describe('Component label or placeholder text'),
        x: z.number().describe('X position within the screen'),
        y: z.number().describe('Y position within the screen'),
        width: z.number().positive().describe('Component width'),
        height: z.number().positive().describe('Component height'),
      })).describe('UI components to place on the wireframe'),
      x: z.number().optional().describe('X position on the canvas'),
      y: z.number().optional().describe('Y position on the canvas'),
    },
    async (params) => {
      const result = await executeDrawWireframe(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_draw_roadmap',
    'Call canvas_catalog first to understand available elements and layout guidelines. Draw a project roadmap with phases and items. Use for project planning, release schedules, or milestone tracking.',
    {
      title: z.string().min(1).describe('Roadmap title'),
      orientation: roadmapOrientationSchema.optional().describe('Layout orientation (default: "horizontal")'),
      phases: z.array(z.object({
        id: z.string().describe('Phase identifier'),
        name: z.string().describe('Phase name'),
        items: z.array(z.object({
          id: z.string().describe('Item identifier'),
          title: z.string().describe('Item title'),
          status: roadmapStatusSchema.describe('Item status: planned, in-progress, or done'),
        })).describe('Items within this phase'),
      })).min(1).describe('Roadmap phases/milestones'),
      x: z.number().optional().describe('X position on the canvas'),
      y: z.number().optional().describe('Y position on the canvas'),
    },
    async (params) => {
      const result = await executeDrawRoadmap(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_draw_kanban',
    'Call canvas_catalog first to understand available elements and layout guidelines. Draw a kanban board with columns and cards. Use for task management, sprint boards, or workflow visualization.',
    {
      title: z.string().min(1).describe('Board title'),
      columns: z.array(z.object({
        id: z.string().describe('Column identifier'),
        title: z.string().describe('Column heading'),
        cards: z.array(z.object({
          id: z.string().describe('Card identifier'),
          title: z.string().describe('Card title'),
          description: z.string().optional().describe('Card description'),
        })).describe('Cards in this column'),
      })).min(1).describe('Board columns'),
      x: z.number().optional().describe('X position on the canvas'),
      y: z.number().optional().describe('Y position on the canvas'),
    },
    async (params) => {
      const result = await executeDrawKanban(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // ── Annotation tools ───────────────────────────────────

  server.tool(
    'canvas_annotate',
    'Add an annotation (callout) to an existing element. Use to add explanations, notes, or pointers to specific elements.',
    {
      targetId: z.string().min(1).describe('ID of the element to annotate'),
      text: z.string().min(1).describe('Annotation text'),
      position: calloutPositionSchema.optional().describe('Position relative to target (default: "right")'),
    },
    async (params) => {
      const result = await executeAnnotate(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_highlight',
    'Highlight one or more elements on the canvas. Use to draw attention to important elements or mark selections.',
    {
      elementIds: z.array(z.string()).min(1).describe('IDs of elements to highlight'),
      color: z.string().optional().describe('Highlight color in hex (default: "#FFEB3B")'),
    },
    async (params) => {
      const result = await executeHighlight(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_add_comment',
    'Add a comment to an existing element. Use for code-review style comments or discussion threads.',
    {
      targetId: z.string().min(1).describe('ID of the element to comment on'),
      text: z.string().min(1).describe('Comment text'),
    },
    async (params) => {
      const result = await executeAddComment(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // ── Canvas management tools ────────────────────────────

  server.tool(
    'canvas_get_state',
    'Get the current state of the canvas — lists all expressions with their IDs, kinds, positions, and labels. Use to inspect what is currently on the canvas before making changes.',
    {},
    async () => {
      const textResult = await executeGetState(gatewayClient);
      const structuredResult = formatStructuredState(gatewayClient.getState());
      return {
        content: [
          { type: 'text' as const, text: textResult },
          { type: 'text' as const, text: structuredResult },
        ],
      };
    },
  );

  server.tool(
    'canvas_clear',
    'Clear all expressions from the canvas. Use to start with a blank canvas.',
    {},
    async () => {
      const result = await executeClear(gatewayClient);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_delete_expression',
    'Delete one or more expressions from the canvas by their IDs. Use canvas_get_state or canvas_query to find expression IDs first.',
    {
      expressionIds: z.array(z.string()).min(1).describe('Array of expression IDs to delete'),
    },
    async (params) => {
      const result = await executeDeleteExpression(gatewayClient, params.expressionIds);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_morph',
    'Morph an expression from one visual kind to another (e.g., rectangle → ellipse). Preserves the label if possible.',
    {
      elementId: z.string().min(1).describe('ID of the element to morph'),
      toKind: z.enum([
        'rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'freehand', 'text', 'sticky-note', 'image',
        'flowchart', 'sequence-diagram', 'collaboration-diagram', 'wireframe', 'roadmap', 'mind-map',
        'kanban', 'reasoning-chain', 'decision-tree', 'slide', 'code-block', 'table',
        'comment', 'callout', 'highlight', 'marker',
      ]).describe('Target expression kind (e.g., "rectangle", "ellipse", "diamond", "text", "sticky-note")'),
    },
    async (params) => {
      const result = await executeMorph(gatewayClient, {
        elementId: params.elementId,
        toKind: params.toKind,
      });
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_move_expression',
    'Move an expression to a new position on the canvas.',
    {
      expressionId: z.string().describe('ID of the expression to move'),
      x: z.number().describe('New X position'),
      y: z.number().describe('New Y position'),
    },
    async (params) => {
      const expressions = gatewayClient.getState();
      const target = expressions.find((e) => e.id === params.expressionId);
      if (!target) {
        throw new Error(`Expression '${params.expressionId}' not found on canvas`);
      }
      const oldX = target.position.x;
      const oldY = target.position.y;
      await gatewayClient.sendUpdate(params.expressionId, {
        position: { x: params.x, y: params.y },
      });
      return {
        content: [{
          type: 'text' as const,
          text: `Moved expression '${params.expressionId}' from (${oldX}, ${oldY}) to (${params.x}, ${params.y}).`,
        }],
      };
    },
  );

  server.tool(
    'canvas_resize_expression',
    'Resize an expression on the canvas.',
    {
      expressionId: z.string().describe('ID of the expression to resize'),
      width: z.number().positive().describe('New width'),
      height: z.number().positive().describe('New height'),
    },
    async (params) => {
      const expressions = gatewayClient.getState();
      const target = expressions.find((e) => e.id === params.expressionId);
      if (!target) {
        throw new Error(`Expression '${params.expressionId}' not found on canvas`);
      }
      const oldW = target.size.width;
      const oldH = target.size.height;
      await gatewayClient.sendUpdate(params.expressionId, {
        size: { width: params.width, height: params.height },
      });
      return {
        content: [{
          type: 'text' as const,
          text: `Resized expression '${params.expressionId}' from ${oldW}×${oldH} to ${params.width}×${params.height}.`,
        }],
      };
    },
  );

  // ── Query tools ──────────────────────────────────────────

  server.tool(
    'canvas_query',
    'Query the canvas for expressions matching filters. Use to find specific elements by kind, position, tags, or label text.',
    {
      kind: z.string().optional().describe('Filter by expression kind (e.g. "rectangle", "text", "flowchart")'),
      bounds: z.object({
        x: z.number().describe('Left edge of the query region'),
        y: z.number().describe('Top edge of the query region'),
        width: z.number().positive().describe('Width of the query region'),
        height: z.number().positive().describe('Height of the query region'),
      }).optional().describe('Bounding box to filter expressions by overlap (not strict containment)'),
      tags: z.array(z.string()).optional().describe('Filter expressions that have ALL of these tags'),
      labelContains: z.string().optional().describe('Filter expressions whose label contains this text (case-insensitive)'),
    },
    async (params) => {
      const result = await executeCanvasQuery(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_get_expression',
    'Get full details of a specific canvas expression by ID. Use after canvas_query to inspect complete data.',
    {
      expressionId: z.string().min(1).describe('ID of the expression to retrieve'),
    },
    async (params) => {
      const result = await executeGetExpression(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // ── Pending requests tool ─────────────────────────────

  server.tool(
    'canvas_pending_requests',
    'Get pending action requests from the human user. Check this periodically to see if the user wants you to explain, extend, or diagram something on the canvas. Returns requests and clears the queue.',
    {},
    async () => {
      const requests = gatewayClient.getPendingRequests();

      if (requests.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: 'No pending requests from the user.',
          }],
        };
      }

      const lines = requests.map((req, i) => {
        const exprSummary = req.context.expressions
          .map((e) => `${e.kind}${e.label ? ` "${e.label}"` : ''} (id: ${e.id})`)
          .join(', ');

        return [
          `--- Request ${i + 1} ---`,
          `Request ID: ${req.requestId}`,
          `Action: ${req.action}`,
          `Selected: ${exprSummary}`,
          `Suggested position: (${req.context.suggestedPosition.x}, ${req.context.suggestedPosition.y})`,
          `Prompt: ${req.prompt}`,
        ].join('\n');
      });

      return {
        content: [{
          type: 'text' as const,
          text: `${requests.length} pending request(s):\n\n${lines.join('\n\n')}`,
        }],
      };
    },
  );

  // ── Persistence tools ──────────────────────────────────────

  server.tool(
    'canvas_save',
    'Save the current canvas state to a named file. Use to preserve diagrams for later restoration.',
    {
      name: z.string().min(1).describe('Name for the saved diagram (e.g., "architecture-v1")'),
      description: z.string().optional().describe('Optional description of what this diagram shows'),
    },
    async (args) => ({
      content: [{ type: 'text' as const, text: executeCanvasSave(gatewayClient, args) }],
    }),
  );

  server.tool(
    'canvas_load',
    'Load a previously saved canvas diagram by name. Restores all expressions onto the canvas.',
    {
      name: z.string().min(1).describe('Name of the saved diagram to load'),
    },
    async (args) => ({
      content: [{ type: 'text' as const, text: await executeCanvasLoad(gatewayClient, args) }],
    }),
  );

  server.tool(
    'canvas_list_saves',
    'List all saved canvas diagrams. Use to discover available diagrams before loading.',
    {},
    async () => ({
      content: [{ type: 'text' as const, text: executeCanvasListSaves() }],
    }),
  );

  // ── Stencil tools ──────────────────────────────────────────

  server.tool(
    'canvas_place_stencil',
    'Place a pre-built stencil icon on the canvas. Use for architecture diagrams with servers, databases, Kubernetes resources, Azure services, etc. Check canvas_catalog for available stencils with sizes. Container stencils (zones, clusters) are 200×150+. Icon stencils are 44×44.',
    {
      stencilId: z.string().describe("Stencil identifier (e.g., 'server', 'k8s-pod', 'database')"),
      x: z.number().describe('X position on the canvas'),
      y: z.number().describe('Y position on the canvas'),
      label: z.string().optional().describe('Text label for the stencil'),
      labelPosition: z.enum(['below', 'top-left', 'top-center', 'center']).optional().describe("Label position relative to stencil. Default: 'below' for icons, use 'top-left' for containers"),
      fontSize: z.number().optional().describe('Label font size in pixels. Default: auto-scales with stencil size'),
      width: z.number().positive().optional().describe('Override width'),
      height: z.number().positive().optional().describe('Override height'),
    },
    async (params) => ({
      content: [{ type: 'text' as const, text: await executePlaceStencil(gatewayClient, params) }],
    }),
  );

  server.tool(
    'canvas_list_stencils',
    'List available stencil icons, optionally filtered by category. Categories: network, azure, generic-it, architecture, kubernetes, azure-arm.',
    {
      category: z.string().optional().describe('Filter by category (e.g., "network", "kubernetes")'),
    },
    async (params) => ({
      content: [{ type: 'text' as const, text: await executeListStencils(params) }],
    }),
  );

  // ── Waypoint tools ───────────────────────────────────────

  server.tool(
    'canvas_add_waypoint',
    'Add a camera waypoint (bookmark) to the canvas. Use to save camera positions for presentation mode navigation.',
    {
      x: z.number().describe('X position on the canvas'),
      y: z.number().describe('Y position on the canvas'),
      zoom: z.number().describe('Zoom level'),
      label: z.string().optional().describe('Optional label for the waypoint'),
    },
    async (params) => ({
      content: [{ type: 'text' as const, text: executeAddWaypoint(gatewayClient, params) }],
    }),
  );

  server.tool(
    'canvas_list_waypoints',
    'List all camera waypoints in the current session. Returns saved camera positions for presentation mode.',
    {},
    async () => ({
      content: [{ type: 'text' as const, text: executeListWaypoints(gatewayClient) }],
    }),
  );

  server.tool(
    'canvas_remove_waypoint',
    'Remove a waypoint by its 1-based index. Use canvas_list_waypoints to see indices.',
    {
      index: z.number().min(1).describe('1-based index of the waypoint to remove'),
    },
    async (params) => ({
      content: [{ type: 'text' as const, text: executeRemoveWaypoint(gatewayClient, params) }],
    }),
  );

  // ── draw.io export/import tools ────────────────────────────

  server.tool(
    'canvas_export_drawio',
    'Export the current canvas as draw.io XML. Returns mxGraphModel XML that can be opened in draw.io/diagrams.net. No parameters needed.',
    {},
    async () => ({
      content: [{ type: 'text' as const, text: executeExportDrawio(gatewayClient) }],
    }),
  );

  server.tool(
    'canvas_import_drawio',
    'Import a draw.io XML file onto the canvas. Parses mxGraphModel XML and creates visual expressions for each cell. Returns the count of imported expressions.',
    {
      xml: z.string().min(1).describe('The draw.io XML content (mxGraphModel format)'),
    },
    async (args) => ({
      content: [{ type: 'text' as const, text: await executeImportDrawio(gatewayClient, args) }],
    }),
  );

  // ── Catalog tool ─────────────────────────────────────────

  server.tool(
    'canvas_catalog',
    "Get the complete catalog of available canvas elements, stencils, layout guidelines, and best practices for creating diagrams. Call this first to understand what's available.",
    {
      section: z
        .string()
        .optional()
        .describe(
          'Optional section filter: primitives, stencils, layout, fonts, arrows. Omit for full catalog.',
        ),
    },
    async (params) => ({
      content: [{ type: 'text' as const, text: executeCatalog(params) }],
    }),
  );

  // ── Screenshot tool ───────────────────────────────────────

  server.tool(
    'canvas_screenshot',
    'Take a screenshot of the current canvas. Returns a base64-encoded PNG image. Use this to visually verify your diagram and make adjustments.',
    {},
    async () => {
      try {
        const result = await gatewayClient.requestScreenshot(10000);
        const base64Data = result.imageBase64.replace(/^data:image\/png;base64,/, '');
        const sizeKB = Math.round(base64Data.length / 1024);

        // Save to file for easy access
        const fs = await import('fs');
        const filePath = '/tmp/infinicanvas-screenshot.png';
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

        return {
          content: [
            {
              type: 'image' as const,
              data: base64Data,
              mimeType: 'image/png',
            },
            {
              type: 'text' as const,
              text: `Screenshot captured: ${result.width}×${result.height} pixels (${sizeKB} KB). Saved to ${filePath}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Screenshot failed: ${(err as Error).message}` }],
        };
      }
    },
  );

  // ── Theme tools ──────────────────────────────────────────

  server.tool(
    'canvas_apply_theme',
    'Apply a professional color theme to all expressions on the canvas. Themes provide consistent color palettes — primary fill for shapes, accent for sticky notes, stroke colors, and font family. Available themes: corporate (professional blues), technical (clean monochrome), colorful (vibrant modern), dark (dark mode), blueprint (engineering style).',
    {
      themeId: z.string().describe('Theme ID to apply. Use canvas_list_themes to see available options. Available: corporate, technical, colorful, dark, blueprint'),
    },
    async (params) => {
      const result = await executeApplyTheme(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_list_themes',
    'List all available color themes with their IDs, descriptions, and color palettes. Use before canvas_apply_theme to see options.',
    {},
    async () => {
      const result = executeListThemes();
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // ── Layer tools ─────────────────────────────────────────────

  const layerClient = gatewayClient as unknown as ILayerGatewayClient;

  server.tool(
    'canvas_list_layers',
    'List all layers on the canvas with their visibility, lock status, and which is active. Returns layer names, IDs, and state.',
    {},
    async () => ({
      content: [{ type: 'text' as const, text: executeListLayers(layerClient) }],
    }),
  );

  server.tool(
    'canvas_add_layer',
    'Create a new layer on the canvas. New expressions will be added to the active layer. Use canvas_set_active_layer to switch layers.',
    {
      name: z.string().max(500).optional().describe('Layer name (auto-generated if omitted)'),
    },
    async (params) => ({
      content: [{ type: 'text' as const, text: executeAddLayer(layerClient, params) }],
    }),
  );

  server.tool(
    'canvas_set_active_layer',
    'Set the active layer. New expressions will be created on this layer.',
    {
      layerId: z.string().min(1).describe('ID of the layer to set as active'),
    },
    async (params) => ({
      content: [{ type: 'text' as const, text: executeSetActiveLayer(layerClient, params) }],
    }),
  );

  server.tool(
    'canvas_toggle_layer_visibility',
    'Toggle a layer\'s visibility. Hidden layers and their expressions are not rendered.',
    {
      layerId: z.string().min(1).describe('ID of the layer to toggle visibility'),
    },
    async (params) => ({
      content: [{ type: 'text' as const, text: executeToggleLayerVisibility(layerClient, params) }],
    }),
  );

  server.tool(
    'canvas_move_to_layer',
    'Move expressions to a different layer. Expressions will be rendered in the target layer\'s z-order.',
    {
      expressionIds: z.array(z.string().min(1)).min(1).describe('IDs of expressions to move'),
      layerId: z.string().min(1).describe('ID of the target layer'),
    },
    async (params) => ({
      content: [{ type: 'text' as const, text: executeMoveToLayer(layerClient, params) }],
    }),
  );

  return server;
}
