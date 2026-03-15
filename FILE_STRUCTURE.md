# InfiniCanvas File Structure

## Complete Directory Tree

```
infinicanvas/
├── packages/
│   ├── protocol/                          (Type definitions & validation)
│   │   ├── src/
│   │   │   ├── __tests__/
│   │   │   │   ├── builder.test.ts
│   │   │   │   └── schema.test.ts
│   │   │   ├── builders/
│   │   │   │   └── expressionBuilder.ts   ← Create expressions fluently
│   │   │   ├── schema/
│   │   │   │   ├── annotations.ts         ← Comment, Callout, Highlight, Marker
│   │   │   │   ├── composites.ts          ← Flowchart, Wireframe, etc. (12 types)
│   │   │   │   ├── expressions.ts         ← Core VisualExpression type
│   │   │   │   ├── metadata.ts            ← AuthorInfo, ExpressionStyle, DEFAULT_*
│   │   │   │   ├── operations.ts          ← ProtocolOperation payload types
│   │   │   │   └── primitives.ts          ← Rectangle, Line, Text, etc. (9 types)
│   │   │   ├── validation/
│   │   │   │   └── schemas.ts             ← Zod schemas for all types
│   │   │   └── index.ts                   ← Public exports
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   │
│   ├── engine/                            (Canvas, Store, Rendering)
│   │   ├── src/
│   │   │   ├── __tests__/
│   │   │   │   ├── agentStore.test.ts
│   │   │   │   ├── camera.test.ts
│   │   │   │   ├── Canvas.test.tsx
│   │   │   │   ├── canvasStore.test.ts    ← 41 tests
│   │   │   │   ├── canvasStore.integration.test.ts    ← 24 tests
│   │   │   │   ├── canvasStore.remote.test.ts
│   │   │   │   ├── canvasStoreUndo.test.ts
│   │   │   │   ├── compositeIntegration.test.ts
│   │   │   │   ├── compositeRegistry.test.ts
│   │   │   │   ├── drawableCache.test.ts
│   │   │   │   ├── ErrorBoundary.test.tsx
│   │   │   │   ├── flowchartRenderer.test.ts          ← 17 tests
│   │   │   │   ├── gateway.integration.test.ts
│   │   │   │   ├── gridRenderer.test.ts
│   │   │   │   ├── hitTest.test.ts
│   │   │   │   ├── localStorage.test.ts
│   │   │   │   ├── manipulationHelpers.test.ts
│   │   │   │   ├── persistence.edge.test.ts
│   │   │   │   ├── primitiveRenderer.test.ts          ← 25 tests
│   │   │   │   ├── renderLoop.test.ts
│   │   │   │   ├── selectionManager.test.ts
│   │   │   │   ├── selectionRenderer.test.ts
│   │   │   │   ├── styleMapper.test.ts
│   │   │   │   ├── undoPersistence.integration.test.ts
│   │   │   │   ├── useAutoSave.test.ts
│   │   │   │   ├── useCanvasInteraction.test.tsx
│   │   │   │   ├── useGatewayConnection.test.ts
│   │   │   │   ├── useManipulationInteraction.test.tsx
│   │   │   │   ├── useSelectionInteraction.test.tsx
│   │   │   │   └── useUndoRedoShortcuts.test.tsx
│   │   │   ├── camera.ts                  ← screenToWorld, worldToScreen, zoomAtPoint
│   │   │   ├── components/
│   │   │   │   ├── Canvas.tsx             ← Full-viewport canvas + render loop
│   │   │   │   └── ErrorBoundary.tsx
│   │   │   ├── history/
│   │   │   │   └── historyManager.ts      ← Undo/redo snapshots
│   │   │   ├── hooks/
│   │   │   │   ├── useAutoSave.ts         ← Auto-save to localStorage (debounced)
│   │   │   │   ├── useCanvasInteraction.ts ← Pan (Space+drag) & zoom (scroll)
│   │   │   │   ├── useGatewayConnection.ts ← WebSocket for collaboration
│   │   │   │   ├── useManipulationInteraction.ts ← Move, resize, delete, duplicate
│   │   │   │   ├── useSelectionInteraction.ts ← Click, shift+click, marquee
│   │   │   │   └── useUndoRedoShortcuts.ts ← Keyboard: Ctrl+Z / Ctrl+Shift+Z
│   │   │   ├── index.ts                   ← Public API (store, components, utils)
│   │   │   ├── interaction/
│   │   │   │   ├── hitTest.ts             ← Point-in-shape geometry (9 primitive kinds)
│   │   │   │   ├── manipulationHelpers.ts ← Handle detection, cursor, resize calc
│   │   │   │   └── selectionManager.ts    ← Find at point, marquee intersection
│   │   │   ├── persistence/
│   │   │   │   └── localStorage.ts        ← Save/load (only expr, order, camera)
│   │   │   ├── renderer/
│   │   │   │   ├── compositeRegistry.ts   ← Register custom renderers
│   │   │   │   ├── composites/
│   │   │   │   │   └── flowchartRenderer.ts ← Layout flowcharts via Dagre
│   │   │   │   ├── drawableCache.ts       ← Cache Rough.js drawables by style
│   │   │   │   ├── gridRenderer.ts        ← Infinite grid background
│   │   │   │   ├── primitiveRenderer.ts   ← Draw all 9 primitive kinds
│   │   │   │   ├── renderLoop.ts          ← RAF: clear → transform → grid → exprs
│   │   │   │   ├── selectionRenderer.ts   ← Selection boxes + handles
│   │   │   │   ├── styleMapper.ts         ← ExpressionStyle → Rough.js options
│   │   │   │   └── viewportCulling.ts     ← AABB visibility check
│   │   │   ├── store/
│   │   │   │   ├── agentStore.ts          ← Connected agents (Zustand)
│   │   │   │   └── canvasStore.ts         ← Main store (545 lines):
│   │   │   │       ├── expressions: Map<id, VisualExpression>
│   │   │   │       ├── selectedIds: Set<string>
│   │   │   │       ├── activeTool: ToolType
│   │   │   │       ├── camera: {x, y, zoom}
│   │   │   │       ├── operationLog: ProtocolOperation[]
│   │   │   │       ├── canUndo, canRedo
│   │   │   │       └── Actions:
│   │   │   │           ├── addExpression
│   │   │   │           ├── updateExpression
│   │   │   │           ├── deleteExpressions
│   │   │   │           ├── moveExpressions
│   │   │   │           ├── transformExpression
│   │   │   │           ├── setSelectedIds (UI-only)
│   │   │   │           ├── setActiveTool (UI-only)
│   │   │   │           ├── setCamera (UI-only)
│   │   │   │           ├── undo / redo
│   │   │   │           ├── applyRemoteOperation
│   │   │   │           └── replaceState
│   │   │   ├── types/
│   │   │   │   └── index.ts                ← CanvasState, CanvasActions, ToolType
│   │   │   └── index.ts                    ← Public exports
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   │
│   ├── app/                               (React Web App)
│   │   ├── src/
│   │   │   ├── __tests__/
│   │   │   │   ├── AgentSidebar.integration.test.tsx
│   │   │   │   └── AgentSidebar.test.tsx
│   │   │   ├── components/
│   │   │   │   └── sidebar/
│   │   │   │       ├── AgentSidebar.tsx    ← Collapsible agent panel (top-right)
│   │   │   │       └── index.ts
│   │   │   ├── App.tsx                     ← Root: Canvas + AgentSidebar
│   │   │   ├── main.tsx                    ← React entry
│   │   │   └── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts                  ← React plugin, port 5173
│   │   └── vitest.config.ts
│   │
│   ├── gateway/                           (WebSocket Server)
│   │   ├── src/
│   │   │   ├── __tests__/
│   │   │   └── server.ts                   ← ws server for sessions
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   │
│   ├── mcp-server/                        (AI Agent Protocol)
│   │   ├── src/
│   │   │   ├── __tests__/
│   │   │   └── main.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   │
│   └── agents/                            (Phase 5: Agent Adapters)
│       ├── src/
│       └── package.json
│
├── tsconfig.base.json                     ← Base config: ES2022, strict, noUnused*
├── package.json                           ← Root workspace config
├── package-lock.json
├── README.md
├── .gitignore
└── [node_modules, .git, .github]
```

