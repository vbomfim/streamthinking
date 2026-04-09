/**
 * Orthogonal (right-angle) routing for arrow connectors.
 *
 * Computes a path between two points using only horizontal and vertical
 * segments. Every route begins with an **exit stub** (a short segment
 * that clears the source shape) and ends with an **entry stub** (a short
 * segment that clears the target shape). Between the stubs, segments
 * are placed outside both shapes' bounding boxes.
 *
 * [CLEAN-CODE] [SRP]
 * @module
 */

/** Padding in world units to keep routes clear of shapes. */
const ROUTE_PADDING = 20;

/** Horizontal or vertical exit direction derived from an anchor. */
type ExitDirection = 'up' | 'down' | 'left' | 'right';

/** Bounding rectangle for shape-avoidance checks. */
type Rect = { x: number; y: number; width: number; height: number };

/**
 * Compute an orthogonal route between two points.
 *
 * Returns an array of [x, y] waypoints where every consecutive pair
 * forms a horizontal or vertical segment. The route starts at `start`
 * and ends at `end`.
 *
 * Anchor strings control the exit direction from each endpoint:
 * - 'top' → exit upward (vertical)
 * - 'bottom' → exit downward (vertical)
 * - 'left' → exit leftward (horizontal)
 * - 'right' → exit rightward (horizontal)
 * - Corner anchors infer direction from the primary axis.
 * - Without anchors, a heuristic chooses the direction.
 *
 * [CLEAN-CODE] [SRP]
 */
export function computeOrthogonalRoute(
  start: { x: number; y: number },
  end: { x: number; y: number },
  startAnchor?: string,
  endAnchor?: string,
  startBounds?: Rect,
  endBounds?: Rect,
  jettySize?: number,
): [number, number][] {
  // Same point — return a degenerate route
  if (start.x === end.x && start.y === end.y) {
    return [[start.x, start.y], [end.x, end.y]];
  }

  const startExit = resolveExitDirection(startAnchor, start, end);
  const endEntry = resolveEntryDirection(endAnchor, end, start);
  const padding = typeof jettySize === 'number' ? jettySize : ROUTE_PADDING;

  return routeWithDirections(start, end, startExit, endEntry, padding, startBounds, endBounds);
}

// ── Stub computation ─────────────────────────────────────────

/**
 * Compute the stub endpoint — a point `padding` pixels from the
 * shape edge in the given direction.
 *
 * The stub ensures the first/last segment of the route clears the
 * connected shape before turning.
 */
function computeStubPoint(
  point: { x: number; y: number },
  direction: ExitDirection,
  padding: number,
): [number, number] {
  switch (direction) {
    case 'right': return [point.x + padding, point.y];
    case 'left':  return [point.x - padding, point.y];
    case 'down':  return [point.x, point.y + padding];
    case 'up':    return [point.x, point.y - padding];
  }
}

// ── Segment–rect crossing ────────────────────────────────────

/**
 * Check whether an orthogonal segment crosses strictly through a rect.
 *
 * Uses strict inequalities so segments along a shape edge (where
 * connection points sit) are not flagged as crossings.
 */
function segmentCrossesRect(
  p1: [number, number],
  p2: [number, number],
  rect?: Rect,
): boolean {
  if (!rect) return false;

  const [x1, y1] = p1;
  const [x2, y2] = p2;

  // Horizontal segment
  if (y1 === y2) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    return (
      y1 > rect.y && y1 < rect.y + rect.height &&
      maxX > rect.x && minX < rect.x + rect.width
    );
  }

  // Vertical segment
  if (x1 === x2) {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return (
      x1 > rect.x && x1 < rect.x + rect.width &&
      maxY > rect.y && minY < rect.y + rect.height
    );
  }

  return false;
}

// ── Core routing with stubs ──────────────────────────────────

/**
 * Route between two points given explicit exit and entry directions.
 *
 * 1. Compute exit stub (clears source shape).
 * 2. Compute entry stub (clears target shape).
 * 3. Connect stubs based on exit/entry direction combination.
 * 4. Return: [start, exitStub, ...middle, entryStub, end].
 *
 * [CLEAN-CODE] [SRP]
 */
