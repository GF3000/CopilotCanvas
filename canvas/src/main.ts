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

const cy = cytoscape({
  container: document.getElementById('cy'),
  elements: [],
  layout: { name: 'breadthfirst', directed: true },
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
        color: '#f5f3ff',
        'font-size': 11,
        'font-weight': 600,
        width: 'label',
        height: 'label',
        padding: '12px',
        shape: 'round-rectangle',
        'text-wrap': 'wrap',
        'text-max-width': '150px',
        'background-color': '#8b5cf6',
        'border-width': 1,
        'border-color': 'rgba(255, 255, 255, 0.22)',
      },
    },
    // Semantic node colours — a cohesive violet palette (D3: canvas owns styling).
    { selector: 'node[kind = "entrypoint"]', style: { 'background-color': '#d946ef' } },
    { selector: 'node[kind = "service"]', style: { 'background-color': '#8b5cf6' } },
    { selector: 'node[kind = "module"]', style: { 'background-color': '#6366f1' } },
    { selector: 'node[kind = "datastore"]', style: { 'background-color': '#06b6d4' } },
    { selector: 'node[kind = "external"]', style: { 'background-color': '#ec4899' } },
    {
      selector: 'edge',
      style: {
        label: 'data(label)',
        'curve-style': 'bezier',
        width: 2,
        'target-arrow-shape': 'triangle',
        'line-color': 'rgba(167, 139, 250, 0.5)',
        'target-arrow-color': 'rgba(167, 139, 250, 0.75)',
        'font-size': 9,
        color: '#cbbdf2',
        'text-background-color': '#161325',
        'text-background-opacity': 0.85,
        'text-background-padding': '3px',
        'text-background-shape': 'roundrectangle',
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
  cy.layout({ name: 'breadthfirst', directed: true }).run();
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
