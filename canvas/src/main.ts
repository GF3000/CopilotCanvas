// Canvas webview entry (KAN-6). Connects to the extension's postMessage channel,
// announces readiness with `hello`, validates and renders incoming `diagram`
// models with Cytoscape, and offers built-in pan/zoom plus a fit/reset control.
// An invalid graph model surfaces a readable error instead of a blank canvas.
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import svg from 'cytoscape-svg';
import {
  PROTOCOL_VERSION,
  isDiagramMessage,
  isPatchMessage,
  type CanvasMessage,
  type CodeRef,
  type CyElement,
  type CyStyle,
  type DiagramMessage,
  type ImageFormat,
  type PatchMessage,
} from '@canvas/shared';
import { validateGraphModel } from './graphModel';
import { closedNeighbourhood, countNodes, nodeLabel } from './scope';

cytoscape.use(dagre);
cytoscape.use(svg);

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

interface NodeColor {
  name: string;
  fill: string;
  /** Two space-separated gradient stops, light → dark. */
  stops: string;
  border: string;
}

// Palette offered in the node context menu (right-click → recolour).
const NODE_COLORS: NodeColor[] = [
  { name: 'Violet', fill: '#8b5cf6', stops: '#a78bfa #6d28d9', border: '#6d28d9' },
  { name: 'Fuchsia', fill: '#d946ef', stops: '#e879f9 #a21caf', border: '#a21caf' },
  { name: 'Indigo', fill: '#6366f1', stops: '#818cf8 #4338ca', border: '#4338ca' },
  { name: 'Blue', fill: '#3b82f6', stops: '#60a5fa #1d4ed8', border: '#1d4ed8' },
  { name: 'Cyan', fill: '#06b6d4', stops: '#22d3ee #0e7490', border: '#0e7490' },
  { name: 'Emerald', fill: '#10b981', stops: '#34d399 #047857', border: '#047857' },
  { name: 'Amber', fill: '#f59e0b', stops: '#fbbf24 #b45309', border: '#b45309' },
  { name: 'Rose', fill: '#f43f5e', stops: '#fb7185 #be123c', border: '#be123c' },
  { name: 'Pink', fill: '#ec4899', stops: '#f472b6 #be185d', border: '#be185d' },
];

// Per-node colour overrides (node id → colour), re-applied across theme changes.
const colorOverrides = new Map<string, NodeColor>();

