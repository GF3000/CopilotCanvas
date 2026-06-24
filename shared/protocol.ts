// Canonical canvas message protocol + state model (KAN-4).
// Single source of truth imported by /server, /canvas, and /extension.
//
// APPEND-ONLY & PR-REVIEWED — never edit unilaterally. The ratified design
// decisions (D1–D13) behind these shapes live in docs/DATA_MODEL.md
// ("Protocol decisions"). Keep this file and that doc in sync.

/** Protocol version negotiated in the `hello` handshake (D11). */
export const PROTOCOL_VERSION = 1 as const;

/* ─── Core entities ─────────────────────────────────────────────────────── */

/**
 * A node or edge in the Cytoscape graph model.
 *
 * D4: minimal subset — NOT Cytoscape's full `ElementDefinition`, to keep the
 * contract decoupled from any Cytoscape version.
 * D5: nodes always carry `data.id`; edges carry `data.source`/`data.target` and
 * may omit an id.
 * D2/D3: no positions (x/y); the canvas auto-layouts and owns the base stylesheet.
 * The server sends semantic hints (`kind`/`classes`) and may set a small whitelisted
 * `style` subset (D3 relaxed by D14) — never raw Cytoscape style objects.
 */
export interface CyElement {
  data: {
    /** Node id (required for nodes, unique within a diagram); optional edge id. */
    id?: string;
    label?: string;
    /** Edge only: source node id. */
    source?: string;
    /** Edge only: target node id. */
    target?: string;
    /** Semantic hint resolved by the canvas stylesheet. */
    kind?: NodeKind;
  };
  /** Space-separated style classes resolved by the canvas stylesheet (D3). */
  classes?: string;
  /** Whitelisted per-element style overrides applied over kind/class defaults (D14). */
  style?: CyStyle;
  /** Code location(s) this element maps to, for "jump to code" (D16). */
  codeRefs?: CodeRef[];
}

/**
 * Safe, whitelisted style subset the model may set per element (D14). Applied by
 * the canvas over the kind/class defaults. NOT raw Cytoscape style — only these.
 */
export interface CyStyle {
  /** CSS colour (node fill / edge line). */
  color?: string;
  /** Label font size in px. */
  fontSize?: number;
  /** Node size in px (label padding); ignored for edges. */
  size?: number;
}

/** Semantic node category — drives canvas styling, not layout. */
export type NodeKind =
  | 'module'
  | 'service'
  | 'entrypoint'
  | 'datastore'
  | 'external'
  | 'note';

/** A concrete code location a node maps to (advanced tier). */
export interface CodeRef {
  /** Repo-relative file path. */
  path: string;
  range?: { startLine: number; endLine: number };
  symbol?: string;
}

/** Derived per-node index used for selection/expand and code mapping. */
export interface NodeMeta {
  /** Stable node id (selection key). */
  nodeId: string;
  label: string;
  kind?: NodeKind;
  codeRefs?: CodeRef[];
}

/** Full canvas state for one (re)generation of a diagram. */
export interface DiagramState {
  /** New id per full (re)generation. */
  diagramId: string;
  /** The Cytoscape graph model (nodes + edges). */
  elements: CyElement[];
  /** Human label, e.g. "Auth flow". */
  title: string;
  /** Derived index for selection/expand. */
  nodes: NodeMeta[];
  /** Increments on patch/regeneration. */
  version: number;
}

/** A set of selected nodes within a diagram. Selection key = (diagramId, nodeId). */
export interface Selection {
  diagramId: string;
  nodeIds: string[];
}

/* ─── Closed enums (D8) — string-literal unions catch typos at compile time ─ */

/** A user instruction tied to the current selection. */
export type InteractionAction =
  | 'explain'
  | 'expand'
  | 'show_callers'
  | 'modify'
  | 'freeform';

/** How the canvas should focus/annotate highlighted nodes. */
export type HighlightStyle = 'callers' | 'selected' | 'path' | 'faded';

/** Transient canvas status indicator. */
export type StatusState = 'thinking' | 'idle' | 'error';

/* ─── Message envelope base (D1, D9, D12) ───────────────────────────────── */
//
// D1: these types describe message PAYLOADS only. The VS Code extension owns the
//     JSON-RPC envelope (method/id/params) over postMessage.
// D9: `sessionId` is required on every message; `msgId` is optional and set only
//     on request/response style messages (ack/error echo it).
// D12: `type` discriminant values are snake_case; field names are camelCase.

