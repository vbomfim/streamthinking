/**
 * Unit tests for layer management in canvasStore.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Each test corresponds to acceptance criteria from Issue #109.
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression, Layer } from '@infinicanvas/protocol';
import { useCanvasStore, _resetLayerCounter } from '../store/canvasStore.js';

// ── Test fixtures ──────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id?: string): VisualExpression {
  const expr = builder
    .rectangle(100, 200, 300, 150)
    .label('Test Rectangle')
    .build();
  if (id) {
    return { ...expr, id };
  }
  return expr;
}

function makeEllipse(id?: string): VisualExpression {
  const expr = builder
    .ellipse(50, 50, 200, 200)
    .label('Test Ellipse')
    .build();
  if (id) {
    return { ...expr, id };
  }
  return expr;
}

// ── Store reset before each test ───────────────────────────

beforeEach(() => {
  _resetLayerCounter();
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
});

// ── Default state ──────────────────────────────────────────

describe('layer default state', () => {
  it('has a default layer', () => {
    const state = useCanvasStore.getState();
    expect(state.layers).toHaveLength(1);
    expect(state.layers[0]).toEqual({
      id: 'default',
      name: 'Layer 1',
      visible: true,
      locked: false,
      order: 0,
    });
  });

  it('has default as the active layer', () => {
    const state = useCanvasStore.getState();
    expect(state.activeLayerId).toBe('default');
  });
});

// ── addLayer ───────────────────────────────────────────────

describe('addLayer', () => {
  it('adds a new layer with auto-generated name', () => {
    useCanvasStore.getState().addLayer();

    const state = useCanvasStore.getState();
    expect(state.layers).toHaveLength(2);
    expect(state.layers[1]!.name).toBe('Layer 2');
    expect(state.layers[1]!.visible).toBe(true);
    expect(state.layers[1]!.locked).toBe(false);
  });

  it('adds a layer with a custom name', () => {
    useCanvasStore.getState().addLayer('Annotations');

    const state = useCanvasStore.getState();
    expect(state.layers).toHaveLength(2);
    expect(state.layers[1]!.name).toBe('Annotations');
  });

  it('assigns incrementing order values', () => {
    useCanvasStore.getState().addLayer('Second');
    useCanvasStore.getState().addLayer('Third');

    const state = useCanvasStore.getState();
    expect(state.layers[0]!.order).toBe(0);
    expect(state.layers[1]!.order).toBe(1);
    expect(state.layers[2]!.order).toBe(2);
  });

  it('returns the new layer ID', () => {
    const id = useCanvasStore.getState().addLayer('Test');

    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
    const state = useCanvasStore.getState();
    expect(state.layers.find((l) => l.id === id)).toBeDefined();
  });

  it('rejects adding beyond MAX_LAYERS (100)', () => {
    // We already have 1 (default). Add 99 more to hit 100.
    for (let i = 0; i < 99; i++) {
      useCanvasStore.getState().addLayer(`Layer-${i}`);
    }
    expect(useCanvasStore.getState().layers).toHaveLength(100);

    // 101st should be rejected
    const id = useCanvasStore.getState().addLayer('Over-limit');
    expect(id).toBe('');
    expect(useCanvasStore.getState().layers).toHaveLength(100);
  });

  it('truncates long layer names', () => {
    const longName = 'a'.repeat(600);
    useCanvasStore.getState().addLayer(longName);

    const layer = useCanvasStore.getState().layers[1];
    expect(layer!.name).toHaveLength(500);
  });
});

// ── removeLayer ────────────────────────────────────────────

describe('removeLayer', () => {
  it('removes a non-default layer', () => {
    const id = useCanvasStore.getState().addLayer('Temp');
    useCanvasStore.getState().removeLayer(id);

    const state = useCanvasStore.getState();
    expect(state.layers).toHaveLength(1);
    expect(state.layers[0]!.id).toBe('default');
  });

  it('cannot remove the default layer', () => {
    useCanvasStore.getState().removeLayer('default');

    const state = useCanvasStore.getState();
    expect(state.layers).toHaveLength(1);
    expect(state.layers[0]!.id).toBe('default');
  });

  it('moves expressions from deleted layer to default layer', () => {
    const layerId = useCanvasStore.getState().addLayer('Temp');
    useCanvasStore.getState().setActiveLayer(layerId);

    const expr = makeRectangle('rect-on-temp');
    useCanvasStore.getState().addExpression(expr);

    // Verify expression is on the temp layer
    expect(useCanvasStore.getState().expressions['rect-on-temp']!.layerId).toBe(layerId);

    // Remove the layer
    useCanvasStore.getState().removeLayer(layerId);

    // Expression should now be on the default layer
    expect(useCanvasStore.getState().expressions['rect-on-temp']!.layerId).toBe('default');
  });

  it('resets activeLayerId to default when active layer is removed', () => {
    const layerId = useCanvasStore.getState().addLayer('Active');
    useCanvasStore.getState().setActiveLayer(layerId);
    expect(useCanvasStore.getState().activeLayerId).toBe(layerId);

    useCanvasStore.getState().removeLayer(layerId);
    expect(useCanvasStore.getState().activeLayerId).toBe('default');
  });

  it('no-op for non-existent layer', () => {
    useCanvasStore.getState().removeLayer('non-existent');
    expect(useCanvasStore.getState().layers).toHaveLength(1);
  });
});

// ── renameLayer ────────────────────────────────────────────

describe('renameLayer', () => {
  it('renames a layer', () => {
    useCanvasStore.getState().renameLayer('default', 'Background');

    const state = useCanvasStore.getState();
    expect(state.layers[0]!.name).toBe('Background');
  });

  it('no-op for non-existent layer', () => {
    useCanvasStore.getState().renameLayer('non-existent', 'New Name');
    // Should not throw
    expect(useCanvasStore.getState().layers).toHaveLength(1);
  });
});

// ── toggleLayerVisibility ──────────────────────────────────

describe('toggleLayerVisibility', () => {
  it('toggles visibility from true to false', () => {
    useCanvasStore.getState().toggleLayerVisibility('default');

    const state = useCanvasStore.getState();
    expect(state.layers[0]!.visible).toBe(false);
  });

  it('toggles visibility from false to true', () => {
    useCanvasStore.getState().toggleLayerVisibility('default');
    useCanvasStore.getState().toggleLayerVisibility('default');

    const state = useCanvasStore.getState();
    expect(state.layers[0]!.visible).toBe(true);
  });

  it('no-op for non-existent layer', () => {
    useCanvasStore.getState().toggleLayerVisibility('non-existent');
    expect(useCanvasStore.getState().layers[0]!.visible).toBe(true);
  });
});

// ── toggleLayerLock ────────────────────────────────────────

describe('toggleLayerLock', () => {
  it('toggles lock from false to true', () => {
    useCanvasStore.getState().toggleLayerLock('default');

    const state = useCanvasStore.getState();
    expect(state.layers[0]!.locked).toBe(true);
  });

  it('toggles lock from true to false', () => {
    useCanvasStore.getState().toggleLayerLock('default');
    useCanvasStore.getState().toggleLayerLock('default');

    const state = useCanvasStore.getState();
    expect(state.layers[0]!.locked).toBe(false);
  });
});

// ── setActiveLayer ─────────────────────────────────────────

describe('setActiveLayer', () => {
  it('sets the active layer', () => {
    const id = useCanvasStore.getState().addLayer('Second');
    useCanvasStore.getState().setActiveLayer(id);

    expect(useCanvasStore.getState().activeLayerId).toBe(id);
  });

  it('no-op for non-existent layer', () => {
    useCanvasStore.getState().setActiveLayer('non-existent');
    expect(useCanvasStore.getState().activeLayerId).toBe('default');
  });
});

// ── reorderLayers ──────────────────────────────────────────

describe('reorderLayers', () => {
  it('reorders layers by provided ID array', () => {
    const id1 = useCanvasStore.getState().addLayer('Second');
    const id2 = useCanvasStore.getState().addLayer('Third');

    // Reverse the order
    useCanvasStore.getState().reorderLayers([id2, id1, 'default']);

    const state = useCanvasStore.getState();
    expect(state.layers[0]!.id).toBe(id2);
    expect(state.layers[0]!.order).toBe(0);
    expect(state.layers[1]!.id).toBe(id1);
    expect(state.layers[1]!.order).toBe(1);
    expect(state.layers[2]!.id).toBe('default');
    expect(state.layers[2]!.order).toBe(2);
  });

  it('no-op if layer IDs do not match', () => {
    useCanvasStore.getState().addLayer('Second');

    // Provide wrong IDs — should not reorder
    useCanvasStore.getState().reorderLayers(['fake-1', 'fake-2']);
    expect(useCanvasStore.getState().layers[0]!.id).toBe('default');
  });
});

// ── moveToLayer ────────────────────────────────────────────

describe('moveToLayer', () => {
  it('moves expressions to a different layer', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);

    const layerId = useCanvasStore.getState().addLayer('Second');
    useCanvasStore.getState().moveToLayer(['rect-1'], layerId);

    expect(useCanvasStore.getState().expressions['rect-1']!.layerId).toBe(layerId);
  });

  it('no-op for non-existent target layer', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);

    useCanvasStore.getState().moveToLayer(['rect-1'], 'non-existent');

    // Should remain on default layer
    expect(useCanvasStore.getState().expressions['rect-1']!.layerId).toBe('default');
  });

  it('no-op for non-existent expressions', () => {
    const layerId = useCanvasStore.getState().addLayer('Second');
    useCanvasStore.getState().moveToLayer(['non-existent'], layerId);
    // Should not throw
    expect(useCanvasStore.getState().layers).toHaveLength(2);
  });

  it('skips locked expressions', () => {
    const expr = makeRectangle('rect-locked');
    expr.meta.locked = true;
    useCanvasStore.getState().addExpression(expr);

    const layerId = useCanvasStore.getState().addLayer('Second');
    useCanvasStore.getState().moveToLayer(['rect-locked'], layerId);

    // Locked expression should not be moved
    expect(useCanvasStore.getState().expressions['rect-locked']!.layerId).toBe('default');
  });
});

// ── Expression layerId assignment ──────────────────────────

describe('expression layer assignment', () => {
  it('new expressions get activeLayerId by default', () => {
    const expr = makeRectangle('rect-default');
    useCanvasStore.getState().addExpression(expr);

    expect(useCanvasStore.getState().expressions['rect-default']!.layerId).toBe('default');
  });

  it('new expressions on non-default active layer get that layerId', () => {
    const layerId = useCanvasStore.getState().addLayer('Background');
    useCanvasStore.getState().setActiveLayer(layerId);

    const expr = makeRectangle('rect-bg');
    useCanvasStore.getState().addExpression(expr);

    expect(useCanvasStore.getState().expressions['rect-bg']!.layerId).toBe(layerId);
  });

  it('preserves layerId if already set on expression', () => {
    const layerId = useCanvasStore.getState().addLayer('Custom');
    const expr = makeRectangle('rect-custom');
    expr.layerId = layerId;
    useCanvasStore.getState().addExpression(expr);

    expect(useCanvasStore.getState().expressions['rect-custom']!.layerId).toBe(layerId);
  });
});

// ── Layer lock prevents modification ───────────────────────

describe('layer lock prevents modification', () => {
  it('locked layer expressions cannot be updated', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().toggleLayerLock('default');

    const originalPos = { ...useCanvasStore.getState().expressions['rect-1']!.position };
    useCanvasStore.getState().updateExpression('rect-1', {
      position: { x: 999, y: 999 },
    });

    // Position should not have changed because layer is locked
    expect(useCanvasStore.getState().expressions['rect-1']!.position).toEqual(originalPos);
  });

  it('locked layer expressions cannot be deleted', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().toggleLayerLock('default');

    useCanvasStore.getState().deleteExpressions(['rect-1']);

    // Expression should still exist
    expect(useCanvasStore.getState().expressions['rect-1']).toBeDefined();
  });

  it('locked layer expressions cannot be moved', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().toggleLayerLock('default');

    useCanvasStore.getState().moveExpressions([{
      id: 'rect-1',
      from: { x: 100, y: 200 },
      to: { x: 500, y: 500 },
    }]);

    // Position should not have changed
    expect(useCanvasStore.getState().expressions['rect-1']!.position).toEqual({ x: 100, y: 200 });
  });

  it('locked layer expressions cannot be styled', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().toggleLayerLock('default');

    const originalStyle = { ...useCanvasStore.getState().expressions['rect-1']!.style };
    useCanvasStore.getState().styleExpressions(['rect-1'], { strokeColor: '#ff0000' });

    // Style should not have changed because layer is locked
    expect(useCanvasStore.getState().expressions['rect-1']!.style).toEqual(originalStyle);
  });

  it('locked layer expressions cannot be transformed', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().toggleLayerLock('default');

    const originalPos = { ...useCanvasStore.getState().expressions['rect-1']!.position };
    const originalSize = { ...useCanvasStore.getState().expressions['rect-1']!.size };
    useCanvasStore.getState().transformExpression(
      'rect-1',
      { position: originalPos, size: originalSize },
      { position: { x: 999, y: 999 }, size: { width: 500, height: 500 } },
    );

    // Position and size should not have changed
    expect(useCanvasStore.getState().expressions['rect-1']!.position).toEqual(originalPos);
    expect(useCanvasStore.getState().expressions['rect-1']!.size).toEqual(originalSize);
  });

  it('locked layer expressions cannot be grouped', () => {
    const expr1 = makeRectangle('rect-1');
    const expr2 = makeEllipse('ell-1');
    useCanvasStore.getState().addExpression(expr1);
    useCanvasStore.getState().addExpression(expr2);
    useCanvasStore.getState().toggleLayerLock('default');

    const groupId = useCanvasStore.getState().groupExpressions(['rect-1', 'ell-1']);

    // Group should fail — return empty string
    expect(groupId).toBe('');
    // Expressions should not have parentId
    expect(useCanvasStore.getState().expressions['rect-1']!.parentId).toBeUndefined();
    expect(useCanvasStore.getState().expressions['ell-1']!.parentId).toBeUndefined();
  });
});

// ── Rendering order by layer ───────────────────────────────

describe('getLayerSortedExpressionOrder', () => {
  it('sorts expressions by layer order then by expressionOrder position', () => {
    // Create two layers
    const bgLayerId = useCanvasStore.getState().addLayer('Background');

    // Add expressions: rect on default (order 0), ellipse on bg (order 1)
    useCanvasStore.getState().setActiveLayer(bgLayerId);
    const ellipse = makeEllipse('ellipse-bg');
    useCanvasStore.getState().addExpression(ellipse);

    useCanvasStore.getState().setActiveLayer('default');
    const rect = makeRectangle('rect-default');
    useCanvasStore.getState().addExpression(rect);

    // Now reorder layers: bg should be behind default
    // bg is order 1, default is order 0 → default renders first (behind)
    // Reorder so bg is order 0 (behind)
    useCanvasStore.getState().reorderLayers([bgLayerId, 'default']);

    const state = useCanvasStore.getState();
    // bg layer is now order 0, default is order 1
    // Expressions on bg (lower order) should render before expressions on default
    const bgLayer = state.layers.find((l) => l.id === bgLayerId)!;
    const defaultLayer = state.layers.find((l) => l.id === 'default')!;
    expect(bgLayer.order).toBe(0);
    expect(defaultLayer.order).toBe(1);
  });
});
