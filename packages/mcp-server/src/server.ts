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
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createGatewayClient, type IGatewayClient } from './gatewayClient.js';

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
  executeMorph,
} from './tools/managementTools.js';

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
    'Draw a rectangle on the canvas. Use for boxes, containers, cards, or any rectangular element.',
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
    'Draw an arrow connecting multiple points. Use for directional connections, flow indicators, or pointers.',
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
    'Place text on the canvas. Use for labels, headings, descriptions, or any textual content.',
    {
      x: z.number().describe('X position on the canvas'),
      y: z.number().describe('Y position on the canvas'),
      text: z.string().min(1).describe('The text content to display'),
      fontSize: z.number().positive().optional().describe('Font size in pixels (default: 16)'),
      fontFamily: z.string().optional().describe('Font family name (default: "sans-serif")'),
    },
    async (params) => {
      const result = await executeDrawText(gatewayClient, params);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'canvas_add_sticky_note',
    'Add a sticky note to the canvas. Use for quick notes, reminders, or informal annotations.',
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
    'Draw a flowchart diagram. Use for process flows, decision trees, algorithms, or any step-by-step visualization.',
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
    'Draw a sequence diagram showing interactions between participants over time. Use for API flows, protocol designs, or system interactions.',
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
    'Draw a mind map radiating from a central topic. Use for brainstorming, concept exploration, or hierarchical idea organization.',
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
    'Draw a visual reasoning chain showing step-by-step thinking. Use for explaining logic, problem-solving, or showing thought process.',
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
    'Draw a UI wireframe with positioned components. Use for mockups, UI prototyping, or screen design.',
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
    'Draw a project roadmap with phases and items. Use for project planning, release schedules, or milestone tracking.',
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
    'Draw a kanban board with columns and cards. Use for task management, sprint boards, or workflow visualization.',
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
      const result = await executeGetState(gatewayClient);
      return { content: [{ type: 'text' as const, text: result }] };
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

  return server;
}

// ── Main entry point ───────────────────────────────────────

/** Start the MCP server with stdio transport and gateway connection. */
async function main(): Promise<void> {
  const gatewayClient = createGatewayClient();

  // Connect to gateway (optional — tools will fail gracefully if not connected)
  try {
    await gatewayClient.connect();
  } catch {
    // Gateway may not be running yet — tools will report connection errors
    // The MCP server itself can still start and list tools
    process.stderr.write(
      'Warning: Could not connect to InfiniCanvas gateway. ' +
      'Tools will attempt to reconnect. Set INFINICANVAS_GATEWAY_URL and INFINICANVAS_API_KEY.\n',
    );
  }

  const server = createMcpServer(gatewayClient);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Graceful shutdown
  process.on('SIGINT', () => {
    gatewayClient.disconnect();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    gatewayClient.disconnect();
    process.exit(0);
  });
}

main().catch((err: unknown) => {
  process.stderr.write(`MCP Server fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
