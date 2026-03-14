/**
 * ExpressionBuilder tests for InfiniCanvas Protocol.
 *
 * Verifies the fluent builder API produces valid VisualExpressions
 * matching the expected schema for each expression kind.
 */

import { describe, it, expect } from 'vitest';
import {
  ExpressionBuilder,
  visualExpressionSchema,
} from '../index.js';
import type { AuthorInfo } from '../index.js';

// ── Test fixtures ──────────────────────────────────────────

const humanAuthor: AuthorInfo = { type: 'human', id: 'user-1', name: 'Alice' };
const agentAuthor: AuthorInfo = { type: 'agent', id: 'agent-1', name: 'Canvas AI', provider: 'openai' };

// ── ExpressionBuilder tests ────────────────────────────────

describe('ExpressionBuilder', () => {
  let builder: ExpressionBuilder;

  beforeEach(() => {
    builder = new ExpressionBuilder(humanAuthor);
  });

  describe('rectangle', () => {
    it('builds a valid rectangle expression', () => {
      const expr = builder.rectangle(100, 200, 300, 150).build();

      expect(expr.kind).toBe('rectangle');
      expect(expr.position).toEqual({ x: 100, y: 200 });
      expect(expr.size).toEqual({ width: 300, height: 150 });
      expect(expr.data.kind).toBe('rectangle');
      expect(expr.meta.author).toEqual(humanAuthor);
      expect(expr.id).toBeTruthy();

      const validation = visualExpressionSchema.safeParse(expr);
      expect(validation.success).toBe(true);
    });

    it('builds a rectangle with label', () => {
      const expr = builder.rectangle(0, 0, 100, 100).label('My Box').build();

      expect(expr.data).toEqual({ kind: 'rectangle', label: 'My Box' });
    });

    it('builds a rectangle with custom style', () => {
      const expr = builder
        .rectangle(0, 0, 100, 100)
        .style({ fillStyle: 'hachure', strokeColor: '#FF0000' })
        .build();

      expect(expr.style.fillStyle).toBe('hachure');
      expect(expr.style.strokeColor).toBe('#FF0000');
      // Other defaults should be preserved
      expect(expr.style.opacity).toBe(1);
    });

    it('validates against schema', () => {
      const expr = builder
        .rectangle(10, 20, 300, 200)
        .label('Schema test')
        .style({ fillStyle: 'solid', backgroundColor: '#FFFFFF' })
        .build();

      const result = visualExpressionSchema.safeParse(expr);
      expect(result.success).toBe(true);
    });
  });

  describe('ellipse', () => {
    it('builds a valid ellipse expression', () => {
      const expr = builder.ellipse(50, 50, 200, 200).build();

      expect(expr.kind).toBe('ellipse');
      expect(expr.data.kind).toBe('ellipse');

      const validation = visualExpressionSchema.safeParse(expr);
      expect(validation.success).toBe(true);
    });
  });

  describe('diamond', () => {
    it('builds a valid diamond expression', () => {
      const expr = builder.diamond(0, 0, 150, 150).label('Decision?').build();

      expect(expr.kind).toBe('diamond');
      expect(expr.data).toEqual({ kind: 'diamond', label: 'Decision?' });

      const validation = visualExpressionSchema.safeParse(expr);
      expect(validation.success).toBe(true);
    });
  });

  describe('text', () => {
    it('builds a valid text expression', () => {
      const expr = builder.text('Hello World', 100, 200).build();

      expect(expr.kind).toBe('text');
      expect(expr.data).toEqual({
        kind: 'text',
        text: 'Hello World',
        fontSize: 16,
        fontFamily: 'sans-serif',
        textAlign: 'left',
      });

      const validation = visualExpressionSchema.safeParse(expr);
      expect(validation.success).toBe(true);
    });

    it('builds text with custom font settings', () => {
      const expr = builder
        .text('Code', 0, 0)
        .fontSize(14)
        .fontFamily('monospace')
        .align('center')
        .build();

      expect(expr.data).toEqual({
        kind: 'text',
        text: 'Code',
        fontSize: 14,
        fontFamily: 'monospace',
        textAlign: 'center',
      });
    });
  });

  describe('stickyNote', () => {
    it('builds a valid sticky note with default color', () => {
      const expr = builder.stickyNote('Remember this').build();

      expect(expr.kind).toBe('sticky-note');
      expect(expr.data).toEqual({
        kind: 'sticky-note',
        text: 'Remember this',
        color: '#FFEB3B',
      });

      const validation = visualExpressionSchema.safeParse(expr);
      expect(validation.success).toBe(true);
    });

    it('builds a sticky note with custom color', () => {
      const expr = builder.stickyNote('Note', '#FF6B6B').build();

      expect(expr.data).toEqual({
        kind: 'sticky-note',
        text: 'Note',
        color: '#FF6B6B',
      });
    });
  });

  describe('flowchart', () => {
    it('builds a valid flowchart expression', () => {
      const expr = builder
        .flowchart('Auth Flow')
        .node('login', 'Login Page', 'rect')
        .node('validate', 'Valid?', 'diamond')
        .edge('login', 'validate', 'submit')
        .direction('TB')
        .build();

      expect(expr.kind).toBe('flowchart');
      expect(expr.data).toEqual({
        kind: 'flowchart',
        title: 'Auth Flow',
        nodes: [
          { id: 'login', label: 'Login Page', shape: 'rect' },
          { id: 'validate', label: 'Valid?', shape: 'diamond' },
        ],
        edges: [
          { from: 'login', to: 'validate', label: 'submit' },
        ],
        direction: 'TB',
      });

      const validation = visualExpressionSchema.safeParse(expr);
      expect(validation.success).toBe(true);
    });

    it('builds a flowchart with LR direction', () => {
      const expr = builder
        .flowchart('Pipeline')
        .node('build', 'Build', 'rect')
        .node('test', 'Test', 'rect')
        .node('deploy', 'Deploy', 'rect')
        .edge('build', 'test')
        .edge('test', 'deploy')
        .direction('LR')
        .build();

      expect(expr.data).toMatchObject({
        kind: 'flowchart',
        direction: 'LR',
      });

      const validation = visualExpressionSchema.safeParse(expr);
      expect(validation.success).toBe(true);
    });
  });

  describe('reasoningChain', () => {
    it('builds a valid reasoning chain expression', () => {
      const expr = builder
        .reasoningChain('Why use WebSocket?')
        .step('Real-time needed', 'AI output should appear instantly')
        .step('Bidirectional', 'Both human and AI push changes')
        .answer('WebSocket provides full-duplex communication')
        .build();

      expect(expr.kind).toBe('reasoning-chain');
      expect(expr.data).toEqual({
        kind: 'reasoning-chain',
        question: 'Why use WebSocket?',
        steps: [
          { title: 'Real-time needed', content: 'AI output should appear instantly' },
          { title: 'Bidirectional', content: 'Both human and AI push changes' },
        ],
        finalAnswer: 'WebSocket provides full-duplex communication',
      });

      const validation = visualExpressionSchema.safeParse(expr);
      expect(validation.success).toBe(true);
    });
  });

  describe('cross-cutting concerns', () => {
    it('generates unique IDs for each expression', () => {
      const expr1 = builder.rectangle(0, 0, 100, 100).build();
      const expr2 = builder.rectangle(0, 0, 100, 100).build();

      expect(expr1.id).not.toBe(expr2.id);
    });

    it('sets timestamps on build', () => {
      const before = Date.now();
      const expr = builder.rectangle(0, 0, 100, 100).build();
      const after = Date.now();

      expect(expr.meta.createdAt).toBeGreaterThanOrEqual(before);
      expect(expr.meta.createdAt).toBeLessThanOrEqual(after);
      expect(expr.meta.updatedAt).toBe(expr.meta.createdAt);
    });

    it('uses the provided author', () => {
      const agentBuilder = new ExpressionBuilder(agentAuthor);
      const expr = agentBuilder.rectangle(0, 0, 100, 100).build();

      expect(expr.meta.author).toEqual(agentAuthor);
    });

    it('defaults to unlocked and no tags', () => {
      const expr = builder.rectangle(0, 0, 100, 100).build();

      expect(expr.meta.locked).toBe(false);
      expect(expr.meta.tags).toEqual([]);
    });

    it('allows setting tags via shape builder', () => {
      const expr = builder
        .rectangle(0, 0, 100, 100)
        .tags(['important', 'phase-1'])
        .build();

      expect(expr.meta.tags).toEqual(['important', 'phase-1']);
    });

    it('defaults angle to 0', () => {
      const expr = builder.rectangle(0, 0, 100, 100).build();
      expect(expr.angle).toBe(0);
    });
  });
});
