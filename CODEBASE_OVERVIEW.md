# InfiniCanvas Codebase Overview

## 1. PROTOCOL PACKAGE TYPES (`packages/protocol/src/`)

### Core Type: VisualExpression

**File**: `packages/protocol/src/schema/expressions.ts`

```typescript
interface VisualExpression {
  /** Unique identifier for this expression. */
  id: string;
  
  /** The kind of expression — discriminant for the `data` field. */
  kind: ExpressionKind;
  
  /** Position on the canvas (top-left corner). */
  position: { x: number; y: number };
  
  /** Dimensions of the expression bounding box. */
  size: { width: number; height: number };
  
  /** Rotation angle in degrees. */
  angle: number;
  
  /** Visual styling. */
  style: ExpressionStyle;
  
  /** Expression metadata. */
  meta: {
    /** Who created this expression. */
    author: AuthorInfo;
    /** Unix timestamp (ms) when the expression was created. */
    createdAt: number;
    /** Unix timestamp (ms) when the expression was last updated. */
    updatedAt: number;
    /** ID of the operation that produced this expression. */
    sourceOperation?: string;
    /** Freeform tags for categorization. */
    tags: string[];
    /** Whether this expression is locked from editing. */
    locked: boolean;
  };
  
  /** ID of the parent expression (for grouping/nesting). */
  parentId?: string;
  
  /** IDs of child expressions. */
  children?: string[];
  
  /** Kind-specific data payload (discriminated by `kind`). */
  data: ExpressionData;
}
```

---

### ExpressionKind Type

```typescript
// Derived from ExpressionData discriminated union
type ExpressionKind = ExpressionData['kind'];
```

**All valid kinds**:
- **Primitives**: `rectangle`, `ellipse`, `diamond`, `line`, `arrow`, `freehand`, `text`, `sticky-note`, `image`
- **Composites**: `flowchart`, `sequence-diagram`, `wireframe`, `reasoning-chain`, `roadmap`, `mind-map`, `kanban`, `decision-tree`, `collaboration-diagram`, `slide`, `code-block`, `table`
- **Annotations**: `comment`, `callout`, `highlight`, `marker`

---

### ExpressionData: Discriminated Union

**File**: `packages/protocol/src/schema/expressions.ts` (imports from other files)

```typescript
type ExpressionData = PrimitiveData | CompositeData | AnnotationData;
```

#### **PrimitiveData Variants** (`packages/protocol/src/schema/primitives.ts`)

```typescript
interface RectangleData {
  kind: 'rectangle';
  label?: string;
}

interface EllipseData {
  kind: 'ellipse';
  label?: string;
}

interface DiamondData {
  kind: 'diamond';
  label?: string;
}

interface LineData {
  kind: 'line';
  /** Array of [x, y] coordinate pairs forming the line. */
  points: [number, number][];
}

interface ArrowData {
  kind: 'arrow';
  /** Array of [x, y] coordinate pairs forming the arrow path. */
  points: [number, number][];
  /** Whether to render an arrowhead at the start. */
  startArrowhead?: boolean;
  /** Whether to render an arrowhead at the end. */
  endArrowhead?: boolean;
}

interface FreehandData {
  kind: 'freehand';
  /** Array of [x, y, pressure] tuples capturing the stroke. */
  points: [number, number, number][];
}

interface TextData {
  kind: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  textAlign: 'left' | 'center' | 'right';
}

interface StickyNoteData {
  kind: 'sticky-note';
  text: string;
  /** Background color of the sticky note. */
  color: string;
}

interface ImageData {
  kind: 'image';
  /** Image source URL or data URI. */
  src: string;
  /** Alternative text description. */
  alt?: string;
}

type PrimitiveData =
  | RectangleData
  | EllipseData
  | DiamondData
  | LineData
  | ArrowData
  | FreehandData
  | TextData
  | StickyNoteData
  | ImageData;
```

#### **CompositeData Variants** (`packages/protocol/src/schema/composites.ts`)

