/**
 * Orthogonal (right-angle) routing for arrow connectors — draw.io style.
 *
 * Simple, predictable routing:
 * 1. Exit perpendicular from the source shape edge by a fixed stub
 * 2. Connect stubs with 0–2 right-angle segments
 * 3. Enter the target shape edge perpendicular
 *
 * Produces 4–6 waypoints. Never routes through shape bounds.
 * Five internal functions — no complex path-finding.
 *
 * [CLEAN-CODE] [SRP]
 * @module
 */

/** Default exit/entry stub length in world units. */
const DEFAULT_PADDING = 20;

/** Unit direction vector. */
interface Dir { dx: number; dy: number }

/** Bounding rectangle for shape-avoidance. */
type Rect = { x: number; y: number; width: number; height: number };

// ── 1. Public entry point ────────────────────────────────────

/**
 * Compute an orthogonal route between two points.
 *
 * Returns [x, y] waypoints forming only horizontal/vertical segments.
 *
 * @param start       Connection point on shape A edge
 * @param end         Connection point on shape B edge
 * @param startAnchor Anchor: top | bottom | left | right | corners
 * @param endAnchor   Anchor for the target shape
 * @param startBounds Bounding rect of shape A
 * @param endBounds   Bounding rect of shape B
 * @param jettySize   Exit/entry stub length (default: 20)
 * @param midpointOffset Z-shape midpoint ratio 0–1 (0.5 = centered, default)
 */
export function computeOrthogonalRoute(
  start: { x: number; y: number },
  end: { x: number; y: number },
  startAnchor?: string,
  endAnchor?: string,
  startBounds?: Rect,
  endBounds?: Rect,
  jettySize?: number,
  midpointOffset?: number,
): [number, number][] {
  if (start.x === end.x && start.y === end.y) {
    return [[start.x, start.y], [end.x, end.y]];
  }

  const padding = typeof jettySize === 'number' ? jettySize : DEFAULT_PADDING;
  const exitDir = resolveDirection(startAnchor, start, end);
  const entryDir = resolveDirection(endAnchor, end, start);

  // Compute exit/entry stubs — clear shape edges before turning
  const exitStub: [number, number] = [
    start.x + exitDir.dx * padding,
    start.y + exitDir.dy * padding,
  ];
  const entryStub: [number, number] = [
    end.x + entryDir.dx * padding,
    end.y + entryDir.dy * padding,
  ];

  // Connect the two stubs with orthogonal segments
  const middle = connectStubs(
    exitStub, entryStub, exitDir, entryDir,
    startBounds, endBounds, padding, midpointOffset,
  );

  return [
    [start.x, start.y],
    exitStub,
    ...middle,
    entryStub,
    [end.x, end.y],
  ];
}

// ── 2. Direction resolution ──────────────────────────────────

/**
 * Resolve anchor name → unit direction vector.
 *
 * Direct mapping: top→up, bottom→down, left→left, right→right.
 * Corner anchors use horizontal component (top-right → right).
 * No anchor: infer toward target on the longer axis.
 */
function resolveDirection(
  anchor: string | undefined,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Dir {
  if (anchor) {
    switch (anchor) {
      case 'top':          return { dx:  0, dy: -1 };
      case 'bottom':       return { dx:  0, dy:  1 };
      case 'left':         return { dx: -1, dy:  0 };
      case 'right':        return { dx:  1, dy:  0 };
      case 'top-right':    return { dx:  1, dy:  0 };
      case 'top-left':     return { dx: -1, dy:  0 };
      case 'bottom-right': return { dx:  1, dy:  0 };
      case 'bottom-left':  return { dx: -1, dy:  0 };
    }
  }
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? { dx: 1, dy: 0 } : { dx: -1, dy: 0 };
  }
  return deltaY >= 0 ? { dx: 0, dy: 1 } : { dx: 0, dy: -1 };
}

// ── 3. Stub connection ───────────────────────────────────────

/**
 * Connect two stub endpoints with 0–2 orthogonal segments.
 *
 * Cases:
 * - **Aligned**: stubs share x or y → direct, no middle points
 * - **Cross-axis** (H↔V): L-shape corner, fallback to C-shape
 * - **Same-axis, normal flow**: Z-shape with adjustable midpoint
 * - **Same-axis, opposing**: C-shape detour around shapes
 */
