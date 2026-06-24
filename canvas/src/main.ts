// Canvas webview entry (KAN-6). Connects to the extension's postMessage channel,
// announces readiness with `hello`, validates and renders incoming `diagram`
// models with Cytoscape, and offers built-in pan/zoom plus a fit/reset control.
// An invalid graph model surfaces a readable error instead of a blank canvas.
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import {
  PROTOCOL_VERSION,
  isDiagramMessage,
  isPatchMessage,
  type CanvasMessage,
  type CyElement,
  type CyStyle,
  type DiagramMessage,
  type PatchMessage,
} from '@canvas/shared';
import { validateGraphModel } from './graphModel';

cytoscape.use(dagre);

// Hierarchical layout that respects node sizes and avoids overlap — a good fit
// for the directed flow / dependency / state diagrams we render. dagre is a
// Cytoscape extension, so its options aren't in the typed LayoutOptions union.
function dagreLayout(fit: boolean): cytoscape.LayoutOptions {
  return {
    name: 'dagre',
    rankDir: 'TB',
    nodeSep: 45,
    edgeSep: 12,
    rankSep: 70,
    fit,
    padding: FIT_PADDING,
  } as unknown as cytoscape.LayoutOptions;
}

// Available when running inside a VS Code webview; undefined in a plain browser.
declare function acquireVsCodeApi():
  | { postMessage: (msg: unknown) => void }
  | undefined;

const vscode =
  typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;

const FIT_PADDING = 30;

// A clean, modern system-font stack (webview CSP blocks remote webfonts).
const FONT_FAMILY =
  "'Segoe UI Variable Display', 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

// Cytoscape 3.34 supports squircle corners and gradient fills, but
// @types/cytoscape doesn't type them yet — route those props through here.
const ext = (props: Record<string, unknown>): cytoscape.Css.Node =>
  props as unknown as cytoscape.Css.Node;

type Theme = 'dark' | 'light';

// Per-theme bits of the Cytoscape stylesheet. Node fills (and their darker-shade
// borders) read well on either background, so only the edge label changes.
const CY_THEME: Record<Theme, { edgeColor: string; edgeBackground: string }> = {
  dark: { edgeColor: '#cbbdf2', edgeBackground: '#161325' },
  light: { edgeColor: '#4b4564', edgeBackground: 'rgba(255, 255, 255, 0.92)' },
};

