# InfiniCanvas Documentation Index

This repository now has comprehensive documentation for understanding and implementing features.

## 📚 Documentation Files

### 1. **ANALYSIS.md** (37 KB, 1,049 lines)
**Comprehensive deep dive into every aspect of the monorepo.**

Contents:
- Overall structure (6 packages, their purpose, relationships)
- packages/protocol/ — Complete type system (25 expression kinds, operations, validation)
- packages/engine/ — Full architecture (Zustand store, rendering pipeline, interaction system)
  - Canvas store (state fields, content mutations, undo/redo, remote operations)
  - Agent store
  - Rendering (renderLoop, primitiveRenderer, gridRenderer, viewport culling)
  - Camera math (screenToWorld, worldToScreen, zoomAtPoint)
  - All interaction hooks (pan, zoom, selection, manipulation)
  - Hit testing (9 primitive types)
  - Persistence (localStorage)
  - Gateway connection (WebSocket collaboration)
  - Components (Canvas, ErrorBoundary)
  - Test framework (Vitest, 32 tests)
  - Dependencies (zustand, immer, roughjs, perfect-freehand, etc.)
- packages/app/ — React web app (AgentSidebar, Vite config)
- Build system (workspaces, per-package scripts, tsconfig)
- Test patterns and conventions
- Critical design decisions

**Use this for:** Understanding how everything fits together, architectural decisions, state flow, rendering pipeline, interaction patterns.

---

### 2. **QUICK_REFERENCE.md** (6.7 KB, 240 lines)
**Quick lookup guide for common tasks.**

Contents:
- Core concepts (VisualExpression, ExpressionKind, ToolType, ProtocolOperation)
- Store API (useCanvasStore methods with brief descriptions)
- Rendering (per-frame process, technology stack)
- Camera math (screenToWorld, worldToScreen, zoomAtPoint)
- Interaction hooks (pan, selection, manipulation, undo/redo)
- Hit testing pattern
- Persistence API
- **How to create a new expression type** (step-by-step)
- Testing patterns (vitest setup, beforeEach reset)
- Key files table (which file for which task)
- Defaults (DEFAULT_EXPRESSION_STYLE, limits)
- Debug checklist

**Use this for:** Quick lookups, adding features, remembering API signatures, copy-paste code snippets.

---

### 3. **FILE_STRUCTURE.md** (13 KB, 308 lines)
**Complete directory tree with annotations and critical file paths.**

Contents:
- Full directory tree with inline comments explaining each file/directory
- Critical file paths organized by category:
  - Type System (protocol/src/schema/)
  - State & Store (engine/src/store/)
  - Rendering (engine/src/renderer/)
  - Interaction (engine/src/hooks/, engine/src/interaction/)
  - Components
  - Persistence
  - History
- Test locations
- Dependencies by package
- Entry points
- NPM scripts reference

**Use this for:** Finding files, understanding project organization, discovering what's in a specific directory.

---

### 4. **DOCUMENTATION_INDEX.md** (this file)
Navigation guide to all documentation.

---

## 🎯 Which Document Should I Read?

### I want to understand the entire system
→ Start with **ANALYSIS.md**

### I need to implement a specific feature
1. Check **QUICK_REFERENCE.md** for the pattern
2. Look up file paths in **FILE_STRUCTURE.md**
3. Reference detailed implementation in **ANALYSIS.md**

### I need to find a specific file or concept
→ Use **FILE_STRUCTURE.md** for files, **QUICK_REFERENCE.md** for concepts

### I'm debugging and need to remember something
→ **QUICK_REFERENCE.md** — scroll to "Debug Checklist"

### I need exact API signatures and behavior
→ **ANALYSIS.md** — search for the section

---

## 🔑 Key Concepts to Know

### VisualExpression
Every element on the canvas:
```typescript
{
  id: string,
  kind: ExpressionKind,  // discriminant for data
  position: {x, y},
  size: {width, height},
  angle: number,
  style: ExpressionStyle,
  meta: {author, timestamps, locked, tags},
  data: ExpressionData   // kind-specific
}
```

### Store (Zustand + Immer)
```typescript
useCanvasStore.getState().addExpression(expr)        // content mutation
useCanvasStore.getState().setSelectedIds(ids)        // UI-only
useCanvasStore.getState().undo()                     // snapshot-based
```

### Rendering Pipeline (per frame)
1. Clear canvas
2. Apply camera transform
3. Render grid
4. Render expressions (viewport culling)
5. Render selection

### Interaction
- **Pan**: Space + drag
- **Zoom**: Mouse wheel (centered on cursor)
- **Select**: Click / Shift+click / Marquee drag
- **Manipulate**: Move / Resize / Delete / Duplicate
- **Undo/Redo**: Ctrl+Z / Ctrl+Shift+Z

### Camera Math
```
worldPoint = screenPoint / zoom + camera
screenPoint = (worldPoint - camera) × zoom
```

---

## 📋 Implementation Checklist

### Adding a New Expression Type

