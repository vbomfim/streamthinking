                  [full-viewport canvas, render loop, interaction]
│   │   └── ErrorBoundary.tsx            [React error boundary]
│   ├── history/
│   │   └── historyManager.ts            [undo/redo snapshot management]
│   ├── hooks/
│   │   ├── useAutoSave.ts               [debounced localStorage save]
│   │   ├── useCanvasInteraction.ts      [pan & zoom]
│   │   ├── useGatewayConnection.ts      [WebSocket collaboration]
│   │   ├── useManipulationInteraction.ts [move, resize, delete, duplicate]
│   │   ├── useSelectionInteraction.ts   [click, marquee selection]
│   │   └── useUndoRedoShortcuts.ts      [keyboard shortcuts]
│   ├── index.ts                         [public API exports]
│   ├── interaction/
│   │   ├── hitTest.ts                   [point-in-shape geometry]
│   │   ├── manipulationHelpers.ts       [handle detection, resize, cursor]
│   │   └── selectionManager.ts          [find expression at point, marquee]
│   ├── persistence/
│   │   └── localStorage.ts              [save/load canvas state]
│   ├── renderer/
│   │   ├── compositeRegistry.ts         [register custom composite renderers]
│   │   ├── composites/
│   │   │   └── flowchartRenderer.ts     [flowchart layout + rendering]
│   │   ├── drawableCache.ts             [cache Rough.js drawables by style hash]
│   │   ├── gridRenderer.ts              [infinite grid background]
│   │   ├── primitiveRenderer.ts         [render all 9 primitive kinds]
│   │   ├── renderLoop.ts                [RAF loop: clear → transform → grid → expressions]
│   │   ├── selectionRenderer.ts         [selection boxes + resize handles]
│   │   ├── styleMapper.ts               [ExpressionStyle → Rough.js options]
│   │   └── viewportCulling.ts           [AABB visibility check]
│   ├── store/
│   │   ├── agentStore.ts                [Zustand: connected agents]
│   │   └── canvasStore.ts               [Zustand: expressions, camera, tools, undo]
│   ├── types/
│   │   └── index.ts                     [CanvasState, CanvasActions, ToolType, Camera]
│   └── index.ts                         [public API]
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── [dist, *.tsbuildinfo after build]
```

### packages/app/
```
app/
├── src/
│   ├── __tests__/
│   │   ├── AgentSidebar.integration.test.tsx
│   │   └── AgentSidebar.test.tsx
│   ├── components/
│   │   └── sidebar/
│   │       ├── AgentSidebar.tsx
│   │       └── index.ts
│   ├── App.tsx                          [Canvas + AgentSidebar]
│   ├── main.tsx                         [React entry point]
│   └── index.html                       [HTML template]
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── [dist after build]
```

### packages/protocol/
```
protocol/
├── src/
│   ├── __tests__/
│   │   ├── builder.test.ts
│   │   └── schema.test.ts
│   ├── builders/
│   │   └── expressionBuilder.ts         [fluent builder for expressions]
│   ├── schema/
│   │   ├── annotations.ts               [Comment, Callout, Highlight, Marker]
│   │   ├── composites.ts                [Flowchart, Sequence, Wireframe, etc.]
│   │   ├── expressions.ts               [VisualExpression type]
│   │   ├── metadata.ts                  [AuthorInfo, ExpressionStyle, DEFAULT_*]
│   │   ├── operations.ts                [ProtocolOperation types]
│   │   └── primitives.ts                [Rectangle, Ellipse, Line, Text, etc.]
│   ├── validation/
│   │   └── schemas.ts                   [Zod schemas for all types]
│   └── index.ts                         [public API exports]
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── [dist, *.tsbuildinfo after build]
```

### packages/gateway/ & packages/mcp-server/
Minimal structure, WebSocket servers (not analyzed in detail).

---

## 7. KEY PATTERNS & CONVENTIONS

### 1. Expression Types & Builders
- Always use `ExpressionBuilder` to create expressions in tests
- All expressions validated with Zod schemas before adding to store
- Never mutate expressions directly; always call store actions

### 2. Store Usage
- Subscribe with `useCanvasStore((state) => state.field)`
- Content mutations push snapshots BEFORE state update
- ProtocolOperations always created with unique ID + current timestamp
- Remote operations never added to operationLog (prevent loops)

### 3. Rendering
- Canvas 2D API via Rough.js for hand-drawn aesthetic
- Each frame: clear → apply transform → grid → primitives → selection
- Viewport culling skips off-screen expressions
- Drawable caching by style hash

### 4. Interaction
- Hit testing uses world coordinates + tolerance (converted from screen pixels)
- Marquee and selection use AABB intersection
- Locked expressions are no-ops for move/resize/delete
- Drag threshold: 5px to distinguish click from drag

### 5. Camera System
- Camera model: `screen = (world - camera) × zoom`
- Zoom centered on cursor (world point under cursor stays fixed)
- Pan delta divided by zoom for consistent speed
- Camera bounds: zoom ∈ [0.01, 100]

### 6. Persistence
- Only expressions, expressionOrder, camera saved to localStorage
- Selection, undo history, operationLog excluded (transient)
- Key: 'infinicanvas:state'

### 7. Testing
- Vitest + jsdom for unit/integration tests
- Test files colocated in `__tests__/` directories
- Acceptance criteria mapped to test descriptions
- Tests run in parallel, reset state in beforeEach

---

## 8. KEY FILES FOR IMPLEMENTATION

**For new tool/feature**:
1. Add type to `ToolType` in `packages/engine/src/types/index.ts`
2. Add expression kind to `packages/protocol/src/schema/primitives.ts` or `composites.ts`
3. Add Zod schema to `packages/protocol/src/validation/schemas.ts`
4. Add renderer to `packages/engine/src/renderer/primitiveRenderer.ts`
5. Add hit test to `packages/engine/src/interaction/hitTest.ts`
6. Update store if special behavior needed
7. Add tests

**Key locations**:
- Types: `packages/protocol/src/schema/`
- Store actions: `packages/engine/src/store/canvasStore.ts`
- Rendering: `packages/engine/src/renderer/primitiveRenderer.ts`
- Interaction: `packages/engine/src/hooks/useManipulationInteraction.ts`
- Hit testing: `packages/engine/src/interaction/hitTest.ts`

---

## 9. COMMAND REFERENCE

```bash
# Root
npm run build                    # Build all packages
npm run test                     # Test all packages
npm run lint                     # Lint all packages
npm run clean                    # Clean all packages