## Critical File Paths

### Type System
- **Expression types**: `packages/protocol/src/schema/expressions.ts`
- **Primitive types**: `packages/protocol/src/schema/primitives.ts` (Rectangle, Line, etc.)
- **Composite types**: `packages/protocol/src/schema/composites.ts` (Flowchart, etc.)
- **Annotation types**: `packages/protocol/src/schema/annotations.ts`
- **Metadata & style**: `packages/protocol/src/schema/metadata.ts`
- **Operation types**: `packages/protocol/src/schema/operations.ts`
- **Zod schemas**: `packages/protocol/src/validation/schemas.ts`
- **Builder**: `packages/protocol/src/builders/expressionBuilder.ts`

### State & Store
- **Canvas store**: `packages/engine/src/store/canvasStore.ts` (main)
- **Agent store**: `packages/engine/src/store/agentStore.ts`
- **Types**: `packages/engine/src/types/index.ts`

### Rendering
- **Render loop**: `packages/engine/src/renderer/renderLoop.ts`
- **Primitive rendering**: `packages/engine/src/renderer/primitiveRenderer.ts`
- **Grid**: `packages/engine/src/renderer/gridRenderer.ts`
- **Selection UI**: `packages/engine/src/renderer/selectionRenderer.ts`
- **Viewport culling**: `packages/engine/src/renderer/viewportCulling.ts`
- **Style mapper**: `packages/engine/src/renderer/styleMapper.ts`
- **Drawable cache**: `packages/engine/src/renderer/drawableCache.ts`
- **Composite registry**: `packages/engine/src/renderer/compositeRegistry.ts`
- **Flowchart renderer**: `packages/engine/src/renderer/composites/flowchartRenderer.ts`