1. ✅ Define data interface in `packages/protocol/src/schema/primitives.ts` or `composites.ts`
2. ✅ Add to union type (`PrimitiveData` or `CompositeData`)
3. ✅ Add Zod schema in `packages/protocol/src/validation/schemas.ts`
4. ✅ Create renderer in `packages/engine/src/renderer/primitiveRenderer.ts`
5. ✅ Create hit test in `packages/engine/src/interaction/hitTest.ts`
6. ✅ Update switch in `hitTestExpression()` function
7. ✅ Add to `ToolType` if drawable (optional)
8. ✅ Write tests in `__tests__/` directory

### Modifying Store

1. ✅ Understand: content mutations emit ProtocolOperations + push snapshots
2. ✅ UI-only mutations don't emit operations
3. ✅ Always validate expressions with Zod
4. ✅ Always filter locked expressions
5. ✅ Write tests first (TDD)

### Adding Rendering Feature

1. ✅ Update `renderExpressions()` or create new renderer
2. ✅ Use world coordinates (camera already applied)
3. ✅ Consider viewport culling
4. ✅ Test with fixtures

---

## 🧪 Testing Quick Start

```bash
# Run all tests
npm run test

# Watch mode (engine)
cd packages/engine && npm run test:watch

# Dev server (app)
cd packages/app && npm run dev
```

Test pattern:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@infinicanvas/engine';
import { ExpressionBuilder } from '@infinicanvas/protocol';

beforeEach(() => {
  // Reset store to initial state
  useCanvasStore.setState({...});
  useCanvasStore.getState().clearHistory();
});

describe('feature', () => {
  it('does something', () => {
    const builder = new ExpressionBuilder({...});
    const expr = builder.rectangle(...).build();
    useCanvasStore.getState().addExpression(expr);
    expect(...).toBe(...);
  });
});
```

---

## 🏗️ Architecture Layers

```
┌─────────────────────────────────────┐
│         React App (packages/app)     │
│  Canvas + AgentSidebar              │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│  Engine (packages/engine)           │
│  ┌─────────────────────────────────┐│
│  │ Store (Zustand + Immer)         ││
│  │ expressions, camera, tools      ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ Canvas Component + Render Loop   ││
│  │ RAF: clear→transform→grid→exprs  ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ Interaction Hooks               ││
│  │ pan, zoom, select, manipulate   ││
│  └─────────────────────────────────┘│
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│  Protocol (packages/protocol)        │
│  Types, Zod schemas, builders       │
└─────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
┌───────▼─────┐  ┌────────▼──────┐
│  Gateway    │  │  MCP Server   │
│  WebSocket  │  │  AI Protocol  │
└─────────────┘  └───────────────┘
```

---

## 📞 Cross-Reference

| Topic | ANALYSIS | QUICK_REF | FILE_STRUCT |
|-------|----------|-----------|-------------|
| VisualExpression | §2 | Core Concepts | protocol/schema/ |
| ExpressionKind | §2 | Core Concepts | protocol/schema/ |
| ToolType | §2, §3.E | Core Concepts | engine/types/ |
| Store API | §3 | Store (Zustand) | engine/store/ |
| Rendering | §3.C | Rendering | engine/renderer/ |
| Camera math | §3.D | Camera Math | engine/camera.ts |
| Interaction | §3.E | Interaction Hooks | engine/hooks/ |
| Hit testing | §3.F | Hit Testing | engine/interaction/ |
| Persistence | §3.H | Persistence | engine/persistence/ |
| Tests | §3.K | Testing | All __tests__/ |
| Building | §5 | — | All package.json |

---

## 💡 Common Tasks

**Add a rectangle-like shape?**
- Copy Rectangle from primitives.ts
- Update schema
- Copy renderer code
- Copy hit test code

**Change canvas background color?**
- Canvas.tsx: backgroundColor style
- gridRenderer.ts: if grid also needs change

**Add keyboard shortcut?**
- useUndoRedoShortcuts.ts: Add similar pattern
- Or create new hook

**Modify store action?**
- canvasStore.ts: Find action
- Remember: content mutations need snapshots
- Update tests

**Add new test?**
- Create in `__tests__/`
- Import builder, store, beforeEach reset
- TDD: test first, implement second

---

## 🚀 Next Steps

1. **Understand the data flow**: Read §1-3 of ANALYSIS.md
2. **Review store actions**: §3.A of ANALYSIS.md
3. **Pick your feature**: Reference QUICK_REFERENCE.md for checklist
4. **Find files**: Look up in FILE_STRUCTURE.md
5. **Write tests**: Follow testing pattern in QUICK_REFERENCE.md
6. **Implement**: Reference ANALYSIS.md for details
7. **Test**: `npm run test:watch` in packages/engine

---

## 📝 Notes

- All types validated with Zod before use
- Camera operates in world coordinates, rendering applies transform
- Locked expressions filtered in all mutations
- Snapshots capture full state for undo/redo
- ProtocolOperations never added to log for remote operations (prevents loops)
- Rendering uses Canvas 2D API + Rough.js for aesthetic
- Tests use Vitest + jsdom, run in parallel
- Workspaces use npm, each package independent

---

Generated: 2024-03-15
Last Updated: Comprehensive analysis of infinicanvas monorepo
