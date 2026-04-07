/**
 * InfiniCanvas Protocol (ICP) — public API.
 *
 * Re-exports all types, schemas, and builders needed by consumers.
 *
 * @module
 */

// ── Schema types ───────────────────────────────────────────

export type { AuthorInfo, ExpressionStyle } from './schema/metadata.js';
export { DEFAULT_EXPRESSION_STYLE } from './schema/metadata.js';

export type {
  RectangleData,
  EllipseData,
  DiamondData,
  LineData,
  ArrowData,
  ArrowBinding,
  ArrowAnchor,
  ArrowheadType,
  RoutingMode,
  FreehandData,
  TextData,
  StickyNoteData,
  ImageData,
  StencilData,
  ContainerData,
  PrimitiveData,
} from './schema/primitives.js';

export type {
  FlowNode,
  FlowEdge,
  FlowchartData,
  Participant,
  Message,
  SequenceDiagramData,
  WireframeComponent,
  WireframeData,
  ReasoningStep,
  ReasoningChainData,
  RoadmapItem,
  RoadmapPhase,
  RoadmapData,
  MindMapBranch,
  MindMapData,
  KanbanCard,
  KanbanColumn,
  KanbanData,
  DecisionOption,
  DecisionTreeData,
  CollabObject,
  CollabLink,
  CollaborationDiagramData,
  SlideData,
  CodeBlockData,
  TableData,
  CompositeData,
} from './schema/composites.js';

export type {
  CommentData,
  CalloutData,
  HighlightData,
  MarkerData,
  AnnotationData,
} from './schema/annotations.js';

export type {
  ExpressionData,
  ExpressionKind,
  VisualExpression,
  Layer,
} from './schema/expressions.js';

export { DEFAULT_LAYER_ID } from './schema/expressions.js';

export type {
  OperationType,
  CreatePayload,
  UpdatePayload,
  DeletePayload,
  MovePayload,
  TransformPayload,
  GroupPayload,
  UngroupPayload,
  AnnotatePayload,
  MorphPayload,
  LockPayload,
  UnlockPayload,
  StylePayload,
  ReorderPayload,
  SnapshotPayload,
  QueryPayload,
  OperationPayload,
  ProtocolOperation,
} from './schema/operations.js';

// ── Zod validation schemas ─────────────────────────────────

export {
  authorInfoSchema,
  humanAuthorSchema,
  agentAuthorSchema,
  expressionStyleSchema,
  rectangleDataSchema,
  ellipseDataSchema,
  diamondDataSchema,
  lineDataSchema,
  arrowDataSchema,
  freehandDataSchema,
  textDataSchema,
  stickyNoteDataSchema,
  imageDataSchema,
  stencilDataSchema,
  containerDataSchema,
  flowchartDataSchema,
  sequenceDiagramDataSchema,
  wireframeDataSchema,
  reasoningChainDataSchema,
  roadmapDataSchema,
  mindMapDataSchema,
  kanbanDataSchema,
  decisionTreeDataSchema,
  collaborationDiagramDataSchema,
  slideDataSchema,
  codeBlockDataSchema,
  tableDataSchema,
  commentDataSchema,
  calloutDataSchema,
  highlightDataSchema,
  markerDataSchema,
  expressionDataSchema,
  visualExpressionSchema,
  createPayloadSchema,
  updatePayloadSchema,
  deletePayloadSchema,
  movePayloadSchema,
  transformPayloadSchema,
  groupPayloadSchema,
  ungroupPayloadSchema,
  annotatePayloadSchema,
  morphPayloadSchema,
  lockPayloadSchema,
  unlockPayloadSchema,
  stylePayloadSchema,
  reorderPayloadSchema,
  snapshotPayloadSchema,
  queryPayloadSchema,
  operationPayloadSchema,
  protocolOperationSchema,
  withMaxDepth,
} from './validation/schemas.js';

// ── Builders ───────────────────────────────────────────────

export {
  ExpressionBuilder,
  ShapeBuilder,
  FlowchartBuilder,
  ReasoningChainBuilder,
  TextBuilder,
  StickyNoteBuilder,
} from './builders/expressionBuilder.js';

// ── draw.io serializer ────────────────────────────────────

export {
  expressionsToDrawio,
  drawioToExpressions,
} from './drawio/serializer.js';

// ── draw.io stencil parser ───────────────────────────────

export type {
  ConnectionPoint,
  DrawioShape,
  DrawioStencilLibrary,
} from './drawio/stencilParser.js';

export {
  shapeToSvg,
  parseStencilLibrary,
} from './drawio/stencilParser.js';