function routeWithDirections(
  start: { x: number; y: number },
  end: { x: number; y: number },
  startExit: ExitDirection,
  endEntry: ExitDirection,
  padding: number,
  startBounds?: Rect,
  endBounds?: Rect,
): [number, number][] {
  const exitStub = computeStubPoint(start, startExit, padding);
  const entryStub = computeStubPoint(end, endEntry, padding);

  const isExitH = startExit === 'left' || startExit === 'right';
  const isEntryH = endEntry === 'left' || endEntry === 'right';

  let middlePoints: [number, number][];

  // Stubs already aligned on same axis — no middle needed
  if (exitStub[0] === entryStub[0] || exitStub[1] === entryStub[1]) {
    middlePoints = [];
  } else if (isExitH !== isEntryH) {
    // Cross-axis: L-shape between stubs (with fallback)
    middlePoints = connectCrossAxis(
      exitStub, entryStub, startExit, startBounds, endBounds, padding,
    );
  } else if (isExitH) {
    // Same-axis horizontal: Z-shape with vertical middle
    middlePoints = connectSameAxisH(
      exitStub, entryStub, startExit, startBounds, endBounds, padding,
    );
  } else {
    // Same-axis vertical: Z-shape with horizontal middle
    middlePoints = connectSameAxisV(
      exitStub, entryStub, startExit, startBounds, endBounds, padding,
    );
  }

  return [
    [start.x, start.y],
    exitStub,
    ...middlePoints,
    entryStub,
    [end.x, end.y],
  ];
}

// ── Cross-axis (L-shape) ─────────────────────────────────────

/**
 * Connect exit and entry stubs that are on different axes.
 *
 * Tries the natural L-shape corner first (continue in exit direction,
 * then turn toward entry). If that corner segment crosses a shape,
 * tries the alternative corner. Falls back to a C-shape detour.
 *
 * [CLEAN-CODE] [SRP]
 */
function connectCrossAxis(
  exitStub: [number, number],
  entryStub: [number, number],
  startExit: ExitDirection,
  startBounds?: Rect,
  endBounds?: Rect,
  padding: number = ROUTE_PADDING,
): [number, number][] {
  const isExitH = startExit === 'left' || startExit === 'right';

  // Natural corner: continue exit direction, then turn to entry
  const corner: [number, number] = isExitH
    ? [entryStub[0], exitStub[1]]
    : [exitStub[0], entryStub[1]];

  if (
    !segmentCrossesRect(exitStub, corner, endBounds) &&
    !segmentCrossesRect(exitStub, corner, startBounds) &&
    !segmentCrossesRect(corner, entryStub, startBounds) &&
    !segmentCrossesRect(corner, entryStub, endBounds)
  ) {
    return [corner];
  }

  // Alternative corner: turn first, then go toward entry
  const altCorner: [number, number] = isExitH
    ? [exitStub[0], entryStub[1]]
    : [entryStub[0], exitStub[1]];

  if (
    !segmentCrossesRect(exitStub, altCorner, endBounds) &&
    !segmentCrossesRect(exitStub, altCorner, startBounds) &&
    !segmentCrossesRect(altCorner, entryStub, startBounds) &&
    !segmentCrossesRect(altCorner, entryStub, endBounds)
  ) {
    return [altCorner];
  }

  // Both corners cross — C-shape detour around both shapes
  return detourAroundBoth(exitStub, entryStub, isExitH, startBounds, endBounds, padding);
}

// ── Same-axis horizontal (Z-shape) ──────────────────────────

/**
 * Connect two horizontal stubs with a Z-shape (vertical middle).
 *
 * Normal flow (stubs face each other): vertical middle between stubs.
 * Opposite flow (stubs face away): C-shape around both shapes.
 *
 * [CLEAN-CODE] [SRP]
 */
