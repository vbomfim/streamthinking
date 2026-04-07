/**
 * Orthogonal (right-angle) routing for arrow connectors.
 *
 * Computes a path between two points using only horizontal and vertical
 * segments. Supports L-shape and Z-shape routing based on anchor exit
 * direction. Adds padding to avoid overlapping source/target shapes.
 *
 * @module
 */

/** Padding in world units to keep routes clear of shapes. */
const ROUTE_PADDING = 20;

/** Horizontal or vertical exit direction derived from an anchor. */
type ExitDirection = 'up' | 'down' | 'left' | 'right';

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
  startBounds?: { x: number; y: number; width: number; height: number },
  endBounds?: { x: number; y: number; width: number; height: number },
): [number, number][] {
  // Same point — return a degenerate route
  if (start.x === end.x && start.y === end.y) {
    return [[start.x, start.y], [end.x, end.y]];
  }

  // Axis-aligned — return straight line
  if (start.x === end.x || start.y === end.y) {
    return [[start.x, start.y], [end.x, end.y]];
  }

  const startExit = resolveExitDirection(startAnchor, start, end);
  const endEntry = resolveEntryDirection(endAnchor, end, start);

  const padding = ROUTE_PADDING;

  // Compute route based on exit/entry direction combination
  return routeWithDirections(start, end, startExit, endEntry, padding, startBounds, endBounds);
}

/**
 * Route between two points given explicit exit and entry directions.
 *
 * Uses L-shape when possible (2 segments), falls back to Z-shape
 * (3 segments) when the exit direction points away from the target.
 */
function routeWithDirections(
  start: { x: number; y: number },
  end: { x: number; y: number },
  startExit: ExitDirection,
  endEntry: ExitDirection,
  padding: number,
  startBounds?: { x: number; y: number; width: number; height: number },
  endBounds?: { x: number; y: number; width: number; height: number },
): [number, number][] {
  const isStartHorizontal = startExit === 'left' || startExit === 'right';
  const isEndHorizontal = endEntry === 'left' || endEntry === 'right';

  // Case 1: horizontal exit → vertical entry (L-shape)
  if (isStartHorizontal && !isEndHorizontal) {
    return routeLShape(start, end, startExit, padding, startBounds);
  }

  // Case 2: vertical exit → horizontal entry (L-shape, transposed)
  if (!isStartHorizontal && isEndHorizontal) {
    return routeLShapeVerticalFirst(start, end, startExit, padding, startBounds);
  }

  // Case 3: both horizontal — Z-shape with horizontal middle segment
  if (isStartHorizontal && isEndHorizontal) {
    return routeZShapeHorizontal(start, end, startExit, endEntry, padding, startBounds, endBounds);
  }

  // Case 4: both vertical — Z-shape with vertical middle segment
  return routeZShapeVertical(start, end, startExit, endEntry, padding, startBounds, endBounds);
}

/**
 * L-shape route: horizontal first, then vertical.
 *
 * Start → go horizontal to end.x → go vertical to end.
 */
function routeLShape(
  start: { x: number; y: number },
  end: { x: number; y: number },
  startExit: ExitDirection,
  padding: number,
  startBounds?: { x: number; y: number; width: number; height: number },
): [number, number][] {
  // Determine the horizontal exit point with padding
  let exitX = end.x;

  // If exit direction opposes the target, add padding jog
  if (startExit === 'right' && end.x < start.x) {
    exitX = (startBounds ? startBounds.x + startBounds.width : start.x) + padding;
  } else if (startExit === 'left' && end.x > start.x) {
    exitX = (startBounds ? startBounds.x : start.x) - padding;
  }

  // Simple L: horizontal to exitX, then vertical to end
  if (exitX === end.x) {
    return [
      [start.x, start.y],
      [end.x, start.y],
      [end.x, end.y],
    ];
  }

  // Extended L with padding: horizontal to exitX, vertical to end.y, horizontal to end.x
  return [
    [start.x, start.y],
    [exitX, start.y],
    [exitX, end.y],
    [end.x, end.y],
  ];
}

/**
 * L-shape route: vertical first, then horizontal.
 *
 * Start → go vertical to end.y → go horizontal to end.
 */