# Engine
cd packages/engine
npm run build                    # TypeScript compile
npm run test                     # Run vitest
npm run test:watch              # Watch mode

# App
cd packages/app
npm run dev                      # Start Vite dev server (port 5173)
npm run build                    # TypeScript + Vite build
npm run test                     # vitest
npm run test:watch

# Protocol
cd packages/protocol
npm run build
npm run test

# Gateway
cd packages/gateway
npm run start                    # Start WebSocket server
npm run build
npm run test

# MCP Server
cd packages/mcp-server
npm run start                    # Start MCP server
npm run build
npm run test
```

---

## 10. CRITICAL DESIGN DECISIONS

1. **Canvas 2D, not WebGL** — Simpler implementation, roughjs aesthetic
2. **Zustand + Immer** — Minimal boilerplate, immutable updates
3. **ProtocolOperations for collaboration** — Every mutation logged for replay/sync
4. **Snapshots for undo/redo** — Simple, doesn't require operation inversion
5. **Viewport culling** — Skip rendering off-screen for performance
6. **Rough.js for hand-drawn look** — Part of visual identity
7. **ExpressionBuilder for tests** — Fluent API reduces boilerplate
8. **Zod validation** — Runtime safety for all remote/imported data
9. **Locked expressions** — Guard against accidental manipulation
10. **LocalStorage for persistence** — Automatic recovery without backend

EOF
cat /tmp/infinicanvas_analysis.md

                EC=$?
                echo "___BEGIN___COMMAND_DONE_MARKER___$EC"
            }
___BEGIN___COMMAND_OUTPUT_MARKER___
# InfiniCanvas Monorepo - Comprehensive Analysis

## 1. OVERALL STRUCTURE

This is a **6-package monorepo** using npm workspaces, implementing a collaborative visual canvas protocol for humans and AI agents.

### Packages:
- **@infinicanvas/protocol** — Shared type definitions and Zod schemas (Expression, Operation types)
- **@infinicanvas/engine** — React + Zustand state store, Canvas component, rendering, interaction, persistence
- **@infinicanvas/app** — React web app (Vite), uses engine + protocol
- **@infinicanvas/gateway** — WebSocket server for real-time collaboration (Node.js)
- **@infinicanvas/mcp-server** — Model Context Protocol server for AI agents
- **@infinicanvas/agents** — AI agent adapters (Phase 5, minimal)

### Root Scripts:
```json
{
  "build": "npm run build --workspaces --if-present",
  "test": "npm run test --workspaces --if-present",
  "lint": "npm run lint --workspaces --if-present",
  "clean": "npm run clean --workspaces --if-present"
}
```

---

## 2. PACKAGES/PROTOCOL/ - The Type System

**Purpose**: Single source of truth for visual expressions, metadata, and operations.

### Source Files:
- `schema/expressions.ts` — Core VisualExpression type
- `schema/metadata.ts` — AuthorInfo, ExpressionStyle, DEFAULT_EXPRESSION_STYLE
- `schema/primitives.ts` — Rectangle, Ellipse, Diamond, Line, Arrow, Freehand, Text, StickyNote, Image
- `schema/composites.ts` — Flowchart, SequenceDiagram, Wireframe, ReasoningChain, Roadmap, MindMap, Kanban, DecisionTree, CollaborationDiagram, Slide, CodeBlock, Table
- `schema/annotations.ts` — Comment, Callout, Highlight, Marker
- `schema/operations.ts` — ProtocolOperation types (create, update, delete, move, transform, style, etc.)
- `builders/expressionBuilder.ts` — Builder pattern for creating expressions
- `validation/schemas.ts` — Zod schemas for runtime validation

### Core Types:

**VisualExpression**:
```typescript
interface VisualExpression {
  id: string;
  kind: ExpressionKind; // discriminant for data field
  position: { x: number; y: number };
  size: { width: number; height: number };
  angle: number;
  style: ExpressionStyle;
  meta: {
    author: AuthorInfo;
    createdAt: number;
    updatedAt: number;
    sourceOperation?: string;
    tags: string[];
    locked: boolean;
  };
  parentId?: string;
  children?: string[];
  data: ExpressionData; // kind-specific payload
}
```

**ExpressionKind** = `'rectangle' | 'ellipse' | 'diamond' | 'line' | 'arrow' | 'freehand' | 'text' | 'sticky-note' | 'image' | 'flowchart' | 'sequence-diagram' | 'wireframe' | 'reasoning-chain' | 'roadmap' | 'mind-map' | 'kanban' | 'decision-tree' | 'collaboration-diagram' | 'slide' | 'code-block' | 'table' | 'comment' | 'callout' | 'highlight' | 'marker'`

**ExpressionStyle**:
```typescript
interface ExpressionStyle {
  strokeColor: string;              // hex format
  backgroundColor: string;          // hex or 'transparent'
  fillStyle: 'solid' | 'hachure' | 'cross-hatch' | 'none';
  strokeWidth: number;              // 1-10
  roughness: number;                // 0 = smooth, 1+ = sketchy
  opacity: number;                  // 0-1
  fontSize?: number;
  fontFamily?: string;
}