function connectSameAxisH(
  exitStub: [number, number],
  entryStub: [number, number],
  startExit: ExitDirection,
  startBounds?: Rect,
  endBounds?: Rect,
  padding: number = ROUTE_PADDING,
): [number, number][] {
  const goingRight = startExit === 'right';
  const normalFlow = goingRight
    ? entryStub[0] > exitStub[0]
    : entryStub[0] < exitStub[0];

  if (normalFlow) {
    // Z-shape: vertical mid between stubs
    let midX = (exitStub[0] + entryStub[0]) / 2;
    midX = adjustMidToAvoidBounds(
      midX, exitStub[1], entryStub[1], true, startBounds, endBounds, padding,
    );
    return [[midX, exitStub[1]], [midX, entryStub[1]]];
  }

  // Opposite direction — C-shape detour
  const clearanceY = computeClearance(
    false, startBounds, endBounds, exitStub, entryStub, padding,
  );
  return [
    [exitStub[0], clearanceY],
    [entryStub[0], clearanceY],
  ];
}

// ── Same-axis vertical (Z-shape) ────────────────────────────

/**
 * Connect two vertical stubs with a Z-shape (horizontal middle).
 *
 * Normal flow (stubs face each other): horizontal middle between stubs.
 * Opposite flow (stubs face away): C-shape around both shapes.
 *
 * [CLEAN-CODE] [SRP]
 */
function connectSameAxisV(
  exitStub: [number, number],
  entryStub: [number, number],
  startExit: ExitDirection,
  startBounds?: Rect,
  endBounds?: Rect,
  padding: number = ROUTE_PADDING,
): [number, number][] {
  const goingDown = startExit === 'down';
  const normalFlow = goingDown
    ? entryStub[1] > exitStub[1]
    : entryStub[1] < exitStub[1];

  if (normalFlow) {
    // Z-shape: horizontal mid between stubs
    let midY = (exitStub[1] + entryStub[1]) / 2;
    midY = adjustMidToAvoidBounds(
      midY, exitStub[0], entryStub[0], false, startBounds, endBounds, padding,
    );
    return [[exitStub[0], midY], [entryStub[0], midY]];
  }

  // Opposite direction — C-shape detour
  const clearanceX = computeClearance(
    true, startBounds, endBounds, exitStub, entryStub, padding,
  );
  return [
    [clearanceX, exitStub[1]],
    [clearanceX, entryStub[1]],
  ];
}

// ── Shared helpers ───────────────────────────────────────────

/**
 * Adjust a midpoint value so the segment at that position does not
 * cross through either shape.
 *
 * @param mid        The proposed midpoint (x for vertical, y for horizontal).
 * @param stubA      The other coordinate of the first stub.
 * @param stubB      The other coordinate of the second stub.
 * @param isVertical True if the segment at `mid` is vertical (adjusting X).
 * @param sBounds    Source shape bounds.
 * @param eBounds    Target shape bounds.
 * @param padding    Clearance distance.
 */
function adjustMidToAvoidBounds(
  mid: number,
  stubA: number,
  stubB: number,
  isVertical: boolean,
  sBounds?: Rect,
  eBounds?: Rect,
  padding: number = ROUTE_PADDING,
): number {
  const lo = Math.min(stubA, stubB);
  const hi = Math.max(stubA, stubB);

  for (const b of [sBounds, eBounds]) {
    if (!b) continue;

    if (isVertical) {
      // The segment is vertical at x = mid, spanning lo..hi in Y.
      // It crosses rect if mid is inside rect's x-range AND y ranges overlap.
      if (mid > b.x && mid < b.x + b.width && hi > b.y && lo < b.y + b.height) {
        // Push mid outside the rect
        const pushRight = b.x + b.width + padding;
        const pushLeft = b.x - padding;
        mid = (Math.abs(pushRight - mid) <= Math.abs(pushLeft - mid))
          ? pushRight
          : pushLeft;
      }
    } else {
      // The segment is horizontal at y = mid, spanning lo..hi in X.
      if (mid > b.y && mid < b.y + b.height && hi > b.x && lo < b.x + b.width) {
        const pushDown = b.y + b.height + padding;
        const pushUp = b.y - padding;
        mid = (Math.abs(pushDown - mid) <= Math.abs(pushUp - mid))
          ? pushDown
          : pushUp;
      }
    }
  }

  return mid;
}

/**
 * Compute a clearance coordinate for C-shape detour routing.
 *
 * Returns an x (if `isXAxis`) or y coordinate that is outside
 * both shapes' extents, choosing the shorter path.
 */
