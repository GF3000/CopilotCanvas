// Canvas webview entry (KAN-6). Connects to the extension's postMessage channel,
// announces readiness with `hello`, validates and renders incoming `diagram`
// models with Cytoscape, and offers built-in pan/zoom plus a fit/reset control.
// An invalid graph model surfaces a readable error instead of a blank canvas.
import cytoscape from 'cytoscape';
import {
  PROTOCOL_VERSION,
  isDiagramMessage,
  type CanvasMessage,
  type CyElement,
  type DiagramMessage,
} from '@canvas/shared';
import { validateGraphModel } from './graphModel';

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
  layout: { name: 'breadthfirst', directed: true, spacingFactor: 1.25 },
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

// Right-click a node to edit it; suppress the browser menu over the canvas.
cy.container()?.addEventListener('contextmenu', (event) => event.preventDefault());
cy.on('cxttap', 'node', (event) => {
  const mouse = event.originalEvent as MouseEvent;
  openNodeMenu(event.target as cytoscape.NodeSingular, mouse.clientX, mouse.clientY);
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

function render(elements: CyElement[]): void {
  closeNodeMenu(false);
  colorOverrides.clear();
  cy.elements().remove();
  cy.add(elements as cytoscape.ElementDefinition[]);
  cy.layout({ name: 'breadthfirst', directed: true, spacingFactor: 1.25 }).run();
  cy.fit(undefined, FIT_PADDING);
}

// Validate before rendering so a bad model shows an error, not a blank canvas
// (FR-1, TC-2). The render itself is guarded too, in case Cytoscape rejects
// input the validator didn't anticipate.
function handleDiagram(msg: DiagramMessage): void {
  const result = validateGraphModel(msg.elements);
  if (!result.ok) {
    showError(result.errors);
    return;
  }
  setTitle(msg.title);
  try {
    render(result.elements);
    clearError();
  } catch (err) {
    showError([`Cytoscape could not render this model: ${String(err)}`]);
  }
}

window.addEventListener('message', (event: MessageEvent<CanvasMessage>) => {
  const msg = event.data;
  if (isDiagramMessage(msg)) handleDiagram(msg);
});

// Tell the extension we're ready to receive a diagram (avoids a load race).
vscode?.postMessage({
  type: 'hello',
  client: 'webview',
  protocol: PROTOCOL_VERSION,
});