// Canonical default:
export const DEFAULT_EXPRESSION_STYLE: ExpressionStyle = {
  strokeColor: '#1e1e1e',
  backgroundColor: 'transparent',
  fillStyle: 'hachure',
  strokeWidth: 2,
  roughness: 1,
  opacity: 1,
};
```

**AuthorInfo**:
```typescript
type AuthorInfo =
  | { type: 'human'; id: string; name: string }
  | { type: 'agent'; id: string; name: string; provider: string };
```

**ProtocolOperation** — All operations emit author + timestamp:
- `create` — Add new expression
- `update` — Modify expression (position, size, angle, style, data)
- `delete` — Remove expression(s)
- `move` — Change position with from/to tracking
- `transform` — Resize/rotate with size, angle
- `style` — Apply style to multiple expressions
- (Other types: group, ungroup, annotate, morph, lock, unlock, reorder, snapshot, query)

### Test Files:
- `__tests__/schema.test.ts` — Type validation
- `__tests__/builder.test.ts` — ExpressionBuilder patterns

---

## 3. PACKAGES/ENGINE/ - Rendering & State

**Purpose**: Canvas component, Zustand store, rendering pipeline, interaction hooks.

### A. Store (Zustand + Immer)

**File**: `src/store/canvasStore.ts` (545 lines)

**State**:
```typescript
interface CanvasState {
  expressions: Record<string, VisualExpression>;  // by id
  expressionOrder: string[];                       // z-order (back→front)
  selectedIds: Set<string>;                        // current selection
  activeTool: ToolType;                            // 'select' | 'rectangle' | ... | 'text'
  camera: { x: number; y: number; zoom: number };
  operationLog: ProtocolOperation[];               // all mutations logged
  canUndo: boolean;
  canRedo: boolean;
}

type ToolType =
  | 'select'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'freehand'
  | 'text';
