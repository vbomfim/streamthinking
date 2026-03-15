# InfiniCanvas Quick Reference

## Core Concepts

**VisualExpression** — Every element on canvas has:
- `id`, `kind` (discriminant for `data` payload)
- `position` {x, y}, `size` {width, height}, `angle`
- `style` (colors, roughness, strokeWidth, etc.)
- `meta` (author, timestamps, locked status, tags)
- `data` (kind-specific payload: label, points, text, etc.)

**ExpressionKind** → 9 primitives + 12 composites + 4 annotations = 25 types

**ToolType** → 'select' | 'rectangle' | 'ellipse' | 'diamond' | 'line' | 'arrow' | 'freehand' | 'text'

**ProtocolOperation** — Every mutation (create, update, delete, move, transform, style) includes author + timestamp for collaboration

## Store (Zustand + Immer)

```typescript
useCanvasStore.getState().addExpression(expr)        // Validates, emits op
useCanvasStore.getState().updateExpression(id, {})   // Partial update, validates
useCanvasStore.getState().deleteExpressions([ids])   // Filter locked
useCanvasStore.getState().setSelectedIds(new Set())  // UI-only, no op
useCanvasStore.getState().setActiveTool('rectangle') // UI-only
useCanvasStore.getState().setCamera({x, y, zoom})   // Pan/zoom
useCanvasStore.getState().undo()                     // Restore snapshot
useCanvasStore.getState().redo()
useCanvasStore.getState().moveExpressions([{id, from, to}])    // Emits op
useCanvasStore.getState().transformExpression(id, original, final)  // Emits op
```

Snapshots capture full expressions + z-order. HistoryManager lives outside Zustand.

## Rendering

**Per frame (requestAnimationFrame)**:
1. Clear canvas (identity transform)
2. Apply camera transform (translate + scale)
3. Render grid (lines in world space)
4. Render expressions (iterate order, viewport cull, draw by kind)
5. Render selection (boxes + handles)

**Technology**: Canvas 2D API + Rough.js for hand-drawn + perfect-freehand for strokes

```typescript
// from Canvas.tsx
const loop = createRenderLoop(ctx, getCamera, width, height, roughCanvas, 
                              expressionProvider, selectionProvider);
loop.start();
```

## Camera Math

```typescript
import { screenToWorld, worldToScreen, zoomAtPoint } from '@infinicanvas/engine';

// Screen (pixel) ↔ World coordinates
worldPoint = screenToWorld(sx, sy, camera)  // sx/zoom + camera.x
screenPoint = worldToScreen(wx, wy, camera) // (wx - camera.x) * zoom

// Zoom centered on cursor (world point stays fixed)
newCamera = zoomAtPoint(camera, screenX, screenY, newZoom)

// Apply to context
applyTransform(ctx, camera)
```

## Interaction Hooks

**Pan & Zoom**: Space + drag to pan, scroll wheel to zoom
```typescript
const { canvasRef, cursor } = useCanvasInteraction();
```

**Selection**: Click to select, shift+click to toggle, drag to marquee
```typescript
const { renderMarquee } = useSelectionInteraction(canvasRef);
```

**Manipulation**: Move, resize, rotate selected
```typescript
const { cursor: manipulationCursor } = useManipulationInteraction(canvasRef);
// Emits move/transform ops on release
```

**Undo/Redo**: Ctrl+Z / Ctrl+Shift+Z
```typescript
useUndoRedoShortcuts();
```

## Hit Testing

```typescript
import { hitTestExpression, screenToWorld } from '@infinicanvas/engine';

const worldPoint = screenToWorld(mouseX, mouseY, camera);
const tolerance = 5 / camera.zoom; // 5px in screen space
const hit = hitTestExpression(worldPoint, expr, tolerance);
```

## Persistence

```typescript
import { saveCanvasState, loadCanvasState } from '@infinicanvas/engine';

// Saves only: expressions, expressionOrder, camera
// Excludes: selection, undo/redo, operationLog, activeTool
saveCanvasState({
  expressions: state.expressions,
  expressionOrder: state.expressionOrder,
  camera: state.camera,
});

const state = loadCanvasState(); // null if not found or corrupt
```

## Creating New Expression Type

1. Add to `packages/protocol/src/schema/primitives.ts`:
```typescript
export interface MyShapeData {
  kind: 'my-shape';
  // ... payload fields
}
```

2. Add to union in `primitives.ts`:
```typescript
export type PrimitiveData = ... | MyShapeData;
```

3. Add Zod schema to `packages/protocol/src/validation/schemas.ts`

4. Add renderer to `packages/engine/src/renderer/primitiveRenderer.ts`:
```typescript
function renderMyShape(ctx, roughCanvas, expr, camera) {
  // ... draw
}
```

5. Add hit test to `packages/engine/src/interaction/hitTest.ts`:
```typescript
export function hitTestMyShape(point, expr, tolerance) {
  // ... point in shape
}
```

6. Update `hitTestExpression()` switch in `hitTest.ts`

7. Add to `ToolType` if drawable tool, or keep as agent-only

## Testing

```bash
# Run all tests
npm run test

# Run engine tests with watch
cd packages/engine && npm run test:watch

# Run app dev server
cd packages/app && npm run dev
```

Test pattern:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@infinicanvas/engine';
import { ExpressionBuilder } from '@infinicanvas/protocol';

beforeEach(() => {
  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
    operationLog: [],
    canUndo: false,
    canRedo: false,
  });
  useCanvasStore.getState().clearHistory();
});

describe('feature', () => {
  it('does something', () => {
    const builder = new ExpressionBuilder({ type: 'human', id: 'u1', name: 'Test' });
    const expr = builder.rectangle(100, 200, 300, 150).build();
    useCanvasStore.getState().addExpression(expr);
    
    expect(useCanvasStore.getState().expressions[expr.id]).toBeDefined();
  });
});
```

## Key Files

| Task | File |
|------|------|
| Add type | `packages/protocol/src/schema/*.ts` |
| Render | `packages/engine/src/renderer/primitiveRenderer.ts` |
| Hit test | `packages/engine/src/interaction/hitTest.ts` |
| Store action | `packages/engine/src/store/canvasStore.ts` |
| Interaction | `packages/engine/src/hooks/*.ts` |
| Component | `packages/app/src/App.tsx` or `components/` |
| Test | `src/__tests__/*.test.{ts,tsx}` |

## Defaults

```typescript
// Always use this for new expressions
export const DEFAULT_EXPRESSION_STYLE: ExpressionStyle = {
  strokeColor: '#1e1e1e',
  backgroundColor: 'transparent',
  fillStyle: 'hachure',
  strokeWidth: 2,
  roughness: 1,
  opacity: 1,
};

// Max operations in log
const MAX_OPERATION_LOG = 10_000;

// Camera zoom bounds
const MIN_ZOOM = 0.01;
const MAX_ZOOM = 100;
```

## Debug Checklist

- [ ] State reset before test?
- [ ] Expression validated with Zod?
- [ ] Camera values finite (not NaN/Infinity)?
- [ ] Hit test using world coordinates?
- [ ] Snapshot pushed BEFORE mutation?
- [ ] Operation created with unique ID + timestamp?
- [ ] Locked expressions filtered in mutations?
- [ ] Viewport culling applied in render?
- [ ] Remote op NOT added to operationLog?