```typescript
interface FlowchartData {
  kind: 'flowchart';
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  direction: 'TB' | 'LR' | 'BT' | 'RL';
}

interface SequenceDiagramData {
  kind: 'sequence-diagram';
  title: string;
  participants: Participant[];
  messages: Message[];
}

interface WireframeData {
  kind: 'wireframe';
  title: string;
  screenSize: { width: number; height: number };
  components: WireframeComponent[];
}

interface ReasoningChainData {
  kind: 'reasoning-chain';
  question: string;
  steps: ReasoningStep[];
  finalAnswer: string;
}

interface RoadmapData {
  kind: 'roadmap';
  title: string;
  orientation: 'horizontal' | 'vertical';
  phases: RoadmapPhase[];
}

interface MindMapData {
  kind: 'mind-map';
  centralTopic: string;
  branches: MindMapBranch[];
}

interface KanbanData {
  kind: 'kanban';
  title: string;
  columns: KanbanColumn[];
}

interface DecisionTreeData {
  kind: 'decision-tree';
  question: string;
  options: DecisionOption[];
}

interface CollaborationDiagramData {
  kind: 'collaboration-diagram';
  title: string;
  objects: CollabObject[];
  links: CollabLink[];
}

interface SlideData {
  kind: 'slide';
  title: string;
  bullets: string[];
  layout: 'title' | 'bullets' | 'split';
}

interface CodeBlockData {
  kind: 'code-block';
  language: string;
  code: string;
}

interface TableData {
  kind: 'table';
  headers: string[];
  rows: string[][];
}

type CompositeData =
  | FlowchartData
  | SequenceDiagramData
  | WireframeData
  | ReasoningChainData
  | RoadmapData
  | MindMapData
  | KanbanData
  | DecisionTreeData
  | CollaborationDiagramData
  | SlideData
  | CodeBlockData
  | TableData;
```

#### **AnnotationData Variants** (`packages/protocol/src/schema/annotations.ts`)

```typescript
interface CommentData {
  kind: 'comment';
  text: string;
  targetExpressionId: string;
  resolved: boolean;
}

interface CalloutData {
  kind: 'callout';
  text: string;
  targetExpressionId: string;
  position: 'top' | 'right' | 'bottom' | 'left';
}

interface HighlightData {
  kind: 'highlight';
  targetExpressionIds: string[];
  color: string;
}

interface MarkerData {
  kind: 'marker';
  label: string;
  icon?: string;
}

type AnnotationData =
  | CommentData
  | CalloutData
  | HighlightData
  | MarkerData;
```

---

### AuthorInfo Type

**File**: `packages/protocol/src/schema/metadata.ts`

```typescript
type AuthorInfo =
  | { type: 'human'; id: string; name: string }
  | { type: 'agent'; id: string; name: string; provider: string };
```

---

### ExpressionStyle Type

**File**: `packages/protocol/src/schema/metadata.ts`

```typescript
interface ExpressionStyle {
  /** Stroke color in hex format (e.g. '#000000') */
  strokeColor: string;
  
  /** Background color in hex format, or 'transparent' */
  backgroundColor: string;
  
  /** Fill rendering style */
  fillStyle: 'solid' | 'hachure' | 'cross-hatch' | 'none';
  
  /** Stroke width in pixels (1–10) */
  strokeWidth: number;
  
  /** Roughness factor: 0 = smooth, 1+ = sketchy hand-drawn look */
  roughness: number;
  
  /** Opacity: 0 = fully transparent, 1 = fully opaque */
  opacity: number;
  
  /** Font size in pixels (optional, for text-containing expressions) */
  fontSize?: number;
  
  /** Font family name (optional) */
  fontFamily?: string;
}
```

---

### DEFAULT_EXPRESSION_STYLE

**File**: `packages/protocol/src/schema/metadata.ts`

```typescript
export const DEFAULT_EXPRESSION_STYLE: ExpressionStyle = {
  strokeColor: '#1e1e1e',
  backgroundColor: 'transparent',
  fillStyle: 'hachure',
  strokeWidth: 2,
  roughness: 1,
  opacity: 1,
};
```

---

### All Zod Schemas

**File**: `packages/protocol/src/validation/schemas.ts`

#### Metadata Schemas
- `humanAuthorSchema` - discriminated by `type: 'human'`
- `agentAuthorSchema` - discriminated by `type: 'agent'`
- `authorInfoSchema` - discriminated union of both author types
- `expressionStyleSchema` - validates all style fields with hex color pattern

