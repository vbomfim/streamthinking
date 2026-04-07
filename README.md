# StreamThinking — InfiniCanvas

An infinite canvas whiteboard with real-time bidirectional AI↔human collaboration. AI agents and humans co-create diagrams, flowcharts, wireframes, and visual explanations on the same canvas using a shared visual protocol.

## What is InfiniCanvas?

InfiniCanvas is an infinite canvas where AI and humans co-create using a shared visual protocol. AI agents can draw diagrams, flowcharts, wireframes, and visual explanations — and humans can respond by drawing, annotating, and rearranging on the same canvas. The shared protocol means both sides understand each other's visual expressions natively.

### Key Features

- **Custom canvas engine** with clean geometry (roughness=0 default) and optional hand-drawn style
- **56+ SVG stencils** across 7 categories (Network, Azure, Kubernetes, ARM, Generic IT, Architecture, Security)
- **Real-time collaboration** via WebSocket gateway — all changes sync instantly
- **MCP server** with 30+ canvas tools for AI agent integration (GitHub Copilot, Claude, etc.)
- **Presentation mode** with camera waypoints and keyboard navigation
- **draw.io format support** — export/import to mxGraphModel XML for interop with draw.io, Confluence, and VS Code

## Architecture

Monorepo with 6 packages:

| Package | Description |
|---------|-------------|
| `protocol` | Shared schema, types, and validation (ICP — InfiniCanvas Protocol), including draw.io serializer |
| `engine` | Custom rendering engine — Zustand state store, Rough.js renderer, Canvas component |
| `gateway` | WebSocket gateway — real-time collaboration server for canvas sessions |
| `mcp-server` | MCP server — 30+ canvas tools for AI agents via Model Context Protocol |
| `agents` | AI agent adapters (future) |
| `app` | React web application — toolbar, style panel, stencil palette, export/import UI |

**Data flow:**

```
AI Agent ↔ MCP Server ↔ Gateway ↔ Browser App
                         ↕
                    Session State
```

---

## Step-by-Step Setup

### Prerequisites

- **Node.js ≥ 20** (check: `node -v`)
- **npm** (comes with Node.js)
- **Git**

### Step 1: Clone the repo

```bash
git clone https://github.com/vbomfim/streamthinking.git
cd streamthinking
```

### Step 2: Install dependencies

```bash
npm install
```

This installs all 6 packages in the monorepo via npm workspaces.

### Step 3: Start the development server

```bash
npm run dev
```

This starts two services concurrently:

| Service | URL | Description |
|---------|-----|-------------|
| **Gateway** | `ws://localhost:8080` | WebSocket server for real-time canvas sync |
| **App** | `http://localhost:5173` | React app — open this in your browser |

Environment variables `INFINICANVAS_API_KEY=local-dev` and `INFINICANVAS_SESSION_ID=local-dev` are set automatically.

### Step 4: Open the canvas

1. Open **http://localhost:5173** in your browser
2. Click the **⚙️ Settings** gear icon (top-right)
3. Enter Gateway URL: `ws://localhost:8080`
4. Enter API Key: `local-dev`
5. Click **Save**
6. The connection dot should turn green — you're connected!

### Step 5: Draw something!

Use the **toolbar** on the left:
- **V** — Select tool
- **R** — Rectangle
- **O** — Ellipse
- **D** — Diamond
- **A** — Arrow (use style panel to add/change arrowheads)
- **P** — Freehand pen
- **T** — Text
- **N** — Sticky note

Click the **stencil palette** (grid icon) for 56 architecture icons across 7 categories.

---

## MCP Integration (AI Agent Connection)

The MCP server lets AI agents (like GitHub Copilot) draw on the canvas using 30+ tools.

### Option A: Copilot CLI / VS Code

Add this to your MCP config (`~/.copilot/mcp-config.json` or VS Code settings):

```json
{
  "mcpServers": {
    "infinicanvas": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "<FULL_PATH>/packages/mcp-server/src/main.ts"],
      "env": {
        "INFINICANVAS_GATEWAY_URL": "ws://localhost:8080",
        "INFINICANVAS_API_KEY": "local-dev",
        "INFINICANVAS_SESSION_ID": "local-dev"
      }
    }
  }
}
```

Replace `<FULL_PATH>` with the absolute path to your clone (e.g., `/Users/you/streamthinking`).

### Option B: Run MCP server standalone