### Interaction
- **Camera math**: `packages/engine/src/camera.ts`
- **Hit testing**: `packages/engine/src/interaction/hitTest.ts`
- **Selection helpers**: `packages/engine/src/interaction/selectionManager.ts`
- **Manipulation helpers**: `packages/engine/src/interaction/manipulationHelpers.ts`

### Hooks
- **Pan & zoom**: `packages/engine/src/hooks/useCanvasInteraction.ts`
- **Click selection**: `packages/engine/src/hooks/useSelectionInteraction.ts`
- **Move/resize**: `packages/engine/src/hooks/useManipulationInteraction.ts`
- **Undo/redo shortcuts**: `packages/engine/src/hooks/useUndoRedoShortcuts.ts`
- **Auto-save**: `packages/engine/src/hooks/useAutoSave.ts`
- **Gateway**: `packages/engine/src/hooks/useGatewayConnection.ts`

### Components
- **Canvas**: `packages/engine/src/components/Canvas.tsx`
- **Error boundary**: `packages/engine/src/components/ErrorBoundary.tsx`
- **App root**: `packages/app/src/App.tsx`
- **Agent sidebar**: `packages/app/src/components/sidebar/AgentSidebar.tsx`

### Persistence
- **LocalStorage**: `packages/engine/src/persistence/localStorage.ts`

### History
- **History manager**: `packages/engine/src/history/historyManager.ts`

## Test Locations

All tests colocated in `__tests__` directories:
- `packages/engine/src/__tests__/` — 32 test files
- `packages/app/src/__tests__/` — 2 test files
- `packages/protocol/src/__tests__/` — 2 test files

## Dependencies by Package

### protocol
```
nanoid, zod
```

### engine
```
@dagrejs/dagre (flowchart layout)
immer (immutable updates)
nanoid
perfect-freehand (stroke simplification)
roughjs (hand-drawn aesthetic)
zustand (state management)
```

### app
```
react, react-dom
```

### gateway
```
ws (WebSocket)
nanoid
```

### mcp-server
```
@modelcontextprotocol/sdk
ws
nanoid
```

## Entry Points

| Package | Main Entry |
|---------|-----------|
| protocol | `packages/protocol/src/index.ts` |
| engine | `packages/engine/src/index.ts` |
| app | `packages/app/src/App.tsx` |
| gateway | `packages/gateway/src/server.ts` |
| mcp-server | `packages/mcp-server/src/main.ts` |

## NPM Scripts

```bash
# Root (runs in all packages)
npm run build
npm run test
npm run lint
npm run clean

# Protocol
npm run build    # tsc
npm run test     # vitest run
npm run test:watch

# Engine
npm run build    # tsc
npm run test     # vitest run
npm run test:watch
npm run clean

# App
npm run dev      # vite dev server (5173)
npm run build    # tsc && vite build
npm run test
npm run test:watch
npm run clean

# Gateway
npm run start    # tsx src/server.ts
npm run build    # tsc
npm run test

# MCP Server
npm run start    # tsx src/main.ts
npm run build    # tsc
npm run test
```
