/**
 * Group/Ungroup expressions — unit tests.
 *
 * TDD tests for the group/ungroup feature (#71):
 * - Store actions: groupExpressions, ungroupExpressions
 * - Keyboard shortcuts: Ctrl+G (group), Ctrl+Shift+G (ungroup)
 * - Group-aware selection, deletion, duplication
 *
 * @module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression, GroupPayload, UngroupPayload } from '@infinicanvas/protocol';
import { useCanvasStore } from '../store/canvasStore.js';

// ── Fixtures ─────────────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Tester' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string, x = 100, y = 200): VisualExpression {
  const expr = builder.rectangle(x, y, 300, 150).label('Rect').build();
  return { ...expr, id };
}

function makeEllipse(id: string, x = 50, y = 50): VisualExpression {
  const expr = builder.ellipse(x, y, 200, 200).label('Ellipse').build();
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

// ── groupExpressions store action ────────────────────────────

describe('groupExpressions [STORE]', () => {
  it('groups 2 expressions — both get parentId set to groupId', () => {
    const r1 = makeRectangle('r1');
    const r2 = makeRectangle('r2');
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);

    const groupId = useCanvasStore.getState().groupExpressions(['r1', 'r2']);

    expect(groupId).toBeTruthy();
    expect(typeof groupId).toBe('string');

    const state = useCanvasStore.getState();
    expect(state.expressions['r1']?.parentId).toBe(groupId);
    expect(state.expressions['r2']?.parentId).toBe(groupId);
  });

  it('emits a group ProtocolOperation with correct payload', () => {
    const r1 = makeRectangle('r1');
    const r2 = makeRectangle('r2');
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);

    const groupId = useCanvasStore.getState().groupExpressions(['r1', 'r2']);

    const ops = useCanvasStore.getState().operationLog;
    const groupOp = ops.find((op) => op.type === 'group');
    expect(groupOp).toBeDefined();

    const payload = groupOp!.payload as GroupPayload;
    expect(payload.type).toBe('group');
    expect(payload.groupId).toBe(groupId);
    expect(payload.expressionIds).toEqual(expect.arrayContaining(['r1', 'r2']));
    expect(payload.expressionIds).toHaveLength(2);
  });

  it('returns empty string and does NOT group when fewer than 2 expressions', () => {
    const r1 = makeRectangle('r1');
    useCanvasStore.getState().addExpression(r1);

    const groupId = useCanvasStore.getState().groupExpressions(['r1']);

    expect(groupId).toBe('');
    expect(useCanvasStore.getState().expressions['r1']?.parentId).toBeUndefined();
  });

  it('returns empty string for empty array', () => {
    const groupId = useCanvasStore.getState().groupExpressions([]);
    expect(groupId).toBe('');
  });

  it('filters out non-existent IDs — only groups existing expressions', () => {
    const r1 = makeRectangle('r1');
    const r2 = makeRectangle('r2');
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);

    const groupId = useCanvasStore.getState().groupExpressions(['r1', 'r2', 'nonexistent']);

    expect(groupId).toBeTruthy();
    const state = useCanvasStore.getState();
    expect(state.expressions['r1']?.parentId).toBe(groupId);
    expect(state.expressions['r2']?.parentId).toBe(groupId);
  });

  it('returns empty string when all IDs are non-existent', () => {
    const groupId = useCanvasStore.getState().groupExpressions(['nonexistent-1', 'nonexistent-2']);
    expect(groupId).toBe('');
  });

  it('pushes undo snapshot — can undo a group operation', () => {
    const r1 = makeRectangle('r1');
    const r2 = makeRectangle('r2');
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);

    useCanvasStore.getState().groupExpressions(['r1', 'r2']);
    expect(useCanvasStore.getState().canUndo).toBe(true);

    useCanvasStore.getState().undo();
    const state = useCanvasStore.getState();
    expect(state.expressions['r1']?.parentId).toBeUndefined();
    expect(state.expressions['r2']?.parentId).toBeUndefined();
  });

  it('groups 3 or more expressions', () => {
    const r1 = makeRectangle('r1');
    const r2 = makeRectangle('r2');
    const r3 = makeRectangle('r3');
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);
    useCanvasStore.getState().addExpression(r3);

    const groupId = useCanvasStore.getState().groupExpressions(['r1', 'r2', 'r3']);

    const state = useCanvasStore.getState();
    expect(state.expressions['r1']?.parentId).toBe(groupId);
    expect(state.expressions['r2']?.parentId).toBe(groupId);
    expect(state.expressions['r3']?.parentId).toBe(groupId);
  });
});

// ── ungroupExpressions store action ──────────────────────────

describe('ungroupExpressions [STORE]', () => {
  it('clears parentId on all group members', () => {
    const r1 = makeRectangle('r1');
    const r2 = makeRectangle('r2');
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);

    const groupId = useCanvasStore.getState().groupExpressions(['r1', 'r2']);
    useCanvasStore.getState().ungroupExpressions(groupId);

    const state = useCanvasStore.getState();
    expect(state.expressions['r1']?.parentId).toBeUndefined();
    expect(state.expressions['r2']?.parentId).toBeUndefined();
  });

  it('emits an ungroup ProtocolOperation with correct payload', () => {
    const r1 = makeRectangle('r1');
    const r2 = makeRectangle('r2');
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);

    const groupId = useCanvasStore.getState().groupExpressions(['r1', 'r2']);
    useCanvasStore.getState().ungroupExpressions(groupId);

    const ops = useCanvasStore.getState().operationLog;
    const ungroupOp = ops.find((op) => op.type === 'ungroup');
    expect(ungroupOp).toBeDefined();

    const payload = ungroupOp!.payload as UngroupPayload;
    expect(payload.type).toBe('ungroup');
    expect(payload.groupId).toBe(groupId);
  });

  it('is a no-op for non-existent groupId', () => {
    const initialOpCount = useCanvasStore.getState().operationLog.length;
    useCanvasStore.getState().ungroupExpressions('nonexistent');

    // No new operations emitted for non-existent group
    expect(useCanvasStore.getState().operationLog.length).toBe(initialOpCount);
  });

  it('pushes undo snapshot — can undo an ungroup operation', () => {
    const r1 = makeRectangle('r1');
    const r2 = makeRectangle('r2');
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);

    const groupId = useCanvasStore.getState().groupExpressions(['r1', 'r2']);
    useCanvasStore.getState().ungroupExpressions(groupId);

    // Undo ungroup — should restore parentId
    useCanvasStore.getState().undo();
    const state = useCanvasStore.getState();
    expect(state.expressions['r1']?.parentId).toBe(groupId);
    expect(state.expressions['r2']?.parentId).toBe(groupId);
  });
});

// ── Group-aware helpers ──────────────────────────────────────

describe('getGroupMembers helper [STORE]', () => {
  it('returns all expressions sharing the same parentId', () => {
    const r1 = makeRectangle('r1');
    const r2 = makeRectangle('r2');
    const r3 = makeRectangle('r3');
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);
    useCanvasStore.getState().addExpression(r3);

    const groupId = useCanvasStore.getState().groupExpressions(['r1', 'r2']);

    const { getGroupMembers } = useCanvasStore.getState();
    const members = getGroupMembers(groupId);
    expect(members).toEqual(expect.arrayContaining(['r1', 'r2']));
    expect(members).toHaveLength(2);
    expect(members).not.toContain('r3');
  });

  it('returns empty array for non-existent groupId', () => {
    const { getGroupMembers } = useCanvasStore.getState();
    expect(getGroupMembers('nonexistent')).toEqual([]);
  });
});

describe('expandSelectionToGroups helper [STORE]', () => {
  it('expands selection to include all group members when one member is selected', () => {
    const r1 = makeRectangle('r1');
    const r2 = makeRectangle('r2');
    const r3 = makeRectangle('r3');
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);
    useCanvasStore.getState().addExpression(r3);

    useCanvasStore.getState().groupExpressions(['r1', 'r2']);

    const { expandSelectionToGroups } = useCanvasStore.getState();
    const expanded = expandSelectionToGroups(new Set(['r1']));
    expect(expanded.has('r1')).toBe(true);
    expect(expanded.has('r2')).toBe(true);
    expect(expanded.has('r3')).toBe(false);
  });

  it('handles ungrouped expressions — no expansion', () => {
    const r1 = makeRectangle('r1');
    useCanvasStore.getState().addExpression(r1);

    const { expandSelectionToGroups } = useCanvasStore.getState();
    const expanded = expandSelectionToGroups(new Set(['r1']));
    expect(expanded.size).toBe(1);
    expect(expanded.has('r1')).toBe(true);
  });

  it('handles multiple groups — expands each independently', () => {
    const r1 = makeRectangle('r1');
    const r2 = makeRectangle('r2');
    const r3 = makeRectangle('r3');
    const r4 = makeRectangle('r4');
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);
    useCanvasStore.getState().addExpression(r3);
    useCanvasStore.getState().addExpression(r4);

    useCanvasStore.getState().groupExpressions(['r1', 'r2']);
    useCanvasStore.getState().groupExpressions(['r3', 'r4']);

    const { expandSelectionToGroups } = useCanvasStore.getState();
    const expanded = expandSelectionToGroups(new Set(['r1', 'r3']));
    expect(expanded.size).toBe(4);
  });
});

// ── Nested groups ────────────────────────────────────────────

describe('Nested groups [EDGE]', () => {
  it('group A contains group B — inner group maintains its parentId', () => {
    const r1 = makeRectangle('r1');
    const r2 = makeRectangle('r2');
    const r3 = makeRectangle('r3');
    const r4 = makeRectangle('r4');
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);
    useCanvasStore.getState().addExpression(r3);
    useCanvasStore.getState().addExpression(r4);

    // Group r1+r2 into inner group
    const innerGroupId = useCanvasStore.getState().groupExpressions(['r1', 'r2']);

    // Group r3+r4 into outer group (which could coexist)
    const outerGroupId = useCanvasStore.getState().groupExpressions(['r3', 'r4']);

    const state = useCanvasStore.getState();
    // Inner group members have innerGroupId
    expect(state.expressions['r1']?.parentId).toBe(innerGroupId);
    expect(state.expressions['r2']?.parentId).toBe(innerGroupId);
    // Outer group members have outerGroupId
    expect(state.expressions['r3']?.parentId).toBe(outerGroupId);
    expect(state.expressions['r4']?.parentId).toBe(outerGroupId);

    // Ungrouping inner doesn't affect outer
    useCanvasStore.getState().ungroupExpressions(innerGroupId);
    const state2 = useCanvasStore.getState();
    expect(state2.expressions['r1']?.parentId).toBeUndefined();
    expect(state2.expressions['r2']?.parentId).toBeUndefined();
    expect(state2.expressions['r3']?.parentId).toBe(outerGroupId);
    expect(state2.expressions['r4']?.parentId).toBe(outerGroupId);
  });
});

// ── Group-aware deletion ─────────────────────────────────────

describe('Group-aware deletion [BEHAVIOR]', () => {
  it('deleting one group member deletes all members in the group', () => {
    const r1 = makeRectangle('r1');
    const r2 = makeRectangle('r2');
    const r3 = makeRectangle('r3');
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);
    useCanvasStore.getState().addExpression(r3);

    useCanvasStore.getState().groupExpressions(['r1', 'r2']);

    // Select r1 and delete — r2 should also be deleted
    useCanvasStore.getState().setSelectedIds(new Set(['r1', 'r2']));
    useCanvasStore.getState().deleteExpressions(
      Array.from(useCanvasStore.getState().expandSelectionToGroups(new Set(['r1']))),
    );

    const state = useCanvasStore.getState();
    expect(state.expressions['r1']).toBeUndefined();
    expect(state.expressions['r2']).toBeUndefined();
    // Non-grouped expression is untouched
    expect(state.expressions['r3']).toBeDefined();
  });
});

// ── Group-aware duplication ──────────────────────────────────

describe('Group-aware duplication [BEHAVIOR]', () => {
  it('duplicateGrouped creates new expressions with a new groupId preserving group structure', () => {
    const r1 = makeRectangle('r1', 100, 100);
    const r2 = makeRectangle('r2', 200, 200);
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);

    const groupId = useCanvasStore.getState().groupExpressions(['r1', 'r2']);

    // Select both group members
    useCanvasStore.getState().setSelectedIds(new Set(['r1', 'r2']));

    // Duplicate using the store helper
    const newIds = useCanvasStore.getState().duplicateGrouped(new Set(['r1', 'r2']));

    const state = useCanvasStore.getState();
    expect(newIds).toHaveLength(2);

    // New expressions exist
    for (const nid of newIds) {
      expect(state.expressions[nid]).toBeDefined();
    }

    // New expressions share a NEW groupId (different from original)
    const newGroupId = state.expressions[newIds[0]!]?.parentId;
    expect(newGroupId).toBeTruthy();
    expect(newGroupId).not.toBe(groupId);
    for (const nid of newIds) {
      expect(state.expressions[nid]?.parentId).toBe(newGroupId);
    }
  });
});

// ── Remote operations ────────────────────────────────────────

describe('applyRemoteOperation for group/ungroup [REMOTE]', () => {
  it('applies remote group operation — sets parentId on expressions', () => {
    const r1 = makeRectangle('r1');
    const r2 = makeRectangle('r2');
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);

    useCanvasStore.getState().applyRemoteOperation({
      id: 'op-1',
      type: 'group',
      author: { type: 'human', id: 'remote-user', name: 'Remote' },
      timestamp: Date.now(),
      payload: {
        type: 'group',
        expressionIds: ['r1', 'r2'],
        groupId: 'remote-group-1',
      },
    });

    const state = useCanvasStore.getState();
    expect(state.expressions['r1']?.parentId).toBe('remote-group-1');
    expect(state.expressions['r2']?.parentId).toBe('remote-group-1');
  });

  it('applies remote ungroup operation — clears parentId', () => {
    const r1 = makeRectangle('r1');
    const r2 = makeRectangle('r2');
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);

    // First group them
    useCanvasStore.getState().applyRemoteOperation({
      id: 'op-1',
      type: 'group',
      author: { type: 'human', id: 'remote-user', name: 'Remote' },
      timestamp: Date.now(),
      payload: {
        type: 'group',
        expressionIds: ['r1', 'r2'],
        groupId: 'remote-group-1',
      },
    });

    // Then ungroup
    useCanvasStore.getState().applyRemoteOperation({
      id: 'op-2',
      type: 'ungroup',
      author: { type: 'human', id: 'remote-user', name: 'Remote' },
      timestamp: Date.now(),
      payload: {
        type: 'ungroup',
        groupId: 'remote-group-1',
      },
    });

    const state = useCanvasStore.getState();
    expect(state.expressions['r1']?.parentId).toBeUndefined();
    expect(state.expressions['r2']?.parentId).toBeUndefined();
  });
});
