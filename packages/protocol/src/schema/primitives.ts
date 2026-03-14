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

/** Data for an arrow expression with optional arrowheads. */
export interface ArrowData {
  kind: 'arrow';
  /** Array of [x, y] coordinate pairs forming the arrow path. */
  points: [number, number][];
  /** Whether to render an arrowhead at the start. */
  startArrowhead?: boolean;
  /** Whether to render an arrowhead at the end. */
  endArrowhead?: boolean;
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
  | ImageData;