#### Primitive Data Schemas
- `rectangleDataSchema`
- `ellipseDataSchema`
- `diamondDataSchema`
- `lineDataSchema` - requires min 2 points
- `arrowDataSchema` - requires min 2 points, optional arrowhead booleans
- `freehandDataSchema` - requires min 1 3D point (x, y, pressure)
- `textDataSchema` - requires text, fontSize, fontFamily, textAlign enum
- `stickyNoteDataSchema`
- `imageDataSchema` - validates src as http(s) URL or data:image/ URI

#### Composite Data Schemas
- `flowchartDataSchema` - nodes + edges, direction enum
- `sequenceDiagramDataSchema` - participants + messages
- `wireframeDataSchema` - components with positions/sizes
- `reasoningChainDataSchema` - question + steps + finalAnswer
- `roadmapDataSchema` - phases with items (status enum)
- `mindMapDataSchema` - recursive branches (using `z.lazy()`)
- `kanbanDataSchema` - columns with cards
- `decisionTreeDataSchema` - recursive options (using `z.lazy()`)
- `collaborationDiagramDataSchema` - objects + links
- `slideDataSchema` - layout enum
- `codeBlockDataSchema` - language + code
- `tableDataSchema` - headers + rows

#### Annotation Data Schemas
- `commentDataSchema`
- `calloutDataSchema`
- `highlightDataSchema`
- `markerDataSchema`

#### Union Schemas
- `expressionDataSchema` - discriminated union of all data types (primitives + composites + annotations)
- `visualExpressionSchema` - full VisualExpression validation with `.refine()` to match kind to data.kind

#### Operation Schemas
- `createPayloadSchema`
- `updatePayloadSchema`
- `deletePayloadSchema`
- `movePayloadSchema`
- `transformPayloadSchema`
- `groupPayloadSchema`
- `ungroupPayloadSchema`
- `annotatePayloadSchema`
- `morphPayloadSchema`
- `lockPayloadSchema`
- `unlockPayloadSchema`
- `stylePayloadSchema`
- `reorderPayloadSchema`
- `snapshotPayloadSchema`
- `queryPayloadSchema`
- `operationPayloadSchema` - discriminated union of all payload types
- `protocolOperationSchema` - full operation with type, author, timestamp

---

## 2. TEST PATTERNS

### Test Files in `packages/engine/src/__tests__/` (28 files total)

1. `renderLoop.test.ts`
2. `undoPersistence.integration.test.ts`
3. `drawableCache.test.ts`
4. `canvasStoreUndo.test.ts`
5. `gridRenderer.test.ts`
6. `agentStore.test.ts`
7. `useGatewayConnection.test.ts`
8. `compositeRegistry.test.ts`
9. `compositeIntegration.test.ts`
10. `primitiveRenderer.test.ts`
11. `useAutoSave.test.ts`
12. `localStorage.test.ts`
13. `hitTestCamera.integration.test.ts`
14. `historyManager.test.ts` ✓ Full shown below
15. `selectionRenderer.test.ts`
16. `styleMapper.test.ts`
17. `camera.test.ts`
18. `selectionManager.test.ts`
19. `manipulationHelpers.test.ts`
20. `flowchartRenderer.test.ts`
21. `viewportCulling.test.ts`
22. `canvasStore.remote.test.ts`
23. `gateway.integration.test.ts`
24. `canvasStore.test.ts` ✓ Partially shown below (20.4 KB)
25. `hitTest.test.ts`
26. `canvasStore.integration.test.ts`
27. `persistence.edge.test.ts`
28. `compositeDispatch.test.ts`

### Pattern 1: historyManager.test.ts (Unit Test)

**Full file shown in Section 2 output above**

**Key Patterns**:
- Imports: `vitest` (describe, it, expect, beforeEach), protocol types/builders
- Test fixtures using `ExpressionBuilder`
- `beforeEach()` to reset store state
- Describe blocks organized by acceptance criteria (AC1, AC2, etc.)
- Test names follow pattern: "verb + condition [optional AC ref]"
- Assertions use expect with various matchers (.toBe, .toEqual, .toBeNull, .toBeDefined, etc.)
- Helper functions (makeExpression, makeSnapshot) reduce boilerplate
- No mocking needed for pure unit tests

