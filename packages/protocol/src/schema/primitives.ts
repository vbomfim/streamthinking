/**
 * Primitive element data types for InfiniCanvas Protocol.
 *
 * Each type represents the data payload for a single primitive expression kind.
 *
 * @module
 */

/** Data for a rectangle expression. */
export interface RectangleData {
  kind: 'rectangle';
  label?: string;
}

/** Data for an ellipse expression. */
export interface EllipseData {
  kind: 'ellipse';
  label?: string;
}

/** Data for a diamond expression. */
export interface DiamondData {
  kind: 'diamond';
  label?: string;
}

/** Data for a line expression defined by a series of points. */
export interface LineData {
  kind: 'line';
  /** Array of [x, y] coordinate pairs forming the line. */
  points: [number, number][];
}

/** Anchor position on a shape's edge for arrow binding. */
export type ArrowAnchor = 'center' | 'top' | 'right' | 'bottom' | 'left'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'auto';

/** Binding that connects an arrow endpoint to a shape. */
export interface ArrowBinding {
  /** ID of the bound shape expression. */
  expressionId: string;
  /** Which edge of the shape the arrow attaches to. */
  anchor: ArrowAnchor;
  /** Position along the edge (0-1). 0.5 = center. */
  ratio?: number;
}

/** Arrowhead tip style. */
export type ArrowheadType = 'triangle' | 'chevron' | 'diamond' | 'circle' | 'none';

/** Data for an arrow expression with optional arrowheads. */
export interface ArrowData {
  kind: 'arrow';
  /** Array of [x, y] coordinate pairs forming the arrow path. */
  points: [number, number][];
  /** Arrowhead style at the start ('none' = no arrowhead). */
  startArrowhead?: ArrowheadType | boolean;
  /** Arrowhead style at the end ('none' = no arrowhead). */
  endArrowhead?: ArrowheadType | boolean;
  /** Binding for the start endpoint to a shape. */
  startBinding?: ArrowBinding;
  /** Binding for the end endpoint to a shape. */
  endBinding?: ArrowBinding;
  /** Optional text label rendered at the arrow midpoint. */
  label?: string;
  /** Routing mode: 'straight' (default) or 'orthogonal' (right-angle segments). */
  routing?: RoutingMode;
}

/** Data for a freehand drawing expression. */
export interface FreehandData {
  kind: 'freehand';
  /** Array of [x, y, pressure] tuples capturing the stroke. */
  points: [number, number, number][];
}

/** Data for a text expression. */
export interface TextData {
  kind: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  textAlign: 'left' | 'center' | 'right';
}

/** Data for a sticky note expression. */
export interface StickyNoteData {
  kind: 'sticky-note';
  text: string;
  /** Background color of the sticky note. */
  color: string;
}

/** Data for an image expression. */
export interface ImageData {
  kind: 'image';
  /** Image source URL or data URI. */
  src: string;
  /** Alternative text description. */
  alt?: string;
}

/** Data for a stencil expression (icon from the stencil catalog). */
export interface StencilData {
  kind: 'stencil';
  /** ID of the stencil entry in the catalog. */
  stencilId: string;
  /** Category grouping for the stencil (e.g. 'network', 'kubernetes'). */
  category: string;
  /** Optional display label rendered below the icon. */
  label?: string;
  /** Where to render the label relative to the stencil icon. */
  labelPosition?: 'below' | 'top-left' | 'top-center' | 'center';
  /** Explicit font size for the label (world units, no auto-scaling). */
  labelFontSize?: number;
}

/** Routing mode for arrow connectors. */
export type RoutingMode = 'straight' | 'orthogonal';

/** Union of all primitive expression data types. */
export type PrimitiveData =
  | RectangleData
  | EllipseData
  | DiamondData
  | LineData
  | ArrowData
  | FreehandData
  | TextData
  | StickyNoteData
  | ImageData
  | StencilData;