```

**Content Mutations** (emit ProtocolOperations + push undo snapshots):
- `addExpression(expr)` — Validate, check duplicate, push snapshot, update expressions/order, emit create op
- `updateExpression(id, partial)` — Validate merge, emit update op, strip immutable fields (id, kind, meta)
- `deleteExpressions(ids)` — Filter locked, push snapshot, emit delete op
- `moveExpressions(moves)` — Track from/to, emit move ops, update position
- `transformExpression(id, original, final)` — Resize/rotate, emit transform op
- `applyRemoteOperation(op)` — Apply remote ops WITHOUT adding to operationLog (prevents loops)

**Undo/Redo**:
- `undo()` / `redo()` — Uses external HistoryManager
- `clearHistory()` — Reset stacks
- Snapshots capture full expressions + expressionOrder

**UI-Only State** (NO operations, NO snapshots):
- `setSelectedIds(ids)` — Update selection
- `setActiveTool(tool)` — Switch drawing tool
- `setCamera(camera)` — Pan/zoom (validates finite numbers)

**Remote Collaboration**:
- `replaceState(expressions, order)` — Full state sync on session join
- `operationLog` — Capped at 10,000 entries
- SYSTEM_AUTHOR = { type: 'agent', id: 'canvas-engine', provider: 'infinicanvas' }

### B. Agent Store

**File**: `src/store/agentStore.ts`

Simple Zustand store tracking connected agents:
```typescript
interface AgentState {
  agents: AuthorInfo[];
}

interface AgentActions {
  addAgent(agent: AuthorInfo): void;
  removeAgent(agentId: string): void;
  setAgents(agents: AuthorInfo[]): void;
  clearAgents(): void;
}
```

### C. Rendering

**Files**:
- `src/renderer/renderLoop.ts` — RAF-based render loop
- `src/renderer/primitiveRenderer.ts` — Render all 9 primitive kinds
- `src/renderer/gridRenderer.ts` — Infinite grid background
- `src/renderer/selectionRenderer.ts` — Selection boxes + resize handles
- `src/renderer/styleMapper.ts` — Convert ExpressionStyle → Rough.js options
- `src/renderer/viewportCulling.ts` — Skip off-screen expressions
- `src/renderer/drawableCache.ts` — Cache Rough.js drawables by style hash
- `src/renderer/compositeRegistry.ts` — Registry for composite renderers
- `src/renderer/composites/flowchartRenderer.ts` — Flowchart layout + rendering

**Rendering Stack** (per frame, via requestAnimationFrame):

1. **Clear** — Use identity transform to clear entire canvas
2. **Apply Camera Transform** — Translate and scale to world coordinates
3. **Render Grid** — Infinite grid lines in world space
4. **Render Expressions** — For each ID in expressionOrder:
   - Viewport culling check (skip if off-screen)
   - For composites: use registered renderer (e.g., flowchart)
   - For primitives: use Rough.js for shapes, native canvas for text/images/freehand
5. **Render Selection** — Bounding boxes + corner/edge handles for selected IDs

**Technology**: **Canvas 2D API** (not WebGL)
- Uses `RoughCanvas` from roughjs for hand-drawn aesthetic
- `perfect-freehand` for stroke simplification
- `@dagrejs/dagre` for composite layout (flowcharts)

**Key Functions**:

`createRenderLoop(ctx, getCamera, width, height, roughCanvas, exprProvider, selectionProvider)` → `RenderLoop`:
- Starts `requestAnimationFrame` loop
- Calls `getCamera()` each frame to fetch latest camera state
- Returns `{ start(), stop(), updateSize() }`

`renderExpressions(ctx, roughCanvas, expressions, order, camera, width, height)`:
- Iterates expressionOrder
- Skips expressions outside viewport
- Renders each by kind
- Handles z-order via iteration order

`mapStyleToRoughOptions(style: ExpressionStyle)` → RoughOptions:
- Converts fillStyle, roughness, strokeWidth, etc. to Rough.js config

### D. Camera Math

**File**: `src/camera.ts`

Pure coordinate transform functions:

```typescript
function screenToWorld(sx: number, sy: number, camera: Camera): { x: number; y: number }
  // sx / zoom + camera.x

function worldToScreen(wx: number, wy: number, camera: Camera): { x: number; y: number }
  // (wx - camera.x) * zoom

function applyTransform(ctx: CanvasRenderingContext2D, camera: Camera): void
  // ctx.setTransform(zoom, 0, 0, zoom, -camera.x * zoom || 0, -camera.y * zoom || 0)

function zoomAtPoint(camera: Camera, screenX: number, screenY: number, newZoom: number): Camera
  // World point under cursor stays fixed after zoom
