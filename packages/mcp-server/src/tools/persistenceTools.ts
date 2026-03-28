/**
 * Canvas save/load tools — persist and restore canvas state as JSON files.
 *
 * Saves to ~/.infinicanvas/saves/ as a global diagram library.
 * Each save captures the full expression data for faithful restoration.
 *
 * @module
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { IGatewayClient } from '../gatewayClient.js';

/** Global saves directory. */
const SAVES_DIR = join(homedir(), '.infinicanvas', 'saves');

/** Ensure the saves directory exists. */
function ensureSavesDir(): void {
  if (!existsSync(SAVES_DIR)) {
    mkdirSync(SAVES_DIR, { recursive: true });
  }
}

/** Sanitize a save name to a safe filename. */
function toFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100) + '.json';
}

/**
 * Save the current canvas state to a named file.
 */
export function executeCanvasSave(
  client: IGatewayClient,
  params: { name: string; description?: string },
): string {
  ensureSavesDir();

  const expressions = client.getState();
  if (expressions.length === 0) {
    return 'Canvas is empty — nothing to save.';
  }

  const snapshot = {
    name: params.name,
    description: params.description ?? '',
    savedAt: new Date().toISOString(),
    count: expressions.length,
    expressions,
  };

  const filename = toFilename(params.name);
  const filepath = join(SAVES_DIR, filename);
  writeFileSync(filepath, JSON.stringify(snapshot, null, 2), 'utf-8');

  return `Saved "${params.name}" (${expressions.length} expressions) to ${filepath}`;
}

/**
 * Load a saved canvas state and restore it on the canvas.
 */
export async function executeCanvasLoad(
  client: IGatewayClient,
  params: { name: string; clearFirst?: boolean },
): Promise<string> {
  ensureSavesDir();

  const filename = toFilename(params.name);
  const filepath = join(SAVES_DIR, filename);

  if (!existsSync(filepath)) {
    // Try exact match first, then fuzzy
    const files = readdirSync(SAVES_DIR);
    const match = files.find((f) => f.toLowerCase().includes(params.name.toLowerCase()));
    if (!match) {
      return `Save "${params.name}" not found. Use canvas_list_saves to see available saves.`;
    }
    return executeCanvasLoad(client, { ...params, name: match.replace('.json', '') });
  }

  const raw = readFileSync(filepath, 'utf-8');
  const snapshot = JSON.parse(raw);

  if (!snapshot.expressions || !Array.isArray(snapshot.expressions)) {
    return `Save "${params.name}" has invalid format — no expressions array found.`;
  }

  let restored = 0;
  for (const expr of snapshot.expressions) {
    try {
      await client.sendCreate(expr);
      restored++;
    } catch {
      // Skip expressions that fail to create
    }
  }

  return `Restored "${snapshot.name ?? params.name}" — ${restored}/${snapshot.expressions.length} expressions loaded.`;
}

/**
 * List all saved canvas diagrams.
 */
export function executeCanvasListSaves(): string {
  ensureSavesDir();

  const files = readdirSync(SAVES_DIR).filter((f) => f.endsWith('.json'));

  if (files.length === 0) {
    return 'No saved diagrams found. Use canvas_save to save the current canvas.';
  }

  const saves = files.map((f) => {
    try {
      const raw = readFileSync(join(SAVES_DIR, f), 'utf-8');
      const snapshot = JSON.parse(raw);
      return {
        name: snapshot.name ?? f.replace('.json', ''),
        description: snapshot.description ?? '',
        count: snapshot.count ?? '?',
        savedAt: snapshot.savedAt ?? 'unknown',
      };
    } catch {
      return { name: f.replace('.json', ''), description: '', count: '?', savedAt: 'unknown' };
    }
  });

  const lines = saves.map(
    (s) => `• "${s.name}" — ${s.count} expressions, saved ${s.savedAt}${s.description ? ` — ${s.description}` : ''}`,
  );

  return `${saves.length} saved diagram(s):\n\n${lines.join('\n')}`;
}