function buildStyle(theme: Theme): cytoscape.StylesheetStyle[] {
  const palette = CY_THEME[theme];
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        color: '#f6f4ff',
        'font-family': FONT_FAMILY,
        'font-size': 12,
        'font-weight': 600,
        width: 'label',
        height: 'label',
        padding: '16px',
        shape: 'round-rectangle',
        'text-wrap': 'wrap',
        'text-max-width': '160px',
        'background-color': '#8b5cf6',
        'border-width': 1,
        // Border is a couple shades darker than the fill (overridden per kind).
        'border-color': '#6d28d9',
        // Squircle corners + a soft two-tone gradient. (The soft glow is a CSS
        // drop-shadow on the canvas — Cytoscape has no blurred node shadow.)
        ...ext({
          'corner-radius': '18px',
          'background-fill': 'linear-gradient',
          'background-gradient-direction': 'to-bottom-right',
          'background-gradient-stop-colors': '#8b5cf6 #6d28d9',
          'background-gradient-stop-positions': '0% 100%',
        }),
      },
    },
    // Semantic node colours — cohesive violet palette (D3: canvas owns styling).
    {
      selector: 'node[kind = "entrypoint"]',
      style: ext({
        'background-color': '#d946ef',
        'background-gradient-stop-colors': '#e879f9 #a21caf',
        'border-color': '#a21caf',
      }),
    },
    {
      selector: 'node[kind = "service"]',
      style: ext({
        'background-color': '#8b5cf6',
        'background-gradient-stop-colors': '#a78bfa #6d28d9',
        'border-color': '#6d28d9',
      }),
    },
    {
      selector: 'node[kind = "module"]',
      style: ext({
        'background-color': '#6366f1',
        'background-gradient-stop-colors': '#818cf8 #4338ca',
        'border-color': '#4338ca',
      }),
    },
    {
      selector: 'node[kind = "datastore"]',
      style: ext({
        'background-color': '#06b6d4',
        'background-gradient-stop-colors': '#22d3ee #0e7490',
        'border-color': '#0e7490',
      }),
    },
    {
      selector: 'node[kind = "external"]',
      style: ext({
        'background-color': '#ec4899',
        'background-gradient-stop-colors': '#f472b6 #be185d',
        'border-color': '#be185d',
      }),
    },
    // Note / annotation (KAN-29) — a sticky-note look: amber, flat, left-aligned
    // wrapped text, wider, no connector arrow styling.
    {
      selector: 'node[kind = "note"]',
      style: ext({
        shape: 'round-rectangle',
        'background-fill': 'solid',
        'background-color': '#fde68a',
        'border-width': 1,
        'border-color': '#f59e0b',
        color: '#78350f',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'wrap',
        'text-max-width': '220px',
        'font-weight': 400,
        'font-size': 11,
        padding: '14px',
        'corner-radius': '8px',
      }),
    },
    {
      selector: 'edge',
      style: {
        label: 'data(label)',
        'curve-style': 'bezier',
        width: 2.5,
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#d946ef',
        'arrow-scale': 1.05,
        'font-family': FONT_FAMILY,
        'font-size': 9,
        color: palette.edgeColor,
        'text-background-color': palette.edgeBackground,
        'text-background-opacity': 0.9,
        'text-background-padding': '3px',
        'text-background-shape': 'roundrectangle',
        // Gradient edges (violet → fuchsia) to match the node palette.
        ...ext({
          'line-fill': 'linear-gradient',
          'line-gradient-stop-colors': '#8b5cf6 #d946ef',
          'line-gradient-stop-positions': '0% 100%',
          'line-cap': 'round',
        }),
      },
    },
    // Selected node (KAN-7) — a bright ring so the user sees what they clicked.
    {
      selector: 'node:selected',
      style: ext({
        'border-width': 4,
        'border-color': '#38bdf8',
        'overlay-color': '#38bdf8',
        'overlay-opacity': 0.12,
        'overlay-padding': 6,
      }),
    },
    // Selected edge (KAN-28) — thicker, bright line.
    {
      selector: 'edge:selected',
      style: ext({
        width: 5,
        'line-fill': 'solid',
        'line-color': '#38bdf8',
        'target-arrow-color': '#38bdf8',
        'overlay-color': '#38bdf8',
        'overlay-opacity': 0.12,
        'overlay-padding': 4,
      }),
    },
    // Curated style classes the CLI can set per element (KAN-26, option A).
    {
      selector: 'node.big',
      style: { padding: '28px', 'font-size': 16 },
    },
    {
      selector: 'node.small',
      style: { padding: '9px', 'font-size': 10 },
    },
    {
      selector: '.highlight',
      style: ext({
        'border-width': 4,
        'border-color': '#fde047',
        'line-color': '#fde047',
        'target-arrow-color': '#fde047',
        'line-fill': 'solid',
      }),
    },
    {
      selector: '.muted',
      style: { opacity: 0.4 },
    },
    // Dashed, arrowless leader line tying a note to what it explains (KAN-29).
    {
      selector: 'edge.annotation',
      style: ext({
        'line-style': 'dashed',
        'line-fill': 'solid',
        'line-color': '#f59e0b',
        width: 1.5,
        'target-arrow-shape': 'none',
        label: '',
      }),
    },
    {
      selector: 'node.danger',
      style: ext({
        'background-fill': 'solid',
        'background-color': '#ef4444',
        'border-color': '#b91c1c',
      }),
    },
    {
      selector: 'node.success',
      style: ext({
        'background-fill': 'solid',
        'background-color': '#22c55e',
        'border-color': '#15803d',
      }),
    },
    {
      selector: 'node.warning',
      style: ext({
        'background-fill': 'solid',
        'background-color': '#f59e0b',
        'border-color': '#b45309',
      }),
    },
    {
      selector: 'edge.danger',
      style: ext({ 'line-fill': 'solid', 'line-color': '#ef4444', 'target-arrow-color': '#ef4444' }),
    },
    {
      selector: 'edge.success',
      style: ext({ 'line-fill': 'solid', 'line-color': '#22c55e', 'target-arrow-color': '#22c55e' }),
    },
    {
      selector: 'edge.warning',
      style: ext({ 'line-fill': 'solid', 'line-color': '#f59e0b', 'target-arrow-color': '#f59e0b' }),
    },
  ];
}

