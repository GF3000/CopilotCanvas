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

const cy = cytoscape({
  container: document.getElementById('cy'),
  elements: [],
  layout: { name: 'breadthfirst', directed: true, spacingFactor: 1.25 },
  // Built-in pan/zoom (FR-3); zoom bounds keep large graphs legible.
  userPanningEnabled: true,
  userZoomingEnabled: true,
  minZoom: 0.1,
  maxZoom: 4,
  style: [
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
        'border-color': 'rgba(0, 0, 0, 0.3)',
        // Squircle corners + a soft two-tone gradient. (No underlay — it renders
        // as a hard-edged second box rather than a blurred glow.)
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
      }),
    },
    {
      selector: 'node[kind = "service"]',
      style: ext({
        'background-color': '#8b5cf6',
        'background-gradient-stop-colors': '#a78bfa #6d28d9',
      }),
    },
    {
      selector: 'node[kind = "module"]',
      style: ext({
        'background-color': '#6366f1',
        'background-gradient-stop-colors': '#818cf8 #4338ca',
      }),
    },
    {
      selector: 'node[kind = "datastore"]',
      style: ext({
        'background-color': '#06b6d4',
        'background-gradient-stop-colors': '#22d3ee #0e7490',
      }),
    },
    {
      selector: 'node[kind = "external"]',
      style: ext({
        'background-color': '#ec4899',
        'background-gradient-stop-colors': '#f472b6 #be185d',
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
        color: '#cbbdf2',
        'text-background-color': '#161325',
        'text-background-opacity': 0.85,
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
  ],
});

const errorPanel = document.getElementById('error');
const errorList = document.getElementById('error-list');
const zoomInButton = document.getElementById('zoom-in-btn');
const zoomOutButton = document.getElementById('zoom-out-btn');
const resetButton = document.getElementById('reset-btn');

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
  document.title = msg.title;
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