function connectStubs(
  exit: [number, number],
  entry: [number, number],
  exitDir: Dir,
  entryDir: Dir,
  sBounds?: Rect,
  eBounds?: Rect,
  padding: number = DEFAULT_PADDING,
  midpointOffset?: number,
): [number, number][] {
  // Stubs already aligned — direct connection
  if (exit[0] === entry[0] || exit[1] === entry[1]) return [];

  const exitH = exitDir.dx !== 0;
  const entryH = entryDir.dx !== 0;

  // ── Cross-axis: L-shape ──
  if (exitH !== entryH) {
    // Natural corner: continue exit direction, turn to entry
    const corner: [number, number] = exitH
      ? [entry[0], exit[1]]
      : [exit[0], entry[1]];

    if (!segmentCrossesRect(exit, corner, sBounds) &&
        !segmentCrossesRect(exit, corner, eBounds) &&
        !segmentCrossesRect(corner, entry, sBounds) &&
        !segmentCrossesRect(corner, entry, eBounds)) {
      return [corner];
    }

    // Alt corner: turn first, then approach entry
    const alt: [number, number] = exitH
      ? [exit[0], entry[1]]
      : [entry[0], exit[1]];

    if (!segmentCrossesRect(exit, alt, sBounds) &&
        !segmentCrossesRect(exit, alt, eBounds) &&
        !segmentCrossesRect(alt, entry, sBounds) &&
        !segmentCrossesRect(alt, entry, eBounds)) {
      return [alt];
    }

    // Both corners blocked → C-shape detour
    const cl = computeClearance(!exitH, sBounds, eBounds, exit, entry, padding);
    return exitH
      ? [[exit[0], cl], [entry[0], cl]]
      : [[cl, exit[1]], [cl, entry[1]]];
  }

  // ── Same axis ──
  const forward = exitH ? exitDir.dx : exitDir.dy;
  const diff = exitH ? entry[0] - exit[0] : entry[1] - exit[1];
  const normalFlow = (forward > 0 && diff > 0) || (forward < 0 && diff < 0);

  if (normalFlow) {
    // Z-shape: place a mid-segment between the stubs, controlled by midpointOffset
    const t = midpointOffset ?? 0.5;
    if (exitH) {
      let midX = exit[0] + (entry[0] - exit[0]) * t;
      // Push midX out of any blocking shape
      const lo = Math.min(exit[1], entry[1]);
      const hi = Math.max(exit[1], entry[1]);
      for (const b of [sBounds, eBounds]) {
        if (b && midX > b.x && midX < b.x + b.width &&
            hi > b.y && lo < b.y + b.height) {
          const r = b.x + b.width + padding;
          const l = b.x - padding;
          midX = Math.abs(r - midX) <= Math.abs(l - midX) ? r : l;
        }
      }
      return [[midX, exit[1]], [midX, entry[1]]];
    }

    let midY = exit[1] + (entry[1] - exit[1]) * t;
    const lo = Math.min(exit[0], entry[0]);
    const hi = Math.max(exit[0], entry[0]);
    for (const b of [sBounds, eBounds]) {
      if (b && midY > b.y && midY < b.y + b.height &&
          hi > b.x && lo < b.x + b.width) {
        const d = b.y + b.height + padding;
        const u = b.y - padding;
        midY = Math.abs(d - midY) <= Math.abs(u - midY) ? d : u;
      }
    }
    return [[exit[0], midY], [entry[0], midY]];
  }

  // Opposing flow → C-shape detour
  if (exitH) {
    const clY = computeClearance(false, sBounds, eBounds, exit, entry, padding);
    return [[exit[0], clY], [entry[0], clY]];
  }
  const clX = computeClearance(true, sBounds, eBounds, exit, entry, padding);
  return [[clX, exit[1]], [clX, entry[1]]];
}

// ── 4. Segment–rect crossing ─────────────────────────────────

/**
 * Check whether an orthogonal segment crosses strictly through a rect.
 * Uses strict inequalities — segments along shape edges don't trigger.
 */
function segmentCrossesRect(
  p1: [number, number],
  p2: [number, number],
  rect?: Rect,
): boolean {
  if (!rect) return false;
  const [x1, y1] = p1;
  const [x2, y2] = p2;

  if (y1 === y2) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    return y1 > rect.y && y1 < rect.y + rect.height &&
           maxX > rect.x && minX < rect.x + rect.width;
  }
  if (x1 === x2) {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return x1 > rect.x && x1 < rect.x + rect.width &&
           maxY > rect.y && minY < rect.y + rect.height;
  }
  return false;
}

// ── 5. Clearance computation ─────────────────────────────────

/**
 * Compute a clearance coordinate outside both shapes for C-shape detours.
 * Returns an x (if isXAxis) or y that clears all shape extents.
 */
function computeClearance(
  isXAxis: boolean,
  sBounds?: Rect,
  eBounds?: Rect,
  exit: [number, number] = [0, 0],
  entry: [number, number] = [0, 0],
  padding: number = DEFAULT_PADDING,
): number {
  const all = [sBounds, eBounds].filter(Boolean) as Rect[];

  if (all.length === 0) {
    return isXAxis
      ? (exit[0] + entry[0]) / 2
      : (exit[1] + entry[1]) / 2;
  }

  if (isXAxis) {
    const lo = Math.min(...all.map(b => b.x)) - padding;
    const hi = Math.max(...all.map(b => b.x + b.width)) + padding;
    const avg = (exit[0] + entry[0]) / 2;
    return Math.abs(avg - lo) < Math.abs(avg - hi) ? lo : hi;
  }

  const lo = Math.min(...all.map(b => b.y)) - padding;
  const hi = Math.max(...all.map(b => b.y + b.height)) + padding;
  const avg = (exit[1] + entry[1]) / 2;
  return Math.abs(avg - lo) < Math.abs(avg - hi) ? lo : hi;
}
