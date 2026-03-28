# StreamThinking

A visual communication protocol for humans & AI — an infinite canvas where AI agents express reasoning, diagrams, wireframes, and workflows, and humans respond by drawing, annotating, and editing. Both sides speak the same visual protocol.

## What is InfiniCanvas?

InfiniCanvas is an infinite canvas where AI and humans co-create using a shared visual protocol. AI agents can draw diagrams, flowcharts, wireframes, and visual explanations — and humans can respond by drawing, annotating, and rearranging on the same canvas. The shared protocol means both sides understand each other's visual expressions natively.

## Architecture

Monorepo with 6 packages:

| Package | Description |
|---------|-------------|
| `protocol` | Shared schema, types, and validation (ICP — InfiniCanvas Protocol) |
| `engine` | Rendering engine — Zustand state store and Canvas component |
| `gateway` | WebSocket gateway — real-time collaboration server for canvas sessions |
| `mcp-server` | MCP server — canvas tools for AI agents via Model Context Protocol |
| `agents` | AI agent adapters (Phase 5) |
| `app` | React web application |

**Data flow:**

```
AI Agent → MCP Server → Gateway ↔ Browser App
```

## Quickstart

### Prerequisites

- Node.js ≥ 20

### Run locally

```bash
npm install
npm run dev
```

This starts:
- **Gateway** on `ws://localhost:8080`
- **App** on `http://localhost:5173`

Open http://localhost:5173, click the Settings gear → enter Gateway URL `ws://localhost:8080` → save.

## MCP Integration

InfiniCanvas exposes canvas tools to AI agents via the [Model Context Protocol](https://modelcontextprotocol.io/).

### Copilot CLI / VS Code

The MCP config lives at `.github/extensions/infinicanvas.mcp.json`. Set these environment variables before starting:

```bash
export INFINICANVAS_GATEWAY_URL=ws://localhost:8080
export INFINICANVAS_API_KEY=any-string-for-local-dev
```

The MCP server runs via:

```
npx tsx packages/mcp-server/src/main.ts
```

`INFINICANVAS_API_KEY` can be any string for local development.

## Development

```bash
npm test          # run all tests
npm run build     # build all packages
npm run lint      # lint all packages
npm run clean     # remove dist and build artifacts
```