// Scale an #rrggbb colour toward black (factor < 1) for a derived border/stop.
function darken(hex: string, factor: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.round(((value >> 16) & 255) * factor);
  const g = Math.round(((value >> 8) & 255) * factor);
  const b = Math.round((value & 255) * factor);
  return `#${(((r << 16) | (g << 8) | b) >>> 0).toString(16).padStart(6, '0')}`;
}

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
    // Linked-to-code marker (KAN-31) — a dashed emerald ring so the user sees which
    // nodes can jump to source.
    {
      selector: 'node.linked',
      style: ext({
        'border-width': 3,
        'border-color': '#34d399',
        'border-style': 'double',
      }),
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

    /* ── Per-type diagram notation (KAN-20..24) ──────────────────────────────
     * Each diagram type uses its conventional shapes/arrowheads, but stays on the
     * shared violet palette + fonts so the look is cohesive. Node-shape classes
     * override the base `round-rectangle`; relation classes override the base edge
     * arrowhead. */

    // Flowchart (KAN-21) ----------------------------------------------------
    // Terminator (start/end) — a rounded "pill".
    {
      selector: 'node.fc-terminator',
      style: ext({ shape: 'round-rectangle', 'corner-radius': '999px' }),
    },
    // End terminator — emerald fill signalling completion (distinct from the
    // `success` status class so it never pollutes the legend).
    {
      selector: 'node.fc-end',
      style: ext({
        'background-fill': 'solid',
        'background-color': '#059669',
        'border-color': '#064e3b',
      }),
    },
    // Process step — a sharp-cornered rectangle.
    {
      selector: 'node.fc-process',
      style: ext({ shape: 'rectangle', 'corner-radius': '2px' }),
    },
    // Input / output — a parallelogram.
    {
      selector: 'node.fc-io',
      style: ext({ shape: 'rhomboid' }),
    },
    // Decision — a diamond so branch points read as decisions.
    {
      selector: 'node.decision',
      style: ext({
        shape: 'diamond',
        'background-color': '#f59e0b',
        'background-gradient-stop-colors': '#fbbf24 #b45309',
        'border-color': '#b45309',
        'text-max-width': '120px',
        padding: '20px',
      }),
    },

    // State machine (KAN-22) ------------------------------------------------
    // Initial state — a bright emerald fill marks the start.
    {
      selector: 'node.initial',
      style: ext({
        'background-fill': 'solid',
        'background-color': '#10b981',
        'border-width': 4,
        'border-color': '#a7f3d0',
        color: '#04231a',
      }),
    },
    // Final / accepting state — a thick double border (bullseye-like).
    {
      selector: 'node.final',
      style: ext({
        'border-width': 5,
        'border-style': 'double',
        'border-color': '#f6f4ff',
      }),
    },
    // Transition — UML uses an open (stick) arrowhead, not a filled triangle.
    {
      selector: 'edge.sm-transition',
      style: ext({ 'target-arrow-shape': 'vee' }),
    },

    // Class diagram (KAN-23) ------------------------------------------------
    // Class box — a sharp-cornered rectangle. UML relations all share one neutral
    // violet line and differ only by arrowhead + line-style, the UML convention.
    {
      selector: 'node.uml-class',
      style: ext({ shape: 'rectangle', 'corner-radius': '3px' }),
    },
    // Generalization (inheritance): solid line, hollow triangle at the superclass.
    {
      selector: 'edge.inheritance',
      style: ext({
        'line-fill': 'solid',
        'line-color': '#a78bfa',
        'target-arrow-shape': 'triangle',
        'target-arrow-fill': 'hollow',
        'target-arrow-color': '#a78bfa',
        'arrow-scale': 1.4,
      }),
    },
    // Realization (implements): dashed line, hollow triangle at the interface.
    {
      selector: 'edge.realization',
      style: ext({
        'line-fill': 'solid',
        'line-color': '#a78bfa',
        'line-style': 'dashed',
        'target-arrow-shape': 'triangle',
        'target-arrow-fill': 'hollow',
        'target-arrow-color': '#a78bfa',
        'arrow-scale': 1.4,
      }),
    },
    // Association: solid line, plain open arrow (vee).
    {
      selector: 'edge.association',
      style: ext({
        'line-fill': 'solid',
        'line-color': '#a78bfa',
        'target-arrow-shape': 'vee',
        'target-arrow-color': '#a78bfa',
      }),
    },
    // Dependency («use»): dashed line, plain open arrow (vee).
    {
      selector: 'edge.dependency',
      style: ext({
        'line-fill': 'solid',
        'line-color': '#a78bfa',
        'line-style': 'dashed',
        'target-arrow-shape': 'vee',
        'target-arrow-color': '#a78bfa',
      }),
    },
    // Aggregation: hollow diamond at the whole/owner (`from` = source end).
    {
      selector: 'edge.aggregation',
      style: ext({
        'line-fill': 'solid',
        'line-color': '#a78bfa',
        'source-arrow-shape': 'diamond',
        'source-arrow-fill': 'hollow',
        'source-arrow-color': '#a78bfa',
        'target-arrow-shape': 'none',
        'arrow-scale': 1.3,
      }),
    },
    // Composition: filled diamond at the whole/owner (`from` = source end).
    {
      selector: 'edge.composition',
      style: ext({
        'line-fill': 'solid',
        'line-color': '#a78bfa',
        'source-arrow-shape': 'diamond',
        'source-arrow-fill': 'filled',
        'source-arrow-color': '#a78bfa',
        'target-arrow-shape': 'none',
        'arrow-scale': 1.3,
      }),
    },

    // Entity / relationship (KAN-24) ----------------------------------------
    // Entity — a sharp-cornered "table" box.
    {
      selector: 'node.er-entity',
      style: ext({ shape: 'rectangle', 'corner-radius': '3px' }),
    },
    // Relationship — a plain line (no arrowhead); cardinality rides in the label.
    {
      selector: 'edge.er-rel',
      style: ext({
        'line-fill': 'solid',
        'line-color': '#22d3ee',
        'target-arrow-shape': 'none',
      }),
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
  // Re-apply any per-node colour overrides on top of the new stylesheet.
  colorOverrides.forEach((color, id) => {
    const node = cy.getElementById(id);
    if (node.nonempty()) styleNodeColor(node, color);
  });
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

/* ─── Node context menu: right-click a node to edit its label and colour ─── */

const nodeMenu = document.getElementById('node-menu');
const labelInput = document.getElementById('node-label-input');
const swatchContainer = document.getElementById('node-swatches');
const menuExpand = document.getElementById('ctx-expand');
let menuNode: cytoscape.NodeSingular | undefined;

function styleNodeColor(
  node: { style: (props: object) => unknown },
  color: NodeColor,
): void {
  node.style({
    'background-color': color.fill,
    'background-gradient-stop-colors': color.stops,
    'border-color': color.border,
  });
}

function applyNodeColor(color: NodeColor): void {
  if (!menuNode) return;
  colorOverrides.set(menuNode.id(), color);
  styleNodeColor(menuNode, color);
}

function openNodeMenu(node: cytoscape.NodeSingular, x: number, y: number): void {
  if (!nodeMenu) return;
  menuNode = node;
  if (labelInput instanceof HTMLInputElement) {
    labelInput.value = String(node.data('label') ?? '');
  }
  // Only offer "Expand element" when the node has neighbours to drill into.
  if (menuExpand) menuExpand.hidden = !isExpandable(node.id());
  renderCodeRefs(node);
  nodeMenu.hidden = false;
  // Keep the menu inside the viewport.
  const { width, height } = nodeMenu.getBoundingClientRect();
  nodeMenu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
  nodeMenu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`;
  if (labelInput instanceof HTMLInputElement) {
    labelInput.focus();
    labelInput.select();
  }
}

function closeNodeMenu(commit: boolean): void {
  if (commit && menuNode && labelInput instanceof HTMLInputElement) {
    const text = labelInput.value.trim();
    if (text) menuNode.data('label', text);
  }
  if (nodeMenu) nodeMenu.hidden = true;
  menuNode = undefined;
}

// Build the colour swatches once (presets + a custom colour picker).
if (swatchContainer) {
  for (const color of NODE_COLORS) {
    const [from, to] = color.stops.split(' ');
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch';
    swatch.title = color.name;
    swatch.setAttribute('aria-label', `${color.name} colour`);
    swatch.style.background = `linear-gradient(135deg, ${from}, ${to})`;
    swatch.addEventListener('click', () => applyNodeColor(color));
    swatchContainer.append(swatch);
  }
  const custom = document.createElement('label');
  custom.className = 'swatch custom';
  custom.title = 'Custom colour';
  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = '#8b5cf6';
  picker.addEventListener('input', () =>
    applyNodeColor({
      name: 'Custom',
      fill: picker.value,
      stops: `${picker.value} ${darken(picker.value, 0.62)}`,
      border: darken(picker.value, 0.55),
    }),
  );
  custom.append(picker, document.createTextNode('+'));
  swatchContainer.append(custom);
}

/* Code references + node actions inside the unified right-click menu (KAN-31/32). */
const nodeCodeWrap = document.getElementById('node-code');
const nodeCodeRefs = document.getElementById('node-coderefs');
const nodeCenterBtn = document.getElementById('node-center');
const nodeExplainBtn = document.getElementById('node-explain');
const nodeExpandBtn = document.getElementById('node-expand');

function formatCodeRef(ref: CodeRef): string {
  const file = ref.path.split(/[\\/]/).pop() || ref.path;
  const line = ref.range ? `:${ref.range.startLine}` : '';
  return ref.symbol ? `${ref.symbol} · ${file}${line}` : `${file}${line}`;
}

// Ask the extension to open a node's code at a specific ref (KAN-31/32).
function openNodeCode(nodeId: string, refIndex: number): void {
  vscode?.postMessage({
    type: 'node_action',
    action: 'open_code',
    nodeId,
    refIndex,
  });
  closeNodeMenu(true);
}

// Populate (and show/hide) the "Code references" section for the menu's node so
// the user can see — and jump to — the code each node maps to.
function renderCodeRefs(node: cytoscape.NodeSingular): void {
  if (!nodeCodeWrap || !nodeCodeRefs) return;
  const refs = (node.data('codeRefs') as CodeRef[] | undefined) ?? [];
  nodeCodeRefs.replaceChildren();
  if (refs.length === 0) {
    nodeCodeWrap.hidden = true;
    return;
  }
  const nodeId = node.id();
  refs.forEach((ref, index) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'coderef-row';
    row.title = `Open ${ref.path}${ref.range ? `:${ref.range.startLine}` : ''}`;
    row.textContent = formatCodeRef(ref);
    row.addEventListener('click', () => openNodeCode(nodeId, index));
    nodeCodeRefs.append(row);
  });
  nodeCodeWrap.hidden = false;
}

// "Center on node" action — re-frame the view on the menu's node.
nodeCenterBtn?.addEventListener('click', () => {
  const node = menuNode;
  closeNodeMenu(true);
  if (node)
    cy.animate({ center: { eles: node }, duration: 200, easing: 'ease-out' });
});

// "Explain node" action — ask the extension to have Copilot explain this node;
// the full explanation is produced in the CLI (it calls describe_node).
nodeExplainBtn?.addEventListener('click', () => {
  const nodeId = menuNode?.id();
  closeNodeMenu(true);
  if (nodeId) vscode?.postMessage({ type: 'node_action', action: 'explain', nodeId });
});

/* ─── Expand node: dialog to choose the kind & depth of expansion (KAN-11) ─── */
const expandDialog = document.getElementById('expand-dialog');
const expandModeSel = document.getElementById('expand-mode');
const expandDepthSel = document.getElementById('expand-depth');
const expandFocusInput = document.getElementById('expand-focus');
const expandSubmitBtn = document.getElementById('expand-submit');
const expandCancelBtn = document.getElementById('expand-cancel');
let expandNodeId: string | undefined;

function openExpandDialog(nodeId: string): void {
  if (!expandDialog) return;
  expandNodeId = nodeId;
  if (expandFocusInput instanceof HTMLInputElement) expandFocusInput.value = '';
  expandDialog.hidden = false;
  if (expandModeSel instanceof HTMLSelectElement) expandModeSel.focus();
}

function closeExpandDialog(): void {
  if (expandDialog) expandDialog.hidden = true;
  expandNodeId = undefined;
}

function submitExpand(): void {
  const nodeId = expandNodeId;
  const mode =
    expandModeSel instanceof HTMLSelectElement ? expandModeSel.value : 'detail';
  const depth =
    expandDepthSel instanceof HTMLSelectElement
      ? Number(expandDepthSel.value)
      : 1;
  const focus =
    expandFocusInput instanceof HTMLInputElement
      ? expandFocusInput.value.trim()
      : '';
  closeExpandDialog();
  if (nodeId)
    vscode?.postMessage({
      type: 'node_action',
      action: 'expand',
      nodeId,
      mode,
      depth,
      focus,
    });
}

// "Expand node" action — open the dialog to gather the expansion preferences.
nodeExpandBtn?.addEventListener('click', () => {
  const nodeId = menuNode?.id();
  closeNodeMenu(true);
  if (nodeId) openExpandDialog(nodeId);
});

// "Expand element" action — client-side drill-down into the node's neighbourhood
// as a sub-scope of the same diagram (FR-7), distinct from the server-side
// "Expand node" above.
menuExpand?.addEventListener('click', () => {
  const id = menuNode?.id();
  closeNodeMenu(false);
  if (id) expandElement(id);
});

expandSubmitBtn?.addEventListener('click', submitExpand);
expandCancelBtn?.addEventListener('click', closeExpandDialog);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && expandDialog && !expandDialog.hidden) {
    closeExpandDialog();
  }
});

// Escape closes the menu even when focus isn't in the label field.
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && nodeMenu && !nodeMenu.hidden) {
    closeNodeMenu(false);
  }
});

// Right-click a node to edit it (label / colour / code refs) and select it so the
// CLI knows the target. Suppress the browser menu over the canvas.
cy.container()?.addEventListener('contextmenu', (event) =>
  event.preventDefault(),
);
cy.on('cxttap', 'node', (event) => {
  const node = event.target as cytoscape.NodeSingular;
  cy.elements().unselect();
  node.select();
  emitSelection([node.id()]);
  const mouse = event.originalEvent as MouseEvent | undefined;
  openNodeMenu(
    node,
    mouse?.clientX ?? event.renderedPosition.x,
    mouse?.clientY ?? event.renderedPosition.y,
  );
});
cy.on('cxttap', (event) => {
  if (event.target === cy) closeNodeMenu(false);
});
cy.on('pan zoom', () => closeNodeMenu(true));

labelInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    closeNodeMenu(true);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    closeNodeMenu(false);
  }
});

// A click anywhere outside the open menu commits and closes it.
document.addEventListener('pointerdown', (event) => {
  if (!nodeMenu || nodeMenu.hidden) return;
  const target = event.target;
  if (target instanceof Node && nodeMenu.contains(target)) return;
  closeNodeMenu(true);
});

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
      if (element.codeRefs && element.codeRefs.length > 0) {
        target.data('codeRefs', element.codeRefs);
      }
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
  // Carry codeRefs (a top-level CyElement field) onto the node data so the canvas
  // can display them and detect linked nodes (KAN-31/32).
  const data = { ...el.data } as Record<string, unknown>;
  if (el.codeRefs && el.codeRefs.length > 0) data.codeRefs = el.codeRefs;
  const def: cytoscape.ElementDefinition = {
    data: data as cytoscape.ElementDefinition['data'],
  };
  if (el.classes) def.classes = el.classes;
  const style = mapStyle(el.style, isEdgeElement(el));
  if (style) def.style = style as cytoscape.Css.Node;
  return def;
}

function render(elements: CyElement[]): void {
  closeNodeMenu(false);
  colorOverrides.clear();
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
  { key: 'linked', label: 'Linked to code', color: '#34d399' },
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

// ── Drill-down / scope navigation ───────────────────────────────────────────
// "Expand element" (node context menu) focuses a node + its directly-connected
// neighbours as a sub-scope of the SAME diagram (same elements/notation); a
// "Back" breadcrumb steps to the previous scope. A fresh diagram from the host
// resets the stack (it's a new top-level scope). All client-side — no re-gen.
interface Scope {
  title: string;
  elements: CyElement[];
}
let currentScopeElements: CyElement[] = [];
const scopeStack: Scope[] = [];
const scopeBackBtn = document.getElementById('scope-back-btn');

/** Render an elements subset as the active view, returning whether it rendered. */
function showElements(elements: CyElement[], title: string): boolean {
  const result = validateGraphModel(elements);
  if (!result.ok) {
    showError(result.errors);
    return false;
  }
  setTitle(title);
  try {
    render(result.elements);
    clearError();
    updateLegend();
    return true;
  } catch (err) {
    showError([`Cytoscape could not render this model: ${String(err)}`]);
    return false;
  }
}

/** Show/hide the Back button and label it with the scope it returns to. */
function updateScopeBar(): void {
  if (!scopeBackBtn) return;
  scopeBackBtn.hidden = scopeStack.length === 0;
  const parent = scopeStack[scopeStack.length - 1];
  scopeBackBtn.title = parent
    ? `Back to "${parent.title || 'previous scope'}"`
    : 'Back to previous scope';
}

/** Can this node be drilled into (does it have at least one neighbour)? */
function isExpandable(nodeId: string): boolean {
  return countNodes(closedNeighbourhood(currentScopeElements, nodeId)) > 1;
}

/** Drill into a node: focus it + its neighbours, pushing the current scope. */
function expandElement(nodeId: string): void {
  const subset = closedNeighbourhood(currentScopeElements, nodeId);
  if (countNodes(subset) <= 1) return; // nothing to drill into
  const label = nodeLabel(currentScopeElements, nodeId) ?? nodeId;
  const parentTitle = currentTitle;
  const childTitle = parentTitle ? `${parentTitle} › ${label}` : label;
  scopeStack.push({ title: parentTitle, elements: currentScopeElements });
  if (showElements(subset, childTitle)) {
    currentScopeElements = subset;
    updateScopeBar();
  } else {
    scopeStack.pop(); // render failed — undo the push
  }
}

/** Step back to the previous scope on the stack. */
function scopeBack(): void {
  const prev = scopeStack.pop();
  if (!prev) return;
  if (showElements(prev.elements, prev.title)) {
    currentScopeElements = prev.elements;
  } else {
    scopeStack.push(prev); // restore on failure
  }
  updateScopeBar();
}

scopeBackBtn?.addEventListener('click', () => scopeBack());

function handleDiagram(msg: DiagramMessage): void {
  const result = validateGraphModel(msg.elements);
  if (!result.ok) {
    showError(result.errors);
    return;
  }
  currentDiagramId = msg.diagramId;
  // A new diagram from the host is a fresh top-level scope.
  scopeStack.length = 0;
  currentScopeElements = msg.elements;
  setTitle(msg.title);
  try {
    render(result.elements);
    clearError();
    updateLegend();
  } catch (err) {
    showError([`Cytoscape could not render this model: ${String(err)}`]);
  }
  updateScopeBar();
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

// Node selection on right-click and the menu actions are handled by the unified
// node context menu above (label / colour / code references / center).

/* ─── Export / download the diagram as an image (PNG / JPG / SVG) ─── */
const exportBtn = document.getElementById('export-btn');
const exportMenu = document.getElementById('export-menu');
const exportFormatSel = document.getElementById('export-format');
const exportScaleField = document.getElementById('export-scale-field');
const exportScaleSel = document.getElementById('export-scale');
const exportAreaSel = document.getElementById('export-area');
const exportTransparent = document.getElementById('export-transparent');
const exportBgField = document.getElementById('export-bg-field');
const exportBgInput = document.getElementById('export-bg');
const exportDownloadBtn = document.getElementById('export-download');
const exportCancelBtn = document.getElementById('export-cancel');

// Solid theme background, used when the user doesn't want a transparent export.
const THEME_BG: Record<Theme, string> = { dark: '#0b0a12', light: '#f4f3fb' };

function isExportOpen(): boolean {
  return !!exportMenu && !exportMenu.hidden;
}

// Show only the options that apply to the chosen format: SVG is vector so it
// ignores the raster scale; JPG has no alpha channel so transparency is disabled;
// the custom bg colour only matters when not exporting transparently.
function syncExportFields(): void {
  const format =
    exportFormatSel instanceof HTMLSelectElement ? exportFormatSel.value : 'png';
  if (exportScaleField) exportScaleField.hidden = format === 'svg';
  if (exportTransparent instanceof HTMLInputElement) {
    const isJpg = format === 'jpg';
    exportTransparent.disabled = isJpg;
    if (isJpg) exportTransparent.checked = false;
  }
  const transparent =
    exportTransparent instanceof HTMLInputElement && exportTransparent.checked;
  if (exportBgField) exportBgField.hidden = transparent;
}

function openExportMenu(): void {
  if (!exportMenu) return;
  if (exportBgInput instanceof HTMLInputElement)
    exportBgInput.value = THEME_BG[currentTheme];
  syncExportFields();
  exportMenu.hidden = false;
  exportBtn?.setAttribute('aria-expanded', 'true');
}

function closeExportMenu(): void {
  if (exportMenu) exportMenu.hidden = true;
  exportBtn?.setAttribute('aria-expanded', 'false');
}

// Filesystem-friendly file name derived from the current diagram title.
function exportFileName(format: ImageFormat): string {
  const base = (currentTitle || 'diagram')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'diagram'}.${format}`;
}

// Plain-browser (dev) download via an anchor — the webview path posts the image
// to the extension instead, which shows a Save dialog and writes the file.
function browserDownload(
  data: string,
  encoding: 'base64' | 'utf8',
  mime: string,
  fileName: string,
): void {
  let href: string;
  let revoke: string | undefined;
  if (encoding === 'utf8') {
    href = URL.createObjectURL(new Blob([data], { type: mime }));
    revoke = href;
  } else {
    href = `data:${mime};base64,${data}`;
  }
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(revoke), 1000);
}

// Render the current diagram to the chosen format and hand it off for saving.
function runExport(): void {
  if (cy.elements().empty()) {
    closeExportMenu();
    return;
  }
  const format = (
    exportFormatSel instanceof HTMLSelectElement ? exportFormatSel.value : 'png'
  ) as ImageFormat;
  const scale =
    exportScaleSel instanceof HTMLSelectElement
      ? Number(exportScaleSel.value) || 1
      : 1;
  const full =
    !(exportAreaSel instanceof HTMLSelectElement) ||
    exportAreaSel.value === 'full';
  const transparent =
    format !== 'jpg' &&
    exportTransparent instanceof HTMLInputElement &&
    exportTransparent.checked;
  const bg =
    exportBgInput instanceof HTMLInputElement
      ? exportBgInput.value
      : THEME_BG[currentTheme];

  let data: string;
  let encoding: 'base64' | 'utf8';
  let mime: string;
  try {
    if (format === 'svg') {
      // SVG is vector: omit bg for a transparent (no background rect) export.
      // cytoscape-svg adds cy.svg() at runtime; @types/cytoscape doesn't type it.
      const cySvg = cy as unknown as {
        svg(opts: { scale: number; full: boolean; bg?: string }): string;
      };
      data = cySvg.svg({ scale, full, bg: transparent ? undefined : bg });
      encoding = 'utf8';
      mime = 'image/svg+xml';
    } else {
      const opts = {
        output: 'base64' as const,
        scale,
        full,
        bg: transparent ? 'transparent' : bg,
      };
      data = format === 'png' ? cy.png(opts) : cy.jpg(opts);
      encoding = 'base64';
      mime = format === 'png' ? 'image/png' : 'image/jpeg';
    }
  } catch (err) {
    showError([`Could not export the diagram: ${String(err)}`]);
    closeExportMenu();
    return;
  }

  const fileName = exportFileName(format);
  closeExportMenu();

  if (vscode) {
    vscode.postMessage({
      type: 'save_image',
      sessionId: 'webview',
      format,
      data,
      encoding,
      fileName,
    });
  } else {
    browserDownload(data, encoding, mime, fileName);
  }
}

exportBtn?.addEventListener('click', () =>
  isExportOpen() ? closeExportMenu() : openExportMenu(),
);
exportFormatSel?.addEventListener('change', syncExportFields);
exportTransparent?.addEventListener('change', syncExportFields);
exportDownloadBtn?.addEventListener('click', runExport);
exportCancelBtn?.addEventListener('click', closeExportMenu);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isExportOpen()) closeExportMenu();
});
// A click outside the popover (and not on its toggle) closes it.
document.addEventListener('pointerdown', (event) => {
  if (!isExportOpen()) return;
  const target = event.target;
  if (
    target instanceof Node &&
    (exportMenu?.contains(target) || exportBtn?.contains(target))
  )
    return;
  closeExportMenu();
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