```

### E. Interaction Hooks

**useCanvasInteraction.ts** — Pan & zoom:
- **Pan**: Space + drag → setCamera with adjusted x/y
- **Zoom**: Mouse wheel → `zoomAtPoint()` to keep cursor under same world position
- Pan delta divided by zoom for consistent speed

**useSelectionInteraction.ts** — Click, shift+click, marquee:
- **Click**: Hit test with 5px tolerance, setSelectedIds({id})
- **Click empty**: setSelectedIds(empty)
- **Shift+click**: Toggle ID in selectedIds
- **Marquee**: Drag on empty space (5px threshold) → dashed blue rectangle → on release, select all intersecting

**useManipulationInteraction.ts** — Move, resize, delete, duplicate:
- **Move**: Drag body of selected → move all selected while maintaining relative positions
  - Emit `move` ProtocolOperation on pointerup
- **Resize corner**: Drag corner handle → free resize (shift = constrain aspect ratio)
  - Emit `transform` operation
- **Resize edge**: Drag edge midpoint → one-dimension resize
- **Min size**: Cannot resize below 10×10 world units
- **Delete**: Backspace/Delete removes all selected unlocked expressions
- **Duplicate**: Ctrl+D duplicates selected with +20,+20 offset
- **Locked guard**: Locked expressions are no-ops for move/resize/delete
- **Cursor feedback**: 'move' on body, resize arrows on handles

**useUndoRedoShortcuts.ts** — Keyboard shortcuts:
- Ctrl+Z / Cmd+Z → undo()
- Ctrl+Shift+Z / Cmd+Shift+Z → redo()

### F. Hit Testing

**File**: `src/interaction/hitTest.ts`

Pure geometry functions (world coordinates, with tolerance):
- `hitTestRectangle()` — AABB + tolerance
- `hitTestEllipse()` — Ellipse equation
- `hitTestDiamond()` — Rhombus equation
- `hitTestLine()` — Distance to line segment
- `hitTestArrow()` — Line + arrowheads
- `hitTestFreehand()` — Distance to stroke curve
- `hitTestText()` — AABB of text box
- `hitTestStickyNote()` — AABB
- `hitTestImage()` — AABB

### G. Selection & Manipulation Helpers

**File**: `src/interaction/selectionManager.ts`:
- `findExpressionAtPoint(point, expressions, tolerance)` — Hit test all, return topmost
- `findExpressionsInMarquee(marquee, expressions)` — AABB intersection with marquee rectangle

**File**: `src/interaction/manipulationHelpers.ts`:
- `getHandlePositions(expr)` — Compute 8 corner/edge handles
- `detectHandle(point, expr, camera, tolerance)` → HandleHit | null
- `detectPointerTarget(point, expressions, selectedIds, camera)` → { kind: 'handle' | 'body' | 'none' }
- `computeResize(handle, startWorld, currentWorld, original, constrainAspect)` → new position/size

### H. Persistence

**File**: `src/persistence/localStorage.ts`

Saves minimal state to localStorage:
```typescript
interface PersistedCanvasState {
  expressions: Record<string, VisualExpression>;
  expressionOrder: string[];
  camera: Camera;
}
```

Excluded: selection, undo history, operationLog, activeTool (transient state only)

- `saveCanvasState(state)` — Serialize to JSON, handle QuotaExceededError
- `loadCanvasState()` → PersistedCanvasState | null — Validate structure with type guards

### I. Gateway Connection

**File**: `src/hooks/useGatewayConnection.ts`

Plain-object factory (not a React hook) for WebSocket collaboration:

```typescript
interface GatewayConnectionOptions {
  url: string;              // ws://localhost:8080
  apiKey: string;
  sessionId?: string;       // omit to create new
}

interface GatewayConnection {
  readonly connected: boolean;
  readonly sessionId: string | null;
  readonly agents: AuthorInfo[];
  readonly error: string | null;
  disconnect(): void;
}