// Resolve the initial theme: stored choice → system preference → dark.
function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('canvas-theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* localStorage may be unavailable */
  }
  const prefersLight =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-color-scheme: light)').matches;
  return prefersLight ? 'light' : 'dark';
}

let currentTheme: Theme = getInitialTheme();
document.documentElement.dataset.theme = currentTheme;

const cy = cytoscape({
  container: document.getElementById('cy'),
  elements: [],
  layout: dagreLayout(true),
  // Built-in pan/zoom (FR-3); zoom bounds keep large graphs legible.
  userPanningEnabled: true,
  userZoomingEnabled: true,
  minZoom: 0.1,
  maxZoom: 4,
  style: buildStyle(currentTheme),
});

const errorPanel = document.getElementById('error');
const errorList = document.getElementById('error-list');
const zoomInButton = document.getElementById('zoom-in-btn');
const zoomOutButton = document.getElementById('zoom-out-btn');
const resetButton = document.getElementById('reset-btn');
const titleEl = document.getElementById('diagram-title');

const ZOOM_FACTOR = 1.25;

// Smoothly zoom about the viewport centre so the focus point stays put. Gestures
// (drag to pan, wheel to zoom) keep working — these buttons are an alternative.
function zoomByFactor(factor: number): void {
  const centre = { x: cy.width() / 2, y: cy.height() / 2 };
  cy.animate({
    zoom: { level: cy.zoom() * factor, renderedPosition: centre },
    duration: 130,
    easing: 'ease-out',
  });
}

// Reset/fit: re-frame the whole graph at a legible zoom (FR-3).
function fitView(): void {
  if (cy.elements().empty()) return;
  cy.animate({
    fit: { eles: cy.elements(), padding: FIT_PADDING },
    duration: 200,
    easing: 'ease-out',
  });
}

zoomInButton?.addEventListener('click', () => zoomByFactor(ZOOM_FACTOR));
zoomOutButton?.addEventListener('click', () => zoomByFactor(1 / ZOOM_FACTOR));
resetButton?.addEventListener('click', fitView);

const themeToggle = document.getElementById('theme-toggle-btn');

// Re-theme the chrome (CSS vars via data-theme) and the Cytoscape stylesheet.
function applyTheme(theme: Theme): void {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  cy.style(buildStyle(theme)).update();
  const next = theme === 'dark' ? 'light' : 'dark';
  themeToggle?.setAttribute('aria-label', `Switch to ${next} theme`);
  themeToggle?.setAttribute('title', `Switch to ${next} theme`);
  try {
    localStorage.setItem('canvas-theme', theme);
  } catch {
    /* localStorage may be unavailable */
  }
}

themeToggle?.addEventListener('click', () =>
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark'),
);
// Sync the toggle's label with the initial theme set at startup.
applyTheme(currentTheme);

const TITLE_PLACEHOLDER = 'Untitled diagram';
let currentTitle = '';

// Show the diagram's title, or a muted placeholder when none is provided yet.
function setTitle(title: string | undefined): void {
  const text = title?.trim() ?? '';
  currentTitle = text;
  if (titleEl) {
    titleEl.textContent = text || TITLE_PLACEHOLDER;
    titleEl.classList.toggle('is-placeholder', text.length === 0);
  }
  document.title = text || 'Canvas for Copilot';
}

// Inline rename: the title bar is contenteditable; commit on Enter/blur, cancel
// on Escape. Editing is local to the canvas (the protocol has no title message).
if (titleEl) {
  titleEl.addEventListener('focus', () => {
    if (titleEl.classList.contains('is-placeholder')) {
      titleEl.textContent = '';
      titleEl.classList.remove('is-placeholder');
    }
  });
  titleEl.addEventListener('blur', () => setTitle(titleEl.textContent ?? ''));
  titleEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      titleEl.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setTitle(currentTitle);
      titleEl.blur();
    }
  });
}

