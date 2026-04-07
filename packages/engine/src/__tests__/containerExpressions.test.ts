/**
 * Container expressions — unit tests.
 *
 * TDD tests for the container feature (#112):
 * - Store actions: createContainer, toggleContainerCollapse
 * - Auto-parenting: autoParentOnDrop, autoUnparentOnDrag
 * - Cascade move: moving a container moves children
 * - Container deletion unparents children
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression, ContainerData } from '@infinicanvas/protocol';
import { useCanvasStore } from '../store/canvasStore.js';

// ── Fixtures ─────────────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Tester' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string, x = 100, y = 200, w = 80, h = 60): VisualExpression {
  const expr = builder.rectangle(x, y, w, h).label('Rect').build();
  return { ...expr, id };
}

// ── Store reset ──────────────────────────────────────────────

beforeEach(() => {
  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
    operationLog: [],
    canUndo: false,
    canRedo: false,
  });
  useCanvasStore.getState().clearHistory();
});

// ── createContainer ──────────────────────────────────────────

describe('createContainer [STORE]', () => {
  it('creates a container expression with correct data', () => {
    const id = useCanvasStore.getState().createContainer(
      'My Container',
      { x: 50, y: 50 },
      { width: 400, height: 300 },
    );

    expect(id).toBeTruthy();
    const state = useCanvasStore.getState();
    const container = state.expressions[id];
    expect(container).toBeDefined();
    expect(container!.kind).toBe('container');

    const data = container!.data as ContainerData;
    expect(data.title).toBe('My Container');
    expect(data.headerHeight).toBe(40);
    expect(data.padding).toBe(20);
    expect(data.collapsed).toBe(false);
  });

  it('adds the container to expressionOrder', () => {
    const id = useCanvasStore.getState().createContainer(
      'Test',
      { x: 0, y: 0 },
      { width: 200, height: 200 },
    );

    const state = useCanvasStore.getState();
    expect(state.expressionOrder).toContain(id);
  });

  it('emits a create ProtocolOperation', () => {
    useCanvasStore.getState().createContainer(
      'Test',
      { x: 0, y: 0 },
      { width: 200, height: 200 },
    );

    const ops = useCanvasStore.getState().operationLog;
    const createOp = ops.find((op) => op.type === 'create');
    expect(createOp).toBeDefined();
  });

  it('supports undo after creation', () => {
    useCanvasStore.getState().createContainer(
      'Test',
      { x: 0, y: 0 },
      { width: 200, height: 200 },
    );

    expect(useCanvasStore.getState().canUndo).toBe(true);
    useCanvasStore.getState().undo();

    const state = useCanvasStore.getState();
    expect(Object.keys(state.expressions)).toHaveLength(0);
  });
});

// ── toggleContainerCollapse ──────────────────────────────────

describe('toggleContainerCollapse [STORE]', () => {
  it('toggles collapsed from false to true', () => {
    const id = useCanvasStore.getState().createContainer(
      'Test',
      { x: 0, y: 0 },
      { width: 200, height: 200 },
    );

    useCanvasStore.getState().toggleContainerCollapse(id);

    const data = useCanvasStore.getState().expressions[id]!.data as ContainerData;
    expect(data.collapsed).toBe(true);
  });

  it('toggles collapsed back from true to false', () => {
    const id = useCanvasStore.getState().createContainer(
      'Test',
      { x: 0, y: 0 },
      { width: 200, height: 200 },
    );

    useCanvasStore.getState().toggleContainerCollapse(id);
    useCanvasStore.getState().toggleContainerCollapse(id);

    const data = useCanvasStore.getState().expressions[id]!.data as ContainerData;
    expect(data.collapsed).toBe(false);
  });

  it('no-ops for non-existent expression', () => {
    // Should not throw
    useCanvasStore.getState().toggleContainerCollapse('nonexistent');
  });

  it('no-ops for non-container expression', () => {
    const rect = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(rect);

    // Should not throw
    useCanvasStore.getState().toggleContainerCollapse('rect-1');
    // Rectangle data unchanged
    expect(useCanvasStore.getState().expressions['rect-1']!.kind).toBe('rectangle');
  });

  it('supports undo', () => {
    const id = useCanvasStore.getState().createContainer(
      'Test',
      { x: 0, y: 0 },
      { width: 200, height: 200 },
    );
    useCanvasStore.getState().toggleContainerCollapse(id);

    expect((useCanvasStore.getState().expressions[id]!.data as ContainerData).collapsed).toBe(true);

    useCanvasStore.getState().undo();

    expect((useCanvasStore.getState().expressions[id]!.data as ContainerData).collapsed).toBe(false);
  });
});

// ── autoParentOnDrop ─────────────────────────────────────────

describe('autoParentOnDrop [STORE]', () => {
  it('parents a shape dropped inside a container', () => {
    const containerId = useCanvasStore.getState().createContainer(
      'Dev',
      { x: 0, y: 0 },
      { width: 400, height: 300 },
    );

    // Create a rectangle inside the container bounds
    const rect = makeRectangle('rect-1', 50, 60, 80, 60);
    useCanvasStore.getState().addExpression(rect);

    useCanvasStore.getState().autoParentOnDrop('rect-1');

    const state = useCanvasStore.getState();
    expect(state.expressions['rect-1']!.parentId).toBe(containerId);
  });

  it('does not parent a shape outside container bounds', () => {
    useCanvasStore.getState().createContainer(
      'Dev',
      { x: 0, y: 0 },
      { width: 400, height: 300 },
    );

    // Create a rectangle well outside the container
    const rect = makeRectangle('rect-1', 500, 500, 80, 60);
    useCanvasStore.getState().addExpression(rect);

    useCanvasStore.getState().autoParentOnDrop('rect-1');

    expect(useCanvasStore.getState().expressions['rect-1']!.parentId).toBeUndefined();
  });

  it('parents to the smallest containing container when nested', () => {
    const outerContainerId = useCanvasStore.getState().createContainer(
      'Outer',
      { x: 0, y: 0 },
      { width: 600, height: 500 },
    );
    const innerContainerId = useCanvasStore.getState().createContainer(
      'Inner',
      { x: 50, y: 60 },
      { width: 200, height: 200 },
    );

    // Set inner's parent to outer
    useCanvasStore.getState().autoParentOnDrop(innerContainerId);

    // Create a rect inside the inner container
    const rect = makeRectangle('rect-1', 80, 100, 60, 40);
    useCanvasStore.getState().addExpression(rect);

    useCanvasStore.getState().autoParentOnDrop('rect-1');

    // Should parent to the inner (smaller) container, not outer
    expect(useCanvasStore.getState().expressions['rect-1']!.parentId).toBe(innerContainerId);
  });

  it('does not parent a container to itself', () => {
    const containerId = useCanvasStore.getState().createContainer(
      'Self',
      { x: 0, y: 0 },
      { width: 400, height: 300 },
    );

    useCanvasStore.getState().autoParentOnDrop(containerId);

    // Should not self-reference
    expect(useCanvasStore.getState().expressions[containerId]!.parentId).toBeUndefined();
  });
});

// ── autoUnparentOnDrag ───────────────────────────────────────

describe('autoUnparentOnDrag [STORE]', () => {
  it('removes parentId when shape is dragged outside container', () => {
    const containerId = useCanvasStore.getState().createContainer(
      'Dev',
      { x: 0, y: 0 },
      { width: 400, height: 300 },
    );

    const rect = makeRectangle('rect-1', 50, 60, 80, 60);
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().autoParentOnDrop('rect-1');

    // Verify it was parented
    expect(useCanvasStore.getState().expressions['rect-1']!.parentId).toBe(containerId);

    // Now move the rect outside
    useCanvasStore.getState().updateExpression('rect-1', {
      position: { x: 500, y: 500 },
    });
    useCanvasStore.getState().autoUnparentOnDrag('rect-1');

    expect(useCanvasStore.getState().expressions['rect-1']!.parentId).toBeUndefined();
  });

  it('keeps parentId when shape is still inside container', () => {
    const containerId = useCanvasStore.getState().createContainer(
      'Dev',
      { x: 0, y: 0 },
      { width: 400, height: 300 },
    );

    const rect = makeRectangle('rect-1', 50, 60, 80, 60);
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().autoParentOnDrop('rect-1');

    // Move within container
    useCanvasStore.getState().updateExpression('rect-1', {
      position: { x: 100, y: 100 },
    });
    useCanvasStore.getState().autoUnparentOnDrag('rect-1');

    expect(useCanvasStore.getState().expressions['rect-1']!.parentId).toBe(containerId);
  });

  it('no-ops for expression without parent', () => {
    const rect = makeRectangle('rect-1', 50, 60, 80, 60);
    useCanvasStore.getState().addExpression(rect);

    // Should not throw
    useCanvasStore.getState().autoUnparentOnDrag('rect-1');
    expect(useCanvasStore.getState().expressions['rect-1']!.parentId).toBeUndefined();
  });
});

// ── Container cascade move ───────────────────────────────────

describe('moveContainerWithChildren [STORE]', () => {
  it('moving a container also moves children by the same delta', () => {
    const containerId = useCanvasStore.getState().createContainer(
      'Dev',
      { x: 100, y: 100 },
      { width: 400, height: 300 },
    );

    const rect = makeRectangle('rect-1', 150, 150, 80, 60);
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().autoParentOnDrop('rect-1');

    const rect2 = makeRectangle('rect-2', 200, 200, 80, 60);
    useCanvasStore.getState().addExpression(rect2);
    useCanvasStore.getState().autoParentOnDrop('rect-2');

    // Move the container by (50, 50)
    useCanvasStore.getState().moveExpressions([
      { id: containerId, from: { x: 100, y: 100 }, to: { x: 150, y: 150 } },
    ]);

    const state = useCanvasStore.getState();
    // Container moved
    expect(state.expressions[containerId]!.position).toEqual({ x: 150, y: 150 });
    // Children moved by same delta
    expect(state.expressions['rect-1']!.position).toEqual({ x: 200, y: 200 });
    expect(state.expressions['rect-2']!.position).toEqual({ x: 250, y: 250 });
  });

  it('does not double-move children that are also in the move list', () => {
    const containerId = useCanvasStore.getState().createContainer(
      'Dev',
      { x: 100, y: 100 },
      { width: 400, height: 300 },
    );

    const rect = makeRectangle('rect-1', 150, 150, 80, 60);
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().autoParentOnDrop('rect-1');

    // Move both container AND child explicitly (shouldn't double move child)
    useCanvasStore.getState().moveExpressions([
      { id: containerId, from: { x: 100, y: 100 }, to: { x: 200, y: 200 } },
      { id: 'rect-1', from: { x: 150, y: 150 }, to: { x: 250, y: 250 } },
    ]);

    const state = useCanvasStore.getState();
    // Child should be at its explicit target, not double-moved
    expect(state.expressions['rect-1']!.position).toEqual({ x: 250, y: 250 });
  });
});

// ── Container deletion ───────────────────────────────────────

describe('deleteContainer [STORE]', () => {
  it('unparents children when container is deleted', () => {
    const containerId = useCanvasStore.getState().createContainer(
      'Dev',
      { x: 0, y: 0 },
      { width: 400, height: 300 },
    );

    const rect = makeRectangle('rect-1', 50, 60, 80, 60);
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().autoParentOnDrop('rect-1');

    // Verify parented
    expect(useCanvasStore.getState().expressions['rect-1']!.parentId).toBe(containerId);

    // Delete the container
    useCanvasStore.getState().deleteExpressions([containerId]);

    const state = useCanvasStore.getState();
    // Container is gone
    expect(state.expressions[containerId]).toBeUndefined();
    // Child still exists but unparented
    expect(state.expressions['rect-1']).toBeDefined();
    expect(state.expressions['rect-1']!.parentId).toBeUndefined();
  });
});

// ── Fix #1: Protocol ops for autoParent/autoUnparent ─────────

describe('autoParentOnDrop protocol ops [FIX #1]', () => {
  it('emits an update ProtocolOperation when parenting', () => {
    const containerId = useCanvasStore.getState().createContainer(
      'Dev',
      { x: 0, y: 0 },
      { width: 400, height: 300 },
    );

    const rect = makeRectangle('rect-1', 50, 60, 80, 60);
    useCanvasStore.getState().addExpression(rect);

    const opsBefore = useCanvasStore.getState().operationLog.length;
    useCanvasStore.getState().autoParentOnDrop('rect-1');

    const ops = useCanvasStore.getState().operationLog;
    expect(ops.length).toBeGreaterThan(opsBefore);

    const updateOp = ops[ops.length - 1];
    expect(updateOp!.type).toBe('update');
  });

  it('supports undo after auto-parenting', () => {
    const containerId = useCanvasStore.getState().createContainer(
      'Dev',
      { x: 0, y: 0 },
      { width: 400, height: 300 },
    );

    const rect = makeRectangle('rect-1', 50, 60, 80, 60);
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().autoParentOnDrop('rect-1');

    expect(useCanvasStore.getState().expressions['rect-1']!.parentId).toBe(containerId);

    useCanvasStore.getState().undo();

    expect(useCanvasStore.getState().expressions['rect-1']!.parentId).toBeUndefined();
  });
});

describe('autoUnparentOnDrag protocol ops [FIX #1]', () => {
  it('emits an update ProtocolOperation when unparenting', () => {
    const containerId = useCanvasStore.getState().createContainer(
      'Dev',
      { x: 0, y: 0 },
      { width: 400, height: 300 },
    );

    const rect = makeRectangle('rect-1', 50, 60, 80, 60);
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().autoParentOnDrop('rect-1');

    // Move outside
    useCanvasStore.getState().updateExpression('rect-1', {
      position: { x: 500, y: 500 },
    });

    const opsBefore = useCanvasStore.getState().operationLog.length;
    useCanvasStore.getState().autoUnparentOnDrag('rect-1');

    const ops = useCanvasStore.getState().operationLog;
    expect(ops.length).toBeGreaterThan(opsBefore);

    const updateOp = ops[ops.length - 1];
    expect(updateOp!.type).toBe('update');
  });

  it('supports undo after auto-unparenting', () => {
    const containerId = useCanvasStore.getState().createContainer(
      'Dev',
      { x: 0, y: 0 },
      { width: 400, height: 300 },
    );

    const rect = makeRectangle('rect-1', 50, 60, 80, 60);
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().autoParentOnDrop('rect-1');

    // Move outside and unparent
    useCanvasStore.getState().updateExpression('rect-1', {
      position: { x: 500, y: 500 },
    });
    useCanvasStore.getState().autoUnparentOnDrag('rect-1');
    expect(useCanvasStore.getState().expressions['rect-1']!.parentId).toBeUndefined();

    useCanvasStore.getState().undo();

    expect(useCanvasStore.getState().expressions['rect-1']!.parentId).toBe(containerId);
  });
});

// ── Fix #2: Skip collapsed containers ────────────────────────

describe('autoParentOnDrop skips collapsed [FIX #2]', () => {
  it('does not parent into a collapsed container', () => {
    const containerId = useCanvasStore.getState().createContainer(
      'Collapsed',
      { x: 0, y: 0 },
      { width: 400, height: 300 },
    );
    useCanvasStore.getState().toggleContainerCollapse(containerId);

    const rect = makeRectangle('rect-1', 50, 60, 80, 60);
    useCanvasStore.getState().addExpression(rect);

    useCanvasStore.getState().autoParentOnDrop('rect-1');

    expect(useCanvasStore.getState().expressions['rect-1']!.parentId).toBeUndefined();
  });

  it('parents into expanded container, skipping collapsed sibling', () => {
    // Create collapsed container
    const collapsedId = useCanvasStore.getState().createContainer(
      'Collapsed',
      { x: 0, y: 0 },
      { width: 600, height: 500 },
    );
    useCanvasStore.getState().toggleContainerCollapse(collapsedId);

    // Create expanded container at same position but smaller
    const expandedId = useCanvasStore.getState().createContainer(
      'Expanded',
      { x: 10, y: 10 },
      { width: 300, height: 200 },
    );

    const rect = makeRectangle('rect-1', 50, 50, 80, 60);
    useCanvasStore.getState().addExpression(rect);

    useCanvasStore.getState().autoParentOnDrop('rect-1');

    // Should parent to the expanded one, not the collapsed one
    expect(useCanvasStore.getState().expressions['rect-1']!.parentId).toBe(expandedId);
  });
});

// ── Fix #4: Circular parenting guard ─────────────────────────

describe('autoParentOnDrop circular guard [FIX #4]', () => {
  it('prevents A → B → A circular parenting', () => {
    // Create outer container A
    const containerA = useCanvasStore.getState().createContainer(
      'A',
      { x: 0, y: 0 },
      { width: 600, height: 500 },
    );

    // Create inner container B inside A
    const containerB = useCanvasStore.getState().createContainer(
      'B',
      { x: 50, y: 50 },
      { width: 200, height: 200 },
    );

    // Parent B under A
    useCanvasStore.getState().autoParentOnDrop(containerB);
    expect(useCanvasStore.getState().expressions[containerB]!.parentId).toBe(containerA);

    // Now resize A to fit inside B (simulate drag that would create cycle)
    useCanvasStore.getState().updateExpression(containerA, {
      position: { x: 60, y: 60 },
      size: { width: 100, height: 100 },
    });

    // Try to parent A under B — this would create a cycle
    useCanvasStore.getState().autoParentOnDrop(containerA);

    // A should NOT be parented under B
    expect(useCanvasStore.getState().expressions[containerA]!.parentId).toBeUndefined();
  });

  it('prevents deep circular chains', () => {
    // Create A > B > C hierarchy
    const containerA = useCanvasStore.getState().createContainer(
      'A',
      { x: 0, y: 0 },
      { width: 800, height: 600 },
    );
    const containerB = useCanvasStore.getState().createContainer(
      'B',
      { x: 50, y: 50 },
      { width: 600, height: 400 },
    );
    const containerC = useCanvasStore.getState().createContainer(
      'C',
      { x: 100, y: 100 },
      { width: 300, height: 200 },
    );

    useCanvasStore.getState().autoParentOnDrop(containerB); // B → A
    useCanvasStore.getState().autoParentOnDrop(containerC); // C → B

    expect(useCanvasStore.getState().expressions[containerB]!.parentId).toBe(containerA);
    expect(useCanvasStore.getState().expressions[containerC]!.parentId).toBe(containerB);

    // Resize A to fit inside C
    useCanvasStore.getState().updateExpression(containerA, {
      position: { x: 120, y: 120 },
      size: { width: 50, height: 50 },
    });

    // Try to parent A under C — cycle: A → C → B → A
    useCanvasStore.getState().autoParentOnDrop(containerA);

    // Should NOT create the cycle
    expect(useCanvasStore.getState().expressions[containerA]!.parentId).toBeUndefined();
  });
});