interface BaseMessage {
  sessionId: string;
  msgId?: string;
}

/* ─── S→C messages (server/model → canvas) ──────────────────────────────── */

/** Full render / replace. */
export interface DiagramMessage extends BaseMessage {
  type: 'diagram';
  diagramId: string;
  title: string;
  elements: CyElement[];
  version: number;
}

/** Incremental update applied in place via cy.add / cy.remove / cy.data (D6). */
export interface PatchMessage extends BaseMessage {
  type: 'patch';
  diagramId: string;
  version: number;
  /** Elements to add. */
  add: CyElement[];
  /** Node/edge ids to remove. */
  remove: string[];
  /**
   * Elements whose `data` should be merged into an existing node/edge with the
   * same `data.id`, in place — preserving position and the current view. Used to
   * edit a diagram (e.g. relabel nodes) without re-rendering or re-laying out.
   */
  update: CyElement[];
}

/** Focus/annotate nodes (e.g. show callers). */
export interface HighlightMessage extends BaseMessage {
  type: 'highlight';
  nodeIds: string[];
  style: HighlightStyle;
}

/** Transient feedback for the canvas. */
export interface StatusMessage extends BaseMessage {
  type: 'status';
  state: StatusState;
  text?: string;
}

/* ─── C→S messages (canvas → server/model) ──────────────────────────────── */

/** Handshake on connect. */
export interface HelloMessage extends BaseMessage {
  type: 'hello';
  client: string;
  protocol: number;
}

/** The user selected one or more nodes. */
export interface NodeSelectedMessage extends BaseMessage {
  type: 'node_selected';
  diagramId: string;
  nodeIds: string[];
}

/** A user instruction tied to the current selection. */
export interface InteractionMessage extends BaseMessage {
  type: 'interaction';
  diagramId: string;
  nodeIds: string[];
  action: InteractionAction;
  /** Free text; for `modify`/`freeform` this is the instruction. */
  text?: string;
}

/** The user edited the diagram directly (advanced). */
export interface DiagramEditedMessage extends BaseMessage {
  type: 'diagram_edited';
  diagramId: string;
  elements: CyElement[];
}

/** Acknowledge a prior message (echoes its msgId, D9). */
export interface AckMessage extends BaseMessage {
  type: 'ack';
}

/** Report an error (echoes the originating msgId, D9/D10). */
export interface ErrorMessage extends BaseMessage {
  type: 'error';
  message: string;
  code?: string;
}

/* ─── Unions & helpers (D13) ────────────────────────────────────────────── */

export type ServerToCanvasMessage =
  | DiagramMessage
  | PatchMessage
  | HighlightMessage
  | StatusMessage;

export type CanvasToServerMessage =
  | HelloMessage
  | NodeSelectedMessage
  | InteractionMessage
  | DiagramEditedMessage
  | AckMessage
  | ErrorMessage;

export type CanvasMessage = ServerToCanvasMessage | CanvasToServerMessage;

export type CanvasMessageType = CanvasMessage['type'];

/* Per-message type guards — handy for the extension relay. */
export const isDiagramMessage = (m: CanvasMessage): m is DiagramMessage =>
  m.type === 'diagram';
export const isPatchMessage = (m: CanvasMessage): m is PatchMessage =>
  m.type === 'patch';
export const isHighlightMessage = (m: CanvasMessage): m is HighlightMessage =>
  m.type === 'highlight';
export const isStatusMessage = (m: CanvasMessage): m is StatusMessage =>
  m.type === 'status';
export const isHelloMessage = (m: CanvasMessage): m is HelloMessage =>
  m.type === 'hello';
export const isNodeSelectedMessage = (m: CanvasMessage): m is NodeSelectedMessage =>
  m.type === 'node_selected';
export const isInteractionMessage = (m: CanvasMessage): m is InteractionMessage =>
  m.type === 'interaction';
export const isDiagramEditedMessage = (m: CanvasMessage): m is DiagramEditedMessage =>
  m.type === 'diagram_edited';
export const isAckMessage = (m: CanvasMessage): m is AckMessage =>
  m.type === 'ack';
export const isErrorMessage = (m: CanvasMessage): m is ErrorMessage =>
  m.type === 'error';

/**
 * Exhaustiveness helper. Call in the `default` branch of a `switch (m.type)` so
 * adding a new message variant without handling it fails to compile.
 */
export function assertNever(x: never): never {
  throw new Error('Unhandled CanvasMessage variant: ' + JSON.stringify(x));
}