function routeLShapeVerticalFirst(
  start: { x: number; y: number },
  end: { x: number; y: number },
  startExit: ExitDirection,
  padding: number,
  startBounds?: { x: number; y: number; width: number; height: number },
): [number, number][] {
  let exitY = end.y;

  if (startExit === 'down' && end.y < start.y) {
    exitY = (startBounds ? startBounds.y + startBounds.height : start.y) + padding;
  } else if (startExit === 'up' && end.y > start.y) {
    exitY = (startBounds ? startBounds.y : start.y) - padding;
  }

  if (exitY === end.y) {
    return [
      [start.x, start.y],
      [start.x, end.y],
      [end.x, end.y],
    ];
  }

  return [
    [start.x, start.y],
    [start.x, exitY],
    [end.x, exitY],
    [end.x, end.y],
  ];
}

/**
 * Z-shape route: both exits are horizontal.
 *
 * Start → horizontal → vertical → horizontal → end.
 * The middle vertical segment runs at the midpoint between the shapes.
 */
function routeZShapeHorizontal(
  start: { x: number; y: number },
  end: { x: number; y: number },
  startExit: ExitDirection,
  _endEntry: ExitDirection,
  padding: number,
  startBounds?: { x: number; y: number; width: number; height: number },
  endBounds?: { x: number; y: number; width: number; height: number },
): [number, number][] {
  // Compute the midpoint X for the vertical segment
  let midX: number;

  if (startExit === 'right' && end.x > start.x) {
    // Normal flow: mid between start right edge and end left edge
    const startRight = startBounds ? startBounds.x + startBounds.width : start.x;
    const endLeft = endBounds ? endBounds.x : end.x;
    midX = (startRight + endLeft) / 2;
  } else if (startExit === 'left' && end.x < start.x) {
    const startLeft = startBounds ? startBounds.x : start.x;
    const endRight = endBounds ? endBounds.x + endBounds.width : end.x;
    midX = (startLeft + endRight) / 2;
  } else {
    // Exit direction is opposite to target — go past shape with padding
    if (startExit === 'right') {
      midX = Math.max(
        (startBounds ? startBounds.x + startBounds.width : start.x) + padding,
        (endBounds ? endBounds.x + endBounds.width : end.x) + padding,
      );
    } else {
      midX = Math.min(
        (startBounds ? startBounds.x : start.x) - padding,
        (endBounds ? endBounds.x : end.x) - padding,
      );
    }
  }

  return [
    [start.x, start.y],
    [midX, start.y],
    [midX, end.y],
    [end.x, end.y],
  ];
}

/**
 * Z-shape route: both exits are vertical.
 *
 * Start → vertical → horizontal → vertical → end.
 * The middle horizontal segment runs at the midpoint between the shapes.
 */
function routeZShapeVertical(
  start: { x: number; y: number },
  end: { x: number; y: number },
  startExit: ExitDirection,
  _endEntry: ExitDirection,
  padding: number,
  startBounds?: { x: number; y: number; width: number; height: number },
  endBounds?: { x: number; y: number; width: number; height: number },
): [number, number][] {
  let midY: number;

  if (startExit === 'down' && end.y > start.y) {
    const startBottom = startBounds ? startBounds.y + startBounds.height : start.y;
    const endTop = endBounds ? endBounds.y : end.y;
    midY = (startBottom + endTop) / 2;
  } else if (startExit === 'up' && end.y < start.y) {
    const startTop = startBounds ? startBounds.y : start.y;
    const endBottom = endBounds ? endBounds.y + endBounds.height : end.y;
    midY = (startTop + endBottom) / 2;
  } else {
    if (startExit === 'down') {
      midY = Math.max(
        (startBounds ? startBounds.y + startBounds.height : start.y) + padding,
        (endBounds ? endBounds.y + endBounds.height : end.y) + padding,
      );
    } else {
      midY = Math.min(
        (startBounds ? startBounds.y : start.y) - padding,
        (endBounds ? endBounds.y : end.y) - padding,
      );
    }
  }

  return [
    [start.x, start.y],
    [start.x, midY],
    [end.x, midY],
    [end.x, end.y],
  ];
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
