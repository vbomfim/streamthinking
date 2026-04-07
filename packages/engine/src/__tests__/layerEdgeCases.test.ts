/**
 * Edge-case tests for layer management in canvasStore.
 *
 * [EDGE] — boundary conditions and unusual scenarios NOT covered
 * by the developer's unit tests.  Each test exercises the public
 * store API and verifies observable state only.
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression } from '@infinicanvas/protocol';
import { useCanvasStore, _resetLayerCounter } from '../store/canvasStore.js';

// ── Test fixtures ──────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'QA Tester' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string): VisualExpression {
  const expr = builder
    .rectangle(100, 200, 300, 150)
    .label('Test Rectangle')
    .build();
  return { ...expr, id };
}

function makeEllipse(id: string): VisualExpression {
  const expr = builder
    .ellipse(50, 50, 200, 200)
    .label('Test Ellipse')
    .build();
  return { ...expr, id };
}

// ── Store reset ────────────────────────────────────────────

beforeEach(() => {
  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
    gridVisible: true,
    gridType: 'dot',
    gridSize: 20,
    operationLog: [],
    canUndo: false,
    canRedo: false,
    layers: [{ id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 }],
    activeLayerId: 'default',
  });
  useCanvasStore.getState().clearHistory();
  _resetLayerCounter();
});

// ── Expression creation on unusual active layers ───────────

describe('[EDGE] expression creation on hidden/locked active layer', () => {
  it('allows creating expression when active layer is hidden', () => {
    // Hide the default layer, then add an expression
    useCanvasStore.getState().toggleLayerVisibility('default');
    expect(useCanvasStore.getState().layers[0]!.visible).toBe(false);

    const expr = makeRectangle('rect-on-hidden');
    useCanvasStore.getState().addExpression(expr);

    // Expression should still be created and assigned to hidden layer
    const stored = useCanvasStore.getState().expressions['rect-on-hidden'];
    expect(stored).toBeDefined();
    expect(stored!.layerId).toBe('default');
  });

  it('allows creating expression when active layer is locked', () => {
    // Lock the default layer, then add an expression
    useCanvasStore.getState().toggleLayerLock('default');
    expect(useCanvasStore.getState().layers[0]!.locked).toBe(true);

    const expr = makeRectangle('rect-on-locked');
    useCanvasStore.getState().addExpression(expr);

    // Lock prevents update/delete/move but NOT creation
    const stored = useCanvasStore.getState().expressions['rect-on-locked'];
    expect(stored).toBeDefined();
    expect(stored!.layerId).toBe('default');
  });
});

// ── moveToLayer destination layer edge cases ───────────────

describe('[EDGE] moveToLayer destination layer behaviour', () => {
  it('allows moving expression TO a locked destination layer', () => {
    // Create expression on default, create a locked target layer
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);

    const targetId = useCanvasStore.getState().addLayer('Locked Target');
    useCanvasStore.getState().toggleLayerLock(targetId);

    // moveToLayer only checks expr.meta.locked, NOT destination lock
    useCanvasStore.getState().moveToLayer(['rect-1'], targetId);

    // Expression should be on the locked target layer
    expect(useCanvasStore.getState().expressions['rect-1']!.layerId).toBe(targetId);
  });

  it('allows moving expression TO a hidden destination layer', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);

    const targetId = useCanvasStore.getState().addLayer('Hidden Target');
    useCanvasStore.getState().toggleLayerVisibility(targetId);

    useCanvasStore.getState().moveToLayer(['rect-1'], targetId);

    expect(useCanvasStore.getState().expressions['rect-1']!.layerId).toBe(targetId);
  });

  it('does NOT move expression that is on a locked SOURCE layer via moveExpressions', () => {
    // Expression on default layer, lock default, try to move
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().toggleLayerLock('default');

    useCanvasStore.getState().moveExpressions([{
      id: 'rect-1',
      from: { x: 100, y: 200 },
      to: { x: 500, y: 500 },
    }]);

    // Position unchanged due to layer lock
    expect(useCanvasStore.getState().expressions['rect-1']!.position).toEqual({ x: 100, y: 200 });
  });
});

// ── Batch operations with mixed lock states ────────────────

describe('[EDGE] batch operations across layers with mixed states', () => {
  it('deleteExpressions skips locked-layer items but deletes unlocked ones', () => {
    // Two expressions: one on default (unlocked), one on locked layer
    const r1 = makeRectangle('rect-unlocked');
    useCanvasStore.getState().addExpression(r1);

    const lockedLayerId = useCanvasStore.getState().addLayer('Locked');
    useCanvasStore.getState().toggleLayerLock(lockedLayerId);

    const r2 = makeRectangle('rect-locked-layer');
    r2.layerId = lockedLayerId;
    useCanvasStore.getState().addExpression(r2);

    // Try to delete both
    useCanvasStore.getState().deleteExpressions(['rect-unlocked', 'rect-locked-layer']);

    const state = useCanvasStore.getState();
    expect(state.expressions['rect-unlocked']).toBeUndefined(); // deleted
    expect(state.expressions['rect-locked-layer']).toBeDefined(); // survived
  });

  it('updateExpression is blocked for expression on locked layer', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().toggleLayerLock('default');

    // Try style update
    useCanvasStore.getState().updateExpression('rect-1', {
      style: { ...useCanvasStore.getState().expressions['rect-1']!.style, strokeColor: '#FF0000' },
    });

    // Style should NOT have changed
    expect(useCanvasStore.getState().expressions['rect-1']!.style.strokeColor).not.toBe('#FF0000');
  });

  it('moveToLayer skips individually locked expressions in a mixed batch', () => {
    const r1 = makeRectangle('rect-free');
    const r2 = makeRectangle('rect-locked');
    r2.meta = { ...r2.meta, locked: true };
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);

    const targetId = useCanvasStore.getState().addLayer('Target');
    useCanvasStore.getState().moveToLayer(['rect-free', 'rect-locked'], targetId);

    expect(useCanvasStore.getState().expressions['rect-free']!.layerId).toBe(targetId);
    expect(useCanvasStore.getState().expressions['rect-locked']!.layerId).toBe('default');
  });
});

// ── removeLayer cascade with many expressions ──────────────

describe('[EDGE] removeLayer cascade', () => {
  it('migrates multiple expressions from deleted layer to default', () => {
    const layerId = useCanvasStore.getState().addLayer('Temp');
    useCanvasStore.getState().setActiveLayer(layerId);

    // Add 5 expressions to the temp layer
    for (let i = 0; i < 5; i++) {
      useCanvasStore.getState().addExpression(makeRectangle(`rect-${i}`));
    }

    // Verify all on temp layer
    for (let i = 0; i < 5; i++) {
      expect(useCanvasStore.getState().expressions[`rect-${i}`]!.layerId).toBe(layerId);
    }

    useCanvasStore.getState().removeLayer(layerId);

    // All 5 should now be on default
    for (let i = 0; i < 5; i++) {
      expect(useCanvasStore.getState().expressions[`rect-${i}`]!.layerId).toBe('default');
    }
  });

  it('does NOT reset activeLayerId when a non-active layer is removed', () => {
    const layer1 = useCanvasStore.getState().addLayer('Layer A');
    const layer2 = useCanvasStore.getState().addLayer('Layer B');
    useCanvasStore.getState().setActiveLayer(layer1);

    useCanvasStore.getState().removeLayer(layer2);

    // Active layer should still be layer1
    expect(useCanvasStore.getState().activeLayerId).toBe(layer1);
  });

  it('preserves expressions on other layers when one layer is removed', () => {
    const layerA = useCanvasStore.getState().addLayer('A');
    const layerB = useCanvasStore.getState().addLayer('B');

    useCanvasStore.getState().setActiveLayer(layerA);
    useCanvasStore.getState().addExpression(makeRectangle('on-A'));

    useCanvasStore.getState().setActiveLayer(layerB);
    useCanvasStore.getState().addExpression(makeEllipse('on-B'));

    // Remove layer A → 'on-A' migrates to default, 'on-B' stays on B
    useCanvasStore.getState().removeLayer(layerA);

    expect(useCanvasStore.getState().expressions['on-A']!.layerId).toBe('default');
    expect(useCanvasStore.getState().expressions['on-B']!.layerId).toBe(layerB);
  });
});

// ── renameLayer edge cases ─────────────────────────────────

describe('[EDGE] renameLayer boundary conditions', () => {
  it('allows renaming to empty string (no validation)', () => {
    useCanvasStore.getState().renameLayer('default', '');

    // The implementation does not validate name content
    expect(useCanvasStore.getState().layers[0]!.name).toBe('');
  });

  it('allows renaming to very long string', () => {
    const longName = 'A'.repeat(500);
    useCanvasStore.getState().renameLayer('default', longName);

    expect(useCanvasStore.getState().layers[0]!.name).toBe(longName);
  });

  it('allows renaming to name with special characters', () => {
    useCanvasStore.getState().renameLayer('default', '图层 🎨 <script>alert(1)</script>');

    expect(useCanvasStore.getState().layers[0]!.name).toBe('图层 🎨 <script>alert(1)</script>');
  });
});

// ── reorderLayers edge cases ───────────────────────────────

describe('[EDGE] reorderLayers boundary conditions', () => {
  it('no-op when fewer IDs than layers exist', () => {
    useCanvasStore.getState().addLayer('Second');
    useCanvasStore.getState().addLayer('Third');

    // Only provide 2 of 3 layer IDs
    useCanvasStore.getState().reorderLayers(['default']);

    // Order should be unchanged
    expect(useCanvasStore.getState().layers).toHaveLength(3);
    expect(useCanvasStore.getState().layers[0]!.order).toBe(0);
  });

  it('no-op when more IDs than layers exist', () => {
    // Only default layer exists
    useCanvasStore.getState().reorderLayers(['default', 'fake-1', 'fake-2']);

    expect(useCanvasStore.getState().layers).toHaveLength(1);
    expect(useCanvasStore.getState().layers[0]!.order).toBe(0);
  });

  it('no-op when duplicate IDs provided', () => {
    const id = useCanvasStore.getState().addLayer('Second');

    // Duplicate ID — count matches (2) but one is duplicated
    useCanvasStore.getState().reorderLayers(['default', 'default']);

    // The code checks allValid via existingIds.has(), so duplicates pass the has() check
    // but only 1 unique layer gets mapped → the second 'default' would get undefined from layerMap
    // Let's verify the state is still valid
    const layers = useCanvasStore.getState().layers;
    // Should still have 2 layers
    expect(layers).toHaveLength(2);
  });

  it('single-layer reorder is valid', () => {
    useCanvasStore.getState().reorderLayers(['default']);

    expect(useCanvasStore.getState().layers).toHaveLength(1);
    expect(useCanvasStore.getState().layers[0]!.order).toBe(0);
  });
});

// ── Layer counter naming ───────────────────────────────────

describe('[EDGE] layer auto-naming counter', () => {
  it('auto-names use incrementing counter', () => {
    useCanvasStore.getState().addLayer(); // Layer 2
    useCanvasStore.getState().addLayer(); // Layer 3
    useCanvasStore.getState().addLayer(); // Layer 4

    const layers = useCanvasStore.getState().layers;
    expect(layers[1]!.name).toBe('Layer 2');
    expect(layers[2]!.name).toBe('Layer 3');
    expect(layers[3]!.name).toBe('Layer 4');
  });

  it('counter does not reset when layers are removed', () => {
    const id1 = useCanvasStore.getState().addLayer(); // Layer 2
    useCanvasStore.getState().removeLayer(id1);

    useCanvasStore.getState().addLayer(); // Should be Layer 3, not Layer 2
    const layers = useCanvasStore.getState().layers;
    expect(layers[1]!.name).toBe('Layer 3');
  });
});

// ── setActiveLayer edge cases ──────────────────────────────

describe('[EDGE] setActiveLayer boundary conditions', () => {
  it('setting active layer to current active is a no-op', () => {
    useCanvasStore.getState().setActiveLayer('default');

    expect(useCanvasStore.getState().activeLayerId).toBe('default');
  });

  it('allows setting active layer to hidden layer', () => {
    const id = useCanvasStore.getState().addLayer('Hidden');
    useCanvasStore.getState().toggleLayerVisibility(id);
    useCanvasStore.getState().setActiveLayer(id);

    expect(useCanvasStore.getState().activeLayerId).toBe(id);
  });

  it('allows setting active layer to locked layer', () => {
    const id = useCanvasStore.getState().addLayer('Locked');
    useCanvasStore.getState().toggleLayerLock(id);
    useCanvasStore.getState().setActiveLayer(id);

    expect(useCanvasStore.getState().activeLayerId).toBe(id);
  });
});

// ── Expression with missing/undefined layerId ──────────────

describe('[EDGE] expression layerId edge cases', () => {
  it('expression without layerId gets activeLayerId assigned', () => {
    const expr = builder
      .rectangle(10, 10, 50, 50)
      .label('No LayerId')
      .build();
    // ExpressionBuilder does not set layerId
    expect(expr.layerId).toBeUndefined();

    useCanvasStore.getState().addExpression(expr);

    const stored = useCanvasStore.getState().expressions[expr.id];
    expect(stored!.layerId).toBe('default');
  });

  it('expression with explicit layerId to non-existent layer is stored as-is', () => {
    const expr = makeRectangle('orphan');
    expr.layerId = 'non-existent-layer';
    useCanvasStore.getState().addExpression(expr);

    // The store does not validate layerId references
    expect(useCanvasStore.getState().expressions['orphan']!.layerId).toBe('non-existent-layer');
  });
});