function computeClearance(
  isXAxis: boolean,
  sBounds?: Rect,
  eBounds?: Rect,
  exitStub: [number, number] = [0, 0],
  entryStub: [number, number] = [0, 0],
  padding: number = ROUTE_PADDING,
): number {
  const allBounds = [sBounds, eBounds].filter(Boolean) as Rect[];

  if (allBounds.length === 0) {
    // No bounds — use midpoint of stubs
    return isXAxis
      ? (exitStub[0] + entryStub[0]) / 2
      : (exitStub[1] + entryStub[1]) / 2;
  }

  if (isXAxis) {
    const leftEdge = Math.min(...allBounds.map(b => b.x)) - padding;
    const rightEdge = Math.max(...allBounds.map(b => b.x + b.width)) + padding;
    const avgStubX = (exitStub[0] + entryStub[0]) / 2;
    return Math.abs(avgStubX - leftEdge) < Math.abs(avgStubX - rightEdge)
      ? leftEdge
      : rightEdge;
  } else {
    const topEdge = Math.min(...allBounds.map(b => b.y)) - padding;
    const bottomEdge = Math.max(...allBounds.map(b => b.y + b.height)) + padding;
    const avgStubY = (exitStub[1] + entryStub[1]) / 2;
    return Math.abs(avgStubY - topEdge) < Math.abs(avgStubY - bottomEdge)
      ? topEdge
      : bottomEdge;
  }
}

/**
 * C-shape detour that routes around both shapes.
 *
 * Used when neither L-shape corner is safe for cross-axis routing.
 * Goes perpendicular to exit direction to clear both shapes, then
 * approaches the entry stub.
 */
function detourAroundBoth(
  exitStub: [number, number],
  entryStub: [number, number],
  isExitH: boolean,
  startBounds?: Rect,
  endBounds?: Rect,
  padding: number = ROUTE_PADDING,
): [number, number][] {
  if (isExitH) {
    // Exit horizontal → detour vertically around both shapes
    const clearanceY = computeClearance(
      false, startBounds, endBounds, exitStub, entryStub, padding,
    );
    return [
      [exitStub[0], clearanceY],
      [entryStub[0], clearanceY],
    ];
  } else {
    // Exit vertical → detour horizontally around both shapes
    const clearanceX = computeClearance(
      true, startBounds, endBounds, exitStub, entryStub, padding,
    );
    return [
      [clearanceX, exitStub[1]],
      [clearanceX, entryStub[1]],
    ];
  }
}

// ── Direction resolution ─────────────────────────────────────

/**
 * Resolve the exit direction from an anchor name.
 *
 * Falls back to a heuristic based on the relative position
 * of start and end points when no anchor is provided.
 */
function resolveExitDirection(
  anchor: string | undefined,
  start: { x: number; y: number },
  end: { x: number; y: number },
): ExitDirection {
  if (anchor) {
    const dir = anchorToDirection(anchor);
    if (dir) return dir;
  }
  // Heuristic: exit toward the target, preferring the longer axis
  return inferDirection(start, end);
}

/**
 * Resolve the entry direction for the end point.
 *
 * The entry direction is the opposite of how we approach the end point.
 */
function resolveEntryDirection(
  anchor: string | undefined,
  end: { x: number; y: number },
  start: { x: number; y: number },
): ExitDirection {
  if (anchor) {
    const dir = anchorToDirection(anchor);
    if (dir) return dir;
  }
  return inferDirection(end, start);
}

/** Map anchor name to exit direction. Returns null for unknown anchors. */
function anchorToDirection(anchor: string): ExitDirection | null {
  switch (anchor) {
    case 'top': return 'up';
    case 'bottom': return 'down';
    case 'left': return 'left';
    case 'right': return 'right';
    // Corner anchors — infer from the secondary direction
    case 'top-right': return 'right';
    case 'top-left': return 'left';
    case 'bottom-right': return 'right';
    case 'bottom-left': return 'left';
    default: return null;
  }
}

/** Infer direction from relative position, preferring the longer axis. */
function inferDirection(
  from: { x: number; y: number },
  to: { x: number; y: number },
): ExitDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'down' : 'up';
}
