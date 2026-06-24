// Canvas webview entry (KAN-6). Connects to the extension's postMessage channel,
// announces readiness with `hello`, validates and renders incoming `diagram`
// models with Cytoscape, and offers built-in pan/zoom plus a fit/reset control.
// An invalid graph model surfaces a readable error instead of a blank canvas.
import cytoscape from 'cytoscape';
import {
  PROTOCOL_VERSION,
  isDiagramMessage,
  isPatchMessage,
  type CanvasMessage,
  type CyElement,
  type DiagramMessage,
  type PatchMessage,
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

// Apply an in-place patch WITHOUT re-laying-out or re-fitting, so the current
// view (pan, zoom, node positions) is preserved (KAN-25).
function handlePatch(msg: PatchMessage): void {
  cy.batch(() => {
    // Remove first so an add can reuse an id.
    for (const id of msg.remove) {
      cy.getElementById(id).remove();
    }
    // Merge data into existing elements in place (preserves position).
    for (const element of msg.update) {
      const id = element.data.id;
      if (typeof id !== 'string') continue;
      const target = cy.getElementById(id);
      if (target.nonempty()) target.data({ ...element.data });
    }
    // Add new elements; place new nodes near the current viewport centre so they
    // appear in view without disturbing the existing layout.
    const additions = msg.add as cytoscape.ElementDefinition[];
    if (additions.length > 0) {
      const view = cy.extent();
      const mid = {
        x: (view.x1 + view.x2) / 2,
        y: (view.y1 + view.y2) / 2,
      };
      for (const def of additions) {
        const isNode =
          def.data.source === undefined && def.data.target === undefined;
        cy.add(
          isNode
            ? {
                ...def,
                position: {
                  x: mid.x + (Math.random() - 0.5) * 60,
                  y: mid.y + (Math.random() - 0.5) * 60,
                },
              }
            : def,
        );
      }
    }
  });
}

function render(elements: CyElement[]): void {
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
  else if (isPatchMessage(msg)) handlePatch(msg);
});

// Tell the extension we're ready to receive a diagram (avoids a load race).
vscode?.postMessage({
  type: 'hello',
  client: 'webview',
  protocol: PROTOCOL_VERSION,
});