// Start with the placeholder until a diagram with a title arrives.
setTitle(undefined);

function showError(messages: string[]): void {
  if (!errorPanel || !errorList) return;
  errorList.replaceChildren(
    ...messages.map((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }),
  );
  errorPanel.hidden = false;
}

function clearError(): void {
  if (errorPanel) errorPanel.hidden = true;
}

// Apply an in-place patch. Pure edits (relabel/annotate/remove) preserve the view
// exactly — no layout runs. Structural ADDS re-run the dagre layout (without
// re-fitting, so zoom/pan are kept) so new nodes are placed without overlap (KAN-25).
function handlePatch(msg: PatchMessage): void {
  cy.batch(() => {
    // Remove first so an add can reuse an id.
    for (const id of msg.remove) {
      cy.getElementById(id).remove();
    }
    // Merge data into existing elements in place (preserves position), plus any
    // classes / inline style (KAN-26).
    for (const element of msg.update) {
      const id = element.data.id;
      if (typeof id !== 'string') continue;
      const target = cy.getElementById(id);
      if (target.empty()) continue;
      target.data({ ...element.data });
      if (element.classes) target.addClass(element.classes);
      const style = mapStyle(element.style, target.isEdge());
      if (style) target.style(style as cytoscape.Css.Node);
    }
    if (msg.add.length > 0) {
      cy.add(msg.add.map(toElementDef));
    }
  });

  // Only re-layout when nodes were added (avoids overlap). `fit: false` keeps the
  // current zoom/pan. Pure relabels never reach here, so they don't move.
  const addedNode = msg.add.some(
    (el) => el.data.source === undefined && el.data.target === undefined,
  );
  if (addedNode) {
    cy.layout(dagreLayout(false)).run();
  }
  updateLegend();
}

// Map the whitelisted inline style subset (KAN-26, option B) to Cytoscape
// per-element style. Only color / fontSize / size are honoured.
function mapStyle(
  style: CyStyle | undefined,
  isEdge: boolean,
): Record<string, unknown> | undefined {
  if (!style) return undefined;
  const s: Record<string, unknown> = {};
  if (style.color) {
    if (isEdge) {
      s['line-fill'] = 'solid';
      s['line-color'] = style.color;
      s['target-arrow-color'] = style.color;
    } else {
      s['background-fill'] = 'solid';
      s['background-color'] = style.color;
      s['border-color'] = style.color;
    }
  }
  if (typeof style.fontSize === 'number') s['font-size'] = style.fontSize;
  if (!isEdge && typeof style.size === 'number') s['padding'] = style.size;
  return Object.keys(s).length > 0 ? s : undefined;
}

function isEdgeElement(el: CyElement): boolean {
  return el.data.source !== undefined || el.data.target !== undefined;
}

// Convert a protocol CyElement to a Cytoscape element definition, carrying
// classes and the mapped inline style.
function toElementDef(el: CyElement): cytoscape.ElementDefinition {
  const def: cytoscape.ElementDefinition = {
    data: el.data as cytoscape.ElementDefinition['data'],
  };
  if (el.classes) def.classes = el.classes;
  const style = mapStyle(el.style, isEdgeElement(el));
  if (style) def.style = style as cytoscape.Css.Node;
  return def;
}

function render(elements: CyElement[]): void {
  cy.elements().remove();
  cy.add(elements.map(toElementDef));
  cy.layout(dagreLayout(true)).run();
  cy.fit(undefined, FIT_PADDING);
}

// Semantic colour legend (KAN-30) — colours encode meaning, and this panel says
// what. Swatch colours mirror the per-kind / status styles in buildStyle().
interface LegendEntry {
  key: string;
  label: string;
  color: string;
  isEdge?: boolean;
}