function createGatewayConnection(opts: GatewayConnectionOptions): GatewayConnection
```

**Messages**:
- Client → Server: create-session, join, operation
- Server → Client: session-created, state-sync, operation (broadcast), agent-joined, agent-left, error

**State Sync**: When joining, server sends full expressions + order, client calls `replaceState()`.

### J. Components

**Canvas.tsx**:
- Full-viewport HTML5 canvas (100vw × 100vh)
- ResizeObserver with 100ms debounce for canvas resizing
- Device pixel ratio handling for crisp rendering
- integrates all interaction hooks (pan, selection, manipulation, undo/redo)
- Creates RenderLoop and manages its lifecycle
- Wrapped in ErrorBoundary

**ErrorBoundary.tsx**:
- React error boundary for crash resilience

### K. Test Framework

**Framework**: Vitest v3.0 with jsdom + @testing-library/react

**Config** (`vitest.config.ts`):
```typescript
export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  },
});
```

**Test Files** (32 total):
- `canvasStore.test.ts` — 41 tests for state mutations
- `canvasStore.integration.test.ts` — 24 tests for integration scenarios
- `canvasStore.remote.test.ts` — Remote operation handling
- `canvasStoreUndo.test.ts` — Undo/redo
- `useCanvasInteraction.test.tsx` — Pan/zoom interaction
- `useSelectionInteraction.test.tsx` — Click/marquee selection
- `useManipulationInteraction.test.tsx` — Move/resize/delete
- `useUndoRedoShortcuts.test.tsx` — Keyboard shortcuts
- `Canvas.test.tsx` — Canvas component rendering
- `primitiveRenderer.test.ts` — Primitive rendering
- `flowchartRenderer.test.ts` — Flowchart layout + rendering
- `gridRenderer.test.ts` — Grid rendering
- `selectionRenderer.test.ts` — Selection UI
- `hitTest.test.ts` — Hit testing geometry
- `camera.test.ts` — Camera math
- `localStorage.test.ts` — Persistence
- `useAutoSave.test.ts` — Auto-save to localStorage
- Plus integration tests for rendering, undo, gateway, etc.

**Test Patterns**:
- TDD: acceptance criteria → tests → implementation
- Test fixtures with ExpressionBuilder
- State reset in beforeEach
- Mock vitest for localStorage, setTimeout

### L. Dependencies

```json
{
  "dependencies": {
    "@dagrejs/dagre": "^2.0.4",
    "@infinicanvas/protocol": "*",
    "immer": "^10.1.1",
    "nanoid": "^5.0.9",
    "perfect-freehand": "^1.2.3",
    "roughjs": "^4.6.6",
    "zustand": "^5.0.0"
  },
  "peerDependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "jsdom": "^28.1.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

---

## 4. PACKAGES/APP/ - React Web App

**Purpose**: Vite dev server + build, renders Canvas from engine.

### Source Files:
- `src/main.tsx` — React entry point, renders App
- `src/App.tsx` — Root component: Canvas + AgentSidebar
- `src/components/sidebar/AgentSidebar.tsx` — Collapsible agent panel
- `vite.config.ts` — Vite config (React plugin, port 5173)

### AgentSidebar:

Displays connected agents (from `useAgentStore`):
- Fixed position top-right
- Collapsible header
- Status dot (green = connected)
- Activity indicator (orange pulsing = active)
- Dark theme with dark background (#1e1e1e)

### Dependencies:

```json
{
  "dependencies": {
    "@infinicanvas/engine": "*",
    "@infinicanvas/protocol": "*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0",
    "vitest": "^4.1.0"
  }
}
```

### Build:
```bash
npm run dev     # Vite dev server
npm run build   # tsc && vite build
npm run test    # vitest
```

---

## 5. BUILD SYSTEM

### Root `package.json`:
```json
{
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "clean": "npm run clean --workspaces --if-present"
  }
}
```

### Per-Package Scripts:

**@infinicanvas/protocol**:
```
build: tsc
test: vitest run
test:watch: vitest
clean: rm -rf dist *.tsbuildinfo
```

**@infinicanvas/engine**:
```
build: tsc
test: vitest run
test:watch: vitest
clean: rm -rf dist *.tsbuildinfo
```

**@infinicanvas/app**:
```
dev: vite
build: tsc && vite build
preview: vite preview
test: vitest run
test:watch: vitest
clean: rm -rf dist
```

**@infinicanvas/gateway**:
```
start: tsx src/server.ts
build: tsc
test: vitest run
test:watch: vitest
clean: rm -rf dist *.tsbuildinfo
```

**@infinicanvas/mcp-server**:
```
start: tsx src/main.ts
build: tsc
test: vitest run
test:watch: vitest
clean: rm -rf dist *.tsbuildinfo
```

### TypeScript Config

**`tsconfig.base.json`**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": false
  }
}
```

---

## 6. COMPLETE DIRECTORY TREES

### packages/engine/
```
engine/
├── src/
│   ├── __tests__/                       [32 test files]
│   │   ├── agentStore.test.ts
│   │   ├── camera.test.ts
│   │   ├── Canvas.test.tsx
│   │   ├── canvasStore.integration.test.ts
│   │   ├── canvasStore.remote.test.ts
│   │   ├── canvasStore.test.ts
│   │   ├── canvasStoreUndo.test.ts
│   │   ├── compositeDispatch.test.ts
│   │   ├── compositeIntegration.test.ts
│   │   ├── compositeRegistry.test.ts
│   │   ├── drawableCache.test.ts
│   │   ├── ErrorBoundary.test.tsx
│   │   ├── flowchartRenderer.test.ts
│   │   ├── gateway.integration.test.ts
│   │   ├── gridRenderer.test.ts
│   │   ├── historyManager.test.ts
│   │   ├── hitTest.test.ts
│   │   ├── hitTestCamera.integration.test.ts
│   │   ├── localStorage.test.ts
│   │   ├── manipulationHelpers.test.ts
│   │   ├── persistence.edge.test.ts
│   │   ├── primitiveRenderer.test.ts
│   │   ├── renderLoop.test.ts
│   │   ├── selectionManager.test.ts
│   │   ├── selectionRenderer.test.ts
│   │   ├── styleMapper.test.ts
│   │   ├── undoPersistence.integration.test.ts
│   │   ├── useAutoSave.test.ts
│   │   ├── useCanvasInteraction.test.tsx
│   │   ├── useGatewayConnection.test.ts
│   │   ├── useManipulationInteraction.test.tsx
│   │   ├── useSelectionInteraction.test.tsx
│   │   └── useUndoRedoShortcuts.test.tsx
│   ├── camera.ts                        [camera math: screenToWorld, worldToScreen, etc.]
│   ├── components/
│   │   ├── Canvas.tsx                   [full-viewport canvas, render loop, interaction]
│   │   └── ErrorBoundary.tsx            [React error boundary]
│   ├── history/
│   │   └── historyManager.ts            [undo/redo snapshot management]
│   ├── hooks/
│   │   ├── useAutoSave.ts               [debounced localStorage save]
│   │   ├── useCanvasInteraction.ts      [pan & zoom]
│   │   ├── useGatewayConnection.ts      [WebSocket collaboration]
│   │   ├── useManipulationInteraction.ts [move, resize, delete, duplicate]
│   │   ├── useSelectionInteraction.ts   [click, marquee selection]
│   │   └── useUndoRedoShortcuts.ts      [keyboard shortcuts]
│   ├── index.ts                         [public API exports]
│   ├── interaction/
│   │   ├── hitTest.ts                   [point-in-shape geometry]
│   │   ├── manipulationHelpers.ts       [handle detection, resize, cursor]
│   │   └── selectionManager.ts          [find expression at point, marquee]
│   ├── persistence/
│   │   └── localStorage.ts              [save/load canvas state]
│   ├── renderer/
│   │   ├── compositeRegistry.ts         [register custom composite renderers]
│   │   ├── composites/
│   │   │   └── flowchartRenderer.ts     [flowchart layout + rendering]
│   │   ├── drawableCache.ts             [cache Rough.js drawables by style hash]
│   │   ├── gridRenderer.ts              [infinite grid background]
│   │   ├── primitiveRenderer.ts         [render all 9 primitive kinds]
│   │   ├── renderLoop.ts                [RAF loop: clear → transform → grid → expressions]
│   │   ├── selectionRenderer.ts         [selection boxes + resize handles]
│   │   ├── styleMapper.ts               [ExpressionStyle → Rough.js options]
│   │   └── viewportCulling.ts           [AABB visibility check]
│   ├── store/
│   │   ├── agentStore.ts                [Zustand: connected agents]
│   │   └── canvasStore.ts               [Zustand: expressions, camera, tools, undo]
│   ├── types/
│   │   └── index.ts                     [CanvasState, CanvasActions, ToolType, Camera]
│   └── index.ts                         [public API]
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── [dist, *.tsbuildinfo after build]
```

### packages/app/
```
app/
├── src/
│   ├── __tests__/
│   │   ├── AgentSidebar.integration.test.tsx
│   │   └── AgentSidebar.test.tsx
│   ├── components/
│   │   └── sidebar/
│   │       ├── AgentSidebar.tsx
│   │       └── index.ts
│   ├── App.tsx                          [Canvas + AgentSidebar]
│   ├── main.tsx                         [React entry point]
│   └── index.html                       [HTML template]
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── [dist after build]
```

### packages/protocol/
```
protocol/
├── src/
│   ├── __tests__/
│   │   ├── builder.test.ts
│   │   └── schema.test.ts
│   ├── builders/
│   │   └── expressionBuilder.ts         [fluent builder for expressions]
│   ├── schema/
│   │   ├── annotations.ts               [Comment, Callout, Highlight, Marker]
│   │   ├── composites.ts                [Flowchart, Sequence, Wireframe, etc.]
│   │   ├── expressions.ts               [VisualExpression type]
│   │   ├── metadata.ts                  [AuthorInfo, ExpressionStyle, DEFAULT_*]
│   │   ├── operations.ts                [ProtocolOperation types]
│   │   └── primitives.ts                [Rectangle, Ellipse, Line, Text, etc.]
│   ├── validation/
│   │   └── schemas.ts                   [Zod schemas for all types]
│   └── index.ts                         [public API exports]
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── [dist, *.tsbuildinfo after build]
```

### packages/gateway/ & packages/mcp-server/
Minimal structure, WebSocket servers (not analyzed in detail).

---

## 7. KEY PATTERNS & CONVENTIONS

### 1. Expression Types & Builders
- Always use `ExpressionBuilder` to create expressions in tests
- All expressions validated with Zod schemas before adding to store
- Never mutate expressions directly; always call store actions

### 2. Store Usage
- Subscribe with `useCanvasStore((state) => state.field)`
- Content mutations push snapshots BEFORE state update
- ProtocolOperations always created with unique ID + current timestamp
- Remote operations never added to operationLog (prevent loops)

### 3. Rendering
- Canvas 2D API via Rough.js for hand-drawn aesthetic
- Each frame: clear → apply transform → grid → primitives → selection
- Viewport culling skips off-screen expressions
- Drawable caching by style hash

### 4. Interaction
- Hit testing uses world coordinates + tolerance (converted from screen pixels)
- Marquee and selection use AABB intersection
- Locked expressions are no-ops for move/resize/delete
- Drag threshold: 5px to distinguish click from drag

### 5. Camera System
- Camera model: `screen = (world - camera) × zoom`
- Zoom centered on cursor (world point under cursor stays fixed)
- Pan delta divided by zoom for consistent speed
- Camera bounds: zoom ∈ [0.01, 100]

### 6. Persistence
- Only expressions, expressionOrder, camera saved to localStorage
- Selection, undo history, operationLog excluded (transient)
- Key: 'infinicanvas:state'

### 7. Testing
- Vitest + jsdom for unit/integration tests
- Test files colocated in `__tests__/` directories
- Acceptance criteria mapped to test descriptions
- Tests run in parallel, reset state in beforeEach

---

## 8. KEY FILES FOR IMPLEMENTATION

**For new tool/feature**:
1. Add type to `ToolType` in `packages/engine/src/types/index.ts`
2. Add expression kind to `packages/protocol/src/schema/primitives.ts` or `composites.ts`
3. Add Zod schema to `packages/protocol/src/validation/schemas.ts`
4. Add renderer to `packages/engine/src/renderer/primitiveRenderer.ts`
5. Add hit test to `packages/engine/src/interaction/hitTest.ts`
6. Update store if special behavior needed
7. Add tests

**Key locations**:
- Types: `packages/protocol/src/schema/`
- Store actions: `packages/engine/src/store/canvasStore.ts`
- Rendering: `packages/engine/src/renderer/primitiveRenderer.ts`
- Interaction: `packages/engine/src/hooks/useManipulationInteraction.ts`
- Hit testing: `packages/engine/src/interaction/hitTest.ts`

---

## 9. COMMAND REFERENCE

```bash
# Root
npm run build                    # Build all packages
npm run test                     # Test all packages
npm run lint                     # Lint all packages
npm run clean                    # Clean all packages