### Pattern 2: canvasStore.test.ts (Store Unit Tests - First 350 lines)

**Key Patterns**:
- Imports: vitest + spies (vi.spyOn), protocol builders
- Store reset in beforeEach using `useCanvasStore.setState()`
- Test fixtures using builder methods
- Describe blocks for each action (addExpression, updateExpression, deleteExpressions, etc.)
- Mocking console.warn with `vi.spyOn(console, 'warn').mockImplementation()`
- Assertions check:
  - State changes (expressions map, expressionOrder, selectedIds)
  - Operation log entries (type, payload, timestamp)
  - Data integrity (unchanged fields, deep copy isolation)
- Detailed validation of operation payload structure
- Testing error cases with mock spy assertions

---

## 3. PACKAGE.JSON FILES

### `packages/engine/package.json`

```json
{
  "name": "@infinicanvas/engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "InfiniCanvas rendering engine — Zustand state store and Canvas component",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
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
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**Key Dependencies**:
- **State**: Zustand v5 (store management)
- **Data structures**: Immer (immutable updates), nanoid (ID generation)
- **Graphics**: roughjs (hand-drawn style), perfect-freehand (stroke smoothing), @dagrejs/dagre (diagram layout)
- **Testing**: vitest v3, @testing-library/react v16, jsdom
- **React**: v18.3 (peer dependency)

### `packages/app/package.json`

```json
{
  "name": "@infinicanvas/app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "InfiniCanvas React web application",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@infinicanvas/engine": "*",
    "@infinicanvas/protocol": "*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^28.1.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^4.1.0"
  }
}
```

**Key Differences from engine**:
- Uses Vite v6 (instead of just tsc)
- Depends on @infinicanvas/engine (instead of implementing rendering)
- Vitest v4.1.0 (engine uses v3.0.0)
- Testing library version 16.3.2 (engine uses 16.1.0)
- No graphics libraries needed (relies on engine)

---

## 4. TSCONFIG FILES

### `packages/engine/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["src/**/__tests__/**", "dist"]
}
```

**Key Settings**:
- Extends base config from monorepo root
- ES2022 target with DOM libraries
- JSX output as "react-jsx" (automatic JSX transform)
- Test files excluded from compilation (src/**/__tests__/**)
- Output to dist/, source from src/

### `packages/app/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["dist"]
}
```

**Key Differences**:
- Adds `"noEmit": true` (Vite handles emission, tsc just type-checks)
- Does NOT exclude test files (Vite dev server needs them)
- No explicit test directory exclusion

---

## 5. APP TEST FILES

**Result**: No test files found in `packages/app/src/__tests__/` (glob found no matches)

The app package likely relies on end-to-end tests in a separate directory or integration tests in the engine package.

---

## SUMMARY

| Aspect | Details |
|--------|---------|
| **Core Type** | `VisualExpression` - container with id, kind, position, size, angle, style, meta, data |
| **Expression Kinds** | 27 total: 9 primitives + 12 composites + 4 annotations + 2 special (marker, etc.) |
| **Data Payload** | Discriminated union `ExpressionData` with 27 variant types |
| **AuthorInfo** | Discriminated union: human OR agent (agent has provider field) |
| **Style** | 8 properties: colors, fill style, stroke width, roughness, opacity, optional font settings |
| **Default Style** | Dark stroke (#1e1e1e), transparent background, hachure fill, 2px stroke, 1.0 roughness/opacity |
| **Validation** | Zod schemas for all types; expression kind must match data.kind |
| **Builders** | Fluent API with ExpressionBuilder, chainable methods, auto-generates IDs with nanoid |
| **Test Pattern** | TDD approach: describe blocks by feature/AC, fixtures via builders, beforeEach reset, mocking with vi.spyOn |
| **Test Framework** | Vitest (v3 in engine, v4 in app), testing-library for React, jsdom for DOM |
| **Store** | Zustand v5, with operation logging and history management |
| **Build** | Engine: tsc; App: tsc + vite; Both use shared tsconfig.base.json |