const KIND_LEGEND: LegendEntry[] = [
  { key: 'entrypoint', label: 'Entry point', color: '#d946ef' },
  { key: 'service', label: 'Service / process', color: '#8b5cf6' },
  { key: 'module', label: 'Module', color: '#6366f1' },
  { key: 'datastore', label: 'Data store', color: '#06b6d4' },
  { key: 'external', label: 'External', color: '#ec4899' },
  { key: 'note', label: 'Note', color: '#fde68a' },
];

const STATUS_LEGEND: LegendEntry[] = [
  { key: 'danger', label: 'Error / danger', color: '#ef4444' },
  { key: 'success', label: 'Success', color: '#22c55e' },
  { key: 'warning', label: 'Warning', color: '#f59e0b' },
];

const legendEl = document.getElementById('legend');
const legendRows = document.getElementById('legend-rows');
const legendToggle = document.getElementById('legend-toggle-btn');
let legendCollapsed = false;

function legendRow(entry: LegendEntry): HTMLElement {
  const row = document.createElement('div');
  row.className = 'legend-row';
  const swatch = document.createElement('span');
  swatch.className = entry.isEdge ? 'legend-swatch is-edge' : 'legend-swatch';
  if (entry.isEdge) swatch.style.color = entry.color;
  else swatch.style.background = entry.color;
  const text = document.createElement('span');
  text.textContent = entry.label;
  row.append(swatch, text);
  return row;
}

// Rebuild the legend from the kinds / status classes actually present, so it only
// shows colours that mean something in the current diagram.
function updateLegend(): void {
  if (!legendEl || !legendRows) return;
  const kinds = new Set<string>();
  cy.nodes().forEach((n) => {
    const k = n.data('kind') as unknown;
    if (typeof k === 'string') kinds.add(k);
  });
  const statuses = new Set<string>();
  cy.elements().forEach((el) => {
    for (const c of el.classes()) statuses.add(c);
  });

  const entries = [
    ...KIND_LEGEND.filter((e) => kinds.has(e.key)),
    ...STATUS_LEGEND.filter((e) => statuses.has(e.key)),
  ];
  legendRows.replaceChildren(...entries.map(legendRow));
  legendEl.hidden = legendCollapsed || entries.length === 0;
}

legendToggle?.addEventListener('click', () => {
  legendCollapsed = !legendCollapsed;
  updateLegend();
});

// Validate before rendering so a bad model shows an error, not a blank canvas
// (FR-1, TC-2). The render itself is guarded too, in case Cytoscape rejects
// input the validator didn't anticipate.
let currentDiagramId: string | undefined;

function handleDiagram(msg: DiagramMessage): void {
  const result = validateGraphModel(msg.elements);
  if (!result.ok) {
    showError(result.errors);
    return;
  }
  currentDiagramId = msg.diagramId;
  setTitle(msg.title);
  try {
    render(result.elements);
    clearError();
    updateLegend();
  } catch (err) {
    showError([`Cytoscape could not render this model: ${String(err)}`]);
  }
}

// Selection (KAN-7): tapping a node selects it and tells the extension which node
// is selected, so the CLI can act on "this"/"the selected node". Tapping the
// background clears the selection.
function emitSelection(nodeIds: string[]): void {
  vscode?.postMessage({
    type: 'node_selected',
    sessionId: 'webview',
    diagramId: currentDiagramId ?? '',
    nodeIds,
  });
}

cy.on('tap', 'node', (evt) => {
  const node = evt.target as cytoscape.NodeSingular;
  cy.elements().unselect();
  node.select();
  emitSelection([node.id()]);
});

cy.on('tap', 'edge', (evt) => {
  const edge = evt.target as cytoscape.EdgeSingular;
  cy.elements().unselect();
  edge.select();
  emitSelection([edge.id()]);
});

cy.on('tap', (evt) => {
  if (evt.target === cy) {
    cy.elements().unselect();
    emitSelection([]);
  }
});

window.addEventListener('message', (event: MessageEvent<CanvasMessage>) => {
  const msg = event.data;
  if (isDiagramMessage(msg)) handleDiagram(msg);
  else if (isPatchMessage(msg)) handlePatch(msg);
});
vscode?.postMessage({
  type: 'hello',
  client: 'webview',
  protocol: PROTOCOL_VERSION,
});
