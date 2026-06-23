// Canvas webview entry (KAN-6 seed). Renders graph models pushed from the
// extension over postMessage with Cytoscape, and tells the host when it's ready.
import cytoscape from 'cytoscape';
import {
  isDiagramMessage,
  type CanvasMessage,
  type CyElement,
} from '@canvas/shared';

// Available when running inside a VS Code webview; undefined in a plain browser.
declare function acquireVsCodeApi():
  | { postMessage: (msg: unknown) => void }
  | undefined;

const vscode =
  typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;

const cy = cytoscape({
  container: document.getElementById('cy'),
  elements: [],
  layout: { name: 'breadthfirst', directed: true },
  style: [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'background-color': '#2563eb',
        color: '#fff',
        'font-size': 11,
        width: 'label',
        height: 'label',
        padding: '10px',
        shape: 'round-rectangle',
        'text-wrap': 'wrap',
      },
    },
    {
      selector: 'edge',
      style: {
        label: 'data(label)',
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'line-color': '#94a3b8',
        'target-arrow-color': '#94a3b8',
        'font-size': 9,
        color: '#475569',
        'text-background-color': '#fff',
        'text-background-opacity': 1,
        'text-background-padding': '2px',
      },
    },
  ],
});

function render(elements: CyElement[]): void {
  cy.elements().remove();
  cy.add(elements as cytoscape.ElementDefinition[]);
  cy.layout({ name: 'breadthfirst', directed: true }).run();
  cy.fit(undefined, 30);
}

window.addEventListener('message', (event: MessageEvent<CanvasMessage>) => {
  const msg = event.data;
  if (isDiagramMessage(msg)) {
    document.title = msg.title;
    render(msg.elements);
  }
});

// Tell the extension we're ready to receive a diagram (avoids a load race).
vscode?.postMessage({ type: 'hello', client: 'webview', protocol: 1 });