```bash
INFINICANVAS_GATEWAY_URL=ws://localhost:8080 \
INFINICANVAS_API_KEY=local-dev \
INFINICANVAS_SESSION_ID=local-dev \
npx tsx packages/mcp-server/src/main.ts
```

### Available MCP Tools

| Category | Tools |
|----------|-------|
| **Primitives** | `canvas_draw_rectangle`, `canvas_draw_ellipse`, `canvas_draw_arrow`, `canvas_draw_text`, `canvas_add_sticky_note` |
| **Stencils** | `canvas_place_stencil`, `canvas_list_stencils` |
| **Diagrams** | `canvas_draw_flowchart`, `canvas_draw_sequence_diagram`, `canvas_draw_mind_map`, `canvas_draw_kanban`, `canvas_draw_roadmap` |
| **Visual** | `canvas_draw_reasoning_chain`, `canvas_draw_wireframe` |
| **Query** | `canvas_get_state`, `canvas_query`, `canvas_get_expression`, `canvas_pending_requests` |
| **Annotations** | `canvas_annotate`, `canvas_highlight`, `canvas_add_comment` |
| **Waypoints** | `canvas_add_waypoint`, `canvas_list_waypoints`, `canvas_remove_waypoint` |
| **Persistence** | `canvas_save`, `canvas_load`, `canvas_list_saves` |
| **draw.io** | `canvas_export_drawio`, `canvas_import_drawio` |
| **Canvas** | `canvas_clear` |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `INFINICANVAS_API_KEY` | — | Authentication key (any string for local dev) |
| `INFINICANVAS_SESSION_ID` | — | Session ID for MCP server to join |
| `INFINICANVAS_GATEWAY_URL` | `ws://localhost:8080` | Gateway WebSocket URL |
| `PORT` | `8080` | Gateway listen port |

---

## Development

```bash
npm test          # run all tests across all packages
npm run build     # build all packages
npm run lint      # lint all packages
npm run clean     # remove dist and build artifacts
```

### Package-specific commands

```bash
# Run only gateway tests
npm test -w @infinicanvas/gateway

# Run only engine tests
npm test -w @infinicanvas/engine

# Run app in dev mode only
npm run dev -w @infinicanvas/app
```

---

## Canvas Features

- **Drawing tools**: Rectangle, ellipse, diamond, arrow, freehand, text, sticky notes
- **56 stencils**: Network, Azure, Kubernetes, ARM, Generic IT, Architecture, Security
- **Arrow types**: Triangle, chevron, diamond, circle — configurable per-end
- **Styles**: Stroke color, fill, roughness, opacity, dashed/dotted, font family/size
- **Clean geometry**: Smooth rendering by default (roughness=0), optional hand-drawn sketchy style via Rough.js
- **Presentation mode**: Camera waypoints with keyboard navigation
- **Z-order**: Bring forward/back with overlap-aware stacking
- **Real-time sync**: All changes sync via WebSocket gateway
- **AI collaboration**: Bidirectional — AI draws, human edits, AI sees changes

---

## draw.io Integration

InfiniCanvas supports bidirectional conversion with [draw.io](https://draw.io) (diagrams.net) via the **mxGraphModel XML** format.

### What's supported

- **Shapes**: Rectangles, ellipses, diamonds, text, sticky notes, stencils
- **Connectors**: Arrows and lines with waypoints, start/end bindings
- **Styles**: Colors, stroke width, opacity, dashed/dotted patterns, rotation
- **Labels**: Text labels on shapes and connectors

### From the UI

Use the **Export menu** (download icon) in the toolbar:
- **Export .drawio** — downloads the canvas as `infinicanvas-export.drawio`
- **Import .drawio** — opens a file picker for `.drawio` or `.xml` files

Exported files open directly in draw.io, Confluence draw.io plugin, and VS Code draw.io extensions.

### From AI agents (MCP tools)

| Tool | Description |
|------|-------------|
| `canvas_export_drawio` | Exports the current canvas as mxGraphModel XML |
| `canvas_import_drawio` | Imports mxGraphModel XML onto the canvas |

### Serializer (protocol package)

The `@infinicanvas/protocol` package exports two functions:

```typescript
import { expressionsToDrawio, drawioToExpressions } from '@infinicanvas/protocol';

// Canvas → draw.io XML
const xml = expressionsToDrawio(expressions);

// draw.io XML → Canvas expressions
const expressions = drawioToExpressions(xml);
```