# Engine
cd packages/engine
npm run build                    # TypeScript compile
npm run test                     # Run vitest
npm run test:watch              # Watch mode

# App
cd packages/app
npm run dev                      # Start Vite dev server (port 5173)
npm run build                    # TypeScript + Vite build
npm run test                     # vitest
npm run test:watch

# Protocol
cd packages/protocol
npm run build
npm run test

# Gateway
cd packages/gateway
npm run start                    # Start WebSocket server
npm run build
npm run test

# MCP Server
cd packages/mcp-server
npm run start                    # Start MCP server
npm run build
npm run test
```

---

## 10. CRITICAL DESIGN DECISIONS

1. **Canvas 2D, not WebGL** — Simpler implementation, roughjs aesthetic
2. **Zustand + Immer** — Minimal boilerplate, immutable updates
3. **ProtocolOperations for collaboration** — Every mutation logged for replay/sync
4. **Snapshots for undo/redo** — Simple, doesn't require operation inversion
5. **Viewport culling** — Skip rendering off-screen for performance
6. **Rough.js for hand-drawn look** — Part of visual identity
7. **ExpressionBuilder for tests** — Fluent API reduces boilerplate
8. **Zod validation** — Runtime safety for all remote/imported data
9. **Locked expressions** — Guard against accidental manipulation
10. **LocalStorage for persistence** — Automatic recovery without backend

___BEGIN___COMMAND_DONE_MARKER___0
